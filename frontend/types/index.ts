export interface User {
    id: number;
    name: string;
    email: string;
    role: 'Admin' | 'User' | 'Manager';
    status?: 'Active' | 'Inactive';
    departmentId?: number;
    branchId?: number;
    managerId?: number;
    department?: any;  // populated by Prisma include
    branch?: any;     // populated by Prisma include
    manager?: User;   // populated by Prisma include
    employeeId?: string;
    mobile?: string;
    company?: string;
    location?: string;
    workAddress?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    avatar?: string;
    jobTitle?: string;
    password?: string;
    licenseAssignments?: LicenseAssignment[];
    accountType?: string;
    laptopStatus?: string;

    // IT Operations - Onboarding Checklist
    m365AccountCreated?: boolean;
    m365LicenseAssigned?: boolean;
    softwareInstalled?: boolean;
    hardwareTested?: boolean;
    credentialsHandedOver?: boolean;
    dispatchDetails?: string | null; // JSON string of DispatchDetails
    onboardingStatus?: 'Pending' | 'In Progress' | 'Completed' | 'Not Required';
    onboardingCompletedDate?: string | null;
    onboardingStep?: number | null;

    // IT Operations - Offboarding Checklist
    assetReturned?: boolean;
    assetReturnCondition?: string | null; // "Good" | "Minor Damage" | "Major Damage" | "Non-functional"
    assetReturnRemarks?: string | null;
    assetReturnDocket?: string | null; // JSON string of ReturnDocketDetails
    deviceWiped?: boolean;
    dataBackedUp?: boolean;
    m365LicenseRevoked?: boolean;
    m365AccountDisabled?: boolean;
    offboardingStatus?: 'Pending' | 'In Progress' | 'Completed' | 'Not Started';
    offboardingCompletedDate?: string | null;
}

export interface DispatchDetails {
    mode?: 'Courier' | 'In-Person' | 'Remote' | 'Not Applicable';
    dcNumber?: string;
    shippingAddress?: string;
    courierName?: string;
    docketNumber?: string;
    dispatchDate?: string;
    trackingUrl?: string;
    officeLocation?: string;
    remarks?: string;
    isDispatched?: boolean;
}

export interface ReturnDocketDetails {
    mode?: 'Courier' | 'In-Person';
    courier?: string;
    docketNo?: string;
    returnDate?: string;
    remarks?: string;
}

export interface AssetRequest {
    id: number;
    userId: number;
    managerId?: number;
    requestType: string;
    category: string;
    description?: string;
    status: 'Pending Manager' | 'Pending Admin' | 'Approved' | 'Rejected by Manager' | 'Rejected by Admin';
    createdAt: string;
    updatedAt?: string;
    user?: User;
    manager?: User;
}

export interface Department {
    id: number;
    name: string;
}

export interface Branch {
    id: number;
    name: string;
    location?: string;
}

export interface AssetSpecs {
    os?: string;
    storage?: string;
    ram?: string;
    processor?: string;
    color?: string;
    serviceTag?: string;
    chargerAdapter?: string;
    graphics?: string;
    memoryTechnology?: string;
    battery?: string;
    dimensions?: string;
    audio?: string;
    displaySize?: string;
    itemWeight?: string;
    software?: string;
    [key: string]: any;
}

export interface Asset {
    id: number;
    assetId: string;
    name: string;
    category: string;
    status: 'In Use' | 'Available' | 'Under Repair' | 'Retired' | string;
    assigneeId?: number;
    assigneeType?: 'User' | 'Department' | 'Branch' | string;
    company?: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    location?: string;
    purchaseId?: number;
    warrantyType?: 'Years' | 'End Date';
    warrantyStartDate?: string;
    warrantyYears?: number | string;
    warrantyEndDate?: string;
    remarks?: string;
    specs?: AssetSpecs;
}

export interface AssetHistory {
    id: number;
    assetId: number;
    timestamp: string;
    user?: { id: number; name: string } | null;
    event: string;
    details?: string;
    condition?: string;
}

export interface PurchaseRecord {
    id: number;
    invoiceNumber: string;
    poNumber?: string;
    purchaseDate: string;
    vendor?: string;
    amount?: number;
    invoiceAttachmentUrl?: string;
    invoiceAttachmentFilename?: string;
    poAttachmentUrl?: string;
    poAttachmentFilename?: string;
    assets?: Asset[];
}

