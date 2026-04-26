import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { getWarrantyStatus } from '../../utils/assetUtils';
import { WarrantyStatus } from '../../types';

interface WarrantyStatusOverviewProps {
    onStatusClick: (status: WarrantyStatus['label']) => void;
}

const WarrantyStatusOverview: React.FC<WarrantyStatusOverviewProps> = ({ onStatusClick }) => {
    const { assets } = useAppContext();

    const warrantyStats = useMemo(() => {
        const stats: { [key in WarrantyStatus['label']]: number } = {
            'Active': 0,
            'Expiring Soon': 0,
            'Expired': 0,
            'None': 0,
            'N/A': 0,
        };
        assets.forEach(asset => {
            const status = getWarrantyStatus(asset);
            if (stats[status.label] !== undefined) {
                stats[status.label]++;
            }
        });
        return stats;
    }, [assets]);
    
    const statusItems = [
        { label: 'Active', color: 'border-green-500', textColor: 'text-green-600 dark:text-green-400' },
        { label: 'Expiring Soon', color: 'border-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400' },
        { label: 'Expired', color: 'border-red-500', textColor: 'text-red-600 dark:text-red-400' },
    ] as const;

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Warranty Overview</h3>
            <div className="space-y-4">
                {statusItems.map(item => (
                    <div 
                        key={item.label}
                        onClick={() => onStatusClick(item.label)} 
                        className={`p-4 border-l-4 ${item.color} bg-slate-50 dark:bg-slate-900/50 rounded-r-lg flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors`}
                        role="button"
                        aria-label={`View assets with ${item.label} warranty`}
                    >
                        <span className={`font-semibold ${item.textColor}`}>{item.label}</span>
                        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{warrantyStats[item.label]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WarrantyStatusOverview;