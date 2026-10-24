import React, { ReactNode, useId } from 'react';
import { createPortal } from 'react-dom';
import { ICONS } from '../../constants';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    maxWidth?: string;
    closeDisabled?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg', closeDisabled = false }) => {
    const titleId = useId();
    const dialogRef = useDialogAccessibility(isOpen, () => { if (!closeDisabled) onClose(); });
    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/60 p-2 sm:p-4" onClick={() => { if (!closeDisabled) onClose(); }}>
            <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
                onClick={event => event.stopPropagation()}
                className={`bg-surface text-ink rounded-2xl shadow-2xl border border-line w-full ${maxWidth} max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col overflow-hidden`}>
                <div className="px-4 py-3 sm:px-6 border-b border-line flex justify-between items-center gap-3 shrink-0 no-print">
                    <h2 id={titleId} className="text-base sm:text-lg font-semibold min-w-0 break-words">{title}</h2>
                    <button type="button" disabled={closeDisabled} onClick={onClose} className="p-2 rounded-lg hover:bg-muted shrink-0" aria-label="Close dialog">{ICONS.close}</button>
                </div>
                <div className="p-4 sm:p-6 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
            </div>
        </div>, document.body
    );
};
export default Modal;
