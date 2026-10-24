/**
 * Central safe field selection for User models to prevent accidental password hash leakage
 */
export const SAFE_USER_SELECT = {
    id: true,
    name: true,
    email: true,
    role: true,
    orgRole: true,
    isAdmin: true,
    isPortalUser: true,
    status: true,
    avatar: true,
    jobTitle: true,
    departmentId: true,
    branchId: true,
    managerId: true,
    employeeId: true,
    company: true,
    mobile: true,
    location: true,
    accountType: true,
    laptopStatus: true,
    emailAliases: true,
    zohoEmployeeId: true
} as const;
