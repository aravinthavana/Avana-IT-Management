import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { User } from '../../types';
import { ICONS } from '../../constants';

interface UserSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectUser: (user: User) => void;
    users: User[];
    company: string;
}

const UserSelectionModal: React.FC<UserSelectionModalProps> = ({ isOpen, onClose, onSelectUser, users, company }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = useMemo(() => {
        return users
            .filter(user => user.company === company)
            .filter(user =>
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [users, company, searchTerm]);

    const handleSelect = (user: User) => {
        onSelectUser(user);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Select User from ${company}`} maxWidth="max-w-2xl">
            <div className="flex flex-col">
                <div className="relative mb-4">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-quiet">{ICONS.search}</span>
                    <input
                        type="text"
                        placeholder="Search by name or employee ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-line rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-ink"
                    />
                </div>
                <ul className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredUsers.length > 0 ? filteredUsers.map(user => (
                        <li key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                            <div className="flex items-center">
                                <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
                                <div className="ml-3">
                                    <p className="font-semibold text-ink">{user.name}</p>
                                    <p className="text-sm text-quiet">{user.employeeId}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleSelect(user)}
                                className="px-4 py-1.5 bg-accent text-on-strong text-sm font-medium rounded-md hover:bg-accent"
                            >
                                Select
                            </button>
                        </li>
                    )) : (
                        <p className="text-center text-quiet py-4">No users found for this company.</p>
                    )}
                </ul>
            </div>
        </Modal>
    );
};

export default UserSelectionModal;
