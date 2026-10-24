import React from 'react';
import Modal from '../ui/Modal';
import { ICONS } from '../../constants';

interface AssetCreationMethodModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectMethod: (method: 'purchase' | 'existing') => void;
}

const AssetCreationMethodModal: React.FC<AssetCreationMethodModalProps> = ({ isOpen, onClose, onSelectMethod }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="How are you adding this asset?">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                <button
                    onClick={() => onSelectMethod('purchase')}
                    className="flex flex-col items-center justify-center p-6 bg-surface text-ink rounded-lg hover:bg-surface border border-line transition-all text-center"
                >
                    <span className="w-12 h-12 mb-2">{ICONS.purchases}</span>
                    <span className="text-lg font-semibold">New Purchase</span>
                    <span className="text-xs text-quiet mt-1">Add asset(s) as part of a new purchase record with an invoice.</span>
                </button>
                <button
                    onClick={() => onSelectMethod('existing')}
                    className="flex flex-col items-center justify-center p-6 bg-canvas text-ink rounded-lg hover:bg-muted border border-line transition-all text-center"
                >
                     <span className="w-12 h-12 mb-2">{ICONS.assets}</span>
                    <span className="text-lg font-semibold">Existing Asset</span>
                    <span className="text-xs text-quiet mt-1">Add a legacy asset that does not have a purchase record in this system.</span>
                </button>
            </div>
        </Modal>
    );
};

export default AssetCreationMethodModal;
