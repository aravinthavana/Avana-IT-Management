import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Asset } from '../../types';

type ReturnStatus = 'Under Inspection' | 'In Stock' | 'In Repair' | 'Retired' | 'Disposed';

interface UnassignAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { status: ReturnStatus, remarks: string }) => void;
    asset: Asset | null;
}

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, children, ...props }) => (
    <div>
       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
       <select {...props} className="mt-1 block w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-slate-100">
           {children}
       </select>
   </div>
);

const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }> = ({ label, ...props }) => (
   <div>
       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
       <textarea {...props} rows={3} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-slate-100"></textarea>
   </div>
);

const UnassignAssetModal: React.FC<UnassignAssetModalProps> = ({ isOpen, onClose, onConfirm, asset }) => {
    const [status, setStatus] = useState<ReturnStatus>('Under Inspection');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (isOpen) {
            setStatus('Under Inspection');
            setRemarks(asset?.remarks || '');
        }
    }, [isOpen, asset]);

    const handleConfirm = () => {
        onConfirm({ status, remarks });
    };

    if (!asset) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Return Asset & Update Status">
            <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    You are returning the asset <strong className="text-slate-800 dark:text-slate-100">{asset.name}</strong> ({asset.assetId}). Select its status after return.
                </p>
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg px-4 py-3 text-xs text-orange-800 dark:text-orange-300">
                    💡 <strong>Recommended:</strong> Set to <em>Under Inspection</em> first. IT will inspect the device, then move it to <em>Available for Reallocation</em> or <em>In Repair</em>.
                </div>
                <FormSelect
                    label="Status After Return"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReturnStatus)}
                >
                    <option value="Under Inspection">Under Inspection — IT to inspect before reallocation</option>
                    <option value="In Stock">In Stock — Ready to assign immediately</option>
                    <option value="In Repair">In Repair — Needs servicing</option>
                    <option value="Retired">Retired — End of life</option>
                    <option value="Disposed">Disposed — Written off / physically discarded</option>
                </FormSelect>
                <FormTextarea
                    label="Remarks (Optional)"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Minor scratches on lid, charger missing..."
                />
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-4 gap-3">
                    <button type="button" onClick={onClose} className="w-full sm:w-auto flex justify-center bg-slate-200 text-slate-800 px-5 py-2 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 font-medium transition-all duration-200 active:scale-95">Cancel</button>
                    <button type="button" onClick={handleConfirm} className="w-full sm:w-auto flex justify-center bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 font-medium transition-all duration-200 active:scale-95">Confirm Return</button>
                </div>
            </div>
        </Modal>
    );
};

export default UnassignAssetModal;