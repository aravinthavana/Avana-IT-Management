import React, { ReactNode, useEffect, useState } from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, children }) => {
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
        <div className={`fixed inset-0 z-[60] flex justify-center items-center p-4 transition-opacity duration-200 ${isOpen ? 'bg-black bg-opacity-60' : 'bg-opacity-0'}`}>
            <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-200 ease-out ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <div className="p-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{children}</p>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-center gap-3">
                        <button onClick={onClose} className="w-full sm:w-auto justify-center px-6 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-all duration-200 active:scale-95 flex items-center">Cancel</button>
                        <button onClick={onConfirm} className="w-full sm:w-auto justify-center px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all duration-200 active:scale-95 flex items-center">Confirm</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;