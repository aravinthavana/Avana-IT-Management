import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from '../../hooks/useAppContext';
import AssetLabel from '../assets/AssetLabel';
import { ICONS } from '../../constants';

export default function PrintLabelPreview() {
    const { assets, previewTarget, setPreviewTarget } = useAppContext();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

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
          body { background-color: transparent; display: flex; align-items: center; justify-content: center; font-family: 'Arial', sans-serif; }
          /* Tailwind-compatible utilities used by AssetLabel */
          .flex { display: flex; } .flex-col { flex-direction: column; } .items-center { align-items: center; }
          .justify-center { justify-content: center; } .justify-between { justify-content: space-between; }
          .w-full { width: 100%; } .h-full { height: 100%; }
          .text-xs { font-size: 0.75rem; } .text-sm { font-size: 0.875rem; } .text-base { font-size: 1rem; }
          .text-lg { font-size: 1.125rem; } .font-bold { font-weight: 700; } .font-semibold { font-weight: 600; }
          .font-medium { font-weight: 500; } .font-mono { font-family: monospace; }
          .text-center { text-align: center; } .uppercase { text-transform: uppercase; } .tracking-wider { letter-spacing: 0.05em; }
          .p-1 { padding: 0.25rem; } .p-2 { padding: 0.5rem; } .p-3 { padding: 0.75rem; } .p-4 { padding: 1rem; }
          .px-1 { padding-left: 0.25rem; padding-right: 0.25rem; } .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
          .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
          .m-0 { margin: 0; } .mx-auto { margin-left: auto; margin-right: auto; }
          .mt-1 { margin-top: 0.25rem; } .mb-1 { margin-bottom: 0.25rem; } .mb-2 { margin-bottom: 0.5rem; }
          .gap-1 { gap: 0.25rem; } .gap-2 { gap: 0.5rem; }
          .border { border: 1px solid; } .border-2 { border-width: 2px; } .border-black { border-color: #000; }
          .border-gray-300 { border-color: #d1d5db; } .border-t { border-top: 1px solid; } .border-b { border-bottom: 1px solid; }
          .rounded { border-radius: 0.25rem; } .rounded-lg { border-radius: 0.5rem; }
          .bg-white { background-color: #fff; } .bg-black { background-color: #000; } .bg-gray-100 { background-color: #f3f4f6; }
          .text-white { color: #fff; } .text-black { color: #000; } .text-gray-500 { color: #6b7280; } .text-gray-600 { color: #4b5563; }
          .overflow-hidden { overflow: hidden; } .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .shrink-0 { flex-shrink: 0; } .relative { position: relative; } .absolute { position: absolute; }
          .space-y-1 > * + * { margin-top: 0.25rem; }
          @media print {
            @page { size: 50mm 30mm; margin: 0; }
            html, body { width: 50mm; height: 30mm; overflow: hidden; background-color: #FFFFFF; }
            #mount-point { width: 100%; height: 100%; }
            #label-container { position: absolute; top: 0; left: 0; margin: 0; padding: 0; overflow: hidden; }
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
        return (
            <div className="bg-slate-200 dark:bg-slate-900 min-h-screen flex items-center justify-center text-slate-800 dark:text-slate-100">
                <div className="text-center p-4">
                    <p className="font-semibold text-lg">Error: Could not find asset data for preview.</p>
                    <button onClick={() => setPreviewTarget(null)} className="mt-4 bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700">Go Back</button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-slate-200 dark:bg-slate-900 min-h-screen flex flex-col">
            <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 p-4 flex justify-between items-center">
                <button onClick={() => setPreviewTarget(null)} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center text-sm font-medium transition-colors">
                    &larr; <span className="ml-2">Back</span>
                </button>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 hidden sm:block">Asset Label Preview</h2>
                <button onClick={handlePrint} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 text-sm font-medium transition-colors">
                    {ICONS.print}
                    <span>Print Label</span>
                </button>
            </header>
            <main className="flex-1 p-4 sm:p-8 flex flex-col items-center justify-center">
                 <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-4 max-w-md">
                    This is a preview of the 50mm x 30mm asset label. Use your browser's print dialog to print.
                    Ensure your printer settings match this label size and margins are minimal.
                 </p>
                 <div style={{ width: '189px', height: '113px', border: '1px dashed grey', flexShrink: 0, backgroundColor: 'white' }}>
                    <iframe
                        ref={iframeRef}
                        srcDoc={iframeSrcDoc}
                        title="Asset Label Preview"
                        style={{ width: '100%', height: '100%', border: 'none' }}
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
            </main>
        </div>
    );
}