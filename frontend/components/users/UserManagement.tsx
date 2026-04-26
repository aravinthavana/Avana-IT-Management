import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import ConfirmationModal from '../ui/ConfirmationModal';
import UserForm from './UserForm';
import UserDetailView from './UserDetailView';
import { User } from '../../types';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

interface UserManagementProps {
    initialFilters: any[] | null;
    onFiltersApplied: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ initialFilters, onFiltersApplied }) => {
    const { users, setUsers, setNotification, selectedUserId, setSelectedUserId, selectedDepartmentId, navigate, getHeaders, fetchAllData } = useAppContext();
    const { user: loggedInUser } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmAction, setConfirmAction] = useState<{ type: 'deactivate' | 'reactivate' | 'delete'; userId: number; userName: string } | null>(null);
    const [sortKey, setSortKey] = useState('name-asc');
    const [isLoading, setIsLoading] = useState(false);

    const handleOpenModal = (user: User | null = null) => { setEditingUser(user); setIsModalOpen(true); };
    const handleCloseModal = () => { setEditingUser(null); setIsModalOpen(false); };

    const handleSaveUser = async (userData: any) => {
        setIsLoading(true);
        try {
            if (editingUser) {
                const res = await fetch(`${API_URL}/api/users/${editingUser.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(userData),
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to update user');
                }
                const updated = await res.json();
                setUsers(users.map(u => u.id === editingUser.id ? updated : u));
                setNotification({ message: `User "${updated.name}" updated successfully.`, type: 'success' });
            } else {
                const res = await fetch(`${API_URL}/api/users`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(userData),
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to create user');
                }
                const created = await res.json();
                setUsers([...users, created]);
                setNotification({ message: `User "${created.name}" created. They can now log in.`, type: 'success' });
            }
            handleCloseModal();
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusChange = async (userId: number, newStatus: 'Active' | 'Inactive') => {
        // Guard: cannot change own status
        if (userId === loggedInUser?.id) {
            setNotification({ message: 'You cannot change the status of your own account.', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}/status`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update status');
            }
            const updated = await res.json();
            setUsers(users.map(u => u.id === userId ? { ...u, status: updated.status } : u));
            setNotification({ message: `User ${newStatus === 'Inactive' ? 'deactivated' : 'reactivated'} successfully.`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
            setConfirmAction(null);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (userId === loggedInUser?.id) {
            setNotification({ message: 'You cannot delete your own account.', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}`, {
                method: 'DELETE',
                headers: getHeaders(),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete user');
            }
            setUsers(users.filter(u => u.id !== userId));
            setNotification({ message: 'User permanently deleted.', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
            setConfirmAction(null);
        }
    };

    const handleConfirm = () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'deactivate') handleStatusChange(confirmAction.userId, 'Inactive');
        else if (confirmAction.type === 'reactivate') handleStatusChange(confirmAction.userId, 'Active');
        else if (confirmAction.type === 'delete') handleDeleteUser(confirmAction.userId);
    };

    const processedUsers = useMemo(() => {
        let filtered = users.filter(user =>
            (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.department?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        const [key, direction] = sortKey.split('-');
        filtered.sort((a, b) => {
            const aVal = (a as any)[key] || '';
            const bVal = (b as any)[key] || '';
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        return filtered;
    }, [users, searchTerm, sortKey]);

    const handleBackFromUser = () => {
        setSelectedUserId(null);
        if (selectedDepartmentId) navigate('departments');
    };

    if (selectedUserId) return <UserDetailView userId={selectedUserId} onBack={handleBackFromUser} />;

    const confirmMessages = {
        deactivate: `Are you sure you want to deactivate "${confirmAction?.userName}"? They will no longer be able to log in.`,
        reactivate: `Are you sure you want to reactivate "${confirmAction?.userName}"? They will be able to log in again.`,
        delete: `Are you sure you want to PERMANENTLY delete "${confirmAction?.userName}"? This cannot be undone.`,
    };

    return (
        <>
            <ConfirmationModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleConfirm}
                title={confirmAction?.type === 'delete' ? 'Permanently Delete User' : confirmAction?.type === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Reactivation'}
            >
                {confirmAction ? confirmMessages[confirmAction.type] : ''}
            </ConfirmationModal>

            <div className="bg-transparent">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <div className="relative w-full sm:w-auto">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">{ICONS.search}</span>
                        <input
                            type="text"
                            placeholder="Search by name, email, department..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-slate-800">
                            <option value="name-asc">Name (A-Z)</option>
                            <option value="name-desc">Name (Z-A)</option>
                        </select>
                        <button onClick={() => handleOpenModal()} className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 w-full sm:w-auto font-medium transition-all duration-200 active:scale-95 flex-shrink-0">
                            Add New User
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    {processedUsers.length === 0 && (
                        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                            <p className="text-lg font-medium">No users found</p>
                            <p className="text-sm mt-1">Try adjusting your search or add a new user.</p>
                        </div>
                    )}
                    {processedUsers.map(user => {
                        const isSelf = user.id === loggedInUser?.id;
                        const isInactive = user.status === 'Inactive';
                        const deptName = user.department?.name || '';

                        return (
                            <div
                                key={user.id}
                                onClick={() => setSelectedUserId(user.id)}
                                className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:shadow-md dark:hover:bg-slate-700/50 hover:-translate-y-px transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between p-4 border dark:border-slate-700 ${isInactive ? 'border-slate-200 opacity-70' : 'border-slate-200/80'}`}
                            >
                                <div className="flex items-center w-full sm:w-auto">
                                    {user.avatar ? (
                                        <img src={user.avatar} alt={user.name} className="h-11 w-11 rounded-full flex-shrink-0 object-cover border border-slate-200 dark:border-slate-700 shadow-sm" />
                                    ) : (
                                        <div className="h-11 w-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg bg-gradient-to-br from-red-400 to-red-600 text-white shadow-sm">
                                            {user.name?.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="ml-4">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-slate-800 dark:text-slate-100">{user.name}</p>
                                            {isSelf && <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">You</span>}
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{user.email} {deptName ? `• ${deptName}` : ''}</p>
                                    </div>
                                </div>

                                <div className="hidden lg:flex items-center gap-8 text-sm text-slate-600 dark:text-slate-300 text-center">
                                    <div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Role</p>
                                        <p className={`font-medium px-2 py-0.5 rounded-full text-xs ${user.role === 'Admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : user.role === 'Manager' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>{user.role}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Status</p>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isInactive ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'}`}>
                                            {user.status || 'Active'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-1 flex-shrink-0 mt-3 sm:mt-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleOpenModal(user)}
                                        className="p-2 text-slate-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-red-600"
                                        title="Edit User"
                                    >
                                        {ICONS.edit}
                                    </button>

                                    {!isSelf && !isInactive && (
                                        <button
                                            onClick={() => setConfirmAction({ type: 'deactivate', userId: user.id, userName: user.name })}
                                            className="p-2 text-slate-500 rounded-full hover:bg-orange-100 dark:hover:bg-slate-700 hover:text-orange-600"
                                            title="Deactivate Account"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                        </button>
                                    )}

                                    {!isSelf && isInactive && (
                                        <button
                                            onClick={() => setConfirmAction({ type: 'reactivate', userId: user.id, userName: user.name })}
                                            className="p-2 text-slate-500 rounded-full hover:bg-green-100 dark:hover:bg-slate-700 hover:text-green-600"
                                            title="Reactivate Account"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </button>
                                    )}

                                    {!isSelf && (
                                        <button
                                            onClick={() => setConfirmAction({ type: 'delete', userId: user.id, userName: user.name })}
                                            className="p-2 text-slate-500 rounded-full hover:bg-red-100 dark:hover:bg-slate-700 hover:text-red-600"
                                            title="Permanently Delete"
                                        >
                                            {ICONS.delete}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <UserForm isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveUser} user={editingUser} isLoading={isLoading} />
            </div>
        </>
    );
};

export default UserManagement;