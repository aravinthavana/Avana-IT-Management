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
            className={`fixed inset-0 bg-black z-50 flex justify-center items-start p-4 pt-10 sm:pt-20 transition-opacity duration-200 ${isOpen ? 'bg-opacity-60' : 'bg-opacity-0'}`}
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full ${maxWidth} max-h-[calc(100vh-6rem)] overflow-y-auto transform transition-all duration-200 ease-out ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            >
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 z-10 no-print">
                    <h3 id="modal-title" className="text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                        {ICONS.close}
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;