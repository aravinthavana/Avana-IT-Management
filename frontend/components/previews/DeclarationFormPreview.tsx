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
        <title>Declaration Form - Avana IT Management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=0.2, maximum-scale=5.0, user-scalable=yes">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Arimo:wght@400;500;600;700&family=Fira+Sans:wght@600;700&display=swap" rel="stylesheet">
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background-color: #FFFFFF;
            font-family: 'Arimo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          h1, h2, h3, h4, h5, h6 { font-family: 'Fira Sans', Arial, sans-serif; }
          #mount-point, #mount-point > div { height: 100%; }

          /* Layout & Flexbox */
          .flex { display: flex; }
          .flex-col { flex-direction: column; }
          .flex-1 { flex: 1 1 0%; }
          .flex-shrink-0 { flex-shrink: 0; }
          .flex-grow { flex-grow: 1; }
          .items-center { align-items: center; }
          .items-start { align-items: flex-start; }
          .items-end { align-items: flex-end; }
          .justify-between { justify-content: space-between; }
          .justify-center { justify-content: center; }
          .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .gap-1 { gap: 0.25rem; }
          .gap-2 { gap: 0.5rem; }
          .gap-3 { gap: 0.75rem; }
          .gap-4 { gap: 1rem; }
          .gap-6 { gap: 1.5rem; }
          .gap-x-3 { column-gap: 0.75rem; }
          .gap-x-4 { column-gap: 1rem; }
          .gap-y-1 { row-gap: 0.25rem; }
          .gap-y-2 { row-gap: 0.5rem; }

          /* Sizing */
          .w-full { width: 100%; }
          .w-auto { width: auto; }
          .w-32 { width: 8rem; }
          .w-36 { width: 9rem; }
          .w-\[18\%\] { width: 18%; }
          .w-\[32\%\] { width: 32%; }
          .h-full { height: 100%; }
          .h-5 { height: 1.25rem; }
          .h-6 { height: 1.5rem; }
          .h-10 { height: 2.5rem; }
          .max-w-\[125px\] { max-width: 125px; }
          .object-contain { object-fit: contain; }

          /* Spacing */
          .p-1 { padding: 0.25rem; }
          .p-2 { padding: 0.5rem; }
          .p-2\.5 { padding: 0.625rem; }
          .p-7 { padding: 1.75rem; }
          .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
          .px-2\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
          .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
          .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
          .py-1\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
          .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
          .pt-0\.5 { padding-top: 0.125rem; }
          .pt-1 { padding-top: 0.25rem; }
          .pt-2 { padding-top: 0.5rem; }
          .pb-0\.5 { padding-bottom: 0.125rem; }
          .pb-1\.5 { padding-bottom: 0.375rem; }
          .pb-2\.5 { padding-bottom: 0.625rem; }
          .pl-0\.5 { padding-left: 0.125rem; }
          .pl-4 { padding-left: 1rem; }
          .ml-1 { margin-left: 0.25rem; }
          .ml-2 { margin-left: 0.5rem; }
          .ml-4 { margin-left: 1rem; }
          .ml-auto { margin-left: auto; }
          .mt-0\.5 { margin-top: 0.125rem; }
          .mt-auto { margin-top: auto; }
          .mb-1 { margin-bottom: 0.25rem; }
          .mb-1\.5 { margin-bottom: 0.375rem; }
          .mb-2 { margin-bottom: 0.5rem; }
          .mb-2\.5 { margin-bottom: 0.625rem; }
          .mb-3 { margin-bottom: 0.75rem; }
          .my-1\.5 { margin-top: 0.375rem; margin-bottom: 0.375rem; }
          .space-y-0\.5 > * + * { margin-top: 0.125rem; }
          .space-y-1 > * + * { margin-top: 0.25rem; }

          /* Typography */
          .text-\[7pt\] { font-size: 7pt; }
          .text-\[7\.5pt\] { font-size: 7.5pt; }
          .text-\[7\.8pt\] { font-size: 7.8pt; }
          .text-\[8pt\] { font-size: 8pt; }
          .text-\[8\.5pt\] { font-size: 8.5pt; }
          .text-\[9pt\] { font-size: 9pt; }
          .text-\[11pt\] { font-size: 11pt; }
          .text-xs { font-size: 0.75rem; }
          .text-sm { font-size: 0.875rem; }
          .font-normal { font-weight: 400; }
          .font-medium { font-weight: 500; }
          .font-semibold { font-weight: 600; }
          .font-bold { font-weight: 700; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .uppercase { text-transform: uppercase; }
          .tracking-tight { letter-spacing: -0.025em; }
          .tracking-wide { letter-spacing: 0.025em; }
          .tracking-wider { letter-spacing: 0.05em; }
          .tracking-widest { letter-spacing: 0.1em; }
          .leading-tight { line-height: 1.25; }
          .leading-relaxed { line-height: 1.5; }
          .italic { font-style: italic; }
          .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .inline-block { display: inline-block; }
          .block { display: block; }
          .opacity-80 { opacity: 0.8; }

          /* Colors */
          .bg-white { background-color: #ffffff; }
          .bg-slate-50 { background-color: #f8fafc; }
          .bg-slate-50\/60 { background-color: rgba(248, 250, 252, 0.6); }
          .bg-slate-50\/70 { background-color: rgba(248, 250, 252, 0.7); }
          .bg-slate-100 { background-color: #f1f5f9; }
          .bg-slate-800 { background-color: #1e293b; }
          .text-white { color: #ffffff; }
          .text-slate-400 { color: #94a3b8; }
          .text-slate-500 { color: #64748b; }
          .text-slate-600 { color: #475569; }
          .text-slate-700 { color: #334155; }
          .text-slate-800 { color: #1e293b; }
          .text-slate-900 { color: #0f172a; }

          /* Borders */
          .border-collapse { border-collapse: collapse; }
          .border { border: 1px solid; }
          .border-b { border-bottom: 1px solid; }
          .border-b-2 { border-bottom: 2px solid; }
          .border-t-2 { border-top: 2px solid; }
          .border-l { border-left: 1px solid; }
          .border-r { border-right: 1px solid; }
          .border-slate-200 { border-color: #e2e8f0; }
          .border-slate-300 { border-color: #cbd5e1; }
          .border-slate-400 { border-color: #94a3b8; }
          .border-slate-700 { border-color: #334155; }
          .border-slate-900 { border-color: #0f172a; }
          .rounded { border-radius: 0.25rem; }
          .rounded-t { border-top-left-radius: 0.25rem; border-top-right-radius: 0.25rem; }
          .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }

          /* Lists */
          .list-decimal { list-style-type: decimal; }
          .list-inside { list-style-position: inside; }

          /* Print Overrides */
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            html, body {
              width: 100% !important;
              height: 100% !important;
              background-color: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #mount-point, #mount-point > div {
              height: 100% !important;
              box-shadow: none !important;
              padding: 0 !important;
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
        <div className="bg-slate-200 dark:bg-slate-900 min-h-screen flex flex-col">
            <header className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 px-4 py-3 flex justify-between items-center shadow-sm">
                <button onClick={() => setPreviewTarget(null)} className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center text-sm font-medium transition-colors">
                    &larr; <span className="ml-1.5">Back</span>
                </button>
                <div className="text-center">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Declaration Form Preview</h2>
                    <p className="text-xs text-slate-400 font-mono hidden sm:block">{laptop.assetId} &bull; {user.name}</p>
                </div>
                <button onClick={handlePrint} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 text-sm font-semibold transition-all active:scale-95 shadow-md shadow-brand-600/20">
                    {ICONS.print}
                    <span>Print / Save PDF</span>
                </button>
            </header>
            <main className="flex-1 overflow-auto p-3 sm:p-6 bg-slate-600/60 dark:bg-slate-950 flex justify-center items-start">
                <div className="shadow-2xl rounded-sm overflow-hidden bg-white max-w-full">
                    <iframe
                        ref={iframeRef}
                        srcDoc={iframeSrcDoc}
                        title="Declaration Form Preview"
                        className="block border-none"
                        style={{ width: '21cm', minHeight: '29.7cm', height: '100%' }}
                        onLoad={() => {
                            const doc = iframeRef.current?.contentWindow?.document;
                            setMountNode(doc ? doc.getElementById('mount-point') : null);
                        }}
                    />
                </div>
                {mountNode && ReactDOM.createPortal(
                    <DeclarationForm user={user} laptop={laptop} />,
                    mountNode
                )}
            </main>
        </div>
    );
}