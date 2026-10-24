import { API_URL } from '../../utils/apiClient';
import React, { useState } from 'react';
import { License, LicenseAssignment } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';

interface AssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    license: License;
}

const LicenseAssignmentModal: React.FC<AssignmentModalProps> = ({ isOpen, onClose, license }) => {
    const { users, assets, setLicenses, licenses, setNotification, getHeaders } = useAppContext();
    const [assigneeType, setAssigneeType] = useState<'User' | 'Asset'>('User');
    const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | ''>('');
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const currentAssignments = license.assignments || [];
    const availableSeats = license.seats - currentAssignments.length;

    const handleAssign = async () => {
        if (!selectedAssigneeId) return;
        if (availableSeats <= 0) {
            setNotification({ message: 'No available seats remaining!', type: 'error' });
            return;
        }

        setIsProcessing(true);
        try {
            const payload = {
                licenseId: license.id,
                userId: assigneeType === 'User' ? Number(selectedAssigneeId) : null,
                assetId: assigneeType === 'Asset' ? Number(selectedAssigneeId) : null
            };

            const res = await fetch(`${API_URL}/api/license-assignments`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to assign license');
            }

            const createdAssignment = await res.json();
            const updatedLicense = {
                ...license,
                assignments: [...currentAssignments, createdAssignment],
                assignedSeats: (license.assignedSeats || 0) + 1
            };

            setLicenses(licenses.map(l => l.id === license.id ? updatedLicense : l));
            setNotification({ message: 'License assigned successfully.', type: 'success' });
            setSelectedAssigneeId('');
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to assign license', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUnassign = async (assignmentId: number) => {
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/license-assignments/${assignmentId}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include'
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to unassign license seat');
            }

            const updatedLicense = {
                ...license,
                assignments: currentAssignments.filter(a => a.id !== assignmentId),
                assignedSeats: Math.max(0, (license.assignedSeats || 1) - 1)
            };
            setLicenses(licenses.map(l => l.id === license.id ? updatedLicense : l));
            setNotification({ message: 'License seat unassigned.', type: 'info' });
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to unassign seat', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-strong/60 z-50 flex justify-center items-center p-4">
            <div className="bg-surface rounded-xl max-w-lg w-full shadow-2xl flex flex-col max-h-[calc(100dvh-1rem)]">
                <div className="p-6 border-b border-line flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-ink">Manage Assignments</h2>
                        <p className="text-sm text-quiet mt-1">{license.name} - {availableSeats} of {license.seats} seats available</p>
                    </div>
                    <button aria-label="Close dialog" onClick={onClose} className="p-2 text-quiet hover:text-ink rounded-full hover:bg-muted">{ICONS.close}</button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Add Assignment Form */}
                    <div className="bg-canvas p-4 rounded-lg border border-line mb-6">
                        <h3 className="text-sm font-semibold text-ink mb-3">Assign New Seat</h3>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <select
                                value={assigneeType}
                                onChange={(e) => { setAssigneeType(e.target.value as any); setSelectedAssigneeId(''); }}
                                className="w-full sm:w-1/3 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:outline-none text-sm"
                            >
                                <option value="User">To User</option>
                                <option value="Asset">To Asset (Device)</option>
                            </select>

                            <select
                                value={selectedAssigneeId}
                                onChange={(e) => setSelectedAssigneeId(Number(e.target.value))}
                                className="w-full flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:outline-none text-sm"
                            >
                                <option value="">Select Assignee...</option>
                                {assigneeType === 'User'
                                    ? users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.department?.name})</option>)
                                    : assets.filter(a => a.category !== 'Software').map(a => <option key={a.id} value={a.id}>{a.name} [{a.assetId}]</option>)
                                }
                            </select>

                            <button
                                onClick={handleAssign}
                                disabled={!selectedAssigneeId || availableSeats <= 0 || isProcessing}
                                className="bg-accent disabled:bg-muted text-on-strong px-4 py-2 rounded-lg hover:bg-accent transition-colors font-medium text-sm whitespace-nowrap"
                            >
                                {isProcessing ? 'Processing...' : 'Assign'}
                            </button>
                        </div>
                    </div>

                    {/* Current Assignments List */}
                    <h3 className="text-sm font-semibold text-ink mb-3">Current Assignments ({currentAssignments.length})</h3>
                    {currentAssignments.length === 0 ? (
                        <p className="text-sm text-quiet italic text-center py-4 bg-canvas rounded-lg border border-dashed border-line">No seats currently assigned.</p>
                    ) : (
                        <div className="space-y-2">
                            {currentAssignments.map(assignment => (
                                <div key={assignment.id} className="flex justify-between items-center p-3 bg-surface border border-line rounded-lg shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-muted p-2 rounded-md text-quiet">
                                            {assignment.user ? ICONS.users : ICONS.assets}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-ink">
                                                {assignment.user ? assignment.user.name : assignment.asset?.name}
                                            </p>
                                            <p className="text-xs text-quiet">Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUnassign(assignment.id)}
                                        className="text-ink hover:text-ink p-2 hover:bg-surface rounded-md transition-colors flex items-center justify-center"
                                        title="Revoke Seat"
                                    >
                                        {ICONS.unassign || 'Revoke'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-line flex justify-end">
                    <button onClick={onClose} className="px-5 py-2 bg-muted text-ink rounded-lg hover:bg-muted font-medium transition-colors">Done</button>
                </div>
            </div>
        </div>
    );
};

export default LicenseAssignmentModal;
