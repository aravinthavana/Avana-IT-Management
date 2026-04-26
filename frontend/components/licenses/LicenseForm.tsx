import React, { useState, useEffect } from 'react';
import { License } from '../../types';

interface LicenseFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (l: License) => void;
    license: License | null;
}

const LicenseForm: React.FC<LicenseFormProps> = ({ isOpen, onClose, onSave, license }) => {
    const [formData, setFormData] = useState<Partial<License>>({
        name: '', category: 'Software', key: '', seats: 1, 
        status: 'Active', remarks: ''
    });

    useEffect(() => {
        if (license) {
            setFormData(license);
        } else {
            setFormData({ name: '', category: 'Software', key: '', seats: 1, status: 'Active', remarks: '' });
        }
    }, [license, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as License);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">{license ? 'Edit License' : 'Add License'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">License Name *</label>
                        <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                        <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500">
                            <option value="Software">Software</option>
                            <option value="Cloud Service">Cloud Service</option>
                            <option value="Subscription">Subscription</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Seats/Quantity *</label>
                            <input required type="number" min="1" value={formData.seats} onChange={(e) => setFormData({...formData, seats: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                            <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500">
                                <option value="Active">Active</option>
                                <option value="Expired">Expired</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">License Key / Portal Link</label>
                        <input type="text" value={formData.key || ''} onChange={(e) => setFormData({...formData, key: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expiration Date</label>
                        <input type="date" value={formData.expirationDate ? formData.expirationDate.split('T')[0] : ''} onChange={(e) => setFormData({...formData, expirationDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors">Cancel</button>
                        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-medium">Save License</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LicenseForm;
