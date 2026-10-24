import React, { useState } from 'react';
import { License } from '../../types';

interface LicenseProRataModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (l: License) => void;
    license: License;
}

const inputClass = "w-full px-3 py-2 border rounded-lg    focus:outline-none focus:ring-2 focus:ring-accent text-ink";
const labelClass = "block text-sm font-medium text-ink  mb-1";

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
        <div className={"fixed inset-0 bg-strong/60 z-50 flex justify-center items-center p-4"}>
            <div className={"bg-surface  rounded-xl max-w-md w-full p-6 shadow-2xl"}>
                <h2 className={"text-xl font-bold mb-2 text-ink "}>Add Seats (Pro-Rata)</h2>
                <p className={"text-sm text-quiet  mb-5"}>Current Seats: {license.seats} | Current Cost: ₹{license.cost || 0}</p>
                <form onSubmit={handleSubmit} className={"space-y-4"}>

                    <div className={"grid grid-cols-2 gap-4"}>
                        <div>
                            <label className={labelClass}>Additional Seats *</label>
                            <input aria-label="Additional Seats *" required type={"number"} min={"1"} value={additionalSeats} onChange={(e) => setAdditionalSeats(parseInt(e.target.value) || 0)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Pro-Rata Cost (₹)</label>
                            <input aria-label="Pro-Rata Cost (₹)" type={"number"} min={"0"} step={"0.01"} value={additionalCost ?? ''} onChange={(e) => setAdditionalCost(e.target.value ? parseFloat(e.target.value) : undefined)} className={inputClass} placeholder={"e.g. 1500"} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Note / Reference</label>
                        <input aria-label="Note / Reference" type={"text"} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder={"e.g. PO-12345 addition"} />
                    </div>

                    <div className={"flex justify-end space-x-3 pt-4 border-t border-line  mt-6"}>
                        <button type={"button"} onClick={onClose} className={"px-4 py-2 text-quiet  hover:bg-muted  rounded-lg transition-colors font-medium"}>Cancel</button>
                        <button type={"submit"} className={"bg-accent hover:bg-accent text-on-strong px-4 py-2 rounded-lg transition-colors font-medium"}>Add Seats</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LicenseProRataModal;
