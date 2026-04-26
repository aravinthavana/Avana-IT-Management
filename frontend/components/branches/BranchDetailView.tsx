import React, { useState } from 'react';
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
    const { branches, assets, setAssets, setNotification, logAssetHistory, setSelectedAssetId } = useAppContext();
    const branch = branches.find(b => b.id === branchId);
    const branchAssets = assets.filter(a => a.assigneeType === 'branch' && a.assigneeId === branchId);
    
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assetToUnassign, setAssetToUnassign] = useState<Asset | null>(null);

    if (!branch) {
        return (
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold">Branch not found</h2>
                <button onClick={onBack} className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">&larr; Back to Branches</button>
            </div>
        );
    }
    
    const handleAssignAsset = (assetToAssign: Asset) => {
        setAssets(prevAssets => prevAssets.map(asset => 
            asset.id === assetToAssign.id 
            ? { ...asset, assigneeId: branch.id, assigneeType: 'branch', status: 'Assigned', location: branch.location } 
            : asset
        ));
        logAssetHistory(assetToAssign.id, 'Assigned', `Assigned to Branch: ${branch.name}.`);
        setNotification({ message: `Successfully assigned ${assetToAssign.name} to ${branch.name}.`, type: 'success' });
        setIsAssignModalOpen(false);
    };

    const handleConfirmUnassign = (updatedAssetData: { status: 'In Stock' | 'In Repair' | 'Retired', remarks: string }) => {
        if (!assetToUnassign) return;
        
        setAssets(prevAssets => prevAssets.map(asset => 
            asset.id === assetToUnassign.id 
            ? { ...asset, assigneeId: '', assigneeType: null, status: updatedAssetData.status, remarks: updatedAssetData.remarks } 
            : asset
        ));
        
        let details = `Unassigned from Branch: ${branch.name}. Status changed to '${updatedAssetData.status}'.`;
        if (updatedAssetData.remarks) {
            details += ` Remarks: "${updatedAssetData.remarks}"`;
        }
        logAssetHistory(assetToUnassign.id, 'Unassigned', details);

        setNotification({ message: `Successfully unassigned ${assetToUnassign.name}.`, type: 'success' });
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
                    <button onClick={() => setIsAssignModalOpen(true)} className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-medium transition-colors flex-shrink-0">
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
            </div>
        </>
    );
};

export default BranchDetailView;