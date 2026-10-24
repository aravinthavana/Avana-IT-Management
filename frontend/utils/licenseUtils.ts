import { License } from '../types';

export function licenseProvider(license: Pick<License, 'name' | 'key' | 'skuId' | 'isM365'>) {
    if (license.key === 'ZOHO-PEOPLE-PLUS' || /zoho/i.test(license.name)) return 'zoho' as const;
    if (license.isM365 || license.skuId || /microsoft\s*365|office\s*365|exchange\s*online/i.test(license.name)) return 'm365' as const;
    return 'manual' as const;
}

export interface LicenseMember {
    id: string;
    assignmentId?: number;
    userId?: number;
    azureAdId?: string;
    displayName: string;
    email?: string;
    employeeId?: string;
    department?: string;
    assignmentSource: string;
    removable: boolean;
    state?: string;
    note?: string;
}

export interface LicenseMembers {
    provider: 'm365' | 'zoho' | 'manual';
    mode: 'live' | 'recorded';
    fetchedAt?: string;
    note?: string;
    members: LicenseMember[];
    seats?: number;
    assignedSeats?: number;
    availableSeats?: number;
    eligibleUsers: { id: number; displayName: string; email: string; employeeId?: string; usageLocation?: string | null }[];
}
