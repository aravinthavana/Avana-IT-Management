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
        { label: 'Active', color: 'border-line', textColor: 'text-ink ' },
        { label: 'Expiring Soon', color: 'border-line', textColor: 'text-ink ' },
        { label: 'Expired', color: 'border-accent', textColor: 'text-ink ' },
    ] as const;

    return (
        <div className="bg-surface p-6 rounded-2xl shadow-sm border border-line flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-ink">Warranty Overview</h3>
                        <p className="text-xs text-quiet mt-0.5">OEM coverage status &amp; renewal risks</p>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-quiet">
                        {assets.length} Total
                    </span>
                </div>
                <div className="space-y-3">
                    {statusItems.map(item => (
                        <div
                            key={item.label}
                            onClick={() => onStatusClick(item.label)}
                            className={`p-3.5 border-l-4 ${item.color} bg-canvas  rounded-r-xl flex justify-between items-center cursor-pointer hover:bg-muted  transition-all`}
                            role="button"
                            aria-label={`View assets with ${item.label} warranty`}
                        >
                            <div>
                                <span className={`text-xs font-bold ${item.textColor}`}>{item.label}</span>
                                <p className="text-[10px] text-quiet">
                                    {item.label === 'Active' ? 'Under valid OEM warranty' : item.label === 'Expiring Soon' ? 'Expiring in next 30 days' : 'OEM warranty expired'}
                                </p>
                            </div>
                            <span className="text-xl font-black text-ink font-mono">{warrantyStats[item.label]}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-4 pt-3 border-t border-line text-[11px] text-quiet">
                Click any warranty bucket to inspect devices
            </div>
        </div>
    );
};

export default WarrantyStatusOverview;