import React from 'react';
import Modal from '../ui/Modal';

interface AssetTypeChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: 'Device' | 'Other') => void;
}

const AssetTypeChoiceModal: React.FC<AssetTypeChoiceModalProps> = ({ isOpen, onClose, onSelect }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Asset Type">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                <button 
                    onClick={() => onSelect('Device')} 
                    className="flex flex-col items-center justify-center p-6 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/50 transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12.5a1.5 1.5 0 0 0-1.5 1.5v3a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5v-3a1.5 1.5 0 0 0-1.5-1.5h-15Z"/><path d="M4 18.5V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13.5"/><path d="M12 18.5V17"/><path d="M7.5 18.5V17"/><path d="M16.5 18.5V17"/></svg>
                    <span className="text-lg font-semibold mt-2">Device</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Laptop, Desktop, Phone, etc.</span>
                </button>
                <button 
                    onClick={() => onSelect('Other')} 
                    className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><path d="M11 7h4a2 2 0 0 1 2 2v4"/><rect width="8" height="8" x="13" y="13" rx="2"/></svg>
                    <span className="text-lg font-semibold mt-2">Other</span>
                     <span className="text-xs text-gray-500 dark:text-gray-400">Monitor, Keyboard, Mouse, etc.</span>
                </button>
            </div>
        </Modal>
    );
};

export default AssetTypeChoiceModal;
