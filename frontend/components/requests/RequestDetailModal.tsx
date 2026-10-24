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
                return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-surface text-ink border border-line animate-pulse">Urgent</span>;
            case 'High':
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line">High</span>;
            case 'Low':
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-ink">Low</span>;
            case 'Medium':
            default:
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line">Medium</span>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Pending Manager':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line">Pending Manager</span>;
            case 'Pending Admin':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line">Pending IT Triage</span>;
            case 'Approved':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line">Approved</span>;
            case 'Fulfilled':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-surface text-ink border border-line">&#10004; Fulfilled</span>;
            case 'Rejected by Manager':
            case 'Rejected by Admin':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line">&#10008; {status}</span>;
            default:
                return <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-ink">{status}</span>;
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
            <div className="space-y-5 text-ink">
                {/* Header overview */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-canvas rounded-2xl border border-line">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-surface text-ink rounded-xl border border-accent">
                            <div className="w-6 h-6">{icon}</div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-base text-ink">
                                    {request.category}
                                </h4>
                                <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">
                                    {request.requestType}
                                </span>
                            </div>
                            <p className="text-xs text-quiet mt-0.5">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-canvas/70 rounded-xl border border-line/80 text-xs">
                    <div>
                        <span className="text-quiet font-medium">Requester:</span>
                        <p className="font-semibold text-ink text-sm mt-0.5">
                            {request.user?.name || 'N/A'}
                        </p>
                        <p className="text-quiet">
                            {request.user?.email || 'N/A'}
                        </p>
                    </div>
                    <div>
                        <span className="text-quiet font-medium">Organization:</span>
                        <p className="font-semibold text-ink mt-0.5">
                            {request.user?.company || 'Avana Group'} &bull; {request.user?.department?.name || 'General'}
                        </p>
                        <p className="text-quiet">
                            Emp ID: {request.user?.employeeId || 'N/A'}
                        </p>
                    </div>
                </div>

                {/* Description & Justification */}
                <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                        Business Justification / Description
                    </h5>
                    <div className="p-3.5 bg-surface rounded-xl border border-line text-sm leading-relaxed whitespace-pre-wrap">
                        {request.description || <span className="italic text-quiet">No description provided.</span>}
                    </div>
                </div>

                {/* Current Asset if Replacement/Upgrade */}
                {request.currentAsset && (
                    <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-quiet mb-1.5">
                            Existing Asset to Replace / Upgrade / Repair
                        </h5>
                        <div className="p-3.5 bg-surface/60 border border-line rounded-xl flex items-center justify-between text-xs">
                            <div>
                                <p className="font-bold text-sm text-ink">
                                    {request.currentAsset.name}
                                </p>
                                <p className="text-quiet mt-0.5">
                                    Tag: <span className="font-mono font-semibold">{request.currentAsset.assetId}</span> &bull; S/N: <code className="font-mono">{request.currentAsset.serialNumber || 'N/A'}</code>
                                </p>
                            </div>
                            <span className="px-2 py-1 rounded bg-surface text-ink font-medium">
                                {request.currentAsset.category}
                            </span>
                        </div>
                    </div>
                )}

                {/* Allocated Asset if Fulfilled */}
                {request.allocatedAsset && (
                    <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-ink mb-1.5 flex items-center gap-1.5">
                            <span>&#10004;</span> Allocated Device (Fulfilled)
                        </h5>
                        <div className="p-3.5 bg-surface/80 border border-line rounded-xl flex items-center justify-between text-xs">
                            <div>
                                <p className="font-bold text-sm text-ink">
                                    {request.allocatedAsset.name}
                                </p>
                                <p className="text-quiet mt-0.5">
                                    Tag: <span className="font-mono font-bold text-ink">{request.allocatedAsset.assetId}</span> &bull;
                                    Model: {request.allocatedAsset.brand} {request.allocatedAsset.model} &bull;
                                    S/N: <code className="font-mono">{request.allocatedAsset.serialNumber || 'N/A'}</code>
                                </p>
                                {request.fulfilledAt && (
                                    <p className="text-[11px] text-ink mt-1">
                                        Allocated on {new Date(request.fulfilledAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-surface text-ink font-bold text-xs">
                                In Use
                            </span>
                        </div>
                    </div>
                )}

                {/* Rejection Alert Box */}
                {request.rejectionReason && (
                    <div className="p-3.5 bg-surface border border-line rounded-xl text-xs text-ink">
                        <div className="flex items-center gap-2 font-bold text-ink mb-1">
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Reason for Rejection:</span>
                        </div>
                        <p className="text-sm font-medium pl-6 text-ink whitespace-pre-wrap">
                            {request.rejectionReason}
                        </p>
                    </div>
                )}

                {/* Approval & Audit Timeline */}
                <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-quiet mb-2">
                        Approval &amp; Audit Lifecycle
                    </h5>
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                        {/* Step 1: Submission */}
                        <div className="relative">
                            <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-olive ring-4 ring-accent" />
                            <div className="text-xs">
                                <p className="font-semibold text-ink">Request Submitted</p>
                                <p className="text-quiet">
                                    By {request.user?.name || 'Employee'} on {new Date(request.createdAt).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Step 2: Manager Stage */}
                        <div className="relative">
                            <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full ring-4 ring-accent  ${
                                request.status === 'Rejected by Manager'
                                    ? 'bg-olive'
                                    : request.managerDecisionAt || request.status === 'Pending Admin' || request.status === 'Approved' || request.status === 'Fulfilled'
                                        ? 'bg-olive'
                                        : 'bg-muted'
                            }`} />
                            <div className="text-xs">
                                <p className="font-semibold text-ink">
                                    Manager Approval Stage
                                </p>
                                {request.manager ? (
                                    <p className="text-quiet">
                                        Assigned Manager: {request.manager.name} ({request.manager.email})
                                    </p>
                                ) : (
                                    <p className="text-quiet italic">
                                        No manager assigned (Direct IT Routing)
                                    </p>
                                )}
                                {request.managerDecisionAt && (
                                    <p className="text-quiet">
                                        Decision recorded on {new Date(request.managerDecisionAt).toLocaleString()}
                                    </p>
                                )}
                                {request.managerRemarks && (
                                    <p className="mt-1 text-quiet italic bg-muted p-2 rounded">
                                        Manager Remarks: "{request.managerRemarks}"
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Step 3: IT Admin Stage */}
                        <div className="relative">
                            <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full ring-4 ring-accent  ${
                                request.status === 'Rejected by Admin'
                                    ? 'bg-olive'
                                    : request.status === 'Fulfilled'
                                        ? 'bg-olive'
                                        : request.status === 'Approved'
                                            ? 'bg-olive'
                                            : 'bg-muted '
                            }`} />
                            <div className="text-xs">
                                <p className="font-semibold text-ink">
                                    IT Administration &amp; Allocation Stage
                                </p>
                                {request.adminDecisionAt && (
                                    <p className="text-quiet">
                                        Actioned on {new Date(request.adminDecisionAt).toLocaleString()}
                                    </p>
                                )}
                                {request.adminRemarks && (
                                    <p className="mt-1 text-quiet italic bg-muted p-2 rounded">
                                        IT Admin Remarks: "{request.adminRemarks}"
                                    </p>
                                )}
                                {request.status === 'Fulfilled' && (
                                    <p className="text-ink font-semibold mt-1">
                                        &#10004; Device handed over with digital sign-off log generated.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer close */}
                <div className="flex justify-end pt-4 border-t border-line">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-ink bg-muted hover:bg-muted rounded-xl transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default RequestDetailModal;
