import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import AssetLabel from '../assets/AssetLabel';
import { ICONS } from '../../constants';
import { printLabelDirect, openLabelPDF, downloadLabelPDF } from '../../utils/labelGenerator';

export default function PrintLabelPreview() {
    const { assets, previewTarget, setPreviewTarget } = useAppContext();
    const [zoom, setZoom] = useState<number>(1.5);
    const [isPrinting, setIsPrinting] = useState<boolean>(false);

    if (!previewTarget || previewTarget.type !== 'label') return null;

    const asset = assets.find(a => a.id === previewTarget.assetId);

    const handlePrint = async () => {
        if (!asset || isPrinting) return;
        setIsPrinting(true);
        try {
            await printLabelDirect(asset);
        } catch (err) {
            console.error('Error launching label print:', err);
            window.print();
        } finally {
            setIsPrinting(false);
        }
    };

    const handleOpenPDF = async () => {
        if (!asset || isPrinting) return;
        setIsPrinting(true);
        try {
            await openLabelPDF(asset);
        } catch (err) {
            console.error('Error opening label PDF:', err);
        } finally {
            setIsPrinting(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!asset || isPrinting) return;
        setIsPrinting(true);
        try {
            await downloadLabelPDF(asset);
        } catch (err) {
            console.error('Error downloading label PDF:', err);
        } finally {
            setIsPrinting(false);
        }
    };

    if (!asset) {
        if (assets.length === 0) {
            return (
                <div className="bg-muted min-h-screen flex items-center justify-center text-ink">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-semibold text-base font-body">Loading label preview...</p>
                    </div>
                </div>
            );
        }
        return (
            <div className="bg-muted min-h-screen flex items-center justify-center text-ink">
                <div className="text-center p-4">
                    <p className="font-semibold text-lg font-heading">Error: Could not find asset data for preview.</p>
                    <button onClick={() => setPreviewTarget(null)} className="mt-4 bg-accent text-on-strong px-5 py-2 rounded-lg hover:bg-accent font-medium text-sm">Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-muted min-h-screen flex flex-col print:min-h-0 print:h-[30mm] print:bg-surface print:overflow-hidden print:p-0 print:m-0">
            <style>{`
                @page {
                    size: 50mm 30mm;
                    margin: 0;
                }
                @media screen {
                    .print-only {
                        position: absolute !important;
                        left: -99999px !important;
                        top: -99999px !important;
                        width: 50mm !important;
                        height: 30mm !important;
                        opacity: 0 !important;
                        pointer-events: none !important;
                        visibility: hidden !important;
                    }
                }
                @media print {
                    @page {
                        size: 50mm 30mm;
                        margin: 0;
                    }
                    *, *::before, *::after {
                        box-sizing: border-box !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body {
                        width: 50mm !important;
                        height: 30mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                        background-color: #d7d0bc !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #root {
                        width: 50mm !important;
                        height: 30mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                        background-color: #d7d0bc !important;
                    }
                    .no-print,
                    .no-print * {
                        display: none !important;
                    }
                    .print-only {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 50mm !important;
                        height: 30mm !important;
                        max-width: 50mm !important;
                        max-height: 30mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background-color: #d7d0bc !important;
                        overflow: hidden !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                        page-break-before: avoid !important;
                        break-before: avoid !important;
                        z-index: 9999999 !important;
                    }
                }
            `}</style>

            {/* Dedicated print container rendered directly at (0, 0) for print */}
            <div id="print-label-area" className="print-only" aria-hidden="true">
                <AssetLabel asset={asset} isPrint />
            </div>

            <header className="bg-surface/90 backdrop-blur-sm border-b border-line sticky top-0 z-10 p-4 flex justify-between items-center shadow-xs no-print">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setPreviewTarget(null)}
                        className="bg-muted text-ink px-3 py-1.5 rounded-lg hover:bg-muted flex items-center text-sm font-medium transition-colors"
                    >
                        &larr; <span className="ml-2">Back</span>
                    </button>
                    <div className="hidden sm:block">
                        <h2 className="text-base font-bold text-ink">Asset Label Preview</h2>
                        <p className="text-xs text-quiet">{asset.name} ({asset.assetId})</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {/* Zoom Toggle */}
                    <div className="hidden sm:flex items-center bg-muted rounded-lg p-0.5 text-xs font-semibold text-ink">
                        <button
                            onClick={() => setZoom(1)}
                            className={`px-2.5 py-1 rounded-md transition-colors ${zoom === 1 ? 'bg-surface  shadow-xs text-ink ' : 'hover:text-ink'}`}
                            title="Actual 50mm x 30mm physical size"
                        >
                            1x (Actual)
                        </button>
                        <button
                            onClick={() => setZoom(1.5)}
                            className={`px-2.5 py-1 rounded-md transition-colors ${zoom === 1.5 ? 'bg-surface  shadow-xs text-ink ' : 'hover:text-ink'}`}
                            title="1.5x zoom"
                        >
                            1.5x
                        </button>
                        <button
                            onClick={() => setZoom(2)}
                            className={`px-2.5 py-1 rounded-md transition-colors ${zoom === 2 ? 'bg-surface  shadow-xs text-ink ' : 'hover:text-ink'}`}
                            title="2x zoom"
                        >
                            2x
                        </button>
                    </div>

                    <button
                        onClick={handlePrint}
                        disabled={isPrinting}
                        className="bg-accent text-on-strong px-3.5 py-2 rounded-lg hover:bg-accent flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                        title="Print directly using isolated 50mm x 30mm thermal layout"
                    >
                        {ICONS.print}
                        <span>{isPrinting ? 'Preparing...' : 'Print Label'}</span>
                    </button>

                    <button
                        onClick={handleOpenPDF}
                        disabled={isPrinting}
                        className="bg-olive text-on-strong px-3.5 py-2 rounded-lg hover:bg-olive flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                        title="Open native 50x30mm PDF (100% guarantees zero browser headers/footers)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <span>Open 50×30mm PDF</span>
                    </button>

                    <button
                        onClick={handleDownloadPDF}
                        disabled={isPrinting}
                        className="bg-muted text-ink px-3 py-2 rounded-lg hover:bg-muted flex items-center gap-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                        title="Save 50x30mm PDF file"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span className="hidden lg:inline">Download PDF</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-8 flex flex-col items-center justify-center no-print">
                 <div className="text-center max-w-md mb-6">
                     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line mb-2">
                        <span>●</span> 50mm × 30mm Standard Thermal Label
                     </span>
                     <p className="text-xs text-quiet">
                        Optimized for <strong>Postek C168/300</strong> (300 DPI) and standard thermal label printers.
                     </p>
                 </div>

                 {/* Outer Label Preview Container with Zoom */}
                 <div
                     className="flex items-center justify-center"
                     style={{
                         minHeight: `${113 * zoom + 40}px`,
                         minWidth: `${189 * zoom + 40}px`,
                         transition: 'all 0.2s ease-out'
                     }}
                 >
                     <div
                         style={{
                             transform: `scale(${zoom})`,
                             transformOrigin: 'center center',
                             transition: 'transform 0.2s ease-out'
                         }}
                     >
                         <div
                             className="rounded-sm shadow-xl border border-line bg-surface"
                             style={{
                                 width: '50mm',
                                 height: '30mm',
                                 boxSizing: 'content-box',
                                 overflow: 'hidden'
                             }}
                         >
                             <AssetLabel asset={asset} />
                         </div>
                     </div>
                 </div>

                 {/* Postek C168/300 & Thermal Printer Setup Guide */}
                 <div className="mt-8 max-w-md w-full bg-surface border border-line rounded-xl p-4 text-xs shadow-xs text-ink">
                     <div className="flex items-center gap-2 font-bold text-sm mb-2 text-ink">
                         <span className="text-base">🖨️</span>
                         <span>Postek C168/300 Print Settings</span>
                     </div>
                     <p className="text-quiet mb-2">
                         To ensure Chrome does not add header titles/dates or center the label on A4:
                     </p>
                     <div className="space-y-1.5 bg-surface/80 p-2.5 rounded-lg border border-line/60">
                         <div className="flex items-start gap-2">
                             <span className="font-semibold text-ink min-w-[125px]">1. Destination:</span>
                             <span className="font-medium text-ink">Postek C168/300</span>
                         </div>
                         <div className="flex items-start gap-2">
                             <span className="font-semibold text-ink min-w-[125px]">2. Paper size:</span>
                             <span className="font-medium text-ink">50mm × 30mm <span className="text-quiet font-normal">(or 50x30 stock)</span></span>
                         </div>
                         <div className="flex items-start gap-2">
                             <span className="font-semibold text-ink min-w-[125px]">3. Margins:</span>
                             <span className="font-bold text-ink">None</span>
                         </div>
                         <div className="flex items-start gap-2">
                             <span className="font-semibold text-ink min-w-[125px]">4. Headers & Footers:</span>
                             <span className="font-bold text-ink">UNCHECK [  ]</span>
                         </div>
                     </div>
                     <p className="mt-2 text-[11px] text-ink">
                         💡 <strong>Pro Tip:</strong> Click <strong>"Open 50×30mm PDF"</strong> to print directly from Chrome's PDF viewer — PDFs automatically have zero browser headers and footers!
                     </p>
                 </div>

                 {/* Label Details Summary */}
                 <div className="mt-8 bg-surface border border-line rounded-xl p-4 w-full max-w-sm text-xs shadow-xs">
                     <div className="font-semibold text-ink mb-2 flex justify-between">
                         <span>Label Information</span>
                         <span className="text-quiet font-normal">Physical Size: 50 × 30 mm</span>
                     </div>
                     <div className="space-y-1 text-quiet">
                         <div className="flex justify-between">
                             <span className="text-quiet">Asset Name:</span>
                             <span className="font-medium text-ink truncate max-w-[200px]">{asset.name}</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-quiet">Category:</span>
                             <span className="font-medium text-ink">{asset.category}</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-quiet">Asset ID:</span>
                             <span className="font-bold text-ink font-mono">{asset.assetId}</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-quiet">Serial Number:</span>
                             <span className="font-mono text-ink">{asset.serialNumber || 'N/A'}</span>
                         </div>
                     </div>
                 </div>
            </main>
        </div>
    );
}