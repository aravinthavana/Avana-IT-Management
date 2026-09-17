import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import ConfirmationModal from '../ui/ConfirmationModal';
import UserForm from './UserForm';
import UserDetailView from './UserDetailView';
import UserHierarchy from './UserHierarchy';
import OnboardingWizardModal from '../onboarding/OnboardingWizardModal';
import { User } from '../../types';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

interface UserManagementProps {
    initialFilters: any[] | null;
    onFiltersApplied: () => void;
}

// Kebab (⋯) action menu for each user row
const UserActionMenu: React.FC<{
    user: User;
    isSelf: boolean;
    isInactive: boolean;
    onEdit: () => void;
    onDeactivate: () => void;
    onReactivate: () => void;
    onDelete: () => void;
}> = ({ user, isSelf, isInactive, onEdit, onDeactivate, onReactivate, onDelete }) => {
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
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Actions"
            >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            {open && (
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-10 py-1 text-sm">
                    <button onClick={() => { onEdit(); setOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        {ICONS.edit} Edit
                    </button>
                    {!isSelf && !isInactive && (
                        <button onClick={() => { onDeactivate(); setOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            Deactivate
                        </button>
                    )}
                    {!isSelf && isInactive && (
                        <button onClick={() => { onReactivate(); setOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-green-700 dark:text-green-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Reactivate
                        </button>
                    )}
                    {!isSelf && (
                        <button onClick={() => { onDelete(); setOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400 border-t border-slate-100 dark:border-slate-700 mt-1">
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
                        <label className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-left cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={reclaimAll} 
                                onChange={(e) => setReclaimAll(e.target.checked)}
                                className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Automatically reclaim assets and licenses</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">All assets will be moved to 'Under Inspection' and licenses unassigned.</span>
                            </div>
                        </label>
                    )}
                </div>
            </ConfirmationModal>

            <div>
                {/* ── Top bar: Search + View toggle + Add button ── */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-1 min-w-0">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">{ICONS.search}</span>
                        <input
                            type="text"
                            placeholder="Search by name, email, department…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl w-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                    </div>

                    {/* Filter toggle button */}
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-avana-dark text-white border-avana-dark' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}
                    >
                        {ICONS.filter}
                        <span className="hidden sm:inline">Filters</span>
                        {activeFilterCount > 0 && <span className="bg-brand-500 text-white text-[10px] font-bold px-1.5 rounded-full">{activeFilterCount}</span>}
                    </button>

                    {/* View toggle */}
                    <div className="hidden sm:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>List</button>
                        <button onClick={() => setViewMode('tree')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewMode === 'tree' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>Tree</button>
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-avana-dark text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 text-sm font-semibold transition-all active:scale-95 flex-shrink-0 flex items-center gap-1.5"
                    >
                        {ICONS.add} <span className="hidden sm:inline">Add User</span>
                    </button>
                </div>

                {/* ── Collapsible filter panel ── */}
                {showFilters && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Company</label>
                            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                <option value="All">All</option>
                                <option value="Avana Medical Devices">Avana Medical</option>
                                <option value="Avana Surgical Systems">Avana Surgical</option>
                                <option value="Avana Technology Services">Avana Technology</option>
                                <option value="Avana Group of Companies">Avana Group</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Account Type</label>
                            <select value={filterAccountType} onChange={e => setFilterAccountType(e.target.value)} className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                <option value="All">All Types</option>
                                <option value="Employee">Employees</option>
                                <option value="External Employee">External</option>
                                <option value="Shared Account">Shared</option>
                                <option value="Others">Others</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Device</label>
                            <select value={filterLaptopStatus} onChange={e => setFilterLaptopStatus(e.target.value)} className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                <option value="All">All</option>
                                <option value="Has Assigned Device">Has Device</option>
                                <option value="Details Not Collected">Details Pending</option>
                                <option value="No Device Assigned">No Device</option>
                                <option value="Uses Own Laptop">BYOD</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Status / Sort</label>
                            <div className="flex gap-2">
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                    <option value="All">All</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                                <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                    <option value="name-asc">A→Z</option>
                                    <option value="name-desc">Z→A</option>
                                </select>
                            </div>
                        </div>
                        {activeFilterCount > 0 && (
                            <div className="col-span-2 sm:col-span-4 flex justify-end">
                                <button onClick={() => { setFilterCompany('All'); setFilterAccountType('All'); setFilterLaptopStatus('All'); setFilterStatus('All'); }} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Clear filters</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Result count ── */}
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 px-1">
                    {processedUsers.length} {processedUsers.length === 1 ? 'user' : 'users'}{searchTerm || activeFilterCount > 0 ? ' found' : ' total'}
                </p>

                {viewMode === 'list' ? (
                    <div className="space-y-2">
                        {processedUsers.length === 0 && (
                            <div className="text-center py-16 text-slate-400 dark:text-slate-500">
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
                                    className={`bg-white dark:bg-slate-900 rounded-xl border cursor-pointer group transition-all hover:border-avana-gray dark:hover:border-slate-600 hover:shadow-sm ${isInactive ? 'border-slate-100 dark:border-slate-800 opacity-60' : 'border-slate-200 dark:border-slate-800'}`}
                                >
                                    <div className="flex items-center gap-3 p-3 sm:p-4">
                                        {/* Avatar */}
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.name} className="h-10 w-10 rounded-full flex-shrink-0 object-cover border border-slate-200 dark:border-slate-700" />
                                        ) : (
                                            <div className="h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm bg-avana-dark text-white">
                                                {initials}
                                            </div>
                                        )}

                                        {/* Main info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                                                {isSelf && <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-semibold">You</span>}
                                                {user.accountType && user.accountType !== 'Employee' && (
                                                    <span className="text-[10px] bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300 px-1.5 py-0.5 rounded-full font-semibold">{user.accountType}</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                {user.employeeId && <span className="font-medium text-slate-600 dark:text-slate-300 mr-1">[{user.employeeId}]</span>}
                                                {user.email}
                                                {user.department?.name && <span className="mx-1">·</span>}
                                                {user.department?.name}
                                            </p>
                                            {/* Device + license strip */}
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                {assignedAsset ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                                                        {isDesk ? '🖥️' : '💻'} {assignedAsset.assetId || assignedAsset.name}
                                                    </span>
                                                ) : isUsingOwnLaptop ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">BYOD</span>
                                                ) : user.laptopStatus === 'Details Not Collected' ? (
                                                    <span className="inline-flex items-center text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">⚠ Details Pending</span>
                                                ) : (
                                                    <span className="inline-flex items-center text-[10px] text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">No Device</span>
                                                )}
                                                {user.licenseAssignments && user.licenseAssignments.length > 0 && (
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400" title={user.licenseAssignments.map((la: any) => la.license?.name?.replace('Microsoft 365 ', '')).join(', ')}>
                                                        📧 {user.licenseAssignments.length} {user.licenseAssignments.length === 1 ? 'License' : 'Licenses'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: role + status + actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                                            <div className="hidden sm:flex flex-col items-end gap-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${user.role === 'Admin' ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300' : user.role === 'Manager' ? 'bg-avana-beige/60 text-avana-olive dark:bg-slate-700 dark:text-avana-beige' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                    {user.role}
                                                </span>
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isInactive ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                                                    {isInactive ? 'Inactive' : 'Active'}
                                                </span>
                                            </div>
                                            <UserActionMenu
                                                user={user}
                                                isSelf={isSelf}
                                                isInactive={isInactive}
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
            </div>
        </>
    );
};

export default UserManagement;
