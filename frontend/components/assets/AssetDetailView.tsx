import React from 'react';
import { Asset } from '../../types';
import { getWarrantyStatus } from '../../utils/assetUtils';
import { ICONS } from '../../constants';
import AssetHistoryLog from './AssetHistoryLog';
import { useAppContext } from '../../hooks/useAppContext';
import { getAssigneeDisplayInfo } from '../../utils/assigneeUtils';
import { useAuth } from '../../contexts/AuthContext';
import SelfAuditModal from './SelfAuditModal';

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
    'Assigned':        'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    'In Stock':        'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    'In Repair':       'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    'Retired':         'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    'Pending Handover':'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
};

// Which statuses a non-assigned asset can transition to
const STATUS_TRANSITIONS: Record<string, string[]> = {
    'In Stock':  ['In Repair', 'Retired'],
    'In Repair': ['In Stock', 'Retired'],
    'Retired':   ['In Stock'],
};

const AssetDetailView: React.FC<AssetDetailViewProps> = ({ asset, onBack }) => {
    const { users, departments, branches, purchaseRecords, setPreviewTarget, setSelectedPurchaseId, setSelectedAssetId, setAssets, assets, setNotification, getHeaders, navigate } = useAppContext();
    const { user } = useAuth();
    const assignee = getAssigneeDisplayInfo(asset.assigneeId, asset.assigneeType, users, departments, branches);
    const purchase = purchaseRecords.find(p => p.id === asset.purchaseId);
    const specEntries = Object.entries(asset.specs || {});
    const warrantyStatus = getWarrantyStatus(asset);
    const [isAuditModalOpen, setIsAuditModalOpen] = React.useState(false);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = React.useState(false);
    const [isChangingStatus, setIsChangingStatus] = React.useState(false);

    const handleUnassign = async () => {
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/assets/${asset.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...asset,
                    status: 'In Stock',
                    assigneeId: null,
                    assigneeType: null,
                    specs: asset.specs ? JSON.stringify(asset.specs) : null
                })
            });
            if (!res.ok) throw new Error('Failed to unassign');
            const updated = await res.json();
            setAssets(assets.map(a => a.id === asset.id ? { ...updated, specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : updated.specs } : a));
            setNotification({ message: 'Asset unassigned successfully', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
    };

    const handleChangeStatus = async (newStatus: string) => {
        setIsStatusMenuOpen(false);
        setIsChangingStatus(true);
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/assets/${asset.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...asset,
                    status: newStatus,
                    specs: asset.specs ? JSON.stringify(asset.specs) : null
                })
            });
            if (!res.ok) throw new Error('Failed to update status');
            const updated = await res.json();
            setAssets(assets.map(a => a.id === asset.id ? { ...updated, specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : updated.specs } : a));
            setNotification({ message: `Status changed to "${newStatus}"`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsChangingStatus(false);
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
                                {/* Assigned: show Unassign */}
                                {asset.status === 'Assigned' && (
                                    <button onClick={handleUnassign} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 sm:px-4 py-2 rounded-lg hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400 flex items-center gap-2 text-sm transition-all active:scale-95">
                                        {ICONS.remove} <span className="hidden sm:inline">Unassign</span>
                                    </button>
                                )}

                                {/* In Stock: show Assign + Change Status */}
                                {asset.status === 'In Stock' && (
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
                                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-20 overflow-hidden">
                                                    <p className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                                                        Change to...
                                                    </p>
                                                    {availableTransitions.map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleChangeStatus(status)}
                                                            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3"
                                                        >
                                                            <span className={`inline-block w-2 h-2 rounded-full ${
                                                                status === 'In Stock' ? 'bg-blue-500' :
                                                                status === 'In Repair' ? 'bg-amber-500' :
                                                                'bg-slate-400'
                                                            }`} />
                                                            <span className="font-medium text-slate-700 dark:text-slate-200">{status}</span>
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
                        <DetailItem label="Location" value={asset.location} />
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
                <AssetHistoryLog assetId={asset.id} />
            </div>
            <SelfAuditModal isOpen={isAuditModalOpen} onClose={() => setIsAuditModalOpen(false)} asset={asset} />
        </>
    );
};

export default AssetDetailView;