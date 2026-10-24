import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../hooks/useAppContext';

interface RequestFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

const RequestForm: React.FC<RequestFormProps> = ({ isOpen, onClose, onSubmit }) => {
    const { user } = useAuth();
    const { assets } = useAppContext();
    const [requestType, setRequestType] = useState<'New Asset' | 'Replacement' | 'Upgrade' | 'Repair'>('New Asset');
    const [category, setCategory] = useState('Laptop');
    const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
    const [currentAssetId, setCurrentAssetId] = useState<string>('');
    const [description, setDescription] = useState('');

    // Filter user's currently assigned assets (for replacement/upgrade/repair)
    const userAssignedAssets = useMemo(() => {
        if (!user) return [];
        return assets.filter(a => a.userId === user.id || (a.assigneeType === 'User' && a.assigneeId === user.id));
    }, [assets, user]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            requestType,
            category,
            priority,
            description,
            currentAssetId: currentAssetId ? Number(currentAssetId) : undefined
        });

        // Reset form
        setRequestType('New Asset');
        setCategory('Laptop');
        setPriority('Medium');
        setCurrentAssetId('');
        setDescription('');
        onClose();
    };

    const isExistingAssetRequired = requestType === 'Replacement' || requestType === 'Upgrade' || requestType === 'Repair';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Request IT Asset or Hardware" maxWidth="max-w-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Request Type */}
                    <div>
                        <label htmlFor="requestType" className="block text-sm font-semibold text-ink mb-1">
                            Request Type
                        </label>
                        <select
                            id="requestType"
                            name="requestType"
                            value={requestType}
                            onChange={e => setRequestType(e.target.value as any)}
                            className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent text-ink"
                        >
                            <option value="New Asset">New Asset</option>
                            <option value="Replacement">Replacement</option>
                            <option value="Upgrade">Upgrade</option>
                            <option value="Repair">Repair / Maintenance</option>
                        </select>
                    </div>

                    {/* Priority */}
                    <div>
                        <label htmlFor="priority" className="block text-sm font-semibold text-ink mb-1">
                            Priority Level
                        </label>
                        <select
                            id="priority"
                            name="priority"
                            value={priority}
                            onChange={e => setPriority(e.target.value as any)}
                            className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent text-ink"
                        >
                            <option value="Low">Low - Standard queue</option>
                            <option value="Medium">Medium - Normal workflow</option>
                            <option value="High">High - Impairing daily work</option>
                            <option value="Urgent">Urgent - Complete work stoppage</option>
                        </select>
                    </div>
                </div>

                {/* Asset Category */}
                <div>
                    <label htmlFor="category" className="block text-sm font-semibold text-ink mb-1">
                        Asset Category
                    </label>
                    <select
                        id="category"
                        name="category"
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent text-ink"
                    >
                        <option value="Laptop">Laptop</option>
                        <option value="Desktop">Desktop</option>
                        <option value="Monitor">Monitor</option>
                        <option value="Keyboard">Keyboard</option>
                        <option value="Mouse">Mouse</option>
                        <option value="Headset">Headset</option>
                        <option value="Docking Station">Docking Station</option>
                        <option value="Software License">Software License</option>
                        <option value="Other">Other Equipment</option>
                    </select>
                </div>

                {/* Conditional Current Asset Selection (Replacement / Upgrade / Repair) */}
                {isExistingAssetRequired && (
                    <div className="p-3.5 bg-surface/70 border border-line rounded-xl space-y-2">
                        <label htmlFor="currentAssetId" className="block text-xs font-bold text-ink uppercase tracking-wider">
                            Select Existing Asset to {requestType}
                        </label>
                        {userAssignedAssets.length > 0 ? (
                            <select
                                id="currentAssetId"
                                value={currentAssetId}
                                onChange={e => setCurrentAssetId(e.target.value)}
                                className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-sm text-ink focus:ring-2 focus:ring-accent"
                            >
                                <option value="">-- Choose one of your assigned assets --</option>
                                {userAssignedAssets.map(asset => (
                                    <option key={asset.id} value={asset.id}>
                                        {asset.name} ({asset.assetId}) - {asset.category} {asset.serialNumber ? `[S/N: ${asset.serialNumber}]` : ''}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-xs text-ink">
                                Note: You do not have any registered equipment currently assigned in the system. You can continue, but please specify details in the description below.
                            </p>
                        )}
                    </div>
                )}

                {/* Routing notification note */}
                <div className="bg-surface p-3 rounded-xl border border-line flex items-start gap-2.5">
                    <div className="p-1 bg-surface rounded text-ink shrink-0 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-xs text-ink leading-relaxed">
                        {user?.managerId ? (
                            <>This request will first be sent to your manager <span className="font-bold text-ink">({user?.manager?.name || 'Assigned Manager'})</span> for approval before reaching IT Admin for equipment allocation.</>
                        ) : (
                            <>No reporting manager is configured on your profile. This request will route directly to <span className="font-bold text-ink">IT Administration</span> for triage and allocation.</>
                        )}
                    </p>
                </div>

                {/* Description / Justification */}
                <div>
                    <label htmlFor="description" className="block text-sm font-semibold text-ink mb-1">
                        Business Justification / Specifications Needed <span className="text-ink">*</span>
                    </label>
                    <textarea
                        id="description"
                        name="description"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        required
                        rows={3}
                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent text-ink placeholder-quiet"
                        placeholder="Please detail why this asset is required, any technical specifications (e.g. RAM, dual monitors), or reasons for replacement..."
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end items-center gap-3 pt-4 border-t border-line">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-ink hover:bg-muted rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-5 py-2 text-sm font-semibold text-on-strong bg-accent hover:bg-accent rounded-xl transition-colors shadow-sm active:scale-95"
                    >
                        Submit Request
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default RequestForm;
