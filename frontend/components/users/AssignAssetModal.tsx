import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { Asset } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';

interface AssignAssetTarget {
    id: number;
    name: string;
    type: 'user' | 'department' | 'branch';
    company?: string;
}

interface AssignAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (asset: Asset) => void;
    target: AssignAssetTarget;
}

const AssignAssetModal: React.FC<AssignAssetModalProps> = ({ isOpen, onClose, onAssign, target }) => {
    const { assets } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');

    const availableAssets = useMemo(() => {
        return assets
            .filter(asset => 
                asset.status === 'In Stock' && 
                (target.type !== 'user' || asset.company === target.company)
            )
            .filter(asset =>
                asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.assetId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [assets, target, searchTerm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Assign Asset to ${target.name}`} maxWidth="max-w-3xl">
            <div className="flex flex-col">
                <div className="relative mb-4">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">{ICONS.search}</span>
                    <input
                        type="text"
                        placeholder="Search by name, asset ID, or serial number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />
                </div>
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                    {availableAssets.length > 0 ? availableAssets.map(asset => (
                        <li key={asset.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700">
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">{asset.name} <span className="text-xs text-slate-500 dark:text-slate-400">({asset.category})</span></p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{asset.assetId}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">S/N: {asset.serialNumber}</p>
                            </div>
                            <button
                                onClick={() => onAssign(asset)}
                                className="px-3 sm:px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 flex-shrink-0"
                            >
                                Assign
                            </button>
                        </li>
                    )) : (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                            No 'In Stock' assets found
                            {target.type === 'user' && ` for ${target.company}`}.
                        </p>
                    )}
                </ul>
            </div>
        </Modal>
    );
};

export default AssignAssetModal;