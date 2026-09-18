import React, { createContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom';
import { AppContextType, User, Asset, NotificationType, AssetHistory, Department, Branch, PreviewTarget, Filter, PurchaseRecord, License, AssetRequest, SupportTicket, KnowledgeBaseArticle, SelfAudit } from '../types';
import { useAuth } from './AuthContext';

export const AppContext = createContext<AppContextType | undefined>(undefined);

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

interface AppProviderProps {
    children: ReactNode;
}

const defaultAssetFilter = [{ id: Date.now(), field: 'status', value: 'All' }];

// Helper: parse the current window.location on startup so initial state matches URL immediately
const parseInitialPath = () => {
    const raw = typeof window !== 'undefined' ? (window.location.pathname.replace(/\/+$/, '') || '/') : '/';
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    
    const declMatch = raw.match(/^\/preview\/declaration\/(\d+)$/);
    if (declMatch) {
        const uid = params.get('userId');
        return { view: 'assets', preview: { type: 'declaration' as const, assetId: Number(declMatch[1]), userId: uid ? Number(uid) : undefined }, assetId: null, userId: null, purchaseId: null, deptId: null, branchId: null };
    }
    const labelMatch = raw.match(/^\/preview\/label\/(\d+)$/);
    if (labelMatch) {
        return { view: 'assets', preview: { type: 'label' as const, assetId: Number(labelMatch[1]) }, assetId: null, userId: null, purchaseId: null, deptId: null, branchId: null };
    }
    const assetMatch = raw.match(/^\/assets\/(\d+)$/);
    if (assetMatch) {
        return { view: 'assets', preview: null, assetId: Number(assetMatch[1]), userId: null, purchaseId: null, deptId: null, branchId: null };
    }
    const userMatch = raw.match(/^\/users\/(\d+)$/);
    if (userMatch) {
        return { view: 'users', preview: null, assetId: null, userId: Number(userMatch[1]), purchaseId: null, deptId: null, branchId: null };
    }
    const purchaseMatch = raw.match(/^\/purchases\/(\d+)$/);
    if (purchaseMatch) {
        return { view: 'purchases', preview: null, assetId: null, userId: null, purchaseId: Number(purchaseMatch[1]), deptId: null, branchId: null };
    }
    const deptMatch = raw.match(/^\/departments\/(\d+)$/);
    if (deptMatch) {
        return { view: 'departments', preview: null, assetId: null, userId: null, purchaseId: null, deptId: Number(deptMatch[1]), branchId: null };
    }
    const branchMatch = raw.match(/^\/branches\/(\d+)$/);
    if (branchMatch) {
        return { view: 'branches', preview: null, assetId: null, userId: null, purchaseId: null, deptId: null, branchId: Number(branchMatch[1]) };
    }
    const knownViews = ['assets', 'users', 'departments', 'branches', 'requests', 'audits', 'tickets', 'kb', 'purchases', 'licenses', 'onboarding', 'profile'];
    const sectionMatch = raw.match(/^\/([a-zA-Z0-9_-]+)$/);
    if (sectionMatch && knownViews.includes(sectionMatch[1])) {
        return { view: sectionMatch[1], preview: null, assetId: null, userId: null, purchaseId: null, deptId: null, branchId: null };
    }
    return { view: 'dashboard', preview: null, assetId: null, userId: null, purchaseId: null, deptId: null, branchId: null };
};

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const location = useLocation();
    const routerNavigate = useRouterNavigate();

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
    const [selfAudits, setSelfAudits] = useState<SelfAudit[]>([]);
    const [notification, setNotification] = useState<NotificationType | null>(null);

    const initialRoute = parseInitialPath();
    const [view, setRawView] = useState<string>(initialRoute.view);
    const [pageState, setPageState] = useState<any | null>(null);
    const [assetFilters, setAssetFilters] = useState<Filter[]>(defaultAssetFilter);
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
        const storedTheme = localStorage.getItem('theme');
        return (storedTheme as 'light' | 'dark' | 'system') || 'system';
    });

    const [selectedAssetId, setRawSelectedAssetId] = useState<number | null>(initialRoute.assetId);
    const [selectedUserId, setRawSelectedUserId] = useState<number | null>(initialRoute.userId);
    const [selectedDepartmentId, setRawSelectedDepartmentId] = useState<number | null>(initialRoute.deptId);
    const [selectedBranchId, setRawSelectedBranchId] = useState<number | null>(initialRoute.branchId);
    const [selectedPurchaseId, setRawSelectedPurchaseId] = useState<number | null>(initialRoute.purchaseId);
    const [previewTarget, setRawPreviewTarget] = useState<PreviewTarget | null>(initialRoute.preview);

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
            const [usersRes, assetsRes, deptRes, branchRes, purchaseRes, licenseRes, requestsRes, ticketsRes, kbRes, selfAuditsRes, historyRes] = await Promise.all([
                fetchWithAuth(`${API_URL}/api/users`),
                fetchWithAuth(`${API_URL}/api/assets`),
                fetchWithAuth(`${API_URL}/api/departments`),
                fetchWithAuth(`${API_URL}/api/branches`),
                fetchWithAuth(`${API_URL}/api/purchases`),
                fetchWithAuth(`${API_URL}/api/licenses`),
                fetchWithAuth(`${API_URL}/api/requests`),
                fetchWithAuth(`${API_URL}/api/tickets`),
                fetchWithAuth(`${API_URL}/api/kb`),
                fetchWithAuth(`${API_URL}/api/self-audits`),
                fetchWithAuth(`${API_URL}/api/history`),
            ]);

            if (usersRes.ok) setUsers(await usersRes.json());
            const rawHistory = historyRes.ok ? await historyRes.json() : [];
            if (historyRes.ok) setAssetHistory(rawHistory);
            if (assetsRes.ok) {
                const rawAssets = await assetsRes.json();
                const historyConditionMap = new Map<number, string>();
                for (const h of rawHistory) {
                    if (h.assetId && h.condition && !historyConditionMap.has(h.assetId)) {
                        historyConditionMap.set(h.assetId, h.condition);
                    }
                }
                setAssets(rawAssets.map((a: any) => ({
                    ...a,
                    condition: a.condition || historyConditionMap.get(a.id) || 'Good',
                    specs: typeof a.specs === 'string' ? (() => { 
                        try { 
                            const parsed = JSON.parse(a.specs); 
                            return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                        } catch { return {}; } 
                    })() : (a.specs || {}),
                    assigneeType: a.assigneeType || (a.userId ? 'User' : undefined),
                    assigneeId: a.assigneeId || a.userId || undefined,
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
            if (selfAuditsRes && selfAuditsRes.ok) setSelfAudits(await selfAuditsRes.json());
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

    // Auto-poll tickets list every 15 seconds so new tickets appear without refresh
    useEffect(() => {
        const fetchTickets = async () => {
            try {
                const res = await fetch(`${API_URL}/api/tickets`, {
                    headers: getHeaders(),
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    setTickets(data);
                }
            } catch {
                // Silently ignore polling errors
            }
        };
        const interval = setInterval(fetchTickets, 15000);
        return () => clearInterval(interval);
    }, [getHeaders]);

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

    const fetchAssetHistory = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/history`, {
                headers: getHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setAssetHistory(data);
            }
        } catch (err) {
            console.error('Failed to fetch asset history:', err);
        }
    }, [getHeaders]);

    // Synchronize browser URL changes (back, forward, direct URL entry) to AppContext state
    useEffect(() => {
        const rawPath = location.pathname.replace(/\/+$/, '') || '/';

        // 1. Preview URLs
        const declMatch = rawPath.match(/^\/preview\/declaration\/(\d+)$/);
        if (declMatch) {
            const assetId = Number(declMatch[1]);
            const queryParams = new URLSearchParams(location.search);
            const uid = queryParams.get('userId');
            setRawView('assets');
            setRawPreviewTarget({ type: 'declaration', assetId, userId: uid ? Number(uid) : undefined });
            setRawSelectedAssetId(null);
            setRawSelectedUserId(null);
            setRawSelectedPurchaseId(null);
            setRawSelectedDepartmentId(null);
            setRawSelectedBranchId(null);
            return;
        }

        const labelMatch = rawPath.match(/^\/preview\/label\/(\d+)$/);
        if (labelMatch) {
            const assetId = Number(labelMatch[1]);
            setRawView('assets');
            setRawPreviewTarget({ type: 'label', assetId });
            setRawSelectedAssetId(null);
            setRawSelectedUserId(null);
            setRawSelectedPurchaseId(null);
            setRawSelectedDepartmentId(null);
            setRawSelectedBranchId(null);
            return;
        }

        // Clear preview target if not on a preview path
        setRawPreviewTarget(null);

        // 2. Detail View URLs
        const assetDetailMatch = rawPath.match(/^\/assets\/(\d+)$/);
        if (assetDetailMatch) {
            const id = Number(assetDetailMatch[1]);
            setRawView('assets');
            setRawSelectedAssetId(id);
            setRawSelectedUserId(null);
            setRawSelectedPurchaseId(null);
            setRawSelectedDepartmentId(null);
            setRawSelectedBranchId(null);
            return;
        }

        const userDetailMatch = rawPath.match(/^\/users\/(\d+)$/);
        if (userDetailMatch) {
            const id = Number(userDetailMatch[1]);
            setRawView('users');
            setRawSelectedUserId(id);
            setRawSelectedAssetId(null);
            setRawSelectedPurchaseId(null);
            setRawSelectedDepartmentId(null);
            setRawSelectedBranchId(null);
            return;
        }

        const purchaseDetailMatch = rawPath.match(/^\/purchases\/(\d+)$/);
        if (purchaseDetailMatch) {
            const id = Number(purchaseDetailMatch[1]);
            setRawView('purchases');
            setRawSelectedPurchaseId(id);
            setRawSelectedAssetId(null);
            setRawSelectedUserId(null);
            setRawSelectedDepartmentId(null);
            setRawSelectedBranchId(null);
            return;
        }

        const deptDetailMatch = rawPath.match(/^\/departments\/(\d+)$/);
        if (deptDetailMatch) {
            const id = Number(deptDetailMatch[1]);
            setRawView('departments');
            setRawSelectedDepartmentId(id);
            setRawSelectedAssetId(null);
            setRawSelectedUserId(null);
            setRawSelectedPurchaseId(null);
            setRawSelectedBranchId(null);
            return;
        }

        const branchDetailMatch = rawPath.match(/^\/branches\/(\d+)$/);
        if (branchDetailMatch) {
            const id = Number(branchDetailMatch[1]);
            setRawView('branches');
            setRawSelectedBranchId(id);
            setRawSelectedAssetId(null);
            setRawSelectedUserId(null);
            setRawSelectedPurchaseId(null);
            setRawSelectedDepartmentId(null);
            return;
        }

        // 3. Section/List URLs
        const knownViews = [
            'assets', 'users', 'departments', 'branches', 'requests', 
            'audits', 'tickets', 'kb', 'purchases', 'licenses', 
            'onboarding', 'profile'
        ];
        const sectionMatch = rawPath.match(/^\/([a-zA-Z0-9_-]+)$/);
        if (sectionMatch && knownViews.includes(sectionMatch[1])) {
            const section = sectionMatch[1];
            setRawView(section);
            setRawSelectedAssetId(null);
            setRawSelectedUserId(null);
            setRawSelectedPurchaseId(null);
            setRawSelectedDepartmentId(null);
            setRawSelectedBranchId(null);
            return;
        }

        // 4. Home / Dashboard
        if (rawPath === '/' || rawPath === '/dashboard') {
            setRawView('dashboard');
            setRawSelectedAssetId(null);
            setRawSelectedUserId(null);
            setRawSelectedPurchaseId(null);
            setRawSelectedDepartmentId(null);
            setRawSelectedBranchId(null);
            return;
        }
    }, [location.pathname, location.search]);

    const navigate = useCallback((targetView: string, state?: { [key: string]: any }) => {
        if (targetView !== 'assets' && view === 'assets') {
            setAssetFilters(defaultAssetFilter);
        }
        setPageState(state || null);
        setRawSelectedAssetId(null);
        setRawSelectedUserId(null);
        setRawSelectedDepartmentId(null);
        setRawSelectedBranchId(null);
        setRawSelectedPurchaseId(null);
        setRawPreviewTarget(null);

        const targetPath = targetView === 'dashboard' ? '/' : `/${targetView}`;
        if (location.pathname !== targetPath) {
            routerNavigate(targetPath, { state });
        }
        setRawView(targetView);
    }, [view, location.pathname, routerNavigate]);

    const setSelectedAssetId = useCallback((id: number | null) => {
        setRawSelectedAssetId(id);
        if (id !== null) {
            if (location.pathname !== `/assets/${id}`) {
                routerNavigate(`/assets/${id}`);
            }
        } else {
            if (location.pathname.startsWith('/assets/')) {
                if (window.history.length > 1 && (window.history.state as any)?.idx > 0) {
                    routerNavigate(-1);
                } else {
                    routerNavigate('/assets');
                }
            }
        }
    }, [location.pathname, routerNavigate]);

    const setSelectedUserId = useCallback((id: number | null) => {
        setRawSelectedUserId(id);
        if (id !== null) {
            if (location.pathname !== `/users/${id}`) {
                routerNavigate(`/users/${id}`);
            }
        } else {
            if (location.pathname.startsWith('/users/')) {
                if (window.history.length > 1 && (window.history.state as any)?.idx > 0) {
                    routerNavigate(-1);
                } else {
                    routerNavigate('/users');
                }
            }
        }
    }, [location.pathname, routerNavigate]);

    const setSelectedPurchaseId = useCallback((id: number | null) => {
        setRawSelectedPurchaseId(id);
        if (id !== null) {
            if (location.pathname !== `/purchases/${id}`) {
                routerNavigate(`/purchases/${id}`);
            }
        } else {
            if (location.pathname.startsWith('/purchases/')) {
                if (window.history.length > 1 && (window.history.state as any)?.idx > 0) {
                    routerNavigate(-1);
                } else {
                    routerNavigate('/purchases');
                }
            }
        }
    }, [location.pathname, routerNavigate]);

    const setSelectedDepartmentId = useCallback((id: number | null) => {
        setRawSelectedDepartmentId(id);
        if (id !== null) {
            if (location.pathname !== `/departments/${id}`) {
                routerNavigate(`/departments/${id}`);
            }
        } else {
            if (location.pathname.startsWith('/departments/')) {
                if (window.history.length > 1 && (window.history.state as any)?.idx > 0) {
                    routerNavigate(-1);
                } else {
                    routerNavigate('/departments');
                }
            }
        }
    }, [location.pathname, routerNavigate]);

    const setSelectedBranchId = useCallback((id: number | null) => {
        setRawSelectedBranchId(id);
        if (id !== null) {
            if (location.pathname !== `/branches/${id}`) {
                routerNavigate(`/branches/${id}`);
            }
        } else {
            if (location.pathname.startsWith('/branches/')) {
                if (window.history.length > 1 && (window.history.state as any)?.idx > 0) {
                    routerNavigate(-1);
                } else {
                    routerNavigate('/branches');
                }
            }
        }
    }, [location.pathname, routerNavigate]);

    const setPreviewTarget = useCallback((target: PreviewTarget | null) => {
        setRawPreviewTarget(target);
        if (target) {
            if (target.type === 'declaration') {
                const query = target.userId ? `?userId=${target.userId}` : '';
                routerNavigate(`/preview/declaration/${target.assetId}${query}`);
            } else if (target.type === 'label') {
                routerNavigate(`/preview/label/${target.assetId}`);
            }
        } else {
            if (location.pathname.startsWith('/preview/')) {
                if (window.history.length > 1 && (window.history.state as any)?.idx > 0) {
                    routerNavigate(-1);
                } else {
                    routerNavigate('/assets');
                }
            }
        }
    }, [location.pathname, routerNavigate]);

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
        fetchAssetHistory,
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
        selfAudits,
        setSelfAudits,
        fetchAllData,
        getHeaders,
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};