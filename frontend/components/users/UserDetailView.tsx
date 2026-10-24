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
                <div className="flex items-center justify-center py-24 text-quiet">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mr-3"></div>
                    <span className="font-body text-sm">Loading user details...</span>
                </div>
            );
        }
        return (
            <div className="text-center p-8 bg-surface rounded-xl shadow-sm border border-line max-w-md mx-auto my-12">
                <h2 className="text-xl font-bold text-ink font-heading">User Not Found</h2>
                <p className="text-sm text-quiet mt-2 font-body">The requested user could not be located.</p>
                <button onClick={onBack} className="mt-5 bg-accent text-on-strong px-4 py-2 rounded-lg hover:bg-accent text-sm font-medium">&larr; Back to Users</button>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-strong/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl shadow-2xl border border-line p-6 w-full max-w-sm">
                        <h3 className="text-base font-bold text-ink mb-1">Return Accessory to IT Stock</h3>
                        <p className="text-xs text-quiet mb-4">
                            This will mark the accessory as returned and restore 1 unit to the batch stock.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-ink mb-1">Return Condition</label>
                                <select aria-label="Return Condition"
                                    value={returnAccessoryState.condition}
                                    onChange={e => setReturnAccessoryState(prev => prev ? { ...prev, condition: e.target.value } : null)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                                >
                                    <option>Good</option>
                                    <option>Fair</option>
                                    <option>Defective / Damaged</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-ink mb-1">Notes (optional)</label>
                                <textarea aria-label="Notes (optional)"
                                    rows={2}
                                    value={returnAccessoryState.notes}
                                    onChange={e => setReturnAccessoryState(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                    placeholder="Any damage, missing parts, reason for return…"
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setReturnAccessoryState(null)}
                                disabled={returnAccessoryState.submitting}
                                className="flex-1 py-2 rounded-lg border border-line text-sm font-semibold text-ink hover:bg-canvas transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmReturn}
                                disabled={returnAccessoryState.submitting}
                                className="flex-1 py-2 rounded-lg bg-olive hover:bg-olive text-on-strong text-sm font-bold transition-colors disabled:opacity-60"
                            >
                                {returnAccessoryState.submitting ? 'Returning…' : 'Confirm Return'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky Header */}
            <div className="sticky top-16 bg-muted/80 backdrop-blur-sm z-10 -mx-4 sm:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-line">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onBack} className="bg-muted text-ink px-2 sm:px-3 py-1.5 rounded-lg hover:bg-muted flex items-center text-sm transition-colors flex-shrink-0">
                            &larr; <span className="hidden sm:inline ml-2 font-medium">Back</span>
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-ink truncate" title={user.name}>{user.name}</h2>
                            <p className="text-xs text-quiet">ID: {user.employeeId}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsAssignModalOpen(true)} className="bg-accent text-on-strong px-3 sm:px-4 py-2 rounded-lg hover:bg-accent flex items-center gap-2 text-sm font-medium transition-colors flex-shrink-0">
                        {ICONS.add}
                        <span className="hidden sm:inline">Assign Asset</span>
                    </button>
                </div>
            </div>

            <div className="space-y-6 pt-6">
                {/* Minimalist Profile Card */}
                <div className="bg-surface rounded-2xl p-6 border border-line shadow-sm">
                    {/* Header with Avatar & Primary Info */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-line text-center sm:text-left">
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-2xl border border-line shadow-sm flex-shrink-0 object-cover"/>
                        ) : (
                            <div className="w-20 h-20 rounded-2xl shadow-sm flex-shrink-0 flex items-center justify-center font-bold text-2xl bg-strong text-on-strong">
                                {user.name?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                                <h2 className="text-2xl font-bold text-ink">{user.name}</h2>
                                {user.accountType && user.accountType !== 'Employee' && (
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface text-ink font-semibold">
                                        {user.accountType}
                                    </span>
                                )}
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${user.role === 'Admin' ? 'bg-surface text-ink  ' : user.role === 'Manager' ? 'bg-surface/60 text-quiet  ' : 'bg-muted text-ink  '}`}>
                                    {user.role || 'User'}
                                </span>
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${user.status === 'Active' || !user.status ? 'bg-surface text-ink  ' : 'bg-muted text-quiet  '}`}>
                                    {user.status || 'Active'}
                                </span>
                            </div>
                            <p className="text-sm text-quiet mt-1">
                                {user.jobTitle || 'Employee'} {user.department?.name ? `• ${user.department.name}` : ''} {user.company ? `• ${user.company}` : ''}
                            </p>
                        </div>
                    </div>

                    {/* Responsive Grid of Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-6">
                        <div className="bg-canvas/70 p-3 rounded-xl border border-line">
                            <span className="font-subheading text-[10px] font-bold text-quiet uppercase tracking-wider block mb-0.5">Email</span>
                            <span className="text-sm font-semibold text-ink truncate block" title={user.email}>{user.email || 'N/A'}</span>
                        </div>
                        <div className="bg-canvas/70 p-3 rounded-xl border border-line">
                            <span className="font-subheading text-[10px] font-bold text-quiet uppercase tracking-wider block mb-0.5">Employee ID</span>
                            <span className="text-sm font-mono font-semibold text-ink">{user.employeeId || 'N/A'}</span>
                        </div>
                        <div className="bg-canvas/70 p-3 rounded-xl border border-line">
                            <span className="font-subheading text-[10px] font-bold text-quiet uppercase tracking-wider block mb-0.5">Mobile</span>
                            <span className="text-sm font-semibold text-ink">{user.mobile || 'N/A'}</span>
                        </div>
                        <div className="bg-canvas/70 p-3 rounded-xl border border-line">
                            <span className="font-subheading text-[10px] font-bold text-quiet uppercase tracking-wider block mb-0.5">Official Branch</span>
                            <span className="text-sm font-semibold text-ink">{user.branch?.name || 'Remote / Unassigned'}</span>
                        </div>
                        <div className="bg-canvas/70 p-3 rounded-xl border border-line">
                            <span className="font-subheading text-[10px] font-bold text-quiet uppercase tracking-wider block mb-0.5">Work Location</span>
                            <span className="text-sm font-semibold text-ink">{user.location || 'N/A'}</span>
                        </div>
                        <div className="bg-canvas/70 p-3 rounded-xl border border-line">
                            <span className="font-subheading text-[10px] font-bold text-quiet uppercase tracking-wider block mb-0.5">Reporting Manager</span>
                            <span className="text-sm font-semibold text-ink">{user.manager?.name || 'N/A'}</span>
                        </div>
                        <div className="bg-canvas/70 p-3 rounded-xl border border-line">
                            <span className="font-subheading text-[10px] font-bold text-quiet uppercase tracking-wider block mb-0.5">Device Status</span>
                            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-semibold mt-0.5 ${
                                hasAssignedDevice ? 'bg-surface text-ink  ' :
                                isUsingOwnLaptop ? 'bg-surface text-ink  ' :
                                user.laptopStatus === 'Details Not Collected' ? 'bg-surface text-ink   border border-line ' :
                                'bg-muted text-ink  '
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
                        <div className="bg-canvas/70 p-3 rounded-xl border border-line">
                            <span className="font-subheading text-[10px] font-bold text-quiet uppercase tracking-wider block mb-0.5">Licenses</span>
                            <span className="text-sm font-semibold text-ink truncate block" title={user.licenseAssignments && user.licenseAssignments.length > 0 ? user.licenseAssignments.map((la: any) => la.license?.name).join(', ') : 'None'}>
                                {user.licenseAssignments && user.licenseAssignments.length > 0 ? `${user.licenseAssignments.length} License(s)` : 'None'}
                            </span>
                        </div>
                        {(user.workAddress || user.city || user.state || user.postalCode || user.country) && (
                            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 bg-canvas/70 p-3 rounded-xl border border-line">
                                <span className="font-subheading text-[10px] font-bold text-quiet uppercase tracking-wider block mb-0.5">Work Location Address</span>
                                <span className="text-sm font-semibold text-ink">
                                    {[user.workAddress, user.city, user.state, user.postalCode, user.country].filter(Boolean).join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 1. Onboarding Checklist Card */}
                <div className="bg-surface p-6 rounded-xl shadow-md border border-line space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
                        <div className="flex items-center gap-2.5">
                            <span className="p-1.5 bg-surface text-ink rounded-lg">
                                {ICONS.onboarding}
                            </span>
                            <div>
                                <h3 className="text-lg font-bold text-ink">Employee Onboarding Checklist</h3>
                                <p className="text-xs text-quiet">Equipment allocation, M365 provisioning & dispatch tracking</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                user.onboardingStatus === 'Completed' ? 'bg-surface text-ink  ' :
                                user.onboardingStatus === 'In Progress' ? 'bg-surface text-ink  ' :
                                'bg-surface text-ink  '
                            }`}>
                                {user.onboardingStatus || 'Pending Onboarding'}
                            </span>
                            <button
                                onClick={() => setIsOnboardingModalOpen(true)}
                                className="px-3 py-1 bg-accent hover:bg-accent text-on-strong rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1"
                            >
                                ⚡ Launch Onboarding Wizard
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.m365AccountCreated ? 'bg-surface text-ink  ' : 'bg-muted  text-quiet'
                            }`}>
                                {user.m365AccountCreated ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">M365 Account Created</p>
                                <p className="text-xs text-quiet">
                                    {user.m365AccountCreated ? 'Provisioned in Microsoft 365 / Entra ID' : 'Account not created'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.m365LicenseAssigned ? 'bg-surface text-ink  ' : 'bg-muted  text-quiet'
                            }`}>
                                {user.m365LicenseAssigned ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">M365 License Allocated</p>
                                <p className="text-xs text-quiet">
                                    {user.m365LicenseAssigned ? 'Active subscription seat linked' : 'No license allocated / not required'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                hasAssignedDevice ? 'bg-surface text-ink  ' :
                                isUsingOwnLaptop ? 'bg-surface text-ink  ' :
                                'bg-muted  text-quiet'
                            }`}>
                                {hasAssignedDevice || isUsingOwnLaptop ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">Hardware Allocation</p>
                                <p className="text-xs text-quiet">
                                    {hasAssignedDevice ? `${userAssets[0]?.name || 'Device'} (${userAssets[0]?.assetId || ''}) Assigned` :
                                     isUsingOwnLaptop ? 'Uses Own Laptop (BYOD)' :
                                     'No Device Assigned'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                hasAssignedDevice
                                    ? (user.softwareInstalled ? 'bg-surface text-ink   text-xs' : 'bg-muted  text-quiet text-xs')
                                    : 'bg-muted  text-quiet  text-[10px]'
                            }`}>
                                {hasAssignedDevice ? (user.softwareInstalled ? '✓' : '—') : 'N/A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">Software & Antivirus Installed</p>
                                <p className="text-xs text-quiet">
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

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                hasAssignedDevice
                                    ? (user.hardwareTested ? 'bg-surface text-ink   text-xs' : 'bg-muted  text-quiet text-xs')
                                    : 'bg-muted  text-quiet  text-[10px]'
                            }`}>
                                {hasAssignedDevice ? (user.hardwareTested ? '✓' : '—') : 'N/A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">Hardware QA Diagnostics</p>
                                <p className="text-xs text-quiet">
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

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                (hasAssignedDevice || user.m365AccountCreated)
                                    ? (user.credentialsHandedOver ? 'bg-surface text-ink   text-xs' : 'bg-muted  text-quiet text-xs')
                                    : 'bg-muted  text-quiet  text-[10px]'
                            }`}>
                                {(hasAssignedDevice || user.m365AccountCreated) ? (user.credentialsHandedOver ? '✓' : '—') : 'N/A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">Credentials Handed Over</p>
                                <p className="text-xs text-quiet">
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
                                <div className="p-3.5 bg-canvas rounded-lg border border-line text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="space-y-0.5">
                                        <span className="font-semibold text-ink flex items-center gap-1">
                                            {ICONS.truck} {d.mode === 'Courier' ? `Dispatched via ${d.courierName || 'Courier'}` : `Handover: ${d.mode || 'In-Person'}`}
                                        </span>
                                        {d.dcNumber && <p className="font-mono text-ink">Delivery Challan (DC): <strong>{d.dcNumber}</strong></p>}
                                        {d.docketNumber && <p className="font-mono text-ink">Docket / Tracking: <strong>{d.docketNumber}</strong></p>}
                                        {d.shippingAddress && <p className="text-quiet truncate max-w-md">Address: {d.shippingAddress}</p>}
                                    </div>
                                    <div className="text-right text-quiet">
                                        {d.dispatchDate && <p>Date: {d.dispatchDate}</p>}
                                        {user.onboardingCompletedDate && <p>Completed: {new Date(user.onboardingCompletedDate).toLocaleDateString()}</p>}
                                    </div>
                                </div>
                            );
                        } catch { return null; }
                    })()}
                </div>

                {/* 2. Offboarding Checklist Card */}
                <div className="bg-surface p-6 rounded-xl shadow-md border border-line space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
                        <div className="flex items-center gap-2.5">
                            <span className="p-1.5 bg-surface text-ink rounded-lg">
                                {ICONS.offboarding}
                            </span>
                            <div>
                                <h3 className="text-lg font-bold text-ink">Employee Offboarding Checklist</h3>
                                <p className="text-xs text-quiet">Asset return, data sanitization, license release & account exit clearance</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                user.status === 'Inactive' || user.offboardingStatus === 'Completed' ? 'bg-muted text-ink  ' :
                                'bg-surface text-ink  '
                            }`}>
                                {user.status === 'Inactive' ? 'Account Inactive' : 'Active Employee'}
                            </span>
                            <button
                                onClick={() => setIsOffboardingModalOpen(true)}
                                className="px-3 py-1 bg-olive hover:bg-olive text-on-strong rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1"
                            >
                                ⚡ Launch Offboarding Wizard
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                user.assetReturned
                                    ? 'bg-surface text-ink   text-xs'
                                    : hasAssignedDevice
                                    ? 'bg-muted  text-quiet text-xs'
                                    : 'bg-muted  text-quiet  text-[10px]'
                            }`}>
                                {user.assetReturned ? '✓' : hasAssignedDevice ? '—' : 'N/A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">Company Hardware Returned</p>
                                <p className="text-xs text-quiet">
                                    {user.assetReturned
                                        ? (user.assetReturnCondition ? `Condition: ${user.assetReturnCondition}` : 'Hardware received')
                                        : hasAssignedDevice
                                        ? 'Pending equipment return'
                                        : 'Not Applicable (No company hardware assigned)'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                user.deviceWiped
                                    ? 'bg-surface text-ink   text-xs'
                                    : hasAssignedDevice
                                    ? 'bg-muted  text-quiet text-xs'
                                    : 'bg-muted  text-quiet  text-[10px]'
                            }`}>
                                {user.deviceWiped ? '✓' : hasAssignedDevice ? '—' : 'N/A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">Device Wiped & Sanitized</p>
                                <p className="text-xs text-quiet">
                                    {user.deviceWiped
                                        ? 'Factory reset completed, BitLocker erased'
                                        : hasAssignedDevice
                                        ? 'Pending sanitization'
                                        : 'Not Applicable (No company device to wipe)'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.dataBackedUp ? 'bg-surface text-ink  ' : 'bg-muted  text-quiet'
                            }`}>
                                {user.dataBackedUp ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">User Data Backed Up</p>
                                <p className="text-xs text-quiet">
                                    {user.dataBackedUp ? 'Synced to OneDrive / handed over to manager' : 'Data not backed up'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.m365LicenseRevoked ? 'bg-surface text-ink  ' : 'bg-muted  text-quiet'
                            }`}>
                                {user.m365LicenseRevoked ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">Subscriptions Revoked</p>
                                <p className="text-xs text-quiet">
                                    {user.m365LicenseRevoked ? 'Seats released back to available pool' : 'Subscriptions active'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.m365AccountDisabled ? 'bg-surface text-ink  ' : 'bg-muted  text-quiet'
                            }`}>
                                {user.m365AccountDisabled ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">M365 Account Disabled</p>
                                <p className="text-xs text-quiet">
                                    {user.m365AccountDisabled ? 'Sign-in blocked & cloud sessions revoked' : 'Active M365 account'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas/50">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                                user.status === 'Inactive' ? 'bg-surface text-ink  ' : 'bg-muted  text-quiet'
                            }`}>
                                {user.status === 'Inactive' ? '✓' : '—'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">Portal Account Deactivated</p>
                                <p className="text-xs text-quiet">
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
                                <div className="p-3.5 bg-surface/40 rounded-lg border border-line text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="space-y-0.5">
                                        <span className="font-semibold text-ink flex items-center gap-1">
                                            {ICONS.truck} {rd.mode === 'Courier' ? `Returned via ${rd.courier || 'Courier'}` : 'In-Person Return'}
                                        </span>
                                        {rd.docketNo && <p className="font-mono text-ink">Return Docket: <strong>{rd.docketNo}</strong></p>}
                                        {user.assetReturnRemarks && <p className="text-quiet truncate max-w-md">Remarks: {user.assetReturnRemarks}</p>}
                                    </div>
                                    <div className="text-right text-quiet">
                                        {rd.returnDate && <p>Date: {new Date(rd.returnDate).toLocaleDateString()}</p>}
                                        {user.offboardingCompletedDate && <p>Completed: {new Date(user.offboardingCompletedDate).toLocaleDateString()}</p>}
                                    </div>
                                </div>
                            );
                        } catch { return null; }
                    })()}
                </div>
                <div className="bg-surface p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-ink">Assigned Assets ({userAssets.length})</h3>
                    </div>

                    <div className="space-y-3">
                        {userAssets.length > 0 ? (
                            userAssets.map(asset => (
                                <div key={asset.id} className="bg-canvas p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-line">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-ink truncate">{asset.name}</p>
                                        <p className="text-sm text-quiet flex flex-wrap items-center gap-x-2">
                                            <span className="font-mono">{asset.assetId}</span>
                                            <span className="hidden sm:inline">&bull;</span>
                                            <span className="font-mono">S/N: {asset.serialNumber}</span>
                                            {asset.status === 'Pending Handover' && (
                                                <>
                                                    <span className="hidden sm:inline">&bull;</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-ink border border-line flex items-center gap-1">
                                                        ⚠️ Pending Acknowledgment
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 flex-shrink-0 self-start sm:self-center">
                                        <button onClick={() => setSelectedAssetId(asset.id)} className="px-3 py-1.5 rounded-md bg-muted text-ink hover:bg-muted text-xs font-semibold transition-colors">View</button>
                                        {(asset.category === 'Laptop' || asset.category === 'Desktop' || asset.assetId?.includes('-LAP-') || asset.assetId?.includes('-DES-')) && (
                                            <button onClick={() => setPreviewTarget({ type: 'declaration', assetId: asset.id, userId: user.id })} className="px-3 py-1.5 rounded-md bg-muted text-ink hover:bg-muted text-xs font-semibold transition-colors" title="View / Print Declaration Form">Form</button>
                                        )}
                                        <button onClick={() => setAssetToUnassign(asset)} className="p-2 text-quiet rounded-full hover:bg-surface hover:text-ink" title="Unassign Asset">
                                            {ICONS.unassign}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-quiet text-center py-4">No assets are currently assigned to this user.</p>
                        )}
                    </div>
                </div>

                {/* Assigned Peripherals & Accessories (No Asset IDs, Tracked by Batch & Warranty) */}
                <div className="bg-surface p-6 rounded-lg shadow-md border border-line space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🖱️</span>
                                <h3 className="text-xl font-semibold text-ink">
                                    Assigned Peripherals &amp; Accessories ({accessories.filter(a => a.status === 'Assigned').length})
                                </h3>
                            </div>
                            <p className="text-xs text-quiet mt-0.5">
                                Low-cost peripherals (mouse, keyboard, headset, etc.) tracked with purchase warranty without generating individual Asset IDs
                            </p>
                        </div>
                        <button
                            onClick={() => setIsIssueAccessoryModalOpen(true)}
                            className="bg-accent text-on-strong px-3 sm:px-4 py-2 rounded-lg hover:bg-accent flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 self-start sm:self-auto"
                        >
                            {ICONS.add} Issue Accessory
                        </button>
                    </div>

                    <div className="space-y-3">
                        {isLoadingAccessories ? (
                            <p className="text-xs text-quiet text-center py-6">Loading peripherals checklist...</p>
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
                                                ? 'bg-canvas  border-line/80 '
                                                : 'bg-muted/50  border-dashed border-line  opacity-60'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center text-xl shrink-0 shadow-sm">
                                                {categoryIcon}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-bold text-ink truncate">
                                                        {acc.name}
                                                    </h4>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-ink">
                                                        {acc.category}
                                                    </span>
                                                    {!isAssigned && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-quiet">
                                                            Returned
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2.5 mt-1 flex-wrap text-xs text-quiet">
                                                    {acc.brand && <span>Brand: <strong>{acc.brand}</strong></span>}
                                                    {acc.serialNumber && <span className="font-mono">S/N: {acc.serialNumber}</span>}
                                                    {acc.condition && <span>Condition: <strong>{acc.condition}</strong></span>}
                                                    <span>Issued: {new Date(acc.assignedAt).toLocaleDateString()}</span>
                                                </div>

                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    {/* Warranty Status Badge */}
                                                    {warrantyEnd ? (
                                                        diffDays !== null && diffDays < 0 ? (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-surface text-ink border border-line">
                                                                🛡️ Warranty Expired ({warrantyEnd.toLocaleDateString()})
                                                            </span>
                                                        ) : diffDays !== null && diffDays <= 30 ? (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-surface text-ink border border-line">
                                                                🛡️ Warranty Expiring in {diffDays}d ({warrantyEnd.toLocaleDateString()})
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-surface text-ink border border-line">
                                                                🛡️ Under Warranty (Until {warrantyEnd.toLocaleDateString()})
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/80 text-quiet">
                                                            Self-Declared / Invoice Not Linked
                                                        </span>
                                                    )}

                                                    {/* Batch Link Info */}
                                                    {acc.batch && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface text-ink border border-line">
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
                                                    className="px-3 py-1.5 rounded-lg bg-surface text-ink hover:bg-surface text-xs font-bold transition-colors border border-line"
                                                    title="Mark accessory as returned to IT inventory"
                                                >
                                                    Return to Stock
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeleteAccessory(acc.id)}
                                                className="p-1.5 text-quiet hover:text-ink rounded-lg hover:bg-surface transition-all"
                                                title="Remove accessory from profile"
                                            >
                                                {ICONS.delete}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-6 text-center text-quiet space-y-2 border border-dashed border-line rounded-xl">
                                <p className="text-2xl">🖱️</p>
                                <p className="text-sm font-semibold text-quiet">No accessories recorded for this employee yet</p>
                                <p className="text-xs text-quiet max-w-sm mx-auto">
                                    Issue a mouse, keyboard, or headset from your stock batches to track warranty coverage without generating individual Asset IDs.
                                </p>
                                <button
                                    onClick={() => setIsIssueAccessoryModalOpen(true)}
                                    className="mt-2 text-xs font-bold text-ink hover:underline inline-block"
                                >
                                    + Issue First Accessory &rarr;
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Asset History & Activity Log */}
                <div className="bg-surface p-6 rounded-lg shadow-md">

                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-line">
                        <div>
                            <h3 className="text-xl font-semibold text-ink">Asset History & Activity Log</h3>
                            <p className="text-xs text-quiet">Chronological history of assets assigned to and returned from this user</p>
                        </div>
                        <button
                            onClick={fetchUserAssetHistory}
                            disabled={isLoadingHistory}
                            className="p-1.5 text-quiet hover:text-ink rounded-lg hover:bg-muted transition-colors"
                            title="Refresh history"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>

                    {isLoadingHistory ? (
                        <div className="text-center py-6 text-quiet text-sm">Loading activity log...</div>
                    ) : userAssetHistory.length > 0 ? (
                        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                            {userAssetHistory.map((entry: any) => {
                                const isAssigned = entry.event === 'Assigned';
                                const isUnassigned = entry.event === 'Unassigned';
                                const dotColor = isAssigned ? 'bg-olive' : isUnassigned ? 'bg-olive' : 'bg-olive';

                                return (
                                    <div key={entry.id} className="relative group">
                                        {/* Timeline dot */}
                                        <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-line  ${dotColor}`} />

                                        <div className="bg-canvas p-3.5 rounded-lg border border-line">
                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                                        isAssigned ? 'bg-surface text-ink  ' :
                                                        isUnassigned ? 'bg-surface text-ink  ' :
                                                        'bg-muted text-ink  '
                                                    }`}>
                                                        {entry.event}
                                                    </span>
                                                    {entry.asset && (
                                                        <span className="font-semibold text-sm text-ink">
                                                            {entry.asset.name} <span className="font-mono text-xs text-quiet">({entry.asset.assetId})</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-quiet">
                                                    {new Date(entry.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            {entry.details && (
                                                <p className="text-sm text-quiet mt-1">{entry.details}</p>
                                            )}

                                            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-quiet">
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
                        <p className="text-quiet text-center py-4 text-sm">No asset history recorded for this user yet.</p>
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