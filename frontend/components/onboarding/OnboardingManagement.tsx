import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { User, Asset } from '../../types';
import { ICONS } from '../../constants';
import OnboardingWizardModal from './OnboardingWizardModal';
import OffboardingWizardModal from './OffboardingWizardModal';

const OnboardingManagement: React.FC = () => {
    const { users, assets, setSelectedUserId, setPreviewTarget, navigate } = useAppContext();
    const [activeTab, setActiveTab] = useState<'onboarding' | 'offboarding' | 'logistics'>('onboarding');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Completed'>('All');

    // Modals
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    const [isOffboardingOpen, setIsOffboardingOpen] = useState(false);
    const [wizardUser, setWizardUser] = useState<User | null>(null);

    // Calculate metrics
    const pendingOnboarding = users.filter(u => u.onboardingStatus === 'Pending' || (!u.onboardingStatus && u.status === 'Active')).length;
    const inProgressOnboarding = users.filter(u => u.onboardingStatus === 'In Progress').length;
    const completedOnboarding = users.filter(u => u.onboardingStatus === 'Completed').length;
    const offboardedUsers = users.filter(u => u.status === 'Inactive' || u.offboardingStatus === 'Completed').length;

    // Filter users for Onboarding tab
    const filteredOnboardingUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (u.employeeId && u.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const currentStatus = u.onboardingStatus || 'Pending';
        const matchesStatus = statusFilter === 'All' || currentStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Filter users for Offboarding tab
    const filteredOffboardingUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              u.email.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    // Helper: calculate onboarding progress percentage
    const getOnboardingProgress = (u: User) => {
        let score = 0;
        let total = 6;
        if (u.m365AccountCreated) score++;
        if (u.m365LicenseAssigned) score++;
        if (assets.some(a => a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === u.id) || u.laptopStatus === 'Using own laptop') score++;
        if (u.softwareInstalled) score++;
        if (u.hardwareTested) score++;
        if (u.credentialsHandedOver) score++;
        return Math.round((score / total) * 100);
    };

    // Helper: parse dispatch details
    const parseDispatch = (u: User) => {
        if (!u.dispatchDetails) return null;
        try {
            return typeof u.dispatchDetails === 'string' ? JSON.parse(u.dispatchDetails) : u.dispatchDetails;
        } catch {
            return null;
        }
    };

    // Helper: parse return docket
    const parseReturnDocket = (u: User) => {
        if (!u.assetReturnDocket) return null;
        try {
            return typeof u.assetReturnDocket === 'string' ? JSON.parse(u.assetReturnDocket) : u.assetReturnDocket;
        } catch {
            return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                        <span className="p-2 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 rounded-xl">
                            {ICONS.onboarding}
                        </span>
                        IT Operations: Onboarding & Offboarding
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Manage end-to-end employee equipment handovers, software provisioning, dispatch dockets, and exit clearance.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => {
                            setWizardUser(null);
                            setIsOnboardingOpen(true);
                        }}
                        className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-brand-500/20 transition-all flex items-center gap-2"
                    >
                        <span>+</span> Start New Onboarding
                    </button>
                    <button
                        onClick={() => {
                            setWizardUser(null);
                            setIsOffboardingOpen(true);
                        }}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-red-500/20 transition-all flex items-center gap-2"
                    >
                        {ICONS.offboarding} Initiate Offboarding
                    </button>
                </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Pending Onboarding</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    </div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-2">{pendingOnboarding + inProgressOnboarding}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{inProgressOnboarding} in progress, {pendingOnboarding} pending</p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Fully Onboarded</span>
                        <span className="text-emerald-500 font-bold text-xs">✓</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{completedOnboarding}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Employees completed 100% IT checklist</p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Courier Dispatches</span>
                        <span className="text-brand-500">{ICONS.truck}</span>
                    </div>
                    <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-2">
                        {users.filter(u => parseDispatch(u)?.mode === 'Courier').length}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tracked with carrier docket numbers</p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Offboarded / Exited</span>
                        <span className="text-red-500 text-xs font-semibold">Exit</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-2">{offboardedUsers}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Assets reclaimed & accounts disabled</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 gap-6 text-sm font-medium">
                <button
                    onClick={() => setActiveTab('onboarding')}
                    className={`pb-3 relative flex items-center gap-2 transition-all ${activeTab === 'onboarding' ? 'text-brand-600 dark:text-brand-400 font-bold border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                    {ICONS.onboarding}
                    Employee Onboarding Pipeline
                    <span className="px-2 py-0.5 rounded-full text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">
                        {users.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('offboarding')}
                    className={`pb-3 relative flex items-center gap-2 transition-all ${activeTab === 'offboarding' ? 'text-red-600 dark:text-red-400 font-bold border-b-2 border-red-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                    {ICONS.offboarding}
                    Employee Offboarding & Returns
                </button>

                <button
                    onClick={() => setActiveTab('logistics')}
                    className={`pb-3 relative flex items-center gap-2 transition-all ${activeTab === 'logistics' ? 'text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                    {ICONS.truck}
                    Logistics & Docket Archive
                </button>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        {ICONS.search}
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search employee by name, email, ID..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-500"
                    />
                </div>

                {activeTab === 'onboarding' && (
                    <div className="flex items-center gap-2">
                        {(['All', 'Pending', 'In Progress', 'Completed'] as const).map(st => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === st ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* TAB 1: ONBOARDING TABLE */}
            {activeTab === 'onboarding' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3.5">Employee</th>
                                    <th className="px-4 py-3.5">Department & Branch</th>
                                    <th className="px-4 py-3.5">M365 & License</th>
                                    <th className="px-4 py-3.5">Device Assigned</th>
                                    <th className="px-4 py-3.5">Dispatch / Logistics</th>
                                    <th className="px-4 py-3.5">Progress</th>
                                    <th className="px-4 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
                                {filteredOnboardingUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                                            No employees match the current search / filter.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOnboardingUsers.map(u => {
                                        const progress = getOnboardingProgress(u);
                                        const dispatch = parseDispatch(u);
                                        const assignedAssets = assets.filter(a => a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === u.id);
                                        const statusBadge = u.onboardingStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                                            u.onboardingStatus === 'In Progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                                            'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';

                                        return (
                                            <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-bold flex items-center justify-center text-xs shrink-0">
                                                            {u.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                                                {u.name}
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusBadge}`}>
                                                                    {u.onboardingStatus || 'Pending'}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-slate-400">{u.email} {u.employeeId ? `• ID: ${u.employeeId}` : ''}</div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3.5 text-xs">
                                                    <div className="font-medium text-slate-800 dark:text-slate-200">{u.department?.name || 'No Department'}</div>
                                                    <div className="text-slate-400">{u.branch?.name || u.location || 'HQ'}</div>
                                                </td>

                                                <td className="px-4 py-3.5 text-xs">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className={u.m365AccountCreated ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}>
                                                            {u.m365AccountCreated ? '✓ Account Created' : '✗ No Account'}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">
                                                            {u.m365LicenseAssigned ? '✓ License Allocated' : 'No License'}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3.5 text-xs">
                                                    {assignedAssets.length > 0 ? (
                                                        <div className="space-y-0.5">
                                                            {assignedAssets.map(a => (
                                                                <div key={a.id} className="font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">
                                                                    <span>💻</span> {a.name} [{a.assetId}]
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic">
                                                            {u.laptopStatus || 'No Device Assigned'}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 text-xs">
                                                    {dispatch ? (
                                                        <div>
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                                                {dispatch.mode === 'Courier' ? '📦 ' + (dispatch.courierName || 'Courier') : '🏢 In-Person'}
                                                            </span>
                                                            {dispatch.docketNumber && (
                                                                <span className="font-mono text-[11px] text-slate-500">
                                                                    Docket: {dispatch.docketNumber}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Not Dispatched</span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    <div className="w-28 space-y-1">
                                                        <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                            <span>Progress</span>
                                                            <span>{progress}%</span>
                                                        </div>
                                                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                            <div 
                                                                className={`h-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-brand-500' : 'bg-amber-500'}`}
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setWizardUser(u);
                                                                setIsOnboardingOpen(true);
                                                            }}
                                                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900 transition-colors"
                                                            title="Launch Guided Onboarding Wizard"
                                                        >
                                                            {u.onboardingStatus === 'Completed' ? 'Review' : 'Continue'}
                                                        </button>

                                                        {assignedAssets.length > 0 && (
                                                            <button
                                                                onClick={() => {
                                                                    setPreviewTarget({ type: 'declaration', id: u.id });
                                                                }}
                                                                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                                title="View Declaration Form"
                                                            >
                                                                📄
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => {
                                                                setSelectedUserId(u.id);
                                                                navigate('users');
                                                            }}
                                                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                            title="View Full Profile"
                                                        >
                                                            {ICONS.view}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: OFFBOARDING TABLE */}
            {activeTab === 'offboarding' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3.5">Employee</th>
                                    <th className="px-4 py-3.5">Account Status</th>
                                    <th className="px-4 py-3.5">Active Holdings</th>
                                    <th className="px-4 py-3.5">Hardware Return</th>
                                    <th className="px-4 py-3.5">Return Condition</th>
                                    <th className="px-4 py-3.5">Security Wipe</th>
                                    <th className="px-4 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
                                {filteredOffboardingUsers.map(u => {
                                    const userHoldings = assets.filter(a => a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === u.id);
                                    const isDeactivated = u.status === 'Inactive';

                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-semibold text-slate-900 dark:text-slate-100">{u.name}</div>
                                                <div className="text-xs text-slate-400">{u.email}</div>
                                            </td>

                                            <td className="px-4 py-3.5 text-xs">
                                                <span className={`px-2 py-0.5 rounded-full font-semibold ${isDeactivated ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                                                    {u.status || 'Active'}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3.5 text-xs font-medium">
                                                {userHoldings.length > 0 ? (
                                                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                                        ⚠️ {userHoldings.length} Device(s) Assigned
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">No Active Devices</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-xs">
                                                {u.assetReturned ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Returned</span>
                                                ) : userHoldings.length > 0 ? (
                                                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Pending Collection</span>
                                                ) : (
                                                    <span className="text-slate-400">N/A</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-xs">
                                                {u.assetReturnCondition ? (
                                                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-semibold text-slate-800 dark:text-slate-200">
                                                        {u.assetReturnCondition}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-xs">
                                                {u.deviceWiped ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Wiped</span>
                                                ) : (
                                                    <span className="text-slate-400">Not Recorded</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-right">
                                                <button
                                                    onClick={() => {
                                                        setWizardUser(u);
                                                        setIsOffboardingOpen(true);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                                                >
                                                    {isDeactivated ? 'Review Exit' : 'Offboard User'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: LOGISTICS & DOCKET ARCHIVE */}
            {activeTab === 'logistics' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3.5">Employee</th>
                                    <th className="px-4 py-3.5">Shipment Type</th>
                                    <th className="px-4 py-3.5">Carrier Partner</th>
                                    <th className="px-4 py-3.5">Docket / AWB Tracking #</th>
                                    <th className="px-4 py-3.5">Shipping Address / Location</th>
                                    <th className="px-4 py-3.5">Date</th>
                                    <th className="px-4 py-3.5">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
                                {users.filter(u => u.dispatchDetails || u.assetReturnDocket).length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                                            No courier dispatches or returns recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    users.filter(u => u.dispatchDetails || u.assetReturnDocket).map(u => {
                                        const dispatch = parseDispatch(u);
                                        const returnDocket = parseReturnDocket(u);

                                        return (
                                            <React.Fragment key={u.id}>
                                                {dispatch && (
                                                    <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                                                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                                                            {u.name}
                                                            <div className="text-xs text-slate-400 font-normal">{u.email}</div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
                                                                Outbound Dispatch
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 font-medium text-xs">{dispatch.courierName || 'In-Person'}</td>
                                                        <td className="px-4 py-3.5 font-mono text-xs text-brand-600 dark:text-brand-400 font-semibold">
                                                            {dispatch.docketNumber || 'N/A'}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-xs text-slate-500 max-w-xs truncate">
                                                            {dispatch.shippingAddress || dispatch.officeLocation || '-'}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-xs">{dispatch.dispatchDate || '-'}</td>
                                                        <td className="px-4 py-3.5 text-xs text-slate-500">{dispatch.remarks || '-'}</td>
                                                    </tr>
                                                )}

                                                {returnDocket && (
                                                    <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 bg-red-50/20 dark:bg-red-950/10">
                                                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                                                            {u.name}
                                                            <div className="text-xs text-slate-400 font-normal">{u.email}</div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                                                                Inbound Return
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 font-medium text-xs">{returnDocket.courier || 'In-Person'}</td>
                                                        <td className="px-4 py-3.5 font-mono text-xs text-red-600 dark:text-red-400 font-semibold">
                                                            {returnDocket.docketNo || 'N/A'}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-xs text-slate-500">-</td>
                                                        <td className="px-4 py-3.5 text-xs">{returnDocket.returnDate ? returnDocket.returnDate.split('T')[0] : '-'}</td>
                                                        <td className="px-4 py-3.5 text-xs text-slate-500">{u.assetReturnRemarks || '-'}</td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals */}
            <OnboardingWizardModal
                isOpen={isOnboardingOpen}
                onClose={() => setIsOnboardingOpen(false)}
                initialUser={wizardUser}
            />

            <OffboardingWizardModal
                isOpen={isOffboardingOpen}
                onClose={() => setIsOffboardingOpen(false)}
                initialUser={wizardUser}
            />
        </div>
    );
};

export default OnboardingManagement;
