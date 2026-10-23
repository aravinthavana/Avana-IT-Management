import axios from 'axios';
import { prisma } from '../db';

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
 * Compare Zoho People employees against Portal Users to detect changes.
 * NEVER overwrites users directly. Queues them in HrChangeNotification for review.
 */
export async function detectHrChanges(zohoEmployees: ZohoEmployeeRecord[]) {
    let createdNotifications = 0;

    for (const zEmp of zohoEmployees) {
        if (!zEmp.email) continue;

        const dbUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: { equals: zEmp.email, mode: 'insensitive' as const } },
                    ...(zEmp.employeeId ? [{ employeeId: { equals: zEmp.employeeId, mode: 'insensitive' as const } }] : [])
                ]
            },
            include: { department: true }
        });

        if (!dbUser) {
            // User does not exist in portal. We can optionally flag a "New Employee in Zoho" notification
            const existingNotif = await prisma.hrChangeNotification.findFirst({
                where: {
                    employeeEmail: zEmp.email,
                    fieldName: 'New User Detected',
                    status: 'Pending'
                }
            });

            if (!existingNotif) {
                await prisma.hrChangeNotification.create({
                    data: {
                        source: 'Zoho People Plus (AMD)',
                        employeeId: zEmp.employeeId || null,
                        employeeEmail: zEmp.email,
                        employeeName: zEmp.fullName || zEmp.email,
                        fieldName: 'New User Detected',
                        currentValue: 'Not in Portal',
                        zohoValue: `${zEmp.fullName} (${zEmp.designation || 'No Title'} - ${zEmp.department || 'No Dept'})`,
                        status: 'Pending'
                    }
                });
                createdNotifications++;
            }
            continue;
        }

        // Compare Department
        const currentDept = (dbUser as any).department?.name || '';
        if (zEmp.department && currentDept.toLowerCase() !== zEmp.department.toLowerCase()) {
            await queueChangeIfNotExists(
                zEmp.employeeId || dbUser.employeeId,
                dbUser.email,
                dbUser.name,
                'Department',
                currentDept || 'None',
                zEmp.department
            );
            createdNotifications++;
        }

        // Compare Job Title / Designation
        const currentTitle = dbUser.jobTitle || '';
        if (zEmp.designation && currentTitle.toLowerCase() !== zEmp.designation.toLowerCase()) {
            await queueChangeIfNotExists(
                zEmp.employeeId || dbUser.employeeId,
                dbUser.email,
                dbUser.name,
                'Job Title',
                currentTitle || 'None',
                zEmp.designation
            );
            createdNotifications++;
        }

        // Compare Mobile Number
        const currentMobile = (dbUser.mobile || '').replace(/\D/g, '');
        const zohoMobile = (zEmp.mobile || '').replace(/\D/g, '');
        if (zohoMobile && currentMobile !== zohoMobile && zohoMobile.length >= 8) {
            await queueChangeIfNotExists(
                zEmp.employeeId || dbUser.employeeId,
                dbUser.email,
                dbUser.name,
                'Mobile',
                dbUser.mobile || 'None',
                zEmp.mobile || ''
            );
            createdNotifications++;
        }

        // Compare Status (Active / Inactive / Terminated)
        const isZohoActive = !/resigned|terminated|inactive|relieved/i.test(zEmp.status || '');
        const currentStatus = dbUser.status;
        const targetStatus = isZohoActive ? 'Active' : 'Inactive';
        if (currentStatus !== targetStatus) {
            await queueChangeIfNotExists(
                zEmp.employeeId || dbUser.employeeId,
                dbUser.email,
                dbUser.name,
                'Status',
                currentStatus,
                targetStatus
            );
            createdNotifications++;
        }
    }

    return createdNotifications;
}

async function queueChangeIfNotExists(
    employeeId: string | null | undefined,
    email: string,
    name: string,
    fieldName: string,
    currentValue: string,
    zohoValue: string
) {
    const existing = await prisma.hrChangeNotification.findFirst({
        where: {
            employeeEmail: email,
            fieldName,
            status: 'Pending'
        }
    });

    if (!existing) {
        await prisma.hrChangeNotification.create({
            data: {
                source: 'Zoho People Plus (AMD)',
                employeeId: employeeId || null,
                employeeEmail: email,
                employeeName: name,
                fieldName,
                currentValue,
                zohoValue,
                status: 'Pending'
            }
        });
    } else if (existing.zohoValue !== zohoValue) {
        // Update pending notification if Zoho changed again
        await prisma.hrChangeNotification.update({
            where: { id: existing.id },
            data: {
                zohoValue,
                currentValue,
                createdAt: new Date()
            }
        });
    }
}

/**
 * Sync Zoho People Plus license count into the Licenses table
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
        // Keep seats or update if active count exceeds seats
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

    return {
        success: true,
        license,
        totalZohoEmployees: employees.length,
        activeZohoEmployees: activeCount,
        changesQueued
    };
}

/**
 * Apply a pending HR change to the User record
 */
export async function applyHrChange(notificationId: number, adminUserId?: number) {
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
        where: { email: { equals: notification.employeeEmail, mode: 'insensitive' } }
    });

    if (user && notification.zohoValue) {
        if (notification.fieldName === 'Job Title') {
            await prisma.user.update({
                where: { id: user.id },
                data: { jobTitle: notification.zohoValue }
            });
        } else if (notification.fieldName === 'Mobile') {
            await prisma.user.update({
                where: { id: user.id },
                data: { mobile: notification.zohoValue }
            });
        } else if (notification.fieldName === 'Status') {
            await prisma.user.update({
                where: { id: user.id },
                data: { status: notification.zohoValue }
            });
        } else if (notification.fieldName === 'Department') {
            // Find or create department
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
