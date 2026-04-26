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
    const { users, assets, setLicenses, licenses, setNotification } = useAppContext();
    const [assigneeType, setAssigneeType] = useState<'User' | 'Asset'>('User');
    const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | ''>('');

    if (!isOpen) return null;

    const currentAssignments = license.assignments || [];
    const availableSeats = license.seats - currentAssignments.length;

    const handleAssign = () => {
        if (!selectedAssigneeId) return;
        if (availableSeats <= 0) {
            setNotification({ message: 'No available seats remaining!', type: 'error' });
            return;
        }

        const newAssignment: LicenseAssignment = {
            id: Date.now(),
            licenseId: license.id,
            userId: assigneeType === 'User' ? Number(selectedAssigneeId) : undefined,
            assetId: assigneeType === 'Asset' ? Number(selectedAssigneeId) : undefined,
            user: assigneeType === 'User' ? users.find(u => u.id === Number(selectedAssigneeId)) : undefined,
            asset: assigneeType === 'Asset' ? assets.find(a => a.id === Number(selectedAssigneeId)) : undefined,
            assignedAt: new Date().toISOString()
        };

        const updatedLicense = {
            ...license,
            assignments: [...currentAssignments, newAssignment],
            assignedSeats: license.assignedSeats + 1
        };

        setLicenses(licenses.map(l => l.id === license.id ? updatedLicense : l));
        setNotification({ message: 'License assigned successfully.', type: 'success' });
        setSelectedAssigneeId('');
    };

    const handleUnassign = (assignmentId: number) => {
        const updatedLicense = {
            ...license,
            assignments: currentAssignments.filter(a => a.id !== assignmentId),
            assignedSeats: license.assignedSeats - 1
        };
        setLicenses(licenses.map(l => l.id === license.id ? updatedLicense : l));
        setNotification({ message: 'License seat unassigned.', type: 'info' });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Manage Assignments</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{license.name} - {availableSeats} of {license.seats} seats available</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">{ICONS.close}</button>
                </div>
                
                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Add Assignment Form */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Assign New Seat</h3>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <select 
                                value={assigneeType} 
                                onChange={(e) => { setAssigneeType(e.target.value as any); setSelectedAssigneeId(''); }} 
                                className="w-full sm:w-1/3 px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
                            >
                                <option value="User">To User</option>
                                <option value="Asset">To Asset (Device)</option>
                            </select>
                            
                            <select 
                                value={selectedAssigneeId} 
                                onChange={(e) => setSelectedAssigneeId(Number(e.target.value))} 
                                className="w-full flex-1 px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
                            >
                                <option value="">Select Assignee...</option>
                                {assigneeType === 'User' 
                                    ? users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.department?.name})</option>)
                                    : assets.filter(a => a.category !== 'Software').map(a => <option key={a.id} value={a.id}>{a.name} [{a.assetId}]</option>)
                                }
                            </select>
                            
                            <button 
                                onClick={handleAssign} 
                                disabled={!selectedAssigneeId || availableSeats <= 0}
                                className="bg-red-600 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap"
                            >
                                Assign
                            </button>
                        </div>
                    </div>

                    {/* Current Assignments List */}
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Current Assignments ({currentAssignments.length})</h3>
                    {currentAssignments.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">No seats currently assigned.</p>
                    ) : (
                        <div className="space-y-2">
                            {currentAssignments.map(assignment => (
                                <div key={assignment.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-md text-slate-500 dark:text-slate-400">
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
                                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors flex items-center justify-center" 
                                        title="Revoke Seat"
                                    >
                                        {ICONS.unassign || 'Revoke'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                    <button onClick={onClose} className="px-5 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 font-medium transition-colors">Done</button>
                </div>
            </div>
        </div>
    );
};

export default LicenseAssignmentModal;
