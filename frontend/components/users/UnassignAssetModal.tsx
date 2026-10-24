import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Asset } from '../../types';

type ReturnStatus = 'Under Inspection' | 'In Stock' | 'In Repair' | 'Retired' | 'Disposed';

interface UnassignAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { status: ReturnStatus, remarks: string, condition: string }) => void;
    asset: Asset | null;
}

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, children, ...props }) => (
    <div>
       <label className="block text-sm font-medium text-ink">{label}</label>
       <select {...props} className="mt-1 block w-full pl-3 pr-10 py-2 bg-surface border border-line rounded-md text-sm shadow-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-ink">
           {children}
       </select>
   </div>
);

const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }> = ({ label, ...props }) => (
   <div>
       <label className="block text-sm font-medium text-ink">{label}</label>
       <textarea {...props} rows={3} className="mt-1 block w-full px-3 py-2 bg-surface border border-line rounded-md text-sm shadow-sm placeholder-quiet focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-ink"></textarea>
   </div>
);

const UnassignAssetModal: React.FC<UnassignAssetModalProps> = ({ isOpen, onClose, onConfirm, asset }) => {
    const [status, setStatus] = useState<ReturnStatus>('Under Inspection');
    const [remarks, setRemarks] = useState('');
    const [condition, setCondition] = useState('Good');

    useEffect(() => {
        if (isOpen) {
            setStatus('Under Inspection');
            setRemarks(asset?.remarks || '');
            setCondition('Good');
        }
    }, [isOpen, asset]);

    const handleConfirm = () => {
        onConfirm({ status, remarks, condition });
    };

    if (!asset) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Return Asset & Update Status">
            <div className="space-y-4">
                <p className="text-sm text-quiet">
                    You are returning the asset <strong className="text-ink">{asset.name}</strong> ({asset.assetId}). Select its status after return.
                </p>
                <div className="bg-surface border border-line rounded-lg px-4 py-3 text-xs text-ink">
                    💡 <strong>Recommended:</strong> Set to <em>Under Inspection</em> first. IT will inspect the device, then move it to <em>Available for Reallocation</em> or <em>In Repair</em>.
                </div>
                <FormSelect
                    label="Status After Return"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReturnStatus)}
                >
                    <option value="Under Inspection">Under Inspection — IT to inspect before reallocation</option>
                    <option value="In Stock">In Stock — Ready to assign immediately</option>
                    <option value="In Repair">In Repair — Needs servicing</option>
                    <option value="Retired">Retired — End of life</option>
                    <option value="Disposed">Disposed — Written off / physically discarded</option>
                </FormSelect>
                <FormSelect
                    label="Condition at Return"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                >
                    <option value="Good">Good</option>
                    <option value="Minor Damage">Minor Damage</option>
                    <option value="Major Damage">Major Damage</option>
                </FormSelect>
                <FormTextarea
                    label="Remarks (Optional)"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Minor scratches on lid, charger missing..."
                />
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-4 gap-3">
                    <button type="button" onClick={onClose} className="w-full sm:w-auto flex justify-center bg-muted text-ink px-5 py-2 rounded-lg hover:bg-muted font-medium transition-all duration-200 active:scale-95">Cancel</button>
                    <button type="button" onClick={handleConfirm} className="w-full sm:w-auto flex justify-center bg-olive text-on-strong px-5 py-2 rounded-lg hover:bg-olive font-medium transition-all duration-200 active:scale-95">Confirm Return</button>
                </div>
            </div>
        </Modal>
    );
};

export default UnassignAssetModal;