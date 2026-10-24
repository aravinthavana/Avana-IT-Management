import { licenseProvider } from '../../utils/licenseUtils';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { API_URL } from '../../utils/apiClient';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { User, Asset, License } from '../../types';
import { ICONS } from '../../constants';

interface OffboardingWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialUser?: User | null;
    onSuccess?: (user: User) => void;
}

const STEPS = [
    { id: 1, name: 'Employee', desc: 'Active Assets & Subs' },
    { id: 2, name: 'Asset Return', desc: 'Logistics & Condition' },
    { id: 3, name: 'Asset Routing', desc: 'Status Transition' },
    { id: 4, name: 'Data & Wipe', desc: 'Backup & Security' },
    { id: 5, name: 'Licenses', desc: 'Revocation' },
    { id: 6, name: 'Sign-Off', desc: 'Deactivation' },
];


const OffboardingWizardModal: React.FC<OffboardingWizardModalProps> = ({ isOpen, onClose, initialUser, onSuccess }) => {

    const dialogRef = useDialogAccessibility(isOpen, onClose);
    const { users, setUsers, assets, setAssets, licenses, setLicenses, getHeaders, setNotification, fetchAssetHistory } = useAppContext();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Step 1: Employee Selection
    const [selectedUserId, setSelectedUserId] = useState<number | ''>(initialUser ? initialUser.id : (users[0]?.id || ''));
    const selectedUser = users.find(u => u.id === Number(selectedUserId));

    // User's assigned assets and licenses
    const userAssets = selectedUser ? assets.filter(a => ((a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === selectedUser.id) || a.assignedTo === selectedUser.id || a.userId === selectedUser.id)) : [];
    const userLicenses = selectedUser ? licenses.filter(l => licenseProvider(l) !== 'zoho' && l.assignments?.some(a => a.userId === selectedUser.id)) : [];

    // Step 2: Asset Return & Condition
    const [selectedAssetId, setSelectedAssetId] = useState<number | ''>('');
    const activeAssetToReturn = userAssets.find(a => a.id === Number(selectedAssetId)) || (userAssets.length > 0 ? userAssets[0] : null);
    const [returnMode, setReturnMode] = useState<'In-Person' | 'Courier'>('In-Person');
    const [returnCourier, setReturnCourier] = useState('Blue Dart');
    const [returnDocket, setReturnDocket] = useState('');
    const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
    const [returnCondition, setReturnCondition] = useState<string>('Good');
    const [returnRemarks, setReturnRemarks] = useState('');
    const [accessoriesReturned, setAccessoriesReturned] = useState<Record<string, boolean>>({
        charger: true,
        bag: true,
        mouse: false,
        dongle: false,
        powerCable: true,
        monitor: false,
        keyboard: false,
        displayCable: false,
    });

    // Step 3: Asset Routing
    const [destinationStatus, setDestinationStatus] = useState<string>('Under Inspection');

    // Step 4: Data & Wipe
    const [dataBackedUp, setDataBackedUp] = useState(false);
    const [deviceWiped, setDeviceWiped] = useState(false);
    const [wipeDetails, setWipeDetails] = useState('Full Factory Reset (Clean OS Reinstall)');

    // Step 5: License Revocation
    const [revokeAllLicenses, setRevokeAllLicenses] = useState(true);

    // Step 6: Deactivation
    const [disableM365, setDisableM365] = useState(true);
    const [deactivateUser, setDeactivateUser] = useState(true);
    const [offboardingRemarks, setOffboardingRemarks] = useState('');

    // When modal opens or initialUser changes, set user and select their assigned asset
    useEffect(() => {
        if (isOpen) {
            const targetUser = initialUser || (users.length > 0 ? users[0] : null);
            const targetId = targetUser ? targetUser.id : '';
            setSelectedUserId(targetId);

            if (targetId) {
                const targetAssets = assets.filter(a =>
                    ((a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === Number(targetId)) ||
                     a.assignedTo === Number(targetId) ||
                     a.userId === Number(targetId))
                );
                setSelectedAssetId(targetAssets.length > 0 ? targetAssets[0].id : '');
            } else {
                setSelectedAssetId('');
            }
            setCurrentStep(1);
        }
    }, [isOpen, initialUser]);

    // When selectedUserId changes, strictly sync selectedAssetId to that specific employee's assets
    useEffect(() => {
        if (selectedUserId) {
            const currentOwnedAssets = assets.filter(a =>
                ((a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === Number(selectedUserId)) ||
                 a.assignedTo === Number(selectedUserId) ||
                 a.userId === Number(selectedUserId))
            );
            if (currentOwnedAssets.length > 0) {
                // If selectedAssetId does not belong to this user, reset to their first asset
                if (!currentOwnedAssets.some(a => a.id === Number(selectedAssetId))) {
                    setSelectedAssetId(currentOwnedAssets[0].id);
                }
            } else {
                setSelectedAssetId('');
            }
        } else {
            setSelectedAssetId('');
        }
    }, [selectedUserId, assets]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (!selectedUser) {
            setNotification({ message: 'Please select an employee to offboard.', type: 'error' });
            return;
        }
        setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    };

    const handleFinalSubmit = async () => {
        if (!selectedUser) return;
        setIsSubmitting(true);

        try {
            const assetToSubmit = activeAssetToReturn;
            const hasAsset = !!assetToSubmit;

            const res = await fetch(`${API_URL}/api/offboarding/process`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    userId: selectedUser.id,
                    assetReturn: hasAsset ? {
                        assetId: Number(assetToSubmit.id),
                        destinationStatus,
                        condition: returnCondition,
                        returnMode,
                        courierName: returnMode === 'Courier' ? returnCourier : undefined,
                        docketNumber: returnMode === 'Courier' ? returnDocket : undefined,
                        returnDate,
                        remarks: returnRemarks || undefined,
                    } : undefined,
                    deviceWiped,
                    wipeDetails: deviceWiped ? wipeDetails : undefined,
                    dataBackedUp,
                    revokeAllLicenses,
                    disableM365,
                    deactivateUser,
                    offboardingRemarks: offboardingRemarks || undefined,
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to process offboarding');
            }

            const updatedUser = await res.json();
            setUsers(users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));

            // If asset was returned, update asset locally
            if (hasAsset && assetToSubmit) {
                setAssets(assets.map(a => a.id === assetToSubmit.id ? {
                    ...a,
                    status: destinationStatus,
                    userId: null,
                    assigneeId: null,
                    assigneeType: null,
                    remarks: returnRemarks || a.remarks
                } : a));
                fetchAssetHistory();
            }

            // If licenses revoked, update license state
            if (revokeAllLicenses && updatedUser.m365LicenseRevoked && userLicenses.length > 0) {
                setLicenses(licenses.map(l => {
                    if (licenseProvider(l) === 'zoho') return l;
                    const filtered = l.assignments?.filter(a => a.userId !== selectedUser.id) || [];
                    return {
                        ...l,
                        assignedSeats: filtered.length,
                        assignments: filtered
                    };
                }));
            }

            if (updatedUser.offboardingStatus !== 'Completed') {
                setNotification({ message: (updatedUser.operationErrors || ['Offboarding remains in progress.']).join(' '), type: 'error' });
                return;
            }
            setNotification({ message: `Offboarding completed successfully for ${updatedUser.name}.`, type: 'success' });
            if (onSuccess) onSuccess(updatedUser);
            onClose();
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Employee offboarding" className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 overflow-y-auto bg-black/60">
            <div className="rounded-2xl shadow-2xl border w-full max-w-3xl max-h-[calc(100dvh-1rem)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">

                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r flex items-center justify-between shrink-0 from-red-600 to-amber-600 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/20">
                            {ICONS.offboarding}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Employee Offboarding Wizard</h2>
                            <p className="text-xs text-white/80">Asset reclamation, data wiping, license release & account disabling</p>
                        </div>
                    </div>
                    <button aria-label="Close dialog" onClick={onClose} className="p-1 rounded-lg transition-colors text-white/80 hover:text-white hover:bg-white/10">
                        {ICONS.close}
                    </button>
                </div>

                {/* Stepper Header */}
                <div className="border-b px-6 py-3 shrink-0 overflow-x-auto bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between w-max min-w-full gap-4">
                        {STEPS.map((step, idx) => {
                            const isDone = currentStep > step.id;
                            const isCurrent = currentStep === step.id;
                            return (
                                <React.Fragment key={step.id}>
                                    <button
                                        onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                                        disabled={step.id > currentStep}
                                        className={`flex items-center gap-2 text-left transition-all ${
                                            isCurrent ? 'font-semibold text-red-600 dark:text-red-400' :
                                            isDone ? 'cursor-pointer text-emerald-600 dark:text-emerald-400' : 'cursor-not-allowed text-slate-400'
                                        }`}
                                    >
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                            isCurrent ? 'shadow-md ring-2 bg-red-600 text-white ring-red-200 dark:ring-red-900' :
                                            isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                        }`}>
                                            {isDone ? '✓' : step.id}
                                        </div>
                                        <div className="hidden sm:block">
                                            <p className="text-xs leading-none font-medium">{step.name}</p>
                                            <p className="text-[10px] leading-tight text-slate-400">{step.desc}</p>
                                        </div>
                                    </button>
                                    {idx < STEPS.length - 1 && (
                                        <div className={`flex-1 h-[2px] mx-2 transition-colors ${
                                            step.id < currentStep ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                                        }`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 text-slate-700 dark:text-slate-200">

                    {/* STEP 1: Select Employee & Review Holdings */}
                    {currentStep === 1 && (
                        <div className="space-y-4 max-w-xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 1: Select Employee to Offboard</h3>
                                <p className="text-xs text-slate-500">Choose the departing employee to inspect active company assets and subscriptions</p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Employee</label>
                                <select aria-label="Employee"
                                    value={selectedUserId}
                                    onChange={e => setSelectedUserId(Number(e.target.value))}
                                    className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-red-500"
                                >
                                    <option value="">-- Choose Employee --</option>
                                    {users.filter(u => u.status === 'Active' || u.id === initialUser?.id).map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.name} ({u.email}) - {u.department?.name || 'No Dept'} [{u.role}]
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedUser && (
                                <div className="p-4 rounded-xl border space-y-3 animate-in fade-in duration-150 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned Equipment</span>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                            {userAssets.length} Device(s)
                                        </span>
                                    </div>
                                    {userAssets.length === 0 ? (
                                        <p className="text-xs italic text-slate-500">No physical company devices currently assigned.</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {userAssets.map(a => (
                                                <div key={a.id} className="flex items-center justify-between text-xs p-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{a.name} ({a.assetId})</span>
                                                    <span className="font-mono text-slate-500">S/N: {a.serialNumber || 'N/A'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned Software Licenses</span>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                                            {userLicenses.length} Subscription(s)
                                        </span>
                                    </div>
                                    {userLicenses.length === 0 ? (
                                        <p className="text-xs italic text-slate-500">No subscription licenses assigned to this user.</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {userLicenses.map(l => (
                                                <div key={l.id} className="flex items-center justify-between text-xs p-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{l.name}</span>
                                                    <span className="text-slate-500">{l.category}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: Asset Return & Condition */}
                    {currentStep === 2 && (
                        <div className="space-y-4 max-w-xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 2: Asset Return Logistics & Condition</h3>
                                <p className="text-xs text-slate-500">Record how the equipment was received, physical condition, and returned accessories</p>
                            </div>

                            {userAssets.length === 0 ? (
                                <div className="p-6 rounded-xl text-center space-y-2 bg-slate-50 dark:bg-slate-800/40">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Company Device Assigned</p>
                                    <p className="text-xs text-slate-500">This employee does not have any active hardware assignments. You can proceed to data backup & license release.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Prominent device being returned banner */}
                                    {activeAssetToReturn && (() => {
                                        const isDesktopAsset = activeAssetToReturn?.category?.toLowerCase() === 'desktop' || activeAssetToReturn?.assetId?.includes('-DES-');
                                        return (
                                            <div className="p-3.5 rounded-xl border flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Device Being Returned</p>
                                                    <p className="text-sm font-bold flex items-center gap-2 mt-0.5 text-slate-900 dark:text-slate-100">
                                                        {isDesktopAsset ? '🖥️' : '💻'} {activeAssetToReturn.name}
                                                        <span className="font-mono px-2 py-0.5 rounded text-xs text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50">
                                                            [{activeAssetToReturn.assetId}]
                                                        </span>
                                                    </p>
                                                    <p className="text-xs mt-0.5 text-slate-500">
                                                        Serial No: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{activeAssetToReturn.serialNumber || 'N/A'}</span>
                                                        {activeAssetToReturn.brand ? ` • ${activeAssetToReturn.brand} ${activeAssetToReturn.model || ''}` : ''}
                                                    </p>
                                                </div>
                                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                                                    Currently Assigned
                                                </span>
                                            </div>
                                        );
                                    })()}

                                    {userAssets.length > 1 && (
                                        <div>
                                            <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-400">Select Asset Being Returned ({userAssets.length} assigned to employee)</label>
                                            <select aria-label="Select Asset Being Returned ( assigned to employee)"
                                                value={selectedAssetId}
                                                onChange={e => setSelectedAssetId(Number(e.target.value))}
                                                className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-red-500"
                                            >
                                                {userAssets.map(a => (
                                                    <option key={a.id} value={a.id}>{a.name} [{a.assetId}] - S/N: {a.serialNumber || 'N/A'}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setReturnMode('In-Person')}
                                            className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-semibold transition-all ${returnMode === 'In-Person' ? 'border-red-600 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' : 'border-slate-200 dark:border-slate-700 text-slate-600'}`}
                                        >
                                            {ICONS.users}
                                            In-Person Handover
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReturnMode('Courier')}
                                            className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-semibold transition-all ${returnMode === 'Courier' ? 'border-red-600 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' : 'border-slate-200 dark:border-slate-700 text-slate-600'}`}
                                        >
                                            {ICONS.truck}
                                            Courier Receipt
                                        </button>
                                    </div>

                                    {returnMode === 'Courier' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border animate-in fade-in duration-150 bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700">
                                            <div>
                                                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-400">Carrier Partner</label>
                                                <input aria-label="Carrier Partner"
                                                    type="text"
                                                    value={returnCourier}
                                                    onChange={e => setReturnCourier(e.target.value)}
                                                    placeholder="e.g. Blue Dart, DTDC, DHL"
                                                    className="w-full p-2 rounded-lg border text-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-400">Docket / AWB Tracking #</label>
                                                <input aria-label="Docket / AWB Tracking #"
                                                    type="text"
                                                    value={returnDocket}
                                                    onChange={e => setReturnDocket(e.target.value)}
                                                    placeholder="e.g. BD-9918237"
                                                    className="w-full p-2 rounded-lg border text-xs font-mono border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-400">Return Condition *</label>
                                        <select aria-label="Return Condition *"
                                            value={returnCondition}
                                            onChange={e => setReturnCondition(e.target.value)}
                                            className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-red-500"
                                        >
                                            <option value="Good">Good (Working fine, normal wear and tear)</option>
                                            <option value="Minor Damage">Minor Damage (Small scratches, missing rubber feet, dirty keyboard)</option>
                                            <option value="Major Damage">Major Damage (Cracked screen, broken hinge, liquid spill)</option>
                                            <option value="Non-functional">Non-functional / Dead (Does not power on, motherboard failure)</option>
                                        </select>
                                    </div>

                                    {(() => {
                                        const isDesktopAsset = activeAssetToReturn?.category?.toLowerCase() === 'desktop' || activeAssetToReturn?.assetId?.includes('-DES-');
                                        const accessoryOptions = isDesktopAsset ? [
                                            { key: 'powerCable', label: 'Power Cable / Cord' },
                                            { key: 'monitor', label: 'Monitor / Display Unit' },
                                            { key: 'keyboard', label: 'Keyboard (USB / Wireless)' },
                                            { key: 'mouse', label: 'Mouse (USB / Wireless)' },
                                            { key: 'displayCable', label: 'HDMI / DP / VGA Cable' },
                                        ] : [
                                            { key: 'charger', label: 'OEM Charger / Power Adapter' },
                                            { key: 'bag', label: 'Laptop Bag / Backpack' },
                                            { key: 'mouse', label: 'Wireless Mouse' },
                                            { key: 'dongle', label: 'USB-C / HDMI Adapter' },
                                        ];

                                        return (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-400">
                                                        Accessories Returned ({isDesktopAsset ? 'Desktop Peripherals' : 'Laptop Accessories'})
                                                    </label>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        {accessoryOptions.map(acc => (
                                                            <label key={acc.key} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={Boolean(accessoriesReturned[acc.key])}
                                                                    onChange={e => setAccessoriesReturned({ ...accessoriesReturned, [acc.key]: e.target.checked })}
                                                                    className="rounded text-red-600"
                                                                />
                                                                <span>{acc.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-400">Return Inspection Remarks</label>
                                                    <input aria-label="Return Inspection Remarks"
                                                        type="text"
                                                        value={returnRemarks}
                                                        onChange={e => setReturnRemarks(e.target.value)}
                                                        placeholder={isDesktopAsset ? "e.g. Desktop returned with monitor, keyboard and power cables. All working." : "e.g. Device returned with original charger. Minor scratch on top cover."}
                                                        className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-red-500"
                                                    />
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Asset Routing */}
                    {currentStep === 3 && (
                        <div className="space-y-4 max-w-xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 3: Asset Status Routing</h3>
                                <p className="text-xs text-slate-500">
                                    {activeAssetToReturn
                                        ? `Routing ${activeAssetToReturn.name} [${activeAssetToReturn.assetId}] to destination status in inventory pool`
                                        : 'Choose the destination status in the inventory pool for the returned hardware'}
                                </p>
                            </div>

                            {userAssets.length === 0 ? (
                                <p className="text-xs italic text-center py-8 text-slate-500">No asset to route. Proceed to data & wipe.</p>
                            ) : (
                                <div className="space-y-3">
                                    {[
                                        { status: 'Under Inspection', title: 'Under Inspection (Recommended)', desc: 'Device quarantined for diagnostic tests, physical cleaning, and software wipe before re-allocation' },
                                        { status: 'In Stock', title: 'In Stock (Direct Availability)', desc: 'Device is clean and ready for immediate reassignment without further inspection' },
                                        { status: 'In Repair', title: 'In Repair (Needs Service)', desc: 'Device has physical defects or hardware failure and requires warranty claim or repair' },
                                        { status: 'Retired', title: 'Retired / Decommissioned', desc: 'End-of-life device to be archived and taken out of active operations' },
                                    ].map(opt => (
                                        <label key={opt.status} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${destinationStatus === opt.status ? 'border-red-600 bg-red-50/50 dark:bg-red-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                                            <input
                                                type="radio"
                                                name="destStatus"
                                                checked={destinationStatus === opt.status}
                                                onChange={() => setDestinationStatus(opt.status)}
                                                className="mt-1 text-red-600"
                                            />
                                            <div>
                                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{opt.title}</span>
                                                <p className="text-xs mt-0.5 text-slate-500">{opt.desc}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 4: Data & Wipe */}
                    {currentStep === 4 && (
                        <div className="space-y-4 max-w-xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 4: Data Backup & Device Sanitization</h3>
                                <p className="text-xs text-slate-500">Ensure company confidential files are preserved and hardware is securely wiped</p>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100/50">
                                    <input
                                        type="checkbox"
                                        checked={dataBackedUp}
                                        onChange={e => setDataBackedUp(e.target.checked)}
                                        className="w-5 h-5 mt-0.5 rounded cursor-pointer text-red-600 focus:ring-red-500"
                                    />
                                    <div>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Employee Data Backed Up / Transferred</span>
                                        <p className="text-xs mt-0.5 text-slate-500">Important departmental documents, local downloads, and emails synced to OneDrive / Manager mailbox</p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100/50">
                                    <input
                                        type="checkbox"
                                        checked={deviceWiped}
                                        onChange={e => setDeviceWiped(e.target.checked)}
                                        className="w-5 h-5 mt-0.5 rounded cursor-pointer text-red-600 focus:ring-red-500"
                                    />
                                    <div>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Factory Reset & Data Sanitization Performed</span>
                                        <p className="text-xs mt-0.5 text-slate-500">Disk erased, user profiles removed, BitLocker reset, ready for next user</p>
                                    </div>
                                </label>

                                {deviceWiped && (
                                    <div className="p-3.5 rounded-xl border space-y-1.5 animate-in fade-in duration-150 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Sanitization Method / Remarks</label>
                                        <input aria-label="Sanitization Method / Remarks"
                                            type="text"
                                            value={wipeDetails}
                                            onChange={e => setWipeDetails(e.target.value)}
                                            placeholder="e.g. Windows Cloud Reset / Intune Remote Wipe / Fresh OS Install"
                                            className="w-full p-2.5 rounded-lg border text-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 5: License Revocation */}
                    {currentStep === 5 && (
                        <div className="space-y-4 max-w-xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 5: License Reclamation</h3>
                                <p className="text-xs text-slate-500">Release allocated software subscription seats back into the available pool</p>
                            </div>

                            {userLicenses.length === 0 ? (
                                <div className="p-6 rounded-xl text-center bg-slate-50 dark:bg-slate-800/40">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Active Subscriptions</p>
                                    <p className="text-xs mt-1 text-slate-500">This user does not hold any assigned licenses in Licenses & Subs.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer border-red-500 bg-red-50/40 dark:bg-red-950/30">
                                        <input
                                            type="checkbox"
                                            checked={revokeAllLicenses}
                                            onChange={e => setRevokeAllLicenses(e.target.checked)}
                                            className="w-5 h-5 mt-0.5 rounded text-red-600 focus:ring-red-500"
                                        />
                                        <div>
                                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Revoke All Assigned Licenses ({userLicenses.length})</span>
                                            <p className="text-xs mt-0.5 text-slate-500">Seats will be immediately released and made available for reallocation in Licenses & Subs.</p>
                                        </div>
                                    </label>

                                    <div className="space-y-1.5 pt-2">
                                        {userLicenses.map(l => (
                                            <div key={l.id} className="flex items-center justify-between p-2.5 rounded-lg border text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">{l.name}</span>
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                                    Will Release 1 Seat
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 6: Deactivation & Confirmation */}
                    {currentStep === 6 && (
                        <div className="space-y-4 max-w-xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 6: Account Deactivation & IT Sign-off</h3>
                                <p className="text-xs text-slate-500">Revoke access and finalize employee departure</p>
                            </div>

                            <div className="p-4 rounded-xl border space-y-2 bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Offboarding Action Summary</p>
                                <div className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                                    <p><strong>Employee:</strong> {selectedUser?.name} ({selectedUser?.email})</p>
                                    <p>
                                        <strong>Hardware Return:</strong> {activeAssetToReturn ? (
                                            <span className="font-semibold text-red-600 dark:text-red-400">
                                                {activeAssetToReturn.name} [{activeAssetToReturn.assetId}] → Status will become "{destinationStatus}" ({returnCondition})
                                            </span>
                                        ) : (
                                            <span className="italic text-slate-400">No device to return</span>
                                        )}
                                    </p>
                                    <p><strong>License Reclamation:</strong> {revokeAllLicenses && userLicenses.length > 0 ? `Revoke ${userLicenses.length} subscription license(s)` : 'Keep licenses'}</p>
                                    <p><strong>Sanitization:</strong> {deviceWiped ? `Device wiped (${wipeDetails})` : 'Not wiped'}</p>
                                    <p><strong>Account Status:</strong> {deactivateUser ? 'Mark employee Inactive in portal' : 'Leave active'}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                                    <input
                                        type="checkbox"
                                        checked={disableM365}
                                        onChange={e => setDisableM365(e.target.checked)}
                                        className="w-5 h-5 mt-0.5 rounded text-red-600 focus:ring-red-500"
                                    />
                                    <div>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Microsoft 365 Account Blocked / Disabled</span>
                                        <p className="text-xs mt-0.5 text-slate-500">Sign-in blocked in Entra ID and active browser / mobile app sessions revoked</p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                                    <input
                                        type="checkbox"
                                        checked={deactivateUser}
                                        onChange={e => setDeactivateUser(e.target.checked)}
                                        className="w-5 h-5 mt-0.5 rounded text-red-600 focus:ring-red-500"
                                    />
                                    <div>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Deactivate Portal Account (Status → Inactive)</span>
                                        <p className="text-xs mt-0.5 text-slate-500">User will no longer be able to log in to this IT Management Portal</p>
                                    </div>
                                </label>

                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-400">Final Offboarding Notes</label>
                                    <textarea aria-label="Final Offboarding Notes"
                                        rows={2}
                                        value={offboardingRemarks}
                                        onChange={e => setOffboardingRemarks(e.target.value)}
                                        placeholder="e.g. Employee last working day completed. All IT assets accounted for."
                                        className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-red-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={() => setCurrentStep(prev => Math.max(prev - 1, 1))}
                        disabled={currentStep === 1 || isSubmitting}
                        className="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        ← Back
                    </button>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                            Cancel
                        </button>

                        {currentStep < STEPS.length ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={isSubmitting}
                                className="px-6 py-2 rounded-xl text-sm font-semibold shadow-md transition-all flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white shadow-red-500/20"
                            >
                                Next Step →
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleFinalSubmit}
                                disabled={isSubmitting}
                                className="px-6 py-2 rounded-xl text-sm font-semibold shadow-md transition-all flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white shadow-red-500/20"
                            >
                                {isSubmitting ? 'Processing...' : '✓ Complete Offboarding & Deactivate'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OffboardingWizardModal;
