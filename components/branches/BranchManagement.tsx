import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { Branch } from '../../types';
import Modal from '../ui/Modal';
import ConfirmationModal from '../ui/ConfirmationModal';
import { ICONS } from '../../constants';
import BranchDetailView from './BranchDetailView';

// Reusable FormInput component
const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <input {...props} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100" />
    </div>
);

const BranchManagement: React.FC = () => {
    const { branches, setBranches, assets, setNotification, selectedBranchId, setSelectedBranchId } = useAppContext();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
    const [formData, setFormData] = useState({ name: '', location: '' });

    const assetCounts = useMemo(() => {
        const counts: { [key: number]: number } = {};
        branches.forEach(branch => {
            counts[branch.id] = assets.filter(asset => asset.assigneeType === 'branch' && asset.assigneeId === branch.id).length;
        });
        return counts;
    }, [assets, branches]);

    const handleOpenForm = (branch: Branch | null = null) => {
        setEditingBranch(branch);
        setFormData({ name: branch ? branch.name : '', location: branch ? branch.location : '' });
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setEditingBranch(null);
        setIsFormOpen(false);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingBranch) {
            // Edit
            setBranches(branches.map(b => b.id === editingBranch.id ? { ...b, ...formData } : b));
            setNotification({ message: `Branch "${formData.name}" updated successfully.`, type: 'success' });
        } else {
            // Add new
            const newBranch: Branch = {
                id: Date.now(),
                name: formData.name,
                location: formData.location,
            };
            setBranches([...branches, newBranch]);
            setNotification({ message: `Branch "${formData.name}" added successfully.`, type: 'success' });
        }
        handleCloseForm();
    };

    const handleDeleteRequest = (branch: Branch) => {
        if (assetCounts[branch.id] > 0) {
            setNotification({ message: `Cannot delete "${branch.name}" as it has assets assigned to it.`, type: 'error' });
            return;
        }
        setBranchToDelete(branch);
    };

    const confirmDelete = () => {
        if (branchToDelete) {
            setBranches(branches.filter(b => b.id !== branchToDelete.id));
            setNotification({ message: `Branch "${branchToDelete.name}" deleted successfully.`, type: 'success' });
            setBranchToDelete(null);
        }
    };

    if (selectedBranchId) {
        return <BranchDetailView branchId={selectedBranchId} onBack={() => setSelectedBranchId(null)} />;
    }

    return (
        <>
            <ConfirmationModal
                isOpen={!!branchToDelete}
                onClose={() => setBranchToDelete(null)}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
            >
                Are you sure you want to delete the branch "{branchToDelete?.name}"? This action cannot be undone.
            </ConfirmationModal>

            <Modal
                isOpen={isFormOpen}
                onClose={handleCloseForm}
                title={editingBranch ? 'Edit Branch' : 'Add New Branch'}
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <FormInput
                        label="Branch Name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                    />
                     <FormInput
                        label="Location"
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
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
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Manage Branches</h2>
                    <button onClick={() => handleOpenForm()} className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 font-medium transition-all duration-200 active:scale-95">
                        <div className="w-4 h-4">{ICONS.add}</div>
                        <span className="hidden sm:inline">Add Branch</span>
                    </button>
                </div>
                <div className="p-6 space-y-3">
                    {branches.map(branch => (
                         <div key={branch.id} onClick={() => setSelectedBranchId(branch.id)} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg flex items-center justify-between border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                             <div>
                                 <p className="font-semibold text-slate-800 dark:text-slate-100">{branch.name}</p>
                                 <p className="text-sm text-slate-500 dark:text-slate-400">{branch.location} &bull; Assets: {assetCounts[branch.id] || 0}</p>
                             </div>
                             <div className="flex items-center space-x-2">
                                 <button onClick={(e) => { e.stopPropagation(); handleOpenForm(branch); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-500" title="Edit">{ICONS.edit}</button>
                                 <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(branch); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-500" title="Delete">{ICONS.delete}</button>
                             </div>
                         </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default BranchManagement;