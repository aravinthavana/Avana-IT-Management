import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';
import ConfirmationModal from '../ui/ConfirmationModal';
import UserForm from './UserForm';
import UserDetailView from './UserDetailView';
import { User, Asset } from '../../types';
import AssetTypeChoiceModal from '../assets/AssetTypeChoiceModal';
import AssetForm from '../assets/AssetForm';

interface UserManagementProps {
    initialFilters: any[] | null;
    onFiltersApplied: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ initialFilters, onFiltersApplied }) => {
    const { users, setUsers, assets, setAssets, setNotification, logAssetHistory, selectedUserId, setSelectedUserId, selectedDepartmentId, navigate } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [userToDelete, setUserToDelete] = useState<number | null>(null);
    const [sortKey, setSortKey] = useState('name-asc');
    const [activeFilters, setActiveFilters] = useState([{ id: Date.now(), field: 'company', value: 'All' }]);

    // State for assigning new asset
    const [isAssetChoiceModalOpen, setIsAssetChoiceModalOpen] = useState(false);
    const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
    const [userToAssignAsset, setUserToAssignAsset] = useState<User | null>(null);
    const [assetForForm, setAssetForForm] = useState<Asset | null>(null);
    const [newAssetType, setNewAssetType] = useState<'Device' | 'Other'>('Device');

    useEffect(() => {
        if (initialFilters && initialFilters.length > 0) {
            setActiveFilters(initialFilters);
            onFiltersApplied();
        }
    }, [initialFilters, onFiltersApplied]);

    const filterableUserFields: Record<string, string> = {
        assetStatus: 'Asset Status', company: 'Company', location: 'Location', department: 'Department'
    };

    const handleOpenModal = (user: User | null = null) => { setEditingUser(user); setIsModalOpen(true); };
    const handleCloseModal = () => { setEditingUser(null); setIsModalOpen(false); };

    const handleSaveUser = (userData: Partial<User>) => {
        if (editingUser) {
            setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...userData } as User : u));
            setNotification({ message: `User "${userData.name}" updated successfully.`, type: 'success' });
        } else {
            const name = userData.name || 'New User';
            const nameParts = name.split(' ').filter(p => p);
            const initials = (`${nameParts[0]?.charAt(0) || ''}${nameParts.length > 1 ? nameParts[nameParts.length - 1]?.charAt(0) : ''}`).toUpperCase();

            const newUser: User = {
                id: Date.now(),
                name: name,
                employeeId: userData.employeeId || '',
                email: userData.email || '',
                role: 'User',
                department: userData.department || '',
                company: userData.company || 'AMD',
                location: userData.location || '',
                avatar: `https://placehold.co/100x100/7C3AED/FFFFFF?text=${initials || 'NU'}`,
                mobile: userData.mobile || '',
            };
            setUsers([...users, newUser]);
            setNotification({ message: `User "${newUser.name}" added successfully.`, type: 'success' });
        }
        handleCloseModal();
    };


    const handleDeleteRequest = (userId: number) => {
        if (assets.some(a => a.assigneeType === 'user' && a.assigneeId === userId)) {
            setNotification({ message: "Cannot delete user. Please reassign their assets first.", type: 'error' });
            return;
        }
        setUserToDelete(userId);
    };

    const confirmDelete = () => {
        if(userToDelete) { 
            setUsers(users.filter(u => u.id !== userToDelete)); 
            setUserToDelete(null); 
            setNotification({ message: "User deleted successfully.", type: 'success' });
        }
    };
    
    // --- Handlers for "Add New Asset" flow ---
    const handleAddNewAssetClick = (user: User) => {
        setUserToAssignAsset(user);
        setIsAssetChoiceModalOpen(true);
    };

    const handleSelectAssetType = (type: 'Device' | 'Other') => {
        if (!userToAssignAsset) return;
        setNewAssetType(type);
        const newAssetDefaults: Partial<Asset> = {
            id: 0,
            assigneeId: userToAssignAsset.id,
            assigneeType: 'user',
            company: userToAssignAsset.company,
            location: userToAssignAsset.location,
            status: 'Assigned',
        };
        setAssetForForm(newAssetDefaults as Asset);
        setIsAssetChoiceModalOpen(false);
        setIsAssetFormOpen(true);
    };

    const handleSaveNewAsset = (assetsData: Asset[]) => {
        let lastId = Math.max(...assets.map(a => a.id), 0);
        const newAssetsWithIds = assetsData.map(asset => {
            lastId++;
            const newAsset = { ...asset, id: lastId };
            logAssetHistory(newAsset.id, 'Asset Created', `Asset '${newAsset.name}' with ID '${newAsset.assetId}' was created.`);
            logAssetHistory(newAsset.id, 'Assigned', `Assigned to ${userToAssignAsset!.name}.`);
            return newAsset;
        });

        setAssets(prev => [...prev, ...newAssetsWithIds]);
        setNotification({ message: `${newAssetsWithIds.length} asset(s) added and assigned to ${userToAssignAsset!.name}.`, type: 'success' });
        handleCloseAssetModals();
    };

    const handleCloseAssetModals = () => {
        setIsAssetChoiceModalOpen(false);
        setIsAssetFormOpen(false);
        setUserToAssignAsset(null);
        setAssetForForm(null);
    };
    // --- End of Handlers ---

    const countAssets = useMemo(() => users.reduce((acc, user) => {
        acc[user.id] = assets.filter(asset => asset.assigneeType === 'user' && asset.assigneeId === user.id).length;
        return acc;
    }, {} as Record<number, number>), [users, assets]);

    const addFilter = () => {
        const usedFields = activeFilters.map(f => f.field);
        const nextField = Object.keys(filterableUserFields).find(f => !usedFields.includes(f));
        if (nextField) { setActiveFilters([...activeFilters, { id: Date.now(), field: nextField, value: 'All' }]); }
    };

    const removeFilter = (id: number) => setActiveFilters(activeFilters.filter(f => f.id !== id));

    const updateFilter = (id: number, newField: object | null, newValue: object | null) => {
        setActiveFilters(activeFilters.map(f => f.id === id ? { ...f, ...newField, ...newValue } : f));
    };

    const getOptionsForUserField = (field: string) => {
        if (field === 'assetStatus') return ['All', 'With Assets', 'Without Assets'];
        const options = [...new Set(users.map(user => (user as any)[field]))].filter(Boolean);
        return ['All', ...options];
    };

    const processedUsers = useMemo(() => {
        let filtered = users.filter(user => {
            const searchMatch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.department.toLowerCase().includes(searchTerm.toLowerCase());
            
            const activeFilterMatch = activeFilters.every(filter => {
                if (filter.value === 'All') return true;
                if (filter.field === 'assetStatus') {
                    const hasAssets = countAssets[user.id] > 0;
                    if (filter.value === 'With Assets') return hasAssets;
                    if (filter.value === 'Without Assets') return !hasAssets;
                }
                return (user as any)[filter.field] === filter.value;
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
    }, [users, searchTerm, activeFilters, countAssets, sortKey]);

    const handleBackFromUser = () => {
        setSelectedUserId(null);
        if (selectedDepartmentId) {
            navigate('departments');
        }
    };
    
    if (selectedUserId) return <UserDetailView userId={selectedUserId} onBack={handleBackFromUser} />;

    return (
        <>
            <ConfirmationModal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} onConfirm={confirmDelete} title="Confirm Deletion">
                Are you sure you want to delete this user? This action cannot be undone.
            </ConfirmationModal>
            <div className="bg-transparent">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <div className="relative w-full sm:w-auto">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">{ICONS.search}</span>
                        <input type="text" placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                    <button onClick={() => handleOpenModal()} className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 w-full sm:w-auto font-medium transition-all duration-200 active:scale-95">Add New User</button>
                </div>

                 <div className="space-y-4 mb-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center">{ICONS.filter}<span className="ml-2">Filters:</span></span>
                         {activeFilters.length < Object.keys(filterableUserFields).length && (
                            <button onClick={addFilter} className="flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-full hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900">{ICONS.add}</button>
                        )}
                    </div>
                     {activeFilters.map((filter) => {
                        const availableFields = Object.keys(filterableUserFields).filter(f => !activeFilters.some(af => af.field === f && af.id !== filter.id));
                        return (
                            <div key={filter.id} className="flex flex-wrap items-center gap-3 p-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <select value={filter.field} onChange={(e) => updateFilter(filter.id, { field: e.target.value, value: 'All' }, null)} className="text-sm border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:border-red-500 focus:ring focus:ring-red-500 focus:ring-opacity-50 bg-white dark:bg-slate-800">
                                    <option value={filter.field}>{filterableUserFields[filter.field]}</option>
                                    {availableFields.map(fieldKey => <option key={fieldKey} value={fieldKey}>{filterableUserFields[fieldKey]}</option>)}
                                </select>
                                <select value={filter.value} onChange={(e) => updateFilter(filter.id, null, { value: e.target.value })} className="text-sm border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:border-red-500 focus:ring focus:ring-red-500 focus:ring-opacity-50 bg-white dark:bg-slate-800">
                                    {getOptionsForUserField(filter.field).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                {activeFilters.length > 1 && ( <button onClick={() => removeFilter(filter.id)} className="flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-full hover:bg-red-200 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">{ICONS.remove}</button> )}
                            </div>
                        );
                    })}
                    <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center">{ICONS.sort} <span className="ml-2">Sort by:</span></span>
                        <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="text-sm border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:border-red-500 focus:ring focus:ring-red-500 focus:ring-opacity-50 bg-white dark:bg-slate-800">
                           <option value="name-asc">Name (A-Z)</option><option value="name-desc">Name (Z-A)</option>
                           <option value="employeeId-asc">Employee ID (Asc)</option><option value="employeeId-desc">Employee ID (Desc)</option>
                           <option value="location-asc">Location (A-Z)</option><option value="location-desc">Location (Z-A)</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-3">
                    {processedUsers.map(user => (
                        <div key={user.id} onClick={() => setSelectedUserId(user.id)} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:shadow-md dark:hover:bg-slate-700/50 hover:-translate-y-px transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between p-4 border border-slate-200/80 dark:border-slate-700">
                            <div className="flex items-center w-full sm:w-auto">
                                <img className="h-11 w-11 rounded-full flex-shrink-0" src={user.avatar} alt={user.name} />
                                <div className="ml-4 truncate">
                                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{user.name}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user.employeeId} &bull; {user.department}</p>
                                </div>
                            </div>
                            <div className="hidden lg:flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300 text-center">
                                <div><p className="text-xs text-slate-400 dark:text-slate-500">Location</p><p>{user.location}</p></div>
                                <div><p className="text-xs text-slate-400 dark:text-slate-500">Company</p><p>{user.company}</p></div>
                                <div><p className="text-xs text-slate-400 dark:text-slate-500">Assets</p><p className="font-semibold">{countAssets[user.id]}</p></div>
                            </div>
                            <div className="flex items-center space-x-1 flex-shrink-0 mt-3 sm:mt-0">
                                <button onClick={(e) => { e.stopPropagation(); handleOpenModal(user); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-500" title="Edit">{ICONS.edit}</button>
                                <button onClick={(e) => { e.stopPropagation(); handleAddNewAssetClick(user); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-green-600 dark:hover:text-green-500" title="Add Asset">{ICONS.add}</button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(user.id); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-500" title="Delete">{ICONS.delete}</button>
                            </div>
                        </div>
                    ))}
                </div>
                <UserForm isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveUser} user={editingUser} />
                <AssetTypeChoiceModal isOpen={isAssetChoiceModalOpen} onClose={handleCloseAssetModals} onSelect={handleSelectAssetType} />
                <AssetForm isOpen={isAssetFormOpen} onClose={handleCloseAssetModals} onSave={handleSaveNewAsset} asset={assetForForm} assetType={newAssetType} />
            </div>
        </>
    );
};

export default UserManagement;