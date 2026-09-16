import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { Asset, User } from '../../types';
import { ICONS } from '../../constants';
import AssignAssetModal from './AssignAssetModal';
import UnassignAssetModal from './UnassignAssetModal';
import OnboardingWizardModal from '../onboarding/OnboardingWizardModal';
import OffboardingWizardModal from '../onboarding/OffboardingWizardModal';

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

    const fetchUserAssetHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/users/${userId}/asset-history`, {
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
        }
    }, [userId]);

    if (!user) {
        return (
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold">User not found</h2>
                <button onClick={onBack} className="mt-4 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700">&larr; Back to Users</button>
            </div>
        );
    }
    
    const handleAssignAsset = async (assetToAssign: Asset, condition: string) => {
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/assets/${assetToAssign.id}`, {
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
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/assets/${assetToUnassign.id}`, {
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

            {/* Sticky Header */}
            <div className="sticky top-16 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 -mx-4 sm:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onBack} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center text-sm transition-colors flex-shrink-0">
                            &larr; <span className="hidden sm:inline ml-2 font-medium">Back</span>
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate" title={user.name}>{user.name}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">ID: {user.employeeId}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsAssignModalOpen(true)} className="bg-brand-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 text-sm font-medium transition-colors flex-shrink-0">
                        {ICONS.add}
                        <span className="hidden sm:inline">Assign Asset</span>
                    </button>
                </div>
            </div>

            <div className="space-y-6 pt-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                    <div className="flex flex-col items-center text-center md:flex-row md:items-start md:space-x-6 md:text-left">
                        {user.avatar ? (
                            <img src={user.avatar} alt="User Avatar" className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-700 shadow-md flex-shrink-0 object-cover"/>
                        ) : (
                            <div className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-700 shadow-md flex-shrink-0 flex items-center justify-center font-bold text-3xl bg-gradient-to-br from-red-400 to-red-600 text-white">
                                {user.name?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="mt-4 md:mt-0">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                                {user.name}
                                {user.accountType && user.accountType !== 'Employee' && (
                                    <span className="text-sm px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold tracking-wide">
                                        {user.accountType}
                                    </span>
                                )}
                            </h2>
                            <p className="text-slate-600 dark:text-slate-300 mt-2"><strong>Email:</strong> {user.email || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2 mb-2">
                                <strong>Role:</strong>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${user.role === 'Admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' : user.role === 'Manager' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}`}>{user.role || 'User'}</span>
                                <strong className="ml-3">Status:</strong>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${user.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}`}>{user.status || 'Active'}</span>
                            </p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Employee ID:</strong> {user.employeeId || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Mobile:</strong> {user.mobile || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Job Title:</strong> {user.jobTitle || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Department:</strong> {user.department?.name || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Official Branch:</strong> {user.branch?.name || 'Remote / Unassigned'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Work Location:</strong> {user.location || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Company:</strong> {user.company || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Reporting Manager:</strong> {user.manager?.name || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Licenses:</strong> {user.licenseAssignments && user.licenseAssignments.length > 0 ? user.licenseAssignments.map((la: any) => la.license?.name).join(', ') : 'None'}</p>
                            <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                <strong>Device Status:</strong>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    hasAssignedDevice ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                                    isUsingOwnLaptop ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                }`}>
                                    {hasAssignedDevice ? `${userAssets[0]?.name || 'Device'} (${userAssets[0]?.assetId || ''})` : isUsingOwnLaptop ? 'Uses Own Laptop (BYOD)' : 'No Device Assigned'}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* 1. Onboarding Checklist Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700/60 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2.5">
                            <span className="p-1.5 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 rounded-lg">
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
                                className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1"
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
                                    ? (user.softwareInstalled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-xs' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 text-xs')
                                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 text-[10px]'
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
                                        : 'Not Applicable (No device assigned)'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                hasAssignedDevice
                                    ? (user.hardwareTested ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-xs' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 text-xs')
                                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 text-[10px]'
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
                                        : 'Not Applicable (No device assigned)'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                (hasAssignedDevice || user.m365AccountCreated)
                                    ? (user.credentialsHandedOver ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-xs' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 text-xs')
                                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 text-[10px]'
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
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="space-y-0.5">
                                        <span className="font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">
                                            {ICONS.truck} {d.mode === 'Courier' ? `Dispatched via ${d.courierName || 'Courier'}` : `Handover: ${d.mode || 'In-Person'}`}
                                        </span>
                                        {d.docketNumber && <p className="font-mono text-slate-700 dark:text-slate-300">Docket / Tracking: <strong>{d.docketNumber}</strong></p>}
                                        {d.shippingAddress && <p className="text-slate-500 truncate max-w-md">Address: {d.shippingAddress}</p>}
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
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700/60 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2.5">
                            <span className="p-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg">
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
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1"
                            >
                                ⚡ Launch Offboarding Wizard
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                user.assetReturned
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-xs'
                                    : hasAssignedDevice
                                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 text-xs'
                                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 text-[10px]'
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
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-xs'
                                    : hasAssignedDevice
                                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 text-xs'
                                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 text-[10px]'
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
                                <div className="p-3.5 bg-red-50/40 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="space-y-0.5">
                                        <span className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-1">
                                            {ICONS.truck} {rd.mode === 'Courier' ? `Returned via ${rd.courier || 'Courier'}` : 'In-Person Return'}
                                        </span>
                                        {rd.docketNo && <p className="font-mono text-slate-700 dark:text-slate-300">Return Docket: <strong>{rd.docketNo}</strong></p>}
                                        {user.assetReturnRemarks && <p className="text-slate-500 truncate max-w-md">Remarks: {user.assetReturnRemarks}</p>}
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
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Assigned Assets ({userAssets.length})</h3>
                    </div>

                    <div className="space-y-3">
                        {userAssets.length > 0 ? (
                            userAssets.map(asset => (
                                <div key={asset.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-200 dark:border-slate-700/50">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{asset.name}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2">
                                            <span className="font-mono">{asset.assetId}</span>
                                            <span className="hidden sm:inline">&bull;</span>
                                            <span className="font-mono">S/N: {asset.serialNumber}</span>
                                            {asset.status === 'Pending Handover' && (
                                                <>
                                                    <span className="hidden sm:inline">&bull;</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                                        ⚠️ Pending Acknowledgment
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 flex-shrink-0 self-start sm:self-center">
                                        <button onClick={() => setSelectedAssetId(asset.id)} className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-semibold transition-colors">View</button>
                                        {(asset.category === 'Laptop' || asset.category === 'Desktop' || asset.assetId?.includes('-LAP-') || asset.assetId?.includes('-DES-')) && (
                                            <button onClick={() => setPreviewTarget({ type: 'declaration', assetId: asset.id, userId: user.id })} className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-semibold transition-colors" title="View / Print Declaration Form">Form</button>
                                        )}
                                        <button onClick={() => setAssetToUnassign(asset)} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-500" title="Unassign Asset">
                                            {ICONS.unassign}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No assets are currently assigned to this user.</p>
                        )}
                    </div>
                </div>

                {/* Asset History & Activity Log */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                        <div>
                            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Asset History & Activity Log</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Chronological history of assets assigned to and returned from this user</p>
                        </div>
                        <button
                            onClick={fetchUserAssetHistory}
                            disabled={isLoadingHistory}
                            className="p-1.5 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Refresh history"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>

                    {isLoadingHistory ? (
                        <div className="text-center py-6 text-slate-400 text-sm">Loading activity log...</div>
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
                                        
                                        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-lg border border-slate-100 dark:border-slate-700/60">
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
                                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{entry.details}</p>
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
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">No asset history recorded for this user yet.</p>
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