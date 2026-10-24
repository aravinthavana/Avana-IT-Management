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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-strong/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
            <div className="bg-surface rounded-3xl shadow-2xl border border-line w-full max-w-2xl max-h-[calc(100dvh-1rem)] flex flex-col overflow-hidden my-auto animate-scale-in">
                {/* Modal Header */}
                <div className="px-6 py-4 sm:px-8 sm:py-5 border-b border-line flex justify-between items-center bg-canvas/70 shrink-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-surface text-ink rounded-xl text-lg">
                                🛠️
                            </span>
                            <h3 className="text-lg sm:text-xl font-bold text-ink truncate">
                                {serviceToEdit ? `Edit Service Record (${serviceToEdit.serviceId})` : 'Log Asset Service & Repair'}
                            </h3>
                        </div>
                        <p className="text-xs text-quiet mt-0.5 truncate">
                            {asset.name} &bull; <span className="font-mono font-semibold">{asset.assetId}</span> ({asset.category})
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-quiet hover:text-quiet p-2 rounded-xl hover:bg-muted transition-colors"
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
                            <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                                Service Type <span className="text-ink">*</span>
                            </label>
                            <select aria-label="Service Type"
                                value={serviceType}
                                onChange={(e) => setServiceType(e.target.value)}
                                className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink focus:ring-2 focus:ring-accent outline-none transition-all"
                            >
                                {SERVICE_TYPES.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                                Service Status <span className="text-ink">*</span>
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
                                className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink focus:ring-2 focus:ring-accent outline-none transition-all font-semibold"
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
                            <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                                Service / Handover Date <span className="text-ink">*</span>
                            </label>
                            <input aria-label="Service / Handover Date"
                                type="date"
                                required
                                value={serviceDate}
                                onChange={(e) => setServiceDate(e.target.value)}
                                className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink focus:ring-2 focus:ring-accent outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                                Completion / Return Date {status === 'Completed' && <span className="text-quiet font-normal">(Optional)</span>}
                            </label>
                            <input aria-label="Completion / Return Date"
                                type="date"
                                value={completionDate}
                                onChange={(e) => setCompletionDate(e.target.value)}
                                className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink focus:ring-2 focus:ring-accent outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* 3. Vendor & Reference */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                                Vendor / Service Center
                            </label>
                            <input aria-label="Vendor / Service Center"
                                type="text"
                                placeholder="e.g. Dell Authorized Care"
                                value={vendor}
                                onChange={(e) => setVendor(e.target.value)}
                                className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink focus:ring-2 focus:ring-accent outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                                Vendor Contact
                            </label>
                            <input aria-label="Vendor Contact"
                                type="text"
                                placeholder="Phone / Email / Address"
                                value={vendorContact}
                                onChange={(e) => setVendorContact(e.target.value)}
                                className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink focus:ring-2 focus:ring-accent outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                                Invoice / Job Sheet No.
                            </label>
                            <input aria-label="Invoice / Job Sheet No."
                                type="text"
                                placeholder="e.g. INV-2026-88"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink focus:ring-2 focus:ring-accent outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* 4. Financials / Cost */}
                    <div className="p-4 bg-canvas rounded-2xl border border-line space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1">
                                    Service Cost (₹)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-quiet font-semibold">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        disabled={isWarrantyClaim}
                                        value={isWarrantyClaim ? '0' : cost}
                                        onChange={(e) => setCost(e.target.value)}
                                        className="w-full bg-surface border border-line rounded-xl pl-8 pr-3.5 py-2 text-sm text-ink font-semibold outline-none focus:ring-2 focus:ring-accent transition-all disabled:opacity-50 disabled:bg-muted"
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
                                    className="w-4 h-4 text-ink rounded border-line focus:ring-accent cursor-pointer"
                                />
                                <label htmlFor="warranty-claim-toggle" className="text-xs font-bold text-ink cursor-pointer select-none">
                                    Covered under OEM Warranty (Free / ₹0)
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 5. Issue & Work Done */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                                Problem / Issue Reported <span className="text-ink">*</span>
                            </label>
                            <textarea aria-label="Problem / Issue Reported"
                                required
                                rows={2}
                                placeholder="Describe the issue (e.g. Screen flickering, Battery health degraded, RAM upgrade required)..."
                                value={issueDescription}
                                onChange={(e) => setIssueDescription(e.target.value)}
                                className="w-full bg-canvas border border-line rounded-xl p-3 text-sm text-ink focus:ring-2 focus:ring-accent outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                                Work Done / Resolution & Parts Replaced
                            </label>
                            <textarea aria-label="Work Done / Resolution & Parts Replaced"
                                rows={2}
                                placeholder="Resolution details (e.g. Replaced display panel with OEM part, Installed 16GB DDR4 RAM, Cleaned heat sink)..."
                                value={workDone}
                                onChange={(e) => setWorkDone(e.target.value)}
                                className="w-full bg-canvas border border-line rounded-xl p-3 text-sm text-ink focus:ring-2 focus:ring-accent outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* 6. Invoice & Document Attachment */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                            Attach Service Invoice / Job Sheet (PDF, Image)
                        </label>

                        {invoiceAttachmentFilename ? (
                            <div className="flex items-center justify-between p-3 bg-surface border border-line rounded-xl text-ink">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-base shrink-0">{ICONS.paperclip}</span>
                                    <span className="text-xs font-bold truncate">{invoiceAttachmentFilename}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="p-1 text-ink hover:text-ink hover:bg-surface rounded-lg transition-colors ml-2 shrink-0"
                                    title="Remove attachment"
                                >
                                    {ICONS.close}
                                </button>
                            </div>
                        ) : (
                            <div className="relative border-2 border-dashed border-line hover:border-accent rounded-2xl p-4 text-center transition-all bg-canvas/50">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".pdf,image/*"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                                    <div className="w-9 h-9 rounded-full bg-surface text-ink flex items-center justify-center text-sm font-bold">
                                        📄
                                    </div>
                                    <p className="text-xs font-bold text-ink">
                                        Click to upload or drag & drop invoice
                                    </p>
                                    <p className="text-[11px] text-quiet">PDF, PNG, JPG (Max 15MB)</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 7. Asset Status Sync Options */}
                    {!serviceToEdit && (
                        <div className="p-3.5 bg-surface/60 border border-accent/60 rounded-2xl flex items-start gap-3">
                            <input
                                id="status-sync-toggle"
                                type="checkbox"
                                checked={updateAssetStatus}
                                onChange={(e) => setUpdateAssetStatus(e.target.checked)}
                                className="w-4 h-4 text-ink rounded border-line focus:ring-accent mt-0.5 cursor-pointer"
                            />
                            <div className="text-xs">
                                <label htmlFor="status-sync-toggle" className="font-bold text-ink cursor-pointer select-none">
                                    Synchronize Asset Status Automatically
                                </label>
                                <p className="text-quiet mt-0.5 leading-relaxed">
                                    {status === 'In Progress' ? (
                                        <>Will update this machine&#39;s status to <span className="font-bold text-ink">In Repair</span>.</>
                                    ) : (
                                        <>Will keep or return this machine&#39;s status to <span className="font-bold text-ink">In Stock</span> if it was In Repair.</>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Modal Actions */}
                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-line">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl border border-line text-ink hover:bg-muted font-semibold text-xs sm:text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent active:scale-95 text-on-strong font-bold text-xs sm:text-sm shadow-md shadow-strong/15 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin"></div>
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
