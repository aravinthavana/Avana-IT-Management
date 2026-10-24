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
                <p className="text-sm text-quiet">
                    You are moving <strong>{asset.name}</strong> to <em>Available for Reallocation</em>.
                    Please detail the data wipe or inspection process performed on this device.
                </p>
                <div className="bg-surface border border-line rounded-lg px-4 py-3 text-xs text-ink">
                    <strong>Examples:</strong> Fully formatted & reinstalled OS, or Files deleted manually & user profile removed.
                </div>
                <div>
                    <label className="block text-sm font-medium text-ink">Wipe / Action Details <span className="text-ink">*</span></label>
                    <textarea aria-label="Wipe / Action Details"
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        rows={4}
                        required
                        className="mt-1 block w-full px-3 py-2 bg-surface border border-line rounded-md shadow-sm placeholder-quiet focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm text-ink"
                        placeholder="Detail the wipe action..."
                    />
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="w-full sm:w-auto px-5 py-2 rounded-lg bg-muted text-ink hover:bg-muted font-medium transition-all active:scale-95">Cancel</button>
                    <button type="button" onClick={handleConfirm} disabled={!details.trim()} className="w-full sm:w-auto px-5 py-2 rounded-lg bg-accent text-on-strong hover:bg-accent font-medium transition-all active:scale-95 disabled:opacity-50">Confirm Wipe</button>
                </div>
            </div>
        </Modal>
    );
};

export default WipeAssetModal;
