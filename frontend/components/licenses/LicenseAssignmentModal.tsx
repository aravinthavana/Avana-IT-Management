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
        <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black/60">
            <div className="rounded-xl max-w-lg w-full shadow-2xl flex flex-col max-h-[calc(100dvh-1rem)] bg-white dark:bg-slate-800">
                <div className="p-6 border-b flex justify-between items-center border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Manage Assignments</h2>
                        <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">{license.name} - {availableSeats} of {license.seats} seats available</p>
                    </div>
                    <button aria-label="Close dialog" onClick={onClose} className="p-2 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700">{ICONS.close}</button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Add Assignment Form */}
                    <div className="p-4 rounded-lg border mb-6 bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700">
                        <h3 className="text-sm font-semibold mb-3 text-slate-800 dark:text-slate-100">Assign New Seat</h3>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <select
                                value={assigneeType}
                                onChange={(e) => { setAssigneeType(e.target.value as any); setSelectedAssigneeId(''); }}
                                className="w-full sm:w-1/3 px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:ring-brand-500"
                            >
                                <option value="User">To User</option>
                                <option value="Asset">To Asset (Device)</option>
                            </select>

                            <select
                                value={selectedAssigneeId}
                                onChange={(e) => setSelectedAssigneeId(Number(e.target.value))}
                                className="w-full flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:ring-brand-500"
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
                                className="px-4 py-2 rounded-lg transition-colors font-medium text-sm whitespace-nowrap bg-brand-600 disabled:bg-slate-400 text-white hover:bg-brand-700"
                            >
                                {isProcessing ? 'Processing...' : 'Assign'}
                            </button>
                        </div>
                    </div>

                    {/* Current Assignments List */}
                    <h3 className="text-sm font-semibold mb-3 text-slate-800 dark:text-slate-100">Current Assignments ({currentAssignments.length})</h3>
                    {currentAssignments.length === 0 ? (
                        <p className="text-sm italic text-center py-4 rounded-lg border border-dashed text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700">No seats currently assigned.</p>
                    ) : (
                        <div className="space-y-2">
                            {currentAssignments.map(assignment => (
                                <div key={assignment.id} className="flex justify-between items-center p-3 border rounded-lg shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                            {assignment.user ? ICONS.users : ICONS.assets}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-slate-800 dark:text-slate-100">
                                                {assignment.user ? assignment.user.name : assignment.asset?.name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUnassign(assignment.id)}
                                        className="p-2 rounded-md transition-colors flex items-center justify-center text-brand-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                                        title="Revoke Seat"
                                    >
                                        {ICONS.unassign || 'Revoke'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t flex justify-end border-slate-200 dark:border-slate-700">
                    <button onClick={onClose} className="px-5 py-2 rounded-lg font-medium transition-colors bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600">Done</button>
                </div>
            </div>
        </div>
    );
};

export default LicenseAssignmentModal;
