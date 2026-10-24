import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { User, Asset } from '../../types';

interface AssignAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedItems: Array<{ user: User; asset: Asset }>;
    onConfirm: (dueDate: string | null, instructions: string, notifyEmail: boolean) => Promise<void>;
}

export const AssignAuditModal: React.FC<AssignAuditModalProps> = ({
    isOpen,
    onClose,
    selectedItems,
    onConfirm
}) => {
    // Default deadline: 7 days from today
    const getDefaultDueDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().split('T')[0];
    };

    const [dueDate, setDueDate] = useState<string>(getDefaultDueDate());
    const [instructions, setInstructions] = useState('');
    const [notifyEmail, setNotifyEmail] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const setQuickDays = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        setDueDate(d.toISOString().split('T')[0]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onConfirm(dueDate || null, instructions.trim(), notifyEmail);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Schedule Self-Audit Verification (${selectedItems.length} Employees)`}
            maxWidth="max-w-lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selected summary */}
                <div className="p-3.5 bg-surface/70 border border-accent rounded-xl">
                    <p className="text-xs font-semibold text-ink flex items-center justify-between">
                        <span>Targeted Assignment Group</span>
                        <span className="bg-surface text-ink px-2 py-0.5 rounded-full text-[11px] font-bold">
                            {selectedItems.length} selected
                        </span>
                    </p>
                    <p className="text-xs text-ink mt-1">
                        Only these specific employees will see verification alerts and deadline banners. Other employees and top executives will not be disturbed.
                    </p>

                    <div className="mt-2.5 max-h-24 overflow-y-auto divide-y divide-accent text-xs">
                        {selectedItems.slice(0, 5).map(({ user, asset }) => (
                            <div key={`${user.id}-${asset.id}`} className="py-1 flex items-center justify-between text-ink">
                                <span className="font-medium truncate max-w-[200px]">{user.name}</span>
                                <span className="font-mono text-[11px] text-quiet">{asset.name} ({asset.assetId})</span>
                            </div>
                        ))}
                        {selectedItems.length > 5 && (
                            <p className="pt-1 text-[11px] text-ink italic">
                                + {selectedItems.length - 5} more employees
                            </p>
                        )}
                    </div>
                </div>

                {/* Deadline selection */}
                <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                        Completion Due Date
                    </label>
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            type="button"
                            onClick={() => setQuickDays(7)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-muted text-ink hover:bg-muted"
                        >
                            7 Days
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuickDays(14)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-muted text-ink hover:bg-muted"
                        >
                            14 Days
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuickDays(30)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-muted text-ink hover:bg-muted"
                        >
                            30 Days
                        </button>
                    </div>
                    <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-sm focus:ring-2 focus:ring-accent text-ink shadow-sm"
                    />
                </div>

                {/* Instructions / Purpose */}
                <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                        Instructions / Notes for Employees (Optional)
                    </label>
                    <textarea aria-label="Instructions / Notes for Employees (Optional)"
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        rows={2}
                        placeholder="e.g., Annual physical verification. Please check your screen and power adapter condition."
                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs focus:ring-2 focus:ring-accent text-ink placeholder-quiet"
                    />
                </div>

                {/* Email toggle */}
                <div className="pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-ink select-none">
                        <input
                            type="checkbox"
                            checked={notifyEmail}
                            onChange={(e) => setNotifyEmail(e.target.checked)}
                            className="w-4 h-4 rounded text-ink focus:ring-accent"
                        />
                        <span className="font-medium">
                            Send automated email notifications with direct login links
                        </span>
                    </label>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end items-center gap-3 pt-4 border-t border-line">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-quiet hover:bg-muted rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || selectedItems.length === 0}
                        className="px-5 py-2 text-xs font-bold text-on-strong bg-accent hover:bg-accent disabled:opacity-50 rounded-xl transition-colors shadow-sm flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-line/30 border-t-white rounded-full animate-spin" />
                                <span>Assigning...</span>
                            </>
                        ) : (
                            `Assign to ${selectedItems.length} Employees`
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AssignAuditModal;
