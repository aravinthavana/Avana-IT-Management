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
    const { users, setUsers, assets, setAssets, departments, branches, licenses, setLicenses, getHeaders, setNotification, fetchAssetHistory } = useAppContext();
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

    // Step 2: M365 & License
    const [m365AccountCreated, setM365AccountCreated] = useState(false);
    const [licenseOption, setLicenseOption] = useState<'assign' | 'skip'>('skip');
    const [selectedLicenseId, setSelectedLicenseId] = useState<number | ''>('');

    // Step 3: Hardware Assignment
    const [assetOption, setAssetOption] = useState<'assign' | 'skip'>('skip');
    const [selectedAssetId, setSelectedAssetId] = useState<number | ''>('');
    const [assetCondition, setAssetCondition] = useState<string>('Good');

    // Step 4: Software Configuration
    const [softwareChecks, setSoftwareChecks] = useState({
        osConfigured: false,
        m365Apps: false,
        antivirus: false,
        vpnTools: false,
        diskEncryption: false,
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

    // Step 6: Logistics & Dispatch
    const [dispatchMode, setDispatchMode] = useState<'Courier' | 'In-Person' | 'Remote'>('Courier');
    const [shippingAddress, setShippingAddress] = useState('');
    const [courierName, setCourierName] = useState('Blue Dart');
    const [docketNumber, setDocketNumber] = useState('');
    const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [estimatedDelivery, setEstimatedDelivery] = useState('');
    const [inPersonBranch, setInPersonBranch] = useState('');
    const [dispatchRemarks, setDispatchRemarks] = useState('');

    // Step 7: Credential Sharing
    const [credentialsChecks, setCredentialsChecks] = useState({
        m365CredsShared: false,
        laptopCredsShared: false,
        policyCommunicated: false,
    });

    useEffect(() => {
        if (isOpen) {
            if (initialUser) {
                setSelectedUserId(initialUser.id);
                setUserData({
                    name: initialUser.name,
                    email: initialUser.email,
                    mobile: initialUser.mobile || '',
                    employeeId: initialUser.employeeId || '',
                    company: initialUser.company || 'Avana Medical Devices Pvt Ltd',
                    departmentId: initialUser.departmentId || '',
                    branchId: initialUser.branchId || '',
                    jobTitle: initialUser.jobTitle || '',
                    location: initialUser.location || '',
                    accountType: initialUser.accountType || 'Employee',
                    role: initialUser.role || 'User',
                });
                setM365AccountCreated(Boolean(initialUser.m365AccountCreated));
                if (initialUser.dispatchDetails) {
                    try {
                        const parsed = JSON.parse(initialUser.dispatchDetails);
                        if (parsed.mode) setDispatchMode(parsed.mode);
                        if (parsed.shippingAddress) setShippingAddress(parsed.shippingAddress);
                        if (parsed.courierName) setCourierName(parsed.courierName);
                        if (parsed.docketNumber) setDocketNumber(parsed.docketNumber);
                        if (parsed.dispatchDate) setDispatchDate(parsed.dispatchDate);
                        if (parsed.officeLocation) setInPersonBranch(parsed.officeLocation);
                        if (parsed.remarks) setDispatchRemarks(parsed.remarks);
                    } catch {}
                }
            } else {
                setSelectedUserId('new');
                setCurrentStep(1);
            }
        }
    }, [isOpen, initialUser]);

    if (!isOpen) return null;

    const inStockAssets = assets.filter(a => a.status === 'In Stock');
    const availableLicenses = licenses.filter(l => {
        const assigned = l.assignments?.length || 0;
        return (l.seats - assigned) > 0;
    });

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

    const handleFinalSubmit = async () => {
        setIsSubmitting(true);
        try {
            let activeUser: User | null = null;
            if (selectedUserId === 'new') {
                activeUser = await handleCreateOrSelectUser();
            } else {
                activeUser = users.find(u => u.id === selectedUserId) || null;
            }

            if (!activeUser) throw new Error('User not identified');

            // Dispatch payload
            const dispatchPayload: DispatchDetails = {
                mode: dispatchMode,
                shippingAddress: dispatchMode === 'Courier' ? shippingAddress : undefined,
                courierName: dispatchMode === 'Courier' ? courierName : undefined,
                docketNumber: dispatchMode === 'Courier' ? docketNumber : undefined,
                dispatchDate: dispatchMode === 'Courier' ? dispatchDate : undefined,
                officeLocation: dispatchMode === 'In-Person' ? inPersonBranch : undefined,
                remarks: dispatchRemarks || undefined
            };

            const softwareAllDone = softwareChecks.notApplicable || (softwareChecks.osConfigured && softwareChecks.m365Apps && softwareChecks.antivirus);
            const qaAllDone = qaChecks.notApplicable || (qaChecks.display && qaChecks.keyboard && qaChecks.battery);
            const credsHandedOver = credentialsChecks.m365CredsShared || credentialsChecks.laptopCredsShared;

            const res = await fetch(`${API_URL}/api/onboarding/complete`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    userId: activeUser.id,
                    m365AccountCreated,
                    assignLicenseId: licenseOption === 'assign' && selectedLicenseId ? Number(selectedLicenseId) : undefined,
                    assignAssetId: assetOption === 'assign' && selectedAssetId ? Number(selectedAssetId) : undefined,
                    assetCondition,
                    softwareInstalled: softwareAllDone,
                    hardwareTested: qaAllDone,
                    dispatchDetails: dispatchPayload,
                    credentialsHandedOver: credsHandedOver,
                    onboardingStatus: 'Completed',
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to complete onboarding');
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

            // If license was assigned, update license local state
            if (licenseOption === 'assign' && selectedLicenseId) {
                setLicenses(licenses.map(l => l.id === Number(selectedLicenseId) ? {
                    ...l,
                    assignedSeats: (l.assignedSeats || 0) + 1,
                    assignments: [...(l.assignments || []), { id: Date.now(), licenseId: l.id, userId: updatedUser.id, assignedDate: new Date().toISOString() }]
                } : l));
            }

            setNotification({ message: `Onboarding completed successfully for ${updatedUser.name}!`, type: 'success' });
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
                            return (
                                <React.Fragment key={step.id}>
                                    <button 
                                        onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                                        disabled={step.id > currentStep}
                                        className={`flex items-center gap-2 text-left group transition-all ${
                                            isCurrent ? 'text-brand-600 dark:text-brand-400 font-semibold' : 
                                            isDone ? 'text-emerald-600 dark:text-emerald-400 cursor-pointer' : 'text-slate-400 cursor-not-allowed'
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
                                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedUserId('new')}
                                            className={`px-3 py-1.5 rounded-md font-medium transition-all ${selectedUserId === 'new' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            + New Employee
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedUserId(users[0]?.id || 'new')}
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
                                            setSelectedUserId(uId);
                                            const found = users.find(u => u.id === uId);
                                            if (found) {
                                                setUserData({
                                                    name: found.name,
                                                    email: found.email,
                                                    mobile: found.mobile || '',
                                                    employeeId: found.employeeId || '',
                                                    company: found.company || 'Avana Medical Devices Pvt Ltd',
                                                    departmentId: found.departmentId || '',
                                                    branchId: found.branchId || '',
                                                    jobTitle: found.jobTitle || '',
                                                    location: found.location || '',
                                                    accountType: found.accountType || 'Employee',
                                                    role: found.role || 'User',
                                                });
                                                setM365AccountCreated(Boolean(found.m365AccountCreated));
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

                    {/* STEP 2: M365 Account & License */}
                    {currentStep === 2 && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 2: Microsoft 365 Account & License</h3>
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
                                            <span>Assign M365 License</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 pl-5">Allocate an available subscription seat from company inventory</p>
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
                                    <div className="mt-4 p-4 rounded-xl border border-brand-200 dark:border-brand-900 bg-brand-50/30 dark:bg-brand-950/20 space-y-2 animate-in fade-in duration-150">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Choose Available License</label>
                                        <select
                                            value={selectedLicenseId}
                                            onChange={e => setSelectedLicenseId(Number(e.target.value))}
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                        >
                                            <option value="">-- Select License --</option>
                                            {availableLicenses.map(l => {
                                                const assigned = l.assignments?.length || 0;
                                                const available = l.seats - assigned;
                                                return (
                                                    <option key={l.id} value={l.id}>
                                                        {l.name} ({l.category}) — {available} of {l.seats} seats available
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {availableLicenses.length === 0 && (
                                            <p className="text-xs text-amber-600 dark:text-amber-400">⚠️ No available license seats found. You can add more in Licenses & Subs.</p>
                                        )}
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

                    {/* STEP 4: Software Configuration */}
                    {currentStep === 4 && (
                        <div className="space-y-4 max-w-2xl mx-auto">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 4: Software & Security Configuration</h3>
                                    <p className="text-xs text-slate-500">Verify company software stack, security policies, and domain configuration</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSoftwareChecks({
                                        osConfigured: true,
                                        m365Apps: true,
                                        antivirus: true,
                                        vpnTools: true,
                                        diskEncryption: true,
                                        notApplicable: false,
                                    })}
                                    className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                                >
                                    Mark All Done
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                {[
                                    { key: 'osConfigured', title: 'Operating System Setup', desc: 'Windows 11 / macOS installed, updated, and joined to organization domain/Entra ID' },
                                    { key: 'm365Apps', title: 'Microsoft 365 Apps', desc: 'Outlook, Microsoft Teams, OneDrive, Word, Excel, and Edge/Chrome configured' },
                                    { key: 'antivirus', title: 'Endpoint Security & Antivirus', desc: 'Microsoft Defender for Endpoint / Antivirus running with latest definition updates' },
                                    { key: 'vpnTools', title: 'VPN & Departmental Tools', desc: 'Secure network access, internal portals, and department-specific software installed' },
                                    { key: 'diskEncryption', title: 'Disk Encryption & Security Policies', desc: 'BitLocker / FileVault enabled, complex PIN configured, screen timeout enforced' },
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
                                            antivirus: false,
                                            vpnTools: false,
                                            diskEncryption: false,
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

                    {/* STEP 6: Logistics & Dispatch */}
                    {currentStep === 6 && (
                        <div className="space-y-4 max-w-2xl mx-auto">
                            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 6: Handover / Dispatch Logistics</h3>
                                <p className="text-xs text-slate-500">Record courier docket details, shipping address, or office handover location</p>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'Courier', title: 'Courier Dispatch', icon: ICONS.truck },
                                    { id: 'In-Person', title: 'In-Person Handover', icon: ICONS.users },
                                    { id: 'Remote', title: 'Remote / Digital', icon: ICONS.dashboard },
                                ].map(mode => (
                                    <button
                                        type="button"
                                        key={mode.id}
                                        onClick={() => setDispatchMode(mode.id as any)}
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all ${dispatchMode === mode.id ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 font-semibold' : 'border-slate-200 dark:border-slate-700 text-slate-600'}`}
                                    >
                                        {mode.icon}
                                        <span className="text-xs">{mode.title}</span>
                                    </button>
                                ))}
                            </div>

                            {dispatchMode === 'Courier' && (
                                <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 animate-in fade-in duration-150">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Dispatched Shipping Address *</label>
                                        <textarea
                                            rows={2}
                                            value={shippingAddress}
                                            onChange={e => setShippingAddress(e.target.value)}
                                            placeholder="Employee residential/office delivery address with pincode..."
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Courier / Carrier Name *</label>
                                            <input
                                                type="text"
                                                value={courierName}
                                                onChange={e => setCourierName(e.target.value)}
                                                placeholder="e.g. Blue Dart, DTDC, DHL, FedEx, Delhivery"
                                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Docket / AWB Tracking Number *</label>
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

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Estimated Delivery Date</label>
                                            <input
                                                type="date"
                                                value={estimatedDelivery}
                                                onChange={e => setEstimatedDelivery(e.target.value)}
                                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {dispatchMode === 'In-Person' && (
                                <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 animate-in fade-in duration-150">
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
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Step 8: Final Review & Onboarding Completion</h3>
                                <p className="text-xs text-slate-500">Verify summary before recording the onboarding completion in the audit log</p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-500">Employee:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">{userData.name} ({userData.email})</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-500">Microsoft 365:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {m365AccountCreated ? '✓ Account Created' : 'Not Set'} | {licenseOption === 'assign' && selectedLicenseId ? `License Assigned` : 'No License Needed'}
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
                                        ✓ Configured & Tested
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-500">Dispatch / Logistics:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {dispatchMode === 'Courier' 
                                            ? `Courier: ${courierName} (Docket: ${docketNumber || 'N/A'})`
                                            : dispatchMode === 'In-Person' ? `In-Person Handover (${inPersonBranch || 'Office'})` : 'Remote'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-slate-500">Credentials Handover:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {credentialsChecks.m365CredsShared ? '✓ Credentials Shared' : 'Pending Share'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
                                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                                    Clicking <strong>"Complete Onboarding & Handover"</strong> will mark onboarding 100% complete, assign the asset and license, and record the dispatch log.
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
                        &larr; Back
                    </button>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>

                        {currentStep < STEPS.length ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={isSubmitting}
                                className="px-6 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 transition-all flex items-center gap-1.5"
                            >
                                {isSubmitting ? 'Saving...' : 'Next Step &rarr;'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleFinalSubmit}
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
