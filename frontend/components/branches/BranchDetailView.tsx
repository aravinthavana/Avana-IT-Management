import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { Asset } from '../../types';
import { ICONS } from '../../constants';
import AssignAssetModal from '../users/AssignAssetModal';
import UnassignAssetModal from '../users/UnassignAssetModal';

interface BranchDetailViewProps {
    branchId: number;
    onBack: () => void;
}

const BranchDetailView: React.FC<BranchDetailViewProps> = ({ branchId, onBack }) => {
    const { branches, assets, setAssets, setNotification, setSelectedAssetId, setSelectedUserId, users, getHeaders, fetchAssetHistory } = useAppContext();
    const branch = branches.find(b => b.id === branchId);
    const branchAssets = assets.filter(a => a.assigneeType?.toLowerCase() === 'branch' && a.assigneeId === branchId);
    
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assetToUnassign, setAssetToUnassign] = useState<Asset | null>(null);

    const branchUsers = useMemo(() => {
        if (!branch) return [];
        return users.filter(user => 
            user.branchId === branch.id ||
            (typeof user.branch === 'string' && user.branch.toLowerCase() === branch.name.toLowerCase()) ||
            (typeof user.branch === 'object' && user.branch?.name?.toLowerCase() === branch.name.toLowerCase()) ||
            (typeof user.branch === 'object' && user.branch?.id === branch.id)
        );
    }, [users, branch]);

    if (!branch) {
        return (
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold">Branch not found</h2>
                <button onClick={onBack} className="mt-4 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700">&larr; Back to Branches</button>
            </div>
        );
    }
    
    const handleAssignAsset = async (assetToAssign: Asset, condition: string) => {
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/assets/${assetToAssign.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...assetToAssign,
                    assigneeId: branch.id,
                    assigneeType: 'Branch',
                    status: 'Assigned',
                    location: branch.location,
                    condition,
                    specs: assetToAssign.specs ? JSON.stringify(assetToAssign.specs) : null
                })
            });
            if (!res.ok) throw new Error('Failed to assign asset');
            const updated = await res.json();
            setAssets(prevAssets => prevAssets.map(asset => 
                asset.id === assetToAssign.id ? { ...updated, specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : updated.specs } : asset
            ));
            fetchAssetHistory();
            setNotification({ message: `Successfully assigned ${assetToAssign.name} to branch ${branch.name}.`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
        setIsAssignModalOpen(false);
    };

    const handleConfirmUnassign = async (updatedAssetData: { status: string, remarks: string, condition: string }) => {
        if (!assetToUnassign) return;
        
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/assets/${assetToUnassign.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...assetToUnassign,
                    assigneeId: null,
                    assigneeType: null,
                    status: updatedAssetData.status,
                    remarks: updatedAssetData.remarks,
                    condition: updatedAssetData.condition,
                    specs: assetToUnassign.specs ? JSON.stringify(assetToUnassign.specs) : null
                })
            });
            if (!res.ok) throw new Error('Failed to unassign asset');
            const updated = await res.json();
            setAssets(prevAssets => prevAssets.map(asset => 
                asset.id === assetToUnassign.id ? { ...updated, specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : updated.specs } : asset
            ));
            fetchAssetHistory();
            setNotification({ message: `Successfully unassigned ${assetToUnassign.name}.`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
        setAssetToUnassign(null);
    };

    return (
        <>
            {branch && <AssignAssetModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} onAssign={handleAssignAsset} target={{ id: branch.id, name: branch.name, type: 'branch' }} />}
            <UnassignAssetModal isOpen={!!assetToUnassign} onClose={() => setAssetToUnassign(null)} onConfirm={handleConfirmUnassign} asset={assetToUnassign} />

            <div className="sticky top-16 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 -mx-4 sm:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onBack} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center text-sm transition-colors flex-shrink-0">&larr; <span className="hidden sm:inline ml-2 font-medium">Back</span></button>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate" title={branch.name}>{branch.name}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{branch.location}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsAssignModalOpen(true)} className="bg-brand-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 text-sm font-medium transition-colors flex-shrink-0">
                        {ICONS.add} <span className="hidden sm:inline">Assign Asset</span>
                    </button>
                </div>
            </div>

            <div className="space-y-6 pt-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Assigned Assets ({branchAssets.length})</h3>
                    </div>
                    <div className="space-y-3">
                        {branchAssets.length > 0 ? (
                            branchAssets.map(asset => (
                                <div key={asset.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-200 dark:border-slate-700/50">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{asset.name}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2">
                                            <span className="font-mono">{asset.assetId}</span>
                                            <span className="hidden sm:inline">&bull;</span>
                                            <span className="font-mono">S/N: {asset.serialNumber}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 flex-shrink-0 self-start sm:self-center">
                                        <button onClick={() => setSelectedAssetId(asset.id)} className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-semibold transition-colors">View</button>
                                        <button onClick={() => setAssetToUnassign(asset)} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-500" title="Unassign Asset">{ICONS.unassign}</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No assets are currently assigned to this branch.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Users in Branch ({branchUsers.length})</h3>
                    </div>
                    <div className="space-y-3">
                        {branchUsers.length > 0 ? (
                            branchUsers.map(user => (
                                <div 
                                    key={user.id} 
                                    onClick={() => setSelectedUserId(user.id)}
                                    className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{user.name}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate flex items-center gap-2">
                                                {user.employeeId && <span>{user.employeeId}</span>}
                                                {user.jobTitle && <span>&bull; {user.jobTitle}</span>}
                                                {user.email && <span className="hidden sm:inline">&bull; {user.email}</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-2 text-slate-400 dark:text-slate-500 flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No users found in this branch.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default BranchDetailView;