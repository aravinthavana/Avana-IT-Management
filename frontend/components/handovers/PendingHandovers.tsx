import { API_URL } from '../../utils/apiClient';
import React, { useEffect, useState } from 'react';
import SignatureCanvas from './SignatureCanvas';
import { useAppContext } from '../../hooks/useAppContext';

interface Handover {
    id: number;
    assetId: number;
    status: string;
    handoverDate: string;
    userId: number;
    user?: { id: number; name: string; email: string };
    asset: {
        id: number;
        assetId: string;
        name: string;
        category: string;
        brand: string;
        model: string;
    };
}

export default function PendingHandovers() {
    const { getHeaders, setNotification } = useAppContext();
    const [handovers, setHandovers] = useState<Handover[]>([]);
    const [selectedHandover, setSelectedHandover] = useState<Handover | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPending = async () => {
        try {
            const res = await fetch(`${API_URL}/api/handovers/pending`, { headers: getHeaders(), credentials: 'include' });
            if (res.ok) {
                setHandovers(await res.json());
            }
        } catch (error) {
            console.error('Failed to fetch pending handovers', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const handleSign = async (signatureBase64: string) => {
        if (!selectedHandover) return;
        try {
            const res = await fetch(`${API_URL}/api/handovers/${selectedHandover.id}/sign`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ signature: signatureBase64 }),
                credentials: 'include'
            });
            if (res.ok) {
                // Remove from list
                setHandovers(prev => prev.filter(h => h.id !== selectedHandover.id));
                setSelectedHandover(null);
                setNotification({ message: 'Handover signed successfully! Asset status updated.', type: 'success' });
                // Refresh global asset state if possible
                window.dispatchEvent(new Event('app:login')); // Triggers data refetch in AppContext
            } else {
                const err = await res.json().catch(() => ({}));
                setNotification({ message: err.error || 'Failed to sign handover', type: 'error' });
            }
        } catch (error) {
            console.error('Failed to sign handover', error);
            setNotification({ message: 'Failed to sign handover', type: 'error' });
        }
    };

    if (isLoading) return null;
    if (handovers.length === 0) return null;

    return (
        <div className="border rounded-xl p-4 mb-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-base font-semibold text-amber-900 dark:text-amber-400">Custody Handover Pending</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-500">You have {handovers.length} asset(s) awaiting your signature.</p>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {handovers.map(handover => (
                    <div key={handover.id} className="p-3 rounded-lg border shadow-sm flex justify-between items-start gap-3 bg-white dark:bg-slate-800 border-amber-200 dark:border-slate-700">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400">
                                    {handover.asset.assetId}
                                </span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700">
                                    {handover.status}
                                </span>
                            </div>
                            <h4 className="text-sm font-medium mt-1 truncate text-slate-900 dark:text-white">{handover.asset.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{handover.asset.brand} {handover.asset.model}</p>
                            {handover.handoverDate && (
                                <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">
                                    Initiated: {new Date(handover.handoverDate).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => setSelectedHandover(handover)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex-shrink-0 text-white bg-amber-600 hover:bg-amber-700"
                        >
                            Sign
                        </button>
                    </div>
                ))}
            </div>

            {selectedHandover && (
                <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 bg-slate-900/50">
                    <SignatureCanvas
                        onSave={handleSign}
                        onCancel={() => setSelectedHandover(null)}
                    />
                </div>
            )}
        </div>
    );
}
