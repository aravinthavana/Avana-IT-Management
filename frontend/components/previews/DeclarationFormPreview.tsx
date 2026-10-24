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
                <div className="bg-muted min-h-screen flex items-center justify-center text-ink">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-semibold text-base font-body">Loading declaration form...</p>
                    </div>
                </div>
            );
        }
        return (
            <div className="bg-muted min-h-screen flex items-center justify-center text-ink">
                <div className="text-center p-4">
                    <p className="font-semibold text-lg font-heading">Error: Could not find user or asset data for preview.</p>
                    <button onClick={() => setPreviewTarget(null)} className="mt-4 bg-accent text-on-strong px-5 py-2 rounded-lg hover:bg-accent font-medium text-sm">Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-muted min-h-screen flex flex-col print:bg-surface print:min-h-0">
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
                        background-color: #d7d0bc !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #root {
                        width: 100% !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background-color: #d7d0bc !important;
                    }
                    header.no-print,
                    nav.no-print,
                    .no-print,
                    .no-print * {
                        display: none !important;
                    }
                    main {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: #d7d0bc !important;
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
                    .declaration-container img {
                        display: inline-block !important;
                        max-width: 100% !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            <header className="bg-surface/90 backdrop-blur-sm border-b border-line sticky top-0 z-10 px-4 py-3 flex justify-between items-center shadow-sm no-print">
                <button
                    onClick={() => setPreviewTarget(null)}
                    className="bg-muted text-ink px-3 py-1.5 rounded-lg hover:bg-muted flex items-center text-sm font-medium transition-colors"
                >
                    &larr; <span className="ml-1.5">Back</span>
                </button>
                <div className="text-center">
                    <h2 className="text-base font-bold text-ink">Declaration Form Preview</h2>
                    <p className="text-xs text-quiet font-mono hidden sm:block">{laptop.assetId} &bull; {user.name}</p>
                </div>
                <button
                    onClick={handlePrint}
                    className="bg-accent text-on-strong px-4 py-2 rounded-lg hover:bg-accent flex items-center gap-2 text-sm font-semibold transition-all active:scale-95 shadow-md shadow-strong/15 cursor-pointer"
                >
                    {ICONS.print}
                    <span>Print / Save PDF</span>
                </button>
            </header>

            <main className="flex-1 overflow-auto p-4 sm:p-8 bg-strong/60 flex justify-center items-start">
                <div className="declaration-container shadow-2xl rounded-sm overflow-hidden bg-surface max-w-[210mm] w-full box-border">
                    <DeclarationForm user={user} laptop={laptop} assignedDate={formattedAssignedDate} />
                </div>
            </main>
        </div>
    );
}