import React, { useState, useEffect } from 'react';

interface HrNotification {
    id: number;
    source: string;
    employeeId: string | null;
    employeeEmail: string;
    employeeName: string;
    fieldName: string;
    currentValue: string | null;
    zohoValue: string | null;
    status: 'Pending' | 'Applied' | 'Dismissed';
    createdAt: string;
    resolvedAt?: string | null;
}

interface HrReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    apiUrl: string;
    getHeaders: () => Record<string, string>;
    onChangesApplied?: () => void;
}

export const HrReviewModal: React.FC<HrReviewModalProps> = ({
    isOpen,
    onClose,
    apiUrl,
    getHeaders,
    onChangesApplied
}) => {
    const [notifications, setNotifications] = useState<HrNotification[]>([]);
    const [activeTab, setActiveTab] = useState<'Pending' | 'History'>('Pending');
    const [isLoading, setIsLoading] = useState(false);
    const [actionInProgress, setActionInProgress] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchNotifications = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const res = await fetch(`${apiUrl}/api/zoho/changes`, {
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to fetch HR changes');
            }
            const data = await res.json();
            setNotifications(data.notifications || []);
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const pendingItems = notifications.filter(n => n.status === 'Pending');
    const historyItems = notifications.filter(n => n.status !== 'Pending');

    const handleApply = async (id: number) => {
        setActionInProgress(id);
        try {
            const res = await fetch(`${apiUrl}/api/zoho/changes/${id}/apply`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to apply change');
            }
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'Applied', resolvedAt: new Date().toISOString() } : n));
            if (onChangesApplied) onChangesApplied();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionInProgress(null);
        }
    };

    const handleDismiss = async (id: number) => {
        setActionInProgress(id);
        try {
            const res = await fetch(`${apiUrl}/api/zoho/changes/${id}/dismiss`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to dismiss change');
            }
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'Dismissed', resolvedAt: new Date().toISOString() } : n));
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionInProgress(null);
        }
    };

    const handleApplyAll = async () => {
        if (!confirm(`Apply all ${pendingItems.length} changes to portal user profiles?`)) return;
        setIsLoading(true);
        for (const item of pendingItems) {
            try {
                await fetch(`${apiUrl}/api/zoho/changes/${item.id}/apply`, {
                    method: 'POST',
                    headers: getHeaders(),
                    credentials: 'include'
                });
            } catch (e) {
                console.error(e);
            }
        }
        await fetchNotifications();
        if (onChangesApplied) onChangesApplied();
    };

    const handleDismissAll = async () => {
        if (!confirm(`Dismiss all ${pendingItems.length} pending HR notifications without changing user profiles?`)) return;
        setIsLoading(true);
        for (const item of pendingItems) {
            try {
                await fetch(`${apiUrl}/api/zoho/changes/${item.id}/dismiss`, {
                    method: 'POST',
                    headers: getHeaders(),
                    credentials: 'include'
                });
            } catch (e) {
                console.error(e);
            }
        }
        await fetchNotifications();
    };

    const itemsToDisplay = activeTab === 'Pending' ? pendingItems : historyItems;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Zoho HR Changes Review Queue</h2>
                                <span className="text-[11px] font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">
                                    Zoho People Plus
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Changes made by HR in Zoho People are held here for your approval. No profile data is overwritten automatically.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Sub-bar: Tabs & Bulk Actions */}
                <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3 bg-white dark:bg-slate-900">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('Pending')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                activeTab === 'Pending'
                                    ? 'bg-orange-500 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span>Pending Approval</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                activeTab === 'Pending' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                            }`}>
                                {pendingItems.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('History')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                activeTab === 'History'
                                    ? 'bg-slate-800 text-white dark:bg-slate-700'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span>History / Resolved</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                {historyItems.length}
                            </span>
                        </button>
                    </div>

                    {activeTab === 'Pending' && pendingItems.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDismissAll}
                                disabled={isLoading}
                                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors border border-slate-200 dark:border-slate-700"
                            >
                                Dismiss All
                            </button>
                            <button
                                onClick={handleApplyAll}
                                disabled={isLoading}
                                className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all shadow-sm"
                            >
                                Approve & Apply All ({pendingItems.length})
                            </button>
                        </div>
                    )}
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-3">
                    {errorMsg && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400">
                            {errorMsg}
                        </div>
                    )}

                    {isLoading && (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            <span>Checking for latest updates...</span>
                        </div>
                    )}

                    {!isLoading && itemsToDisplay.length === 0 && (
                        <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                                {activeTab === 'Pending' ? 'No pending HR changes' : 'No history records yet'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                {activeTab === 'Pending'
                                    ? 'All user profiles in the portal match the records in Zoho People Plus.'
                                    : 'Applied and dismissed changes will appear here for audit tracking.'}
                            </p>
                        </div>
                    )}

                    {!isLoading && itemsToDisplay.map(item => (
                        <div
                            key={item.id}
                            className={`p-4 rounded-xl border transition-all ${
                                item.status === 'Pending'
                                    ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-sm hover:border-orange-300 dark:hover:border-orange-800'
                                    : 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-800 opacity-80'
                            }`}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                {/* Employee Info */}
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                                        {item.employeeName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                                                {item.employeeName}
                                            </span>
                                            {item.employeeId && (
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
                                                    {item.employeeId}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {item.employeeEmail}
                                        </div>
                                    </div>
                                </div>

                                {/* Status badge if resolved */}
                                {item.status !== 'Pending' && (
                                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full self-start sm:self-center ${
                                        item.status === 'Applied'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                        {item.status}
                                    </span>
                                )}
                            </div>

                            {/* Diff Representation */}
                            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex-1">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        Field Changed: <span className="text-slate-700 dark:text-slate-200 font-semibold">{item.fieldName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs flex-wrap">
                                        <span className="line-through text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                                            Portal: {item.currentValue || 'None'}
                                        </span>
                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                                            Zoho: {item.zohoValue || 'None'}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions for Pending */}
                                {item.status === 'Pending' && (
                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        <button
                                            onClick={() => handleDismiss(item.id)}
                                            disabled={actionInProgress === item.id}
                                            className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium border border-slate-200 dark:border-slate-700"
                                        >
                                            Ignore
                                        </button>
                                        <button
                                            onClick={() => handleApply(item.id)}
                                            disabled={actionInProgress === item.id}
                                            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all shadow-sm flex items-center gap-1 active:scale-95"
                                        >
                                            {actionInProgress === item.id ? 'Applying...' : 'Apply Update'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-between items-center text-xs text-slate-500">
                    <span>Source: Zoho People Plus (Avana Medical Devices & Technology)</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-semibold transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
