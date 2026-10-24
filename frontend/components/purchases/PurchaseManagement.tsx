import { API_URL } from '../../utils/apiClient';
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';
import PurchaseForm from './PurchaseForm';
import AccessoryBatchModal from '../accessories/AccessoryBatchModal';
import { PurchaseRecord, AccessoryBatch } from '../../types';


const CATEGORY_ICONS: Record<string, string> = {
    Mouse: '🖱️',
    Keyboard: '⌨️',
    Headset: '🎧',
    Monitor: '🖥️',
    'Pen Drive': '💾',
    Dock: '🔌',
    Bag: '🎒',
    Adapter: '🔌',
    Other: '📦'
};

interface PurchaseManagementProps {
    pageState?: { [key: string]: any } | null;
    onPageStateConsumed?: () => void;
}

const PurchaseManagement: React.FC<PurchaseManagementProps> = ({ pageState, onPageStateConsumed }) => {
    const { purchaseRecords, setPurchaseRecords, setSelectedPurchaseId, setNotification, getHeaders } = useAppContext();

    // Tab: 'purchases' (Capital Hardware & Invoices) vs 'accessories' (Peripheral Batches & Stock)
    const [activeTab, setActiveTab] = useState<'purchases' | 'accessories'>('purchases');

    // Hardware purchase state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Accessory Batches state
    const [batches, setBatches] = useState<AccessoryBatch[]>([]);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [editingBatch, setEditingBatch] = useState<AccessoryBatch | null>(null);
    const [accessorySearchTerm, setAccessorySearchTerm] = useState('');
    const [isLoadingBatches, setIsLoadingBatches] = useState(false);

    useEffect(() => {
        if (pageState?.openForm && onPageStateConsumed) {
            handleOpenForm();
            onPageStateConsumed();
        }
    }, [pageState, onPageStateConsumed]);

    useEffect(() => {
        if (activeTab === 'accessories') {
            fetchBatches();
        }
    }, [activeTab]);

    const fetchBatches = async () => {
        setIsLoadingBatches(true);
        try {
            const res = await fetch(`${API_URL}/api/accessories/batches`, {
                headers: getHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                const data: AccessoryBatch[] = await res.json();
                setBatches(data);
            }
        } catch (e) {
            console.error('Failed to fetch accessory batches:', e);
        } finally {
            setIsLoadingBatches(false);
        }
    };

    const handleOpenForm = (purchase: PurchaseRecord | null = null) => {
        setEditingPurchase(purchase);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setEditingPurchase(null);
        setIsFormOpen(false);
    };

    const handleOpenBatchModal = (batch: AccessoryBatch | null = null) => {
        setEditingBatch(batch);
        setIsBatchModalOpen(true);
    };

    const filteredPurchases = useMemo(() => {
        return purchaseRecords.filter(p =>
            (p.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.vendor || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [purchaseRecords, searchTerm]);

    const filteredBatches = useMemo(() => {
        return batches.filter(b =>
            (b.name || '').toLowerCase().includes(accessorySearchTerm.toLowerCase()) ||
            (b.category || '').toLowerCase().includes(accessorySearchTerm.toLowerCase()) ||
            (b.brand || '').toLowerCase().includes(accessorySearchTerm.toLowerCase()) ||
            (b.vendor || '').toLowerCase().includes(accessorySearchTerm.toLowerCase()) ||
            (b.invoiceNumber || '').toLowerCase().includes(accessorySearchTerm.toLowerCase())
        );
    }, [batches, accessorySearchTerm]);

    const handleDeletePurchase = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this purchase record?')) return;
        try {
            const res = await fetch(`${API_URL}/api/purchases/${id}`, { method: 'DELETE', headers: getHeaders(), credentials: 'include' });
            if (!res.ok) throw new Error((await res.json()).error);
            setPurchaseRecords(purchaseRecords.filter(p => p.id !== id));
            setNotification({ message: 'Purchase record deleted.', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to delete', type: 'error' });
        }
    };

    const handleDeleteBatch = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this accessory batch?')) return;
        try {
            const res = await fetch(`${API_URL}/api/accessories/batches/${id}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to delete batch');
            }
            setBatches(prev => prev.filter(b => b.id !== id));
            setNotification({ message: 'Accessory batch deleted successfully.', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message || 'Error deleting batch', type: 'error' });
        }
    };

    const getWarrantyBadge = (batch: AccessoryBatch) => {
        if (!batch.warrantyEndDate) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-quiet">
                    No Warranty on File
                </span>
            );
        }

        const now = new Date();
        const end = new Date(batch.warrantyEndDate);
        const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface text-ink border border-line">
                    🛡️ Expired ({end.toLocaleDateString()})
                </span>
            );
        }

        if (diffDays <= 30) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface text-ink border border-line">
                    🛡️ Expiring in {diffDays}d ({end.toLocaleDateString()})
                </span>
            );
        }

        return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface text-ink border border-line">
                🛡️ Under Warranty (Until {end.toLocaleDateString()})
            </span>
        );
    };

    return (
        <>
            <PurchaseForm isOpen={isFormOpen} onClose={handleCloseForm} purchase={editingPurchase} />
            <AccessoryBatchModal
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                batch={editingBatch}
                onSaved={fetchBatches}
            />

            <div className="space-y-4 animate-fade-in">
                {/* Header & Sub-navigation Tabs */}
                <div className="bg-surface rounded-2xl shadow-md p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-line">
                    <div>
                        <h2 className="text-xl font-black text-ink">Procurement &amp; Inventory</h2>
                        <p className="text-xs text-quiet mt-0.5">
                            Manage hardware invoices, asset capital purchases, and peripheral accessory batches
                        </p>
                    </div>

                    <div className="flex rounded-xl p-1 bg-muted text-xs font-bold w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('purchases')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                activeTab === 'purchases'
                                    ? 'bg-surface  text-ink  shadow-sm'
                                    : 'text-quiet hover:text-ink '
                            }`}
                        >
                            📑 Invoices &amp; Hardware ({purchaseRecords.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('accessories')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                activeTab === 'accessories'
                                    ? 'bg-surface  text-ink  shadow-sm'
                                    : 'text-quiet hover:text-ink '
                            }`}
                        >
                            🖱️ Accessories &amp; Stock ({batches.length})
                        </button>
                    </div>
                </div>

                {/* TAB 1: CAPITAL HARDWARE PURCHASES */}
                {activeTab === 'purchases' && (
                    <div className="bg-surface rounded-2xl shadow-md border border-line">
                        <div className="p-5 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-line">
                            <div className="relative w-full sm:w-auto">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-quiet">{ICONS.search}</span>
                                <input
                                    type="text"
                                    placeholder="Search by invoice or vendor..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-canvas border border-line rounded-xl w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                                />
                            </div>
                            <button onClick={() => handleOpenForm()} className="bg-accent text-on-strong px-5 py-2.5 rounded-xl hover:bg-accent w-full sm:w-auto font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-strong/15">
                                <div className="w-4 h-4">{ICONS.add}</div>
                                Add Hardware Purchase
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            {filteredPurchases.map(purchase => (
                                <div key={purchase.id} onClick={() => setSelectedPurchaseId(purchase.id)} className="bg-canvas p-4 rounded-xl flex items-center justify-between border border-line/80 cursor-pointer hover:bg-muted transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-ink">{purchase.invoiceNumber}</p>
                                            {(purchase as any).poNumber && (
                                                <span className="text-xs bg-muted/80 text-ink px-2 py-0.5 rounded font-mono">
                                                    PO: {(purchase as any).poNumber}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-quiet">{purchase.vendor || 'No Vendor'}</p>
                                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                                            <p className="text-xs text-quiet">
                                                {purchase.purchaseDate ? new Date(purchase.purchaseDate).toLocaleDateString() : 'N/A'}
                                            </p>
                                            {(purchase as any).assets?.length > 0 && (
                                                <span className="text-xs bg-muted text-quiet px-2 py-0.5 rounded-full font-medium">
                                                    {(purchase as any).assets.length} Asset(s)
                                                </span>
                                            )}
                                            {purchase.amount != null && (
                                                <span className="text-xs bg-surface text-ink px-2 py-0.5 rounded-full font-semibold">
                                                    ₹{purchase.amount.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1 flex-shrink-0">
                                        <button onClick={(e) => handleDeletePurchase(purchase.id, e)} className="p-2 text-quiet rounded-full hover:bg-surface hover:text-ink" title="Delete">{ICONS.delete}</button>
                                        <div className="p-2 text-quiet">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredPurchases.length === 0 && (
                                <p className="text-xs text-quiet text-center py-8">No hardware purchases found.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: ACCESSORY BATCHES & STOCK */}
                {activeTab === 'accessories' && (
                    <div className="bg-surface rounded-2xl shadow-md border border-line">
                        <div className="p-5 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-line">
                            <div className="relative w-full sm:w-auto">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-quiet">{ICONS.search}</span>
                                <input
                                    type="text"
                                    placeholder="Search mice, keyboards, vendors..."
                                    value={accessorySearchTerm}
                                    onChange={(e) => setAccessorySearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-canvas border border-line rounded-xl w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                                />
                            </div>
                            <button
                                onClick={() => handleOpenBatchModal()}
                                className="bg-accent text-on-strong px-5 py-2.5 rounded-xl hover:bg-accent w-full sm:w-auto font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-strong/15"
                            >
                                <div className="w-4 h-4">{ICONS.add}</div>
                                Record Accessory Batch
                            </button>
                        </div>

                        {/* Batch Inventory Cards */}
                        <div className="p-5 space-y-3">
                            {isLoadingBatches ? (
                                <p className="text-xs text-quiet text-center py-8">Loading accessory batches...</p>
                            ) : filteredBatches.length > 0 ? (
                                filteredBatches.map(batch => (
                                    <div
                                        key={batch.id}
                                        className="bg-canvas p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-line/80 hover:border-line transition-all"
                                    >
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center text-xl shrink-0 shadow-sm">
                                                {CATEGORY_ICONS[batch.category] || '📦'}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-bold text-ink truncate">
                                                        {batch.name}
                                                    </h4>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-ink">
                                                        {batch.category}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2.5 mt-1 flex-wrap text-xs text-quiet">
                                                    {batch.brand && <span>Brand: <strong>{batch.brand}</strong></span>}
                                                    {batch.vendor && <span>Vendor: <strong>{batch.vendor}</strong></span>}
                                                    {batch.invoiceNumber && <span className="font-mono">Inv: {batch.invoiceNumber}</span>}
                                                    <span>Bought: {new Date(batch.purchaseDate).toLocaleDateString()}</span>
                                                </div>

                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    {/* Stock Level Badge */}
                                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                                                        batch.quantityAvailable > 0
                                                            ? 'bg-surface text-ink   border-line '
                                                            : 'bg-surface text-ink   border-line '
                                                    }`}>
                                                        📦 Stock: {batch.quantityAvailable} of {batch.quantityPurchased} available ({batch._count?.assignments || (batch.quantityPurchased - batch.quantityAvailable)} issued)
                                                    </span>

                                                    {/* Warranty Status Badge */}
                                                    {getWarrantyBadge(batch)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 shrink-0 self-end sm:self-center">
                                            <button
                                                onClick={() => handleOpenBatchModal(batch)}
                                                className="px-3 py-1.5 rounded-lg bg-muted text-ink hover:bg-muted text-xs font-bold transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteBatch(batch.id, e)}
                                                className="p-1.5 text-quiet hover:text-ink rounded-lg hover:bg-surface transition-all"
                                                title="Delete Batch"
                                            >
                                                {ICONS.delete}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 space-y-2">
                                    <p className="text-3xl">🖱️</p>
                                    <p className="text-sm font-bold text-ink">No accessory batches recorded yet</p>
                                    <p className="text-xs text-quiet max-w-sm mx-auto">
                                        Track newly purchased mice, keyboards, and headsets here with warranty coverage without cluttering your machine inventory.
                                    </p>
                                    <button
                                        onClick={() => handleOpenBatchModal()}
                                        className="mt-2 text-xs font-bold text-ink hover:underline"
                                    >
                                        + Record First Accessory Batch &rarr;
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default PurchaseManagement;