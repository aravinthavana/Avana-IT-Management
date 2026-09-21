import React from 'react';
import Modal from '../ui/Modal';
import { AssetRequest } from '../../types';
import { ASSET_ICONS } from '../../constants';

interface RequestDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: AssetRequest | null;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
    isOpen,
    onClose,
    request
}) => {
    if (!request) return null;

    const getPriorityBadge = (priority?: string) => {
        switch (priority) {
            case 'Urgent':
                return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800 animate-pulse">Urgent</span>;
            case 'High':
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">High</span>;
            case 'Low':
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">Low</span>;
            case 'Medium':
            default:
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Medium</span>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Pending Manager':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Pending Manager</span>;
            case 'Pending Admin':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Pending IT Triage</span>;
            case 'Approved':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 border border-teal-200 dark:border-teal-800">Approved</span>;
            case 'Fulfilled':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800">&#10004; Fulfilled</span>;
            case 'Rejected by Manager':
            case 'Rejected by Admin':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800">&#10008; {status}</span>;
            default:
                return <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{status}</span>;
        }
    };

    const icon = ASSET_ICONS[request.category] || ASSET_ICONS.default;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Request Audit & Details (REQ-${request.id.toString().padStart(4, '0')})`} 
            maxWidth="max-w-2xl"
        >
            <div className="space-y-5 text-slate-800 dark:text-slate-200">
                {/* Header overview */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 rounded-xl border border-brand-200 dark:border-brand-800">
                            <div className="w-6 h-6">{icon}</div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                                    {request.category}
                                </h4>
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 font-medium">
                                    {request.requestType}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Submitted on {new Date(request.createdAt).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {getPriorityBadge(request.priority)}
                        {getStatusBadge(request.status)}
                    </div>
                </div>

                {/* Requester profile info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
                    <div>
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Requester:</span>
                        <p className="font-semibold text-slate-800 dark:text-white text-sm mt-0.5">
                            {request.user?.name || 'N/A'}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                            {request.user?.email || 'N/A'}
                        </p>
                    </div>
                    <div>
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Organization:</span>
                        <p className="font-semibold text-slate-800 dark:text-white mt-0.5">
                            {request.user?.company || 'Avana Group'} &bull; {request.user?.department?.name || 'General'}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                            Emp ID: {request.user?.employeeId || 'N/A'}
                        </p>
                    </div>
                </div>

                {/* Description & Justification */}
                <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Business Justification / Description
                    </h5>
                    <div className="p-3.5 bg-white dark:bg-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                        {request.description || <span className="italic text-slate-400">No description provided.</span>}
                    </div>
                </div>

                {/* Current Asset if Replacement/Upgrade */}
                {request.currentAsset && (
                    <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                            Existing Asset to Replace / Upgrade / Repair
                        </h5>
                        <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center justify-between text-xs">
                            <div>
                                <p className="font-bold text-sm text-slate-900 dark:text-white">
                                    {request.currentAsset.name}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                    Tag: <span className="font-mono font-semibold">{request.currentAsset.assetId}</span> &bull; S/N: <code className="font-mono">{request.currentAsset.serialNumber || 'N/A'}</code>
                                </p>
                            </div>
                            <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-medium">
                                {request.currentAsset.category}
                            </span>
                        </div>
                    </div>
                )}

                {/* Allocated Asset if Fulfilled */}
                {request.allocatedAsset && (
                    <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 mb-1.5 flex items-center gap-1.5">
                            <span>&#10004;</span> Allocated Device (Fulfilled)
                        </h5>
                        <div className="p-3.5 bg-green-50/80 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-xl flex items-center justify-between text-xs">
                            <div>
                                <p className="font-bold text-sm text-slate-900 dark:text-white">
                                    {request.allocatedAsset.name}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                    Tag: <span className="font-mono font-bold text-green-700 dark:text-green-300">{request.allocatedAsset.assetId}</span> &bull; 
                                    Model: {request.allocatedAsset.brand} {request.allocatedAsset.model} &bull; 
                                    S/N: <code className="font-mono">{request.allocatedAsset.serialNumber || 'N/A'}</code>
                                </p>
                                {request.fulfilledAt && (
                                    <p className="text-[11px] text-green-700 dark:text-green-400 mt-1">
                                        Allocated on {new Date(request.fulfilledAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 font-bold text-xs">
                                In Use
                            </span>
                        </div>
                    </div>
                )}

                {/* Rejection Alert Box */}
                {request.rejectionReason && (
                    <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-xs text-red-800 dark:text-red-300">
                        <div className="flex items-center gap-2 font-bold text-red-700 dark:text-red-300 mb-1">
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Reason for Rejection:</span>
                        </div>
                        <p className="text-sm font-medium pl-6 text-red-900 dark:text-red-200 whitespace-pre-wrap">
                            {request.rejectionReason}
                        </p>
                    </div>
                )}

                {/* Approval & Audit Timeline */}
                <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        Approval &amp; Audit Lifecycle
                    </h5>
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                        {/* Step 1: Submission */}
                        <div className="relative">
                            <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-800" />
                            <div className="text-xs">
                                <p className="font-semibold text-slate-800 dark:text-white">Request Submitted</p>
                                <p className="text-slate-500 dark:text-slate-400">
                                    By {request.user?.name || 'Employee'} on {new Date(request.createdAt).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Step 2: Manager Stage */}
                        <div className="relative">
                            <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full ring-4 ring-white dark:ring-slate-800 ${
                                request.status === 'Rejected by Manager' 
                                    ? 'bg-red-500' 
                                    : request.managerDecisionAt || request.status === 'Pending Admin' || request.status === 'Approved' || request.status === 'Fulfilled' 
                                        ? 'bg-green-500' 
                                        : 'bg-amber-400'
                            }`} />
                            <div className="text-xs">
                                <p className="font-semibold text-slate-800 dark:text-white">
                                    Manager Approval Stage
                                </p>
                                {request.manager ? (
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Assigned Manager: {request.manager.name} ({request.manager.email})
                                    </p>
                                ) : (
                                    <p className="text-slate-500 dark:text-slate-400 italic">
                                        No manager assigned (Direct IT Routing)
                                    </p>
                                )}
                                {request.managerDecisionAt && (
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Decision recorded on {new Date(request.managerDecisionAt).toLocaleString()}
                                    </p>
                                )}
                                {request.managerRemarks && (
                                    <p className="mt-1 text-slate-600 dark:text-slate-300 italic bg-slate-100 dark:bg-slate-700 p-2 rounded">
                                        Manager Remarks: "{request.managerRemarks}"
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Step 3: IT Admin Stage */}
                        <div className="relative">
                            <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full ring-4 ring-white dark:ring-slate-800 ${
                                request.status === 'Rejected by Admin'
                                    ? 'bg-red-500'
                                    : request.status === 'Fulfilled'
                                        ? 'bg-green-500'
                                        : request.status === 'Approved'
                                            ? 'bg-teal-500'
                                            : 'bg-slate-300 dark:bg-slate-600'
                            }`} />
                            <div className="text-xs">
                                <p className="font-semibold text-slate-800 dark:text-white">
                                    IT Administration &amp; Allocation Stage
                                </p>
                                {request.adminDecisionAt && (
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Actioned on {new Date(request.adminDecisionAt).toLocaleString()}
                                    </p>
                                )}
                                {request.adminRemarks && (
                                    <p className="mt-1 text-slate-600 dark:text-slate-300 italic bg-slate-100 dark:bg-slate-700 p-2 rounded">
                                        IT Admin Remarks: "{request.adminRemarks}"
                                    </p>
                                )}
                                {request.status === 'Fulfilled' && (
                                    <p className="text-green-600 dark:text-green-400 font-semibold mt-1">
                                        &#10004; Device handed over with digital sign-off log generated.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer close */}
                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default RequestDetailModal;
