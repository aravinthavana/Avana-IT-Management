import axios from 'axios';
import { prisma } from '../db';
import { getGraphAppToken } from '../utils/email';

const SKU_FRIENDLY_NAMES: Record<string, string> = {
    'O365_BUSINESS_PREMIUM': 'Microsoft 365 Business Premium',
    'O365_BUSINESS_ESSENTIALS': 'Microsoft 365 Business Basic',
    'SPB': 'Microsoft 365 Business Standard',
    'EXCHANGEENTERPRISE': 'Exchange Online (Plan 2)',
    'EXCHANGESTANDARD': 'Exchange Online (Plan 1)',
    'POWER_BI_PRO': 'Power BI Pro',
    'POWER_BI_STANDARD': 'Power BI (Free)',
    'FLOW_FREE': 'Microsoft Power Automate Free',
    'POWERAPPS_DEV': 'Power Apps Developer Plan',
    'CCIBOTS_PRIVPREV_VIRAL': 'Microsoft Copilot Studio Viral',
    'VISIOCLIENT': 'Visio Plan 2',
    'PROJECTPREMIUM': 'Project Plan 5',
    'M365_ENTERPRISE_E3': 'Microsoft 365 E3',
    'M365_ENTERPRISE_E5': 'Microsoft 365 E5',
};

export interface M365UserDTO {
    id: string;
    displayName: string;
    mail?: string | null;
    userPrincipalName: string;
    jobTitle?: string | null;
    department?: string | null;
    mobilePhone?: string | null;
    officeLocation?: string | null;
    accountEnabled?: boolean;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postalCode?: string | null;
    streetAddress?: string | null;
    assignedLicenses?: Array<{ skuId: string }>;
    proxyAddresses?: string[];
    otherMails?: string[];
}

export interface M365SubscribedSkuDTO {
    skuId: string;
    skuPartNumber: string;
    consumedUnits: number;
    prepaidUnits?: {
        enabled: number;
        suspended?: number;
        warning?: number;
    };
}

export interface SyncResult {
    success: boolean;
    timestamp: string;
    usersTotalInM365: number;
    usersCreated: number;
    usersUpdated: number;
    licensesSynced: number;
    error?: string;
}

/**
 * Fetch all users from Microsoft Graph API, handling pagination seamlessly
 */
export async function fetchAllM365Users(accessToken: string): Promise<M365UserDTO[]> {
    const allUsers: M365UserDTO[] = [];
    let nextUrl: string | null = 'https://graph.microsoft.com/v1.0/users?$top=999&$select=id,displayName,mail,userPrincipalName,jobTitle,department,mobilePhone,officeLocation,accountEnabled,city,state,country,postalCode,streetAddress,assignedLicenses,proxyAddresses,otherMails';

    while (nextUrl) {
        const response: any = await axios.get(nextUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 25000
        });

        const data = response.data;
        if (data.value && Array.isArray(data.value)) {
            allUsers.push(...data.value);
        }
        nextUrl = data['@odata.nextLink'] || null;
    }

    return allUsers;
}

/**
 * Fetch all tenant subscribed SKUs (licenses)
 */
export async function fetchM365SubscribedSkus(accessToken: string): Promise<M365SubscribedSkuDTO[]> {
    const response: any = await axios.get('https://graph.microsoft.com/v1.0/subscribedSkus', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 20000
    });
    return response.data?.value || [];
}

/**
 * Push an updated user profile back to Microsoft Graph
 */
