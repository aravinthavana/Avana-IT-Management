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

    const targetUserId = previewTarget.userId || (previewTarget as any).id;
    const targetAssetId = previewTarget.assetId;

    // Resolve the asset: either by targetAssetId or by finding the device assigned to user
    const laptop = (targetAssetId ? assets.find(a => a.id === targetAssetId) : null)
        || (targetUserId ? assets.find(a => ((a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === targetUserId) || a.assignedTo === targetUserId)) : null);

    // Resolve the user: either by targetUserId or from laptop's assignee
    const user = (targetUserId ? users.find(u => u.id === targetUserId) : null)
        || (laptop?.assigneeId ? users.find(u => u.id === laptop.assigneeId) : null)
        || (laptop?.assignedTo ? users.find(u => u.id === laptop.assignedTo) : null);

    const iframeSrcDoc = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Print Preview</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=0.2, maximum-scale=5.0, user-scalable=yes">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Arimo:wght@400;500;600;700&family=Fira+Sans:wght@600;700&display=swap" rel="stylesheet">
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          body {
            font-family: 'Arimo', Arial, sans-serif;
            background-color: transparent;
            margin: 0; padding: 0; height: 100%;
          }
          h1, h2, h3, h4, h5, h6 { font-family: 'Fira Sans', Arial, sans-serif; }
          #mount-point, #mount-point > div { height: 100%; }
          /* Essential Tailwind utilities for DeclarationForm */
          .flex { display: flex; } .flex-col { flex-direction: column; } .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .items-center { align-items: center; } .items-start { align-items: flex-start; }
          .justify-center { justify-content: center; } .justify-between { justify-content: space-between; }
          .w-full { width: 100%; } .h-full { height: 100%; } .max-w-2xl { max-width: 42rem; }
          .text-xs { font-size: 0.75rem; line-height: 1rem; }
          .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
          .text-base { font-size: 1rem; line-height: 1.5rem; }
          .text-lg { font-size: 1.125rem; } .text-xl { font-size: 1.25rem; } .text-2xl { font-size: 1.5rem; }
          .font-bold { font-weight: 700; } .font-semibold { font-weight: 600; } .font-medium { font-weight: 500; }
          .font-mono { font-family: monospace; }
          .text-center { text-align: center; } .text-right { text-align: right; } .text-left { text-align: left; }
          .uppercase { text-transform: uppercase; } .tracking-wide { letter-spacing: 0.025em; } .tracking-wider { letter-spacing: 0.05em; }
          .p-1 { padding: 0.25rem; } .p-2 { padding: 0.5rem; } .p-3 { padding: 0.75rem; }
          .p-4 { padding: 1rem; } .p-6 { padding: 1.5rem; } .p-8 { padding: 2rem; }
          .px-2 { padding-inline: 0.5rem; } .px-3 { padding-inline: 0.75rem; } .px-4 { padding-inline: 1rem; }
          .py-1 { padding-block: 0.25rem; } .py-2 { padding-block: 0.5rem; } .py-4 { padding-block: 1rem; }
          .m-0 { margin: 0; } .mx-auto { margin-inline: auto; }
          .mt-1 { margin-top: 0.25rem; } .mt-2 { margin-top: 0.5rem; } .mt-4 { margin-top: 1rem; } .mt-6 { margin-top: 1.5rem; }
          .mb-1 { margin-bottom: 0.25rem; } .mb-2 { margin-bottom: 0.5rem; } .mb-4 { margin-bottom: 1rem; }
          .gap-1 { gap: 0.25rem; } .gap-2 { gap: 0.5rem; } .gap-4 { gap: 1rem; } .gap-6 { gap: 1.5rem; }
          .space-y-1 > * + * { margin-top: 0.25rem; } .space-y-2 > * + * { margin-top: 0.5rem; } .space-y-4 > * + * { margin-top: 1rem; }
          .border { border: 1px solid; } .border-2 { border-width: 2px; } .border-b { border-bottom: 1px solid; }
          .border-t { border-top: 1px solid; } .border-black { border-color: #000; } .border-gray-300 { border-color: #d1d5db; }
          .border-gray-200 { border-color: #e5e7eb; } .border-dashed { border-style: dashed; }
          .rounded { border-radius: 0.25rem; } .rounded-lg { border-radius: 0.5rem; }
          .bg-white { background-color: #fff; } .bg-black { background-color: #000; }
          .bg-gray-50 { background-color: #f9fafb; } .bg-gray-100 { background-color: #f3f4f6; }
          .text-white { color: #fff; } .text-black { color: #000; }
          .text-gray-400 { color: #9ca3af; } .text-gray-500 { color: #6b7280; }
          .text-gray-600 { color: #4b5563; } .text-gray-700 { color: #374151; } .text-gray-800 { color: #1f2937; }
          .overflow-hidden { overflow: hidden; } .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .shrink-0 { flex-shrink: 0; } .min-w-0 { min-width: 0; }
          .shadow { box-shadow: 0 1px 3px 0 rgb(0 0 0/0.1); } .shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0/0.1); }
          .leading-relaxed { line-height: 1.625; } .leading-snug { line-height: 1.375; }
          .col-span-2 { grid-column: span 2 / span 2; }
          .object-contain { object-fit: contain; }
          .italic { font-style: italic; }
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
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 hidden sm:block">Declaration Form Preview</h2>
                <button onClick={handlePrint} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 text-sm font-medium transition-colors">
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