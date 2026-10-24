import { licenseProvider } from '../utils/licensePolicy';
import { licenseDetails, changeM365License, LicenseActionError } from '../services/licenseManagement.service';
import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { licenseSchema } from '../schemas';

const router = Router();

router.get('/api/licenses', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role } = req.user;
        const licenses = await prisma.license.findMany({ 
            include: { 
                assignments: { 
                    include: { 
                        user: { select: { id: true, name: true, email: true } }, 
                        asset: { select: { id: true, assetId: true, name: true } } 
                    } 
                } 
            } 
        });

        // Security: Non-admin users cannot see raw product license keys
        const sanitized = licenses.map(record => {
            const l = { ...record, provider: licenseProvider(record), assignedSeats: record.assignments.length };
            if (role !== 'Admin') {
                const { key, ...rest } = l;
                return { ...rest, key: null };
            }
            return l;
        });

        res.json(sanitized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch licenses' });
    }
});

router.post('/api/licenses', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = licenseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        if (licenseProvider(validation.data) !== 'manual') return res.status(409).json({ error: 'Import cloud subscriptions using provider sync. Only other software can be added manually.' });
        const license = await prisma.license.create({ data: validation.data });
        res.json(license);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create license' });
    }
});

router.put('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma.license.findUnique({ where: { id: Number(id) } });
        if (!existing) return res.status(404).json({ error: 'Subscription not found.' });
        if (licenseProvider(existing) !== 'manual') return res.status(409).json({ error: 'Cloud subscription details and purchased seats are managed by the provider. Refresh to update them.' });
        const validation = licenseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });
        if (licenseProvider(validation.data) !== 'manual') return res.status(409).json({ error: 'Cloud subscriptions must be imported by sync.' });

        const license = await prisma.license.update({ 
            where: { id: Number(id) }, 
            data: validation.data 
        });
        res.json(license);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update license' });
    }
});

router.delete('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma.license.findUnique({ where: { id: Number(id) } });
        if (!existing) return res.status(404).json({ error: 'Subscription not found.' });
        if (licenseProvider(existing) !== 'manual') return res.status(409).json({ error: 'Cloud subscriptions cannot be deleted here. Manage the subscription with its provider.' });
        await prisma.license.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete license' });
    }
});

// --- License Assignments ---
router.post('/api/license-assignments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { licenseId, userId, assetId } = req.body;
        if (!licenseId) return res.status(400).json({ error: 'License ID is required' });

        const license = await prisma.license.findUnique({
            where: { id: Number(licenseId) },
            include: { assignments: true }
        });

        if (!license) return res.status(404).json({ error: 'License not found' });
        if (licenseProvider(license) !== 'manual') return res.status(409).json({ error: licenseProvider(license) === 'zoho' ? 'Zoho assignments are read-only. Refresh from Zoho to see current users.' : 'Use the Microsoft 365 assignment action to change cloud access.' });
        if (Boolean(userId) === Boolean(assetId)) return res.status(400).json({ error: 'Select exactly one employee or asset.' });

        // Enforce seat limit
        if (license.assignments.length >= license.seats) {
            return res.status(400).json({ error: `Seat limit reached. All ${license.seats} seat(s) for "${license.name}" are assigned.` });
        }

        // Duplicate assignment prevention
        if (userId && license.assignments.some(a => a.userId === Number(userId))) {
            return res.status(400).json({ error: 'This user is already assigned to this license.' });
        }
        if (assetId && license.assignments.some(a => a.assetId === Number(assetId))) {
            return res.status(400).json({ error: 'This asset is already assigned to this license.' });
        }

        const assignment = await prisma.licenseAssignment.create({ 
            data: { 
                licenseId: Number(licenseId), 
                userId: userId ? Number(userId) : null, 
                assetId: assetId ? Number(assetId) : null 
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                asset: { select: { id: true, assetId: true, name: true } }
            }
        });
        res.status(201).json(assignment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to assign license' });
    }
});

router.delete('/api/license-assignments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma.licenseAssignment.findUnique({ where: { id: Number(id) }, include: { license: true } });
        if (!existing) return res.status(404).json({ error: 'Assignment not found.' });
        if (licenseProvider(existing.license) !== 'manual') return res.status(409).json({ error: 'Cloud membership cannot be changed by deleting a portal record. Use Microsoft 365 management; Zoho is read-only.' });
        await prisma.licenseAssignment.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove license assignment' });
    }
});

function actionError(error: any, res: any) {
    const status = error instanceof LicenseActionError ? error.status : error.response?.status === 403 ? 403 : 502;
    const message = error instanceof LicenseActionError ? error.message : status === 403
        ? 'Microsoft did not authorize this operation. Check the integration permissions in Entra.'
        : error.response?.data?.error?.message || 'Could not complete the provider request. Refresh and try again.';
    return res.status(status).json({ error: message });
}

router.get('/api/licenses/:id/assignments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid subscription ID.' });
        res.json(await licenseDetails(id));
    } catch (error) { actionError(error, res); }
});

router.post('/api/licenses/:id/m365-members', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id), userId = Number(req.body.userId);
        if (!Number.isInteger(id) || id < 1 || !Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'Select a valid subscription and employee.' });
        const result = await changeM365License(id, 'assign', { userId });
        res.status(result.status === 'pending' ? 202 : 200).json(result);
    } catch (error) { actionError(error, res); }
});

router.delete('/api/licenses/:id/m365-members/:azureId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid subscription ID.' });
        const result = await changeM365License(id, 'remove', { azureAdId: req.params.azureId });
        res.status(result.status === 'pending' ? 202 : 200).json(result);
    } catch (error) { actionError(error, res); }
});

// --- Asset Requests ---

export default router;
