import React, { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import { Asset, PurchaseRecord } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';
import AssetForm from '../assets/AssetForm';
import AssetTypeChoiceModal from '../assets/AssetTypeChoiceModal';
import { ICONS } from '../../constants';

interface PurchaseFormProps {
    isOpen: boolean;
    onClose: () => void;
    purchase: PurchaseRecord | null;
}

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <input {...props} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100" />
    </div>
);

const PurchaseForm: React.FC<PurchaseFormProps> = ({ isOpen, onClose, purchase }) => {
    const { setPurchaseRecords, setAssets, setNotification, logAssetHistory } = useAppContext();
    const invoiceFileInputRef = useRef<HTMLInputElement>(null);
    const poFileInputRef = useRef<HTMLInputElement>(null);
    
    const [formData, setFormData] = useState({ invoiceNumber: '', poNumber: '', vendor: '', purchaseDate: '', invoiceAttachmentUrl: '', invoiceAttachmentFilename: '', poAttachmentUrl: '', poAttachmentFilename: '' });
    const [assetsInPurchase, setAssetsInPurchase] = useState<Asset[]>([]);
    
    const [isAssetChoiceModalOpen, setIsAssetChoiceModalOpen] = useState(false);
    const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
    const [newAssetType, setNewAssetType] = useState<'Device' | 'Other'>('Device');

    useEffect(() => {
        if (purchase) {
            setFormData({ invoiceNumber: purchase.invoiceNumber, poNumber: purchase.poNumber || '', vendor: purchase.vendor, purchaseDate: purchase.purchaseDate, invoiceAttachmentUrl: purchase.invoiceAttachmentUrl || '', invoiceAttachmentFilename: purchase.invoiceAttachmentFilename || '', poAttachmentUrl: purchase.poAttachmentUrl || '', poAttachmentFilename: purchase.poAttachmentFilename || '' });
        } else {
            setFormData({ invoiceNumber: '', poNumber: '', vendor: '', purchaseDate: new Date().toISOString().split('T')[0], invoiceAttachmentUrl: '', invoiceAttachmentFilename: '', poAttachmentUrl: '', poAttachmentFilename: '' });
            setAssetsInPurchase([]);
        }
    }, [purchase, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'po') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const urlKey = `${type}AttachmentUrl`;
                const filenameKey = `${type}AttachmentFilename`;
                setFormData(prev => ({
                    ...prev,
                    [urlKey]: loadEvent.target?.result as string,
                    [filenameKey]: file.name
                }));
            };
            reader.readAsDataURL(file);
        }
    };
    
    const removeAttachment = (type: 'invoice' | 'po') => {
        const urlKey = `${type}AttachmentUrl`;
        const filenameKey = `${type}AttachmentFilename`;
        const fileInputRef = type === 'invoice' ? invoiceFileInputRef : poFileInputRef;
    
        setFormData(prev => ({
            ...prev,
            [urlKey]: '',
            [filenameKey]: ''
        }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleOpenAssetChoice = () => setIsAssetChoiceModalOpen(true);

    const handleSelectAssetType = (type: 'Device' | 'Other') => {
        setNewAssetType(type);
        setIsAssetChoiceModalOpen(false);
        setIsAssetFormOpen(true);
    };

    const handleSaveAsset = (assetsData: Asset[]) => {
        const newAssetsWithTempIds = assetsData.map(asset => ({ ...asset, id: Date.now() + Math.random() }));
        setAssetsInPurchase(prev => [...prev, ...newAssetsWithTempIds]);
        setIsAssetFormOpen(false);
    };
    
    const removeAssetFromList = (tempId: number) => {
        setAssetsInPurchase(prev => prev.filter(a => a.id !== tempId));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (assetsInPurchase.length === 0) {
            setNotification({ message: 'Please add at least one asset to this purchase record.', type: 'error' });
            return;
        }

        const newPurchaseId = Date.now();
        const finalAssets: Asset[] = [];
        const finalAssetIds: number[] = [];
        let lastAssetId = Date.now();

        assetsInPurchase.forEach(tempAsset => {
            const finalAsset = { ...tempAsset, id: ++lastAssetId, purchaseId: newPurchaseId };
            finalAssets.push(finalAsset);
            finalAssetIds.push(finalAsset.id);
        });
        
        const newPurchase: PurchaseRecord = {
            id: newPurchaseId,
            ...formData,
            assetIds: finalAssetIds
        };

        setPurchaseRecords(prev => [...prev, newPurchase]);
        setAssets(prev => [...prev, ...finalAssets]);
        
        finalAssets.forEach(asset => {
            logAssetHistory(asset.id, 'Asset Created', `Added via Purchase Record ${newPurchase.invoiceNumber}`);
        });

        setNotification({ message: `Purchase record ${newPurchase.invoiceNumber} and ${finalAssets.length} assets added.`, type: 'success' });
        onClose();
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={purchase ? 'Edit Purchase Record' : 'Add New Purchase Record'} maxWidth="max-w-4xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <fieldset>
                        <legend className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Purchase Details</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormInput label="Invoice Number" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} required />
                            <FormInput label="Purchase Order (PO) Number (Optional)" name="poNumber" value={formData.poNumber} onChange={handleChange} />
                            <FormInput label="Vendor" name="vendor" value={formData.vendor} onChange={handleChange} required />
                            <FormInput label="Purchase Date" name="purchaseDate" type="date" value={formData.purchaseDate} onChange={handleChange} required />
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Invoice Attachment (Optional)</label>
                                {formData.invoiceAttachmentFilename ? (
                                    <div className="mt-1 flex justify-between items-center p-2 pl-3 bg-slate-100 dark:bg-slate-900/50 rounded-md border border-slate-300 dark:border-slate-600">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-slate-500 dark:text-slate-400">{ICONS.paperclip}</span>
                                            <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{formData.invoiceAttachmentFilename}</span>
                                        </div>
                                        <button type="button" onClick={() => removeAttachment('invoice')} className="p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50">
                                            {ICONS.close}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-1">
                                        <label htmlFor="invoice-upload" className="cursor-pointer bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-2">
                                            <span>Upload Invoice</span>
                                        </label>
                                        <input id="invoice-upload" name="invoice-upload" type="file" className="sr-only" onChange={(e) => handleFileChange(e, 'invoice')} ref={invoiceFileInputRef} />
                                    </div>
                                )}
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">PO Attachment (Optional)</label>
                                {formData.poAttachmentFilename ? (
                                    <div className="mt-1 flex justify-between items-center p-2 pl-3 bg-slate-100 dark:bg-slate-900/50 rounded-md border border-slate-300 dark:border-slate-600">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-slate-500 dark:text-slate-400">{ICONS.paperclip}</span>
                                            <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{formData.poAttachmentFilename}</span>
                                        </div>
                                        <button type="button" onClick={() => removeAttachment('po')} className="p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50">
                                            {ICONS.close}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-1">
                                        <label htmlFor="po-upload" className="cursor-pointer bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-2">
                                            <span>Upload PO</span>
                                        </label>
                                        <input id="po-upload" name="po-upload" type="file" className="sr-only" onChange={(e) => handleFileChange(e, 'po')} ref={poFileInputRef} />
                                    </div>
                                )}
                            </div>

                        </div>
                    </fieldset>

                    <fieldset className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <legend className="text-lg font-semibold text-slate-700 dark:text-slate-200">Assets in this Purchase ({assetsInPurchase.length})</legend>
                            <button type="button" onClick={handleOpenAssetChoice} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 text-sm font-medium transition-colors">Add Asset</button>
                        </div>
                         <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                             {assetsInPurchase.map(asset => (
                                <div key={asset.id} className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                                    <div>
                                        <p className="font-medium text-sm text-slate-800 dark:text-slate-100">{asset.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{asset.category} &bull; S/N: {asset.serialNumber}</p>
                                    </div>
                                    <button type="button" onClick={() => removeAssetFromList(asset.id)} className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">{ICONS.delete}</button>
                                </div>
                            ))}
                            {assetsInPurchase.length === 0 && (
                                <p className="text-center text-slate-500 dark:text-slate-400 py-4">No assets added yet.</p>
                            )}
                        </div>
                    </fieldset>
                    
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-6 gap-3">
                        <button type="button" onClick={onClose} className="w-full sm:w-auto justify-center bg-slate-200 text-slate-800 px-5 py-2 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 font-medium transition-all duration-200 active:scale-95 flex items-center">Cancel</button>
                        <button type="submit" className="w-full sm:w-auto justify-center bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 font-medium transition-all duration-200 active:scale-95 flex items-center">Save Purchase</button>
                    </div>
                </form>
            </Modal>
            
            <AssetTypeChoiceModal isOpen={isAssetChoiceModalOpen} onClose={() => setIsAssetChoiceModalOpen(false)} onSelect={handleSelectAssetType} />

            {isAssetFormOpen && (
                <AssetForm
                    isOpen={isAssetFormOpen}
                    onClose={() => setIsAssetFormOpen(false)}
                    onSave={handleSaveAsset}
                    asset={null}
                    assetType={newAssetType}
                    purchaseDate={formData.purchaseDate}
                />
            )}
        </>
    );
};

export default PurchaseForm;