import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';
import ConfirmationModal from '../ui/ConfirmationModal';
import LicenseForm from './LicenseForm';
import LicenseAssignmentModal from './LicenseAssignmentModal';
import { License } from '../../types';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

const LicenseManagement: React.FC = () => {
    const { licenses, setLicenses, setNotification, getHeaders } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal controls
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [licenseToDelete, setLicenseToDelete] = useState<number | null>(null);
    const [selectedLicense, setSelectedLicense] = useState<License | null>(null);

    const filteredLicenses = licenses.filter(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusStyle = (status: string) => {
        if (status === 'Active') return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
        if (status === 'Expiring Soon') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    };

    const handleSave = async (licenseData: License) => {
        try {
            if (selectedLicense) {
                const res = await fetch(`${API_URL}/api/licenses/${licenseData.id}`, {
                    method: 'PUT', headers: getHeaders(), body: JSON.stringify(licenseData),
                });
                if (!res.ok) throw new Error((await res.json()).error);
                const updated = await res.json();
                setLicenses(licenses.map(l => l.id === updated.id ? { ...updated, assignedSeats: l.assignedSeats, assignments: l.assignments } : l));
                setNotification({ message: 'License updated.', type: 'success' });
            } else {
                const res = await fetch(`${API_URL}/api/licenses`, {
                    method: 'POST', headers: getHeaders(), body: JSON.stringify(licenseData),
                });
                if (!res.ok) throw new Error((await res.json()).error);
                const created = await res.json();
                setLicenses([...licenses, { ...created, assignedSeats: 0, assignments: [] }]);
                setNotification({ message: 'License added.', type: 'success' });
            }
            setIsFormOpen(false);
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to save', type: 'error' });
        }
    };

    const handleDelete = async () => {
        if (!licenseToDelete) return;
        try {
            const res = await fetch(`${API_URL}/api/licenses/${licenseToDelete}`, {
                method: 'DELETE', headers: getHeaders(),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setLicenses(licenses.filter(l => l.id !== licenseToDelete));
            setNotification({ message: 'License deleted.', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to delete', type: 'error' });
        }
        setLicenseToDelete(null);
    };

    const handleOpenAssign = (license: License) => {
        setSelectedLicense(license);
        setIsAssignModalOpen(true);
    };

    const openEditForm = (license: License) => {
        setSelectedLicense(license);
        setIsFormOpen(true);
    };

    const openAddForm = () => {
        setSelectedLicense(null);
        setIsFormOpen(true);
    };

    return (
        <div className="bg-transparent pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div className="relative w-full sm:w-auto">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">{ICONS.search}</span>
                    <input 
                        type="text" 
                        placeholder="Search licenses..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-red-500" 
                    />
                </div>
                <button 
                    onClick={openAddForm} 
                    className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 font-medium transition-all duration-200 active:scale-95 w-full sm:w-auto"
                >
                    Add License
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLicenses.map(license => (
                    <div key={license.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100">{license.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{license.category}</p>
                            </div>
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full items-center ${getStatusStyle(license.status)}`}>
                                {license.status}
                            </span>
                        </div>
                        
                        <div className="space-y-2 mb-4 text-sm text-slate-600 dark:text-slate-300">
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Total Seats:</span>
                                <span className="font-medium">{license.seats}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Assigned:</span>
                                <span className="font-medium">{license.assignedSeats || (license.assignments?.length || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Expires:</span>
                                <span className="font-medium">{license.expirationDate ? new Date(license.expirationDate).toLocaleDateString() : 'N/A'}</span>
                            </div>
                        </div>

                        {/* Progress Bar for Seats */}
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-4 dark:bg-slate-700">
                            <div 
                                className={`h-2 rounded-full ${(license.assignedSeats || (license.assignments?.length || 0)) >= license.seats ? 'bg-red-500' : 'bg-green-500'}`} 
                                style={{ width: `${Math.min((((license.assignedSeats || (license.assignments?.length || 0)) / license.seats) * 100), 100)}%` }}
                            ></div>
                        </div>

                        <div className="flex justify-between mt-4 gap-2">
                            <button onClick={() => handleOpenAssign(license)} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium">Assign</button>
                            <button onClick={() => openEditForm(license)} className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" title="Edit">{ICONS.edit}</button>
                            <button onClick={() => setLicenseToDelete(license.id)} className="p-1.5 text-red-500 hover:text-red-700 transition-colors" title="Delete">{ICONS.delete}</button>
                        </div>
                    </div>
                ))}
            </div>

            <ConfirmationModal isOpen={!!licenseToDelete} onClose={() => setLicenseToDelete(null)} onConfirm={handleDelete} title="Delete License">
                Are you sure you want to delete this license?
            </ConfirmationModal>

            {isFormOpen && (
                <LicenseForm 
                    isOpen={isFormOpen} 
                    onClose={() => setIsFormOpen(false)} 
                    onSave={handleSave} 
                    license={selectedLicense} 
                />
            )}

            {isAssignModalOpen && selectedLicense && (
                <LicenseAssignmentModal 
                    isOpen={isAssignModalOpen} 
                    onClose={() => setIsAssignModalOpen(false)} 
                    license={selectedLicense} 
                />
            )}
        </div>
    );
};

export default LicenseManagement;
