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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-strong/70 backdrop-blur-sm overflow-hidden animate-fade-in">
            <div className="bg-surface rounded-3xl shadow-2xl border border-line w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="px-6 py-4 border-b border-line flex justify-between items-center bg-canvas shrink-0">
                    <div className="min-w-0 pr-4">
                        <h3 className="text-base sm:text-lg font-bold text-ink truncate">
                            {title}
                        </h3>
                        {filename && (
                            <p className="text-xs text-quiet font-mono truncate">
                                {filename}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="bg-surface hover:bg-surface text-ink px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border border-accent/50"
                        >
                            {ICONS.download}
                            <span>Download</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-quiet hover:text-quiet p-2 rounded-xl hover:bg-muted transition-colors"
                            aria-label="Close"
                        >
                            {ICONS.close}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 bg-muted flex items-center justify-center min-h-[350px]">
                    {isPdf ? (
                        <iframe
                            src={fileUrl}
                            title={filename || 'Invoice PDF'}
                            className="w-full h-[70vh] rounded-2xl border border-line bg-surface"
                        />
                    ) : (
                        <div className="max-w-full max-h-[70vh] overflow-auto flex items-center justify-center">
                            <img
                                src={fileUrl}
                                alt={filename || 'Invoice'}
                                className="max-w-full max-h-[68vh] object-contain rounded-2xl shadow-lg border border-line bg-surface"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvoicePreviewModal;
