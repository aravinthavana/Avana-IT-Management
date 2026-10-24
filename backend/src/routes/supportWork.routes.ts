import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { workInput, reportPeriod, reportStatus, utcDate } from '../utils/supportWork';
import { buildWorkReport } from '../services/supportWorkReport.service';
import { sendSupportWorkSummary } from '../services/supportWorkEmail.service';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { importRequest, previewWorkImport } from '../services/supportWorkImport.service';

const router = Router();
router.use('/api/support-work', authenticateToken, requireAdmin);
router.use('/api/support-work', (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
const person = { id: true, name: true } as const;
const activityInclude = { performedBy: { select: person }, recordedBy: { select: person } };
const caseInclude = { assignedTo: { select: person }, _count: { select: { activities: true } } };
const attachmentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const workbookUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
class WorkError extends Error { constructor(public status: number, message: string) { super(message); } }
const failure = (res: any, error: unknown) => {
    if (error instanceof WorkError) return res.status(error.status).json({ error: error.message });
    if ((error as any)?.name === 'ZodError') return res.status(400).json({ error: (error as any).issues.map((i: any) => i.message).join('. ') });
    console.error('Support work request failed', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({ error: 'Unable to process work log. Check that the support work database update has been applied.' });
};

router.get('/api/support-work', async (_req, res) => {
    try {
        // Date windows belong to activity reporting, not the current case queue.
        const cases = await prisma.supportWorkCase.findMany({ include: caseInclude, orderBy: { updatedAt: 'desc' } });
        res.json({ cases });
    } catch (error) { failure(res, error); }
});

// Attachments live in PostgreSQL, not Render's public, temporary upload directory.
router.post('/api/support-work/attachments', (req, res, next) => {
    attachmentUpload.single('file')(req, res, error => error ? res.status(400).json({ error: 'Choose one attachment of 5 MB or smaller.' }) : next());
}, async (req: AuthRequest, res) => {
    try {
        if (!req.file) throw new WorkError(400, 'Choose an attachment');
        const file = await prisma.supportWorkAttachment.create({ data: { name: req.file.originalname.slice(0, 250), type: req.file.mimetype,
            size: req.file.size, data: req.file.buffer, createdById: req.user!.id }, select: { id: true, name: true, size: true, type: true } });
        res.status(201).json({ ...file, url: `/api/support-work/attachments/${file.id}` });
    } catch (error) { failure(res, error); }
});
router.get('/api/support-work/attachments/:id', async (req, res) => {
    try {
        const file = await prisma.supportWorkAttachment.findUnique({ where: { id: req.params.id } });
        if (!file) throw new WorkError(404, 'Attachment not found');
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.attachment(file.name);
        res.type('application/octet-stream').send(file.data);
    } catch (error) { failure(res, error); }
});

router.get('/api/support-work/activities', async (req, res) => {
    try {
        const period = reportPeriod(req.query);
        const activities = await prisma.supportWorkActivity.findMany({
            where: { workDate: { gte: utcDate(period.start), lte: utcDate(period.end) }, ...(period.technicianId ? { performedById: period.technicianId } : {}) },
            include: activityInclude, orderBy: [{ workDate: 'desc' }, { id: 'desc' }]
        });
        res.json({ activities });
    } catch (error) { failure(res, error); }
});

router.get('/api/support-work/cases/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) throw new WorkError(400, 'Invalid case');
        const result = await prisma.supportWorkCase.findUnique({ where: { id }, include: { ...caseInclude, activities: { include: activityInclude, orderBy: [{ workDate: 'asc' }, { id: 'asc' }] } } });
        if (!result) throw new WorkError(404, 'Case not found');
        res.json(result);
    } catch (error) { failure(res, error); }
});

router.post('/api/support-work/activities', async (req: AuthRequest, res) => {
    try {
        const v = workInput.parse(req.body);
        // Idempotency keeps retries/double taps from adding duplicate report rows or emails.
        const previous = await prisma.supportWorkActivity.findUnique({ where: { clientRequestId: v.clientRequestId } });
        if (previous) {
            if (previous.recordedById !== req.user!.id) throw new WorkError(409, 'Request identifier already used');
            return res.json({ activity: previous, duplicate: true });
        }
        const performerId = v.performedById || req.user!.id;
        const assigneeId = v.assignedToId || performerId;
        const result = await prisma.$transaction(async tx => {
            for (const id of new Set([performerId, assigneeId])) {
                const technician = await tx.user.findUnique({ where: { id }, select: { role: true, status: true } });
                if (technician?.role !== 'Admin' || technician.status !== 'Active') throw new WorkError(400, 'Choose an active IT administrator');
            }
            const contact = v.contactUserId ? await tx.user.findUnique({ where: { id: v.contactUserId }, select: { id: true, name: true, email: true } }) : null;
            if (v.contactUserId && !contact) throw new WorkError(400, 'Employee no longer exists');
            if (v.affectedUserId && !await tx.user.findUnique({ where: { id: v.affectedUserId }, select: { id: true } })) throw new WorkError(400, 'Affected employee no longer exists');
            if (v.assetId && !await tx.asset.findUnique({ where: { id: v.assetId }, select: { id: true } })) throw new WorkError(400, 'Asset not found');
            const done = ['Completed', 'Cancelled'].includes(v.statusAfter);
            const state = { status: v.statusAfter, waitingReason: v.statusAfter === 'Waiting' ? v.waitingReason : null,
                nextAction: done ? null : v.nextAction, followUpDate: done ? null : v.followUpDate ? utcDate(v.followUpDate) : null };
            let caseId = v.caseId || null;
            if (caseId) {
                const linked = await tx.supportWorkCase.findUnique({ where: { id: caseId } });
                if (!linked) throw new WorkError(404, 'Case not found');
                const latest = await tx.supportWorkActivity.findFirst({ where: { caseId }, orderBy: [{ workDate: 'desc' }, { id: 'desc' }] });
                const historical = latest && v.workDate < latest.workDate.toISOString().slice(0, 10);
                const updated = await tx.supportWorkCase.updateMany({ where: { id: caseId, revision: v.caseRevision }, data: { ...(historical ? {} : { ...state, assignedToId: assigneeId }), revision: { increment: 1 } } });
                if (!updated.count) throw new WorkError(409, 'This case changed. Reload it before adding your update.');
            } else if (v.createCase) {
                const created = await tx.supportWorkCase.create({ data: { subject: v.subject, contactName: v.contactName, contactUserId: contact?.id, affectedUserId: v.affectedUserId,
                    createdById: req.user!.id, assignedToId: assigneeId, ...state } });
                caseId = created.id;
            }
            const activity = await tx.supportWorkActivity.create({ data: {
                clientRequestId: v.clientRequestId, caseId, workDate: utcDate(v.workDate), subject: v.subject,
                contactName: v.contactName, contactUserId: contact?.id, affectedUserId: v.affectedUserId, channel: v.channel, category: v.category, priority: v.priority,
                workDone: v.workDone, statusAfter: state.status, waitingReason: state.waitingReason, nextAction: state.nextAction,
                followUpDate: state.followUpDate, performedById: performerId, recordedById: req.user!.id,
                effortMinutes: v.effortMinutes, assetId: v.assetId, attachments: JSON.stringify(v.attachments),
                notificationStatus: v.notifyEmployee ? 'Requested' : 'Not requested'
            }, include: activityInclude });
            return { activity, contact };
        });
        // Mail happens only after the record commits. Failure never makes a saved row look unsaved.
        let notificationStatus = 'Not requested';
        if (v.notifyEmployee && result.contact?.email) {
            let accepted = false;
            try { accepted = await sendSupportWorkSummary(result.contact.email, v.subject,
                `Hello ${result.contact.name},\n\n${v.workDone}\n\nStatus: ${reportStatus(result.activity)}${result.activity.nextAction ? `\nNext action: ${result.activity.nextAction}` : ''}\n\nAvana IT Support`); } catch { /* Record the failure below. */ }
            notificationStatus = accepted ? 'Accepted by mail service' : 'Failed';
            try { await prisma.supportWorkActivity.update({ where: { id: result.activity.id }, data: { notificationStatus } }); }
            catch { console.error('Work saved, but notification result could not be recorded', result.activity.id); }
        }
        res.status(201).json({ activity: { ...result.activity, notificationStatus } });
    } catch (error) {
        if ((error as any)?.code === 'P2002') return res.status(409).json({ error: 'This entry was already saved. Refresh the work log before retrying.' });
        failure(res, error);
    }
});

router.post('/api/support-work/import/preview', (req, res, next) => {
    workbookUpload.single('file')(req, res, error => error ? res.status(400).json({ error: 'Choose one XLSX workbook of 2 MB or smaller.' }) : next());
}, async (req, res) => {
    try {
        if (!req.file || !req.file.originalname.toLowerCase().endsWith('.xlsx')) throw new WorkError(400, 'Choose an XLSX work report');
        let preview;
        try { preview = await previewWorkImport(req.file.buffer); }
        catch (error) { throw new WorkError(400, error instanceof Error ? error.message : 'Unable to read workbook'); }
        const existing = await prisma.supportWorkActivity.findMany({ where: { importKey: { in: preview.rows.map(row => row.importKey) } }, select: { importKey: true } });
        const keys = new Set(existing.map(row => row.importKey));
        res.json({ ...preview, rows: preview.rows.map(row => ({ ...row, duplicate: keys.has(row.importKey) })) });
    } catch (error) { failure(res, error); }
});

router.post('/api/support-work/import', async (req: AuthRequest, res) => {
    try {
        const input = importRequest.parse(req.body);
        if (new Set(input.rows.map(row => row.importKey)).size !== input.rows.length) throw new WorkError(400, 'Duplicate rows in import');
        const result = await prisma.$transaction(async tx => {
            const performer = await tx.user.findUnique({ where: { id: input.performedById }, select: { role: true, status: true } });
            if (performer?.role !== 'Admin' || performer.status !== 'Active') throw new WorkError(400, 'Choose an active IT administrator');
            const groups = new Map<string, { id: number; revision: number; latest: string }>();
            let imported = 0, skipped = 0;
            for (const row of [...input.rows].sort((a, b) => a.workDate.localeCompare(b.workDate) || a.row - b.row)) {
                if (await tx.supportWorkActivity.findUnique({ where: { importKey: row.importKey } })) { skipped++; continue; }
                const ongoing = !['Completed', 'Cancelled'].includes(row.statusAfter);
                if (ongoing && !row.group) throw new WorkError(400, `Row ${row.row}: group ongoing work into a case`);
                if (ongoing && input.followUpDate < row.workDate) throw new WorkError(400, `Row ${row.row}: follow-up date is before the work date`);
                const state = { status: row.statusAfter, waitingReason: row.statusAfter === 'Waiting' ? row.waitingReason || 'Other' : null,
                    nextAction: ongoing ? input.nextAction : null, followUpDate: ongoing ? utcDate(input.followUpDate) : null };
                let linked = groups.get(row.group), caseId: number | null = null;
                if (row.group) {
                    if (!linked && row.group.startsWith('#')) {
                        const id = Number(row.group.slice(1));
                        if (!Number.isSafeInteger(id) || id < 1) throw new WorkError(400, `Row ${row.row}: use # followed by an existing case number`);
                        const existing = await tx.supportWorkCase.findUnique({ where: { id } });
                        if (!existing) throw new WorkError(400, `Case ${row.group} not found`);
                        const last = await tx.supportWorkActivity.findFirst({ where: { caseId: id }, orderBy: [{ workDate: 'desc' }, { id: 'desc' }] });
                        linked = { id, revision: existing.revision, latest: last ? last.workDate.toISOString().slice(0, 10) : '' };
                    }
                    if (!linked) {
                        const created = await tx.supportWorkCase.create({ data: { subject: row.subject, contactName: row.contactName, createdById: req.user!.id, assignedToId: input.performedById, ...state } });
                        linked = { id: created.id, revision: 0, latest: row.workDate };
                    } else if (row.workDate >= linked.latest) {
                        const update = await tx.supportWorkCase.updateMany({ where: { id: linked.id, revision: linked.revision }, data: { ...state, revision: { increment: 1 } } });
                        if (!update.count) throw new WorkError(409, 'A linked case changed during import. Reload the preview.');
                        linked.revision++; linked.latest = row.workDate;
                    }
                    groups.set(row.group, linked); caseId = linked.id;
                }
                await tx.supportWorkActivity.create({ data: { clientRequestId: randomUUID(), importKey: row.importKey, originalStatus: row.originalStatus,
                    caseId, workDate: utcDate(row.workDate), subject: row.subject, contactName: row.contactName, workDone: row.workDone,
                    channel: 'Unspecified', category: 'Other', performedById: input.performedById, recordedById: req.user!.id,
                    statusAfter: state.status, waitingReason: state.waitingReason, nextAction: state.nextAction, followUpDate: state.followUpDate } });
                imported++;
            }
            return { imported, skipped };
        }, { timeout: 60000 });
        res.status(201).json(result);
    } catch (error) {
        if ((error as any)?.code === 'P2002') return res.status(409).json({ error: 'Some entries were already imported. Reload the preview.' });
        failure(res, error);
    }
});

router.get('/api/support-work/report.xlsx', async (req, res) => {
    try {
        const period = reportPeriod(req.query);
        const rows = await prisma.supportWorkActivity.findMany({ where: { workDate: { gte: utcDate(period.start), lte: utcDate(period.end) },
            ...(period.technicianId ? { performedById: period.technicianId } : {}) }, orderBy: [{ workDate: 'asc' }, { id: 'asc' }] });
        const buffer = await buildWorkReport(rows);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="IT-Work-Report-${period.start}-to-${period.end}.xlsx"`);
        res.send(buffer);
    } catch (error) { failure(res, error); }
});

export default router;
