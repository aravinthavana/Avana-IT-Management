import { API_URL } from '../../utils/apiClient';
import React, { useState, useEffect, useRef } from 'react';
import { Asset, ServiceRecord } from '../../types';
import { ICONS } from '../../constants';
import { useAppContext } from '../../hooks/useAppContext';

interface ServiceRecordModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset;
    serviceToEdit?: ServiceRecord | null;
    onServiceSaved: (savedService: ServiceRecord, updatedAssetStatus?: string) => void;
}

const SERVICE_TYPES = [
    'Repair',
    'Preventive Maintenance',
    'Screen Replacement',
    'Battery Replacement',
    'Hardware Upgrade',
    'Warranty Claim',
    'Diagnostics & Troubleshooting',
    'OS / Software Reinstallation',
    'Other'
];

const ServiceRecordModal: React.FC<ServiceRecordModalProps> = ({
    isOpen,
    onClose,
    asset,
    serviceToEdit,
    onServiceSaved,
}) => {
    const { getHeaders, setNotification } = useAppContext();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [serviceType, setServiceType] = useState<string>('Repair');
    const [status, setStatus] = useState<'In Progress' | 'Completed' | 'Cancelled'>('Completed');
    const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [completionDate, setCompletionDate] = useState<string>('');
    const [vendor, setVendor] = useState<string>('');
    const [vendorContact, setVendorContact] = useState<string>('');
    const [invoiceNumber, setInvoiceNumber] = useState<string>('');
    const [cost, setCost] = useState<string>('0');
    const [isWarrantyClaim, setIsWarrantyClaim] = useState<boolean>(false);
    const [issueDescription, setIssueDescription] = useState<string>('');
    const [workDone, setWorkDone] = useState<string>('');
    const [invoiceAttachmentUrl, setInvoiceAttachmentUrl] = useState<string>('');
    const [invoiceAttachmentFilename, setInvoiceAttachmentFilename] = useState<string>('');
    const [updateAssetStatus, setUpdateAssetStatus] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    useEffect(() => {
        if (!isOpen) return;

        if (serviceToEdit) {
            setServiceType(serviceToEdit.serviceType || 'Repair');
            setStatus(serviceToEdit.status || 'Completed');
            setServiceDate(serviceToEdit.serviceDate ? new Date(serviceToEdit.serviceDate).toISOString().split('T')[0] : '');
            setCompletionDate(serviceToEdit.completionDate ? new Date(serviceToEdit.completionDate).toISOString().split('T')[0] : '');
            setVendor(serviceToEdit.vendor || '');
            setVendorContact(serviceToEdit.vendorContact || '');
            setInvoiceNumber(serviceToEdit.invoiceNumber || '');
            setCost(serviceToEdit.cost !== undefined && serviceToEdit.cost !== null ? serviceToEdit.cost.toString() : '0');
            setIsWarrantyClaim(Boolean(serviceToEdit.isWarrantyClaim));
            setIssueDescription(serviceToEdit.issueDescription || '');
            setWorkDone(serviceToEdit.workDone || '');
            setInvoiceAttachmentUrl(serviceToEdit.invoiceAttachmentUrl || '');
            setInvoiceAttachmentFilename(serviceToEdit.invoiceAttachmentFilename || '');
            setUpdateAssetStatus(false);
        } else {
            // New record default
            setServiceType('Repair');
            setStatus('Completed');
            const today = new Date().toISOString().split('T')[0];
            setServiceDate(today);
            setCompletionDate(today);
            setVendor('');
            setVendorContact('');
            setInvoiceNumber('');
            setCost('0');
            setIsWarrantyClaim(false);
            setIssueDescription('');
            setWorkDone('');
            setInvoiceAttachmentUrl('');
            setInvoiceAttachmentFilename('');
            setUpdateAssetStatus(true);
        }
    }, [isOpen, serviceToEdit]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Size check (max 15MB)
        if (file.size > 15 * 1024 * 1024) {
            setNotification({ message: 'File is too large. Max attachment size is 15MB.', type: 'error' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const dataUrl = loadEvent.target?.result as string;
            setInvoiceAttachmentUrl(dataUrl);
            setInvoiceAttachmentFilename(file.name);
        };
        reader.onerror = () => {
            setNotification({ message: 'Failed to read file', type: 'error' });
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveFile = () => {
        setInvoiceAttachmentUrl('');
        setInvoiceAttachmentFilename('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!issueDescription.trim()) {
            setNotification({ message: 'Please describe the issue or reason for service.', type: 'error' });
            return;
        }
        if (!serviceDate) {
            setNotification({ message: 'Service date is required.', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            const apiUrl = API_URL;
            const payload = {
                serviceType,
                serviceDate,
                completionDate: completionDate ? completionDate : null,
                vendor: vendor.trim() || null,
                vendorContact: vendorContact.trim() || null,
                invoiceNumber: invoiceNumber.trim() || null,
                cost: isWarrantyClaim ? 0 : parseFloat(cost) || 0,
                isWarrantyClaim,
                issueDescription: issueDescription.trim(),
                workDone: workDone.trim() || null,
                status,
                invoiceAttachmentUrl: invoiceAttachmentUrl || null,
                invoiceAttachmentFilename: invoiceAttachmentFilename || null,
                updateAssetStatus,
                targetAssetStatus: status === 'In Progress' ? 'In Repair' : (status === 'Completed' && asset.status === 'In Repair' ? 'In Stock' : undefined),
            };

            const isEdit = Boolean(serviceToEdit);
            const url = isEdit
                ? `${apiUrl}/api/services/${serviceToEdit!.id}`
                : `${apiUrl}/api/assets/${asset.id}/services`;

            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Failed to ${isEdit ? 'update' : 'create'} service record`);
            }

            const saved = await res.json();
            setNotification({
                message: `Service record ${saved.serviceId} ${isEdit ? 'updated' : 'logged'} successfully!`,
                type: 'success'
            });

            const resultingAssetStatus = updateAssetStatus ? payload.targetAssetStatus : undefined;
            onServiceSaved(saved, resultingAssetStatus);
            onClose();
        } catch (err: any) {
            console.error('Service record submit error:', err);
            setNotification({ message: err.message || 'An error occurred while saving', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm overflow-y-auto animate-fade-in bg-slate-900/60">
            <div className="rounded-3xl shadow-2xl border w-full max-w-2xl max-h-[calc(100dvh-1rem)] flex flex-col overflow-hidden my-auto animate-scale-in bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                {/* Modal Header */}
                <div className="px-6 py-4 sm:px-8 sm:py-5 border-b flex justify-between items-center shrink-0 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-xl text-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                                🛠️
                            </span>
                            <h3 className="text-lg sm:text-xl font-bold truncate text-slate-900 dark:text-white">
                                {serviceToEdit ? `Edit Service Record (${serviceToEdit.serviceId})` : 'Log Asset Service & Repair'}
                            </h3>
                        </div>
                        <p className="text-xs mt-0.5 truncate text-slate-500 dark:text-slate-400">
                            {asset.name} &bull; <span className="font-mono font-semibold">{asset.assetId}</span> ({asset.category})
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                        aria-label="Close modal"
                    >
                        {ICONS.close}
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                    {/* 1. Service Type & Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-300">
                                Service Type <span className="text-red-500">*</span>
                            </label>
                            <select aria-label="Service Type"
                                value={serviceType}
                                onChange={(e) => setServiceType(e.target.value)}
                                className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 outline-none transition-all bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-brand-500"
                            >
                                {SERVICE_TYPES.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-300">
                                Service Status <span className="text-red-500">*</span>
                            </label>
                            <select aria-label="Service Status"
                                value={status}
                                onChange={(e) => {
                                    const nextStatus = e.target.value as 'In Progress' | 'Completed' | 'Cancelled';
                                    setStatus(nextStatus);
                                    if (nextStatus === 'Completed' && !completionDate) {
                                        setCompletionDate(new Date().toISOString().split('T')[0]);
                                    }
                                }}
                                className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 outline-none transition-all font-semibold bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-brand-500"
                            >
                                <option value="Completed">Completed (Returned)</option>
                                <option value="In Progress">In Progress (At Service Center)</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* 2. Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-300">
                                Service / Handover Date <span className="text-red-500">*</span>
                            </label>
                            <input aria-label="Service / Handover Date"
                                type="date"
                                required
                                value={serviceDate}
                                onChange={(e) => setServiceDate(e.target.value)}
                                className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 outline-none transition-all bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-300">
                                Completion / Return Date {status === 'Completed' && <span className="font-normal text-slate-400">(Optional)</span>}
                            </label>
                            <input aria-label="Completion / Return Date"
                                type="date"
                                value={completionDate}
                                onChange={(e) => setCompletionDate(e.target.value)}
                                className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 outline-none transition-all bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-brand-500"
                            />
                        </div>
                    </div>

                    {/* 3. Vendor & Reference */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-300">
                                Vendor / Service Center
                            </label>
                            <input aria-label="Vendor / Service Center"
                                type="text"
                                placeholder="e.g. Dell Authorized Care"
                                value={vendor}
                                onChange={(e) => setVendor(e.target.value)}
                                className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 outline-none transition-all bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-300">
                                Vendor Contact
                            </label>
                            <input aria-label="Vendor Contact"
                                type="text"
                                placeholder="Phone / Email / Address"
                                value={vendorContact}
                                onChange={(e) => setVendorContact(e.target.value)}
                                className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 outline-none transition-all bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-300">
                                Invoice / Job Sheet No.
                            </label>
                            <input aria-label="Invoice / Job Sheet No."
                                type="text"
                                placeholder="e.g. INV-2026-88"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 outline-none transition-all bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-brand-500"
                            />
                        </div>
                    </div>

                    {/* 4. Financials / Cost */}
                    <div className="p-4 rounded-2xl border space-y-3 bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                                    Service Cost (₹)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-500 dark:text-slate-400">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        disabled={isWarrantyClaim}
                                        value={isWarrantyClaim ? '0' : cost}
                                        onChange={(e) => setCost(e.target.value)}
                                        className="w-full border rounded-xl pl-8 pr-3.5 py-2 text-sm font-semibold outline-none focus:ring-2 transition-all disabled:opacity-50 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white focus:ring-brand-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/40"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2 sm:pt-4">
                                <input
                                    id="warranty-claim-toggle"
                                    type="checkbox"
                                    checked={isWarrantyClaim}
                                    onChange={(e) => {
                                        setIsWarrantyClaim(e.target.checked);
                                        if (e.target.checked) setCost('0');
                                    }}
                                    className="w-4 h-4 rounded cursor-pointer text-brand-600 border-slate-300 focus:ring-brand-500"
                                />
                                <label htmlFor="warranty-claim-toggle" className="text-xs font-bold cursor-pointer select-none text-slate-700 dark:text-slate-200">
                                    Covered under OEM Warranty (Free / ₹0)
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 5. Issue & Work Done */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-300">
                                Problem / Issue Reported <span className="text-red-500">*</span>
                            </label>
                            <textarea aria-label="Problem / Issue Reported"
                                required
                                rows={2}
                                placeholder="Describe the issue (e.g. Screen flickering, Battery health degraded, RAM upgrade required)..."
                                value={issueDescription}
                                onChange={(e) => setIssueDescription(e.target.value)}
                                className="w-full border rounded-xl p-3 text-sm focus:ring-2 outline-none transition-all bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-300">
                                Work Done / Resolution & Parts Replaced
                            </label>
                            <textarea aria-label="Work Done / Resolution & Parts Replaced"
                                rows={2}
                                placeholder="Resolution details (e.g. Replaced display panel with OEM part, Installed 16GB DDR4 RAM, Cleaned heat sink)..."
                                value={workDone}
                                onChange={(e) => setWorkDone(e.target.value)}
                                className="w-full border rounded-xl p-3 text-sm focus:ring-2 outline-none transition-all bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-brand-500"
                            />
                        </div>
                    </div>

                    {/* 6. Invoice & Document Attachment */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-300">
                            Attach Service Invoice / Job Sheet (PDF, Image)
                        </label>

                        {invoiceAttachmentFilename ? (
                            <div className="flex items-center justify-between p-3 border rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-base shrink-0">{ICONS.paperclip}</span>
                                    <span className="text-xs font-bold truncate">{invoiceAttachmentFilename}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="p-1 rounded-lg transition-colors ml-2 shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                                    title="Remove attachment"
                                >
                                    {ICONS.close}
                                </button>
                            </div>
                        ) : (
                            <div className="relative border-2 border-dashed rounded-2xl p-4 text-center transition-all border-slate-300 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-400 bg-slate-50/50 dark:bg-slate-900/30">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".pdf,image/*"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                                        📄
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                        Click to upload or drag & drop invoice
                                    </p>
                                    <p className="text-[11px] text-slate-400">PDF, PNG, JPG (Max 15MB)</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 7. Asset Status Sync Options */}
                    {!serviceToEdit && (
                        <div className="p-3.5 border rounded-2xl flex items-start gap-3 bg-brand-50/60 dark:bg-brand-950/30 border-brand-200/60 dark:border-brand-800/40">
                            <input
                                id="status-sync-toggle"
                                type="checkbox"
                                checked={updateAssetStatus}
                                onChange={(e) => setUpdateAssetStatus(e.target.checked)}
                                className="w-4 h-4 rounded mt-0.5 cursor-pointer text-brand-600 border-slate-300 focus:ring-brand-500"
                            />
                            <div className="text-xs">
                                <label htmlFor="status-sync-toggle" className="font-bold cursor-pointer select-none text-slate-800 dark:text-white">
                                    Synchronize Asset Status Automatically
                                </label>
                                <p className="mt-0.5 leading-relaxed text-slate-500 dark:text-slate-400">
                                    {status === 'In Progress' ? (
                                        <>Will update this machine&#39;s status to <span className="font-bold text-amber-600 dark:text-amber-400">In Repair</span>.</>
                                    ) : (
                                        <>Will keep or return this machine&#39;s status to <span className="font-bold text-emerald-600 dark:text-emerald-400">In Stock</span> if it was In Repair.</>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Modal Actions */}
                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl border font-semibold text-xs sm:text-sm transition-colors border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 rounded-xl active:scale-95 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50 bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/20"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin border-white"></div>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>{serviceToEdit ? 'Save Changes' : 'Log Service Record'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ServiceRecordModal;
