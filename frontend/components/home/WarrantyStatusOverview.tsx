import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { getWarrantyStatus } from '../../utils/assetUtils';
import { WarrantyStatus, Asset } from '../../types';

interface WarrantyStatusOverviewProps {
    assets?: Asset[];
    onStatusClick: (status: WarrantyStatus) => void;
}

const WarrantyStatusOverview: React.FC<WarrantyStatusOverviewProps> = ({ assets: propAssets, onStatusClick }) => {
    const { assets: contextAssets } = useAppContext();
    const assets = propAssets || contextAssets;

    const warrantyStats = useMemo(() => {
        const stats: { [key in WarrantyStatus]: number } = {
            'Active': 0,
            'Expiring Soon': 0,
            'Expired': 0,
            'None': 0,
            'N/A': 0,
            'Lifetime': 0,
            'Unknown': 0,
        };
        assets.forEach(asset => {
            const label = getWarrantyStatus(asset).label as WarrantyStatus;
            if (stats[label] !== undefined) {
                stats[label]++;
            }
        });
        return stats;
    }, [assets]);

    const statusItems = [
        { label: 'Active', color: 'border-green-500', textColor: 'text-green-600 dark:text-green-400' },
        { label: 'Expiring Soon', color: 'border-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400' },
        { label: 'Expired', color: 'border-brand-500', textColor: 'text-brand-600 dark:text-red-400' },
    ] as const;

    return (
        <div className="p-6 rounded-2xl shadow-sm border flex flex-col justify-between bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Warranty Overview</h3>
                        <p className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">OEM coverage status &amp; renewal risks</p>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {assets.length} Total
                    </span>
                </div>
                <div className="space-y-3">
                    {statusItems.map(item => (
                        <div
                            key={item.label}
                            onClick={() => onStatusClick(item.label)}
                            className={`p-3.5 border-l-4 ${item.color} rounded-r-xl flex justify-between items-center cursor-pointer transition-all bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700/50`}
                            role="button"
                            aria-label={`View assets with ${item.label} warranty`}
                        >
                            <div>
                                <span className={`text-xs font-bold ${item.textColor}`}>{item.label}</span>
                                <p className="text-[10px] text-slate-400">
                                    {item.label === 'Active' ? 'Under valid OEM warranty' : item.label === 'Expiring Soon' ? 'Expiring in next 30 days' : 'OEM warranty expired'}
                                </p>
                            </div>
                            <span className="text-xl font-black font-mono text-slate-800 dark:text-slate-100">{warrantyStats[item.label]}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-4 pt-3 border-t text-[11px] border-slate-100 dark:border-slate-700/60 text-slate-400">
                Click any warranty bucket to inspect devices
            </div>
        </div>
    );
};

export default WarrantyStatusOverview;