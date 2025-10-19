import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { Department } from '../../types';
import Modal from '../ui/Modal';
import ConfirmationModal from '../ui/ConfirmationModal';
import { ICONS } from '../../constants';
import DepartmentDetailView from './DepartmentDetailView';

// Reusable FormInput component
const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <input {...props} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100" />
    </div>
);

const DepartmentManagement: React.FC = () => {
    const { departments, setDepartments, assets, users, setUsers, setNotification, selectedDepartmentId, setSelectedDepartmentId } = useAppContext();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
    const [formData, setFormData] = useState({ name: '' });

    const assetCounts = useMemo(() => {
        const counts: { [key: number]: number } = {};
        departments.forEach(dept => {
            counts[dept.id] = assets.filter(asset => asset.assigneeType === 'department' && asset.assigneeId === dept.id).length;
        });
        return counts;
    }, [assets, departments]);

    const userCounts = useMemo(() => {
        const counts: { [key: number]: number } = {};
        departments.forEach(dept => {
            counts[dept.id] = users.filter(user => user.department === dept.name).length;
        });
        return counts;
    }, [users, departments]);


    const handleOpenForm = (dept: Department | null = null) => {
        setEditingDepartment(dept);
        setFormData({ name: dept ? dept.name : '' });
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setEditingDepartment(null);
        setIsFormOpen(false);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingDepartment) {
            // Edit
            const oldName = editingDepartment.name;
            const newName = formData.name;

            setDepartments(departments.map(d => d.id === editingDepartment.id ? { ...d, name: newName } : d));

            if (oldName !== newName) {
                setUsers(users.map(user => user.department === oldName ? { ...user, department: newName } : user));
            }

            setNotification({ message: `Department "${newName}" updated successfully.`, type: 'success' });
        } else {
            // Add new
            const newDepartment: Department = {
                id: Date.now(),
                name: formData.name,
            };
            setDepartments([...departments, newDepartment]);
            setNotification({ message: `Department "${formData.name}" added successfully.`, type: 'success' });
        }
        handleCloseForm();
    };

    const handleDeleteRequest = (dept: Department) => {
        if (assetCounts[dept.id] > 0) {
            setNotification({ message: `Cannot delete "${dept.name}" as it has assets assigned to it.`, type: 'error' });
            return;
        }
        setDepartmentToDelete(dept);
    };

    const confirmDelete = () => {
        if (departmentToDelete) {
            setDepartments(departments.filter(d => d.id !== departmentToDelete.id));
            setNotification({ message: `Department "${departmentToDelete.name}" deleted successfully.`, type: 'success' });
            setDepartmentToDelete(null);
        }
    };

    if (selectedDepartmentId) {
        return <DepartmentDetailView departmentId={selectedDepartmentId} onBack={() => setSelectedDepartmentId(null)} />;
    }

    return (
        <>
            <ConfirmationModal
                isOpen={!!departmentToDelete}
                onClose={() => setDepartmentToDelete(null)}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
            >
                Are you sure you want to delete the department "{departmentToDelete?.name}"? This action cannot be undone.
            </ConfirmationModal>

            <Modal
                isOpen={isFormOpen}
                onClose={handleCloseForm}
                title={editingDepartment ? 'Edit Department' : 'Add New Department'}
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <FormInput
                        label="Department Name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ name: e.target.value })}
                        required
                    />
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-4 gap-3">
                        <button type="button" onClick={handleCloseForm} className="w-full sm:w-auto flex justify-center bg-slate-200 text-slate-800 px-5 py-2 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 font-medium transition-all duration-200 active:scale-95">Cancel</button>
                        <button type="submit" className="w-full sm:w-auto flex justify-center bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 font-medium transition-all duration-200 active:scale-95">Save</button>
                    </div>
                </form>
            </Modal>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
                <div className="p-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Manage Departments</h2>
                    <button onClick={() => handleOpenForm()} className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 font-medium transition-all duration-200 active:scale-95">
                        <div className="w-4 h-4">{ICONS.add}</div>
                        <span className="hidden sm:inline">Add Department</span>
                    </button>
                </div>
                <div className="p-6 space-y-3">
                    {departments.map(dept => (
                         <div key={dept.id} onClick={() => setSelectedDepartmentId(dept.id)} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg flex items-center justify-between border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                             <div>
                                 <p className="font-semibold text-slate-800 dark:text-slate-100">{dept.name}</p>
                                 <p className="text-sm text-slate-500 dark:text-slate-400">Assets Assigned: {assetCounts[dept.id] || 0} &bull; Users: {userCounts[dept.id] || 0}</p>
                             </div>
                             <div className="flex items-center space-x-2">
                                 <button onClick={(e) => { e.stopPropagation(); handleOpenForm(dept); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-500" title="Edit">{ICONS.edit}</button>
                                 <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(dept); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-500" title="Delete">{ICONS.delete}</button>
                             </div>
                         </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default DepartmentManagement;