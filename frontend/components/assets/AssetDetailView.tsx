import { API_URL } from '../../utils/apiClient';
import React from 'react';
import { Asset } from '../../types';
import { getWarrantyStatus } from '../../utils/assetUtils';
import { ICONS } from '../../constants';
import AssetHistoryLog from './AssetHistoryLog';
import AssetServiceHistory from './AssetServiceHistory';
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
        <p className="text-sm font-medium text-quiet">{label}</p>
        <div className="text-ink mt-1">{value}</div>
    </div>
);

// Status badge colors
const STATUS_STYLES: Record<string, string> = {
    'In Stock':                   'bg-surface text-ink   border-line ',
    'Pending Handover':           'bg-surface text-ink   border-line ',
    'Assigned':                   'bg-surface text-ink   border-line ',
    'Reserved':                   'bg-surface text-ink   border-line ',
    'In Repair':                  'bg-surface text-ink   border-line ',
    'Under Inspection':           'bg-surface text-ink   border-line ',
    'Available for Reallocation': 'bg-surface text-ink   border-line ',
    'Retired':                    'bg-muted text-ink   border-line ',
    'Disposed':                   'bg-surface text-ink   border-line ',
};

const CONDITION_STYLES: Record<string, string> = {
    'Brand New':              'bg-surface text-ink   border-line ',
    'Excellent':              'bg-surface text-ink   border-line ',
    'Good':                   'bg-surface text-ink   border-line ',
    'Fair':                   'bg-surface text-ink   border-line ',
    'Minor Damage':           'bg-surface text-ink   border-line ',
    'Damaged / Under Repair': 'bg-surface text-ink   border-line ',
};

