import React, { ReactNode, useEffect, useState } from 'react';
import { ICONS } from '../../constants';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
    const [isRendered, setIsRendered] = useState(isOpen);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isOpen) {
            setIsRendered(true);
        } else {
            // Wait for closing animation to finish before un-rendering
            timeoutId = setTimeout(() => setIsRendered(false), 200);
        }
        return () => clearTimeout(timeoutId);
    }, [isOpen]);

    if (!isRendered) return null;

    return (
        <div 
            className={`fixed inset-0 z-50 flex justify-center items-center p-2 sm:p-4 transition-colors duration-200 ${isOpen ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0'}`}
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className={`bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full ${maxWidth} max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden transform transition-all duration-200 ease-out ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            >
                <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 z-10 shrink-0 no-print">
                    <h3 id="modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 pr-2 truncate">{title}</h3>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 -mr-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors shrink-0"
                        aria-label="Close modal"
                    >
                        {ICONS.close}
                    </button>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;