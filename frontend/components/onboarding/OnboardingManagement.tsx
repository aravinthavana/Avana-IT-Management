import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { User, Asset } from '../../types';
import { ICONS } from '../../constants';
import OnboardingWizardModal from './OnboardingWizardModal';
import OffboardingWizardModal from './OffboardingWizardModal';

const OnboardingManagement: React.FC = () => {
    const { users, assets, licenses, setSelectedUserId, setPreviewTarget, navigate } = useAppContext();
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
        if (u.onboardingStatus === 'Completed') return 100;
        const hasDevice = assets.some(a => (a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === u.id) || a.assignedTo === u.id);
        const isOwn = u.laptopStatus === 'Uses Own Laptop' || u.laptopStatus === 'Using own laptop';
        let score = 0;
        let total = 0;

        // 1. Account
        total++;
        if (u.m365AccountCreated) score++;

        // 2. License
        total++;
        const hasLicense = u.m365LicenseAssigned ||
            licenses.some(l => l.assignments?.some(a => a.userId === u.id)) ||
            (u.licenseAssignments && u.licenseAssignments.length > 0);
        if (hasLicense) score++;

        // 3. Hardware Allocation decision
        total++;
        if (hasDevice || isOwn || u.laptopStatus === 'No Device Assigned') score++;

        // 4, 5 & 6. Software, QA, Logistics (only applicable if company device assigned)
        if (hasDevice) {
            total += 3;
            if (u.softwareInstalled) score++;
            if (u.hardwareTested) score++;
            const d = parseDispatch(u);
            if (d && (d.isDispatched || d.docketNumber || d.dcNumber || d.officeLocation)) score++;
        }

        // 7. Credentials (applicable if device assigned or M365 created)
        if (hasDevice || u.m365AccountCreated) {
            total++;
            if (u.credentialsHandedOver) score++;
        }

        return total > 0 ? Math.round((score / total) * 100) : 0;
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
                    <h1 className="text-2xl font-bold text-ink flex items-center gap-2.5">
                        <span className="p-2 bg-surface text-ink rounded-xl">
                            {ICONS.onboarding}
                        </span>
                        IT Operations: Onboarding & Offboarding
                    </h1>
                    <p className="text-xs text-quiet mt-1">
                        Manage end-to-end employee equipment handovers, software provisioning, dispatch dockets, and exit clearance.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => {
                            setWizardUser(null);
                            setIsOnboardingOpen(true);
                        }}
                        className="px-4 py-2.5 bg-accent hover:bg-accent text-on-strong rounded-xl text-sm font-semibold shadow-md shadow-strong/15 transition-all flex items-center gap-2"
                    >
                        <span>+</span> Start New Onboarding
                    </button>
                    <button
                        onClick={() => {
                            setWizardUser(null);
                            setIsOffboardingOpen(true);
                        }}
                        className="px-4 py-2.5 bg-olive hover:bg-olive text-on-strong rounded-xl text-sm font-semibold shadow-md shadow-strong/15 transition-all flex items-center gap-2"
                    >
                        {ICONS.offboarding} Initiate Offboarding
                    </button>
                </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-surface border border-line shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-quiet">Pending Onboarding</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-olive animate-pulse" />
                    </div>
                    <p className="text-2xl font-bold text-ink mt-2">{pendingOnboarding + inProgressOnboarding}</p>
                    <p className="text-[11px] text-quiet mt-0.5">{inProgressOnboarding} in progress, {pendingOnboarding} pending</p>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-line shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-quiet">Fully Onboarded</span>
                        <span className="text-ink font-bold text-xs">✓</span>
                    </div>
                    <p className="text-2xl font-bold text-ink mt-2">{completedOnboarding}</p>
                    <p className="text-[11px] text-quiet mt-0.5">Employees completed 100% IT checklist</p>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-line shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-quiet">Courier Dispatches</span>
                        <span className="text-ink">{ICONS.truck}</span>
                    </div>
                    <p className="text-2xl font-bold text-ink mt-2">
                        {users.filter(u => parseDispatch(u)?.mode === 'Courier').length}
                    </p>
                    <p className="text-[11px] text-quiet mt-0.5">Tracked with carrier docket numbers</p>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-line shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-quiet">Offboarded / Exited</span>
                        <span className="text-ink text-xs font-semibold">Exit</span>
                    </div>
                    <p className="text-2xl font-bold text-ink mt-2">{offboardedUsers}</p>
                    <p className="text-[11px] text-quiet mt-0.5">Assets reclaimed & accounts disabled</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-line gap-6 text-sm font-medium">
                <button
                    onClick={() => setActiveTab('onboarding')}
                    className={`pb-3 relative flex items-center gap-2 transition-all ${activeTab === 'onboarding' ? 'text-ink  font-bold border-b-2 border-accent' : 'text-quiet hover:text-ink '}`}
                >
                    {ICONS.onboarding}
                    Employee Onboarding Pipeline
                    <span className="px-2 py-0.5 rounded-full text-xs bg-surface text-ink">
                        {users.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('offboarding')}
                    className={`pb-3 relative flex items-center gap-2 transition-all ${activeTab === 'offboarding' ? 'text-ink  font-bold border-b-2 border-line' : 'text-quiet hover:text-ink '}`}
                >
                    {ICONS.offboarding}
                    Employee Offboarding & Returns
                </button>

                <button
                    onClick={() => setActiveTab('logistics')}
                    className={`pb-3 relative flex items-center gap-2 transition-all ${activeTab === 'logistics' ? 'text-ink  font-bold border-b-2 border-line' : 'text-quiet hover:text-ink '}`}
                >
                    {ICONS.truck}
                    Logistics & Docket Archive
                </button>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-quiet">
                        {ICONS.search}
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search employee by name, email, ID..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-line bg-surface text-sm focus:ring-2 focus:ring-accent"
                    />
                </div>

                {activeTab === 'onboarding' && (
                    <div className="flex items-center gap-2">
                        {(['All', 'Pending', 'In Progress', 'Completed'] as const).map(st => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === st ? 'bg-accent text-on-strong shadow-sm' : 'bg-muted  text-quiet  hover:bg-muted'}`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* TAB 1: ONBOARDING TABLE */}
            {activeTab === 'onboarding' && (
                <div className="bg-surface rounded-xl shadow-sm border border-line overflow-hidden">
                    <div tabIndex={0} role="region" aria-label="Data table; scroll horizontally for more columns" className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-canvas text-xs font-semibold text-quiet uppercase tracking-wider border-b border-line">
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
                            <tbody className="divide-y divide-line text-ink">
                                {filteredOnboardingUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-8 text-center text-quiet">
                                            No employees match the current search / filter.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOnboardingUsers.map(u => {
                                        const progress = getOnboardingProgress(u);
                                        const dispatch = parseDispatch(u);
                                        const assignedAssets = assets.filter(a => (a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === u.id) || a.assignedTo === u.id);
                                         const statusBadge = u.onboardingStatus === 'Completed' ? 'bg-surface text-ink  ' :
                                                             u.onboardingStatus === 'In Progress' ? 'bg-surface text-ink  ' :
                                                             'bg-surface text-ink  ';

                                         return (
                                             <tr key={u.id} className="hover:bg-canvas/80 transition-colors">
                                                 <td className="px-5 py-3.5">
                                                     <div className="flex items-center gap-3">
                                                         <div className="w-8 h-8 rounded-full bg-surface text-ink font-bold flex items-center justify-center text-xs shrink-0">
                                                             {u.name.charAt(0).toUpperCase()}
                                                         </div>
                                                         <div>
                                                             <div className="font-semibold text-ink flex items-center gap-1.5">
                                                                 {u.name}
                                                                 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusBadge}`}>
                                                                     {u.onboardingStatus || 'Pending'}
                                                                 </span>
                                                             </div>
                                                             <div className="text-xs text-quiet">{u.email} {u.employeeId ? `• ID: ${u.employeeId}` : ''}</div>
                                                         </div>
                                                     </div>
                                                 </td>

                                                 <td className="px-4 py-3.5 text-quiet">
                                                     {u.department?.name || '—'}
                                                 </td>

                                                 <td className="px-4 py-3.5">
                                                     {(() => {
                                                         const userLicenses = licenses.filter(l => l.assignments?.some(a => a.userId === u.id));
                                                         return (
                                                             <div className="flex flex-col gap-1">
                                                                 <div className="flex items-center gap-1.5 flex-wrap">
                                                                     {u.m365AccountCreated ? (
                                                                         <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface text-ink border border-line">
                                                                             ✓ M365 Acct
                                                                         </span>
                                                                     ) : (
                                                                         <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-quiet">
                                                                             No M365 Acct
                                                                         </span>
                                                                     )}
                                                                 </div>
                                                                 {userLicenses.length > 0 ? (
                                                                     <div className="flex flex-wrap gap-1">
                                                                         {userLicenses.map(lic => {
                                                                             const isStandard = lic.name.toLowerCase().includes('standard');
                                                                             const isBasic = lic.name.toLowerCase().includes('basic');
                                                                             const isExchange = lic.name.toLowerCase().includes('exchange');
                                                                             const isZoho = lic.name.toLowerCase().includes('zoho');
                                                                             const badgeColor = isStandard
                                                                                 ? 'bg-surface  text-ink  border-line '
                                                                                 : isBasic
                                                                                 ? 'bg-surface  text-ink  border-line '
                                                                                 : isExchange
                                                                                 ? 'bg-surface  text-ink  border-line '
                                                                                 : isZoho
                                                                                 ? 'bg-surface  text-ink  border-line '
                                                                                 : 'bg-surface  text-ink  border-line ';

                                                                             return (
                                                                                 <span
                                                                                     key={lic.id}
                                                                                     title={lic.name}
                                                                                     className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border truncate max-w-[160px] ${badgeColor}`}
                                                                                 >
                                                                                     {lic.name.replace('Microsoft 365 ', 'M365 ').replace(' Enterprise Plan', '')}
                                                                                 </span>
                                                                             );
                                                                         })}
                                                                     </div>
                                                                 ) : (
                                                                     <span className="text-[10px] text-quiet italic">No License</span>
                                                                 )}
                                                             </div>
                                                         );
                                                     })()}
                                                 </td>

                                                 <td className="px-4 py-3.5">
                                                     {assignedAssets.length > 0 ? (
                                                         <div className="flex flex-col">
                                                             <span className="font-semibold text-ink text-xs">
                                                                 {assignedAssets[0].name}
                                                             </span>
                                                             <span className="text-[10px] text-quiet">
                                                                 {assignedAssets[0].assetId} {assignedAssets.length > 1 ? `(+${assignedAssets.length - 1} more)` : ''}
                                                             </span>
                                                         </div>
                                                     ) : u.laptopStatus === 'Uses Own Laptop' || u.laptopStatus === 'Using own laptop' ? (
                                                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface text-ink">
                                                             Uses Own Laptop (BYOD)
                                                         </span>
                                                     ) : u.laptopStatus === 'Details Not Collected' ? (
                                                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface text-ink border border-line">
                                                             Details Not Collected
                                                         </span>
                                                     ) : (
                                                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-quiet">
                                                             No Device Assigned
                                                         </span>
                                                     )}
                                                 </td>

                                                 <td className="px-4 py-3.5">
                                                     {dispatch?.isDispatched || dispatch?.docketNumber || dispatch?.dcNumber ? (
                                                         <div className="flex flex-col">
                                                             <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                                                                 🚚 {dispatch.courierName || (dispatch.mode === 'In-Person' ? 'In-Person Handover' : 'Courier')}
                                                             </span>
                                                             {dispatch.dcNumber && (
                                                                 <span className="text-[10px] text-ink font-mono font-medium">
                                                                     DC: #{dispatch.dcNumber}
                                                                 </span>
                                                             )}
                                                             {dispatch.docketNumber && (
                                                                 <span className="text-[10px] text-quiet font-mono">
                                                                     AWB: #{dispatch.docketNumber}
                                                                 </span>
                                                             )}
                                                         </div>
                                                     ) : (
                                                         <span className="text-xs text-quiet">—</span>
                                                     )}
                                                 </td>

                                                 <td className="px-4 py-3.5">
                                                     <div className="w-32">
                                                         <div className="flex justify-between text-xs mb-1">
                                                             <span className="font-semibold text-ink">{progress}%</span>
                                                         </div>
                                                         <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                                                             <div
                                                                 className={`h-full rounded-full transition-all duration-300 ${
                                                                     progress === 100 ? 'bg-olive' : progress >= 50 ? 'bg-olive' : 'bg-olive'
                                                                 }`}
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
                                                             className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface text-ink hover:bg-surface transition-colors"
                                                             title="Launch Guided Onboarding Wizard"
                                                         >
                                                             {u.onboardingStatus === 'Completed' ? 'Review' : 'Continue'}
                                                         </button>

                                                         {assignedAssets.length > 0 && (
                                                             <button
                                                                 onClick={() => {
                                                                     setPreviewTarget({
                                                                         type: 'declaration',
                                                                         userId: u.id,
                                                                         assetId: assignedAssets[0].id
                                                                     });
                                                                 }}
                                                                 className="p-1.5 rounded-lg text-quiet hover:text-ink hover:bg-muted transition-colors"
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
                                                            className="p-1.5 rounded-lg text-quiet hover:text-ink hover:bg-muted transition-colors"
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
                <div className="bg-surface rounded-xl shadow-sm border border-line overflow-hidden">
                    <div tabIndex={0} role="region" aria-label="Data table; scroll horizontally for more columns" className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-canvas text-xs font-semibold text-quiet uppercase tracking-wider border-b border-line">
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
                            <tbody className="divide-y divide-line text-ink">
                                {filteredOffboardingUsers.map(u => {
                                    const userHoldings = assets.filter(a => (a.assigneeType?.toLowerCase() === 'user' && a.assigneeId === u.id) || a.assignedTo === u.id);
                                    const isDeactivated = u.status === 'Inactive';

                                    return (
                                        <tr key={u.id} className="hover:bg-canvas/80 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-semibold text-ink">{u.name}</div>
                                                <div className="text-xs text-quiet">{u.email}</div>
                                            </td>

                                            <td className="px-4 py-3.5 text-xs">
                                                <span className={`px-2 py-0.5 rounded-full font-semibold ${isDeactivated ? 'bg-muted text-ink  ' : 'bg-surface text-ink  '}`}>
                                                    {u.status || 'Active'}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3.5 text-xs font-medium">
                                                {userHoldings.length > 0 ? (
                                                    <span className="text-ink font-semibold">
                                                        ⚠️ {userHoldings.length} Device(s) Assigned
                                                    </span>
                                                ) : (
                                                    <span className="text-quiet">No Active Devices</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-xs">
                                                {u.assetReturned ? (
                                                    <span className="text-ink font-semibold">✓ Returned</span>
                                                ) : userHoldings.length > 0 ? (
                                                    <span className="text-ink font-semibold">Pending Collection</span>
                                                ) : (
                                                    <span className="text-quiet">N/A</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-xs">
                                                {u.assetReturnCondition ? (
                                                    <span className="px-2 py-0.5 rounded bg-muted font-semibold text-ink">
                                                        {u.assetReturnCondition}
                                                    </span>
                                                ) : (
                                                    <span className="text-quiet">-</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-xs">
                                                {u.deviceWiped ? (
                                                    <span className="text-ink font-semibold">✓ Wiped</span>
                                                ) : (
                                                    <span className="text-quiet">Not Recorded</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-right">
                                                <button
                                                    onClick={() => {
                                                        setWizardUser(u);
                                                        setIsOffboardingOpen(true);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface text-ink hover:bg-surface transition-colors"
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
                <div className="bg-surface rounded-xl shadow-sm border border-line overflow-hidden">
                    <div tabIndex={0} role="region" aria-label="Data table; scroll horizontally for more columns" className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-canvas text-xs font-semibold text-quiet uppercase tracking-wider border-b border-line">
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
                            <tbody className="divide-y divide-line text-ink">
                                {users.filter(u => u.dispatchDetails || u.assetReturnDocket).length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-8 text-center text-quiet">
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
                                                    <tr className="hover:bg-canvas/80">
                                                        <td className="px-5 py-3.5 font-semibold text-ink">
                                                            {u.name}
                                                            <div className="text-xs text-quiet font-normal">{u.email}</div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface text-ink">
                                                                Outbound Dispatch
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 font-medium text-xs">{dispatch.courierName || 'In-Person'}</td>
                                                        <td className="px-4 py-3.5 font-mono text-xs">
                                                            {dispatch.docketNumber && (
                                                                <span className="text-ink font-semibold block">
                                                                    AWB: {dispatch.docketNumber}
                                                                </span>
                                                            )}
                                                            {dispatch.dcNumber && (
                                                                <span className="text-ink font-medium block">
                                                                    DC: #{dispatch.dcNumber}
                                                                </span>
                                                            )}
                                                            {!dispatch.docketNumber && !dispatch.dcNumber && <span className="text-quiet">N/A</span>}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-xs text-quiet max-w-xs truncate">
                                                            {dispatch.shippingAddress || dispatch.officeLocation || '-'}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-xs">{dispatch.dispatchDate || '-'}</td>
                                                        <td className="px-4 py-3.5 text-xs text-quiet">{dispatch.remarks || '-'}</td>
                                                    </tr>
                                                )}

                                                {returnDocket && (
                                                    <tr className="hover:bg-canvas/80 bg-surface/20">
                                                        <td className="px-5 py-3.5 font-semibold text-ink">
                                                            {u.name}
                                                            <div className="text-xs text-quiet font-normal">{u.email}</div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface text-ink">
                                                                Inbound Return
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 font-medium text-xs">{returnDocket.courier || 'In-Person'}</td>
                                                        <td className="px-4 py-3.5 font-mono text-xs text-ink font-semibold">
                                                            {returnDocket.docketNo || 'N/A'}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-xs text-quiet">-</td>
                                                        <td className="px-4 py-3.5 text-xs">{returnDocket.returnDate ? returnDocket.returnDate.split('T')[0] : '-'}</td>
                                                        <td className="px-4 py-3.5 text-xs text-quiet">{u.assetReturnRemarks || '-'}</td>
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
