import { reconcileM365Assignments } from './licenseCache.service';
import axios from 'axios';
import { prisma } from '../db';
import { getGraphAppToken } from '../utils/email';
import { findPortalUser } from '../utils/userIdentity';
import { licenseProvider } from '../utils/licensePolicy';
import { fetchAllM365Users, fetchM365SubscribedSkus, M365UserDTO } from './m365.service';
import { fetchZohoEmployees } from './zoho.service';

export class LicenseActionError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

async function graphToken() {
    const auth = await getGraphAppToken();
    if (!auth.token) throw new LicenseActionError('Cannot connect to Microsoft 365. Check the integration and try again.', 502);
    return auth.token;
}

function assignmentInfo(user: M365UserDTO, skuId: string) {
    const states = (user.licenseAssignmentStates || []).filter(s => s.skuId === skuId);
    const groups = states.filter(s => s.assignedByGroup).map(s => s.assignedByGroup!);
    const direct = states.some(s => !s.assignedByGroup);
    return {
        assignmentSource: groups.length ? 'Group managed' : direct ? 'Direct' : 'Source unavailable',
        removable: direct && groups.length === 0,
        state: states.find(s => s.error)?.error || states[0]?.state || 'Assigned',
        note: groups.length ? 'Change group membership in Microsoft Entra, or manage group licensing in the Microsoft 365 admin center. Removing a portal record will not remove access.'
            : !direct ? 'Microsoft did not report the assignment source. Manage this assignment in Microsoft 365.' : undefined
    };
}

export async function licenseDetails(licenseId: number) {
    const license = await prisma.license.findUnique({
        where: { id: licenseId }, include: { assignments: { include: {
            user: { select: { id: true, name: true, email: true, employeeId: true } },
            asset: { select: { id: true, name: true, assetId: true } }
        } } }
    });
    if (!license) throw new LicenseActionError('Subscription not found.', 404);
    const provider = licenseProvider(license);
    const portalUsers = provider === 'm365' ? await prisma.user.findMany({ include: { department: true } }) : [];
    if (provider === 'm365') {
        if (!license.isM365 || !license.skuId) throw new LicenseActionError('Refresh Microsoft 365 to link this subscription before managing its users.', 409);
        const token = await graphToken();
        const [users, skus] = await Promise.all([fetchAllM365Users(token), fetchM365SubscribedSkus(token)]);
        if (users.some(u => !Array.isArray(u.assignedLicenses))) throw new LicenseActionError('Microsoft returned an incomplete assignment snapshot. Cached records were preserved.', 502);
        const sku = skus.find(s => s.skuId === license.skuId);
        if (!sku) throw new LicenseActionError('This subscription is no longer reported by Microsoft 365. Refresh the subscription list.', 409);
        const assigned = users.filter(u => u.assignedLicenses?.some(a => a.skuId === license.skuId));
        const members = [];
        const matchedIds: number[] = [];
        const assignedCloudIds = new Set(assigned.map(u => u.id));
        for (const user of assigned) {
            let match = null;
            try { match = await findPortalUser(user.mail || user.userPrincipalName, user.employeeId, user.otherMails || [], user.id, portalUsers); } catch {}
            if (match) matchedIds.push(match.id);
            members.push({ id: user.id, azureAdId: user.id, userId: match?.id, displayName: user.displayName, department: user.department || match?.department?.name,
                email: user.mail || user.userPrincipalName, employeeId: match?.employeeId || user.employeeId,
                ...assignmentInfo(user, license.skuId) });
        }
        // Replace cached membership only after both cloud reads succeeded in full.
        await reconcileM365Assignments(licenseId, matchedIds, sku.prepaidUnits?.enabled ?? 0);
        const eligibleUsers = portalUsers.filter(u => u.status === 'Active' && u.azureAdId && !assignedCloudIds.has(u.azureAdId)).flatMap(u => {
            const cloud = users.find(c => c.id === u.azureAdId);
            return cloud && cloud.accountEnabled !== false ? [{ id: u.id, displayName: u.name, email: cloud.mail || cloud.userPrincipalName,
                employeeId: u.employeeId, usageLocation: cloud.usageLocation || null }] : [];
        });
        return { provider, mode: 'live', fetchedAt: new Date().toISOString(), members, eligibleUsers,
            seats: sku.prepaidUnits?.enabled ?? 0, assignedSeats: sku.consumedUnits ?? assigned.length,
            availableSeats: Math.max(0, (sku.prepaidUnits?.enabled ?? 0) - (sku.consumedUnits ?? assigned.length)) };
    }
    if (provider === 'zoho' && (license.key === 'ZOHO-PEOPLE-PLUS' || license.name === 'Zoho People Plus (AMD & Tech)')) {
        const employees = await fetchZohoEmployees();
        const active = employees.filter(e => !/resigned|terminated|inactive|relieved/i.test(e.status || ''));
        const members = [];
        for (const employee of active) {
            members.push({ id: employee.employeeId || employee.email, displayName: employee.fullName || employee.email,
                email: employee.email, employeeId: employee.employeeId, department: employee.department, assignmentSource: 'Zoho People', removable: false, state: 'Active' });
        }
        return { provider, mode: 'live', fetchedAt: new Date().toISOString(), members, eligibleUsers: [],
            note: 'Active employees from Zoho People Plus. Manage subscriptions and purchased seats in Zoho.' };
    }
    const members = license.assignments.map(a => ({ id: String(a.id), assignmentId: a.id, userId: a.userId,
        displayName: a.user?.name || a.asset?.name || 'Unlinked assignment', email: a.user?.email,
        employeeId: a.user?.employeeId || a.asset?.assetId, assignedAt: a.assignedAt,
        assignmentSource: provider === 'zoho' ? 'Recorded reference' : 'Portal', removable: provider === 'manual' }));
    return { provider, mode: 'recorded', members, eligibleUsers: [], seats: license.seats, assignedSeats: members.length,
        availableSeats: Math.max(0, license.seats - members.length),
        note: provider === 'zoho' ? 'This Zoho organization is not connected. These are recorded references; manage membership in Zoho.' : undefined };
}

