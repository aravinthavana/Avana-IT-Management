import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from '../../hooks/useAppContext';
import DeclarationForm from '../users/DeclarationForm';
import { ICONS } from '../../constants';

export default function DeclarationFormPreview() {
    const { users, assets, previewTarget, setPreviewTarget } = useAppContext();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

    if (!previewTarget || previewTarget.type !== 'declaration') return null;

    const user = users.find(u => u.id === previewTarget.userId);
    const laptop = assets.find(a => a.id === previewTarget.assetId);

    const iframeSrcDoc = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Print Preview</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=0.2, maximum-scale=5.0, user-scalable=yes">
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { 
            font-family: 'Inter', sans-serif; 
            background-color: transparent; 
            margin: 0;
            padding: 0;
            height: 100%;
          }
           #mount-point, #mount-point > div {
            height: 100%;
          }
          @media print { 
            body { background-color: #FFFFFF; }
            #mount-point > div { box-shadow: none !important; }
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

    if (!user || !laptop) {
        return (
            <div className="bg-slate-200 dark:bg-slate-900 min-h-screen flex items-center justify-center text-slate-800 dark:text-slate-100">
                <div className="text-center p-4">
                    <p className="font-semibold text-lg">Error: Could not find user or asset data for preview.</p>
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
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 hidden sm:block">Declaration Form Preview</h2>
                <button onClick={handlePrint} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-medium transition-colors">
                    {ICONS.print}
                    <span>Print / Export PDF</span>
                </button>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-500 dark:bg-slate-700">
                 <iframe
                    ref={iframeRef}
                    srcDoc={iframeSrcDoc}
                    title="Declaration Form Preview"
                    className="mx-auto block border-none shadow-2xl"
                    style={{ width: '21cm', height: '29.7cm' }}
                    scrolling="no"
                    onLoad={() => {
                        const doc = iframeRef.current?.contentWindow?.document;
                        setMountNode(doc ? doc.getElementById('mount-point') : null);
                    }}
                />
                {mountNode && ReactDOM.createPortal(
                    <DeclarationForm user={user} laptop={laptop} />,
                    mountNode
                )}
            </main>
        </div>
    );
}