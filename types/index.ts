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
    // Legacy frontend-only fields (kept for compatibility)
    employeeId?: string;
    mobile?: string;
    company?: string;
    location?: string;
    avatar?: string;
    password?: string;
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
    specs?: Record<string, any>;
}

export interface AssetHistory {
    id: number;
    assetId: number;
    timestamp: string;
    user: { id: number; name: string };
    event: string;
    details?: string;
}

export interface PurchaseRecord {
    id: number;
    invoiceNumber: string;
    purchaseDate: string;
    vendor?: string;
    amount?: number;
}

export interface NotificationType {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

export interface PreviewTarget {
    type: 'declaration' | 'label';
    assetId: number;
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
    fetchAllData: () => Promise<void>;
    getHeaders: () => Record<string, string>;
}

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

export interface SupportTicket {
    id: number;
    userId: number;
    user?: User;
    subject: string;
    category: string;
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    description: string;
    assetId?: number;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
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
