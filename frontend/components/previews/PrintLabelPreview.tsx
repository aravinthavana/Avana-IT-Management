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
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
        <style>
          body { background-color: transparent; display: flex; align-items: center; justify-content: center; height: 100%; margin: 0; }
          @media print {
            body { background-color: #FFFFFF; padding: 0; margin: 0; display: block; }
            #label-container { position: absolute; top: 0; left: 0; }
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
                    <button onClick={() => setPreviewTarget(null)} className="mt-4 bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700">Go Back</button>
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
                <button onClick={handlePrint} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-medium transition-colors">
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