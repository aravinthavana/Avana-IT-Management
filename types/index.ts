export interface User {
    id: number;
    name: string;
    email: string;
    role: 'Admin' | 'User' | 'Manager';
    departmentId?: number;
    branchId?: number;
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
}
