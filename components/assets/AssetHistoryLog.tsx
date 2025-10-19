import React from 'react';
import { useAppContext } from '../../hooks/useAppContext';

interface AssetHistoryLogProps {
    assetId: number;
}

const AssetHistoryLog: React.FC<AssetHistoryLogProps> = ({ assetId }) => {
    const { assetHistory } = useAppContext();

    const relevantHistory = assetHistory
        .filter(entry => entry.assetId === assetId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (relevantHistory.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-4">Asset History</h3>
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">No history recorded for this asset.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">Asset History</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {relevantHistory.map(entry => (
                    <div key={entry.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                            <span className="w-3 h-3 bg-red-500 rounded-full mt-1"></span>
                            <span className="flex-grow w-px bg-slate-300 dark:bg-slate-600"></span>
                        </div>
                        <div className="pb-4 flex-1">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {new Date(entry.timestamp).toLocaleString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short'
                                })}
                            </p>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{entry.event}</p>
                            {entry.details && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{entry.details}</p>}
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">by {entry.user.name}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AssetHistoryLog;
