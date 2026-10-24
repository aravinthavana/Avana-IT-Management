import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import React, { useState, useEffect } from 'react';
import { License } from '../../types';

interface LicenseFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (l: License) => void;
    license: License | null;
}

const inputClass = "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-brand-500 text-slate-900";
const labelClass = "block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300";

const LicenseForm: React.FC<LicenseFormProps> = ({ isOpen, onClose, onSave, license }) => {

    const dialogRef = useDialogAccessibility(isOpen, onClose);
    const [formData, setFormData] = useState<Partial<License>>({
        name: '', category: 'Software', key: '', seats: 1,
        status: 'Active', remarks: '', startDate: '', expirationDate: '', cost: undefined
    });

    useEffect(() => {
        if (license) {
            setFormData(license);
        } else {
            setFormData({ name: '', category: 'Software', key: '', seats: 1, status: 'Active', remarks: '', startDate: '', expirationDate: '', cost: undefined });
        }
    }, [license, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as License);
    };

    const set = (field: keyof License, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

    return (
        <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="License details" className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black/60">
            <div className="rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto bg-white dark:bg-slate-800">
                <h2 className="text-xl font-bold mb-5 text-slate-800 dark:text-slate-100">{license ? 'Edit License' : 'Add License'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Basic Info */}
                    <div>
                        <label className={labelClass}>License Name *</label>
                        <input aria-label="License Name *" required type="text" value={formData.name} onChange={(e) => set('name', e.target.value)} className={inputClass} placeholder="e.g. Microsoft 365 Business" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Category</label>
                            <select aria-label="Category" value={formData.category} onChange={(e) => set('category', e.target.value)} className={inputClass}>
                                <option value="Software">Software</option>
                                <option value="Cloud Service">Cloud Service</option>
                                <option value="Subscription">Subscription</option>
                                <option value="Operating System">Operating System</option>
                                <option value="Antivirus">Antivirus</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Status</label>
                            <select aria-label="Status" value={formData.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
                                <option value="Active">Active</option>
                                <option value="Expiring Soon">Expiring Soon</option>
                                <option value="Expired">Expired</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Seats & Cost */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Seats / Quantity *</label>
                            <input aria-label="Seats / Quantity *" required type="number" min="1" value={formData.seats} onChange={(e) => set('seats', parseInt(e.target.value))} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Cost (₹ / $)</label>
                            <input aria-label="Cost (₹ / $)" type="number" min="0" step="0.01" value={formData.cost ?? ''} onChange={(e) => set('cost', e.target.value ? parseFloat(e.target.value) : undefined)} className={inputClass} placeholder="e.g. 5000" />
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Start Date</label>
                            <input aria-label="Start Date" type="date" value={formData.startDate ? String(formData.startDate).split('T')[0] : ''} onChange={(e) => set('startDate', e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Expiration Date</label>
                            <input aria-label="Expiration Date" type="date" value={formData.expirationDate ? String(formData.expirationDate).split('T')[0] : ''} onChange={(e) => set('expirationDate', e.target.value)} className={inputClass} />
                        </div>
                    </div>

                    {/* Key & Remarks */}
                    <div>
                        <label className={labelClass}>License Key / Portal Link</label>
                        <input aria-label="License Key / Portal Link" type="text" value={formData.key || ''} onChange={(e) => set('key', e.target.value)} className={inputClass} placeholder="e.g. XXXXX-XXXXX-XXXXX or https://..." />
                    </div>
                    <div>
                        <label className={labelClass}>Remarks / Notes</label>
                        <textarea aria-label="Remarks / Notes"
                            rows={3}
                            value={formData.remarks || ''}
                            onChange={(e) => set('remarks', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-none dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-brand-500 text-slate-900"
                            placeholder="Any additional notes about this license..."
                        />
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded-lg transition-colors font-medium bg-brand-600 hover:bg-brand-700 text-white">Save License</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LicenseForm;
