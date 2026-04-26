import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { Asset } from '../../types';
import { ICONS } from '../../constants';
import AssignAssetModal from './AssignAssetModal';
import UnassignAssetModal from './UnassignAssetModal';

interface UserDetailViewProps {
    userId: number;
    onBack: () => void;
}

const UserDetailView: React.FC<UserDetailViewProps> = ({ userId, onBack }) => {
    const { users, assets, setAssets, setNotification, logAssetHistory, setSelectedAssetId, setPreviewTarget } = useAppContext();
    const user = users.find(u => u.id === userId);
    const userAssets = assets.filter(a => a.assigneeType === 'user' && a.assigneeId === userId);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assetToUnassign, setAssetToUnassign] = useState<Asset | null>(null);

    if (!user) {
        return (
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold">User not found</h2>
                <button onClick={onBack} className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">&larr; Back to Users</button>
            </div>
        );
    }
    
    const handleAssignAsset = (assetToAssign: Asset) => {
        setAssets(prevAssets => prevAssets.map(asset => 
            asset.id === assetToAssign.id 
            ? { ...asset, assigneeId: user!.id, assigneeType: 'user', status: 'Assigned', location: user!.location } 
            : asset
        ));
        logAssetHistory(assetToAssign.id, 'Assigned', `Assigned to ${user!.name}.`);
        setNotification({ message: `Successfully assigned ${assetToAssign.name} to ${user!.name}.`, type: 'success' });
        setIsAssignModalOpen(false);
    };

    const handleConfirmUnassign = (updatedAssetData: { status: 'In Stock' | 'In Repair' | 'Retired', remarks: string }) => {
        if (!assetToUnassign) return;
        
        setAssets(prevAssets => prevAssets.map(asset => 
            asset.id === assetToUnassign.id 
            ? { 
                ...asset, 
                assigneeId: '',
                assigneeType: null,
                status: updatedAssetData.status,
                remarks: updatedAssetData.remarks 
              } 
            : asset
        ));
        
        let details = `Status changed to '${updatedAssetData.status}'.`;
        if (updatedAssetData.remarks) {
            details += ` Remarks: "${updatedAssetData.remarks}"`;
        }
        logAssetHistory(assetToUnassign.id, 'Unassigned', details);

        setNotification({ message: `Successfully unassigned ${assetToUnassign.name}.`, type: 'success' });
        setAssetToUnassign(null);
    };

    return (
        <>
            {user && <AssignAssetModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} onAssign={handleAssignAsset} target={{ id: user.id, name: user.name, type: 'user', company: user.company }} />}
            <UnassignAssetModal
                isOpen={!!assetToUnassign}
                onClose={() => setAssetToUnassign(null)}
                onConfirm={handleConfirmUnassign}
                asset={assetToUnassign}
            />

            {/* Sticky Header */}
            <div className="sticky top-16 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 -mx-4 sm:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onBack} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center text-sm transition-colors flex-shrink-0">
                            &larr; <span className="hidden sm:inline ml-2 font-medium">Back</span>
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate" title={user.name}>{user.name}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">ID: {user.employeeId}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsAssignModalOpen(true)} className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-medium transition-colors flex-shrink-0">
                        {ICONS.add}
                        <span className="hidden sm:inline">Assign Asset</span>
                    </button>
                </div>
            </div>

            <div className="space-y-6 pt-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                    <div className="flex flex-col items-center text-center md:flex-row md:items-start md:space-x-6 md:text-left">
                        {user.avatar ? (
                            <img src={user.avatar} alt="User Avatar" className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-700 shadow-md flex-shrink-0 object-cover"/>
                        ) : (
                            <div className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-700 shadow-md flex-shrink-0 flex items-center justify-center font-bold text-3xl bg-gradient-to-br from-red-400 to-red-600 text-white">
                                {user.name?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="mt-4 md:mt-0">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{user.name}</h2>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Employee ID:</strong> {user.employeeId || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Mobile:</strong> {user.mobile || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Job Title:</strong> {user.jobTitle || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Department:</strong> {user.department?.name || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Company:</strong> {user.company || 'N/A'}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Location:</strong> {user.branch?.name || user.location || 'N/A'}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Assigned Assets ({userAssets.length})</h3>
                    </div>

                    <div className="space-y-3">
                        {userAssets.length > 0 ? (
                            userAssets.map(asset => (
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
                                        {asset.category === 'Laptop' && (
                                            <button onClick={() => setPreviewTarget({ type: 'declaration', assetId: asset.id, userId: user.id })} className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-semibold transition-colors">Form</button>
                                        )}
                                        <button onClick={() => setAssetToUnassign(asset)} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-500" title="Unassign Asset">
                                            {ICONS.unassign}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No assets are currently assigned to this user.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserDetailView;