import React from 'react';
import { ICONS } from '../../constants';

interface InvoicePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    fileUrl?: string | null;
    filename?: string | null;
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
    isOpen,
    onClose,
    title,
    fileUrl,
    filename,
}) => {
    if (!isOpen || !fileUrl) return null;

    const isPdf = filename?.toLowerCase().endsWith('.pdf') || fileUrl.startsWith('data:application/pdf');

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = filename || 'service-invoice';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm overflow-hidden animate-fade-in bg-slate-900/70">
            <div className="rounded-3xl shadow-2xl border w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-scale-in bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center shrink-0 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                    <div className="min-w-0 pr-4">
                        <h3 className="text-base sm:text-lg font-bold truncate text-slate-900 dark:text-white">
                            {title}
                        </h3>
                        {filename && (
                            <p className="text-xs font-mono truncate text-slate-500 dark:text-slate-400">
                                {filename}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 border-brand-200/50 dark:border-brand-800/50"
                        >
                            {ICONS.download}
                            <span>Download</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            aria-label="Close"
                        >
                            {ICONS.close}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center min-h-[350px] bg-slate-100 dark:bg-slate-950/60">
                    {isPdf ? (
                        <iframe
                            src={fileUrl}
                            title={filename || 'Invoice PDF'}
                            className="w-full h-[70vh] rounded-2xl border border-slate-300 dark:border-slate-700 bg-white"
                        />
                    ) : (
                        <div className="max-w-full max-h-[70vh] overflow-auto flex items-center justify-center">
                            <img
                                src={fileUrl}
                                alt={filename || 'Invoice'}
                                className="max-w-full max-h-[68vh] object-contain rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 bg-white"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvoicePreviewModal;
