import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { AccessoryBatch, User } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';

interface IssueAccessoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    onIssued: () => void;
}

const CATEGORIES = [
    'Mouse',
    'Keyboard',
    'Headset',
    'Monitor',
    'Pen Drive',
    'Dock',
    'Bag',
    'Adapter',
    'Other'
];

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

const IssueAccessoryModal: React.FC<IssueAccessoryModalProps> = ({
    isOpen,
    onClose,
    user,
    onIssued
}) => {
    const { setNotification, getHeaders } = useAppContext();

    const [mode, setMode] = useState<'batch' | 'custom'>('batch');
    const [batches, setBatches] = useState<AccessoryBatch[]>([]);
    const [isLoadingBatches, setIsLoadingBatches] = useState(false);

    // Form state
    const [selectedBatchId, setSelectedBatchId] = useState<string>('');
    const [customCategory, setCustomCategory] = useState('Mouse');
    const [customName, setCustomName] = useState('');
    const [customBrand, setCustomBrand] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [condition, setCondition] = useState('Good');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchBatches();
        }
    }, [isOpen]);

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
                const firstAvailable = data.find(b => b.quantityAvailable > 0);
                if (firstAvailable) {
                    setSelectedBatchId(String(firstAvailable.id));
                } else if (data.length > 0) {
                    setSelectedBatchId(String(data[0].id));
                } else {
                    setMode('custom');
                }
            }
        } catch (e) {
            console.error('Error fetching accessory batches:', e);
        } finally {
            setIsLoadingBatches(false);
        }
    };

    const selectedBatch = batches.find(b => String(b.id) === selectedBatchId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = mode === 'batch' ? {
                batchId: Number(selectedBatchId),
                condition,
                serialNumber: serialNumber.trim() || undefined,
                notes: notes.trim() || undefined
            } : {
                category: customCategory,
                name: customName.trim(),
                brand: customBrand.trim() || undefined,
                serialNumber: serialNumber.trim() || undefined,
                condition,
                notes: notes.trim() || undefined
            };

            if (mode === 'custom' && !customName.trim()) {
                setNotification({ message: 'Please enter accessory name.', type: 'error' });
                setIsSubmitting(false);
                return;
            }

            const res = await fetch(`${API_URL}/api/users/${user.id}/accessories`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to issue accessory');
            }

            setNotification({
                message: `Accessory successfully issued to ${user.name}!`,
                type: 'success'
            });
            onIssued();
            onClose();
        } catch (err: any) {
            setNotification({ message: err.message || 'Error issuing accessory', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Issue Accessory to ${user.name}`}
            maxWidth="max-w-lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4 py-1">
                {/* Mode Selector */}
                <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-900 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setMode('batch')}
                        className={`flex-1 py-2 rounded-lg transition-all ${
                            mode === 'batch'
                                ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                    >
                        📦 Issue from Stock Batch ({batches.filter(b => b.quantityAvailable > 0).length} in stock)
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('custom')}
                        className={`flex-1 py-2 rounded-lg transition-all ${
                            mode === 'custom'
                                ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                    >
                        ✍️ Custom / Legacy Accessory
                    </button>
                </div>

                {/* MODE 1: From Stock Batch */}
                {mode === 'batch' && (
                    <div className="space-y-3">
                        {batches.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                                <p>No accessory batches recorded yet.</p>
                                <button
                                    type="button"
                                    onClick={() => setMode('custom')}
                                    className="mt-2 text-brand-600 font-bold hover:underline"
                                >
                                    Switch to Custom Accessory &rarr;
                                </button>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Select Stock Batch *
                                </label>
                                <select
                                    value={selectedBatchId}
                                    onChange={e => setSelectedBatchId(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                                >
                                    {batches.map(b => (
                                        <option
                                            key={b.id}
                                            value={b.id}
                                            disabled={b.quantityAvailable < 1}
                                        >
                                            {b.name} ({b.category}) — {b.quantityAvailable} in stock
                                            {b.quantityAvailable < 1 ? ' [OUT OF STOCK]' : ''}
                                        </option>
                                    ))}
                                </select>

                                {/* Batch Details & Warranty Preview */}
                                {selectedBatch && (
                                    <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Available in Stock:</span>
                                            <span className={`font-bold ${selectedBatch.quantityAvailable > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {selectedBatch.quantityAvailable} of {selectedBatch.quantityPurchased} units
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Purchased Date:</span>
                                            <span className="font-medium text-slate-800 dark:text-slate-200">
                                                {new Date(selectedBatch.purchaseDate).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {selectedBatch.warrantyEndDate && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Warranty Coverage:</span>
                                                <span className={`font-bold ${
                                                    new Date(selectedBatch.warrantyEndDate) > new Date() ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                                                }`}>
                                                    {new Date(selectedBatch.warrantyEndDate) > new Date()
                                                        ? `Valid until ${new Date(selectedBatch.warrantyEndDate).toLocaleDateString()}`
                                                        : `Expired on ${new Date(selectedBatch.warrantyEndDate).toLocaleDateString()}`
                                                    }
                                                </span>
                                            </div>
                                        )}
                                        {selectedBatch.invoiceNumber && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Invoice:</span>
                                                <span className="font-mono text-slate-700 dark:text-slate-300">
                                                    {selectedBatch.invoiceNumber} {selectedBatch.vendor ? `(${selectedBatch.vendor})` : ''}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* MODE 2: Custom / Legacy Entry */}
                {mode === 'custom' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Category *
                                </label>
                                <select
                                    value={customCategory}
                                    onChange={e => setCustomCategory(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                                >
                                    {CATEGORIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Brand / Make
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Dell, Logitech"
                                    value={customBrand}
                                    onChange={e => setCustomBrand(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Accessory Name *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Dell Wireless Mouse WM126"
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                            />
                        </div>
                    </div>
                )}

                {/* Common fields for both modes */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Serial Number (Optional)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. CN-0J74X2..."
                            value={serialNumber}
                            onChange={e => setSerialNumber(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500 font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Condition
                        </label>
                        <select
                            value={condition}
                            onChange={e => setCondition(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                        >
                            <option value="New">Brand New</option>
                            <option value="Good">Good Condition</option>
                            <option value="Fair">Fair / Working</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Issue Remarks (Optional)
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Issued for home office desk setup..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                    />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || (mode === 'batch' && (!selectedBatch || selectedBatch.quantityAvailable < 1))}
                        className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors shadow-md shadow-brand-500/20 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Issuing...' : 'Issue to Employee'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default IssueAccessoryModal;
