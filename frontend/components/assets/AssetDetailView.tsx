import React from 'react';
import { Asset } from '../../types';
import { getWarrantyStatus } from '../../utils/assetUtils';
import { ICONS } from '../../constants';
import AssetHistoryLog from './AssetHistoryLog';
import { useAppContext } from '../../hooks/useAppContext';
import { getAssigneeDisplayInfo } from '../../utils/assigneeUtils';
import { useAuth } from '../../contexts/AuthContext';
import SelfAuditModal from './SelfAuditModal';
import WipeAssetModal from './WipeAssetModal';
import UnassignAssetModal from '../users/UnassignAssetModal';

interface AssetDetailViewProps {
    asset: Asset;
    onBack?: () => void;
}

const DetailItem: React.FC<{ label: string, value: React.ReactNode, className?: string }> = ({ label, value, className }) => (
    <div className={className}>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <div className="text-slate-800 dark:text-slate-100 mt-1">{value}</div>
    </div>
);

// Status badge colors
const STATUS_STYLES: Record<string, string> = {
    'In Stock':                   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    'Pending Handover':           'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    'Assigned':                   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    'Reserved':                   'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    'In Repair':                  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    'Under Inspection':           'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    'Available for Reallocation': 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    'Retired':                    'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    'Disposed':                   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
};

const CONDITION_STYLES: Record<string, string> = {
    'Brand New':              'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    'Excellent':              'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    'Good':                   'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    'Fair':                   'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    'Minor Damage':           'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    'Damaged / Under Repair': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
};

// Status dot colours for the change-status dropdown
const STATUS_DOT: Record<string, string> = {
    'In Stock':                   'bg-emerald-500',
    'Pending Handover':           'bg-amber-500',
    'Assigned':                   'bg-blue-500',
    'Reserved':                   'bg-violet-500',
    'In Repair':                  'bg-amber-500',
    'Under Inspection':           'bg-orange-500',
    'Available for Reallocation': 'bg-teal-500',
    'Retired':                    'bg-slate-400',
    'Disposed':                   'bg-red-500',
};

// Which statuses a non-assigned asset can transition to (lifecycle flow)
const STATUS_TRANSITIONS: Record<string, string[]> = {
    'In Stock':                   ['Reserved', 'In Repair', 'Retired'],
    'Pending Handover':           ['Assigned', 'In Stock'],
    'Reserved':                   ['In Stock', 'In Repair'],
    'In Repair':                  ['In Stock', 'Retired'],
    'Under Inspection':           ['Available for Reallocation', 'In Repair', 'Retired', 'Disposed'],
    'Available for Reallocation': ['In Repair', 'Retired'],
    'Retired':                    ['Disposed', 'In Stock'],
    'Disposed':                   [],
};

