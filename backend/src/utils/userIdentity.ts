import { prisma } from '../db';
import type { Prisma } from '@prisma/client';
type PortalUser = Prisma.UserGetPayload<{ include: { department: true } }>;

export function normalizedEmployeeId(value?: string | null) {
    return (value || '').replace(/[-_\s]/g, '').toLowerCase();
}

export function emailAliases(value?: string | null): string[] {
    try {
        const parsed = JSON.parse(value || '[]');
        if (Array.isArray(parsed)) return parsed.filter(a => typeof a === 'string').map(a => a.trim().toLowerCase());
    } catch {}
    return (value || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
}

export async function findPortalUser(email: string, employeeId?: string | null, aliases: string[] = [], azureAdId?: string, candidates?: PortalUser[]) {
    const users = candidates || await prisma.user.findMany({ include: { department: true } });
    if (azureAdId) {
        const linked = users.find(u => u.azureAdId === azureAdId);
        if (linked) return linked;
    }
    const emails = [email, ...aliases].map(a => a.trim().toLowerCase());
    const id = normalizedEmployeeId(employeeId);
    const matches = users.filter(u => emails.includes(u.email.trim().toLowerCase())
        || emailAliases(u.emailAliases).some(a => emails.includes(a))
        || (id && [u.employeeId, u.zohoEmployeeId].some(value => normalizedEmployeeId(value) === id)));
    if (matches.length > 1) throw new Error('Multiple portal users match this identity. Resolve it before continuing.');
    return matches[0] || null;
}
