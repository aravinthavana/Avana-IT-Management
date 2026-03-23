import { User, Asset, AssetHistory, Department, Branch, PurchaseRecord } from '../types';

export const initialUsers: User[] = [
    { id: 1, name: 'Admin User', email: 'admin@example.com', role: 'Admin' }
];

export const initialAssets: Asset[] = [];
export const initialAssetHistory: AssetHistory[] = [];
export const initialDepartments: Department[] = [];
export const initialBranches: Branch[] = [];
export const initialPurchaseRecords: PurchaseRecord[] = [];
