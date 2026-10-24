import type { Prisma } from '@prisma/client';

export function licenseProvider(license: { isM365?: boolean; skuId?: string | null; key?: string | null; name: string }) {
    if (license.key === 'ZOHO-PEOPLE-PLUS' || /zoho/i.test(license.name)) return 'zoho' as const;
    if (license.isM365 || license.skuId || /microsoft\s*365|office\s*365|exchange\s*online/i.test(license.name)) return 'm365' as const;
    return 'manual' as const;
}

export const manualLicenseFilter: Prisma.LicenseWhereInput = {
    isM365: false, skuId: null,
    NOT: [
        { name: { contains: 'zoho', mode: 'insensitive' } },
        { name: { contains: 'microsoft 365', mode: 'insensitive' } },
        { name: { contains: 'microsoft365', mode: 'insensitive' } },
        { name: { contains: 'office 365', mode: 'insensitive' } },
        { name: { contains: 'office365', mode: 'insensitive' } },
        { name: { contains: 'exchange online', mode: 'insensitive' } },
        { name: { contains: 'exchangeonline', mode: 'insensitive' } }
    ],
    OR: [{ key: null }, { key: { not: 'ZOHO-PEOPLE-PLUS' } }]
};

export const nonZohoLicenseFilter: Prisma.LicenseWhereInput = {
    NOT: [{ name: { contains: 'zoho', mode: 'insensitive' } }],
    OR: [{ key: null }, { key: { not: 'ZOHO-PEOPLE-PLUS' } }]
};