const AssetDetailView: React.FC<AssetDetailViewProps> = ({ asset, onBack }) => {
    const { users, departments, branches, purchaseRecords, setPreviewTarget, setSelectedPurchaseId, setSelectedAssetId, setAssets, assets, setNotification, getHeaders, navigate, fetchAssetHistory } = useAppContext();
    const { user } = useAuth();
    const assignee = getAssigneeDisplayInfo(asset.assigneeId, asset.assigneeType, users, departments, branches);
    const purchase = purchaseRecords.find(p => p.id === asset.purchaseId);
    const parsedSpecs = typeof asset.specs === 'string' ? (() => { 
        try { 
            const p = JSON.parse(asset.specs); 
            return typeof p === 'string' ? JSON.parse(p) : p; 
        } catch { return { details: asset.specs }; } 
    })() : (asset.specs || {});
    const specEntries = Object.entries(parsedSpecs).filter(([k]) => {
        const lower = k.toLowerCase().replace(/[\s_-]/g, '');
        return lower !== 'servicetag' && lower !== 'serialnumber';
    });

    const derivedLocation = React.useMemo(() => {
        if (asset.assigneeType?.toLowerCase() === 'user' && asset.assigneeId) {
            const u = users.find(x => x.id === asset.assigneeId);
            if (u) {
                return u.location || (typeof u.branch === 'object' ? u.branch?.name : u.branch) || 'Remote / Field';
            }
        }
        if (asset.assigneeType?.toLowerCase() === 'branch' && asset.assigneeId) {
            const b = branches.find(x => x.id === asset.assigneeId);
            if (b) return b.name;
        }
        if (asset.assigneeType?.toLowerCase() === 'department' && asset.assigneeId) {
            const d = departments.find(x => x.id === asset.assigneeId);
            if (d) return d.name;
        }
        if (asset.status === 'In Stock' || asset.status === 'Available for Reallocation') {
            return 'In Stock';
        }
        if (asset.status === 'In Repair') {
            return 'In Repair';
        }
        return 'In Stock';
    }, [asset, users, branches, departments]);

    const warrantyStatus = getWarrantyStatus(asset);
    const [isAuditModalOpen, setIsAuditModalOpen] = React.useState(false);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = React.useState(false);
    const [isChangingStatus, setIsChangingStatus] = React.useState(false);
    const [isUnassignModalOpen, setIsUnassignModalOpen] = React.useState(false);
    const [historyRefreshKey, setHistoryRefreshKey] = React.useState(0);

    const handleConfirmUnassign = async (updatedAssetData: { status: string, remarks: string, condition: string }) => {
        setIsUnassignModalOpen(false);
        setIsChangingStatus(true);
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/assets/${asset.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...asset,
                    status: updatedAssetData.status,
                    assigneeId: null,
                    assigneeType: null,
                    remarks: updatedAssetData.remarks,
                    condition: updatedAssetData.condition,
                    specs: asset.specs ? JSON.stringify(asset.specs) : null
                })
            });
            if (!res.ok) throw new Error('Failed to unassign asset');
            const updated = await res.json();
            setAssets(assets.map(a => a.id === asset.id ? { ...updated, specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : updated.specs } : a));
            setHistoryRefreshKey(prev => prev + 1);
            fetchAssetHistory();
            setNotification({ message: 'Asset unassigned successfully', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsChangingStatus(false);
        }
    };

    const [pendingWipeStatus, setPendingWipeStatus] = React.useState<string | null>(null);

    const handleChangeStatus = async (newStatus: string, wipeDetails?: string) => {
        setIsStatusMenuOpen(false);
        if (asset.status === 'Under Inspection' && newStatus === 'Available for Reallocation' && !wipeDetails) {
            setPendingWipeStatus(newStatus);
            return;
        }
        
        setIsChangingStatus(true);
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/assets/${asset.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...asset,
                    status: newStatus,
                    wipeDetails,
                    specs: asset.specs ? JSON.stringify(asset.specs) : null
                })
            });
            if (!res.ok) throw new Error('Failed to update status');
            const updated = await res.json();
            setAssets(assets.map(a => a.id === asset.id ? { ...updated, specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : updated.specs } : a));
            setHistoryRefreshKey(prev => prev + 1);
            fetchAssetHistory();
            setNotification({ message: `Status changed to "${newStatus}"`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsChangingStatus(false);
        }
    };

    const [isConditionMenuOpen, setIsConditionMenuOpen] = React.useState(false);
    const [isChangingCondition, setIsChangingCondition] = React.useState(false);

    const handleChangeCondition = async (newCondition: string) => {
        setIsConditionMenuOpen(false);
        setIsChangingCondition(true);
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/assets/${asset.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...asset,
                    condition: newCondition,
                    specs: asset.specs ? (typeof asset.specs === 'string' ? asset.specs : JSON.stringify(asset.specs)) : null
                })
            });
            if (!res.ok) throw new Error('Failed to update condition');
            const updated = await res.json();
            setAssets(assets.map(a => a.id === asset.id ? { ...updated, specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : updated.specs } : a));
            setHistoryRefreshKey(prev => prev + 1);
            fetchAssetHistory();
            setNotification({ message: `Condition changed to "${newCondition}"`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsChangingCondition(false);
        }
    };

    const handleAssign = () => {
        setSelectedAssetId(null);
        navigate('assets', { editingAssetId: asset.id });
    };

    const handlePurchaseClick = () => {
        if (purchase) {
            setSelectedAssetId(null);
            setSelectedPurchaseId(purchase.id);
        }
    };

    const availableTransitions = STATUS_TRANSITIONS[asset.status] || [];

    return (
        <>
            {/* Sticky Header */}
            <div className="sticky top-16 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 -mx-4 sm:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0">
                        {onBack && (
                            <button onClick={onBack} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center text-sm transition-colors flex-shrink-0">
                                &larr; <span className="hidden sm:inline ml-2 font-medium">Back</span>
                            </button>
                        )}
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate" title={asset.name}>{asset.name}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{asset.assetId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {user?.role !== 'User' && (
                            <>
                                {/* Assigned or Pending Handover: show Unassign / Cancel */}
                                {(asset.status === 'Assigned' || asset.status === 'Pending Handover') && (
                                    <button onClick={() => setIsUnassignModalOpen(true)} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 sm:px-4 py-2 rounded-lg hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400 flex items-center gap-2 text-sm transition-all active:scale-95">
                                        {ICONS.remove} <span className="hidden sm:inline">{asset.status === 'Pending Handover' ? 'Cancel Handover' : 'Unassign'}</span>
                                    </button>
                                )}

                                {/* Pending Handover: show Mark as Handed Over / Assigned */}
                                {asset.status === 'Pending Handover' && (
                                    <button onClick={() => handleChangeStatus('Assigned')} disabled={isChangingStatus} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all active:scale-95 shadow-sm disabled:opacity-60">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="hidden sm:inline">Mark as Handed Over / Assigned</span>
                                    </button>
                                )}

                                {/* In Stock / Available for Reallocation: show Assign button */}
                                {(asset.status === 'In Stock' || asset.status === 'Available for Reallocation') && (
                                    <button onClick={handleAssign} className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm transition-all active:scale-95 shadow-sm">
                                        {ICONS.users} <span className="hidden sm:inline">Assign Asset</span>
                                    </button>
                                )}

                                {/* Change Status dropdown — for any non-assigned status */}
                                {availableTransitions.length > 0 && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsStatusMenuOpen(prev => !prev)}
                                            disabled={isChangingStatus}
                                            className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center gap-2 text-sm transition-all active:scale-95 disabled:opacity-60"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            <span className="hidden sm:inline">{isChangingStatus ? 'Updating...' : 'Change Status'}</span>
                                        </button>
                                        {isStatusMenuOpen && (
                                            <>
                                                {/* Backdrop to close menu */}
                                                <div className="fixed inset-0 z-10" onClick={() => setIsStatusMenuOpen(false)} />
                                                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-20 overflow-hidden">
                                                    <p className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                                                        Change to...
                                                    </p>
                                                    {availableTransitions.map(s => (
                                                        <button
                                                            key={s}
                                                            onClick={() => handleChangeStatus(s)}
                                                            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3"
                                                        >
                                                            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[s] || 'bg-slate-400'}`} />
                                                            <span className="font-medium text-slate-700 dark:text-slate-200">{s}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                <button onClick={() => setPreviewTarget({ type: 'label', assetId: asset.id })} className="bg-brand-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 text-sm transition-colors flex-shrink-0">
                                    {ICONS.qr} <span className="hidden sm:inline">Print Label</span>
                                </button>
                            </>
                        )}
                        {user?.role === 'User' && asset.userId === user.id && (
                            <button onClick={() => setIsAuditModalOpen(true)} className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm transition-all active:scale-95 shadow-sm">
                                <span>📷</span> <span className="hidden sm:inline font-medium">Self Audit</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6 pt-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
                    <div className="flex justify-end items-start pb-6 border-b border-slate-200 dark:border-slate-700">
                        <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">{asset.category}</span>
                    </div>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <DetailItem label="Status" value={
                            <span className={`px-2.5 py-1 inline-flex text-sm font-semibold rounded-full ${STATUS_STYLES[asset.status] || 'bg-slate-100 text-slate-600'}`}>
                                {asset.status}
                            </span>
                        } />
                        <DetailItem label="Physical Condition" value={
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 inline-flex text-sm font-semibold rounded-full border ${CONDITION_STYLES[asset.condition || 'Good'] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                    {asset.condition || 'Good'}
                                </span>
                                {user?.role !== 'User' && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsConditionMenuOpen(prev => !prev)}
                                            disabled={isChangingCondition}
                                            className="text-xs text-brand-600 dark:text-red-400 hover:underline font-semibold ml-1 cursor-pointer"
                                            title="Update Condition"
                                        >
                                            {isChangingCondition ? 'Updating...' : 'Change'}
                                        </button>
                                        {isConditionMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-20" onClick={() => setIsConditionMenuOpen(false)} />
                                                <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-30 py-1 text-xs overflow-hidden">
                                                    {['Brand New', 'Excellent', 'Good', 'Fair', 'Minor Damage', 'Damaged / Under Repair'].map(cond => (
                                                        <button
                                                            key={cond}
                                                            onClick={() => handleChangeCondition(cond)}
                                                            className={`w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between ${asset.condition === cond ? 'font-bold text-brand-600 dark:text-red-400 bg-slate-50 dark:bg-slate-700/50' : 'text-slate-700 dark:text-slate-300'}`}
                                                        >
                                                            <span>{cond}</span>
                                                            {asset.condition === cond && <span>✓</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        } />
                        <DetailItem label="Assigned To" value={
                            <div className="flex items-center gap-2">
                                <span>{assignee.name}</span>
                                {assignee.type && <span className={`text-xs px-2 py-0.5 rounded-md ${assignee.typeColor}`}>{assignee.type}</span>}
                            </div>
                        } />
                        <DetailItem label="Company" value={asset.company || asset.assetId?.split('-')[0] || 'N/A'} />
                        <DetailItem label="Brand" value={asset.brand} />
                        <DetailItem label="Model" value={asset.model} />
                        <DetailItem label="Serial Number" value={asset.serialNumber} />
                        <DetailItem label="Location" value={derivedLocation} />
                        {purchase && (
                            <DetailItem label="Invoice Number" value={
                                <a href="#" onClick={handlePurchaseClick} className="text-brand-600 dark:text-red-400 hover:underline font-semibold">
                                    {purchase.invoiceNumber}
                                </a>
                            } />
                        )}
                        {purchase && (
                            <DetailItem label="Purchase Date" value={new Date(purchase.purchaseDate).toLocaleDateString()} />
                        )}
                        <DetailItem label="Warranty" value={<span className={`font-semibold ${warrantyStatus.color}`}>{warrantyStatus.text}</span>} className="lg:col-span-3" />
                    </div>
                    {asset.remarks && (
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                            <DetailItem label="Remarks" value={<p className="italic">"{asset.remarks}"</p>} />
                        </div>
                    )}
                </div>

                {specEntries.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
                        <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-4">Specifications</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                            {specEntries.map(([key, value]) => (
                                <div key={key}>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                                    <p className="text-slate-800 dark:text-slate-100 mt-1">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <AssetHistoryLog assetId={asset.id} refreshTrigger={historyRefreshKey} />
            </div>
            <SelfAuditModal isOpen={isAuditModalOpen} onClose={() => setIsAuditModalOpen(false)} asset={asset} />
            <WipeAssetModal
                isOpen={!!pendingWipeStatus}
                onClose={() => setPendingWipeStatus(null)}
                asset={asset}
                onConfirm={(details) => {
                    if (pendingWipeStatus) handleChangeStatus(pendingWipeStatus, details);
                    setPendingWipeStatus(null);
                }}
            />
            <UnassignAssetModal
                isOpen={isUnassignModalOpen}
                onClose={() => setIsUnassignModalOpen(false)}
                onConfirm={handleConfirmUnassign}
                asset={asset}
            />
        </>
    );
};

export default AssetDetailView;