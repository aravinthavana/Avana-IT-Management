import { z } from 'zod';

export const workStatuses = ['Open', 'In progress', 'Waiting', 'Completed', 'Cancelled'] as const;
export const workChannels = ['Phone', 'WhatsApp / message', 'Email', 'Walk-in', 'Portal', 'Internal work', 'Unspecified'] as const;
export const waitingReasons = ['Approval', 'Payment', 'Vendor', 'User', 'Verification', 'Other'] as const;
export const workCategories = ['Hardware', 'Software', 'Email', 'Network', 'Account', 'Onboarding / offboarding', 'Purchase / vendor', 'Project / website', 'Documentation', 'Other'] as const;

export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'Enter a valid date');
export const positiveId = z.number().int().positive();
export const workInput = z.object({
    clientRequestId: z.string().uuid(),
    caseId: positiveId.nullable().optional(),
    caseRevision: z.number().int().nonnegative().optional(),
    createCase: z.boolean().default(false),
    workDate: dateOnly,
    subject: z.string().trim().min(1).max(200),
    contactName: z.string().trim().min(1).max(250),
    contactUserId: positiveId.nullable().optional(),
    affectedUserId: positiveId.nullable().optional(),
    channel: z.enum(workChannels),
    category: z.enum(workCategories).default('Other'),
    priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
    workDone: z.string().trim().min(1).max(10000),
    statusAfter: z.enum(workStatuses),
    waitingReason: z.enum(waitingReasons).nullable().optional(),
    nextAction: z.string().trim().max(1000).nullable().optional(),
    followUpDate: dateOnly.nullable().optional(),
    performedById: positiveId.optional(),
    assignedToId: positiveId.optional(),
    effortMinutes: z.number().int().min(1).max(1440).nullable().optional(),
    assetId: positiveId.nullable().optional(),
    attachments: z.array(z.object({ url: z.string().max(2000).regex(/^https?:\/\//), name: z.string().max(250), size: z.number().nonnegative(), type: z.string().max(150) })).max(10).default([]),
    notifyEmployee: z.boolean().default(false)
}).superRefine((v, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (v.caseId && v.createCase) issue('Choose an existing case or create a new case');
    if (v.caseId && v.caseRevision === undefined) issue('Reload the case before adding an update');
    if (!v.caseId && !v.createCase && !['Completed', 'Cancelled'].includes(v.statusAfter)) issue('Ongoing work needs a linked case');
    if (v.statusAfter === 'Waiting' && !v.waitingReason) issue('Choose what you are waiting for');
    if (['Open', 'In progress', 'Waiting'].includes(v.statusAfter) && (!v.nextAction || !v.followUpDate)) issue('Ongoing work needs a next action and follow-up date');
    if (['Open', 'In progress', 'Waiting'].includes(v.statusAfter) && v.followUpDate && v.followUpDate < v.workDate) issue('Follow-up cannot be before the work date');
    if (v.notifyEmployee && !v.contactUserId) issue('Select an employee before requesting an email');
});

export function reportPeriod(query: Record<string, unknown>) {
    const parsed = z.object({ start: dateOnly, end: dateOnly, technicianId: z.coerce.number().int().positive().optional() }).parse(query);
    if (parsed.start > parsed.end) throw new z.ZodError([{ code: 'custom', message: 'Start date must be before end date', path: ['start'] }]);
    return parsed;
}

export const utcDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
export const reportStatus = (row: { statusAfter: string; waitingReason?: string | null; originalStatus?: string | null }) => row.originalStatus || (row.statusAfter === 'Waiting' ? `Waiting on ${row.waitingReason || 'Other'}` : row.statusAfter);
