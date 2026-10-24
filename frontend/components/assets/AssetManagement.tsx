import { API_URL } from '../../utils/apiClient';
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ASSET_ICONS, ICONS } from '../../constants';
import ConfirmationModal from '../ui/ConfirmationModal';
import { useAuth } from '../../contexts/AuthContext';
import AssetForm from './AssetForm';
import { Asset } from '../../types';
import AssetTypeChoiceModal from './AssetTypeChoiceModal';
import { getAssigneeDisplayInfo } from '../../utils/assigneeUtils';
import BulkChangeStatusModal from './BulkChangeStatusModal';
import { getWarrantyStatus } from '../../utils/assetUtils';
import AssetCreationMethodModal from './AssetCreationMethodModal';
import UnassignAssetModal from '../users/UnassignAssetModal';




const AssetManagement: React.FC = () => {
    const { assets, setAssets, users, departments, branches, purchaseRecords, setNotification, setSelectedAssetId, assetFilters, setAssetFilters, navigate, pageState, clearPageState, getHeaders, fetchAssetHistory } = useAppContext();
    const { user } = useAuth();
    const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';
    // Modal states
    const [isCreationMethodModalOpen, setIsCreationMethodModalOpen] = useState(false);
    const [isAssetChoiceModalOpen, setIsAssetChoiceModalOpen] = useState(false);
    const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
    const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
    const [assetToUnassign, setAssetToUnassign] = useState<Asset | null>(null);

    // Data states
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [newAssetType, setNewAssetType] = useState<'Device' | 'Other'>('Device');
    const [assetToDelete, setAssetToDelete] = useState<number | null>(null);
    const [assetsToDelete, setAssetsToDelete] = useState<number[]>([]);

    // Control states
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState('name-asc');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);


    const filterableAssetFields: Record<string, string> = {
        status: 'Status',
        condition: 'Condition',
        company: 'Company',
        category: 'Category',
        location: 'Location',
        brand: 'Brand',
    };

    useEffect(() => {
        if (pageState?.editingAssetId && assets.length > 0) {
            const assetToEdit = assets.find(a => a.id === pageState.editingAssetId);
            if (assetToEdit) {
                handleEditAsset(assetToEdit);
            }
            clearPageState();
        }
    }, [pageState, assets, clearPageState]);

    // --- Handlers for Asset Creation/Editing ---
    const handleOpenCreationMethod = () => setIsCreationMethodModalOpen(true);

    const handleSelectCreationMethod = (method: 'purchase' | 'existing') => {
        setIsCreationMethodModalOpen(false);
        if (method === 'purchase') {
            navigate('purchases', { openForm: true });
        } else {
            setIsAssetChoiceModalOpen(true);
        }
    };

    const handleSelectAssetType = (type: 'Device' | 'Other') => {
        setNewAssetType(type);
        setEditingAsset(null);
        setIsAssetChoiceModalOpen(false);
        setIsAssetFormOpen(true);
    };

    const handleEditAsset = (asset: Asset) => {
        const isDeviceCategory = ['Laptop', 'Desktop', 'Server', 'Tablet', 'Mobile', 'Device'].includes(asset.category) || (asset.specs && Object.keys(asset.specs).length > 0);
        setNewAssetType(isDeviceCategory ? 'Device' : 'Other');
        setEditingAsset(asset);
        setIsAssetFormOpen(true);
    };

    const handleCloseForms = () => {
        setIsCreationMethodModalOpen(false);
        setIsAssetChoiceModalOpen(false);
        setIsAssetFormOpen(false);
        setEditingAsset(null);
    };

    const handleSaveAsset = async (assetsData: Asset[]) => {
        try {
            if (editingAsset) {
                // Editing - will always be a single asset
                const updatedAssetData = assetsData[0];
                const res = await fetch(`${API_URL}/api/assets/${editingAsset.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    credentials: 'include',
                    body: JSON.stringify({
                        ...updatedAssetData,
                        specs: updatedAssetData.specs ? JSON.stringify(updatedAssetData.specs) : null
                    })
                });
                if (!res.ok) throw new Error((await res.json()).error);
                const updated = await res.json();

                setAssets(assets.map(a => a.id === editingAsset.id ? {
                    ...a,
                    ...updated,
                    condition: updated.condition || updatedAssetData.condition,
                    specs: typeof updated.specs === 'string' ? (() => { try { const p = JSON.parse(updated.specs); return typeof p === 'string' ? JSON.parse(p) : p; } catch { return {}; } })() : (updated.specs || a.specs)
                } : a));
                fetchAssetHistory();
                setNotification({ message: `Asset "${updatedAssetData.name}" updated successfully.`, type: 'success' });
            } else {
                // Creating new assets
                const savedAssets: Asset[] = [];
                for (const asset of assetsData) {
                    const res = await fetch(`${API_URL}/api/assets`, {
                        method: 'POST',
                        headers: getHeaders(),
                        credentials: 'include',
                        body: JSON.stringify({
                            ...asset,
                            specs: asset.specs ? JSON.stringify(asset.specs) : null
                        })
                    });
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.error || `Failed to create asset "${asset.name}"`);
                    }
                    const saved = await res.json();
                    const parsed = { ...saved, specs: typeof saved.specs === 'string' ? (() => { try { const p = JSON.parse(saved.specs); return typeof p === 'string' ? JSON.parse(p) : p; } catch { return {}; } })() : saved.specs };
                    savedAssets.push(parsed);
                }

                setAssets(prev => [...prev, ...savedAssets]);
                fetchAssetHistory();
                setNotification({ message: `${savedAssets.length} asset(s) added successfully.`, type: 'success' });
            }
            handleCloseForms();
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to save asset', type: 'error' });
        }
    };

    // --- Handlers for Deletion ---
    const handleDeleteRequest = (assetId: number) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset?.status === 'Assigned') {
            setNotification({ message: "Cannot delete an assigned asset. Please unassign it first.", type: 'error' });
            return;
        }
        setAssetToDelete(assetId);
    };

    const confirmDelete = async () => {
        if(assetToDelete) {
            try {
                const res = await fetch(`${API_URL}/api/assets/${assetToDelete}`, {
                    method: 'DELETE',
                    headers: getHeaders(),
                    credentials: 'include'
                });
                if (!res.ok) throw new Error((await res.json()).error);

                setAssets(assets.filter(a => a.id !== assetToDelete));
                setAssetToDelete(null);
                setNotification({ message: "Asset deleted successfully.", type: 'success' });
            } catch (err: any) {
                setNotification({ message: err.message || 'Failed to delete asset', type: 'error' });
            }
        }
    };

    const getAssignee = useMemo(() => (assigneeId: number | '' | null, assigneeType: 'user' | 'department' | 'branch' | null) => {
        return getAssigneeDisplayInfo(assigneeId as any, assigneeType as any, users, departments, branches);
    }, [users, departments, branches]);

    const getAssetEffectiveLocation = React.useCallback((asset: Asset): string => {
        if (asset.assigneeType?.toLowerCase() === 'user' && asset.assigneeId) {
            const u = users.find(x => x.id === asset.assigneeId);
            if (u) return u.location || (typeof u.branch === 'object' ? u.branch?.name : u.branch) || 'Remote / Field';
        }
        if (asset.assigneeType?.toLowerCase() === 'branch' && asset.assigneeId) {
            const b = branches.find(x => x.id === asset.assigneeId);
            if (b) return b.name;
        }
        if (asset.assigneeType?.toLowerCase() === 'department' && asset.assigneeId) {
            const d = departments.find(x => x.id === asset.assigneeId);
            if (d) return d.name;
        }
        if (asset.status === 'In Stock' || asset.status === 'Available for Reallocation') {
            return 'In Stock';
        }
        if (asset.status === 'In Repair') {
            return 'In Repair';
        }
        return 'In Stock';
    }, [users, branches, departments]);

    const addFilter = () => {
        const usedFields = assetFilters.map(f => f.field);
        const nextField = Object.keys(filterableAssetFields).find(f => !usedFields.includes(f));
        if (nextField) {
            setAssetFilters([...assetFilters, { id: Date.now(), field: nextField, value: 'All' }]);
        }
    };

    const removeFilter = (id: number) => setAssetFilters(assetFilters.filter(f => f.id !== id));

    const updateFilter = (id: number, newField: object | null, newValue: object | null) => {
        setAssetFilters(assetFilters.map(f => f.id === id ? { ...f, ...newField, ...newValue } : f));
    };

    const getOptionsForAssetField = (field: string) => {
        if (field === 'location') {
            const options = [...new Set(assets.map(asset => getAssetEffectiveLocation(asset)))].filter(Boolean);
            return ['All', ...options];
        }
        const options = [...new Set(assets.map(asset => (asset as any)[field]))].filter(Boolean);
        return ['All', ...options];
    };

    const assetsWithPurchaseDate = useMemo(() => {
        const purchaseDateMap = new Map(purchaseRecords.map(p => [p.id, p.purchaseDate]));
        return assets.map(asset => ({
            ...asset,
            purchaseDate: purchaseDateMap.get(asset.purchaseId) || ''
        }));
    }, [assets, purchaseRecords]);

    const processedAssets = useMemo(() => {
        let result = assetsWithPurchaseDate.filter(asset => {
            const matchesSearch =
                (asset.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (asset.assetId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (asset.serialNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase());

            const matchesFilters = assetFilters.every(filter => {
                if (filter.value === 'All') return true;
                if (filter.field === 'status') return asset.status === filter.value;
                if (filter.field === 'category') return asset.category === filter.value;
                if (filter.field === 'location') return getAssetEffectiveLocation(asset) === filter.value;
                if (filter.field === 'warrantyStatus') {
                    const status = getWarrantyStatus(asset);
                    return status.label === filter.value;
                }
                return (asset as any)[filter.field] === filter.value;
            });
            return matchesSearch && matchesFilters;
        });

        result.sort((a, b) => {
            const [key, direction] = sortKey.split('-');
            if ((a as any)[key] < (b as any)[key]) return direction === 'asc' ? -1 : 1;
            if ((a as any)[key] > (b as any)[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [assetsWithPurchaseDate, searchTerm, assetFilters, sortKey]);

    const totalPages = Math.ceil(processedAssets.length / itemsPerPage);
    const paginatedAssets = processedAssets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, assetFilters, sortKey]);

    useEffect(() => {
        setSelectedAssetIds(new Set());

        if (pageState?.editingAssetId) {
            const assetToEdit = assets.find(a => a.id === pageState.editingAssetId);
            if (assetToEdit) {
                handleEditAsset(assetToEdit);
                clearPageState();
            }
        }
    }, [assetFilters, searchTerm, sortKey, assets, pageState, clearPageState]);

    const handleToggleSelect = (assetId: number) => {
        setSelectedAssetIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(assetId)) {
                newSet.delete(assetId);
            } else {
                newSet.add(assetId);
            }
            return newSet;
        });
    };

    const handleToggleSelectAll = () => {
        if (selectedAssetIds.size === processedAssets.length) {
            setSelectedAssetIds(new Set());
        } else {
            setSelectedAssetIds(new Set(processedAssets.map(a => a.id)));
        }
    };

    const handleBulkDelete = () => {
        const toDelete = Array.from(selectedAssetIds);
        const assignedInSelection = assets.some(a => toDelete.includes(a.id) && a.status === 'Assigned');
        if (assignedInSelection) {
            setNotification({ message: 'Cannot delete. Some selected assets are still assigned.', type: 'error' });
            return;
        }
        setAssetsToDelete(toDelete);
    };

    const confirmBulkDelete = async () => {
        try {
            let deletedCount = 0;
            for (const id of assetsToDelete) {
                const res = await fetch(`${API_URL}/api/assets/${id}`, {
                    method: 'DELETE',
                    headers: getHeaders(),
                    credentials: 'include'
                });
                if (res.ok) deletedCount++;
            }

            setAssets(prev => prev.filter(a => !assetsToDelete.includes(a.id)));
            setNotification({ message: `${deletedCount} assets deleted successfully.`, type: 'success' });
            setAssetsToDelete([]);
            setSelectedAssetIds(new Set());
        } catch (err: any) {
            setNotification({ message: 'Failed to complete bulk deletion', type: 'error' });
        }
    };

    const handleBulkStatusChange = async (newStatus: string, remarks: string) => {
        const idsToUpdate = Array.from(selectedAssetIds);
        try {
            let updatedCount = 0;
            for (const id of idsToUpdate) {
                const asset = assets.find(a => a.id === id);
                if (!asset) continue;

                const res = await fetch(`${API_URL}/api/assets/${id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    credentials: 'include',
                    body: JSON.stringify({
                        ...asset,
                        status: newStatus,
                        assigneeId: null,
                        assigneeType: null,
                        remarks: remarks ? (asset.remarks ? `${asset.remarks}\n[${new Date().toLocaleDateString()}] ${remarks}` : `[${new Date().toLocaleDateString()}] ${remarks}`) : asset.remarks,
                        specs: asset.specs ? JSON.stringify(asset.specs) : null
                    })
                });
                if (res.ok) updatedCount++;
            }

            setAssets(prev => prev.map(asset => {
                if (idsToUpdate.includes(asset.id)) {
                    return {
                        ...asset,
                        status: newStatus,
                        assigneeId: '',
                        assigneeType: null,
                        remarks: remarks ? (asset.remarks ? `${asset.remarks}\n[${new Date().toLocaleDateString()}] ${remarks}` : `[${new Date().toLocaleDateString()}] ${remarks}`) : asset.remarks
                    };
                }
                return asset;
            }));
            fetchAssetHistory();
            setNotification({ message: `Updated status for ${updatedCount} assets.`, type: 'success' });
            setSelectedAssetIds(new Set());
            setIsBulkStatusModalOpen(false);
        } catch (err: any) {
            setNotification({ message: 'Failed to complete bulk status update', type: 'error' });
        }
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
                    status: updatedAssetData.status,
                    assigneeId: null,
                    assigneeType: null,
                    remarks: updatedAssetData.remarks,
                    condition: updatedAssetData.condition,
                    specs: assetToUnassign.specs ? (typeof assetToUnassign.specs === 'string' ? assetToUnassign.specs : JSON.stringify(assetToUnassign.specs)) : null
                })
            });
            if (!res.ok) throw new Error('Failed to unassign asset');
            const updated = await res.json();
            setAssets(prev => prev.map(a => a.id === assetToUnassign.id ? {
                ...a,
                ...updated,
                condition: updated.condition || updatedAssetData.condition,
                specs: typeof updated.specs === 'string' ? JSON.parse(updated.specs) : (updated.specs || a.specs)
            } : a));
            fetchAssetHistory();
            setNotification({ message: `Successfully unassigned ${assetToUnassign.name}.`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
        setAssetToUnassign(null);
    };

    const handleRowClick = (assetId: number) => {
        if (isSelectMode) {
            handleToggleSelect(assetId);
        } else {
            setSelectedAssetId(assetId);
        }
    };

    const getStatusChip = (status: string) => {
        const styles: { [key: string]: string } = {
            'Assigned':                   'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            'In Stock':                   'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            'Reserved':                   'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300',
            'In Repair':                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            'Under Inspection':           'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
            'Available for Reallocation': 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
            'Retired':                    'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300',
            'Disposed':                   'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        };
        return <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status] || ''}`}>{status}</span>;
    };

    const getConditionChip = (condition?: string) => {
        if (!condition) return null;
        const styles: { [key: string]: string } = {
            'Brand New':              'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
            'Excellent':              'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
            'Good':                   'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800',
            'Fair':                   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
            'Minor Damage':           'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
            'Damaged / Under Repair': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
        };
        return <span className={`px-2 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-full border ${styles[condition] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{condition}</span>;
    };

    const handleExportCSV = () => {
        const headers = ['Asset ID', 'Name', 'Category', 'Status', 'Condition', 'Brand', 'Model', 'Serial Number', 'Location'];
        const csvRows = [headers.join(',')];

        processedAssets.forEach(asset => {
            const row = [
                asset.assetId || '',
                `"${asset.name || ''}"`,
                asset.category || '',
                asset.status || '',
                asset.condition || 'Good',
                asset.brand || '',
                asset.model || '',
                `"${asset.serialNumber || ''}"`,
                `"${getAssetEffectiveLocation(asset) || ''}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `avana_it_assets_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setNotification({ message: 'Exporting assets to CSV...', type: 'info' });
    };

    return (
        <>
            <ConfirmationModal isOpen={!!assetToDelete} onClose={() => setAssetToDelete(null)} onConfirm={confirmDelete} title="Confirm Deletion">
                Are you sure you want to delete this asset? This action cannot be undone.
            </ConfirmationModal>
            <ConfirmationModal isOpen={assetsToDelete.length > 0} onClose={() => setAssetsToDelete([])} onConfirm={confirmBulkDelete} title={`Confirm Bulk Deletion`}>
                Are you sure you want to delete {assetsToDelete.length} selected assets? This action cannot be undone.
            </ConfirmationModal>
            <BulkChangeStatusModal isOpen={isBulkStatusModalOpen} onClose={() => setIsBulkStatusModalOpen(false)} onConfirm={handleBulkStatusChange} assetIds={Array.from(selectedAssetIds)} />

            <div className="bg-transparent pb-24">
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <div className="relative w-full sm:w-auto flex-1 max-w-md">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">{ICONS.search}</span>
                        <input type="text" placeholder="Search assets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2.5 border rounded-xl w-full focus:outline-none focus:ring-2 transition-all shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-brand-500" />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                         <button onClick={handleExportCSV} className="border p-2.5 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700" title="Export to CSV">
                            {ICONS.download}
                        </button>
                         {isAdminOrManager && (
                             <>
                                {isSelectMode ? (
                                    <button onClick={() => { setIsSelectMode(false); setSelectedAssetIds(new Set()); }} className="px-5 py-2.5 rounded-xl w-full sm:w-auto font-medium transition-all active:scale-95 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">Cancel</button>
                                ) : (
                                    <button onClick={() => setIsSelectMode(true)} className="border px-5 py-2.5 rounded-xl w-full sm:w-auto font-medium transition-all active:scale-95 shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Select</button>
                                )}
                                <button onClick={handleOpenCreationMethod} className="px-5 py-2.5 rounded-xl w-full sm:w-auto font-bold transition-all active:scale-95 shadow-lg bg-brand-600 text-white hover:bg-brand-700 shadow-brand-600/20">Add New Asset</button>
                             </>
                         )}
                    </div>
                </div>

                 <div className="space-y-4 mb-6 p-5 rounded-2xl border shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">{ICONS.filter} Filters:</span>
                         {assetFilters.length < Object.keys(filterableAssetFields).length && (
                            <button aria-label="Add" onClick={addFilter} className="flex items-center justify-center w-7 h-7 rounded-full transition-colors bg-red-100 text-brand-600 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400">{ICONS.add}</button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {assetFilters.map((filter) => {
                            const availableFields = Object.keys(filterableAssetFields).filter(f => !assetFilters.some(af => af.field === f && af.id !== filter.id));
                            return (
                                <div key={filter.id} className="flex items-center gap-2 p-2 border rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700">
                                    <select value={filter.field} onChange={(e) => updateFilter(filter.id, { field: e.target.value, value: 'All' }, null)} className="flex-1 text-sm bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200">
                                        <option value={filter.field}>{filterableAssetFields[filter.field]}</option>
                                        {availableFields.map(fieldKey => <option key={fieldKey} value={fieldKey}>{filterableAssetFields[fieldKey]}</option>)}
                                    </select>
                                    <select value={filter.value} onChange={(e) => updateFilter(filter.id, null, { value: e.target.value })} className="flex-1 text-sm bg-transparent border-none focus:ring-0 font-semibold text-brand-600 dark:text-red-400">
                                        {getOptionsForAssetField(filter.field).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    {assetFilters.length > 1 && ( <button aria-label="Close dialog" onClick={() => removeFilter(filter.id)} className="p-1.5 transition-colors text-slate-400 hover:text-red-500">{ICONS.close}</button> )}
                                </div>
                            );
                        })}
                    </div>
                     <div className="flex items-center gap-3 pt-4 border-t mt-2 border-slate-100 dark:border-slate-700">
                        <span className="font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">{ICONS.sort} Sort by:</span>
                        <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="text-sm border-none rounded-lg px-3 py-1.5 focus:ring-2 bg-slate-100 dark:bg-slate-900 focus:ring-brand-500 text-slate-700 dark:text-slate-200">
                           <option value="name-asc">Name (A-Z)</option><option value="name-desc">Name (Z-A)</option>
                           <option value="purchaseDate-desc">Purchase Date (Newest)</option><option value="purchaseDate-asc">Purchase Date (Oldest)</option>
                           <option value="category-asc">Category (A-Z)</option><option value="category-desc">Category (Z-A)</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-3">
                     {isSelectMode && processedAssets.length > 0 && (
                        <div className="flex items-center px-4 py-2 rounded-lg border bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800">
                           <input
                                id="select-all-assets"
                                type="checkbox"
                                className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                checked={selectedAssetIds.size === processedAssets.length}
                                onChange={handleToggleSelectAll}
                           />
                            <label htmlFor="select-all-assets" className="ml-3 text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                               Select All ({processedAssets.length} assets)
                           </label>
                       </div>
                    )}

                    {paginatedAssets.map((asset) => {
                        const assignee = getAssignee(asset.assigneeId, asset.assigneeType);
                        return (
                            <div key={asset.id} onClick={() => handleRowClick(asset.id)} className={`group relative p-4 rounded-2xl shadow-sm border transition-all duration-300 flex flex-col sm:flex-row items-center justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 bg-white dark:bg-slate-800 ${selectedAssetIds.has(asset.id) ? 'ring-2 border-brand-500 ring-brand-500/10 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-100 dark:border-slate-700 dark:hover:bg-slate-700/50'}`}>
                                <div className="flex items-center gap-4 w-full sm:w-auto flex-1 min-w-0">
                                    {isSelectMode && (
                                        <input type="checkbox" checked={selectedAssetIds.has(asset.id)} onChange={() => handleToggleSelect(asset.id)} onClick={(e) => e.stopPropagation()} className="w-5 h-5 rounded-lg text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600" />
                                    )}
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-inner bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                                        {ASSET_ICONS[asset.category] || ASSET_ICONS.default}
                                    </div>
                                    <div className="truncate flex-1">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                            <p className="font-bold truncate text-slate-800 dark:text-slate-100">{asset.name}</p>
                                            {getStatusChip(asset.status)}
                                            {getConditionChip(asset.condition)}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs font-medium flex-wrap text-slate-500 dark:text-slate-400">
                                            <span className="font-mono px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700">{asset.assetId}</span>
                                            <span className="flex items-center gap-1">{assignee.name} {assignee.type && <span className={`text-[9px] px-1 rounded-sm ${assignee.typeColor} opacity-80`}>{assignee.type}</span>}</span>
                                        </div>
                                        <div className="flex lg:hidden items-center gap-2 text-[11px] mt-1 flex-wrap text-slate-400 dark:text-slate-500">
                                            <span>{asset.category}</span>
                                            {asset.company && <span>• {asset.company}</span>}
                                            {getAssetEffectiveLocation(asset) && <span>• {getAssetEffectiveLocation(asset)}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden lg:flex items-center gap-8 px-6 border-x mx-4 text-xs border-slate-100 dark:border-slate-700">
                                    <div className="text-center">
                                        <p className="mb-1 font-bold uppercase tracking-tighter text-[9px] text-slate-400">Brand & Model</p>
                                        <p className="font-semibold truncate max-w-[120px] text-slate-700 dark:text-slate-300" title={`${asset.brand || ''} ${asset.model || ''}`}>{asset.brand || '-'} {asset.model || '-'}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="mb-1 font-bold uppercase tracking-tighter text-[9px] text-slate-400">Company</p>
                                        <p className="font-semibold text-slate-700 dark:text-slate-300">{asset.company || 'N/A'}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="mb-1 font-bold uppercase tracking-tighter text-[9px] text-slate-400">Category</p>
                                        <p className="font-semibold text-slate-700 dark:text-slate-300">{asset.category}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="mb-1 font-bold uppercase tracking-tighter text-[9px] text-slate-400">Location</p>
                                        <p className="font-semibold text-slate-700 dark:text-slate-300">{getAssetEffectiveLocation(asset) || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 mt-3 sm:mt-0 self-end sm:self-center">
                                    {isAdminOrManager && (
                                        <>
                                            {(asset.status === 'Assigned' || asset.status === 'Pending Handover') && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAssetToUnassign(asset);
                                                    }}
                                                    title={asset.status === 'Pending Handover' ? "Cancel Handover / Unassign" : "Unassign Asset"}
                                                    className="p-2 rounded-xl transition-all text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                                >
                                                    {ICONS.unassign}
                                                </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); handleEditAsset(asset); }} className="p-2 rounded-xl transition-all text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40" title="Edit">{ICONS.edit}</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(asset.id); }} className="p-2 rounded-xl transition-all text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30" title="Delete">{ICONS.delete}</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {processedAssets.length === 0 && (
                        <div className="text-center py-24 rounded-3xl border-2 border-dashed shadow-inner bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700">
                             <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse bg-slate-50 dark:bg-slate-900 text-slate-300">
                                {ICONS.search}
                            </div>
                            <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-slate-100">No assets found</h3>
                            <p className="mb-6 text-slate-500 dark:text-slate-400">Try adjusting your filters or search terms.</p>
                             <button onClick={() => { setSearchTerm(''); setAssetFilters([{ id: Date.now(), field: 'status', value: 'All' }]); }} className="px-6 py-2 rounded-xl font-bold transition-all bg-red-50 text-brand-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100">Reset All Filters</button>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Showing <span className="text-slate-800 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span>-
                                <span className="text-slate-800 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, processedAssets.length)}</span> of
                                <span className="text-slate-800 dark:text-slate-200"> {processedAssets.length}</span> assets
                            </p>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 rounded-xl border disabled:opacity-20 transition-all font-bold shadow-sm border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                >
                                    &larr; Prev
                                </button>
                                {[...Array(totalPages)].map((_, i) => {
                                    const page = i + 1;
                                    // Show first, last, and pages around current
                                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                        return (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-10 h-10 rounded-xl font-bold transition-all ${currentPage === page ? 'shadow-lg bg-brand-600 text-white shadow-brand-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                {page}
                                            </button>
                                        );
                                    }
                                    if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="px-1 text-slate-300">...</span>;
                                    return null;
                                })}
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 rounded-xl border disabled:opacity-20 transition-all font-bold shadow-sm border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                >
                                    Next &rarr;
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <AssetCreationMethodModal isOpen={isCreationMethodModalOpen} onClose={handleCloseForms} onSelectMethod={handleSelectCreationMethod} />
                <AssetTypeChoiceModal isOpen={isAssetChoiceModalOpen} onClose={handleCloseForms} onSelect={handleSelectAssetType} />
                <AssetForm isOpen={isAssetFormOpen} onClose={handleCloseForms} onSave={handleSaveAsset} asset={editingAsset} assetType={newAssetType} />
                <UnassignAssetModal isOpen={!!assetToUnassign} onClose={() => setAssetToUnassign(null)} onConfirm={handleConfirmUnassign} asset={assetToUnassign} />
            </div>

             {selectedAssetIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-72 backdrop-blur-md shadow-2xl border p-3 rounded-2xl z-30 flex items-center gap-6 transition-all animate-in fade-in slide-in-from-bottom-4 bg-white/90 dark:bg-slate-800/95 dark:shadow-red-900/10 border-slate-200 dark:border-slate-700">
                    <div className="pl-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Selection</p>
                        <p className="font-black leading-none text-slate-800 dark:text-white">{selectedAssetIds.size} <span className="text-xs font-normal">assets</span></p>
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                    <div className="flex items-center gap-2 pr-2">
                        <button onClick={() => setIsBulkStatusModalOpen(true)} className="px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-black dark:hover:bg-slate-100">Change Status</button>
                        <button onClick={handleBulkDelete} className="px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg bg-red-600 text-white hover:bg-red-700 shadow-red-600/20">Delete All</button>
                        <button aria-label="Close dialog" onClick={() => { setSelectedAssetIds(new Set()); setIsSelectMode(false); }} className="ml-2 p-1.5 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">{ICONS.close}</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AssetManagement;