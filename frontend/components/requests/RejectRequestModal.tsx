import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { AssetRequest } from '../../types';

interface RejectRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: AssetRequest | null;
    stage: 'Manager' | 'Admin';
    onConfirm: (rejectionReason: string, remarks?: string) => Promise<void>;
}

export const RejectRequestModal: React.FC<RejectRequestModalProps> = ({
    isOpen,
    onClose,
    request,
    stage,
    onConfirm
}) => {
    const [rejectionReason, setRejectionReason] = useState('');
    const [remarks, setRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rejectionReason.trim()) {
            setError('Please provide a reason for the rejection so the requester understands why.');
            return;
        }

        setError(null);
        setIsSubmitting(true);
        try {
            await onConfirm(rejectionReason.trim(), remarks.trim() || undefined);
            setRejectionReason('');
            setRemarks('');
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to reject request');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!request) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Reject Asset Request (REQ-${request.id.toString().padStart(4, '0')})`} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-start gap-3 p-3.5 bg-surface border border-line rounded-xl">
                    <div className="p-2 bg-surface rounded-lg text-ink shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="text-xs text-ink">
                        <p className="font-semibold">Rejection as {stage === 'Manager' ? 'Manager' : 'IT Administration'}</p>
                        <p className="mt-0.5 text-ink">
                            The requester ({request.user?.name || 'Employee'}) will be notified via email with your rejection reason.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="p-3 text-xs bg-surface text-ink rounded-lg font-medium">
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="rejectionReason" className="block text-sm font-semibold text-ink mb-1">
                        Reason for Rejection <span className="text-ink">*</span>
                    </label>
                    <textarea
                        id="rejectionReason"
                        rows={3}
                        value={rejectionReason}
                        onChange={(e) => {
                            setRejectionReason(e.target.value);
                            if (error) setError(null);
                        }}
                        placeholder="e.g., Device not required for current project scope, budget limit reached, or alternative equipment already available..."
                        required
                        className="w-full px-3 py-2 text-sm bg-surface border border-line rounded-xl focus:ring-2 focus:ring-accent focus:border-line text-ink placeholder-quiet resize-none shadow-sm"
                    />
                    <p className="text-xs text-quiet mt-1">
                        This reason will be visible to the requester in their portal and in the automated email.
                    </p>
                </div>

                <div>
                    <label htmlFor="remarks" className="block text-sm font-medium text-ink mb-1">
                        Internal Remarks <span className="text-quiet text-xs">(Optional)</span>
                    </label>
                    <input
                        type="text"
                        id="remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Optional internal note or reference..."
                        className="w-full px-3 py-2 text-sm bg-surface border border-line rounded-xl focus:ring-2 focus:ring-accent focus:border-accent text-ink placeholder-quiet shadow-sm"
                    />
                </div>

                <div className="flex justify-end items-center gap-3 pt-4 border-t border-line">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-ink hover:bg-muted rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !rejectionReason.trim()}
                        className="px-5 py-2 text-sm font-semibold text-on-strong bg-olive hover:bg-olive disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-line/30 border-t-white rounded-full animate-spin" />
                                <span>Rejecting...</span>
                            </>
                        ) : (
                            'Confirm Rejection'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default RejectRequestModal;
