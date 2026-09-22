import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { AccessoryBatch } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';

interface AccessoryBatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    batch?: AccessoryBatch | null;
    onSaved: () => void;
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

const AccessoryBatchModal: React.FC<AccessoryBatchModalProps> = ({
    isOpen,
    onClose,
    batch,
    onSaved
}) => {
    const { setNotification, getHeaders } = useAppContext();

    const [formData, setFormData] = useState({
        name: '',
        category: 'Mouse',
        brand: '',
        model: '',
        quantityPurchased: '10',
        purchaseDate: new Date().toISOString().split('T')[0],
        warrantyMonths: '12',
        vendor: '',
        invoiceNumber: '',
        unitCost: '',
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (batch) {
            setFormData({
                name: batch.name || '',
                category: batch.category || 'Mouse',
                brand: batch.brand || '',
                model: batch.model || '',
                quantityPurchased: String(batch.quantityPurchased || '1'),
                purchaseDate: batch.purchaseDate ? batch.purchaseDate.split('T')[0] : new Date().toISOString().split('T')[0],
                warrantyMonths: batch.warrantyMonths !== null && batch.warrantyMonths !== undefined ? String(batch.warrantyMonths) : '12',
                vendor: batch.vendor || '',
                invoiceNumber: batch.invoiceNumber || '',
                unitCost: batch.unitCost ? String(batch.unitCost) : '',
                notes: batch.notes || ''
            });
        } else {
            setFormData({
                name: '',
                category: 'Mouse',
                brand: '',
                model: '',
                quantityPurchased: '10',
                purchaseDate: new Date().toISOString().split('T')[0],
                warrantyMonths: '12',
                vendor: '',
                invoiceNumber: '',
                unitCost: '',
                notes: ''
            });
        }
    }, [batch, isOpen]);

    // Live warranty end date calculation
    const computedWarrantyEnd = (() => {
        if (!formData.purchaseDate || !formData.warrantyMonths || Number(formData.warrantyMonths) <= 0) {
            return null;
        }
        try {
            const d = new Date(formData.purchaseDate);
            d.setMonth(d.getMonth() + Number(formData.warrantyMonths));
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return null;
        }
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setNotification({ message: 'Please enter accessory name/description.', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            const url = batch ? `${API_URL}/api/accessories/batches/${batch.id}` : `${API_URL}/api/accessories/batches`;
            const method = batch ? 'PUT' : 'POST';

            const payload = {
                ...formData,
                quantityPurchased: Number(formData.quantityPurchased) || 1,
                warrantyMonths: formData.warrantyMonths ? Number(formData.warrantyMonths) : null,
                unitCost: formData.unitCost ? Number(formData.unitCost) : null
            };

            const res = await fetch(url, {
                method,
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to save accessory batch');
            }

            setNotification({
                message: batch ? 'Accessory batch updated successfully!' : 'New accessory purchase batch created!',
                type: 'success'
            });
            onSaved();
            onClose();
        } catch (err: any) {
            setNotification({ message: err.message || 'Error saving batch', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={batch ? 'Edit Accessory Purchase Batch' : 'Record Accessory Purchase Batch'}
            maxWidth="max-w-xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4 py-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Category *
                        </label>
                        <select
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Brand / Make
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Dell, Logitech, HP"
                            value={formData.brand}
                            onChange={e => setFormData({ ...formData, brand: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Accessory Name &amp; Description *
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="e.g. Dell Optical Mouse MS116 (Black)"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Quantity Bought *
                        </label>
                        <input
                            type="number"
                            min="1"
                            required
                            value={formData.quantityPurchased}
                            onChange={e => setFormData({ ...formData, quantityPurchased: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Purchase Date *
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.purchaseDate}
                            onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Warranty (Months)
                        </label>
                        <select
                            value={formData.warrantyMonths}
                            onChange={e => setFormData({ ...formData, warrantyMonths: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                        >
                            <option value="0">No Warranty / 0 Mo</option>
                            <option value="6">6 Months</option>
                            <option value="12">1 Year (12 Mo)</option>
                            <option value="24">2 Years (24 Mo)</option>
                            <option value="36">3 Years (36 Mo)</option>
                            <option value="60">5 Years (60 Mo)</option>
                        </select>
                    </div>
                </div>

                {/* Live Warranty Expiry Preview */}
                {computedWarrantyEnd && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
                            🛡️ Warranty Coverage:
                        </span>
                        <span className="font-bold text-emerald-900 dark:text-emerald-200">
                            Valid until {computedWarrantyEnd}
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Vendor / Supplier
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Amazon Business, Dell Direct"
                            value={formData.vendor}
                            onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Invoice / Bill Number
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. INV-2026-0412"
                            value={formData.invoiceNumber}
                            onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-brand-500 font-mono"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Notes / Remarks
                    </label>
                    <textarea
                        rows={2}
                        placeholder="Optional batch notes (e.g. for new joiner welcome kits)..."
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
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
                        disabled={isSubmitting}
                        className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors shadow-md shadow-brand-500/20 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving...' : batch ? 'Update Batch' : 'Save Batch & Stock'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AccessoryBatchModal;
