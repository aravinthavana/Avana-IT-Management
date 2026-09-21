import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from '../../hooks/useAppContext';
import AssetLabel from '../assets/AssetLabel';
import { ICONS } from '../../constants';

export default function PrintLabelPreview() {
    const { assets, previewTarget, setPreviewTarget } = useAppContext();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
    const [zoom, setZoom] = useState<number>(1.5);

    if (!previewTarget || previewTarget.type !== 'label') return null;

    const asset = assets.find(a => a.id === previewTarget.assetId);

    const iframeSrcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=10.0, user-scalable=yes">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
          body { 
            background-color: transparent; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
          }
          #mount-point, #label-container { 
            width: 100%; 
            height: 100%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            margin: 0; 
            padding: 0; 
            overflow: hidden; 
          }
          
          /* Tailwind-compatible utilities used by AssetLabel */
          .flex { display: flex; } 
          .flex-col { flex-direction: column; } 
          .items-center { align-items: center; }
          .justify-center { justify-content: center; } 
          .justify-between { justify-content: space-between; }
          .w-full { width: 100%; } 
          .h-full { height: 100%; }
          .font-bold { font-weight: 700; } 
          .font-semibold { font-weight: 600; }
          .font-medium { font-weight: 500; }
          .uppercase { text-transform: uppercase; } 
          .tracking-wider { letter-spacing: 0.05em; }
          .tracking-tight { letter-spacing: -0.02em; }
          .bg-white { background-color: #ffffff; } 
          .overflow-hidden { overflow: hidden; } 
          .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .shrink-0 { flex-shrink: 0; } 
          .relative { position: relative; } 
          .absolute { position: absolute; }
          
          @media print {
            @page { size: 50mm 30mm; margin: 0; }
            html, body { 
              width: 50mm; 
              height: 30mm; 
              margin: 0; 
              padding: 0; 
              overflow: hidden; 
              background-color: #ffffff; 
            }
            #mount-point, #label-container { 
              width: 50mm; 
              height: 30mm; 
              position: absolute; 
              top: 0; 
              left: 0; 
              margin: 0; 
              padding: 0; 
              overflow: hidden; 
            }
          }
        </style>
      </head>
      <body>
        <div id="mount-point"></div>
      </body>
    </html>
    `;

    const handlePrint = () => {
        const iframe = iframeRef.current;
        if (iframe?.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }
    };

    if (!asset) {
        if (assets.length === 0) {
            return (
                <div className="bg-slate-200 dark:bg-slate-900 min-h-screen flex items-center justify-center text-slate-800 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-semibold text-base font-body">Loading label preview...</p>
                    </div>
                </div>
            );
        }
        return (
            <div className="bg-slate-200 dark:bg-slate-900 min-h-screen flex items-center justify-center text-slate-800 dark:text-slate-100">
                <div className="text-center p-4">
                    <p className="font-semibold text-lg font-heading">Error: Could not find asset data for preview.</p>
                    <button onClick={() => setPreviewTarget(null)} className="mt-4 bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 font-medium text-sm">Go Back</button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen flex flex-col">
            <header className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 p-4 flex justify-between items-center shadow-xs">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setPreviewTarget(null)} 
                        className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center text-sm font-medium transition-colors"
                    >
                        &larr; <span className="ml-2">Back</span>
                    </button>
                    <div className="hidden sm:block">
                        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Asset Label Preview</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{asset.name} ({asset.assetId})</p>
                    </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                    {/* Zoom Toggle */}
                    <div className="flex items-center bg-slate-200 dark:bg-slate-700 rounded-lg p-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <button 
                            onClick={() => setZoom(1)} 
                            className={`px-2.5 py-1 rounded-md transition-colors ${zoom === 1 ? 'bg-white dark:bg-slate-800 shadow-xs text-brand-600 dark:text-brand-400' : 'hover:text-slate-900'}`}
                            title="Actual 50mm x 30mm physical size"
                        >
                            1x (Actual)
                        </button>
                        <button 
                            onClick={() => setZoom(1.5)} 
                            className={`px-2.5 py-1 rounded-md transition-colors ${zoom === 1.5 ? 'bg-white dark:bg-slate-800 shadow-xs text-brand-600 dark:text-brand-400' : 'hover:text-slate-900'}`}
                            title="1.5x zoom"
                        >
                            1.5x
                        </button>
                        <button 
                            onClick={() => setZoom(2)} 
                            className={`px-2.5 py-1 rounded-md transition-colors ${zoom === 2 ? 'bg-white dark:bg-slate-800 shadow-xs text-brand-600 dark:text-brand-400' : 'hover:text-slate-900'}`}
                            title="2x zoom"
                        >
                            2x
                        </button>
                    </div>

                    <button 
                        onClick={handlePrint} 
                        className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 text-sm font-semibold transition-colors shadow-sm"
                    >
                        {ICONS.print}
                        <span>Print Label</span>
                    </button>
                </div>
            </header>
            
            <main className="flex-1 p-4 sm:p-8 flex flex-col items-center justify-center">
                 <div className="text-center max-w-md mb-6">
                     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-2">
                        <span>●</span> 50mm × 30mm Standard Thermal Label
                     </span>
                     <p className="text-xs text-slate-500 dark:text-slate-400">
                        In print dialog, select <strong>50mm × 30mm</strong> paper size and set <strong>Margins: None</strong>.
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
                             className="rounded-sm shadow-xl border border-slate-300 dark:border-slate-600 bg-white"
                             style={{ 
                                 width: '189px', 
                                 height: '113px', 
                                 boxSizing: 'content-box',
                                 overflow: 'hidden'
                             }}
                         >
                            <iframe
                                ref={iframeRef}
                                srcDoc={iframeSrcDoc}
                                title="Asset Label Preview"
                                style={{ width: '189px', height: '113px', border: 'none', display: 'block' }}
                                onLoad={() => {
                                    const doc = iframeRef.current?.contentWindow?.document;
                                    setMountNode(doc ? doc.getElementById('mount-point') : null);
                                }}
                            />
                            {mountNode && ReactDOM.createPortal(
                                <div id="label-container">
                                     <AssetLabel asset={asset} />
                                </div>,
                                mountNode
                            )}
                         </div>
                     </div>
                 </div>

                 {/* Label Details Summary */}
                 <div className="mt-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 w-full max-w-sm text-xs shadow-xs">
                     <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex justify-between">
                         <span>Label Information</span>
                         <span className="text-slate-400 font-normal">Physical Size: 50 × 30 mm</span>
                     </div>
                     <div className="space-y-1 text-slate-600 dark:text-slate-300">
                         <div className="flex justify-between">
                             <span className="text-slate-400">Asset Name:</span>
                             <span className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{asset.name}</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-slate-400">Category:</span>
                             <span className="font-medium text-slate-800 dark:text-slate-100">{asset.category}</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-slate-400">Asset ID:</span>
                             <span className="font-bold text-slate-900 dark:text-slate-50 font-mono">{asset.assetId}</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-slate-400">Serial Number:</span>
                             <span className="font-mono text-slate-700 dark:text-slate-300">{asset.serialNumber || 'N/A'}</span>
                         </div>
                     </div>
                 </div>
            </main>
        </div>
    );
}