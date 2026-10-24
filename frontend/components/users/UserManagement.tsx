import { API_URL } from '../../utils/apiClient';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import ConfirmationModal from '../ui/ConfirmationModal';
import UserForm from './UserForm';
import UserDetailView from './UserDetailView';
import UserHierarchy from './UserHierarchy';
import OnboardingWizardModal from '../onboarding/OnboardingWizardModal';
import { HrReviewModal } from './HrReviewModal';
import { User } from '../../types';


interface UserManagementProps {
    initialFilters: any[] | null;
    onFiltersApplied: () => void;
}

// Kebab (⋯) action menu for each user row
const UserActionMenu: React.FC<{
    user: User;
    isSelf: boolean;
    isInactive: boolean;
    isAdmin: boolean;
    onEdit: () => void;
    onDeactivate: () => void;
    onReactivate: () => void;
    onDelete: () => void;
}> = ({ user, isSelf, isInactive, isAdmin, onEdit, onDeactivate, onReactivate, onDelete }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
            <button
                onClick={() => setOpen(o => !o)}
                className="p-2 rounded-lg text-quiet hover:text-ink hover:bg-muted transition-colors"
                title="Actions"
            >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            {open && (
                <div className="absolute right-0 mt-1 w-44 bg-surface border border-line rounded-xl shadow-lg z-10 py-1 text-sm">
                    <button onClick={() => { onEdit(); setOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-canvas flex items-center gap-2 text-ink">
                        {ICONS.edit} Edit
                    </button>
                    {isAdmin && !isSelf && !isInactive && (
                        <button onClick={() => { onDeactivate(); setOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-canvas flex items-center gap-2 text-ink">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            Deactivate
                        </button>
                    )}
                    {isAdmin && !isSelf && isInactive && (
                        <button onClick={() => { onReactivate(); setOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-canvas flex items-center gap-2 text-ink">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Reactivate
                        </button>
                    )}
                    {isAdmin && !isSelf && (
                        <button onClick={() => { onDelete(); setOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-surface flex items-center gap-2 text-ink border-t border-line mt-1">
                            {ICONS.delete} Delete
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const UserManagement: React.FC<UserManagementProps> = ({ initialFilters, onFiltersApplied }) => {
    const { users, setUsers, assets, setAssets, setNotification, selectedUserId, setSelectedUserId, selectedDepartmentId, navigate, getHeaders, fetchAllData, fetchAssetHistory } = useAppContext();
    const { user: loggedInUser } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCompany, setFilterCompany] = useState('All');
    const [filterAccountType, setFilterAccountType] = useState('All');
    const [filterLaptopStatus, setFilterLaptopStatus] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [confirmAction, setConfirmAction] = useState<{ type: 'deactivate' | 'reactivate' | 'delete'; userId: number; userName: string } | null>(null);
    const [sortKey, setSortKey] = useState('name-asc');
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
    const [reclaimAll, setReclaimAll] = useState(true);
    const [isOnboardingWizardOpen, setIsOnboardingWizardOpen] = useState(false);
    const [wizardUser, setWizardUser] = useState<User | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [isM365Syncing, setIsM365Syncing] = useState(false);
    const [isHrReviewOpen, setIsHrReviewOpen] = useState(false);
    const [pendingHrCount, setPendingHrCount] = useState(0);

    const fetchPendingHrCount = async () => {
        try {
            const res = await fetch(`${API_URL}/api/zoho/changes?status=Pending`, {
                headers: getHeaders(),
                credentials: 'include'
            });
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
                const data = await res.json();
                setPendingHrCount(data.pendingCount || 0);
            }
        } catch (e) {
            // Ignore if backend not reachable
        }
    };

    useEffect(() => {
        fetchPendingHrCount();
    }, []);

    const handleSyncM365 = async () => {
        setIsM365Syncing(true);
        try {
            const res = await fetch(`${API_URL}/api/m365/sync`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (res.status === 404) {
                throw new Error('M365 sync endpoint not found (404). Please ensure the latest backend commit is deployed on Render.');
            }
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(`Unexpected server response (${res.status} ${res.statusText}). The backend may be deploying or restarting.`);
            }
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to sync with Microsoft 365');
            }
            setNotification({
                message: data.message || `M365 Sync completed! ${data.data?.usersCreated || 0} created, ${data.data?.usersUpdated || 0} updated.`,
                type: 'success'
            });
            fetchAllData();
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsM365Syncing(false);
        }
    };

    const handleOpenModal = (user: User | null = null) => { setEditingUser(user); setIsModalOpen(true); };
    const handleCloseModal = () => { setEditingUser(null); setIsModalOpen(false); };

    const handleSaveUser = async (
        userData: any,
        assetAssignment?: {
            assetId?: number;
            condition?: string;
            action?: 'assign' | 'unassign';
            unassignAssetId?: number;
        },
        launchWizard?: boolean
    ) => {
        setIsLoading(true);
        try {
            if (editingUser) {
                const res = await fetch(`${API_URL}/api/users/${editingUser.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    credentials: 'include',
                    body: JSON.stringify(userData),
                });
                if (!res.ok) {
                    const err = await res.json();
                    const errMsg = typeof err.error === 'string' ? err.error : (typeof err.message === 'string' ? err.message : 'Failed to update user');
                    throw new Error(errMsg);
                }
                const updated = await res.json();
                setUsers(users.map(u => u.id === editingUser.id ? updated : u));

                if (assetAssignment?.unassignAssetId) {
                    const oldAsset = assets.find(a => a.id === assetAssignment.unassignAssetId);
                    if (oldAsset) {
                        try {
                            const unassignRes = await fetch(`${API_URL}/api/assets/${oldAsset.id}`, {
                                method: 'PUT',
                                headers: getHeaders(),
                                credentials: 'include',
                                body: JSON.stringify({
                                    ...oldAsset,
                                    assigneeId: null,
                                    assigneeType: null,
                                    assignedTo: null,
                                    userId: null,
                                    status: 'In Stock',
                                    specs: oldAsset.specs ? (typeof oldAsset.specs === 'string' ? oldAsset.specs : JSON.stringify(oldAsset.specs)) : null
                                })
                            });
                            if (unassignRes.ok) {
                                const unassignedAsset = await unassignRes.json();
                                setAssets(prev => prev.map(a => a.id === unassignedAsset.id ? { ...unassignedAsset, specs: typeof unassignedAsset.specs === 'string' ? JSON.parse(unassignedAsset.specs) : unassignedAsset.specs } : a));
                                fetchAssetHistory();
                            }
                        } catch (err) {
                            console.error('Failed to unassign previous asset on edit:', err);
                        }
                    }
                }

                if (assetAssignment?.action === 'assign' && assetAssignment.assetId) {
                    const assetToAssign = assets.find(a => a.id === assetAssignment.assetId);
                    if (assetToAssign) {
                        try {
                            const assignRes = await fetch(`${API_URL}/api/assets/${assetToAssign.id}`, {
                                method: 'PUT',
                                headers: getHeaders(),
                                credentials: 'include',
                                body: JSON.stringify({
                                    ...assetToAssign,
                                    assigneeId: updated.id,
                                    assigneeType: 'User',
                                    status: 'Assigned',
                                    location: updated.location,
                                    condition: assetAssignment.condition || 'Good',
                                    specs: assetToAssign.specs ? (typeof assetToAssign.specs === 'string' ? assetToAssign.specs : JSON.stringify(assetToAssign.specs)) : null
                                })
                            });
                            if (assignRes.ok) {
                                const updatedAsset = await assignRes.json();
                                setAssets(prev => prev.map(a => a.id === updatedAsset.id ? { ...updatedAsset, specs: typeof updatedAsset.specs === 'string' ? JSON.parse(updatedAsset.specs) : updatedAsset.specs } : a));
                                fetchAssetHistory();
                            }
                        } catch (assignErr) {
                            console.error('Failed to assign new asset on edit:', assignErr);
                        }
                    }
                }

                setNotification({ message: 'User updated successfully.', type: 'success' });
                if (launchWizard) { setWizardUser(updated); setIsOnboardingWizardOpen(true); }
            } else {
                const res = await fetch(`${API_URL}/api/users`, {
                    method: 'POST',
                    headers: getHeaders(),
                    credentials: 'include',
                    body: JSON.stringify(userData),
                });
                if (!res.ok) {
                    const err = await res.json();
                    const errMsg = typeof err.error === 'string' ? err.error : (typeof err.message === 'string' ? err.message : 'Failed to create user');
                    throw new Error(errMsg);
                }
                const newUser = await res.json();
                setUsers([...users, newUser]);

                if (assetAssignment?.action === 'assign' && assetAssignment.assetId) {
                    const assetToAssign = assets.find(a => a.id === assetAssignment.assetId);
                    if (assetToAssign) {
                        try {
                            const assignRes = await fetch(`${API_URL}/api/assets/${assetToAssign.id}`, {
                                method: 'PUT',
                                headers: getHeaders(),
                                credentials: 'include',
                                body: JSON.stringify({
                                    ...assetToAssign,
                                    assigneeId: newUser.id,
                                    assigneeType: 'User',
                                    status: 'Assigned',
                                    location: newUser.location,
                                    condition: assetAssignment.condition || 'Good',
                                    specs: assetToAssign.specs ? (typeof assetToAssign.specs === 'string' ? assetToAssign.specs : JSON.stringify(assetToAssign.specs)) : null
                                })
                            });
                            if (assignRes.ok) {
                                const updatedAsset = await assignRes.json();
                                setAssets(prev => prev.map(a => a.id === updatedAsset.id ? { ...updatedAsset, specs: typeof updatedAsset.specs === 'string' ? JSON.parse(updatedAsset.specs) : updatedAsset.specs } : a));
                                fetchAssetHistory();
                            }
                        } catch (assignErr) {
                            console.error('Failed to assign asset to new user:', assignErr);
                        }
                    }
                }

                setNotification({ message: 'User created successfully.', type: 'success' });
                if (launchWizard) { setWizardUser(newUser); setIsOnboardingWizardOpen(true); }
            }
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
            handleCloseModal();
            fetchAllData();
        }
    };

    useEffect(() => {
        if (initialFilters) {
            const companyFilter = initialFilters.find((f: any) => f.field === 'company');
            if (companyFilter) setFilterCompany(companyFilter.value);
            const statusFilter = initialFilters.find((f: any) => f.field === 'laptopStatus');
            if (statusFilter) setFilterLaptopStatus(statusFilter.value);
            onFiltersApplied();
        }
    }, [initialFilters]);

    const handleStatusChange = async (userId: number, newStatus: string, reclaimAllAssets?: boolean) => {
        if (loggedInUser?.role !== 'Admin') {
            setNotification({ message: 'Only Administrators have permission to change user status.', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}/status`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({ status: newStatus, reclaimAll: reclaimAllAssets }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update status');
            }
            const updated = await res.json();
            setUsers(users.map(u => u.id === userId ? { ...u, status: updated.status } : u));
            setNotification({ message: `User ${newStatus === 'Inactive' ? 'deactivated' : 'reactivated'} successfully.`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
            setConfirmAction(null);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (loggedInUser?.role !== 'Admin') {
            setNotification({ message: 'Only Administrators have permission to delete users.', type: 'error' });
            return;
        }
        if (userId === loggedInUser?.id) {
            setNotification({ message: 'You cannot delete your own account.', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include',
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete user');
            }
            setUsers(users.filter(u => u.id !== userId));
            setNotification({ message: 'User permanently deleted.', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
            setConfirmAction(null);
        }
    };

    const handleConfirm = () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'deactivate') handleStatusChange(confirmAction.userId, 'Inactive', reclaimAll);
        else if (confirmAction.type === 'reactivate') handleStatusChange(confirmAction.userId, 'Active');
        else if (confirmAction.type === 'delete') handleDeleteUser(confirmAction.userId);
    };

    const processedUsers = useMemo(() => {
        let filtered = users.filter(user => {
            const matchesSearch = (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.department?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesCompany = filterCompany === 'All' || Boolean(user.company && (user.company === filterCompany || user.company.includes(filterCompany) || filterCompany.includes(user.company)));

            const accType = user.accountType || 'Employee';
            const matchesAccountType = filterAccountType === 'All' || accType === filterAccountType;

            const matchesStatus = filterStatus === 'All' || (filterStatus === 'Active' ? user.status !== 'Inactive' : user.status === 'Inactive');

            let matchesLaptopStatus = true;
            if (filterLaptopStatus !== 'All') {
                const userAssets = assets.filter(a => (a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === user.id) || a.assignedTo === user.id || a.userId === user.id);
                const hasAsset = userAssets.length > 0;

                if (filterLaptopStatus === 'Has Assigned Laptop' || filterLaptopStatus === 'Has Assigned Device') {
                    matchesLaptopStatus = hasAsset;
                } else if (filterLaptopStatus === 'Uses Own Laptop') {
                    matchesLaptopStatus = user.laptopStatus === 'Uses Own Laptop' || user.laptopStatus === 'Using own laptop';
                } else if (filterLaptopStatus === 'Details Not Collected') {
                    matchesLaptopStatus = !hasAsset && user.laptopStatus === 'Details Not Collected';
                } else if (filterLaptopStatus === 'No Device Assigned' || filterLaptopStatus === 'No Laptop Assigned') {
                    matchesLaptopStatus = !hasAsset && user.laptopStatus !== 'Uses Own Laptop' && user.laptopStatus !== 'Using own laptop' && user.laptopStatus !== 'Details Not Collected';
                }
            }

            return matchesSearch && matchesCompany && matchesAccountType && matchesLaptopStatus && matchesStatus;
        });

        const [key, direction] = sortKey.split('-');
        filtered.sort((a, b) => {
            const aVal = (a as any)[key] || '';
            const bVal = (b as any)[key] || '';
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        return filtered;
    }, [users, assets, searchTerm, filterCompany, filterAccountType, filterLaptopStatus, filterStatus, sortKey]);

    const handleBackFromUser = () => {
        setSelectedUserId(null);
        if (selectedDepartmentId) navigate('departments');
    };

    if (selectedUserId) return <UserDetailView userId={selectedUserId} onBack={handleBackFromUser} />;

    const confirmMessages = {
        deactivate: `Are you sure you want to deactivate "${confirmAction?.userName}"? They will no longer be able to log in.`,
        reactivate: `Are you sure you want to reactivate "${confirmAction?.userName}"? They will be able to log in again.`,
        delete: `Are you sure you want to PERMANENTLY delete "${confirmAction?.userName}"? This cannot be undone.`,
    };

    const activeFilterCount = [filterCompany !== 'All', filterAccountType !== 'All', filterLaptopStatus !== 'All', filterStatus !== 'All'].filter(Boolean).length;

    return (
        <>
            <ConfirmationModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleConfirm}
                title={confirmAction?.type === 'delete' ? 'Permanently Delete User' : confirmAction?.type === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Reactivation'}
            >
                <div className="flex flex-col gap-4">
                    <p>{confirmAction ? confirmMessages[confirmAction.type] : ''}</p>
                    {confirmAction?.type === 'deactivate' && (
                        <label className="flex items-start gap-2 bg-canvas p-3 rounded-lg border border-line text-left cursor-pointer">
                            <input
                                type="checkbox"
                                checked={reclaimAll}
                                onChange={(e) => setReclaimAll(e.target.checked)}
                                className="mt-1 h-4 w-4 text-ink focus:ring-accent border-line rounded"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-ink">Automatically reclaim assets and licenses</span>
                                <span className="text-xs text-quiet mt-0.5">All assets will be moved to 'Under Inspection' and licenses unassigned.</span>
                            </div>
                        </label>
                    )}
                </div>
            </ConfirmationModal>

            <div>
                {/* ── Top bar: Search + View toggle + Add button ── */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-1 min-w-0">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-quiet pointer-events-none">{ICONS.search}</span>
                        <input
                            type="text"
                            placeholder="Search by name, email, department…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-surface border border-line rounded-xl w-full text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                        />
                    </div>

                    {/* Filter toggle button */}
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-strong text-on-strong border-line' : 'bg-surface  border-line  text-quiet  hover:border-line'}`}
                    >
                        {ICONS.filter}
                        <span className="hidden sm:inline">Filters</span>
                        {activeFilterCount > 0 && <span className="bg-accent text-on-strong text-[10px] font-bold px-1.5 rounded-full">{activeFilterCount}</span>}
                    </button>

                    {/* View toggle */}
                    <div className="hidden sm:flex bg-muted p-1 rounded-xl">
                        <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewMode === 'list' ? 'bg-surface  shadow-sm text-ink ' : 'text-quiet'}`}>List</button>
                        <button onClick={() => setViewMode('tree')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewMode === 'tree' ? 'bg-surface  shadow-sm text-ink ' : 'text-quiet'}`}>Tree</button>
                    </div>

                    {loggedInUser?.role === 'Admin' && (
                        <>
                            <button
                                onClick={handleSyncM365}
                                disabled={isM365Syncing}
                                className="bg-olive hover:bg-olive text-on-strong px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 flex-shrink-0 flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                                title="Synchronize all user accounts, licenses, and profile details with Microsoft 365"
                            >
                                <svg className={`w-4 h-4 ${isM365Syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="hidden sm:inline">{isM365Syncing ? 'Syncing...' : 'Sync M365'}</span>
                            </button>

                            <button
                                onClick={() => setIsHrReviewOpen(true)}
                                className="relative bg-surface text-ink border border-line px-3.5 py-2.5 rounded-xl hover:bg-surface text-sm font-semibold transition-all active:scale-95 flex-shrink-0 flex items-center gap-1.5 shadow-sm"
                                title="Review profile and department changes made by HR in Zoho People"
                            >
                                <svg className="w-4 h-4 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <span className="hidden sm:inline">HR Updates</span>
                                {pendingHrCount > 0 && (
                                    <span className="bg-olive text-on-strong text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                                        {pendingHrCount}
                                    </span>
                                )}
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-strong text-on-strong px-4 py-2.5 rounded-xl hover:bg-strong text-sm font-semibold transition-all active:scale-95 flex-shrink-0 flex items-center gap-1.5"
                    >
                        {ICONS.add} <span className="hidden sm:inline">Add User</span>
                    </button>
                </div>

                {/* ── Collapsible filter panel ── */}
                {showFilters && (
                    <div className="bg-surface border border-line rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-[10px] font-semibold text-quiet uppercase tracking-wider mb-1">Company</label>
                            <select aria-label="Company" value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent bg-surface text-ink">
                                <option value="All">All</option>
                                <option value="Avana Medical Devices">Avana Medical</option>
                                <option value="Avana Surgical Systems">Avana Surgical</option>
                                <option value="Avana Technology Services">Avana Technology</option>
                                <option value="Avana Group of Companies">Avana Group</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-quiet uppercase tracking-wider mb-1">Account Type</label>
                            <select aria-label="Account Type" value={filterAccountType} onChange={e => setFilterAccountType(e.target.value)} className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent bg-surface text-ink">
                                <option value="All">All Types</option>
                                <option value="Employee">Employees</option>
                                <option value="External Employee">External</option>
                                <option value="Shared Account">Shared</option>
                                <option value="Others">Others</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-quiet uppercase tracking-wider mb-1">Device</label>
                            <select aria-label="Device" value={filterLaptopStatus} onChange={e => setFilterLaptopStatus(e.target.value)} className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent bg-surface text-ink">
                                <option value="All">All</option>
                                <option value="Has Assigned Device">Has Device</option>
                                <option value="Details Not Collected">Details Pending</option>
                                <option value="No Device Assigned">No Device</option>
                                <option value="Uses Own Laptop">BYOD</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-quiet uppercase tracking-wider mb-1">Status / Sort</label>
                            <div className="flex gap-2">
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="flex-1 text-sm border border-line rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-accent bg-surface text-ink">
                                    <option value="All">All</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                                <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="flex-1 text-sm border border-line rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-accent bg-surface text-ink">
                                    <option value="name-asc">A→Z</option>
                                    <option value="name-desc">Z→A</option>
                                </select>
                            </div>
                        </div>
                        {activeFilterCount > 0 && (
                            <div className="col-span-2 sm:col-span-4 flex justify-end">
                                <button onClick={() => { setFilterCompany('All'); setFilterAccountType('All'); setFilterLaptopStatus('All'); setFilterStatus('All'); }} className="text-xs text-ink hover:underline">Clear filters</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Result count ── */}
                <p className="text-xs text-quiet mb-3 px-1">
                    {processedUsers.length} {processedUsers.length === 1 ? 'user' : 'users'}{searchTerm || activeFilterCount > 0 ? ' found' : ' total'}
                </p>

                {viewMode === 'list' ? (
                    <div className="space-y-2">
                        {processedUsers.length === 0 && (
                            <div className="text-center py-16 text-quiet">
                                <p className="text-base font-medium">No users found</p>
                                <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                            </div>
                        )}
                        {processedUsers.map(user => {
                            const isSelf = user.id === loggedInUser?.id;
                            const isInactive = user.status === 'Inactive';
                            const assignedAsset = assets.find(a => (a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === user.id) || a.assignedTo === user.id || a.userId === user.id);
                            const isDesk = assignedAsset?.category?.toLowerCase() === 'desktop' || assignedAsset?.assetId?.includes('-DES-');
                            const isUsingOwnLaptop = user.laptopStatus === 'Uses Own Laptop' || user.laptopStatus === 'Using own laptop';
                            const initials = user.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?';

                            return (
                                <div
                                    key={user.id}
                                    onClick={() => setSelectedUserId(user.id)}
                                    className={`bg-surface  rounded-xl border cursor-pointer group transition-all hover:border-line  hover:shadow-sm ${isInactive ? 'border-line  opacity-60' : 'border-line '}`}
                                >
                                    <div className="flex items-center gap-3 p-3 sm:p-4">
                                        {/* Avatar */}
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.name} className="h-10 w-10 rounded-full flex-shrink-0 object-cover border border-line" />
                                        ) : (
                                            <div className="h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm bg-strong text-on-strong">
                                                {initials}
                                            </div>
                                        )}

                                        {/* Main info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-sm text-ink truncate">{user.name}</p>
                                                {isSelf && <span className="text-[10px] bg-surface text-ink px-1.5 py-0.5 rounded-full font-semibold">You</span>}
                                                {user.accountType && user.accountType !== 'Employee' && (
                                                    <span className="text-[10px] bg-surface text-ink px-1.5 py-0.5 rounded-full font-semibold">{user.accountType}</span>
                                                )}
                                                {(user.azureAdId || user.m365AccountCreated) && (
                                                    <span className="text-[10px] bg-surface text-ink border border-line px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1" title="Connected with Microsoft 365">
                                                        <svg className="w-2.5 h-2.5 text-ink" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 2H2v9.5h9.5V2zm10.5 0H12.5v9.5H22V2zM11.5 12.5H2V22h9.5V12.5zm10.5 0H12.5V22H22V12.5z"/></svg>
                                                        M365
                                                    </span>
                                                )}
                                                {((user as any).zohoEmployeeId || (user as any).zohoData) && (
                                                    <span className="text-[10px] bg-surface text-ink border border-line/80 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 shadow-xs" title="Connected with Zoho People Plus (AMD & Tech)">
                                                        <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                                                            <rect x="2" y="2" width="9" height="9" rx="2" fill="#b27f0d" />
                                                            <rect x="13" y="2" width="9" height="9" rx="2" fill="#404131" />
                                                            <rect x="2" y="13" width="9" height="9" rx="2" fill="#404131" />
                                                            <rect x="13" y="13" width="9" height="9" rx="2" fill="#b27f0d" />
                                                        </svg>
                                                        <span className="font-semibold text-[9.5px]">Zoho People</span>
                                                    </span>
                                                )}
                                                {(() => {
                                                    try {
                                                        const al = JSON.parse((user as any).emailAliases || '[]');
                                                        if (Array.isArray(al) && al.length > 0) {
                                                            return (
                                                                <span className="text-[10px] bg-surface text-ink border border-line px-1.5 py-0.2 rounded-full font-mono" title={`Aliases: ${al.join(', ')}`}>
                                                                    +{al.length} alias{al.length > 1 ? 'es' : ''}
                                                                </span>
                                                            );
                                                        }
                                                    } catch (e) {}
                                                    return null;
                                                })()}
                                            </div>
                                            <p className="text-xs text-quiet truncate mt-0.5">
                                                {user.employeeId && <span className="font-medium text-quiet mr-1">[{user.employeeId}]</span>}
                                                {user.email}
                                                {user.department?.name && <span className="mx-1">·</span>}
                                                {user.department?.name}
                                            </p>
                                            {/* Device + license strip */}
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                {assignedAsset ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-surface text-ink px-2 py-0.5 rounded-full">
                                                        {isDesk ? '🖥️' : '💻'} {assignedAsset.assetId || assignedAsset.name}
                                                    </span>
                                                ) : isUsingOwnLaptop ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-surface text-ink px-2 py-0.5 rounded-full">BYOD</span>
                                                ) : user.laptopStatus === 'Details Not Collected' ? (
                                                    <span className="inline-flex items-center text-[10px] font-semibold bg-surface text-ink px-2 py-0.5 rounded-full">⚠ Details Pending</span>
                                                ) : (
                                                    <span className="inline-flex items-center text-[10px] text-quiet px-2 py-0.5 rounded-full border border-line">No Device</span>
                                                )}
                                                {user.licenseAssignments && user.licenseAssignments.length > 0 && (
                                                    <span className="text-[10px] text-quiet" title={user.licenseAssignments.map((la: any) => la.license?.name?.replace('Microsoft 365 ', '')).join(', ')}>
                                                        📧 {user.licenseAssignments.length} {user.licenseAssignments.length === 1 ? 'License' : 'Licenses'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: role + status + actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                                            <div className="hidden sm:flex flex-col items-end gap-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${user.role === 'Admin' ? 'bg-surface text-ink  ' : user.role === 'Manager' ? 'bg-surface/60 text-quiet  ' : 'bg-muted text-quiet  '}`}>
                                                    {user.role}
                                                </span>
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isInactive ? 'bg-muted text-quiet  ' : 'bg-surface text-ink  '}`}>
                                                    {isInactive ? 'Inactive' : 'Active'}
                                                </span>
                                            </div>
                                            <UserActionMenu
                                                user={user}
                                                isSelf={isSelf}
                                                isInactive={isInactive}
                                                isAdmin={loggedInUser?.role === 'Admin'}
                                                onEdit={() => handleOpenModal(user)}
                                                onDeactivate={() => setConfirmAction({ type: 'deactivate', userId: user.id, userName: user.name })}
                                                onReactivate={() => setConfirmAction({ type: 'reactivate', userId: user.id, userName: user.name })}
                                                onDelete={() => setConfirmAction({ type: 'delete', userId: user.id, userName: user.name })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <UserHierarchy
                        users={users}
                        searchTerm={searchTerm}
                        filterCompany={filterCompany}
                        filterAccountType={filterAccountType}
                        onSelectUser={setSelectedUserId}
                        loggedInUserId={loggedInUser?.id}
                    />
                )}

                <UserForm isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveUser} user={editingUser} isLoading={isLoading} />

                {isOnboardingWizardOpen && (
                    <OnboardingWizardModal
                        isOpen={isOnboardingWizardOpen}
                        onClose={() => {
                            setIsOnboardingWizardOpen(false);
                            setWizardUser(null);
                        }}
                        initialUser={wizardUser}
                        onSuccess={(updatedUser) => {
                            setUsers(users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
                        }}
                    />
                )}

                <HrReviewModal
                    isOpen={isHrReviewOpen}
                    onClose={() => {
                        setIsHrReviewOpen(false);
                        fetchPendingHrCount();
                    }}
                    apiUrl={API_URL}
                    getHeaders={getHeaders}
                    onChangesApplied={() => {
                        fetchAllData();
                        fetchPendingHrCount();
                    }}
                />
            </div>
        </>
    );
};

export default UserManagement;
