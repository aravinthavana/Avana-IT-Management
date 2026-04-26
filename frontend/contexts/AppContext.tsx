import React, { createContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { AppContextType, User, Asset, NotificationType, AssetHistory, Department, Branch, PreviewTarget, Filter, PurchaseRecord, License, AssetRequest, SupportTicket, KnowledgeBaseArticle } from '../types';
import { useAuth } from './AuthContext';

export const AppContext = createContext<AppContextType | undefined>(undefined);

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

interface AppProviderProps {
    children: ReactNode;
}

const defaultAssetFilter = [{ id: Date.now(), field: 'status', value: 'All' }];

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const [currentUser, setCurrentUser] = useState<User>(user || { id: 0, name: 'Loading...', email: '', role: 'User' });

    useEffect(() => {
        if (user) setCurrentUser(user);
    }, [user]);
    const [users, setUsers] = useState<User[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [assetHistory, setAssetHistory] = useState<AssetHistory[]>([]);
    const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);
    const [licenses, setLicenses] = useState<License[]>([]);
    const [assetRequests, setAssetRequests] = useState<AssetRequest[]>([]);
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [kbArticles, setKbArticles] = useState<KnowledgeBaseArticle[]>([]);
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

    // Helper: get auth headers
    const getHeaders = useCallback(() => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const cookies = document.cookie.split(';');
        const csrfCookie = cookies.find(c => c.trim().startsWith('XSRF-TOKEN='));
        if (csrfCookie) {
            headers['X-XSRF-TOKEN'] = decodeURIComponent(csrfCookie.trim().split('=')[1]);
        }
        return headers;
    }, []);

    // Fetch all initial data from backend when app loads
    const fetchAllData = useCallback(async () => {
        const fetchWithAuth = async (url: string, options: any = {}) => {
            const res = await fetch(url, { ...options, headers: { ...options.headers, ...getHeaders() }, credentials: 'include' });
            if (res.status === 401) {
                window.dispatchEvent(new Event('app:logout'));
                throw new Error('Session expired');
            }
            return res;
        };

        try {
            const [usersRes, assetsRes, deptRes, branchRes, purchaseRes, licenseRes, requestsRes, ticketsRes, kbRes] = await Promise.all([
                fetchWithAuth(`${API_URL}/api/users`),
                fetchWithAuth(`${API_URL}/api/assets`),
                fetchWithAuth(`${API_URL}/api/departments`),
                fetchWithAuth(`${API_URL}/api/branches`),
                fetchWithAuth(`${API_URL}/api/purchases`),
                fetchWithAuth(`${API_URL}/api/licenses`),
                fetchWithAuth(`${API_URL}/api/requests`),
                fetchWithAuth(`${API_URL}/api/tickets`),
                fetchWithAuth(`${API_URL}/api/kb`),
            ]);

            if (usersRes.ok) setUsers(await usersRes.json());
            if (assetsRes.ok) {
                const rawAssets = await assetsRes.json();
                setAssets(rawAssets.map((a: any) => ({
                    ...a,
                    specs: typeof a.specs === 'string' ? (() => { try { return JSON.parse(a.specs); } catch { return {}; } })() : (a.specs || {}),
                    assigneeType: a.userId ? 'User' : undefined,
                    assigneeId: a.userId || undefined,
                })));
            }
            if (deptRes.ok) setDepartments(await deptRes.json());
            if (branchRes.ok) setBranches(await branchRes.json());
            if (purchaseRes.ok) setPurchaseRecords((await purchaseRes.json()).map((p: any) => ({
                ...p,
                purchaseDate: p.purchaseDate ? new Date(p.purchaseDate).toISOString().split('T')[0] : ''
            })));
            if (licenseRes.ok) {
                const rawLicenses = await licenseRes.json();
                setLicenses(rawLicenses.map((l: any) => ({
                    ...l,
                    assignedSeats: l.assignments?.length || 0,
                })));
            }
            if (requestsRes.ok) setAssetRequests(await requestsRes.json());
            if (ticketsRes.ok) setTickets(await ticketsRes.json());
            if (kbRes.ok) setKbArticles(await kbRes.json());
        } catch (err) {
            console.error('Failed to fetch initial data:', err);
        }
    }, []);

    // Fetch data on mount if token exists
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Listen for login event to re-fetch data
    useEffect(() => {
        const handler = async () => {
            fetchAllData();
        };
        window.addEventListener('app:login', handler);
        return () => window.removeEventListener('app:login', handler);
    }, [fetchAllData]);

    useEffect(() => {
        const root = window.document.documentElement;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = () => {
            const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
            if (isDark) { root.classList.add('dark'); } else { root.classList.remove('dark'); }
        };

        applyTheme();
        localStorage.setItem('theme', theme);

        const handleChange = () => { if (theme === 'system') applyTheme(); };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const logAssetHistory = async (assetId: number, event: string, details?: string) => {
        // Optimistic local update
        const loggedInUser = currentUser;
        const newEntry: AssetHistory = {
            id: Date.now(),
            assetId,
            timestamp: new Date().toISOString(),
            user: { id: loggedInUser.id, name: loggedInUser.name },
            event,
            details,
        };
        setAssetHistory(prev => [newEntry, ...prev]);
        // Persist to backend
        try {
            await fetch(`${API_URL}/api/history`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ assetId, event, details }),
                credentials: 'include'
            });
        } catch (err) {
            console.error('Failed to log history', err);
        }
    };

    const navigate = (targetView: string, state?: { [key: string]: any }) => {
        if (targetView !== 'assets' && view === 'assets') {
            setAssetFilters(defaultAssetFilter);
        }
        setPageState(state || null);
        setView(targetView);
    };

    const clearPageState = () => { setPageState(null); };

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
        licenses,
        setLicenses,
        assetRequests,
        setAssetRequests,
        tickets,
        setTickets,
        kbArticles,
        setKbArticles,
        fetchAllData,
        getHeaders,
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};