import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { Asset, normalizeCompanyCode } from '../../types';
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
    onAssign: (asset: Asset, condition: string) => void;
    target: AssignAssetTarget;
}

const AssignAssetModal: React.FC<AssignAssetModalProps> = ({ isOpen, onClose, onAssign, target }) => {
    const { assets } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [condition, setCondition] = useState('Good');

    const [checklist, setChecklist] = useState({ policy: false, software: false, cleaned: false });
    const allChecked = checklist.policy && checklist.software && checklist.cleaned;

    React.useEffect(() => {
        if (isOpen) setChecklist({ policy: false, software: false, cleaned: false });
    }, [isOpen]);

    const availableAssets = useMemo(() => {
        const targetCompanyCode = normalizeCompanyCode(target.company);
        return assets
            .filter(asset => {
                const isAvailable = asset.status === 'In Stock' || asset.status === 'Available for Reallocation';
                if (!isAvailable) return false;
                if (target.type !== 'user' || !targetCompanyCode) return true;
                const assetCompanyCode = normalizeCompanyCode(asset.company || asset.assetId?.split('-')[0]);
                return assetCompanyCode === targetCompanyCode;
            })
            .filter(asset =>
                (asset.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (asset.assetId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (asset.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [assets, target, searchTerm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Assign Asset to ${target.name}`} maxWidth="max-w-3xl">
            <div className="flex flex-col">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-4 rounded-lg mb-4">
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-2">Pre-Handover IT Checklist (Required)</h4>
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-amber-900 dark:text-amber-200">
                            <input type="checkbox" checked={checklist.policy} onChange={e => setChecklist(p => ({ ...p, policy: e.target.checked }))} className="rounded text-brand-600 focus:ring-brand-500 bg-amber-100/50 border-amber-300 dark:border-amber-600" />
                            Device configured per policy (OS, encryption, wallpaper)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-amber-900 dark:text-amber-200">
                            <input type="checkbox" checked={checklist.software} onChange={e => setChecklist(p => ({ ...p, software: e.target.checked }))} className="rounded text-brand-600 focus:ring-brand-500 bg-amber-100/50 border-amber-300 dark:border-amber-600" />
                            Required software & antivirus installed and updated
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-amber-900 dark:text-amber-200">
                            <input type="checkbox" checked={checklist.cleaned} onChange={e => setChecklist(p => ({ ...p, cleaned: e.target.checked }))} className="rounded text-brand-600 focus:ring-brand-500 bg-amber-100/50 border-amber-300 dark:border-amber-600" />
                            Asset is physically cleaned, asset tagged, and ready for handover
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="relative sm:col-span-2">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">{ICONS.search}</span>
                        <input
                            type="text"
                            placeholder="Search by name, asset ID, or serial number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        />
                    </div>
                    <div>
                        <select
                            value={condition}
                            onChange={(e) => setCondition(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        >
                            <option value="Good">Condition: Good</option>
                            <option value="Minor Damage">Condition: Minor Damage</option>
                            <option value="Major Damage">Condition: Major Damage</option>
                        </select>
                    </div>
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
                                onClick={() => onAssign(asset, condition)}
                                disabled={!allChecked}
                                className="px-3 sm:px-4 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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