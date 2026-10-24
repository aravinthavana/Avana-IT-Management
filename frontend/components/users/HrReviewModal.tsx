import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import React, { useState, useEffect } from 'react';

interface HrNotification {
    id: number;
    source: string;
    employeeId: string | null;
    employeeEmail: string;
    employeeName: string;
    fieldName: string;
    currentValue: string | null;
    m365Value: string | null;
    zohoValue: string | null;
    aliases: string | null;
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

    const dialogRef = useDialogAccessibility(isOpen, onClose);
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
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(`The backend returned HTTP ${res.status}. If Render is deploying or restarting, please wait a minute and refresh.`);
            }
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

    const handleApply = async (id: number, pushToM365: boolean = false) => {
        setActionInProgress(id);
        try {
            const res = await fetch(`${apiUrl}/api/zoho/changes/${id}/apply`, {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ pushToM365 })
            });
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(`The backend returned HTTP ${res.status}.`);
            }
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
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(`The backend returned HTTP ${res.status}.`);
            }
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

    const handleApplyAll = async (pushToM365: boolean = false) => {
        if (!confirm(`Apply all ${pendingItems.length} changes to portal user profiles${pushToM365 ? ' and push to Microsoft 365' : ''}?`)) return;
        setIsLoading(true);
        const failures: string[] = [];
        for (const item of pendingItems) {
            try {
                const res = await fetch(`${apiUrl}/api/zoho/changes/${item.id}/apply`, {
                    method: 'POST',
                    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ pushToM365 })
                });
                if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to apply change'); }
            } catch (e) {
                failures.push(e instanceof Error ? e.message : 'Failed to apply change');
                console.error(e);
            }
        }
        await fetchNotifications();
        if (failures.length) setErrorMsg(failures.join(' ' ));
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
        <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="HR updates" className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in bg-slate-900/60">
            <div className="rounded-2xl shadow-2xl border w-full max-w-4xl max-h-[calc(100dvh-1rem)] flex flex-col overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="px-6 py-5 border-b flex justify-between items-center border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Zoho HR Changes Review Queue</h2>
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                                    Zoho People Plus
                                </span>
                            </div>
                            <p className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">
                                3-Way comparison: Compare Portal DB, Microsoft 365, and Zoho People Plus. Changes are NOT applied until you approve them.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Sub-bar: Tabs & Bulk Actions */}
                <div className="px-6 py-3 border-b flex flex-wrap justify-between items-center gap-3 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('Pending')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                activeTab === 'Pending'
                                    ? 'shadow-sm bg-orange-500 text-white'
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
                                className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors border text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700"
                            >
                                Dismiss All
                            </button>
                            <button
                                onClick={() => handleApplyAll(false)}
                                disabled={isLoading}
                                className="px-3 py-1.5 text-xs rounded-lg font-semibold transition-all shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                Apply All to Portal ({pendingItems.length})
                            </button>
                        </div>
                    )}
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-3">
                    {errorMsg && (
                        <div className="p-3 border rounded-xl text-xs bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400">
                            {errorMsg}
                        </div>
                    )}

                    {isLoading && (
                        <div className="py-12 flex flex-col items-center justify-center text-sm gap-2 text-slate-400">
                            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin border-orange-500" />
                            <span>Checking for latest updates...</span>
                        </div>
                    )}

                    {!isLoading && itemsToDisplay.length === 0 && (
                        <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                            <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 bg-slate-100 dark:bg-slate-800 text-slate-400">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                                {activeTab === 'Pending' ? 'No pending HR changes' : 'No history records yet'}
                            </p>
                            <p className="text-xs mt-1 text-slate-400">
                                {activeTab === 'Pending'
                                    ? 'No pending differences from Microsoft 365 or Zoho People Plus.'
                                    : 'Applied and dismissed changes will appear here for audit tracking.'}
                            </p>
                        </div>
                    )}

                    {!isLoading && itemsToDisplay.map(item => {
                        let aliasesList: string[] = [];
                        if (item.aliases) {
                            try {
                                const parsed = JSON.parse(item.aliases);
                                if (Array.isArray(parsed)) aliasesList = parsed;
                            } catch (e) {
                                aliasesList = item.aliases.split(',').map(s => s.trim()).filter(Boolean);
                            }
                        }

                        return (
                            <div
                                key={item.id}
                                className={`p-4 rounded-xl border transition-all ${
                                    item.status === 'Pending'
                                        ? 'shadow-sm bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-800'
                                        : 'opacity-80 bg-slate-50/60 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-800'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    {/* Employee Info */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm from-orange-400 to-amber-500 text-white">
                                            {item.employeeName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                                                    {item.employeeName}
                                                </span>
                                                {item.employeeId && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        {item.employeeId}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                {item.employeeEmail}
                                            </div>
                                            {aliasesList.length > 0 && (
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    <span className="text-[10px] font-semibold text-slate-400">Aliases:</span>
                                                    {aliasesList.map(alias => (
                                                        <span key={alias} className="text-[10px] border px-1.5 py-0.2 rounded-full font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                                                            {alias}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
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

                                {/* 3-Way Comparison Diff */}
                                <div className="mt-3 p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800">
                                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-400">
                                        Source: {item.source} · Attribute: <span className="font-semibold text-slate-800 dark:text-slate-100">{item.fieldName}</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                        {/* 1. Portal Current DB */}
                                        <div className="p-2.5 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                            <div className="text-[10px] font-semibold flex items-center gap-1 mb-1 text-slate-400">
                                                <span>🏢 Portal (Current)</span>
                                            </div>
                                            <div className="font-medium truncate text-slate-700 dark:text-slate-200" title={item.currentValue || 'None'}>
                                                {item.currentValue || <span className="italic text-slate-400">None</span>}
                                            </div>
                                        </div>

                                        {/* 2. Microsoft 365 */}
                                        <div className="p-2.5 rounded-lg border bg-sky-50/50 dark:bg-sky-950/30 border-sky-200/60 dark:border-sky-800/60">
                                            <div className="text-[10px] font-semibold flex items-center gap-1.5 mb-1 text-sky-600 dark:text-sky-400">
                                                <svg className="w-3 h-3 text-sky-600" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M11.5 2H2v9.5h9.5V2zm10.5 0H12.5v9.5H22V2zM11.5 12.5H2V22h9.5V12.5zm10.5 0H12.5V22H22V12.5z"/>
                                                </svg>
                                                <span>Microsoft 365{item.source === 'Microsoft 365' ? ' (Incoming)' : ''}</span>
                                            </div>
                                            <div className="font-medium truncate text-sky-900 dark:text-sky-200" title={item.m365Value || 'Not Synced'}>
                                                {item.m365Value || <span className="italic text-slate-400">Not Synced / None</span>}
                                            </div>
                                        </div>

                                        {/* 3. Zoho People Plus */}
                                        <div className="p-2.5 rounded-lg border bg-amber-50/50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-800/60">
                                            <div className="text-[10px] font-semibold flex items-center gap-1.5 mb-1 text-slate-800 dark:text-amber-300">
                                                <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                                                    <rect x="2" y="2" width="9" height="9" rx="2" fill="#E42528" />
                                                    <rect x="13" y="2" width="9" height="9" rx="2" fill="#22A048" />
                                                    <rect x="2" y="13" width="9" height="9" rx="2" fill="#0078BD" />
                                                    <rect x="13" y="13" width="9" height="9" rx="2" fill="#F4AC1C" />
                                                </svg>
                                                <span>Zoho People Plus (AMD & Tech){item.source !== 'Microsoft 365' ? ' (Incoming)' : ''}</span>
                                            </div>
                                            <div className="font-semibold truncate text-amber-950 dark:text-amber-100" title={item.zohoValue || 'None'}>
                                                {item.zohoValue || <span className="italic text-slate-400">None</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions for Pending */}
                                    {item.status === 'Pending' && (
                                        <div className="mt-3 flex items-center justify-end gap-2 flex-wrap pt-2 border-t border-slate-200/50 dark:border-slate-800">
                                            <button
                                                onClick={() => handleDismiss(item.id)}
                                                disabled={actionInProgress === item.id}
                                                className="px-3 py-1.5 text-xs rounded-lg transition-colors font-medium border text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                                            >
                                                Ignore
                                            </button>
                                            <button
                                                onClick={() => handleApply(item.id, false)}
                                                disabled={actionInProgress === item.id}
                                                className="px-3 py-1.5 text-xs rounded-lg font-semibold transition-all shadow-sm flex items-center gap-1 active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                title="Apply the incoming value from the source shown above to the portal"
                                            >
                                                {actionInProgress === item.id ? 'Applying...' : 'Apply to Portal'}
                                            </button>
                                            <button
                                                onClick={() => handleApply(item.id, true)}
                                                disabled={actionInProgress === item.id}
                                                className="px-3 py-1.5 text-xs rounded-lg font-semibold transition-all shadow-sm flex items-center gap-1 active:scale-95 bg-blue-600 hover:bg-blue-700 text-white"
                                                title="Update in portal AND push update to Microsoft 365"
                                            >
                                                {actionInProgress === item.id ? 'Applying...' : 'Apply & Push to M365'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t flex justify-between items-center text-xs border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500">
                    <span>Source: Zoho People Plus (Avana Medical Devices & Technology)</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg font-semibold transition-colors bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
