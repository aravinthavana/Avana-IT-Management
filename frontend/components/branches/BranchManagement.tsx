import { API_URL } from '../../utils/apiClient';
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
        <label className="block text-sm font-medium text-ink">{label}</label>
        <input {...props} className="mt-1 block w-full px-3 py-2 bg-surface border border-line rounded-md text-sm shadow-sm placeholder-quiet focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-ink" />
    </div>
);

const BranchManagement: React.FC = () => {
    const { branches, setBranches, assets, users, setNotification, selectedBranchId, setSelectedBranchId, getHeaders } = useAppContext();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
    const [formData, setFormData] = useState({ name: '', location: '' });
    const [isLoading, setIsLoading] = useState(false);

    const assetCounts = useMemo(() => {
        const counts: { [key: number]: number } = {};
        branches.forEach(branch => {
            counts[branch.id] = assets.filter(asset => asset.assigneeType === 'branch' && asset.assigneeId === branch.id).length;
        });
        return counts;
    }, [assets, branches]);

    const userCounts = useMemo(() => {
        const counts: { [key: number]: number } = {};
        branches.forEach(branch => {
            counts[branch.id] = users.filter(user =>
                user.branchId === branch.id ||
                (typeof user.branch === 'string' && user.branch.toLowerCase() === branch.name.toLowerCase()) ||
                (typeof user.branch === 'object' && user.branch?.name?.toLowerCase() === branch.name.toLowerCase()) ||
                (typeof user.branch === 'object' && user.branch?.id === branch.id)
            ).length;
        });
        return counts;
    }, [users, branches]);

    const handleOpenForm = (branch: Branch | null = null) => {
        setEditingBranch(branch);
        setFormData({ name: branch ? branch.name : '', location: branch ? (branch.location || '') : '' });
        setIsFormOpen(true);
    };

    const handleCloseForm = () => { setEditingBranch(null); setIsFormOpen(false); };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (editingBranch) {
                const res = await fetch(`${API_URL}/api/branches/${editingBranch.id}`, {
                    method: 'PUT', headers: getHeaders(),
                                credentials: 'include', body: JSON.stringify(formData),
                });
                if (!res.ok) throw new Error((await res.json()).error);
                const updated = await res.json();
                setBranches(branches.map(b => b.id === editingBranch.id ? updated : b));
                setNotification({ message: `Branch "${updated.name}" updated.`, type: 'success' });
            } else {
                const res = await fetch(`${API_URL}/api/branches`, {
                    method: 'POST', headers: getHeaders(),
                                credentials: 'include', body: JSON.stringify(formData),
                });
                if (!res.ok) throw new Error((await res.json()).error);
                const created = await res.json();
                setBranches([...branches, created]);
                setNotification({ message: `Branch "${created.name}" added.`, type: 'success' });
            }
            handleCloseForm();
        } catch (err: any) {
            setNotification({ message: err.message || 'An error occurred', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteRequest = (branch: Branch) => {
        if (assetCounts[branch.id] > 0) {
            setNotification({ message: `Cannot delete "${branch.name}" as it has assets assigned to it.`, type: 'error' });
            return;
        }
        setBranchToDelete(branch);
    };

    const confirmDelete = async () => {
        if (!branchToDelete) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/branches/${branchToDelete.id}`, {
                method: 'DELETE', headers: getHeaders(),
                                credentials: 'include',
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setBranches(branches.filter(b => b.id !== branchToDelete.id));
            setNotification({ message: `Branch "${branchToDelete.name}" deleted.`, type: 'success' });
            setBranchToDelete(null);
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to delete', type: 'error' });
        } finally {
            setIsLoading(false);
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
                        <button type="button" onClick={handleCloseForm} className="w-full sm:w-auto flex justify-center bg-muted text-ink px-5 py-2 rounded-lg hover:bg-muted font-medium transition-all duration-200 active:scale-95">Cancel</button>
                        <button type="submit" className="w-full sm:w-auto flex justify-center bg-accent text-on-strong px-5 py-2 rounded-lg hover:bg-accent font-medium transition-all duration-200 active:scale-95">Save</button>
                    </div>
                </form>
            </Modal>

            <div className="bg-surface rounded-lg shadow-md">
                <div className="p-6 flex justify-between items-center border-b border-line">
                    <h2 className="text-xl font-bold text-ink">Manage Branches</h2>
                    <button onClick={() => handleOpenForm()} className="bg-accent text-on-strong px-3 sm:px-4 py-2 rounded-lg hover:bg-accent flex items-center gap-2 font-medium transition-all duration-200 active:scale-95">
                        <div className="w-4 h-4">{ICONS.add}</div>
                        <span className="hidden sm:inline">Add Branch</span>
                    </button>
                </div>
                <div className="p-6 space-y-3">
                    {branches.map(branch => (
                         <div key={branch.id} onClick={() => setSelectedBranchId(branch.id)} className="bg-canvas p-4 rounded-lg flex items-center justify-between border border-line/80 cursor-pointer hover:bg-muted transition-colors">
                             <div>
                                 <p className="font-semibold text-ink">{branch.name}</p>
                                 <p className="text-sm text-quiet">{branch.location} &bull; Assets: {assetCounts[branch.id] || 0} &bull; Users: {userCounts[branch.id] || 0}</p>
                             </div>
                             <div className="flex items-center space-x-2">
                                 <button onClick={(e) => { e.stopPropagation(); handleOpenForm(branch); }} className="p-2 text-quiet rounded-full hover:bg-muted hover:text-ink" title="Edit">{ICONS.edit}</button>
                                 <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(branch); }} className="p-2 text-quiet rounded-full hover:bg-muted hover:text-ink" title="Delete">{ICONS.delete}</button>
                             </div>
                         </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default BranchManagement;