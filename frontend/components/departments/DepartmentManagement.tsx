import { API_URL } from '../../utils/apiClient';
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
        <label className="block text-sm font-medium text-ink">{label}</label>
        <input {...props} className="mt-1 block w-full px-3 py-2 bg-surface border border-line rounded-md text-sm shadow-sm placeholder-quiet focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-ink" />
    </div>
);

const DepartmentManagement: React.FC = () => {
    const { departments, setDepartments, assets, users, setNotification, selectedDepartmentId, setSelectedDepartmentId, getHeaders } = useAppContext();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
    const [formData, setFormData] = useState({ name: '' });
    const [isLoading, setIsLoading] = useState(false);

    const assetCounts = useMemo(() => {
        const counts: { [key: number]: number } = {};
        departments.forEach(dept => { counts[dept.id] = assets.filter(a => a.assigneeType === 'department' && a.assigneeId === dept.id).length; });
        return counts;
    }, [assets, departments]);

    const userCounts = useMemo(() => {
        const counts: { [key: number]: number } = {};
        departments.forEach(dept => { counts[dept.id] = users.filter(u => u.departmentId === dept.id).length; });
        return counts;
    }, [users, departments]);

    const handleOpenForm = (dept: Department | null = null) => {
        setEditingDepartment(dept);
        setFormData({ name: dept ? dept.name : '' });
        setIsFormOpen(true);
    };

    const handleCloseForm = () => { setEditingDepartment(null); setIsFormOpen(false); };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (editingDepartment) {
                const res = await fetch(`${API_URL}/api/departments/${editingDepartment.id}`, {
                    method: 'PUT', headers: getHeaders(),
                                credentials: 'include', body: JSON.stringify(formData),
                });
                if (!res.ok) throw new Error((await res.json()).error);
                const updated = await res.json();
                setDepartments(departments.map(d => d.id === editingDepartment.id ? updated : d));
                setNotification({ message: `Department "${updated.name}" updated.`, type: 'success' });
            } else {
                const res = await fetch(`${API_URL}/api/departments`, {
                    method: 'POST', headers: getHeaders(),
                                credentials: 'include', body: JSON.stringify(formData),
                });
                if (!res.ok) throw new Error((await res.json()).error);
                const created = await res.json();
                setDepartments([...departments, created]);
                setNotification({ message: `Department "${created.name}" added.`, type: 'success' });
            }
            handleCloseForm();
        } catch (err: any) {
            setNotification({ message: err.message || 'An error occurred', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteRequest = (dept: Department) => {
        if (assetCounts[dept.id] > 0) {
            setNotification({ message: `Cannot delete "${dept.name}" as it has assets assigned to it.`, type: 'error' });
            return;
        }
        setDepartmentToDelete(dept);
    };

    const confirmDelete = async () => {
        if (!departmentToDelete) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/departments/${departmentToDelete.id}`, {
                method: 'DELETE', headers: getHeaders(),
                                credentials: 'include',
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setDepartments(departments.filter(d => d.id !== departmentToDelete.id));
            setNotification({ message: `Department "${departmentToDelete.name}" deleted.`, type: 'success' });
            setDepartmentToDelete(null);
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to delete', type: 'error' });
        } finally {
            setIsLoading(false);
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
                        <button type="button" onClick={handleCloseForm} className="w-full sm:w-auto flex justify-center bg-muted text-ink px-5 py-2 rounded-lg hover:bg-muted font-medium transition-all duration-200 active:scale-95">Cancel</button>
                        <button type="submit" className="w-full sm:w-auto flex justify-center bg-accent text-on-strong px-5 py-2 rounded-lg hover:bg-accent font-medium transition-all duration-200 active:scale-95">Save</button>
                    </div>
                </form>
            </Modal>

            <div className="bg-surface rounded-lg shadow-md">
                <div className="p-6 flex justify-between items-center border-b border-line">
                    <h2 className="text-xl font-bold text-ink">Manage Departments</h2>
                    <button onClick={() => handleOpenForm()} className="bg-accent text-on-strong px-3 sm:px-4 py-2 rounded-lg hover:bg-accent flex items-center gap-2 font-medium transition-all duration-200 active:scale-95">
                        <div className="w-4 h-4">{ICONS.add}</div>
                        <span className="hidden sm:inline">Add Department</span>
                    </button>
                </div>
                <div className="p-6 space-y-3">
                    {departments.map(dept => (
                         <div key={dept.id} onClick={() => setSelectedDepartmentId(dept.id)} className="bg-canvas p-4 rounded-lg flex items-center justify-between border border-line/80 cursor-pointer hover:bg-muted transition-colors">
                             <div>
                                 <p className="font-semibold text-ink">{dept.name}</p>
                                 <p className="text-sm text-quiet">Assets Assigned: {assetCounts[dept.id] || 0} &bull; Users: {userCounts[dept.id] || 0}</p>
                             </div>
                             <div className="flex items-center space-x-2">
                                 <button onClick={(e) => { e.stopPropagation(); handleOpenForm(dept); }} className="p-2 text-quiet rounded-full hover:bg-muted hover:text-ink" title="Edit">{ICONS.edit}</button>
                                 <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(dept); }} className="p-2 text-quiet rounded-full hover:bg-muted hover:text-ink" title="Delete">{ICONS.delete}</button>
                             </div>
                         </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default DepartmentManagement;