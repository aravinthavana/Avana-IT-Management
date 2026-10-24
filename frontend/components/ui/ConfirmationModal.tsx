import React, { ReactNode } from 'react';
import Modal from './Modal';
interface ConfirmationModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; children: ReactNode; }
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, children }) => (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
        <div className="text-sm text-quiet leading-relaxed mb-6">{children}</div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" data-autofocus onClick={onClose} className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-line text-ink hover:bg-muted">Cancel</button>
            <button type="button" onClick={onConfirm} className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-accent text-on-accent font-semibold">Confirm</button>
        </div>
    </Modal>
);
export default ConfirmationModal;
