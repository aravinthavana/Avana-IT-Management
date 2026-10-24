import { prisma } from '../db';

export const M365_REVIEW_FIELDS: Record<string, string> = {
    name: 'Name', jobTitle: 'Job Title', department: 'Department', mobile: 'Mobile',
    location: 'Location', status: 'Status', company: 'Company', employeeId: 'Employee ID',
    city: 'City', state: 'State', country: 'Country', postalCode: 'Postal Code', workAddress: 'Work Address'
};

// Cloud snapshots are evidence for review, never permission to edit portal profiles.
export async function queueM365ProfileChanges(user: any, snapshot: Record<string, any>) {
    const pending = await prisma.hrChangeNotification.findMany({
        where: { employeeEmail: user.email, source: 'Microsoft 365', status: 'Pending' }
    });
    let zoho: Record<string, any> = {};
    try { zoho = JSON.parse(user.zohoData || '{}'); } catch {}
    for (const [key, fieldName] of Object.entries(M365_REVIEW_FIELDS)) {
        if (snapshot[key] === undefined) continue;
        if (['name', 'status'].includes(key) && !snapshot[key]) continue;
        const current = key === 'department' ? user.department?.name : user[key];
        const incoming = snapshot[key] == null || snapshot[key] === '' ? null : String(snapshot[key]);
        const existing = pending.find(n => n.fieldName === fieldName);
        if (String(current || '').trim().toLowerCase() === (incoming || '').trim().toLowerCase()) {
            if (existing) await prisma.hrChangeNotification.delete({ where: { id: existing.id } });
            continue;
        }
        const zohoKey = key === 'jobTitle' ? 'designation' : key;
        const data = {
            employeeId: user.employeeId, employeeEmail: user.email, employeeName: user.name,
            source: 'Microsoft 365', fieldName, currentValue: current == null ? null : String(current),
            m365Value: incoming, zohoValue: zoho[zohoKey] == null ? null : String(zoho[zohoKey]),
            aliases: user.emailAliases, status: 'Pending'
        };
        if (existing) await prisma.hrChangeNotification.update({ where: { id: existing.id }, data });
        else await prisma.hrChangeNotification.create({ data });
    }
}
