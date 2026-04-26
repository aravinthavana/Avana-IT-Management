import React, { useEffect, useState } from 'react';
import SignatureCanvas from './SignatureCanvas';

interface Handover {
    id: number;
    assetId: number;
    status: string;
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
    const [handovers, setHandovers] = useState<Handover[]>([]);
    const [selectedHandover, setSelectedHandover] = useState<Handover | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

    const fetchPending = async () => {
        try {
            const res = await fetch(`${API_URL}/api/handovers/pending`, { credentials: 'include' });
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signature: signatureBase64 }),
                credentials: 'include'
            });
            if (res.ok) {
                // Remove from list
                setHandovers(prev => prev.filter(h => h.id !== selectedHandover.id));
                setSelectedHandover(null);
                // Refresh global asset state if possible
                window.dispatchEvent(new Event('app:login')); // Triggers data refetch in AppContext
            }
        } catch (error) {
            console.error('Failed to sign handover', error);
        }
    };

    if (isLoading) return null;
    if (handovers.length === 0) return null;

    return (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600 dark:text-amber-400">
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
                    <div key={handover.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-amber-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
                        <div>
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded">
                                {handover.asset.assetId}
                            </span>
                            <h4 className="text-sm font-medium text-slate-900 dark:text-white mt-1">{handover.asset.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{handover.asset.brand} {handover.asset.model}</p>
                        </div>
                        <button
                            onClick={() => setSelectedHandover(handover)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
                        >
                            Sign
                        </button>
                    </div>
                ))}
            </div>

            {selectedHandover && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <SignatureCanvas
                        onSave={handleSign}
                        onCancel={() => setSelectedHandover(null)}
                    />
                </div>
            )}
        </div>
    );
}
