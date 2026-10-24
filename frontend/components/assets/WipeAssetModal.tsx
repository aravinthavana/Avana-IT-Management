import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Asset } from '../../types';

interface WipeAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (details: string) => void;
    asset: Asset | null;
}

const WipeAssetModal: React.FC<WipeAssetModalProps> = ({ isOpen, onClose, onConfirm, asset }) => {
    const [details, setDetails] = useState('');

    useEffect(() => {
        if (isOpen) setDetails('');
    }, [isOpen]);

    const handleConfirm = () => {
        if (!details.trim()) return;
        onConfirm(details);
    };

    if (!asset) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Device Wipe & Inspection">
            <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    You are moving <strong>{asset.name}</strong> to <em>Available for Reallocation</em>.
                    Please detail the data wipe or inspection process performed on this device.
                </p>
                <div className="border rounded-lg px-4 py-3 text-xs bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300">
                    <strong>Examples:</strong> Fully formatted & reinstalled OS, or Files deleted manually & user profile removed.
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Wipe / Action Details <span className="text-red-500">*</span></label>
                    <textarea aria-label="Wipe / Action Details"
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        rows={4}
                        required
                        className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 placeholder-slate-400 focus:border-brand-500 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
                        placeholder="Detail the wipe action..."
                    />
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="w-full sm:w-auto px-5 py-2 rounded-lg font-medium transition-all active:scale-95 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Cancel</button>
                    <button type="button" onClick={handleConfirm} disabled={!details.trim()} className="w-full sm:w-auto px-5 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 bg-brand-600 text-white hover:bg-brand-700">Confirm Wipe</button>
                </div>
            </div>
        </Modal>
    );
};

export default WipeAssetModal;
