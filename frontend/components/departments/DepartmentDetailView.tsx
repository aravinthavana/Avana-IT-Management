import { API_URL } from '../../utils/apiClient';
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
    const { departments, assets, setAssets, setNotification, setSelectedAssetId, users, navigate, setSelectedUserId, getHeaders, fetchAssetHistory } = useAppContext();
    const department = departments.find(d => d.id === departmentId);
    const departmentAssets = assets.filter(a => a.assigneeType?.toLowerCase() === 'department' && a.assigneeId === departmentId);

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assetToUnassign, setAssetToUnassign] = useState<Asset | null>(null);

    const departmentUsers = useMemo(() => {
        if (!department) return [];
        return users.filter(user =>
            user.departmentId === department.id ||
            (typeof user.department === 'string' && user.department.toLowerCase() === department.name.toLowerCase()) ||
            (typeof user.department === 'object' && user.department?.name?.toLowerCase() === department.name.toLowerCase()) ||
            (typeof user.department === 'object' && user.department?.id === department.id)
        );
    }, [users, department]);

    if (!department) {
        return (
            <div className="text-center p-8 bg-surface rounded-lg shadow-md">
                <h2 className="text-xl font-semibold">Department not found</h2>
                <button onClick={onBack} className="mt-4 bg-accent text-on-strong px-4 py-2 rounded-lg hover:bg-accent">&larr; Back to Departments</button>
            </div>
        );
    }

    const handleAssignAsset = async (assetToAssign: Asset, condition: string) => {
        try {
            const res = await fetch(`${API_URL}/api/assets/${assetToAssign.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...assetToAssign,
                    assigneeId: department.id,
                    assigneeType: 'Department',
                    status: 'Assigned',
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
            setNotification({ message: `Successfully assigned ${assetToAssign.name} to ${department.name}.`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
        setIsAssignModalOpen(false);
    };

    const handleConfirmUnassign = async (updatedAssetData: { status: string, remarks: string, condition: string }) => {
        if (!assetToUnassign) return;

        try {
            const res = await fetch(`${API_URL}/api/assets/${assetToUnassign.id}`, {
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

    const handleUserClick = (userId: number) => {
        setSelectedUserId(userId);
    };

    return (
        <>
            {department && <AssignAssetModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} onAssign={handleAssignAsset} target={{ id: department.id, name: department.name, type: 'department' }} />}
            <UnassignAssetModal isOpen={!!assetToUnassign} onClose={() => setAssetToUnassign(null)} onConfirm={handleConfirmUnassign} asset={assetToUnassign} />

            <div className="sticky top-16 bg-muted/80 backdrop-blur-sm z-10 -mx-4 sm:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-line">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onBack} className="bg-muted text-ink px-2 sm:px-3 py-1.5 rounded-lg hover:bg-muted flex items-center text-sm transition-colors flex-shrink-0">&larr; <span className="hidden sm:inline ml-2 font-medium">Back</span></button>
                        <h2 className="text-lg font-bold text-ink truncate" title={department.name}>{department.name} Department</h2>
                    </div>
                    <button onClick={() => setIsAssignModalOpen(true)} className="bg-accent text-on-strong px-3 sm:px-4 py-2 rounded-lg hover:bg-accent flex items-center gap-2 text-sm font-medium transition-colors flex-shrink-0">
                        {ICONS.add} <span className="hidden sm:inline">Assign Asset</span>
                    </button>
                </div>
            </div>

            <div className="space-y-6 pt-6">
                <div className="bg-surface p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-ink">Assigned Assets ({departmentAssets.length})</h3>
                    </div>
                    <div className="space-y-3">
                        {departmentAssets.length > 0 ? (
                            departmentAssets.map(asset => (
                                <div key={asset.id} className="bg-canvas p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-line">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-ink truncate">{asset.name}</p>
                                        <p className="text-sm text-quiet flex flex-wrap items-center gap-x-2">
                                            <span className="font-mono">{asset.assetId}</span>
                                            <span className="hidden sm:inline">&bull;</span>
                                            <span className="font-mono">S/N: {asset.serialNumber}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 flex-shrink-0 self-start sm:self-center">
                                        <button onClick={() => setSelectedAssetId(asset.id)} className="px-3 py-1.5 rounded-md bg-muted text-ink hover:bg-muted text-xs font-semibold transition-colors">View</button>
                                        <button onClick={() => setAssetToUnassign(asset)} className="p-2 text-quiet rounded-full hover:bg-surface hover:text-ink" title="Unassign Asset">{ICONS.unassign}</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-quiet text-center py-4">No assets are currently assigned to this department.</p>
                        )}
                    </div>
                </div>

                <div className="bg-surface p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-ink">Users in Department ({departmentUsers.length})</h3>
                    </div>
                    <div className="space-y-3">
                        {departmentUsers.length > 0 ? (
                            departmentUsers.map(user => (
                                <div
                                    key={user.id}
                                    onClick={() => handleUserClick(user.id)}
                                    className="bg-canvas p-3.5 rounded-xl flex items-center justify-between gap-3 border border-line cursor-pointer hover:bg-muted transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-line flex-shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-accent/10 text-ink flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-semibold text-ink truncate">{user.name}</p>
                                            <p className="text-sm text-quiet truncate flex items-center gap-2">
                                                {user.employeeId && <span>{user.employeeId}</span>}
                                                {user.jobTitle && <span>&bull; {user.jobTitle}</span>}
                                                {user.email && <span className="hidden sm:inline">&bull; {user.email}</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-2 text-quiet flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-quiet text-center py-4">No users found in this department.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DepartmentDetailView;