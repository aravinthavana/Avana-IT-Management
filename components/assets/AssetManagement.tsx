import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ASSET_ICONS, ICONS } from '../../constants';
import ConfirmationModal from '../ui/ConfirmationModal';
import AssetForm from './AssetForm';
import { Asset } from '../../types';
import AssetTypeChoiceModal from './AssetTypeChoiceModal';
import { getAssigneeDisplayInfo } from '../../utils/assigneeUtils';
import BulkChangeStatusModal from './BulkChangeStatusModal';
import { getWarrantyStatus } from '../../utils/assetUtils';
import AssetCreationMethodModal from './AssetCreationMethodModal';


const AssetManagement: React.FC = () => {
    const { assets, setAssets, users, departments, branches, purchaseRecords, setNotification, logAssetHistory, setSelectedAssetId, assetFilters, setAssetFilters, navigate } = useAppContext();
    
    // Modal states
    const [isCreationMethodModalOpen, setIsCreationMethodModalOpen] = useState(false);
    const [isAssetChoiceModalOpen, setIsAssetChoiceModalOpen] = useState(false);
    const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
    const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
    
    // Data states
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [newAssetType, setNewAssetType] = useState<'Device' | 'Other'>('Device');
    const [assetToDelete, setAssetToDelete] = useState<number | null>(null);
    const [assetsToDelete, setAssetsToDelete] = useState<number[]>([]);
    
    // Control states
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState('name-asc');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);


    const filterableAssetFields: Record<string, string> = {
        status: 'Status',
        company: 'Company',
        category: 'Category',
        location: 'Location',
        brand: 'Brand',
    };

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
        setNewAssetType(asset.specs && Object.keys(asset.specs).length > 0 ? 'Device' : 'Other');
        setEditingAsset(asset);
        setIsAssetFormOpen(true);
    };

    const handleCloseForms = () => {
        setIsCreationMethodModalOpen(false);
        setIsAssetChoiceModalOpen(false);
        setIsAssetFormOpen(false);
        setEditingAsset(null);
    };

    const handleSaveAsset = (assetsData: Asset[]) => {
        if (editingAsset) {
            // Editing - will always be a single asset
            const updatedAssetData = assetsData[0];
            setAssets(assets.map(a => a.id === editingAsset.id ? { ...a, ...updatedAssetData } : a));
            logAssetHistory(editingAsset.id, 'Asset Updated', 'Asset details were updated.');
            setNotification({ message: `Asset "${updatedAssetData.name}" updated successfully.`, type: 'success' });
        } else {
            // Creating new assets
            let lastId = Math.max(...assets.map(a => a.id), 0);
            const newAssetsWithIds = assetsData.map(asset => {
                lastId++;
                const newAssetWithId = { ...asset, id: lastId };
                logAssetHistory(newAssetWithId.id, 'Asset Created', `Asset '${newAssetWithId.name}' with ID '${newAssetWithId.assetId}' was created.`);
                return newAssetWithId;
            });

            setAssets(prev => [...prev, ...newAssetsWithIds]);
            setNotification({ message: `${newAssetsWithIds.length} asset(s) added successfully.`, type: 'success' });
        }
        handleCloseForms();
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

    const confirmDelete = () => {
        if(assetToDelete) {
            setAssets(assets.filter(a => a.id !== assetToDelete));
            setAssetToDelete(null);
            setNotification({ message: "Asset deleted successfully.", type: 'success' });
        }
    };
    
    const getAssignee = useMemo(() => (assigneeId: number | '' | null, assigneeType: 'user' | 'department' | 'branch' | null) => {
        return getAssigneeDisplayInfo(assigneeId, assigneeType, users, departments, branches);
    }, [users, departments, branches]);
    
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
        let filtered = assetsWithPurchaseDate.filter(asset => {
            const searchMatch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.assetId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.category.toLowerCase().includes(searchTerm.toLowerCase());
            
            const activeFilterMatch = assetFilters.every(filter => {
                if (filter.value === 'All') return true;

                if (filter.field === 'warrantyStatus') {
                    const status = getWarrantyStatus(asset);
                    return status.label === filter.value;
                }

                return (asset as any)[filter.field] === filter.value;
            });

            return searchMatch && activeFilterMatch;
        });

        const [key, direction] = sortKey.split('-');
        filtered.sort((a, b) => {
            if ((a as any)[key] < (b as any)[key]) return direction === 'asc' ? -1 : 1;
            if ((a as any)[key] > (b as any)[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        return filtered;
    }, [assetsWithPurchaseDate, searchTerm, assetFilters, sortKey]);
    
    useEffect(() => {
        setSelectedAssetIds(new Set());
    }, [assetFilters, searchTerm, sortKey]);

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

    const confirmBulkDelete = () => {
        setAssets(prev => prev.filter(a => !assetsToDelete.includes(a.id)));
        setNotification({ message: `${assetsToDelete.length} assets deleted successfully.`, type: 'success' });
        setAssetsToDelete([]);
        setSelectedAssetIds(new Set());
    };
    
    const handleBulkStatusChange = (newStatus: 'In Stock' | 'In Repair' | 'Retired', remarks: string) => {
        const idsToUpdate = Array.from(selectedAssetIds);
        setAssets(prev => prev.map(asset => {
            if (idsToUpdate.includes(asset.id)) {
                const updatedAsset = { 
                    ...asset, 
                    status: newStatus, 
                    assigneeId: '', 
                    assigneeType: null,
                    remarks: remarks ? (asset.remarks ? `${asset.remarks}\n[${new Date().toLocaleDateString()}] ${remarks}` : `[${new Date().toLocaleDateString()}] ${remarks}`) : asset.remarks
                };
                logAssetHistory(asset.id, 'Status Change', `Bulk update: Status changed to ${newStatus}.`);
                return updatedAsset;
            }
            return asset;
        }));
        setNotification({ message: `Updated status for ${idsToUpdate.length} assets.`, type: 'success' });
        setSelectedAssetIds(new Set());
        setIsBulkStatusModalOpen(false);
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
            'Assigned': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            'In Stock': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            'In Repair': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            'Retired': 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300',
        };
        return <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status] || ''}`}>{status}</span>;
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
            
            <div className="bg-transparent pb-20">
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <div className="relative w-full sm:w-auto">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">{ICONS.search}</span>
                        <input type="text" placeholder="Search assets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                         {isSelectMode ? (
                            <button onClick={() => { setIsSelectMode(false); setSelectedAssetIds(new Set()); }} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-5 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 w-full sm:w-auto font-medium transition-all duration-200 active:scale-95">Cancel</button>
                         ) : (
                            <button onClick={() => setIsSelectMode(true)} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 px-5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 w-full sm:w-auto font-medium transition-all duration-200 active:scale-95">Select</button>
                         )}
                        <button onClick={handleOpenCreationMethod} className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 w-full sm:w-auto font-medium transition-all duration-200 active:scale-95">Add New Asset</button>
                    </div>
                </div>
                
                 <div className="space-y-4 mb-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center">{ICONS.filter}<span className="ml-2">Filters:</span></span>
                         {assetFilters.length < Object.keys(filterableAssetFields).length && (
                            <button onClick={addFilter} className="flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-full hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900">{ICONS.add}</button>
                        )}
                    </div>
                     {assetFilters.map((filter) => {
                        if (filter.field === 'warrantyStatus') return null; // Don't show the warranty filter UI
                        const availableFields = Object.keys(filterableAssetFields).filter(f => !assetFilters.some(af => af.field === f && af.id !== filter.id));
                        return (
                            <div key={filter.id} className="flex flex-wrap items-center gap-3 p-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <select value={filter.field} onChange={(e) => updateFilter(filter.id, { field: e.target.value, value: 'All' }, null)} className="text-sm border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:border-red-500 focus:ring focus:ring-red-500 focus:ring-opacity-50 bg-white dark:bg-slate-800">
                                    <option value={filter.field}>{filterableAssetFields[filter.field]}</option>
                                    {availableFields.map(fieldKey => <option key={fieldKey} value={fieldKey}>{filterableAssetFields[fieldKey]}</option>)}
                                </select>
                                <select value={filter.value} onChange={(e) => updateFilter(filter.id, null, { value: e.target.value })} className="text-sm border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:border-red-500 focus:ring focus:ring-red-500 focus:ring-opacity-50 bg-white dark:bg-slate-800">
                                    {getOptionsForAssetField(filter.field).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                {assetFilters.length > 1 && ( <button onClick={() => removeFilter(filter.id)} className="flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-full hover:bg-red-200 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">{ICONS.remove}</button> )}
                            </div>
                        );
                    })}
                     <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center">{ICONS.sort} <span className="ml-2">Sort by:</span></span>
                        <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="text-sm border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:border-red-500 focus:ring focus:ring-red-500 focus:ring-opacity-50 bg-white dark:bg-slate-800">
                           <option value="name-asc">Name (A-Z)</option><option value="name-desc">Name (Z-A)</option>
                           <option value="purchaseDate-desc">Purchase Date (Newest)</option><option value="purchaseDate-asc">Purchase Date (Oldest)</option>
                           <option value="category-asc">Category (A-Z)</option><option value="category-desc">Category (Z-A)</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-3">
                     {isSelectMode && (
                        <div className="flex items-center p-2">
                           <input
                               id="select-all-assets"
                               type="checkbox"
                               className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                               checked={processedAssets.length > 0 && selectedAssetIds.size === processedAssets.length}
                               onChange={handleToggleSelectAll}
                               disabled={processedAssets.length === 0}
                           />
                            <label htmlFor="select-all-assets" className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                               Select All ({processedAssets.length} items)
                           </label>
                       </div>
                    )}
                    {processedAssets.map(asset => {
                        const assignee = getAssignee(asset.assigneeId, asset.assigneeType);
                        return (
                            <div key={asset.id} onClick={() => handleRowClick(asset.id)} className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:shadow-md dark:hover:bg-slate-700/50 hover:-translate-y-px transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between p-4 border dark:border-slate-700 ${selectedAssetIds.has(asset.id) ? 'border-red-500 ring-2 ring-red-200 dark:ring-red-900/50' : 'border-slate-200/80'}`}>
                                <div className="flex items-center w-full sm:w-auto">
                                     {isSelectMode && (
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500 flex-shrink-0 mr-3"
                                            checked={selectedAssetIds.has(asset.id)}
                                            onChange={() => handleToggleSelect(asset.id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                     )}
                                    <div className="w-10 h-10 flex items-center justify-center text-slate-500 dark:text-slate-400 flex-shrink-0">
                                        {ASSET_ICONS[asset.category] || ASSET_ICONS.default}
                                    </div>
                                    <div className="ml-4 truncate">
                                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{asset.name}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{asset.assetId} &bull; {asset.category}</p>
                                    </div>
                                </div>
                                 <div className="hidden lg:flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300 text-center">
                                    <div><p className="text-xs text-slate-400 dark:text-slate-500">Status</p><p>{getStatusChip(asset.status)}</p></div>
                                    <div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">Assigned To</p>
                                        <div className="flex items-center gap-1">
                                            <span>{assignee.name}</span>
                                            {assignee.type && <span className={`text-xs px-1.5 py-0.5 rounded-md ${assignee.typeColor}`}>{assignee.type}</span>}
                                        </div>
                                    </div>
                                    <div><p className="text-xs text-slate-400 dark:text-slate-500">Location</p><p>{asset.location}</p></div>
                                </div>
                                <div className="flex items-center space-x-1 flex-shrink-0 mt-3 sm:mt-0">
                                    <button onClick={(e) => { e.stopPropagation(); handleEditAsset(asset); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-500" title="Edit">{ICONS.edit}</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(asset.id); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-500" title="Delete">{ICONS.delete}</button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <AssetCreationMethodModal isOpen={isCreationMethodModalOpen} onClose={handleCloseForms} onSelectMethod={handleSelectCreationMethod} />
                <AssetTypeChoiceModal isOpen={isAssetChoiceModalOpen} onClose={handleCloseForms} onSelect={handleSelectAssetType} />
                <AssetForm isOpen={isAssetFormOpen} onClose={handleCloseForms} onSave={handleSaveAsset} asset={editingAsset} assetType={newAssetType} />
            </div>
             {selectedAssetIds.size > 0 && (
                <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white dark:bg-slate-800 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.4)] border-t border-slate-200 dark:border-slate-700 p-3 z-20 flex items-center justify-between transition-transform duration-300">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{selectedAssetIds.size} asset(s) selected</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsBulkStatusModalOpen(true)} className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm font-semibold transition-colors">Change Status</button>
                        <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 text-sm font-semibold transition-colors">Delete</button>
                        <button onClick={() => { setSelectedAssetIds(new Set()); setIsSelectMode(false); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700" title="Clear selection">{ICONS.close}</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AssetManagement;