export async function changeM365License(licenseId: number, action: 'assign' | 'remove', target: { userId?: number; azureAdId?: string }) {
    const license = await prisma.license.findUnique({ where: { id: licenseId } });
    if (!license || licenseProvider(license) !== 'm365' || !license.isM365 || !license.skuId) {
        throw new LicenseActionError('Select a Microsoft 365 subscription imported by sync.', 409);
    }
    let azureId = target.azureAdId;
    if (action === 'assign') {
        const user = await prisma.user.findUnique({ where: { id: target.userId } });
        if (!user || user.status !== 'Active' || !user.azureAdId) throw new LicenseActionError('Select an active employee linked to Microsoft 365. Refresh Microsoft 365 if the account is missing.');
        azureId = user.azureAdId;
    }
    if (!azureId || !/^[a-f\d-]{36}$/i.test(azureId)) throw new LicenseActionError('A valid Microsoft account ID is required.');
    const token = await graphToken();
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(azureId)}`;
    const options = { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 };
    const read = async (): Promise<M365UserDTO> => {
        const profile = (await axios.get(`${url}?$select=id,displayName,mail,userPrincipalName,usageLocation,accountEnabled,assignedLicenses,licenseAssignmentStates`, options)).data;
        if (profile?.id !== azureId || !Array.isArray(profile?.assignedLicenses)) throw new LicenseActionError('Microsoft did not return a complete license record for this account. Refresh users to verify the result.', 502);
        return profile;
    };
    const user = await read();
    const hasLicense = (u: M365UserDTO) => Boolean(u.assignedLicenses?.some(a => a.skuId === license.skuId));
    if (action === 'assign' && !hasLicense(user)) {
        if (user.accountEnabled === false) throw new LicenseActionError('The Microsoft account is disabled. Enable it before assigning a license.');
        if (!user.usageLocation) throw new LicenseActionError('Set this employee’s usage location in Microsoft 365, then refresh and try again.');
        const skus = await fetchM365SubscribedSkus(token);
        const sku = skus.find(s => s.skuId === license.skuId);
        if (!sku || (sku.prepaidUnits?.enabled ?? 0) <= (sku.consumedUnits ?? 0)) throw new LicenseActionError('No Microsoft 365 seats are available. Purchase seats in Microsoft 365 and refresh.', 409);
    }
    if (action === 'remove' && hasLicense(user) && !assignmentInfo(user, license.skuId).removable) {
        throw new LicenseActionError('This license is group-managed or its assignment source is unavailable. Manage it in Microsoft Entra or Microsoft 365.', 409);
    }
    if ((action === 'assign') !== hasLicense(user)) {
        await axios.post(`${url}/assignLicense`, {
            addLicenses: action === 'assign' ? [{ skuId: license.skuId, disabledPlans: [] }] : [],
            removeLicenses: action === 'remove' ? [license.skuId] : []
        }, options);
    }
    const verified = await read();
    const confirmed = hasLicense(verified) === (action === 'assign');
    const assignmentError = action === 'assign' && verified.licenseAssignmentStates?.find(s => s.skuId === license.skuId && (s.error || s.state === 'Error' || s.state === 'ActiveWithError'));
    if (assignmentError) throw new LicenseActionError('Microsoft reports a licensing issue: ' + (assignmentError.error || assignmentError.state) + '. Review the user in Microsoft 365.', 409);
    if (confirmed) {
        try { await prisma.user.updateMany({ where: { azureAdId: azureId }, data: { m365LicenseAssigned: Boolean(verified.assignedLicenses?.length) } }); }
        catch { throw new LicenseActionError('Microsoft confirmed the change, but the portal record could not update. Refresh assigned users to reconcile the result.', 502); }
    }
    // Do not invent a successful portal assignment while Microsoft is still processing.
    return { status: confirmed ? 'confirmed' : 'pending', message: confirmed
        ? (action === 'assign' ? 'License assignment confirmed by Microsoft 365.' : 'License removal confirmed by Microsoft 365.')
        : 'Microsoft accepted the request but the change is not visible yet. Refresh the assigned users to check its status.' };
}
