import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Asset } from '../../types';

interface BulkChangeStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (newStatus: 'In Stock' | 'In Repair' | 'Retired', remarks: string) => void;
    assetIds: number[];
}

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, children, ...props }) => (
    <div>
       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
       <select {...props} className="mt-1 block w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100">
           {children}
       </select>
   </div>
);

const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }> = ({ label, ...props }) => (
   <div>
       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
       <textarea {...props} rows={3} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100"></textarea>
   </div>
);

const BulkChangeStatusModal: React.FC<BulkChangeStatusModalProps> = ({ isOpen, onClose, onConfirm, assetIds }) => {
    const [status, setStatus] = useState<'In Stock' | 'In Repair' | 'Retired'>('In Stock');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (isOpen) {
            setStatus('In Stock');
            setRemarks('');
        }
    }, [isOpen]);

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(status, remarks);
    };

    if (!assetIds || assetIds.length === 0) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bulk Change Asset Status">
            <form onSubmit={handleConfirm} className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    You are updating the status for <strong className="text-slate-800 dark:text-slate-100">{assetIds.length}</strong> selected assets.
                    Any assigned assets will be unassigned.
                </p>
                <FormSelect 
                    label="New Asset Status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'In Stock' | 'In Repair' | 'Retired')}
                >
                    <option value="In Stock">In Stock</option>
                    <option value="In Repair">In Repair</option>
                    <option value="Retired">Retired</option>
                </FormSelect>
                <FormTextarea 
                    label="Remarks (Optional)"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Add a reason for this bulk update..."
                />
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-4 gap-3">
                    <button type="button" onClick={onClose} className="w-full sm:w-auto flex justify-center bg-slate-200 text-slate-800 px-5 py-2 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 font-medium transition-all duration-200 active:scale-95">Cancel</button>
                    <button type="submit" className="w-full sm:w-auto flex justify-center bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 font-medium transition-all duration-200 active:scale-95">Update Status</button>
                </div>
            </form>
        </Modal>
    );
};

export default BulkChangeStatusModal;
