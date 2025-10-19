import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { AppContextType, User, Asset, NotificationType, AssetHistory, Department, Branch, PreviewTarget, Filter, PurchaseRecord } from '../types';
import { initialUsers, initialAssets, initialAssetHistory, initialDepartments, initialBranches, initialPurchaseRecords } from '../data/initialData';

export const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
    children: ReactNode;
}

const defaultAssetFilter = [{ id: Date.now(), field: 'status', value: 'All' }];

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User>(initialUsers[0]);
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [assets, setAssets] = useState<Asset[]>(initialAssets);
    const [departments, setDepartments] = useState<Department[]>(initialDepartments);
    const [branches, setBranches] = useState<Branch[]>(initialBranches);
    const [assetHistory, setAssetHistory] = useState<AssetHistory[]>(initialAssetHistory);
    const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>(initialPurchaseRecords);
    const [notification, setNotification] = useState<NotificationType | null>(null);
    const [view, setView] = useState('dashboard');
    const [pageState, setPageState] = useState<any | null>(null);
    const [assetFilters, setAssetFilters] = useState<Filter[]>(defaultAssetFilter);
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
        const storedTheme = localStorage.getItem('theme');
        return (storedTheme as 'light' | 'dark' | 'system') || 'system';
    });

    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);
    const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);

    useEffect(() => {
        const root = window.document.documentElement;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = () => {
            const isDark =
                theme === 'dark' ||
                (theme === 'system' && mediaQuery.matches);
            
            if (isDark) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };

        applyTheme();
        localStorage.setItem('theme', theme);

        const handleChange = () => {
            if (theme === 'system') {
                applyTheme();
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const logAssetHistory = (assetId: number, event: string, details?: string) => {
        const newHistoryEntry: AssetHistory = {
            id: Date.now(),
            assetId,
            timestamp: new Date().toISOString(),
            user: {
                id: currentUser.id,
                name: currentUser.name
            },
            event,
            details
        };
        setAssetHistory(prev => [newHistoryEntry, ...prev]);
    };
    
    const navigate = (targetView: string, state?: { [key: string]: any }) => {
        if (targetView !== 'assets' && view === 'assets') {
             setAssetFilters(defaultAssetFilter);
        }
        setPageState(state || null);
        setView(targetView);
    };

    const clearPageState = () => {
        setPageState(null);
    };

    const contextValue: AppContextType = {
        currentUser,
        setCurrentUser,
        users,
        setUsers,
        assets,
        setAssets,
        departments,
        setDepartments,
        branches,
        setBranches,
        assetHistory,
        logAssetHistory,
        notification,
        setNotification,
        view,
        navigate,
        pageState,
        clearPageState,
        theme,
        setTheme,
        selectedAssetId,
        setSelectedAssetId,
        selectedUserId,
        setSelectedUserId,
        selectedDepartmentId,
        setSelectedDepartmentId,
        selectedBranchId,
        setSelectedBranchId,
        previewTarget,
        setPreviewTarget,
        assetFilters,
        setAssetFilters,
        purchaseRecords,
        setPurchaseRecords,
        selectedPurchaseId,
        setSelectedPurchaseId,
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};