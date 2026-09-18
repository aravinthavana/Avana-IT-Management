import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { User, Asset, License, DispatchDetails } from '../../types';
import { ICONS, ASSET_ICONS } from '../../constants';

interface OnboardingWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialUser?: User | null;
    onSuccess?: (user: User) => void;
}

const STEPS = [
    { id: 1, name: 'Employee', desc: 'Account Details' },
    { id: 2, name: 'M365 & License', desc: 'Account & Subs' },
    { id: 3, name: 'Hardware', desc: 'Asset Assignment' },
    { id: 4, name: 'Software', desc: 'App Configuration' },
    { id: 5, name: 'QA Testing', desc: 'Diagnostic Check' },
    { id: 6, name: 'Logistics', desc: 'Dispatch & Docket' },
    { id: 7, name: 'Credentials', desc: 'Access Handover' },
    { id: 8, name: 'Review', desc: 'Confirmation' },
];

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({ isOpen, onClose, initialUser, onSuccess }) => {
    const { users, setUsers, assets, setAssets, departments, branches, licenses, setLicenses, getHeaders, setNotification, fetchAssetHistory, fetchAllData } = useAppContext();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Step 1: User Profile
    const [selectedUserId, setSelectedUserId] = useState<number | 'new'>(initialUser ? initialUser.id : 'new');
    const [userData, setUserData] = useState({
        name: '',
        email: '',
        mobile: '',
        employeeId: '',
        company: 'Avana Medical Devices Pvt Ltd',
        departmentId: '' as string | number,
        branchId: '' as string | number,
        jobTitle: '',
        location: '',
        accountType: 'Employee',
        role: 'User' as 'User' | 'Manager' | 'Admin',
    });

    // Step 2: M365 & License (support multiple licenses)
    const [m365AccountCreated, setM365AccountCreated] = useState(false);
    const [licenseOption, setLicenseOption] = useState<'assign' | 'skip'>('skip');
    const [selectedLicenseIds, setSelectedLicenseIds] = useState<number[]>([]);

    // Step 3: Hardware Assignment
    const [assetOption, setAssetOption] = useState<'assign' | 'skip'>('skip');
    const [selectedAssetId, setSelectedAssetId] = useState<number | ''>('');
    const [assetCondition, setAssetCondition] = useState<string>('Good');

    // Step 4: Software Configuration (only the 4 office-standard checks)
    const [softwareChecks, setSoftwareChecks] = useState({
        osConfigured: false,
        m365Apps: false,
        necessaryApps: false,
        driversInstalled: false,
        notApplicable: false,
    });

    // Step 5: QA Testing
    const [qaChecks, setQaChecks] = useState({
        display: false,
        keyboard: false,
        battery: false,
        cameraMic: false,
        network: false,
        notApplicable: false,
    });

    // Step 6: Logistics & Dispatch (Courier or In-Person, with DC No)
    const [dispatchMode, setDispatchMode] = useState<'Courier' | 'In-Person'>('Courier');
    const [dcNumber, setDcNumber] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');
    const [courierName, setCourierName] = useState('Blue Dart');
    const [docketNumber, setDocketNumber] = useState('');
    const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [inPersonBranch, setInPersonBranch] = useState('');
    const [dispatchRemarks, setDispatchRemarks] = useState('');

    // Step 7: Credential Sharing
    const [credentialsChecks, setCredentialsChecks] = useState({
        m365CredsShared: false,
        laptopCredsShared: false,
        policyCommunicated: false,
    });

    // Helper to populate wizard state from a user record
    const loadUserData = (targetUser: User) => {
        setSelectedUserId(targetUser.id);
        setUserData({
            name: targetUser.name,
            email: targetUser.email,
            mobile: targetUser.mobile || '',
            employeeId: targetUser.employeeId || '',
            company: targetUser.company || 'Avana Medical Devices Pvt Ltd',
            departmentId: targetUser.departmentId || '',
            branchId: targetUser.branchId || '',
            jobTitle: targetUser.jobTitle || '',
            location: targetUser.location || '',
            accountType: targetUser.accountType || 'Employee',
            role: targetUser.role || 'User',
        });
        setM365AccountCreated(Boolean(targetUser.m365AccountCreated));

        // Find assigned licenses
        const userLicenses = licenses.filter(l => l.assignments?.some(a => a.userId === targetUser.id));
        if (userLicenses.length > 0) {
            setLicenseOption('assign');
            setSelectedLicenseIds(userLicenses.map(l => l.id));
        } else {
            setLicenseOption(targetUser.m365LicenseAssigned ? 'assign' : 'skip');
            setSelectedLicenseIds([]);
        }

        // Find assigned asset
        const userAsset = assets.find(a =>
            (a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === targetUser.id) ||
            a.assignedTo === targetUser.id ||
            a.userId === targetUser.id
        );
        if (userAsset) {
            setAssetOption('assign');
            setSelectedAssetId(userAsset.id);
        } else if (targetUser.laptopStatus === 'Uses Own Laptop' || targetUser.laptopStatus === 'Using own laptop' || targetUser.laptopStatus === 'No Device Assigned') {
            setAssetOption('skip');
            setSelectedAssetId('');
        }

        // Software and QA checks
        if (targetUser.softwareInstalled) {
            setSoftwareChecks({
                osConfigured: true,
                m365Apps: true,
                necessaryApps: true,
                driversInstalled: true,
                notApplicable: false
            });
        }
        if (targetUser.hardwareTested) {
            setQaChecks({
                display: true,
                keyboard: true,
                battery: true,
                cameraMic: true,
                network: true,
                notApplicable: false
            });
        }
        if (targetUser.credentialsHandedOver) {
            setCredentialsChecks({
                m365CredsShared: true,
                laptopCredsShared: true,
                policyCommunicated: true
            });
        }

        // Dispatch details
        if (targetUser.dispatchDetails) {
            try {
                const parsed = typeof targetUser.dispatchDetails === 'string'
                    ? JSON.parse(targetUser.dispatchDetails)
                    : targetUser.dispatchDetails;
                if (parsed.mode === 'In-Person') setDispatchMode('In-Person');
                else setDispatchMode('Courier');
                if (parsed.dcNumber) setDcNumber(parsed.dcNumber);
                if (parsed.shippingAddress) setShippingAddress(parsed.shippingAddress);
                if (parsed.courierName) setCourierName(parsed.courierName);
                if (parsed.docketNumber) setDocketNumber(parsed.docketNumber);
                if (parsed.dispatchDate) setDispatchDate(parsed.dispatchDate);
                if (parsed.officeLocation) setInPersonBranch(parsed.officeLocation);
                if (parsed.remarks) setDispatchRemarks(parsed.remarks);
            } catch {}
        }

        if (targetUser.onboardingStep && targetUser.onboardingStep > 1 && targetUser.onboardingStatus !== 'Completed') {
            setCurrentStep(targetUser.onboardingStep);
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (initialUser) {
                loadUserData(initialUser);
            } else {
                setSelectedUserId('new');
                setCurrentStep(1);
                setUserData({
                    name: '', email: '', mobile: '', employeeId: '',
                    company: 'Avana Medical Devices Pvt Ltd',
                    departmentId: '', branchId: '', jobTitle: '',
                    location: '', accountType: 'Employee', role: 'User'
                });
                setM365AccountCreated(false);
                setLicenseOption('skip');
                setSelectedLicenseIds([]);
                setAssetOption('skip');
                setSelectedAssetId('');
                setSoftwareChecks({ osConfigured: false, m365Apps: false, necessaryApps: false, driversInstalled: false, notApplicable: false });
                setQaChecks({ display: false, keyboard: false, battery: false, cameraMic: false, network: false, notApplicable: false });
                setDispatchMode('Courier');
                setDcNumber('');
                setShippingAddress('');
                setCourierName('Blue Dart');
                setDocketNumber('');
                setInPersonBranch('');
                setDispatchRemarks('');
                setCredentialsChecks({ m365CredsShared: false, laptopCredsShared: false, policyCommunicated: false });
            }
        }
    }, [isOpen, initialUser]);

    if (!isOpen) return null;

    const inStockAssets = assets.filter(a => a.status === 'In Stock');

    const handleCreateOrSelectUser = async (): Promise<User | null> => {
        if (selectedUserId !== 'new') {
            const existing = users.find(u => u.id === selectedUserId);
            return existing || null;
        }

        if (!userData.name.trim() || !userData.email.trim()) {
            setNotification({ message: 'Please enter employee name and email.', type: 'error' });
            return null;
        }

        try {
            const res = await fetch(`${API_URL}/api/users`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    ...userData,
                    departmentId: userData.departmentId ? Number(userData.departmentId) : null,
                    branchId: userData.branchId ? Number(userData.branchId) : null,
                    onboardingStatus: 'In Progress',
                    onboardingStep: 2,
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to create user account');
            }

            const newUser = await res.json();
            setUsers([...users, newUser]);
            setSelectedUserId(newUser.id);
            return newUser;
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
            return null;
        }
    };

    const handleNext = async () => {
        if (currentStep === 1) {
            setIsSubmitting(true);
            const user = await handleCreateOrSelectUser();
            setIsSubmitting(false);
            if (!user) return;
        }
        setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    };

    const handleSaveProgress = async (status: 'In Progress' | 'Completed' = 'In Progress') => {
        setIsSubmitting(true);
        try {
            let activeUser: User | null = null;
            if (selectedUserId === 'new') {
                activeUser = await handleCreateOrSelectUser();
            } else {
                activeUser = users.find(u => u.id === selectedUserId) || null;
            }

            if (!activeUser) {
                return;
            }

            // Dispatch payload
            const hasDispatchData = dispatchMode === 'Courier'
                ? Boolean(shippingAddress.trim() || courierName.trim() || docketNumber.trim() || dcNumber.trim())
                : Boolean(inPersonBranch.trim() || dcNumber.trim());

            let dispatchPayload: DispatchDetails | null = null;
            if (hasDispatchData) {
                dispatchPayload = {
                    mode: dispatchMode,
                    dcNumber: dcNumber.trim() || undefined,
                    shippingAddress: dispatchMode === 'Courier' ? shippingAddress.trim() : undefined,
                    courierName: dispatchMode === 'Courier' ? courierName.trim() : undefined,
                    docketNumber: dispatchMode === 'Courier' ? docketNumber.trim() : undefined,
                    dispatchDate: dispatchDate || undefined,
                    officeLocation: dispatchMode === 'In-Person' ? inPersonBranch.trim() : undefined,
                    remarks: dispatchRemarks.trim() || undefined,
                    isDispatched: Boolean(docketNumber.trim() || (dispatchMode === 'In-Person' && inPersonBranch.trim()))
                };
            } else if (activeUser.dispatchDetails) {
                try {
                    dispatchPayload = typeof activeUser.dispatchDetails === 'string'
                        ? JSON.parse(activeUser.dispatchDetails)
                        : activeUser.dispatchDetails;
                } catch {
                    dispatchPayload = null;
                }
            }

            const softwareAllDone = softwareChecks.notApplicable || (
                softwareChecks.osConfigured && 
                softwareChecks.m365Apps && 
                softwareChecks.necessaryApps && 
                softwareChecks.driversInstalled
            );
            const qaAllDone = qaChecks.notApplicable || (
                qaChecks.display && 
                qaChecks.keyboard && 
                qaChecks.battery && 
                qaChecks.cameraMic && 
                qaChecks.network
            );
            const credsHandedOver = credentialsChecks.m365CredsShared || credentialsChecks.laptopCredsShared;

            const res = await fetch(`${API_URL}/api/onboarding/complete`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    userId: activeUser.id,
                    m365AccountCreated,
                    assignLicenseIds: licenseOption === 'assign' ? selectedLicenseIds : [],
                    assignAssetId: assetOption === 'assign' && selectedAssetId ? Number(selectedAssetId) : undefined,
                    assetCondition,
                    softwareInstalled: softwareAllDone,
                    hardwareTested: qaAllDone,
                    dispatchDetails: dispatchPayload,
                    credentialsHandedOver: credsHandedOver,
                    onboardingStatus: status,
                    onboardingStep: currentStep,
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to save onboarding progress');
            }

            const updatedUser = await res.json();
            setUsers(users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));

            // If asset was assigned, update local asset list
            if (assetOption === 'assign' && selectedAssetId) {
                setAssets(assets.map(a => a.id === Number(selectedAssetId) ? {
                    ...a,
                    status: 'Pending Handover',
                    userId: updatedUser.id,
                    assigneeId: updatedUser.id,
                    assigneeType: 'User'
                } : a));
                fetchAssetHistory();
            }

            // Synchronize licenses local state
            const effectiveLicenseIds = licenseOption === 'assign' ? selectedLicenseIds : [];
            setLicenses(licenses.map(l => {
                const isSelected = effectiveLicenseIds.includes(l.id);
                const isAssigned = l.assignments?.some(a => a.userId === updatedUser.id);

                if (isSelected && !isAssigned) {
                    return {
                        ...l,
                        assignedSeats: (l.assignedSeats || 0) + 1,
                        assignments: [...(l.assignments || []), { id: Date.now() + l.id, licenseId: l.id, userId: updatedUser.id, assignedDate: new Date().toISOString() }]
                    };
                } else if (!isSelected && isAssigned) {
                    const filtered = l.assignments?.filter(a => a.userId !== updatedUser.id) || [];
                    return {
                        ...l,
                        assignedSeats: Math.max(0, (l.assignedSeats || 1) - 1),
                        assignments: filtered
                    };
                }
                return l;
            }));

            if (status === 'Completed') {
                setNotification({ message: `Onboarding completed successfully for ${updatedUser.name}!`, type: 'success' });
            } else {
                setNotification({ message: `Onboarding progress saved for ${updatedUser.name}! You can resume anytime from the dashboard.`, type: 'success' });
            }
            if (fetchAllData) fetchAllData();
            if (onSuccess) onSuccess(updatedUser);
            onClose();
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-brand-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            {ICONS.onboarding}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">New Employee Onboarding Wizard</h2>
                            <p className="text-xs text-white/80">Step-by-step IT operations & equipment allocation</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                        {ICONS.close}
                    </button>
                </div>

                {/* Stepper Progress Header */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 px-6 py-3 shrink-0 overflow-x-auto">
                    <div className="flex items-center justify-between min-w-[620px]">
                        {STEPS.map((step, idx) => {
                            const isDone = currentStep > step.id;
                            const isCurrent = currentStep === step.id;
                            const canJump = selectedUserId !== 'new' || step.id <= currentStep;
                            return (
                                <React.Fragment key={step.id}>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (canJump) setCurrentStep(step.id);
                                        }}
                                        disabled={!canJump}
                                        className={`flex items-center gap-2 text-left group transition-all ${
                                            isCurrent ? 'text-brand-600 dark:text-brand-400 font-semibold' : 
                                            isDone ? 'text-emerald-600 dark:text-emerald-400 cursor-pointer' : 
                                            canJump ? 'text-slate-600 dark:text-slate-400 hover:text-brand-600 cursor-pointer' : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                        }`}
                                    >
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                            isCurrent ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-200 dark:ring-brand-900' :
                                            isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                        }`}>
                                            {isDone ? '✓' : step.id}
                                        </div>
                                        <div className="hidden sm:block">
                                            <p className="text-xs leading-none font-medium">{step.name}</p>
                                            <p className="text-[10px] text-slate-400 leading-tight">{step.desc}</p>
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
                    
                    {/* STEP 1: Employee Selection / Creation */}
                    {currentStep === 1 && (
                        <div className="space-y-4 max-w-2xl mx-auto">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 1: Employee Information</h3>
                                    <p className="text-xs text-slate-500">Select an existing pending employee or create a new user profile</p>
                                </div>
                                {!initialUser && (
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedUserId('new')}
                                            className={`px-3 py-1.5 rounded-md font-medium transition-all ${selectedUserId === 'new' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            + New User
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (users.length > 0) {
                                                    loadUserData(users[0]);
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-md font-medium transition-all ${selectedUserId !== 'new' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            Select Existing
                                        </button>
                                    </div>
                                )}
                            </div>

                            {selectedUserId !== 'new' && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Select Existing User</label>
                                    <select
                                        value={selectedUserId}
                                        onChange={(e) => {
                                            const uId = Number(e.target.value);
                                            const found = users.find(u => u.id === uId);
                                            if (found) {
                                                loadUserData(found);
                                            }
                                        }}
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                    >
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.email}) - {u.department?.name || 'No Dept'} [{u.onboardingStatus || 'Pending'}]
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={userData.name}
                                        onChange={e => setUserData({ ...userData, name: e.target.value })}
                                        placeholder="e.g. Rahul Sharma"
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Company Email *</label>
                                    <input
                                        type="email"
                                        required
                                        value={userData.email}
                                        onChange={e => setUserData({ ...userData, email: e.target.value })}
                                        placeholder="e.g. rahul@avanamedical.com"
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Employee ID</label>
                                    <input
                                        type="text"
                                        value={userData.employeeId}
                                        onChange={e => setUserData({ ...userData, employeeId: e.target.value })}
                                        placeholder="e.g. AMD-0142"
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Mobile Number</label>
                                    <input
                                        type="text"
                                        value={userData.mobile}
                                        onChange={e => setUserData({ ...userData, mobile: e.target.value })}
                                        placeholder="e.g. +91 98765 43210"
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Department</label>
                                    <select
                                        value={userData.departmentId}
                                        onChange={e => setUserData({ ...userData, departmentId: e.target.value })}
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Office Branch</label>
                                    <select
                                        value={userData.branchId}
                                        onChange={e => setUserData({ ...userData, branchId: e.target.value })}
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                    >
                                        <option value="">Select Branch</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name} {b.location ? `(${b.location})` : ''}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Designation / Job Title</label>
                                    <input
                                        type="text"
                                        value={userData.jobTitle}
                                        onChange={e => setUserData({ ...userData, jobTitle: e.target.value })}
                                        placeholder="e.g. Biomedical Engineer"
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Work Location</label>
                                    <input
                                        type="text"
                                        value={userData.location}
                                        onChange={e => setUserData({ ...userData, location: e.target.value })}
                                        placeholder="e.g. Chennai HQ, Remote, Pune"
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: M365 Account & Multiple Licenses */}
                    {currentStep === 2 && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 2: Microsoft 365 Account & Licenses</h3>
                                <p className="text-xs text-slate-500">Configure Microsoft 365 cloud credentials and software subscriptions</p>
                            </div>

                            {/* M365 Account Created Checkbox */}
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:border-brand-300 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={m365AccountCreated}
                                    onChange={e => setM365AccountCreated(e.target.checked)}
                                    className="w-5 h-5 mt-0.5 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                                />
                                <div>
                                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Microsoft 365 Account Provisioned</span>
                                    <p className="text-xs text-slate-500 mt-0.5">User account created in Microsoft 365 Admin Portal / Entra ID ({userData.email})</p>
                                </div>
                            </label>

                            {/* License Option Radio */}
                            <div className="space-y-3">
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Subscription / License Allocation</label>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div 
                                        onClick={() => setLicenseOption('assign')}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${licenseOption === 'assign' ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30 dark:border-brand-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                                    >
                                        <div className="flex items-center gap-2 font-semibold text-sm">
                                            <input type="radio" name="licenseOpt" checked={licenseOption === 'assign'} onChange={() => setLicenseOption('assign')} className="text-brand-600" />
                                            <span>Assign Licenses</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 pl-5">Select one or more software subscriptions (e.g. M365 + others)</p>
                                    </div>

                                    <div 
                                        onClick={() => setLicenseOption('skip')}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${licenseOption === 'skip' ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30 dark:border-brand-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                                    >
                                        <div className="flex items-center gap-2 font-semibold text-sm">
                                            <input type="radio" name="licenseOpt" checked={licenseOption === 'skip'} onChange={() => setLicenseOption('skip')} className="text-brand-600" />
                                            <span>No License Required</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 pl-5">Skip license allocation (e.g. frontline worker, external user)</p>
                                    </div>
                                </div>

                                {licenseOption === 'assign' && (
                                    <div className="mt-4 p-4 rounded-xl border border-brand-200 dark:border-brand-900 bg-brand-50/30 dark:bg-brand-950/20 space-y-3 animate-in fade-in duration-150">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Available Licenses ({selectedLicenseIds.length} selected)
                                            </label>
                                            <span className="text-[11px] text-slate-500">Multiple licenses can be selected</span>
                                        </div>

                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                            {licenses.map(l => {
                                                const assigned = l.assignments?.length || 0;
                                                const available = l.seats - assigned;
                                                const isAlreadyAssigned = selectedUserId !== 'new' && l.assignments?.some(a => a.userId === selectedUserId);
                                                const isChecked = selectedLicenseIds.includes(l.id);
                                                const isAvailable = available > 0 || isAlreadyAssigned;

                                                return (
                                                    <label 
                                                        key={l.id} 
                                                        className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                                                            isChecked 
                                                                ? 'bg-brand-50/80 dark:bg-brand-900/30 border-brand-500 text-brand-900 dark:text-brand-200 font-semibold' 
                                                                : isAvailable 
                                                                    ? 'border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300' 
                                                                    : 'opacity-50 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                disabled={!isAvailable && !isChecked}
                                                                onChange={e => {
                                                                    if (e.target.checked) {
                                                                        setSelectedLicenseIds(prev => [...prev, l.id]);
                                                                    } else {
                                                                        setSelectedLicenseIds(prev => prev.filter(id => id !== l.id));
                                                                    }
                                                                }}
                                                                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                                            />
                                                            <div>
                                                                <p className="font-semibold">{l.name}</p>
                                                                <p className="text-[10px] text-slate-500 font-normal">{l.category} {l.vendor ? `• ${l.vendor}` : ''}</p>
                                                            </div>
                                                        </div>

                                                        <div className="text-right">
                                                            {isAlreadyAssigned ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                                    ✓ Assigned
                                                                </span>
                                                            ) : available > 0 ? (
                                                                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                                                    {available} / {l.seats} available
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-red-500 font-bold">
                                                                    0 seats left
                                                                </span>
                                                            )}
                                                        </div>
                                                    </label>
                                                );
                                            })}

                                            {licenses.length === 0 && (
                                                <p className="text-xs text-amber-600 dark:text-amber-400">No licenses found in inventory. You can add licenses in Licenses & Subs.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Hardware Allocation */}
                    {currentStep === 3 && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 3: Company Hardware / Asset Allocation</h3>
                                <p className="text-xs text-slate-500">Allocate an available device or mark employee as BYOD / Uses own laptop</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div 
                                    onClick={() => setAssetOption('assign')}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${assetOption === 'assign' ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30 dark:border-brand-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center gap-2 font-semibold text-sm">
                                        <input type="radio" name="assetOpt" checked={assetOption === 'assign'} onChange={() => setAssetOption('assign')} className="text-brand-600" />
                                        <span>Assign Company Device</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 pl-5">Select a laptop or equipment from in-stock assets</p>
                                </div>

                                <div 
                                    onClick={() => setAssetOption('skip')}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${assetOption === 'skip' ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30 dark:border-brand-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center gap-2 font-semibold text-sm">
                                        <input type="radio" name="assetOpt" checked={assetOption === 'skip'} onChange={() => setAssetOption('skip')} className="text-brand-600" />
                                        <span>No Device / Uses Own Laptop</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 pl-5">Skip device allocation (BYOD, remote or desk phone only)</p>
                                </div>
                            </div>

                            {assetOption === 'assign' && (
                                <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-900 bg-brand-50/30 dark:bg-brand-950/20 space-y-4 animate-in fade-in duration-150">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Select In-Stock Asset *</label>
                                        <select
                                            value={selectedAssetId}
                                            onChange={e => setSelectedAssetId(Number(e.target.value))}
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                        >
                                            <option value="">-- Choose Asset from In Stock ({inStockAssets.length} available) --</option>
                                            {inStockAssets.map(a => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name} [{a.assetId}] - {a.brand || ''} {a.model || ''} (S/N: {a.serialNumber || 'N/A'}) - {a.category}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Condition at Handover *</label>
                                        <select
                                            value={assetCondition}
                                            onChange={e => setAssetCondition(e.target.value)}
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                        >
                                            <option value="New">Brand New (Sealed / Fresh out of box)</option>
                                            <option value="Excellent">Excellent (Flawless / Like new)</option>
                                            <option value="Good">Good (Minor cosmetic wear, 100% operational)</option>
                                            <option value="Fair">Fair (Noticeable cosmetic marks, fully functional)</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 4: Software Configuration (Exact Office Standards) */}
                    {currentStep === 4 && (
                        <div className="space-y-4 max-w-2xl mx-auto">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 4: Software & Application Configuration</h3>
                                    <p className="text-xs text-slate-500">Verify company software setup, drivers, and standard application stack</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSoftwareChecks({
                                        osConfigured: true,
                                        m365Apps: true,
                                        necessaryApps: true,
                                        driversInstalled: true,
                                        notApplicable: false,
                                    })}
                                    className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                                >
                                    Mark All Done
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                {[
                                    { key: 'osConfigured', title: 'Operating System Setup', desc: 'Operating system clean install / setup, updated to latest version, and initial user account configured' },
                                    { key: 'm365Apps', title: 'M365 Apps Setup', desc: 'Outlook, Microsoft Teams, OneDrive, Word, Excel, and Office suite configured with employee credentials' },
                                    { key: 'necessaryApps', title: 'Necessary Applications Installation', desc: 'Essential company applications, tools, web browsers (Chrome/Edge), and PDF viewer installed' },
                                    { key: 'driversInstalled', title: 'Drivers Installation', desc: 'Latest OEM chipset, display, audio, Wi-Fi, Ethernet, and peripheral drivers installed and verified' },
                                ].map(item => (
                                    <label key={item.key} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={(softwareChecks as any)[item.key]}
                                            disabled={softwareChecks.notApplicable}
                                            onChange={e => setSoftwareChecks({ ...softwareChecks, [item.key]: e.target.checked, notApplicable: false })}
                                            className="w-4 h-4 mt-0.5 text-brand-600 rounded focus:ring-brand-500"
                                        />
                                        <div>
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.title}</span>
                                            <p className="text-xs text-slate-500">{item.desc}</p>
                                        </div>
                                    </label>
                                ))}

                                <label className="flex items-center gap-2 pt-2 text-xs text-slate-500 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={softwareChecks.notApplicable}
                                        onChange={e => setSoftwareChecks({
                                            osConfigured: false,
                                            m365Apps: false,
                                            necessaryApps: false,
                                            driversInstalled: false,
                                            notApplicable: e.target.checked,
                                        })}
                                        className="rounded text-brand-600"
                                    />
                                    <span>Not Applicable (No company hardware issued for this employee)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: QA Testing & Diagnostics */}
                    {currentStep === 5 && (
                        <div className="space-y-4 max-w-2xl mx-auto">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 5: QA Testing & Hardware Diagnostics</h3>
                                    <p className="text-xs text-slate-500">Ensure the device is fully tested and 100% operational before handover</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setQaChecks({
                                        display: true,
                                        keyboard: true,
                                        battery: true,
                                        cameraMic: true,
                                        network: true,
                                        notApplicable: false,
                                    })}
                                    className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                                >
                                    Mark All Tested
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                {[
                                    { key: 'display', title: 'Display & Visual Inspection', desc: 'Screen clear of scratches/dead pixels, brightness controls and hinges smooth' },
                                    { key: 'keyboard', title: 'Keyboard, Trackpad & Ports', desc: 'All keys responsive, trackpad gesture working, USB/HDMI/audio ports functional' },
                                    { key: 'battery', title: 'Battery Health & OEM Charger', desc: 'Holds charge reliably, authentic adapter/power cable included and tested' },
                                    { key: 'cameraMic', title: 'Webcam, Microphone & Speakers', desc: 'Teams call test passed, microphone clear, webcam privacy shutter verified' },
                                    { key: 'network', title: 'Wi-Fi & Bluetooth Connectivity', desc: 'Connects to company Wi-Fi network and Bluetooth peripherals seamlessly' },
                                ].map(item => (
                                    <label key={item.key} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={(qaChecks as any)[item.key]}
                                            disabled={qaChecks.notApplicable}
                                            onChange={e => setQaChecks({ ...qaChecks, [item.key]: e.target.checked, notApplicable: false })}
                                            className="w-4 h-4 mt-0.5 text-brand-600 rounded focus:ring-brand-500"
                                        />
                                        <div>
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.title}</span>
                                            <p className="text-xs text-slate-500">{item.desc}</p>
                                        </div>
                                    </label>
                                ))}

                                <label className="flex items-center gap-2 pt-2 text-xs text-slate-500 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={qaChecks.notApplicable}
                                        onChange={e => setQaChecks({
                                            display: false,
                                            keyboard: false,
                                            battery: false,
                                            cameraMic: false,
                                            network: false,
                                            notApplicable: e.target.checked,
                                        })}
                                        className="rounded text-brand-600"
                                    />
                                    <span>Not Applicable (No hardware allocated)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* STEP 6: Logistics & Dispatch (Courier or In-Person, with DC No) */}
                    {currentStep === 6 && (
                        <div className="space-y-4 max-w-2xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 6: Handover / Dispatch Logistics</h3>
                                <p className="text-xs text-slate-500">Record courier dispatch details, Delivery Challan (DC) number, or in-person handover desk</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'Courier', title: 'Courier Dispatch', desc: 'Ship equipment via courier to employee location', icon: ICONS.truck },
                                    { id: 'In-Person', title: 'In-Person Handover', desc: 'Direct equipment handover at office premises', icon: ICONS.users },
                                ].map(mode => (
                                    <button
                                        type="button"
                                        key={mode.id}
                                        onClick={() => setDispatchMode(mode.id as any)}
                                        className={`p-3.5 rounded-xl border-2 flex items-center gap-3 text-left transition-all ${
                                            dispatchMode === mode.id 
                                                ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 font-semibold' 
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm shrink-0">
                                            {mode.icon}
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold block">{mode.title}</span>
                                            <span className="text-[10px] text-slate-400 block">{mode.desc}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {dispatchMode === 'Courier' && (
                                <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 animate-in fade-in duration-150">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Dispatched Shipping Address</label>
                                        <textarea
                                            rows={2}
                                            value={shippingAddress}
                                            onChange={e => setShippingAddress(e.target.value)}
                                            placeholder="Employee residential / field delivery address with pincode..."
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Delivery Challan (DC) No</label>
                                            <input
                                                type="text"
                                                value={dcNumber}
                                                onChange={e => setDcNumber(e.target.value)}
                                                placeholder="e.g. DC-2024-0012"
                                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500 font-mono"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Courier / Carrier Name</label>
                                            <input
                                                type="text"
                                                value={courierName}
                                                onChange={e => setCourierName(e.target.value)}
                                                placeholder="e.g. Blue Dart, DTDC, DHL, FedEx, Delhivery"
                                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Docket / AWB Tracking Number</label>
                                            <input
                                                type="text"
                                                value={docketNumber}
                                                onChange={e => setDocketNumber(e.target.value)}
                                                placeholder="e.g. BD-893471092"
                                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500 font-mono"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Dispatch Date</label>
                                            <input
                                                type="date"
                                                value={dispatchDate}
                                                onChange={e => setDispatchDate(e.target.value)}
                                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {dispatchMode === 'In-Person' && (
                                <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 animate-in fade-in duration-150">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Handover Branch / Desk Location</label>
                                            <input
                                                type="text"
                                                value={inPersonBranch}
                                                onChange={e => setInPersonBranch(e.target.value)}
                                                placeholder="e.g. Chennai Office, IT Support Desk Floor 3"
                                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Delivery Challan (DC) No (Optional)</label>
                                            <input
                                                type="text"
                                                value={dcNumber}
                                                onChange={e => setDcNumber(e.target.value)}
                                                placeholder="e.g. DC-2024-0012"
                                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500 font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Dispatch & Handover Remarks (Optional)</label>
                                <input
                                    type="text"
                                    value={dispatchRemarks}
                                    onChange={e => setDispatchRemarks(e.target.value)}
                                    placeholder="e.g. Laptop bag, wireless mouse, and original adapter included."
                                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 7: Credential Sharing */}
                    {currentStep === 7 && (
                        <div className="space-y-4 max-w-2xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 7: Credentials & Security Handover</h3>
                                <p className="text-xs text-slate-500">Verify temporary login passwords and IT policies have been handed over</p>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={credentialsChecks.m365CredsShared}
                                        onChange={e => setCredentialsChecks({ ...credentialsChecks, m365CredsShared: e.target.checked })}
                                        className="w-5 h-5 mt-0.5 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                                    />
                                    <div>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">M365 Temporary Password Shared</span>
                                        <p className="text-xs text-slate-500 mt-0.5">Initial password and login portal link provided via secure channel (SMS/WhatsApp/Personal Email)</p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={credentialsChecks.laptopCredsShared}
                                        onChange={e => setCredentialsChecks({ ...credentialsChecks, laptopCredsShared: e.target.checked })}
                                        className="w-5 h-5 mt-0.5 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                                    />
                                    <div>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Laptop / Device Login PIN Provided</span>
                                        <p className="text-xs text-slate-500 mt-0.5">Local Windows/Mac login PIN and BitLocker guidance shared with the user</p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={credentialsChecks.policyCommunicated}
                                        onChange={e => setCredentialsChecks({ ...credentialsChecks, policyCommunicated: e.target.checked })}
                                        className="w-5 h-5 mt-0.5 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                                    />
                                    <div>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">IT Acceptable Use Policy Communicated</span>
                                        <p className="text-xs text-slate-500 mt-0.5">Employee informed of security protocols, laptop declaration, and data safety expectations</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* STEP 8: Review & Confirm */}
                    {currentStep === 8 && (
                        <div className="space-y-5 max-w-2xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 8: Final Review & Confirmation</h3>
                                <p className="text-xs text-slate-500">Verify the onboarding setup below. You can save as In Progress or mark 100% complete.</p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-500">Employee:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">{userData.name} ({userData.email})</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-500">Microsoft 365:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {m365AccountCreated ? '✓ Account Created' : 'Not Set'} | {licenseOption === 'assign' && selectedLicenseIds.length > 0 
                                            ? `${selectedLicenseIds.length} License(s) Assigned (${selectedLicenseIds.map(id => licenses.find(l => l.id === id)?.name).filter(Boolean).join(', ')})` 
                                            : 'No License Needed'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-500">Assigned Hardware:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {assetOption === 'assign' && selectedAssetId 
                                            ? `${assets.find(a => a.id === selectedAssetId)?.name} (Condition: ${assetCondition})`
                                            : 'No Device (Uses Own Laptop / Not Needed)'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-500">Software & QA:</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        {softwareChecks.notApplicable ? 'Hardware N/A' : (softwareChecks.osConfigured && softwareChecks.m365Apps ? '✓ Configured & Tested' : 'Partial / In Progress')}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-500">Dispatch / Logistics:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {dispatchMode === 'Courier' 
                                            ? `Courier: ${courierName}${dcNumber ? ` (DC: ${dcNumber})` : ''}${docketNumber ? ` (Docket: ${docketNumber})` : ''}`
                                            : `In-Person Handover (${inPersonBranch || 'Office'})${dcNumber ? ` (DC: ${dcNumber})` : ''}`}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-slate-500">Credentials Handover:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {credentialsChecks.m365CredsShared ? '✓ Credentials Shared' : 'Pending Share'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">Pending dispatch or later handover?</p>
                                    <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                                        If dispatch or credentials handover will be completed later, you can save your progress as <strong>"In Progress"</strong>.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleSaveProgress('In Progress')}
                                    disabled={isSubmitting}
                                    className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors shadow-sm"
                                >
                                    💾 Save as In Progress
                                </button>
                            </div>

                            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
                                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                                    Clicking <strong>"Complete Onboarding & Handover"</strong> will mark onboarding 100% complete and update the employee's onboarding status to Completed.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={() => setCurrentStep(prev => Math.max(prev - 1, 1))}
                        disabled={currentStep === 1 || isSubmitting}
                        className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        ← Back
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSaveProgress('In Progress')}
                            disabled={isSubmitting || (selectedUserId === 'new' && (!userData.name.trim() || !userData.email.trim()))}
                            className="px-4 py-2 rounded-xl text-sm font-semibold border border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Save all changes so far and continue later"
                        >
                            <span>💾</span> Save & Continue Later
                        </button>

                        {currentStep < STEPS.length ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={isSubmitting}
                                className="px-6 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 transition-all flex items-center gap-1.5"
                            >
                                {isSubmitting ? 'Saving...' : 'Next Step →'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleSaveProgress('Completed')}
                                disabled={isSubmitting}
                                className="px-6 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                            >
                                {isSubmitting ? 'Finalizing...' : '✓ Complete Onboarding & Handover'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizardModal;
