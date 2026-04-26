import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../hooks/useAppContext';

interface RequestFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

const RequestForm: React.FC<RequestFormProps> = ({ isOpen, onClose, onSubmit }) => {
    const { user } = useAuth();
    const { users } = useAppContext();
    const [requestType, setRequestType] = useState('New Asset');
    const [category, setCategory] = useState('Laptop');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            requestType,
            category,
            description,
        });
        // Reset form
        setRequestType('New Asset');
        setCategory('Laptop');
        setDescription('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Request IT Asset">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="requestType" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Request Type</label>
                    <select 
                        id="requestType"
                        name="requestType"
                        value={requestType} 
                        onChange={e => setRequestType(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    >
                        <option value="New Asset">New Asset</option>
                        <option value="Replacement">Replacement</option>
                        <option value="Upgrade">Upgrade</option>
                        <option value="Repair">Repair</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                    <select 
                        id="category"
                        name="category"
                        value={category} 
                        onChange={e => setCategory(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    >
                        <option value="Laptop">Laptop</option>
                        <option value="Desktop">Desktop</option>
                        <option value="Monitor">Monitor</option>
                        <option value="Keyboard">Keyboard</option>
                        <option value="Mouse">Mouse</option>
                        <option value="Headset">Headset</option>
                        <option value="Software License">Software License</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        {user?.managerId ? (
                            <>Your request will be sent to your manager: <span className="font-bold">{user?.manager?.name || 'Assigned Manager'}</span></>
                        ) : (
                            <>No manager assigned to your profile. This request will be sent directly to <span className="font-bold">IT Administration</span>.</>
                        )}
                    </p>
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Justification / Description</label>
                    <textarea 
                        id="description"
                        name="description"
                        value={description} 
                        onChange={e => setDescription(e.target.value)}
                        required
                        rows={4}
                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        placeholder="Please explain why you need this asset..."
                    />
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 font-medium">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Submit Request</button>
                </div>
            </form>
        </Modal>
    );
};

export default RequestForm;
