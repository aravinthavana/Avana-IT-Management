import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';
import PurchaseForm from './PurchaseForm';
import { PurchaseRecord } from '../../types';

interface PurchaseManagementProps {
    pageState?: { [key: string]: any } | null;
    onPageStateConsumed?: () => void;
}

const PurchaseManagement: React.FC<PurchaseManagementProps> = ({ pageState, onPageStateConsumed }) => {
    const { purchaseRecords, setSelectedPurchaseId } = useAppContext();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (pageState?.openForm && onPageStateConsumed) {
            handleOpenForm();
            onPageStateConsumed();
        }
    }, [pageState, onPageStateConsumed]);

    const handleOpenForm = (purchase: PurchaseRecord | null = null) => {
        setEditingPurchase(purchase);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setEditingPurchase(null);
        setIsFormOpen(false);
    };

    const filteredPurchases = useMemo(() => {
        return purchaseRecords.filter(p =>
            p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.vendor.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [purchaseRecords, searchTerm]);

    return (
        <>
            <PurchaseForm isOpen={isFormOpen} onClose={handleCloseForm} purchase={editingPurchase} />
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
                <div className="p-6 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="relative w-full sm:w-auto">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">{ICONS.search}</span>
                        <input
                            type="text"
                            placeholder="Search by invoice or vendor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <button onClick={() => handleOpenForm()} className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 w-full sm:w-auto font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-2">
                        <div className="w-4 h-4">{ICONS.add}</div>
                        Add New Purchase
                    </button>
                </div>
                <div className="p-6 space-y-3">
                    {filteredPurchases.map(purchase => (
                        <div key={purchase.id} onClick={() => setSelectedPurchaseId(purchase.id)} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg flex items-center justify-between border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                            <div>
                                <p className="font-semibold text-red-600 dark:text-red-400">{purchase.invoiceNumber}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{purchase.vendor}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {new Date(purchase.purchaseDate).toLocaleDateString()} &bull; {purchase.assetIds.length} Asset(s)
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                {/* Edit is disabled for now as it requires complex asset handling logic */}
                                {/* <button onClick={(e) => { e.stopPropagation(); handleOpenForm(purchase); }} className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-500" title="Edit">{ICONS.edit}</button> */}
                                <div className="p-2 text-slate-500 dark:text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default PurchaseManagement;