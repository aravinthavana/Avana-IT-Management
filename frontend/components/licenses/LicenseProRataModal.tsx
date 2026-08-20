import React, { useState } from 'react';
import { License } from '../../types';

interface LicenseProRataModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (l: License) => void;
    license: License;
}

const inputClass = "w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

const LicenseProRataModal: React.FC<LicenseProRataModalProps> = ({ isOpen, onClose, onSave, license }) => {
    const [additionalSeats, setAdditionalSeats] = useState<number>(1);
    const [additionalCost, setAdditionalCost] = useState<number | undefined>(undefined);
    const [note, setNote] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dateStr = new Date().toISOString().split('T')[0];
        
        const existingRemarks = license.remarks ? license.remarks + ' ' : '';
        const newRemark = `[${dateStr}] Pro-rata addition: ${additionalSeats} seats added. Cost: ${additionalCost ? '₹' + additionalCost : 'N/A'}. ${note}`;
        
        const updatedLicense: License = {
            ...license,
            seats: (license.seats || 0) + additionalSeats,
            cost: (license.cost || 0) + (additionalCost || 0),
            remarks: existingRemarks + newRemark
        };

        onSave(updatedLicense);
        onClose();
    };

    return (
        <div className={"fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"}>
            <div className={"bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl"}>
                <h2 className={"text-xl font-bold mb-2 text-slate-800 dark:text-slate-100"}>Add Seats (Pro-Rata)</h2>
                <p className={"text-sm text-slate-500 dark:text-slate-400 mb-5"}>Current Seats: {license.seats} | Current Cost: ₹{license.cost || 0}</p>
                <form onSubmit={handleSubmit} className={"space-y-4"}>
                    
                    <div className={"grid grid-cols-2 gap-4"}>
                        <div>
                            <label className={labelClass}>Additional Seats *</label>
                            <input required type={"number"} min={"1"} value={additionalSeats} onChange={(e) => setAdditionalSeats(parseInt(e.target.value) || 0)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Pro-Rata Cost (₹)</label>
                            <input type={"number"} min={"0"} step={"0.01"} value={additionalCost ?? ''} onChange={(e) => setAdditionalCost(e.target.value ? parseFloat(e.target.value) : undefined)} className={inputClass} placeholder={"e.g. 1500"} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Note / Reference</label>
                        <input type={"text"} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder={"e.g. PO-12345 addition"} />
                    </div>

                    <div className={"flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700 mt-6"}>
                        <button type={"button"} onClick={onClose} className={"px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"}>Cancel</button>
                        <button type={"submit"} className={"bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"}>Add Seats</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LicenseProRataModal;