export async function updateM365User(
    azureAdIdOrEmail: string,
    updates: {
        displayName?: string;
        jobTitle?: string;
        department?: string;
        mobilePhone?: string;
        officeLocation?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
        accountEnabled?: boolean;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const auth = await getGraphAppToken();
        if (!auth.token) {
            return { success: false, error: auth.error || 'Failed to get Graph access token' };
        }

        const payload: Record<string, any> = {};
        if (updates.displayName !== undefined) payload.displayName = updates.displayName;
        if (updates.jobTitle !== undefined) payload.jobTitle = updates.jobTitle;
        if (updates.department !== undefined) payload.department = updates.department;
        if (updates.mobilePhone !== undefined) payload.mobilePhone = updates.mobilePhone;
        if (updates.officeLocation !== undefined) payload.officeLocation = updates.officeLocation;
        if (updates.city !== undefined) payload.city = updates.city;
        if (updates.state !== undefined) payload.state = updates.state;
        if (updates.country !== undefined) payload.country = updates.country;
        if (updates.postalCode !== undefined) payload.postalCode = updates.postalCode;
        if (updates.accountEnabled !== undefined) payload.accountEnabled = updates.accountEnabled;

        if (Object.keys(payload).length === 0) {
            return { success: true };
        }

        const encodedTarget = encodeURIComponent(azureAdIdOrEmail);
        await axios.patch(`https://graph.microsoft.com/v1.0/users/${encodedTarget}`, payload, {
            headers: {
                Authorization: `Bearer ${auth.token}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        return { success: true };
    } catch (error: any) {
        console.error('[M365 Push Error]:', error.response?.data || error.message);
        return { success: false, error: error.response?.data?.error?.message || error.message };
    }
}

/**
 * Revoke all assigned Microsoft 365 licenses from a user via Microsoft Graph API
 */
export async function revokeM365Licenses(
    azureAdIdOrEmail: string
): Promise<{ success: boolean; removedCount: number; error?: string }> {
    try {
        const auth = await getGraphAppToken();
        if (!auth.token) {
            return { success: false, removedCount: 0, error: auth.error || 'Failed to get Graph access token' };
        }

        const encodedTarget = encodeURIComponent(azureAdIdOrEmail);
        // 1. Fetch user's currently assigned licenses
        const userRes = await axios.get(`https://graph.microsoft.com/v1.0/users/${encodedTarget}?$select=assignedLicenses`, {
            headers: { Authorization: `Bearer ${auth.token}` },
            timeout: 15000
        });

        const assignedLicenses: Array<{ skuId: string }> = userRes.data?.assignedLicenses || [];
        if (assignedLicenses.length === 0) {
            return { success: true, removedCount: 0 };
        }

        const skuIdsToRemove = assignedLicenses.map(l => l.skuId);
        // 2. Remove all assigned licenses via assignLicenses endpoint
        await axios.post(
            `https://graph.microsoft.com/v1.0/users/${encodedTarget}/assignLicenses`,
            {
                addLicenses: [],
                removeLicenses: skuIdsToRemove
            },
            {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        return { success: true, removedCount: skuIdsToRemove.length };
    } catch (error: any) {
        console.error('[M365 License Revoke Error]:', error.response?.data || error.message);
        return { success: false, removedCount: 0, error: error.response?.data?.error?.message || error.message };
    }
}

/**
 * Full synchronization from M365 into PostgreSQL
 */
export async function syncFromM365(): Promise<SyncResult> {
    const auth = await getGraphAppToken();
    if (!auth.token) {
        return {
            success: false,
            timestamp: new Date().toISOString(),
            usersTotalInM365: 0,
            usersCreated: 0,
            usersUpdated: 0,
            licensesSynced: 0,
            error: auth.error || 'Unable to connect to Microsoft Graph API'
        };
    }

    try {
        console.log('[M365 Sync] Starting inbound sync...');

        // 1. Synchronize Licenses / Subscribed SKUs
        const skus = await fetchM365SubscribedSkus(auth.token);
        const skuLicenseMap = new Map<string, number>(); // skuId -> License.id
        let licensesSynced = 0;

        for (const sku of skus) {
            const rawPart = sku.skuPartNumber || '';
            const friendlyName = SKU_FRIENDLY_NAMES[rawPart] || rawPart.replace(/_/g, ' ');
            const totalSeats = sku.prepaidUnits?.enabled || 1;
            const consumed = sku.consumedUnits || 0;

            const license = await prisma.license.upsert({
                where: { skuId: sku.skuId },
                update: {
                    name: friendlyName,
                    category: 'Cloud / SaaS',
                    seats: totalSeats,
                    status: 'Active',
                    remarks: `Auto-synced from M365 (${consumed}/${totalSeats} assigned seats)`,
                    isM365: true,
                },
                create: {
                    skuId: sku.skuId,
                    name: friendlyName,
                    category: 'Cloud / SaaS',
                    seats: totalSeats,
                    status: 'Active',
                    remarks: `Auto-synced from M365 (${consumed}/${totalSeats} assigned seats)`,
                    isM365: true,
                }
            });

            skuLicenseMap.set(sku.skuId, license.id);
            licensesSynced++;
        }
        console.log(`[M365 Sync] Synced ${licensesSynced} M365 license pool(s).`);

        // 2. Fetch all Users
        const m365Users = await fetchAllM365Users(auth.token);
        console.log(`[M365 Sync] Found ${m365Users.length} total user accounts in M365.`);

        let usersCreated = 0;
        let usersUpdated = 0;
        const now = new Date();

        for (const mUser of m365Users) {
            // Ignore external guest accounts
            if (mUser.userPrincipalName?.includes('#EXT#')) {
                continue;
            }

            const email = (mUser.mail || mUser.userPrincipalName || '').trim().toLowerCase();
            if (!email) continue;

            // Resolve or create Department
            let departmentId: number | null = null;
            if (mUser.department && mUser.department.trim()) {
                const deptName = mUser.department.trim();
                const existingDept = await prisma.department.findUnique({ where: { name: deptName } });
                if (existingDept) {
                    departmentId = existingDept.id;
                } else {
                    const newDept = await prisma.department.create({ data: { name: deptName } });
                    departmentId = newDept.id;
                }
            }

            // Resolve or create Branch (Office Location)
            let branchId: number | null = null;
            if (mUser.officeLocation && mUser.officeLocation.trim()) {
                const branchName = mUser.officeLocation.trim();
                const existingBranch = await prisma.branch.findFirst({ where: { name: branchName } });
                if (existingBranch) {
                    branchId = existingBranch.id;
                } else {
                    const newBranch = await prisma.branch.create({
                        data: {
                            name: branchName,
                            location: mUser.city || branchName
                        }
                    });
                    branchId = newBranch.id;
                }
            }

            const displayName = mUser.displayName?.trim() || email.split('@')[0];
            const hasLicense = (mUser.assignedLicenses && mUser.assignedLicenses.length > 0);
            const userStatus = mUser.accountEnabled === false ? 'Inactive' : 'Active';

            // Collect aliases from proxyAddresses and otherMails
            const aliases: string[] = [];
            if (Array.isArray(mUser.proxyAddresses)) {
                for (const pa of mUser.proxyAddresses) {
                    const cleaned = pa.replace(/^smtp:/i, '').trim().toLowerCase();
                    if (cleaned && cleaned !== email && !aliases.includes(cleaned)) {
                        aliases.push(cleaned);
                    }
                }
            }
            if (Array.isArray(mUser.otherMails)) {
                for (const om of mUser.otherMails) {
                    const cleaned = om.trim().toLowerCase();
                    if (cleaned && cleaned !== email && !aliases.includes(cleaned)) {
                        aliases.push(cleaned);
                    }
                }
            }

            const m365DataJson = JSON.stringify({
                jobTitle: mUser.jobTitle || null,
                department: mUser.department || null,
                mobile: mUser.mobilePhone || null,
                location: mUser.officeLocation || null,
                status: userStatus
            });

            // Find existing user by azureAdId OR email OR alias
            let dbUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { azureAdId: mUser.id },
                        { email: email },
                        { emailAliases: { contains: email } }
                    ]
                }
            });

            // Merge any existing aliases with new aliases
            let mergedAliases = [...aliases];
            if (dbUser?.emailAliases) {
                try {
                    const existing = JSON.parse(dbUser.emailAliases);
                    if (Array.isArray(existing)) {
                        for (const a of existing) {
                            if (!mergedAliases.includes(a) && a !== dbUser.email) {
                                mergedAliases.push(a);
                            }
                        }
                    }
                } catch (e) {}
            }
            const finalAliasesStr = mergedAliases.length > 0 ? JSON.stringify(mergedAliases) : null;

            if (dbUser) {
                // Update integration snapshot & cloud identity fields (do NOT overwrite IT-managed portal profile fields)
                await prisma.user.update({
                    where: { id: dbUser.id },
                    data: {
                        azureAdId: mUser.id,
                        emailAliases: finalAliasesStr,
                        m365Data: m365DataJson,
                        m365AccountCreated: true,
                        m365LicenseAssigned: hasLicense,
                        lastM365Sync: now,
                        // Fill in blank fields only if never configured in portal
                        jobTitle: dbUser.jobTitle || mUser.jobTitle || null,
                        mobile: dbUser.mobile || mUser.mobilePhone || null,
                        departmentId: dbUser.departmentId || departmentId || null,
                        branchId: dbUser.branchId || branchId || null,
                        location: dbUser.location || mUser.officeLocation || null
                    }
                });
                usersUpdated++;
            } else {
                // Create new user in portal
                dbUser = await prisma.user.create({
                    data: {
                        name: displayName,
                        email: email,
                        azureAdId: mUser.id,
                        role: 'User',
                        status: userStatus,
                        jobTitle: mUser.jobTitle || null,
                        mobile: mUser.mobilePhone || null,
                        departmentId: departmentId,
                        branchId: branchId,
                        location: mUser.officeLocation || null,
                        city: mUser.city || null,
                        state: mUser.state || null,
                        country: mUser.country || 'India',
                        postalCode: mUser.postalCode || null,
                        workAddress: mUser.streetAddress || null,
                        emailAliases: finalAliasesStr,
                        m365Data: m365DataJson,
                        m365AccountCreated: true,
                        m365LicenseAssigned: hasLicense,
                        onboardingStatus: 'Completed',
                        onboardingStep: 8,
                        lastM365Sync: now
                    }
                });
                usersCreated++;
            }

            // Sync User's Assigned Licenses
            if (mUser.assignedLicenses && dbUser) {
                for (const lic of mUser.assignedLicenses) {
                    const licenseId = skuLicenseMap.get(lic.skuId);
                    if (licenseId) {
                        const existingAssignment = await prisma.licenseAssignment.findFirst({
                            where: {
                                licenseId: licenseId,
                                userId: dbUser.id
                            }
                        });
                        if (!existingAssignment) {
                            await prisma.licenseAssignment.create({
                                data: {
                                    licenseId: licenseId,
                                    userId: dbUser.id
                                }
                            });
                        }
                    }
                }
            }
        }

        console.log(`[M365 Sync Complete] Created: ${usersCreated}, Updated: ${usersUpdated}, Licenses: ${licensesSynced}`);
        return {
            success: true,
            timestamp: now.toISOString(),
            usersTotalInM365: m365Users.length,
            usersCreated,
            usersUpdated,
            licensesSynced
        };
    } catch (err: any) {
        console.error('[M365 Sync Error]:', err.response?.data || err.message);
        return {
            success: false,
            timestamp: new Date().toISOString(),
            usersTotalInM365: 0,
            usersCreated: 0,
            usersUpdated: 0,
            licensesSynced: 0,
            error: err.response?.data?.error?.message || err.message
        };
    }
}
