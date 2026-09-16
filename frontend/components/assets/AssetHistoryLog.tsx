import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { AssetHistory } from '../../types';

interface AssetHistoryLogProps {
    assetId: number;
    refreshTrigger?: any;
}

const AssetHistoryLog: React.FC<AssetHistoryLogProps> = ({ assetId, refreshTrigger }) => {
    const { getHeaders } = useAppContext();
    const [history, setHistory] = useState<AssetHistory[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:8080';
            const res = await fetch(`${apiUrl}/api/assets/${assetId}/history`, {
                headers: getHeaders(),
                credentials: 'include'
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to load asset history');
            }

            const data = await res.json();
            setHistory(data);
        } catch (err: any) {
            console.error('Error fetching asset history:', err);
            setError(err.message || 'Failed to fetch asset history');
        } finally {
            setIsLoading(false);
        }
    }, [assetId, getHeaders]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory, refreshTrigger]);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Asset History</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {history.length}
                    </span>
                </div>
                <button
                    onClick={fetchHistory}
                    disabled={isLoading}
                    title="Refresh History"
                    className="p-1.5 text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={isLoading ? 'animate-spin text-brand-600' : ''}
                    >
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 16h5v5" />
                    </svg>
                </button>
            </div>

            {isLoading && history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 space-y-2">
                    <svg className="animate-spin h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm">Loading history...</p>
                </div>
            ) : error ? (
                <div className="py-6 text-center space-y-3">
                    <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                    <button
                        onClick={fetchHistory}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            ) : history.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">No history recorded for this asset.</p>
            ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {history.map(entry => (
                        <div key={entry.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <span className="w-3 h-3 bg-brand-500 rounded-full mt-1 shrink-0 ring-4 ring-brand-50 dark:ring-brand-950/50"></span>
                                <span className="flex-grow w-px bg-slate-200 dark:bg-slate-700 my-1"></span>
                            </div>
                            <div className="pb-4 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{entry.event}</p>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                                        {new Date(entry.timestamp).toLocaleString(undefined, {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        })}
                                    </span>
                                </div>
                                {entry.details && (
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{entry.details}</p>
                                )}
                                {entry.condition && (
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                                            Condition: {entry.condition}
                                        </span>
                                    </div>
                                )}
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                                    by {entry.user?.name || 'System'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AssetHistoryLog;
