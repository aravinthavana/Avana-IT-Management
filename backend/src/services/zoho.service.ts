import axios from 'axios';
import { prisma } from '../db';
import { updateM365User } from './m365.service';

interface ZohoTokenCache {
    accessToken: string;
    expiresAt: number;
}

let tokenCache: ZohoTokenCache | null = null;

/**
 * Obtain a valid access token using the stored refresh token from accounts.zoho.in
 */
export async function getZohoAccessToken(): Promise<string> {
    const now = Date.now();
    if (tokenCache && tokenCache.expiresAt > now + 60000) {
        return tokenCache.accessToken;
    }

    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in';

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Missing Zoho credentials (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN) in environment variables.');
    }

    const tokenEndpoint = `${accountsUrl}/oauth/v2/token`;
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const res = await axios.post(tokenEndpoint, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (res.data.error) {
        throw new Error(`Zoho token refresh failed: ${res.data.error}`);
    }

    const accessToken = res.data.access_token;
    const expiresInSec = res.data.expires_in || 3600;

    tokenCache = {
        accessToken,
        expiresAt: now + expiresInSec * 1000
    };

    return accessToken;
}

export interface ZohoEmployeeRecord {
    recordId?: string;
    employeeId?: string;
    email: string;
    fullName: string;
    department?: string;
    designation?: string;
    mobile?: string;
    status?: string;
    raw: Record<string, any>;
}

/**
 * Fetch employee records from Zoho People
 */
