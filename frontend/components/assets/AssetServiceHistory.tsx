import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Asset, ServiceRecord } from '../../types';
import { ICONS } from '../../constants';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import ServiceRecordModal from './ServiceRecordModal';
import InvoicePreviewModal from './InvoicePreviewModal';

interface AssetServiceHistoryProps {
    asset: Asset;
    purchaseAmount?: number | null;
    onAssetStatusChanged?: (newStatus: string) => void;
    refreshTrigger?: any;
}

const AssetServiceHistory: React.FC<AssetServiceHistoryProps> = ({
    asset,
    purchaseAmount,
    onAssetStatusChanged,
    refreshTrigger,
}) => {
    const { getHeaders, setNotification } = useAppContext();
    const { user } = useAuth();

    const [services, setServices] = useState<ServiceRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Modals
    const [isServiceModalOpen, setIsServiceModalOpen] = useState<boolean>(false);
    const [serviceToEdit, setServiceToEdit] = useState<ServiceRecord | null>(null);
    const [previewInvoice, setPreviewInvoice] = useState<{ url: string; filename: string; title: string } | null>(null);

    const canManageServices = user?.role === 'Admin' || user?.role === 'Manager';

    const fetchServices = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:8080';
            const res = await fetch(`${apiUrl}/api/assets/${asset.id}/services`, {
                headers: getHeaders(),
                credentials: 'include'
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to load service records');
            }

            const data = await res.json();
            setServices(data);
        } catch (err: any) {
            console.error('Error fetching service history:', err);
            setError(err.message || 'Failed to load service history');
        } finally {
            setIsLoading(false);
        }
    }, [asset.id, getHeaders]);

    useEffect(() => {
        fetchServices();
    }, [fetchServices, refreshTrigger]);

    // Financial calculations
    const totalServiceCost = useMemo(() => {
        return services.reduce((sum, s) => sum + (s.cost || 0), 0);
    }, [services]);

    const originalPurchase = purchaseAmount || 0;
    const totalLifecycleCost = originalPurchase + totalServiceCost;

    const handleDeleteService = async (service: ServiceRecord) => {
        if (!window.confirm(`Are you sure you want to delete service record "${service.serviceId}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:8080';
            const res = await fetch(`${apiUrl}/api/services/${service.id}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include'
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to delete service record');
            }

            setNotification({ message: `Service record ${service.serviceId} deleted.`, type: 'success' });
            fetchServices();
        } catch (err: any) {
            console.error('Delete service error:', err);
            setNotification({ message: err.message || 'Failed to delete service record', type: 'error' });
        }
    };

    const handleServiceSaved = (savedService: ServiceRecord, updatedAssetStatus?: string) => {
        fetchServices();
        if (updatedAssetStatus && onAssetStatusChanged) {
            onAssetStatusChanged(updatedAssetStatus);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60 space-y-6">
            {/* Header & Action Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">
                        🛠️
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Service & Repair History</h3>
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {services.length}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Maintenance, hardware upgrades, warranty claims, and service invoices.
                        </p>
                    </div>
                </div>

                {canManageServices && (
                    <button
                        type="button"
                        onClick={() => {
                            setServiceToEdit(null);
                            setIsServiceModalOpen(true);
                        }}
                        className="self-start sm:self-auto bg-brand-600 hover:bg-brand-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-600/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        {ICONS.add}
                        <span>Log Service Record</span>
                    </button>
                )}
            </div>

            {/* Financial Summary: Total Cost of Ownership (TCO) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                <div className="p-2 sm:p-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Original Purchase Cost</p>
                    <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                        {originalPurchase > 0 ? `₹${originalPurchase.toLocaleString('en-IN')}` : 'N/A'}
                    </p>
                </div>
                <div className="p-2 sm:p-3 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Service Spend</p>
                    <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                        ₹{totalServiceCost.toLocaleString('en-IN')}
                    </p>
                </div>
                <div className="p-2 sm:p-3 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 bg-brand-50/50 dark:bg-brand-950/20 rounded-xl">
                    <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">Total Lifecycle Cost (TCO)</p>
                    <p className="text-lg sm:text-xl font-black text-brand-700 dark:text-brand-400 mt-0.5">
                        ₹{totalLifecycleCost.toLocaleString('en-IN')}
                    </p>
                </div>
            </div>

            {/* Services List / Cards */}
            {isLoading && services.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-medium">Loading service records...</p>
                </div>
            ) : error ? (
                <div className="py-6 text-center space-y-2">
                    <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                    <button
                        onClick={fetchServices}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            ) : services.length === 0 ? (
                <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
                    <span className="text-3xl block mb-2">📋</span>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Service Records Logged</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        This asset has no recorded repair, maintenance, or hardware replacement events.
                    </p>
                    {canManageServices && (
                        <button
                            type="button"
                            onClick={() => {
                                setServiceToEdit(null);
                                setIsServiceModalOpen(true);
                            }}
                            className="mt-4 text-xs font-bold text-brand-600 dark:text-red-400 hover:underline"
                        >
                            + Log First Service Event
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {services.map((service) => {
                        const statusColors = {
                            'In Progress': 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700',
                            'Completed': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
                            'Cancelled': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        };

                        const formattedServiceDate = new Date(service.serviceDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                        });

                        const formattedCompletionDate = service.completionDate
                            ? new Date(service.completionDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                              })
                            : null;

                        return (
                            <div
                                key={service.id}
                                className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all hover:shadow-md space-y-3"
                            >
                                {/* Top Row: ID, Badges & Actions */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs font-black text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                                            {service.serviceId}
                                        </span>
                                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                            {service.serviceType}
                                        </span>
                                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusColors[service.status] || statusColors.Completed}`}>
                                            {service.status === 'In Progress' ? '⏳ In Progress' : service.status === 'Completed' ? '✓ Completed' : '✕ Cancelled'}
                                        </span>
                                        {service.isWarrantyClaim && (
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                🛡️ Warranty Claim
                                            </span>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    {canManageServices && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setServiceToEdit(service);
                                                    setIsServiceModalOpen(true);
                                                }}
                                                className="p-1.5 text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                                title="Edit Service Record"
                                            >
                                                {ICONS.edit}
                                            </button>
                                            {user?.role === 'Admin' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteService(service)}
                                                    className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                                    title="Delete Service Record"
                                                >
                                                    {ICONS.delete}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Service Date</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{formattedServiceDate}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Completion Date</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                                            {formattedCompletionDate || (service.status === 'In Progress' ? 'Pending' : 'N/A')}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Vendor / Center</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block">
                                            {service.vendor || 'Internal / N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Service Charges</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                                            {service.isWarrantyClaim || (service.cost === 0) ? (
                                                <span className="text-emerald-600 dark:text-emerald-400">Free (₹0)</span>
                                            ) : (
                                                `₹${(service.cost || 0).toLocaleString('en-IN')}`
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* Issue & Work Done Description */}
                                <div className="space-y-1.5 pt-1 text-xs">
                                    <div>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">Issue Reported: </span>
                                        <span className="text-slate-600 dark:text-slate-400 leading-relaxed">{service.issueDescription}</span>
                                    </div>
                                    {service.workDone && (
                                        <div>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">Resolution / Work Done: </span>
                                            <span className="text-slate-600 dark:text-slate-400 leading-relaxed">{service.workDone}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer: Attached Invoice & Logged By */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                                    {service.invoiceAttachmentUrl ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPreviewInvoice({
                                                    url: service.invoiceAttachmentUrl!,
                                                    filename: service.invoiceAttachmentFilename || 'service-invoice',
                                                    title: `Invoice for ${service.serviceId} (${service.serviceType})`
                                                });
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 border border-slate-300 dark:border-slate-600 hover:border-brand-400 text-brand-700 dark:text-brand-300 rounded-xl font-bold transition-all shadow-2xs group cursor-pointer"
                                        >
                                            <span className="text-sm">📄</span>
                                            <span className="truncate max-w-[200px] sm:max-w-xs">{service.invoiceAttachmentFilename || 'View Attached Invoice'}</span>
                                            <span className="text-[10px] bg-brand-100 dark:bg-brand-900/60 px-1.5 py-0.5 rounded font-bold uppercase">View</span>
                                        </button>
                                    ) : (
                                        <span className="text-slate-400 italic text-[11px]">No invoice attached</span>
                                    )}

                                    <div className="text-[11px] text-slate-400 font-medium">
                                        Logged {service.performedBy ? `by ${service.performedBy.name}` : ''}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal for Logging / Editing Service */}
            <ServiceRecordModal
                isOpen={isServiceModalOpen}
                onClose={() => setIsServiceModalOpen(false)}
                asset={asset}
                serviceToEdit={serviceToEdit}
                onServiceSaved={handleServiceSaved}
            />

            {/* Modal for Invoice Preview */}
            <InvoicePreviewModal
                isOpen={Boolean(previewInvoice)}
                onClose={() => setPreviewInvoice(null)}
                title={previewInvoice?.title || 'Invoice Preview'}
                fileUrl={previewInvoice?.url}
                filename={previewInvoice?.filename}
            />
        </div>
    );
};

export default AssetServiceHistory;