export interface NotificationType {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

export interface PreviewTarget {
    type: 'declaration' | 'label';
    assetId?: number;
    userId?: number;
    id?: number;
}

export interface Filter {
    id: number;
    field: string;
    value: string;
}

export interface AppContextType {
    currentUser: User;
    setCurrentUser: (u: User) => void;
    users: User[];
    setUsers: (u: User[]) => void;
    assets: Asset[];
    setAssets: (a: Asset[]) => void;
    departments: Department[];
    setDepartments: (d: Department[]) => void;
    branches: Branch[];
    setBranches: (b: Branch[]) => void;
    assetHistory: AssetHistory[];
    logAssetHistory: (assetId: number, event: string, details?: string) => void;
    fetchAssetHistory: () => Promise<void>;
    notification: NotificationType | null;
    setNotification: (n: NotificationType | null) => void;
    view: string;
    navigate: (v: string, state?: any) => void;
    pageState: any | null;
    clearPageState: () => void;
    theme: 'light' | 'dark' | 'system';
    setTheme: (t: 'light' | 'dark' | 'system') => void;
    selectedAssetId: number | null;
    setSelectedAssetId: (id: number | null) => void;
    selectedUserId: number | null;
    setSelectedUserId: (id: number | null) => void;
    selectedDepartmentId: number | null;
    setSelectedDepartmentId: (id: number | null) => void;
    selectedBranchId: number | null;
    setSelectedBranchId: (id: number | null) => void;
    previewTarget: PreviewTarget | null;
    setPreviewTarget: (p: PreviewTarget | null) => void;
    assetFilters: Filter[];
    setAssetFilters: (f: Filter[]) => void;
    purchaseRecords: PurchaseRecord[];
    setPurchaseRecords: (p: PurchaseRecord[]) => void;
    selectedPurchaseId: number | null;
    setSelectedPurchaseId: (id: number | null) => void;
    licenses: License[];
    setLicenses: (l: License[]) => void;
    assetRequests: AssetRequest[];
    setAssetRequests: (r: AssetRequest[]) => void;
    tickets: SupportTicket[];
    setTickets: (t: SupportTicket[]) => void;
    kbArticles: KnowledgeBaseArticle[];
    setKbArticles: (k: KnowledgeBaseArticle[]) => void;
    selfAudits: SelfAudit[];
    setSelfAudits: (s: SelfAudit[]) => void;
    fetchAllData: () => Promise<void>;
    getHeaders: () => Record<string, string>;
}

export type WarrantyStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Lifetime' | 'None' | 'Unknown' | 'N/A';

export interface License {
    id: number;
    name: string;
    category: string;
    key?: string;
    seats: number;
    assignedSeats: number;
    startDate?: string;
    expirationDate?: string;
    cost?: number;
    status: string;
    remarks?: string;
    assignments?: LicenseAssignment[];
}

export interface LicenseAssignment {
    id: number;
    licenseId: number;
    userId?: number;
    assetId?: number;
    assignedAt: string;
    user?: User;
    asset?: Asset;
}

export interface TicketAttachment {
    url: string;
    name: string;
    size: number;
    type: string;
}

export interface SupportTicket {
    id: number;
    userId: number;
    user?: User;
    subject: string;
    category: string;
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    description: string;
    attachments?: TicketAttachment[] | string;
    assetId?: number;
    asset?: Asset;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    comments?: TicketComment[];
}

export interface TicketComment {
    id: number;
    ticketId: number;
    userId: number;
    user?: { id: number; name: string; role: string; avatar?: string };
    message: string;
    attachments?: TicketAttachment[] | string;
    source?: 'Portal' | 'Email';
    emailMessageId?: string;
    createdAt: string;
}

export interface KnowledgeBaseArticle {
    id: number;
    title: string;
    category: string;
    content: string;
    authorId: number;
    author?: { name: string };
    createdAt: string;
    updatedAt: string;
}

export interface SelfAudit {
    id: number;
    assetId: number;
    userId: number;
    scannedAssetId?: string;
    imageUrl?: string;
    remarks?: string;
    status: 'Pending Review' | 'Approved' | 'Rejected';
    auditDate: string;
    asset?: Asset;
    user?: User;
}

export function normalizeCompanyCode(company?: string | null): string {
    if (!company) return '';
    const upper = company.trim().toUpperCase();
    if (upper.includes('SURGICAL') || upper.startsWith('ASSP')) return 'ASSP';
    if (upper.includes('TECHNOLOGY') || upper.startsWith('ATS')) return 'ATS';
    if (upper.includes('MEDICAL') || upper.startsWith('AMD')) return 'AMD';
    return upper;
}
