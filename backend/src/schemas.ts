import { z } from 'zod';

export const userSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().nullable().optional(),
    role: z.enum(['Admin', 'Manager', 'User']).default('User'),
    status: z.enum(['Active', 'Inactive']).default('Active'),
    departmentId: z.any().transform(val => (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) ? Number(val) : null).nullable().optional(),
    branchId: z.any().transform(val => (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) ? Number(val) : null).nullable().optional(),
    managerId: z.any().transform(val => (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) ? Number(val) : null).nullable().optional(),
    avatar: z.string().nullable().optional(),
    mobile: z.string().nullable().optional(),
    jobTitle: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    employeeId: z.string().nullable().optional(),
    accountType: z.string().default('Employee'),
    laptopStatus: z.string().nullable().optional(),
});

export const assetSchema = z.object({
    assetId: z.string().min(3),
    name: z.string().min(2),
    category: z.string(),
    status: z.enum(['In Stock', 'Assigned', 'In Repair', 'Retired', 'Pending Handover']).default('In Stock'),
    assigneeId: z.number().nullable().optional(),
    assigneeType: z.enum(['User', 'Department', 'Branch']).nullable().optional(),
    company: z.string().nullable().optional(),
    brand: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    serialNumber: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    purchaseId: z.number().nullable().optional(),
    warrantyType: z.string().nullable().optional(),
    warrantyStartDate: z.string().nullable().optional(),
    warrantyYears: z.string().nullable().optional(),
    warrantyEndDate: z.string().nullable().optional(),
    remarks: z.string().nullable().optional(),
    specs: z.any().nullable().optional(),
});

export const purchaseSchema = z.object({
    invoiceNumber: z.string().min(1),
    purchaseDate: z.string(),
    vendor: z.string().nullable().optional(),
    amount: z.number().nullable().optional(),
    poNumber: z.string().nullable().optional(),
    invoiceAttachmentUrl: z.string().nullable().optional(),
    invoiceAttachmentFilename: z.string().nullable().optional(),
    poAttachmentUrl: z.string().nullable().optional(),
    poAttachmentFilename: z.string().nullable().optional(),
});

export const licenseSchema = z.object({
    name: z.string().min(2),
    category: z.string(),
    key: z.string().nullable().optional(),
    seats: z.number().int().min(1).default(1),
    startDate: z.string().nullable().optional(),
    expirationDate: z.string().nullable().optional(),
    cost: z.number().nullable().optional(),
    status: z.string().default('Active'),
    remarks: z.string().nullable().optional(),
});