// Status dot colours for the change-status dropdown
const STATUS_DOT: Record<string, string> = {
    'In Stock':                   'bg-olive',
    'Pending Handover':           'bg-olive',
    'Assigned':                   'bg-olive',
    'Reserved':                   'bg-olive',
    'In Repair':                  'bg-olive',
    'Under Inspection':           'bg-olive',
    'Available for Reallocation': 'bg-olive',
    'Retired':                    'bg-muted',
    'Disposed':                   'bg-olive',
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
            const res = await fetch(`${API_URL}/api/assets/${asset.id}`, {
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
            const res = await fetch(`${API_URL}/api/assets/${asset.id}`, {
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
            const res = await fetch(`${API_URL}/api/assets/${asset.id}`, {
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
            setAssets(assets.map(a => a.id === asset.id ? { ...a, ...updated, condition: updated.condition || newCondition, specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : (updated.specs || a.specs) } : a));
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
            <div className="sticky top-16 bg-muted/80 backdrop-blur-sm z-10 -mx-4 sm:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-line">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0">
                        {onBack && (
                            <button onClick={onBack} className="bg-muted text-ink px-2 sm:px-3 py-1.5 rounded-lg hover:bg-muted flex items-center text-sm transition-colors flex-shrink-0">
                                &larr; <span className="hidden sm:inline ml-2 font-medium">Back</span>
                            </button>
                        )}
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-ink truncate" title={asset.name}>{asset.name}</h2>
                            <p className="text-xs text-quiet font-mono">{asset.assetId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {user?.role !== 'User' && (
                            <>
                                {/* Assigned or Pending Handover: show Unassign / Cancel */}
                                {(asset.status === 'Assigned' || asset.status === 'Pending Handover') && (
                                    <button onClick={() => setIsUnassignModalOpen(true)} className="bg-muted text-ink px-3 sm:px-4 py-2 rounded-lg hover:bg-surface hover:text-ink flex items-center gap-2 text-sm transition-all active:scale-95">
                                        {ICONS.remove} <span className="hidden sm:inline">{asset.status === 'Pending Handover' ? 'Cancel Handover' : 'Unassign'}</span>
                                    </button>
                                )}

                                {/* Pending Handover: show Mark as Handed Over / Assigned */}
                                {asset.status === 'Pending Handover' && (
                                    <button onClick={() => handleChangeStatus('Assigned')} disabled={isChangingStatus} className="bg-olive hover:bg-olive text-on-strong font-medium px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all active:scale-95 shadow-sm disabled:opacity-60">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="hidden sm:inline">Mark as Handed Over / Assigned</span>
                                    </button>
                                )}

                                {/* In Stock / Available for Reallocation: show Assign button */}
                                {(asset.status === 'In Stock' || asset.status === 'Available for Reallocation') && (
                                    <button onClick={handleAssign} className="bg-olive text-on-strong px-3 sm:px-4 py-2 rounded-lg hover:bg-olive flex items-center gap-2 text-sm transition-all active:scale-95 shadow-sm">
                                        {ICONS.users} <span className="hidden sm:inline">Assign Asset</span>
                                    </button>
                                )}

                                {/* Change Status dropdown — for any non-assigned status */}
                                {availableTransitions.length > 0 && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsStatusMenuOpen(prev => !prev)}
                                            disabled={isChangingStatus}
                                            className="bg-muted text-ink px-3 sm:px-4 py-2 rounded-lg hover:bg-muted flex items-center gap-2 text-sm transition-all active:scale-95 disabled:opacity-60"
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
                                                <div className="absolute right-0 mt-2 w-52 bg-surface rounded-xl shadow-xl border border-line z-20 overflow-hidden">
                                                    <p className="px-4 py-2 text-xs font-bold text-quiet uppercase tracking-wider border-b border-line">
                                                        Change to...
                                                    </p>
                                                    {availableTransitions.map(s => (
                                                        <button
                                                            key={s}
                                                            onClick={() => handleChangeStatus(s)}
                                                            className="w-full text-left px-4 py-3 text-sm hover:bg-canvas transition-colors flex items-center gap-3"
                                                        >
                                                            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[s] || 'bg-muted'}`} />
                                                            <span className="font-medium text-ink">{s}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                <button onClick={() => setPreviewTarget({ type: 'label', assetId: asset.id })} className="bg-accent text-on-strong px-3 sm:px-4 py-2 rounded-lg hover:bg-accent flex items-center gap-2 text-sm transition-colors flex-shrink-0">
                                    {ICONS.qr} <span className="hidden sm:inline">Print Label</span>
                                </button>
                            </>
                        )}
                        {user?.role === 'User' && asset.userId === user.id && (
                            <button onClick={() => setIsAuditModalOpen(true)} className="bg-olive text-on-strong px-3 sm:px-4 py-2 rounded-lg hover:bg-olive flex items-center gap-2 text-sm transition-all active:scale-95 shadow-sm">
                                <span>📷</span> <span className="hidden sm:inline font-medium">Self Audit</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6 pt-6">
                <div className="bg-surface p-6 rounded-xl shadow-sm">
                    <div className="flex justify-end items-start pb-6 border-b border-line">
                        <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-surface text-ink">{asset.category}</span>
                    </div>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <DetailItem label="Status" value={
                            <span className={`px-2.5 py-1 inline-flex text-sm font-semibold rounded-full ${STATUS_STYLES[asset.status] || 'bg-muted text-quiet'}`}>
                                {asset.status}
                            </span>
                        } />
                        <DetailItem label="Physical Condition" value={
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 inline-flex text-sm font-semibold rounded-full border ${CONDITION_STYLES[asset.condition || 'Good'] || 'bg-muted text-ink border-line'}`}>
                                    {asset.condition || 'Good'}
                                </span>
                                {user?.role !== 'User' && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsConditionMenuOpen(prev => !prev)}
                                            disabled={isChangingCondition}
                                            className="text-xs text-ink hover:underline font-semibold ml-1 cursor-pointer"
                                            title="Update Condition"
                                        >
                                            {isChangingCondition ? 'Updating...' : 'Change'}
                                        </button>
                                        {isConditionMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-20" onClick={() => setIsConditionMenuOpen(false)} />
                                                <div className="absolute left-0 mt-1 w-48 bg-surface rounded-xl shadow-xl border border-line z-30 py-1 text-xs overflow-hidden">
                                                    {['Brand New', 'Excellent', 'Good', 'Fair', 'Minor Damage', 'Damaged / Under Repair'].map(cond => (
                                                        <button
                                                            key={cond}
                                                            onClick={() => handleChangeCondition(cond)}
                                                            className={`w-full text-left px-3 py-2 hover:bg-muted  flex items-center justify-between ${asset.condition === cond ? 'font-bold text-ink  bg-canvas ' : 'text-ink '}`}
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
                                <a href="#" onClick={handlePurchaseClick} className="text-ink hover:underline font-semibold">
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
                        <div className="mt-6 pt-6 border-t border-line">
                            <DetailItem label="Remarks" value={<p className="italic">"{asset.remarks}"</p>} />
                        </div>
                    )}
                </div>

                {specEntries.length > 0 && (
                    <div className="bg-surface p-6 rounded-xl shadow-sm">
                        <h3 className="text-xl font-semibold mb-4 text-ink border-b border-line pb-4">Specifications</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                            {specEntries.map(([key, value]) => (
                                <div key={key}>
                                    <p className="text-sm font-medium text-quiet capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                                    <p className="text-ink mt-1">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                                <AssetServiceHistory
                    asset={asset}
                    purchaseAmount={purchase?.amount}
                    onAssetStatusChanged={(newStatus) => {
                        setAssets(assets.map(a => a.id === asset.id ? { ...a, status: newStatus } : a));
                        setHistoryRefreshKey(prev => prev + 1);
                        fetchAssetHistory();
                    }}
                    refreshTrigger={historyRefreshKey}
                />
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