export async function fetchZohoEmployees(): Promise<ZohoEmployeeRecord[]> {
    const accessToken = await getZohoAccessToken();
    const apiUrl = process.env.ZOHO_API_URL || 'https://people.zoho.in/people/api';

    // Try standard Employee View records endpoint
    const endpoint = `${apiUrl}/forms/P_EmployeeView/records`;

    let rawRecords: any[] = [];
    try {
        const response = await axios.get(endpoint, {
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`
            },
            params: {
                sIndex: 1,
                limit: 200
            }
        });

        if (Array.isArray(response.data)) {
            rawRecords = response.data;
        } else if (response.data?.response?.result) {
            rawRecords = Array.isArray(response.data.response.result)
                ? response.data.response.result
                : [response.data.response.result];
        } else if (response.data?.result) {
            rawRecords = Array.isArray(response.data.result)
                ? response.data.result
                : [response.data.result];
        } else {
            console.warn('Zoho returned unexpected data shape:', response.data);
        }
    } catch (err: any) {
        const errData = err.response?.data;
        if (errData?.errors?.code === 7077 || errData?.code === 7077) {
            throw new Error(
                'Zoho People Error 7077: "Sorry! Your role is not allowed to access APIs." ' +
                'Please enable "API Access" in Zoho People Settings -> Manage Accounts / Users and Control -> User Access Control -> Function Based Permissions.'
            );
        }
        throw new Error(`Failed to fetch from Zoho People: ${errData?.message || err.message}`);
    }

    return rawRecords.map(item => {
        // Zoho People returns fields as either keys or sub-objects
        const email = (item['Email address'] || item['EmailID'] || item['Email'] || item['Email_ID'] || item['mail'] || '').trim().toLowerCase();
        const firstName = item['First Name'] || item['FirstName'] || '';
        const lastName = item['Last Name'] || item['LastName'] || '';
        const fullName = (item['ownerName'] || item['Employee_Name'] || item['Employee Name'] || `${firstName} ${lastName}`).trim();
        const employeeId = (item['Employee ID'] || item['EmployeeID'] || item['Emp_Id'] || item['Zoho_ID'] || '').toString().trim();
        const department = (item['Department'] || item['Department_Name'] || '').toString().trim();
        const designation = (item['Designation'] || item['Job_Title'] || item['Job Title'] || '').toString().trim();
        const mobile = (item['Work Phone Number'] || item['Mobile'] || item['Mobile_Number'] || item['Phone'] || '').toString().trim();
        const status = (item['Employee_Status'] || item['Employment_Status'] || item['Employment Type'] || item['Status'] || 'Active').toString().trim();

        return {
            recordId: item.recordId,
            employeeId,
            email,
            fullName,
            department,
            designation,
            mobile,
            status,
            raw: item
        };
    }).filter(r => Boolean(r.email));
}

/**
 * Normalizes string for fair comparison:
 * - Converts Unicode en-dashes (\u2013) & em-dashes (\u2014) to standard hyphen (-)
 * - Converts non-breaking spaces (\u00A0) to regular spaces
 * - Replaces multiple whitespace with a single space
 * - Trims leading and trailing whitespace
 * - Converts to lower case
 */
export function normalizeString(val?: string | null): string {
    if (!val) return '';
    return val
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Normalizes phone numbers for fair comparison:
 * Extracts digits and compares the last 10 digits (ignoring country codes +91, 91, 0, spaces, dashes)
 */
export function normalizePhone(val?: string | null): string {
    if (!val) return '';
    const digits = val.replace(/\D/g, '');
    if (digits.length >= 10) {
        return digits.slice(-10);
    }
    return digits;
}

/**
 * Normalizes employee IDs:
 * Strips hyphens, underscores, and spaces, and converts to lowercase
 * e.g., "AMD-177" -> "amd177", "AMD_177" -> "amd177"
 */
export function normalizeEmpId(id?: string | null): string {
    if (!id) return '';
    return id.replace(/[-_\s]/g, '').trim().toLowerCase();
}

/**
 * Purge or correct pending notifications that are false positives:
 * 1. "New User Detected" for users who actually exist in portal (by email, alias, or normalized employeeId).
 * 2. "Job Title" where current and Zoho values match after normalization (ignoring unicode dashes, whitespace).
 * 3. "Mobile" where current and Zoho values match after 10-digit normalization (+91).
 * 4. "Department" where current and Zoho values match after normalization.
 * 5. Update m365Value if it was null and is now available in m365Data.
 */
export async function purgeFalsePositiveNotifications() {
    const pendingNotifs = await prisma.hrChangeNotification.findMany({
        where: { status: 'Pending' }
    });
    if (pendingNotifs.length === 0) return 0;

    const allUsers = await prisma.user.findMany({
        include: { department: true }
    });

    const emailMap = new Map<string, any>();
    const empIdMap = new Map<string, any>();
    const aliasMap = new Map<string, any>();

    for (const u of allUsers) {
        if (u.email) emailMap.set(u.email.toLowerCase(), u);
        if (u.employeeId) {
            empIdMap.set(u.employeeId.toLowerCase(), u);
            const norm = normalizeEmpId(u.employeeId);
            if (norm) empIdMap.set(norm, u);
        }
        if (u.zohoEmployeeId) {
            empIdMap.set(u.zohoEmployeeId.toLowerCase(), u);
            const norm = normalizeEmpId(u.zohoEmployeeId);
            if (norm) empIdMap.set(norm, u);
        }
        if (u.emailAliases) {
            try {
                const al = JSON.parse(u.emailAliases);
                if (Array.isArray(al)) {
                    for (const a of al) {
                        if (typeof a === 'string') aliasMap.set(a.trim().toLowerCase(), u);
                    }
                }
            } catch (e) {}
        }
    }

    const idsToDelete: number[] = [];
    const updates: { id: number; data: any }[] = [];

    for (const n of pendingNotifs) {
        const nEmail = n.employeeEmail.toLowerCase();
        const normEmpId = normalizeEmpId(n.employeeId);
        const user = emailMap.get(nEmail) 
            || (normEmpId ? empIdMap.get(normEmpId) : null)
            || aliasMap.get(nEmail);

        if (n.fieldName === 'New User Detected') {
            if (user) {
                // User exists in the portal! Delete this false positive notification
                idsToDelete.push(n.id);
            }
            continue;
        }

        // For field changes:
        if (n.fieldName === 'Job Title') {
            if (normalizeString(n.currentValue) === normalizeString(n.zohoValue)) {
                idsToDelete.push(n.id);
                continue;
            }
        } else if (n.fieldName === 'Mobile') {
            if (normalizePhone(n.currentValue) === normalizePhone(n.zohoValue)) {
                idsToDelete.push(n.id);
                continue;
            }
        } else if (n.fieldName === 'Department') {
            if (normalizeString(n.currentValue) === normalizeString(n.zohoValue)) {
                idsToDelete.push(n.id);
                continue;
            }
        } else if (n.fieldName === 'Status') {
            if (normalizeString(n.currentValue) === normalizeString(n.zohoValue)) {
                idsToDelete.push(n.id);
                continue;
            }
        }

        // If notification is genuine, check if m365Value needs backfilling
        if (user && user.m365Data && (!n.m365Value || n.m365Value === 'null')) {
            try {
                const m365 = JSON.parse(user.m365Data);
                let mVal: string | null = null;
                if (n.fieldName === 'Job Title') mVal = m365.jobTitle || null;
                else if (n.fieldName === 'Department') mVal = m365.department || null;
                else if (n.fieldName === 'Mobile') mVal = m365.mobile || null;
                else if (n.fieldName === 'Status') mVal = m365.status || null;

                if (mVal) {
                    updates.push({
                        id: n.id,
                        data: {
                            m365Value: mVal,
                            aliases: user.emailAliases || n.aliases
                        }
                    });
                }
            } catch (e) {}
        }
    }

    if (idsToDelete.length > 0) {
        await prisma.hrChangeNotification.deleteMany({
            where: { id: { in: idsToDelete } }
        });
    }

    for (const u of updates) {
        await prisma.hrChangeNotification.update({
            where: { id: u.id },
            data: u.data
        });
    }

    return idsToDelete.length;
}

/**
 * Compare Zoho People employees against Portal Users to detect changes.
 * Compares Portal DB vs M365 vs Zoho People (3-Way Comparison).
 * In-memory batch indexing for high speed.
 */
export async function detectHrChanges(zohoEmployees: ZohoEmployeeRecord[]) {
    // 0. Purge any stale false-positive notifications first
    await purgeFalsePositiveNotifications();

    // 1. Fetch all portal users and pending notifications in batch
    const allUsers = await prisma.user.findMany({ include: { department: true } });
    const pendingNotifs = await prisma.hrChangeNotification.findMany({ where: { status: 'Pending' } });

    // 2. Build fast in-memory lookup indexes
    const emailMap = new Map<string, any>();
    const empIdMap = new Map<string, any>();
    const aliasMap = new Map<string, any>();
    const pendingMap = new Map<string, any>();

    for (const u of allUsers) {
        if (u.email) emailMap.set(u.email.toLowerCase(), u);
        if (u.employeeId) {
            empIdMap.set(u.employeeId.toLowerCase(), u);
            const norm = normalizeEmpId(u.employeeId);
            if (norm) empIdMap.set(norm, u);
        }
        if (u.zohoEmployeeId) {
            empIdMap.set(u.zohoEmployeeId.toLowerCase(), u);
            const norm = normalizeEmpId(u.zohoEmployeeId);
            if (norm) empIdMap.set(norm, u);
        }
        if (u.emailAliases) {
            try {
                const al = JSON.parse(u.emailAliases);
                if (Array.isArray(al)) {
                    for (const a of al) {
                        if (typeof a === 'string') aliasMap.set(a.trim().toLowerCase(), u);
                    }
                }
            } catch (e) {}
        }
    }

    for (const n of pendingNotifs) {
        pendingMap.set(`${n.employeeEmail.toLowerCase()}_${n.fieldName.toLowerCase()}`, n);
    }

    let createdNotifications = 0;
    const notifsToCreate: any[] = [];
    const notifsToUpdate: { id: number; data: any }[] = [];

    for (const zEmp of zohoEmployees) {
        if (!zEmp.email) continue;
        const zEmail = zEmp.email.toLowerCase();
        const normZEmpId = normalizeEmpId(zEmp.employeeId);

        // Match user by email, employeeId, or alias
        const dbUser = emailMap.get(zEmail) 
            || (normZEmpId ? empIdMap.get(normZEmpId) : null)
            || (zEmp.employeeId ? empIdMap.get(zEmp.employeeId.toLowerCase()) : null)
            || aliasMap.get(zEmail);

        if (!dbUser) {
            const notifKey = `${zEmail}_new user detected`;
            if (!pendingMap.has(notifKey)) {
                notifsToCreate.push({
                    source: 'Zoho People Plus (AMD)',
                    employeeId: zEmp.employeeId || null,
                    employeeEmail: zEmp.email,
                    employeeName: zEmp.fullName || zEmp.email,
                    fieldName: 'New User Detected',
                    currentValue: 'Not in Portal',
                    m365Value: null,
                    zohoValue: `${zEmp.fullName} (${zEmp.designation || 'No Title'} - ${zEmp.department || 'No Dept'})`,
                    aliases: null,
                    status: 'Pending'
                });
                createdNotifications++;
            }
            continue;
        }

        // Enrich user with Zoho info if changed/missing
        const zohoSnapshot = JSON.stringify({
            designation: zEmp.designation || null,
            department: zEmp.department || null,
            mobile: zEmp.mobile || null,
            status: zEmp.status || null
        });
        if (dbUser.zohoEmployeeId !== zEmp.employeeId || dbUser.zohoData !== zohoSnapshot) {
            await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                    zohoEmployeeId: zEmp.employeeId || dbUser.zohoEmployeeId,
                    zohoData: zohoSnapshot
                }
            }).catch(() => {});
        }

        // Parse cached M365 snapshot if present
        let m365: Record<string, any> = {};
        if (dbUser.m365Data) {
            try { m365 = JSON.parse(dbUser.m365Data); } catch (e) {}
        }

        const checkDiff = (fieldName: string, currentVal: string, m365Val: string | null, zohoVal: string) => {
            const notifKey = `${dbUser.email.toLowerCase()}_${fieldName.toLowerCase()}`;
            const existing = pendingMap.get(notifKey);
            if (!existing) {
                notifsToCreate.push({
                    source: 'Zoho People Plus (AMD)',
                    employeeId: zEmp.employeeId || dbUser.employeeId,
                    employeeEmail: dbUser.email,
                    employeeName: dbUser.name,
                    fieldName,
                    currentValue: currentVal,
                    m365Value: m365Val,
                    zohoValue: zohoVal,
                    aliases: dbUser.emailAliases || null,
                    status: 'Pending'
                });
                createdNotifications++;
            } else if (existing.zohoValue !== zohoVal || existing.m365Value !== m365Val) {
                notifsToUpdate.push({
                    id: existing.id,
                    data: {
                        zohoValue: zohoVal,
                        m365Value: m365Val || existing.m365Value,
                        currentValue: currentVal,
                        aliases: dbUser.emailAliases || existing.aliases,
                        createdAt: new Date()
                    }
                });
            }
        };

        // 1. Department
        const currentDept = dbUser.department?.name || '';
        const normCurrentDept = normalizeString(currentDept);
        const normZohoDept = normalizeString(zEmp.department);
        if (normZohoDept && normCurrentDept !== normZohoDept) {
            checkDiff('Department', currentDept || 'None', m365.department || null, zEmp.department!);
        }

        // 2. Job Title
        const currentTitle = dbUser.jobTitle || '';
        const normCurrentTitle = normalizeString(currentTitle);
        const normZohoTitle = normalizeString(zEmp.designation);
        if (normZohoTitle && normCurrentTitle !== normZohoTitle) {
            checkDiff('Job Title', currentTitle || 'None', m365.jobTitle || null, zEmp.designation!);
        }

        // 3. Mobile
        const normCurrentMobile = normalizePhone(dbUser.mobile);
        const normZohoMobile = normalizePhone(zEmp.mobile);
        if (normZohoMobile && normZohoMobile.length >= 10 && normCurrentMobile !== normZohoMobile) {
            checkDiff('Mobile', dbUser.mobile || 'None', m365.mobile || null, zEmp.mobile || '');
        }

        // 4. Status
        const isZohoActive = !/resigned|terminated|inactive|relieved/i.test(zEmp.status || '');
        const targetStatus = isZohoActive ? 'Active' : 'Inactive';
        if (normalizeString(dbUser.status) !== normalizeString(targetStatus)) {
            checkDiff('Status', dbUser.status || 'None', m365.status || null, targetStatus);
        }
    }

    // Batch execute writes
    if (notifsToCreate.length > 0) {
        await prisma.hrChangeNotification.createMany({ data: notifsToCreate });
    }
    for (const u of notifsToUpdate) {
        await prisma.hrChangeNotification.update({ where: { id: u.id }, data: u.data });
    }

    return createdNotifications;
}

/**
 * Sync Zoho People Plus license count AND auto-map matching employees to LicenseAssignment
 */
export async function syncZohoLicensePool() {
    const employees = await fetchZohoEmployees();
    const activeEmployees = employees.filter(e => !/resigned|terminated|inactive|relieved/i.test(e.status || ''));
    const activeCount = activeEmployees.length;

    // Detect field changes as well
    const changesQueued = await detectHrChanges(employees);

    // Find or create License record
    const licenseName = 'Zoho People Plus (AMD & Tech)';
    let license = await prisma.license.findFirst({
        where: { name: licenseName }
    });

    if (!license) {
        license = await prisma.license.create({
            data: {
                name: licenseName,
                category: 'HRMS & Operations',
                seats: Math.max(activeCount, 1),
                status: 'Active',
                key: 'ZOHO-PEOPLE-PLUS',
                remarks: `Synced from Zoho People Plus. Active users: ${activeCount}`
            }
        });
    } else {
        const updatedSeats = Math.max(license.seats, activeCount);
        license = await prisma.license.update({
            where: { id: license.id },
            data: {
                seats: updatedSeats,
                status: 'Active',
                remarks: `Synced from Zoho People Plus. Active users: ${activeCount}. (Last updated: ${new Date().toLocaleDateString()})`
            }
        });
    }

    // Batch map assignments to portal users
    const allUsers = await prisma.user.findMany({ select: { id: true, email: true, employeeId: true, zohoEmployeeId: true, emailAliases: true } });
    const emailMap = new Map<string, any>();
    const empIdMap = new Map<string, any>();
    const aliasMap = new Map<string, any>();

    for (const u of allUsers) {
        if (u.email) emailMap.set(u.email.toLowerCase(), u);
        if (u.employeeId) {
            empIdMap.set(u.employeeId.toLowerCase(), u);
            const norm = normalizeEmpId(u.employeeId);
            if (norm) empIdMap.set(norm, u);
        }
        if (u.zohoEmployeeId) {
            empIdMap.set(u.zohoEmployeeId.toLowerCase(), u);
            const norm = normalizeEmpId(u.zohoEmployeeId);
            if (norm) empIdMap.set(norm, u);
        }
        if (u.emailAliases) {
            try {
                const al = JSON.parse(u.emailAliases);
                if (Array.isArray(al)) {
                    for (const a of al) {
                        if (typeof a === 'string') aliasMap.set(a.trim().toLowerCase(), u);
                    }
                }
            } catch (e) {}
        }
    }

    const existingAssignments = await prisma.licenseAssignment.findMany({
        where: { licenseId: license.id },
        select: { userId: true }
    });
    const assignedUserIds = new Set(existingAssignments.map(a => a.userId).filter(Boolean));

    const newAssignments: { licenseId: number; userId: number }[] = [];
    let assignedCount = assignedUserIds.size;

    for (const zEmp of activeEmployees) {
        if (!zEmp.email) continue;
        const zEmail = zEmp.email.toLowerCase();
        const normZEmpId = normalizeEmpId(zEmp.employeeId);
        const dbUser = emailMap.get(zEmail) 
            || (normZEmpId ? empIdMap.get(normZEmpId) : null)
            || (zEmp.employeeId ? empIdMap.get(zEmp.employeeId.toLowerCase()) : null)
            || aliasMap.get(zEmail);

        if (dbUser && !assignedUserIds.has(dbUser.id)) {
            newAssignments.push({
                licenseId: license.id,
                userId: dbUser.id
            });
            assignedUserIds.add(dbUser.id);
            assignedCount++;
        }
    }

    if (newAssignments.length > 0) {
        await prisma.licenseAssignment.createMany({ data: newAssignments });
    }

    return {
        success: true,
        license,
        totalZohoEmployees: employees.length,
        activeZohoEmployees: activeCount,
        assignedToPortalUsers: assignedCount,
        changesQueued
    };
}

/**
 * Apply a pending HR change to the User record and optionally push to M365
 */
export async function applyHrChange(notificationId: number, adminUserId?: number, pushToM365: boolean = false) {
    const notification = await prisma.hrChangeNotification.findUnique({
        where: { id: notificationId }
    });

    if (!notification) {
        throw new Error('Notification not found');
    }

    if (notification.status !== 'Pending') {
        throw new Error(`Notification is already ${notification.status}`);
    }

    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: { equals: notification.employeeEmail, mode: 'insensitive' } },
                { emailAliases: { contains: notification.employeeEmail } }
            ]
        }
    });

    if (user && notification.zohoValue) {
        if (notification.fieldName === 'Job Title') {
            await prisma.user.update({
                where: { id: user.id },
                data: { jobTitle: notification.zohoValue }
            });
            if (pushToM365 && user.azureAdId) {
                try { await updateM365User(user.azureAdId, { jobTitle: notification.zohoValue }); } catch (e) {}
            }
        } else if (notification.fieldName === 'Mobile') {
            await prisma.user.update({
                where: { id: user.id },
                data: { mobile: notification.zohoValue }
            });
            if (pushToM365 && user.azureAdId) {
                try { await updateM365User(user.azureAdId, { mobilePhone: notification.zohoValue }); } catch (e) {}
            }
        } else if (notification.fieldName === 'Status') {
            await prisma.user.update({
                where: { id: user.id },
                data: { status: notification.zohoValue }
            });
            if (pushToM365 && user.azureAdId) {
                try { await updateM365User(user.azureAdId, { accountEnabled: notification.zohoValue === 'Active' }); } catch (e) {}
            }
        } else if (notification.fieldName === 'Department') {
            let dept = await prisma.department.findFirst({
                where: { name: { equals: notification.zohoValue, mode: 'insensitive' } }
            });
            if (!dept) {
                dept = await prisma.department.create({
                    data: { name: notification.zohoValue }
                });
            }
            await prisma.user.update({
                where: { id: user.id },
                data: { departmentId: dept.id }
            });
            if (pushToM365 && user.azureAdId) {
                try { await updateM365User(user.azureAdId, { department: notification.zohoValue }); } catch (e) {}
            }
        }
    }

    const updated = await prisma.hrChangeNotification.update({
        where: { id: notificationId },
        data: {
            status: 'Applied',
            resolvedAt: new Date(),
            resolvedBy: adminUserId || null
        }
    });

    return updated;
}

/**
 * Dismiss a pending HR change without modifying the User record
 */
export async function dismissHrChange(notificationId: number, adminUserId?: number) {
    const updated = await prisma.hrChangeNotification.update({
        where: { id: notificationId },
        data: {
            status: 'Dismissed',
            resolvedAt: new Date(),
            resolvedBy: adminUserId || null
        }
    });

    return updated;
}
