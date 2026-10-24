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
                    className="flex flex-col items-center justify-center p-6 rounded-lg border transition-all text-center bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border-red-200 dark:border-red-800/50"
                >
                    <span className="w-12 h-12 mb-2">{ICONS.purchases}</span>
                    <span className="text-lg font-semibold">New Purchase</span>
                    <span className="text-xs mt-1 text-gray-500 dark:text-gray-400">Add asset(s) as part of a new purchase record with an invoice.</span>
                </button>
                <button
                    onClick={() => onSelectMethod('existing')}
                    className="flex flex-col items-center justify-center p-6 rounded-lg border transition-all text-center bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-600"
                >
                     <span className="w-12 h-12 mb-2">{ICONS.assets}</span>
                    <span className="text-lg font-semibold">Existing Asset</span>
                    <span className="text-xs mt-1 text-gray-500 dark:text-gray-400">Add a legacy asset that does not have a purchase record in this system.</span>
                </button>
            </div>
        </Modal>
    );
};

export default AssetCreationMethodModal;
