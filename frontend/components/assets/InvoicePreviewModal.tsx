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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm overflow-hidden animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 shrink-0">
                    <div className="min-w-0 pr-4">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                            {title}
                        </h3>
                        {filename && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                                {filename}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border border-brand-200/50 dark:border-brand-800/50"
                        >
                            {ICONS.download}
                            <span>Download</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            aria-label="Close"
                        >
                            {ICONS.close}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950/60 flex items-center justify-center min-h-[350px]">
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
