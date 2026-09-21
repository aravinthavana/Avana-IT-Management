import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { Asset, AssetRequest } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';
import { ASSET_ICONS, ICONS } from '../../constants';

interface AllocateAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: AssetRequest | null;
    onConfirm: (assetId: number, adminRemarks?: string) => Promise<void>;
}

export const AllocateAssetModal: React.FC<AllocateAssetModalProps> = ({
    isOpen,
    onClose,
    request,
    onConfirm
}) => {
    const { assets } = useAppContext();
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
    const [adminRemarks, setAdminRemarks] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter available in-stock assets
    const availableAssets = useMemo(() => {
        if (!request) return [];
        return assets.filter(asset => {
            const isStock = asset.status === 'In Stock' || asset.status === 'Available';
            if (!isStock) return false;

            // Category match check unless toggle is on
            if (!showAllCategories && asset.category.toLowerCase() !== request.category.toLowerCase()) {
                return false;
            }

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = asset.name?.toLowerCase().includes(q);
                const matchTag = asset.assetId?.toLowerCase().includes(q);
                const matchSerial = asset.serialNumber?.toLowerCase().includes(q);
                const matchModel = asset.model?.toLowerCase().includes(q);
                const matchBrand = asset.brand?.toLowerCase().includes(q);
                if (!matchName && !matchTag && !matchSerial && !matchModel && !matchBrand) return false;
            }

            return true;
        });
    }, [assets, request, showAllCategories, searchQuery]);

    const handleAllocate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAssetId) {
            setError('Please select an asset from inventory to allocate.');
            return;
        }

        setError(null);
        setIsSubmitting(true);
        try {
            await onConfirm(selectedAssetId, adminRemarks.trim() || undefined);
            setSelectedAssetId(null);
            setAdminRemarks('');
            setSearchQuery('');
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to allocate asset');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!request) return null;

    const selectedAsset = assets.find(a => a.id === selectedAssetId);

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Allocate Asset for REQ-${request.id.toString().padStart(4, '0')}`} 
            maxWidth="max-w-3xl"
        >
            <form onSubmit={handleAllocate} className="space-y-4">
                {/* Requester & Request Context Header */}
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center border border-brand-200 dark:border-brand-800 text-sm">
                            {request.user?.name?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-800 dark:text-white">
                                {request.user?.name || 'Unknown Requester'}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {request.user?.email} &bull; {request.user?.company || 'Avana Group'}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                            Requested: {request.category}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                            {request.requestType}
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="p-3 text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-xl font-medium">
                        {error}
                    </div>
                )}

                {/* Inventory Filter & Search Controls */}
                <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <label className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                            <span>Select In-Stock Asset</span>
                            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                ({availableAssets.length} matching in stock)
                            </span>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showAllCategories}
                                onChange={(e) => setShowAllCategories(e.target.checked)}
                                className="rounded text-brand-600 focus:ring-brand-500 dark:bg-slate-700 dark:border-slate-600"
                            />
                            <span>Show all categories</span>
                        </label>
                    </div>

                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                            {ICONS.search}
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter by Asset ID, Model, Brand, or Serial..."
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-800 dark:text-white placeholder-slate-400 shadow-sm"
                        />
                    </div>
                </div>

                {/* Asset Selection List */}
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1 border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/50">
                    {availableAssets.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                            <p className="font-medium text-slate-600 dark:text-slate-400">No available assets in stock.</p>
                            <p className="text-xs mt-1">Check "Show all categories" or procure new inventory.</p>
                        </div>
                    ) : (
                        availableAssets.map(asset => {
                            const isSelected = selectedAssetId === asset.id;
                            const icon = ASSET_ICONS[asset.category] || ASSET_ICONS.default;

                            return (
                                <div
                                    key={asset.id}
                                    onClick={() => {
                                        setSelectedAssetId(asset.id);
                                        if (error) setError(null);
                                    }}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                        isSelected 
                                            ? 'border-brand-500 bg-brand-50/80 dark:bg-brand-950/40 shadow-sm ring-1 ring-brand-500' 
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-2 rounded-lg text-slate-600 dark:text-slate-300 shrink-0 ${isSelected ? 'bg-brand-100 dark:bg-brand-900/50 text-brand-600 dark:text-brand-300' : 'bg-slate-100 dark:bg-slate-600'}`}>
                                            <div className="w-5 h-5">{icon}</div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                                    {asset.name}
                                                </span>
                                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold">
                                                    {asset.assetId}
                                                </span>
                                                {asset.company && (
                                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                        {asset.company}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                                {asset.brand} {asset.model} &bull; S/N: <code className="font-mono">{asset.serialNumber || 'N/A'}</code>
                                                {asset.location && ` &bull; Loc: ${asset.location}`}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="shrink-0 flex items-center">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                            isSelected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-500'
                                        }`}>
                                            {isSelected && (
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Allocation Note */}
                {selectedAsset && (
                    <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 rounded-xl text-xs text-green-800 dark:text-green-300 space-y-1">
                        <p className="font-semibold flex items-center gap-1.5">
                            <span>&#10004; Ready to Allocate:</span>
                            <span className="font-bold">{selectedAsset.name} ({selectedAsset.assetId})</span>
                        </p>
                        <p className="text-green-700 dark:text-green-400">
                            Asset status will change to <strong>In Use</strong>, assigned to <strong>{request.user?.name}</strong>. A pending digital handover form will be generated for employee sign-off.
                        </p>
                    </div>
                )}

                {/* Admin Remarks */}
                <div>
                    <label htmlFor="adminRemarks" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Allocation Notes / Package Details <span className="text-slate-400 text-xs">(Optional)</span>
                    </label>
                    <input
                        type="text"
                        id="adminRemarks"
                        value={adminRemarks}
                        onChange={(e) => setAdminRemarks(e.target.value)}
                        placeholder="e.g., Handed over with charger, laptop bag, and wireless mouse..."
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-800 dark:text-white placeholder-slate-400 shadow-sm"
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !selectedAssetId}
                        className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Allocating...</span>
                            </>
                        ) : (
                            <>
                                <span>Allocate &amp; Fulfill</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AllocateAssetModal;
