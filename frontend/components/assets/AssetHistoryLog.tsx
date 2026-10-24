import { API_URL } from '../../utils/apiClient';
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
            const apiUrl = API_URL;
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
        <div className="bg-surface p-6 rounded-xl shadow-sm border border-line">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-ink">Asset History</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-quiet">
                        {history.length}
                    </span>
                </div>
                <button
                    onClick={fetchHistory}
                    disabled={isLoading}
                    title="Refresh History"
                    className="p-1.5 text-quiet hover:text-ink rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
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
                        className={isLoading ? 'animate-spin text-ink' : ''}
                    >
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 16h5v5" />
                    </svg>
                </button>
            </div>

            {isLoading && history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-quiet space-y-2">
                    <svg className="animate-spin h-6 w-6 text-ink" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm">Loading history...</p>
                </div>
            ) : error ? (
                <div className="py-6 text-center space-y-3">
                    <p className="text-sm text-ink">{error}</p>
                    <button
                        onClick={fetchHistory}
                        className="px-3 py-1.5 text-xs font-medium bg-muted text-ink rounded-lg hover:bg-muted transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            ) : history.length === 0 ? (
                <p className="text-quiet text-center py-8">No history recorded for this asset.</p>
            ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {history.map(entry => (
                        <div key={entry.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <span className="w-3 h-3 bg-accent rounded-full mt-1 shrink-0 ring-4 ring-accent"></span>
                                <span className="flex-grow w-px bg-muted my-1"></span>
                            </div>
                            <div className="pb-4 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold text-ink">{entry.event}</p>
                                    <span className="text-xs text-quiet shrink-0">
                                        {new Date(entry.timestamp).toLocaleString(undefined, {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        })}
                                    </span>
                                </div>
                                {entry.details && (
                                    <p className="text-sm text-quiet mt-1">{entry.details}</p>
                                )}
                                {entry.condition && (
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-surface text-ink border border-line">
                                            Condition: {entry.condition}
                                        </span>
                                    </div>
                                )}
                                <p className="text-xs text-quiet mt-1.5">
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
