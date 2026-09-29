import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import DeclarationForm from '../users/DeclarationForm';
import { ICONS } from '../../constants';

export default function DeclarationFormPreview() {
    const { users, assets, assetHistory, previewTarget, setPreviewTarget } = useAppContext();

    if (!previewTarget || previewTarget.type !== 'declaration') return null;

    const targetUserId = previewTarget.userId || (previewTarget as any).id;
    const targetAssetId = previewTarget.assetId;

    // Resolve the asset: either by targetAssetId or by finding the device assigned to user
    const rawLaptop = (targetAssetId ? assets.find(a => a.id === targetAssetId) : null)
        || (targetUserId ? assets.find(a => ((a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === targetUserId) || a.assignedTo === targetUserId)) : null);

    const latestHistoryCondition = rawLaptop ? assetHistory?.find(h => h.assetId === rawLaptop.id && h.condition)?.condition : undefined;
    const laptop = rawLaptop ? {
        ...rawLaptop,
        condition: rawLaptop.condition || latestHistoryCondition || 'Good'
    } : null;

    // Resolve the user: either by targetUserId or from laptop's assignee
    const user = (targetUserId ? users.find(u => u.id === targetUserId) : null)
        || (laptop?.assigneeId ? users.find(u => u.id === laptop.assigneeId) : null)
        || (laptop?.assignedTo ? users.find(u => u.id === laptop.assignedTo) : null);

    const today = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'), []);

    const formattedAssignedDate = useMemo(() => {
        const assignmentHistory = assetHistory?.find(
            h => h.assetId === laptop?.id && (h.event === 'Assigned' || h.details?.toLowerCase().includes('assigned'))
        );
        const rawAssignedDate = assignmentHistory?.timestamp || (laptop as any)?.assignedAt || (laptop as any)?.createdAt;
        return rawAssignedDate
            ? new Date(rawAssignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
            : today;
    }, [assetHistory, laptop, today]);

    const handlePrint = () => {
        window.print();
    };

    if (!user || !laptop) {
        if (users.length === 0 || assets.length === 0) {
            return (
                <div className="bg-slate-200 dark:bg-slate-900 min-h-screen flex items-center justify-center text-slate-800 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-semibold text-base font-body">Loading declaration form...</p>
                    </div>
                </div>
            );
        }
        return (
            <div className="bg-slate-200 dark:bg-slate-900 min-h-screen flex items-center justify-center text-slate-800 dark:text-slate-100">
                <div className="text-center p-4">
                    <p className="font-semibold text-lg font-heading">Error: Could not find user or asset data for preview.</p>
                    <button onClick={() => setPreviewTarget(null)} className="mt-4 bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 font-medium text-sm">Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-200 dark:bg-slate-900 min-h-screen flex flex-col print:bg-white print:min-h-0">
            <style>{`
                @page {
                    size: A4 portrait;
                    margin: 8mm 10mm;
                }
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm 10mm;
                    }
                    *, *::before, *::after {
                        box-sizing: border-box !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body {
                        width: 100% !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background-color: #ffffff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #root {
                        width: 100% !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background-color: #ffffff !important;
                    }
                    header,
                    nav,
                    .no-print,
                    .no-print * {
                        display: none !important;
                    }
                    main {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: #ffffff !important;
                        display: block !important;
                        width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                    }
                    .declaration-container {
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                }
            `}</style>

            <header className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 px-4 py-3 flex justify-between items-center shadow-sm no-print">
                <button 
                    onClick={() => setPreviewTarget(null)} 
                    className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center text-sm font-medium transition-colors"
                >
                    &larr; <span className="ml-1.5">Back</span>
                </button>
                <div className="text-center">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Declaration Form Preview</h2>
                    <p className="text-xs text-slate-400 font-mono hidden sm:block">{laptop.assetId} &bull; {user.name}</p>
                </div>
                <button 
                    onClick={handlePrint} 
                    className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 text-sm font-semibold transition-all active:scale-95 shadow-md shadow-brand-600/20 cursor-pointer"
                >
                    {ICONS.print}
                    <span>Print / Save PDF</span>
                </button>
            </header>

            <main className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-600/60 dark:bg-slate-950 flex justify-center items-start">
                <div className="declaration-container shadow-2xl rounded-sm overflow-hidden bg-white max-w-[210mm] w-full box-border">
                    <DeclarationForm user={user} laptop={laptop} assignedDate={formattedAssignedDate} />
                </div>
            </main>
        </div>
    );
}