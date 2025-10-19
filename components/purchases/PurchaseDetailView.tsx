import React from 'react';
import { PurchaseRecord, Asset } from '../../types';
import { ICONS } from '../../constants';
import { useAppContext } from '../../hooks/useAppContext';
import { ASSET_ICONS } from '../../constants';

interface PurchaseDetailViewProps {
    purchase: PurchaseRecord;
    onBack?: () => void;
}

const DetailItem: React.FC<{ label: string, value: React.ReactNode, className?: string }> = ({ label, value, className }) => (
    <div className={className}>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-slate-800 dark:text-slate-100 mt-1">{value}</p>
    </div>
);

const PurchaseDetailView: React.FC<PurchaseDetailViewProps> = ({ purchase, onBack }) => {
    const { assets, setSelectedAssetId } = useAppContext();
    const purchaseAssets = assets.filter(a => purchase.assetIds.includes(a.id));
    
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
            <div className="sticky top-16 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 -mx-4 sm:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0">
                        {onBack && (
                            <button onClick={onBack} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center text-sm transition-colors flex-shrink-0">
                                &larr; <span className="hidden sm:inline ml-2 font-medium">Back</span>
                            </button>
                        )}
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate" title={purchase.invoiceNumber}>Invoice: {purchase.invoiceNumber}</h2>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6 pt-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         <DetailItem label="Invoice Number" value={<span className="font-semibold">{purchase.invoiceNumber}</span>} />
                         <DetailItem label="Vendor" value={purchase.vendor} />
                         <DetailItem label="Purchase Date" value={new Date(purchase.purchaseDate).toLocaleDateString()} />
                         <DetailItem label="PO Number" value={purchase.poNumber || 'N/A'} />
                         <DetailItem label="Assets Procured" value={purchase.assetIds.length} />
                         <DetailItem 
                            label="Invoice Attachment" 
                            value={
                                purchase.invoiceAttachmentUrl ? (
                                    <a 
                                        href={purchase.invoiceAttachmentUrl} 
                                        download={purchase.invoiceAttachmentFilename} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:underline font-semibold"
                                    >
                                        {ICONS.paperclip}
                                        <span>{purchase.invoiceAttachmentFilename}</span>
                                    </a>
                                ) : 'N/A'
                            } 
                        />
                         <DetailItem 
                            label="PO Attachment" 
                            value={
                                purchase.poAttachmentUrl ? (
                                    <a 
                                        href={purchase.poAttachmentUrl} 
                                        download={purchase.poAttachmentFilename} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:underline font-semibold"
                                    >
                                        {ICONS.paperclip}
                                        <span>{purchase.poAttachmentFilename}</span>
                                    </a>
                                ) : 'N/A'
                            } 
                        />
                    </div>
                </div>
                
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Assets in this Purchase</h3>
                    </div>
                    <div className="p-6 space-y-3">
                        {purchaseAssets.map(asset => (
                            <div key={asset.id} onClick={() => setSelectedAssetId(asset.id)} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg flex items-center justify-between border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                 <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-400 flex-shrink-0">
                                        {ASSET_ICONS[asset.category] || ASSET_ICONS.default}
                                    </div>
                                    <div className="truncate">
                                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{asset.name}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{asset.assetId}</p>
                                    </div>
                                </div>
                                <div className="hidden md:block">
                                    {getStatusChip(asset.status)}
                                </div>
                                <div className="p-2 text-slate-500 dark:text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default PurchaseDetailView;