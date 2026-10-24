import { API_URL } from '../../utils/apiClient';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { Asset, User, UserAccessory } from '../../types';
import { ICONS } from '../../constants';
import AssignAssetModal from './AssignAssetModal';
import UnassignAssetModal from './UnassignAssetModal';
import OnboardingWizardModal from '../onboarding/OnboardingWizardModal';
import OffboardingWizardModal from '../onboarding/OffboardingWizardModal';
import IssueAccessoryModal from '../accessories/IssueAccessoryModal';

interface UserDetailViewProps {
    userId: number;
    onBack: () => void;
}


const UserDetailView: React.FC<UserDetailViewProps> = ({ userId, onBack }) => {
    const { users, setUsers, assets, setAssets, setNotification, setSelectedAssetId, setPreviewTarget, getHeaders, fetchAssetHistory } = useAppContext();
    const user = users.find(u => u.id === userId);
    const userAssets = assets.filter(a => (a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === userId) || a.assignedTo === userId);
    const hasAssignedDevice = userAssets.length > 0;
    const isUsingOwnLaptop = user ? (user.laptopStatus === 'Uses Own Laptop' || user.laptopStatus === 'Using own laptop') : false;
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assetToUnassign, setAssetToUnassign] = useState<Asset | null>(null);
    const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
    const [isOffboardingModalOpen, setIsOffboardingModalOpen] = useState(false);
    const [userAssetHistory, setUserAssetHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [accessories, setAccessories] = useState<UserAccessory[]>([]);
    const [isLoadingAccessories, setIsLoadingAccessories] = useState(false);
    const [isIssueAccessoryModalOpen, setIsIssueAccessoryModalOpen] = useState(false);

    const fetchUserAccessories = async () => {
        setIsLoadingAccessories(true);
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}/accessories`, {
                headers: getHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setAccessories(data);
            }
        } catch (err) {
            console.error('Failed to load user accessories', err);
        } finally {
            setIsLoadingAccessories(false);
        }
    };

    const [returnAccessoryState, setReturnAccessoryState] = useState<{
        accId: number;
        condition: string;
        notes: string;
        submitting: boolean;
    } | null>(null);

    const handleReturnAccessory = (accId: number) => {
        setReturnAccessoryState({ accId, condition: 'Good', notes: '', submitting: false });
    };

    const handleConfirmReturn = async () => {
        if (!returnAccessoryState) return;
        setReturnAccessoryState(prev => prev ? { ...prev, submitting: true } : null);
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}/accessories/${returnAccessoryState.accId}`, {
                method: 'PUT',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    status: 'Returned',
                    condition: returnAccessoryState.condition,
                    notes: returnAccessoryState.notes || undefined
                })
            });
            if (!res.ok) throw new Error('Failed to return accessory');
            setNotification({ message: 'Accessory returned to IT inventory.', type: 'success' });
            fetchUserAccessories();
            setReturnAccessoryState(null);
        } catch (err: any) {
            setNotification({ message: err.message || 'Error returning accessory', type: 'error' });
            setReturnAccessoryState(prev => prev ? { ...prev, submitting: false } : null);
        }
    };

    const handleDeleteAccessory = async (accId: number) => {
        if (!confirm('Remove this accessory record from the user profile?')) return;
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}/accessories/${accId}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Failed to remove accessory');
            setNotification({ message: 'Accessory record removed.', type: 'success' });
            fetchUserAccessories();
        } catch (err: any) {
            setNotification({ message: err.message || 'Error deleting accessory', type: 'error' });
        }
    };

    const fetchUserAssetHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}/asset-history`, {
                headers: getHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setUserAssetHistory(data.history || []);
            }
        } catch (err) {
            console.error('Failed to load user asset history', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchUserAssetHistory();
            fetchUserAccessories();
        }
    }, [userId]);


    if (!user) {
        if (users.length === 0) {
            return (
                <div className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400">
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mr-3 border-brand-500"></div>
                    <span className="font-body text-sm">Loading user details...</span>
                </div>
            );
        }
        return (
            <div className="text-center p-8 rounded-xl shadow-sm border max-w-md mx-auto my-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold font-heading text-slate-800 dark:text-slate-100">User Not Found</h2>
                <p className="text-sm mt-2 font-body text-slate-500 dark:text-slate-400">The requested user could not be located.</p>
                <button onClick={onBack} className="mt-5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700">&larr; Back to Users</button>
            </div>
        );
    }

    const handleAssignAsset = async (assetToAssign: Asset, condition: string) => {
        try {
            const res = await fetch(`${API_URL}/api/assets/${assetToAssign.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...assetToAssign,
                    assigneeId: user.id,
                    assigneeType: 'User',
                    status: 'Assigned',
                    location: user.location,
                    condition,
                    specs: assetToAssign.specs ? (typeof assetToAssign.specs === 'string' ? assetToAssign.specs : JSON.stringify(assetToAssign.specs)) : null
                })
            });
            if (!res.ok) throw new Error('Failed to assign asset');
            const updated = await res.json();
            setAssets(prevAssets => prevAssets.map(asset =>
                asset.id === assetToAssign.id ? { ...updated, specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : updated.specs } : asset
            ));
            fetchAssetHistory();
            fetchUserAssetHistory();
            setNotification({ message: `Successfully assigned ${assetToAssign.name} to ${user.name}.`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
        setIsAssignModalOpen(false);
    };

    const handleConfirmUnassign = async (updatedAssetData: { status: string, remarks: string, condition: string }) => {
        if (!assetToUnassign) return;

        try {
            const res = await fetch(`${API_URL}/api/assets/${assetToUnassign.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...assetToUnassign,
                    assigneeId: null,
                    assigneeType: null,
                    status: updatedAssetData.status,
                    remarks: updatedAssetData.remarks,
                    condition: updatedAssetData.condition,
                    specs: assetToUnassign.specs ? JSON.stringify(assetToUnassign.specs) : null
                })
            });
            if (!res.ok) throw new Error('Failed to unassign asset');
            const updated = await res.json();
            setAssets(prevAssets => prevAssets.map(asset =>
                asset.id === assetToUnassign.id ? { ...updated, specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : updated.specs } : asset
            ));
            fetchAssetHistory();
            fetchUserAssetHistory();
            setNotification({ message: `Successfully unassigned ${assetToUnassign.name}.`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
        setAssetToUnassign(null);
    };

    return (
        <>
            {user && <AssignAssetModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} onAssign={handleAssignAsset} target={{ id: user.id, name: user.name, type: 'user', company: user.company }} />}
            <UnassignAssetModal
                isOpen={!!assetToUnassign}
                onClose={() => setAssetToUnassign(null)}
                onConfirm={handleConfirmUnassign}
                asset={assetToUnassign}
            />
            {user && (
                <IssueAccessoryModal
                    isOpen={isIssueAccessoryModalOpen}
                    onClose={() => setIsIssueAccessoryModalOpen(false)}
                    user={user}
                    onIssued={fetchUserAccessories}
                />
            )}

            {/* Return Accessory Confirmation Modal */}
            {returnAccessoryState && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/50">
                    <div className="rounded-2xl shadow-2xl border p-6 w-full max-w-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <h3 className="text-base font-bold mb-1 text-slate-900 dark:text-white">Return Accessory to IT Stock</h3>
                        <p className="text-xs mb-4 text-slate-500 dark:text-slate-400">
                            This will mark the accessory as returned and restore 1 unit to the batch stock.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">Return Condition</label>
                                <select aria-label="Return Condition"
                                    value={returnAccessoryState.condition}
                                    onChange={e => setReturnAccessoryState(prev => prev ? { ...prev, condition: e.target.value } : null)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-brand-500"
                                >
                                    <option>Good</option>
                                    <option>Fair</option>
                                    <option>Defective / Damaged</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">Notes (optional)</label>
                                <textarea aria-label="Notes (optional)"
                                    rows={2}
                                    value={returnAccessoryState.notes}
                                    onChange={e => setReturnAccessoryState(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                    placeholder="Any damage, missing parts, reason for return…"
                                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 resize-none border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-brand-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setReturnAccessoryState(null)}
                                disabled={returnAccessoryState.submitting}
                                className="flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmReturn}
                                disabled={returnAccessoryState.submitting}
                                className="flex-1 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-60 bg-amber-500 hover:bg-amber-600 text-white"
                            >
                                {returnAccessoryState.submitting ? 'Returning…' : 'Confirm Return'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky Header */}
            <div className="sticky top-16 backdrop-blur-sm z-10 -mx-4 sm:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b bg-slate-100/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onBack} className="px-2 sm:px-3 py-1.5 rounded-lg flex items-center text-sm transition-colors flex-shrink-0 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">
                            &larr; <span className="hidden sm:inline ml-2 font-medium">Back</span>
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold truncate text-slate-800 dark:text-slate-100" title={user.name}>{user.name}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">ID: {user.employeeId}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsAssignModalOpen(true)} className="px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors flex-shrink-0 bg-brand-600 text-white hover:bg-brand-700">
                        {ICONS.add}
                        <span className="hidden sm:inline">Assign Asset</span>
                    </button>
                </div>
            </div>

            <div className="space-y-6 pt-6">
                {/* Minimalist Profile Card */}
                <div className="rounded-2xl p-6 border shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    {/* Header with Avatar & Primary Info */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b text-center sm:text-left border-slate-100 dark:border-slate-800">
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-2xl border shadow-sm flex-shrink-0 object-cover border-slate-200 dark:border-slate-700"/>
                        ) : (
                            <div className="w-20 h-20 rounded-2xl shadow-sm flex-shrink-0 flex items-center justify-center font-bold text-2xl bg-avana-dark text-white">
                                {user.name?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{user.name}</h2>
                                {user.accountType && user.accountType !== 'Employee' && (
                                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
                                        {user.accountType}
                                    </span>
                                )}
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${user.role === 'Admin' ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300' : user.role === 'Manager' ? 'bg-avana-beige/60 text-avana-olive dark:bg-slate-800 dark:text-avana-beige' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                    {user.role || 'User'}
                                </span>
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${user.status === 'Active' || !user.status ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                    {user.status || 'Active'}
                                </span>
                            </div>
                            <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                                {user.jobTitle || 'Employee'} {user.department?.name ? `• ${user.department.name}` : ''} {user.company ? `• ${user.company}` : ''}
                            </p>
                        </div>
                    </div>

                    {/* Responsive Grid of Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-6">
                        <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800">
                            <span className="font-subheading text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-slate-400">Email</span>
                            <span className="text-sm font-semibold truncate block text-slate-800 dark:text-slate-200" title={user.email}>{user.email || 'N/A'}</span>
                        </div>
                        <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800">
                            <span className="font-subheading text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-slate-400">Employee ID</span>
                            <span className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{user.employeeId || 'N/A'}</span>
                        </div>
                        <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800">
                            <span className="font-subheading text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-slate-400">Mobile</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.mobile || 'N/A'}</span>
                        </div>
                        <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800">
                            <span className="font-subheading text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-slate-400">Official Branch</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.branch?.name || 'Remote / Unassigned'}</span>
                        </div>
                        <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800">
                            <span className="font-subheading text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-slate-400">Work Location</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.location || 'N/A'}</span>
                        </div>
                        <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800">
                            <span className="font-subheading text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-slate-400">Reporting Manager</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.manager?.name || 'N/A'}</span>
                        </div>
                        <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800">
                            <span className="font-subheading text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-slate-400">Device Status</span>
                            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-semibold mt-0.5 ${
                                hasAssignedDevice ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                                isUsingOwnLaptop ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                user.laptopStatus === 'Details Not Collected' ? 'border bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700' :
                                'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                                {hasAssignedDevice
                                    ? `${userAssets[0]?.name || 'Device'} (${userAssets[0]?.assetId || ''})`
                                    : isUsingOwnLaptop
                                    ? 'Uses Own Laptop (BYOD)'
                                    : user.laptopStatus === 'Details Not Collected'
                                    ? 'Details Pending'
                                    : 'No Device Assigned'}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800">
                            <span className="font-subheading text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-slate-400">Licenses</span>
                            <span className="text-sm font-semibold truncate block text-slate-800 dark:text-slate-200" title={user.licenseAssignments && user.licenseAssignments.length > 0 ? user.licenseAssignments.map((la: any) => la.license?.name).join(', ') : 'None'}>
                                {user.licenseAssignments && user.licenseAssignments.length > 0 ? `${user.licenseAssignments.length} License(s)` : 'None'}
                            </span>
                        </div>
                        {(user.workAddress || user.city || user.state || user.postalCode || user.country) && (
                            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800">
                                <span className="font-subheading text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-slate-400">Work Location Address</span>
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    {[user.workAddress, user.city, user.state, user.postalCode, user.country].filter(Boolean).join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 1. Onboarding Checklist Card */}
                <div className="p-6 rounded-xl shadow-md border space-y-4 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2.5">
                            <span className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400">
                                {ICONS.onboarding}
                            </span>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Employee Onboarding Checklist</h3>
                                <p className="text-xs text-slate-500">Equipment allocation, M365 provisioning & dispatch tracking</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                user.onboardingStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                user.onboardingStatus === 'In Progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}>
                                {user.onboardingStatus || 'Pending Onboarding'}
                            </span>
                            <button
                                onClick={() => setIsOnboardingModalOpen(true)}
                                className="px-3 py-1 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white"
                            >
                                ⚡ Launch Onboarding Wizard
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.m365AccountCreated ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                            }`}>
                                {user.m365AccountCreated ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">M365 Account Created</p>
                                <p className="text-xs text-slate-500">
                                    {user.m365AccountCreated ? 'Provisioned in Microsoft 365 / Entra ID' : 'Account not created'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.m365LicenseAssigned ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                            }`}>
                                {user.m365LicenseAssigned ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">M365 License Allocated</p>
                                <p className="text-xs text-slate-500">
                                    {user.m365LicenseAssigned ? 'Active subscription seat linked' : 'No license allocated / not required'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                hasAssignedDevice ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                                isUsingOwnLaptop ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
                                'bg-slate-200 dark:bg-slate-700 text-slate-400'
                            }`}>
                                {hasAssignedDevice || isUsingOwnLaptop ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Hardware Allocation</p>
                                <p className="text-xs text-slate-500">
                                    {hasAssignedDevice ? `${userAssets[0]?.name || 'Device'} (${userAssets[0]?.assetId || ''}) Assigned` :
                                     isUsingOwnLaptop ? 'Uses Own Laptop (BYOD)' :
                                     'No Device Assigned'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                hasAssignedDevice
                                    ? (user.softwareInstalled ? 'text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'text-xs bg-slate-200 dark:bg-slate-700 text-slate-400')
                                    : 'text-[10px] bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                            }`}>
                                {hasAssignedDevice ? (user.softwareInstalled ? '✓' : '—') : 'N/A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Software & Antivirus Installed</p>
                                <p className="text-xs text-slate-500">
                                    {hasAssignedDevice
                                        ? (user.softwareInstalled ? 'Defender, Office 365, Teams, VPN configured' : 'Pending installation')
                                        : isUsingOwnLaptop
                                        ? 'Not Applicable (Personal Device / BYOD)'
                                        : user.laptopStatus === 'Details Not Collected'
                                        ? 'Pending device details collection'
                                        : 'Not Applicable (No device assigned)'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                hasAssignedDevice
                                    ? (user.hardwareTested ? 'text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'text-xs bg-slate-200 dark:bg-slate-700 text-slate-400')
                                    : 'text-[10px] bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                            }`}>
                                {hasAssignedDevice ? (user.hardwareTested ? '✓' : '—') : 'N/A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Hardware QA Diagnostics</p>
                                <p className="text-xs text-slate-500">
                                    {hasAssignedDevice
                                        ? (user.hardwareTested ? 'Display, keyboard, battery, camera/mic verified' : 'Diagnostic check pending')
                                        : isUsingOwnLaptop
                                        ? 'Not Applicable (Personal Hardware)'
                                        : user.laptopStatus === 'Details Not Collected'
                                        ? 'Pending device details collection'
                                        : 'Not Applicable (No device assigned)'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                (hasAssignedDevice || user.m365AccountCreated)
                                    ? (user.credentialsHandedOver ? 'text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'text-xs bg-slate-200 dark:bg-slate-700 text-slate-400')
                                    : 'text-[10px] bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                            }`}>
                                {(hasAssignedDevice || user.m365AccountCreated) ? (user.credentialsHandedOver ? '✓' : '—') : 'N/A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Credentials Handed Over</p>
                                <p className="text-xs text-slate-500">
                                    {hasAssignedDevice
                                        ? (user.credentialsHandedOver ? 'Laptop PIN & login guidance shared' : 'Pending credential handover')
                                        : user.m365AccountCreated
                                        ? (user.credentialsHandedOver ? 'M365 cloud credentials shared' : 'Pending M365 credential sharing')
                                        : 'Not Applicable (No accounts or devices)'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Dispatch & Docket Info (if available) */}
                    {user.dispatchDetails && (() => {
                        try {
                            const d = typeof user.dispatchDetails === 'string' ? JSON.parse(user.dispatchDetails) : user.dispatchDetails;
                            return (
                                <div className="p-3.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700">
                                    <div className="space-y-0.5">
                                        <span className="font-semibold flex items-center gap-1 text-brand-600 dark:text-brand-400">
                                            {ICONS.truck} {d.mode === 'Courier' ? `Dispatched via ${d.courierName || 'Courier'}` : `Handover: ${d.mode || 'In-Person'}`}
                                        </span>
                                        {d.dcNumber && <p className="font-mono text-slate-700 dark:text-slate-300">Delivery Challan (DC): <strong>{d.dcNumber}</strong></p>}
                                        {d.docketNumber && <p className="font-mono text-slate-700 dark:text-slate-300">Docket / Tracking: <strong>{d.docketNumber}</strong></p>}
                                        {d.shippingAddress && <p className="truncate max-w-md text-slate-500">Address: {d.shippingAddress}</p>}
                                    </div>
                                    <div className="text-right text-slate-400">
                                        {d.dispatchDate && <p>Date: {d.dispatchDate}</p>}
                                        {user.onboardingCompletedDate && <p>Completed: {new Date(user.onboardingCompletedDate).toLocaleDateString()}</p>}
                                    </div>
                                </div>
                            );
                        } catch { return null; }
                    })()}
                </div>

                {/* 2. Offboarding Checklist Card */}
                <div className="p-6 rounded-xl shadow-md border space-y-4 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2.5">
                            <span className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                                {ICONS.offboarding}
                            </span>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Employee Offboarding Checklist</h3>
                                <p className="text-xs text-slate-500">Asset return, data sanitization, license release & account exit clearance</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                user.status === 'Inactive' || user.offboardingStatus === 'Completed' ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                                'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            }`}>
                                {user.status === 'Inactive' ? 'Account Inactive' : 'Active Employee'}
                            </span>
                            <button
                                onClick={() => setIsOffboardingModalOpen(true)}
                                className="px-3 py-1 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                                ⚡ Launch Offboarding Wizard
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                user.assetReturned
                                    ? 'text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                    : hasAssignedDevice
                                    ? 'text-xs bg-slate-200 dark:bg-slate-700 text-slate-400'
                                    : 'text-[10px] bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                            }`}>
                                {user.assetReturned ? '✓' : hasAssignedDevice ? '—' : 'N/A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Company Hardware Returned</p>
                                <p className="text-xs text-slate-500">
                                    {user.assetReturned
                                        ? (user.assetReturnCondition ? `Condition: ${user.assetReturnCondition}` : 'Hardware received')
                                        : hasAssignedDevice
                                        ? 'Pending equipment return'
                                        : 'Not Applicable (No company hardware assigned)'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                user.deviceWiped
                                    ? 'text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                    : hasAssignedDevice
                                    ? 'text-xs bg-slate-200 dark:bg-slate-700 text-slate-400'
                                    : 'text-[10px] bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                            }`}>
                                {user.deviceWiped ? '✓' : hasAssignedDevice ? '—' : 'N/A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Device Wiped & Sanitized</p>
                                <p className="text-xs text-slate-500">
                                    {user.deviceWiped
                                        ? 'Factory reset completed, BitLocker erased'
                                        : hasAssignedDevice
                                        ? 'Pending sanitization'
                                        : 'Not Applicable (No company device to wipe)'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.dataBackedUp ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                            }`}>
                                {user.dataBackedUp ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">User Data Backed Up</p>
                                <p className="text-xs text-slate-500">
                                    {user.dataBackedUp ? 'Synced to OneDrive / handed over to manager' : 'Data not backed up'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.m365LicenseRevoked ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                            }`}>
                                {user.m365LicenseRevoked ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Subscriptions Revoked</p>
                                <p className="text-xs text-slate-500">
                                    {user.m365LicenseRevoked ? 'Seats released back to available pool' : 'Subscriptions active'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.m365AccountDisabled ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                            }`}>
                                {user.m365AccountDisabled ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">M365 Account Disabled</p>
                                <p className="text-xs text-slate-500">
                                    {user.m365AccountDisabled ? 'Sign-in blocked & cloud sessions revoked' : 'Active M365 account'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.status === 'Inactive' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                            }`}>
                                {user.status === 'Inactive' ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Portal Account Deactivated</p>
                                <p className="text-xs text-slate-500">
                                    {user.status === 'Inactive' ? 'Account status set to Inactive' : 'Active user status'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Return Docket Info (if available) */}
                    {user.assetReturnDocket && (() => {
                        try {
                            const rd = typeof user.assetReturnDocket === 'string' ? JSON.parse(user.assetReturnDocket) : user.assetReturnDocket;
                            return (
                                <div className="p-3.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/40">
                                    <div className="space-y-0.5">
                                        <span className="font-semibold flex items-center gap-1 text-red-700 dark:text-red-400">
                                            {ICONS.truck} {rd.mode === 'Courier' ? `Returned via ${rd.courier || 'Courier'}` : 'In-Person Return'}
                                        </span>
                                        {rd.docketNo && <p className="font-mono text-slate-700 dark:text-slate-300">Return Docket: <strong>{rd.docketNo}</strong></p>}
                                        {user.assetReturnRemarks && <p className="truncate max-w-md text-slate-500">Remarks: {user.assetReturnRemarks}</p>}
                                    </div>
                                    <div className="text-right text-slate-400">
                                        {rd.returnDate && <p>Date: {new Date(rd.returnDate).toLocaleDateString()}</p>}
                                        {user.offboardingCompletedDate && <p>Completed: {new Date(user.offboardingCompletedDate).toLocaleDateString()}</p>}
                                    </div>
                                </div>
                            );
                        } catch { return null; }
                    })()}
                </div>
                <div className="p-6 rounded-lg shadow-md bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Assigned Assets ({userAssets.length})</h3>
                    </div>

                    <div className="space-y-3">
                        {userAssets.length > 0 ? (
                            userAssets.map(asset => (
                                <div key={asset.id} className="p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50">
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate text-slate-800 dark:text-slate-100">{asset.name}</p>
                                        <p className="text-sm flex flex-wrap items-center gap-x-2 text-slate-500 dark:text-slate-400">
                                            <span className="font-mono">{asset.assetId}</span>
                                            <span className="hidden sm:inline">&bull;</span>
                                            <span className="font-mono">S/N: {asset.serialNumber}</span>
                                            {asset.status === 'Pending Handover' && (
                                                <>
                                                    <span className="hidden sm:inline">&bull;</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                                        ⚠️ Pending Acknowledgment
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 flex-shrink-0 self-start sm:self-center">
                                        <button onClick={() => setSelectedAssetId(asset.id)} className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">View</button>
                                        {(asset.category === 'Laptop' || asset.category === 'Desktop' || asset.assetId?.includes('-LAP-') || asset.assetId?.includes('-DES-')) && (
                                            <button onClick={() => setPreviewTarget({ type: 'declaration', assetId: asset.id, userId: user.id })} className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600" title="View / Print Declaration Form">Form</button>
                                        )}
                                        <button onClick={() => setAssetToUnassign(asset)} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-500" title="Unassign Asset">
                                            {ICONS.unassign}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center py-4 text-gray-500 dark:text-gray-400">No assets are currently assigned to this user.</p>
                        )}
                    </div>
                </div>

                {/* Assigned Peripherals & Accessories (No Asset IDs, Tracked by Batch & Warranty) */}
                <div className="p-6 rounded-lg shadow-md border space-y-4 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🖱️</span>
                                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                                    Assigned Peripherals &amp; Accessories ({accessories.filter(a => a.status === 'Assigned').length})
                                </h3>
                            </div>
                            <p className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">
                                Low-cost peripherals (mouse, keyboard, headset, etc.) tracked with purchase warranty without generating individual Asset IDs
                            </p>
                        </div>
                        <button
                            onClick={() => setIsIssueAccessoryModalOpen(true)}
                            className="px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 self-start sm:self-auto bg-brand-600 text-white hover:bg-brand-700"
                        >
                            {ICONS.add} Issue Accessory
                        </button>
                    </div>

                    <div className="space-y-3">
                        {isLoadingAccessories ? (
                            <p className="text-xs text-center py-6 text-slate-400">Loading peripherals checklist...</p>
                        ) : accessories.length > 0 ? (
                            accessories.map(acc => {
                                const isAssigned = acc.status === 'Assigned';
                                const categoryIcon =
                                    acc.category === 'Mouse' ? '🖱️' :
                                    acc.category === 'Keyboard' ? '⌨️' :
                                    acc.category === 'Headset' ? '🎧' :
                                    acc.category === 'Monitor' ? '🖥️' :
                                    acc.category === 'Pen Drive' ? '💾' :
                                    acc.category === 'Dock' ? '🔌' :
                                    acc.category === 'Bag' ? '🎒' : '📦';

                                // Warranty computation
                                const now = new Date();
                                const warrantyEnd = acc.warrantyEndDate ? new Date(acc.warrantyEndDate) : null;
                                const diffDays = warrantyEnd ? Math.ceil((warrantyEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

                                return (
                                    <div
                                        key={acc.id}
                                        className={`p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition-all ${
                                            isAssigned
                                                ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-700/60'
                                                : 'border-dashed opacity-60 bg-slate-100/50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                                {categoryIcon}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-bold truncate text-slate-900 dark:text-white">
                                                        {acc.name}
                                                    </h4>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                        {acc.category}
                                                    </span>
                                                    {!isAssigned && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                                            Returned
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2.5 mt-1 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                                                    {acc.brand && <span>Brand: <strong>{acc.brand}</strong></span>}
                                                    {acc.serialNumber && <span className="font-mono">S/N: {acc.serialNumber}</span>}
                                                    {acc.condition && <span>Condition: <strong>{acc.condition}</strong></span>}
                                                    <span>Issued: {new Date(acc.assignedAt).toLocaleDateString()}</span>
                                                </div>

                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    {/* Warranty Status Badge */}
                                                    {warrantyEnd ? (
                                                        diffDays !== null && diffDays < 0 ? (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800">
                                                                🛡️ Warranty Expired ({warrantyEnd.toLocaleDateString()})
                                                            </span>
                                                        ) : diffDays !== null && diffDays <= 30 ? (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                                                                🛡️ Warranty Expiring in {diffDays}d ({warrantyEnd.toLocaleDateString()})
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                                                🛡️ Under Warranty (Until {warrantyEnd.toLocaleDateString()})
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                            Self-Declared / Invoice Not Linked
                                                        </span>
                                                    )}

                                                    {/* Batch Link Info */}
                                                    {acc.batch && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                                            📦 Stock Batch: {acc.batch.name} {acc.batch.invoiceNumber ? `(#${acc.batch.invoiceNumber})` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 shrink-0 self-end sm:self-center">
                                            {isAssigned && (
                                                <button
                                                    onClick={() => handleReturnAccessory(acc.id)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-amber-200 dark:border-amber-800"
                                                    title="Mark accessory as returned to IT inventory"
                                                >
                                                    Return to Stock
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeleteAccessory(acc.id)}
                                                className="p-1.5 rounded-lg transition-all text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="Remove accessory from profile"
                                            >
                                                {ICONS.delete}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-6 text-center space-y-2 border border-dashed rounded-xl text-slate-400 border-slate-200 dark:border-slate-700">
                                <p className="text-2xl">🖱️</p>
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No accessories recorded for this employee yet</p>
                                <p className="text-xs max-w-sm mx-auto text-slate-400">
                                    Issue a mouse, keyboard, or headset from your stock batches to track warranty coverage without generating individual Asset IDs.
                                </p>
                                <button
                                    onClick={() => setIsIssueAccessoryModalOpen(true)}
                                    className="mt-2 text-xs font-bold hover:underline inline-block text-brand-600"
                                >
                                    + Issue First Accessory &rarr;
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Asset History & Activity Log */}
                <div className="p-6 rounded-lg shadow-md bg-white dark:bg-slate-800">

                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                        <div>
                            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Asset History & Activity Log</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Chronological history of assets assigned to and returned from this user</p>
                        </div>
                        <button
                            onClick={fetchUserAssetHistory}
                            disabled={isLoadingHistory}
                            className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Refresh history"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>

                    {isLoadingHistory ? (
                        <div className="text-center py-6 text-sm text-slate-400">Loading activity log...</div>
                    ) : userAssetHistory.length > 0 ? (
                        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                            {userAssetHistory.map((entry: any) => {
                                const isAssigned = entry.event === 'Assigned';
                                const isUnassigned = entry.event === 'Unassigned';
                                const dotColor = isAssigned ? 'bg-emerald-500' : isUnassigned ? 'bg-amber-500' : 'bg-blue-500';

                                return (
                                    <div key={entry.id} className="relative group">
                                        {/* Timeline dot */}
                                        <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${dotColor}`} />

                                        <div className="p-3.5 rounded-lg border bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/60">
                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                                        isAssigned ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                                        isUnassigned ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                                                        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                    }`}>
                                                        {entry.event}
                                                    </span>
                                                    {entry.asset && (
                                                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                                            {entry.asset.name} <span className="font-mono text-xs text-slate-500 dark:text-slate-400">({entry.asset.assetId})</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-400">
                                                    {new Date(entry.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            {entry.details && (
                                                <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">{entry.details}</p>
                                            )}

                                            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                {entry.condition && (
                                                    <span><strong>Condition:</strong> {entry.condition}</span>
                                                )}
                                                {entry.user?.name && (
                                                    <span><strong>Logged by:</strong> {entry.user.name}</span>
                                                )}
                                                {entry.asset?.serialNumber && (
                                                    <span><strong>S/N:</strong> <span className="font-mono">{entry.asset.serialNumber}</span></span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">No asset history recorded for this user yet.</p>
                    )}
                </div>
            </div>

            {/* Onboarding & Offboarding Modals */}
            <OnboardingWizardModal
                isOpen={isOnboardingModalOpen}
                onClose={() => setIsOnboardingModalOpen(false)}
                initialUser={user}
            />

            <OffboardingWizardModal
                isOpen={isOffboardingModalOpen}
                onClose={() => setIsOffboardingModalOpen(false)}
                initialUser={user}
            />
        </>
    );
};

export default UserDetailView;