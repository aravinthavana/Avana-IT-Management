import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { Asset } from '../../types';
import { ICONS } from '../../constants';
import AssignAssetModal from '../users/AssignAssetModal';
import UnassignAssetModal from '../users/UnassignAssetModal';

interface DepartmentDetailViewProps {
    departmentId: number;
    onBack: () => void;
}

const DepartmentDetailView: React.FC<DepartmentDetailViewProps> = ({ departmentId, onBack }) => {
    const { departments, assets, setAssets, setNotification, logAssetHistory, setSelectedAssetId, users, navigate, setSelectedUserId } = useAppContext();
    const department = departments.find(d => d.id === departmentId);
    const departmentAssets = assets.filter(a => a.assigneeType === 'department' && a.assigneeId === departmentId);
    
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assetToUnassign, setAssetToUnassign] = useState<Asset | null>(null);

    const departmentUsers = useMemo(() => {
        if (!department) return [];
        return users.filter(user => user.department === department.name);
    }, [users, department]);

    if (!department) {
        return (
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold">Department not found</h2>
                <button onClick={onBack} className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">&larr; Back to Departments</button>
            </div>
        );
    }
    
    const handleAssignAsset = (assetToAssign: Asset) => {
        setAssets(prevAssets => prevAssets.map(asset => 
            asset.id === assetToAssign.id 
            ? { ...asset, assigneeId: department.id, assigneeType: 'department', status: 'Assigned' } 
            : asset
        ));
        logAssetHistory(assetToAssign.id, 'Assigned', `Assigned to Department: ${department.name}.`);
        setNotification({ message: `Successfully assigned ${assetToAssign.name} to ${department.name}.`, type: 'success' });
        setIsAssignModalOpen(false);
    };

    const handleConfirmUnassign = (updatedAssetData: { status: 'In Stock' | 'In Repair' | 'Retired', remarks: string }) => {
        if (!assetToUnassign) return;
        
        setAssets(prevAssets => prevAssets.map(asset => 
            asset.id === assetToUnassign.id 
            ? { ...asset, assigneeId: '', assigneeType: null, status: updatedAssetData.status, remarks: updatedAssetData.remarks } 
            : asset
        ));
        
        let details = `Unassigned from Department: ${department.name}. Status changed to '${updatedAssetData.status}'.`;
        if (updatedAssetData.remarks) {
            details += ` Remarks: "${updatedAssetData.remarks}"`;
        }
        logAssetHistory(assetToUnassign.id, 'Unassigned', details);

        setNotification({ message: `Successfully unassigned ${assetToUnassign.name}.`, type: 'success' });
        setAssetToUnassign(null);
    };

    const handleUserClick = (userId: number) => {
        setSelectedUserId(userId);
        navigate('users');
    };

    return (
        <>
            {department && <AssignAssetModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} onAssign={handleAssignAsset} target={{ id: department.id, name: department.name, type: 'department' }} />}
            <UnassignAssetModal isOpen={!!assetToUnassign} onClose={() => setAssetToUnassign(null)} onConfirm={handleConfirmUnassign} asset={assetToUnassign} />

            <div className="sticky top-16 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 -mx-4 sm:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onBack} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center text-sm transition-colors flex-shrink-0">&larr; <span className="hidden sm:inline ml-2 font-medium">Back</span></button>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate" title={department.name}>{department.name} Department</h2>
                    </div>
                    <button onClick={() => setIsAssignModalOpen(true)} className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-medium transition-colors flex-shrink-0">
                        {ICONS.add} <span className="hidden sm:inline">Assign Asset</span>
                    </button>
                </div>
            </div>

            <div className="space-y-6 pt-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Assigned Assets ({departmentAssets.length})</h3>
                    </div>
                    <div className="space-y-3">
                        {departmentAssets.length > 0 ? (
                            departmentAssets.map(asset => (
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
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No assets are currently assigned to this department.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Users in Department ({departmentUsers.length})</h3>
                    </div>
                    <div className="space-y-3">
                        {departmentUsers.length > 0 ? (
                            departmentUsers.map(user => (
                                <div 
                                    key={user.id} 
                                    onClick={() => handleUserClick(user.id)}
                                    className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-100">{user.name}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{user.employeeId}</p>
                                        </div>
                                    </div>
                                    <div className="p-2 text-slate-500 dark:text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No users found in this department.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DepartmentDetailView;