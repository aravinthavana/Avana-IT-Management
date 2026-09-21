import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { SelfAudit, Asset, User, HardwareChecks } from '../../types';
import { ICONS, ASSET_ICONS } from '../../constants';
import AssignAuditModal from './AssignAuditModal';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

const SelfAuditsList: React.FC = () => {
    const { user } = useAuth();
    const { selfAudits, setSelfAudits, assets, users, getHeaders, setNotification, fetchAllData } = useAppContext();
    const isAdmin = user?.role === 'Admin';

    // Active View Tab: 'queue' (Review Audits) vs 'assign' (Targeted Assignment Dispatcher)
    const [activeTab, setActiveTab] = useState<'queue' | 'assign'>('queue');

    // Queue tab filters
    const [selectedAudit, setSelectedAudit] = useState<SelfAudit | null>(null);
    const [queueStatusFilter, setQueueStatusFilter] = useState<'All' | 'Pending Review' | 'Requested' | 'Approved' | 'Rejected'>('All');
    const [queueSearch, setQueueSearch] = useState('');
    const [queueCompany, setQueueCompany] = useState('All');

    // Review modal action states
    const [adminRemarks, setAdminRemarks] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [createTicket, setCreateTicket] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    // Dispatcher tab state & filters
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignSearch, setAssignSearch] = useState('');
    const [assignCompany, setAssignCompany] = useState('All');
    const [assignDepartment, setAssignDepartment] = useState('All');
    const [assignAuditStatusFilter, setAssignAuditStatusFilter] = useState<'All' | 'Never' | 'Active'>('All');
    const [selectedAssignKeys, setSelectedAssignKeys] = useState<Set<string>>(new Set());

    // --- KPI Metrics ---
    const metrics = useMemo(() => {
        const total = selfAudits.length;
        const requested = selfAudits.filter(a => a.status === 'Requested').length;
        const pendingReview = selfAudits.filter(a => a.status === 'Pending Review').length;
        const approved = selfAudits.filter(a => a.status === 'Approved').length;
        const rejected = selfAudits.filter(a => a.status === 'Rejected').length;
        return { total, requested, pendingReview, approved, rejected };
    }, [selfAudits]);

    // --- Filtered Queue Audits ---
    const filteredQueueAudits = useMemo(() => {
        return selfAudits.filter(audit => {
            if (queueStatusFilter !== 'All' && audit.status !== queueStatusFilter) {
                return false;
            }

            if (isAdmin && queueCompany !== 'All') {
                const comp = audit.user?.company || audit.asset?.company || '';
                if (comp.toLowerCase() !== queueCompany.toLowerCase()) return false;
            }

            if (queueSearch.trim()) {
                const q = queueSearch.toLowerCase();
                const userName = audit.user?.name?.toLowerCase() || '';
                const userEmail = audit.user?.email?.toLowerCase() || '';
                const assetName = audit.asset?.name?.toLowerCase() || '';
                const assetTag = audit.asset?.assetId?.toLowerCase() || '';
                const scannedTag = audit.scannedAssetId?.toLowerCase() || '';
                const remarks = audit.userRemarks?.toLowerCase() || audit.remarks?.toLowerCase() || '';
                if (!userName.includes(q) && !userEmail.includes(q) && !assetName.includes(q) && !assetTag.includes(q) && !scannedTag.includes(q) && !remarks.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [selfAudits, queueStatusFilter, queueCompany, queueSearch, isAdmin]);

    // --- Roster of Assigned Equipment for Dispatcher ---
    const fleetRoster = useMemo(() => {
        const roster: Array<{
            user: User;
            asset: Asset;
            activeAudit?: SelfAudit;
            lastAudit?: SelfAudit;
        }> = [];

        // Find all assets assigned to users
        assets.forEach(asset => {
            if (asset.status !== 'In Use' && asset.status !== 'Assigned') return;
            const targetUserId = asset.userId || (asset.assigneeType === 'User' ? asset.assigneeId : null);
            if (!targetUserId) return;

            const assignedUser = users.find(u => u.id === targetUserId);
            if (!assignedUser) return;

            // Find any active audit for this asset/user
            const activeAudit = selfAudits.find(a => 
                a.assetId === asset.id && 
                a.userId === targetUserId && 
                (a.status === 'Requested' || a.status === 'Pending Review')
            );

            // Find most recent completed audit
            const lastAudit = selfAudits.find(a => 
                a.assetId === asset.id && 
                a.userId === targetUserId && 
                a.status === 'Approved'
            );

            roster.push({ user: assignedUser, asset, activeAudit, lastAudit });
        });

        return roster;
    }, [assets, users, selfAudits]);

    // Filtered Dispatcher Roster
    const filteredRoster = useMemo(() => {
        return fleetRoster.filter(item => {
            const { user: u, asset: a, activeAudit, lastAudit } = item;

            if (assignCompany !== 'All') {
                const comp = u.company || a.company || '';
                if (comp.toLowerCase() !== assignCompany.toLowerCase()) return false;
            }

            if (assignDepartment !== 'All') {
                const deptName = u.department?.name || '';
                if (deptName.toLowerCase() !== assignDepartment.toLowerCase()) return false;
            }

            if (assignAuditStatusFilter === 'Never' && (lastAudit || a.lastAuditedAt)) {
                return false;
            }
            if (assignAuditStatusFilter === 'Active' && !activeAudit) {
                return false;
            }

            if (assignSearch.trim()) {
                const q = assignSearch.toLowerCase();
                const matchUser = u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.employeeId?.toLowerCase().includes(q) || u.jobTitle?.toLowerCase().includes(q);
                const matchAsset = a.name?.toLowerCase().includes(q) || a.assetId?.toLowerCase().includes(q) || a.serialNumber?.toLowerCase().includes(q);
                if (!matchUser && !matchAsset) return false;
            }

            return true;
        });
    }, [fleetRoster, assignCompany, assignDepartment, assignAuditStatusFilter, assignSearch]);

    // Toggle row selection in dispatcher
    const toggleAssignSelection = (key: string) => {
        const next = new Set(selectedAssignKeys);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelectedAssignKeys(next);
    };

    const handleSelectAllFiltered = () => {
        if (selectedAssignKeys.size === filteredRoster.length && filteredRoster.length > 0) {
            setSelectedAssignKeys(new Set());
        } else {
            const next = new Set<string>();
            filteredRoster.forEach(r => next.add(`${r.user.id}-${r.asset.id}`));
            setSelectedAssignKeys(next);
        }
    };

    // Items prepared for assignment modal
    const selectedAssignItems = useMemo(() => {
        return fleetRoster
            .filter(r => selectedAssignKeys.has(`${r.user.id}-${r.asset.id}`))
            .map(r => ({ user: r.user, asset: r.asset }));
    }, [fleetRoster, selectedAssignKeys]);

    // Handle Dispatch Action
    const handleConfirmAssign = async (dueDate: string | null, instructions: string, notifyEmail: boolean) => {
        try {
            const payload = {
                assignments: selectedAssignItems.map(i => ({ userId: i.user.id, assetId: i.asset.id })),
                dueDate,
                instructions,
                notifyEmail
            };

            const res = await fetch(`${API_URL}/api/self-audits/assign`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setNotification({ message: `Assigned self-audit verification to ${selectedAssignItems.length} employees!`, type: 'success' });
                setSelectedAssignKeys(new Set());
                fetchAllData().catch(() => {});
                setActiveTab('queue');
            } else {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to assign self-audits');
            }
        } catch (error: any) {
            setNotification({ message: error.message || 'Error assigning self-audits', type: 'error' });
        }
    };

    // Handle Review Decision (Approve / Reject)
    const handleUpdateAuditStatus = async (status: 'Approved' | 'Rejected') => {
        if (!selectedAudit) return;
        setIsSubmittingReview(true);
        try {
            const payload = {
                status,
                adminRemarks: adminRemarks.trim() || undefined,
                rejectionReason: status === 'Rejected' ? (rejectionReason.trim() || adminRemarks.trim()) : undefined,
                createTicket,
                ticketSubject: createTicket ? `Defect Flagged during Self-Audit: ${selectedAudit.asset?.name || 'Equipment'}` : undefined
            };

            const res = await fetch(`${API_URL}/api/self-audits/${selectedAudit.id}/status`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const updated = await res.json();
                setSelfAudits(selfAudits.map(a => a.id === updated.id ? updated : a));
                setNotification({
                    message: status === 'Approved' 
                        ? 'Self-audit approved & verified!' 
                        : 'Self-audit rejected. Feedback emailed to employee.',
                    type: 'success'
                });
                setSelectedAudit(null);
                setAdminRemarks('');
                setRejectionReason('');
                setCreateTicket(false);
                fetchAllData().catch(() => {});
            } else {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to update audit status');
            }
        } catch (error: any) {
            setNotification({ message: error.message || 'Error updating audit', type: 'error' });
        } finally {
            setIsSubmittingReview(false);
        }
    };

    // Parse hardware checks helper
    const parseChecks = (checks: any): HardwareChecks => {
        if (!checks) return {};
        if (typeof checks === 'object') return checks;
        try {
            return JSON.parse(checks);
        } catch {
            return {};
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Tab Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
                        <span>Equipment Self-Audits</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
                            Targeted Fleet Verification
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Selectively assign verification requests, inspect hardware health checklists, and escalate defects.
                    </p>
                </div>

                {isAdmin && (
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl">
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'queue'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            Audit Queue &amp; Review ({metrics.pendingReview})
                        </button>
                        <button
                            onClick={() => setActiveTab('assign')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'assign'
                                    ? 'bg-brand-600 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <span>+</span>
                            <span>Request Audits</span>
                        </button>
                    </div>
                )}
            </div>

            {/* TAB 1: AUDIT QUEUE & REVIEW */}
            {activeTab === 'queue' && (
                <div className="space-y-6">
                    {/* KPI Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Audits</span>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{metrics.total}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Awaiting IT Review</span>
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{metrics.pendingReview}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Waiting on Employee</span>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{metrics.requested}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Approved</span>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{metrics.approved}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-2 sm:col-span-1">
                            <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Rejected</span>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{metrics.rejected}</p>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            {/* Status Tabs */}
                            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
                                {(['All', 'Pending Review', 'Requested', 'Approved', 'Rejected'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setQueueStatusFilter(tab)}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                            queueStatusFilter === tab
                                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        {tab === 'Pending Review' ? 'Needs Review' : tab === 'Requested' ? 'Pending Submission' : tab}
                                    </button>
                                ))}
                            </div>

                            {/* Search and Company filter */}
                            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                                        {ICONS.search}
                                    </span>
                                    <input
                                        type="text"
                                        value={queueSearch}
                                        onChange={(e) => setQueueSearch(e.target.value)}
                                        placeholder="Search employee, asset, notes..."
                                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 text-slate-800 dark:text-white placeholder-slate-400"
                                    />
                                </div>

                                {isAdmin && (
                                    <select
                                        value={queueCompany}
                                        onChange={(e) => setQueueCompany(e.target.value)}
                                        className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 font-medium"
                                    >
                                        <option value="All">All Companies</option>
                                        <option value="AMD">AMD</option>
                                        <option value="ASSP">ASSP</option>
                                        <option value="ATS">ATS</option>
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Audits Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-5 py-3.5">Audit Date / Deadline</th>
                                        <th className="px-5 py-3.5">Employee</th>
                                        <th className="px-5 py-3.5">Assigned Asset</th>
                                        <th className="px-5 py-3.5">Reported Health</th>
                                        <th className="px-5 py-3.5">Photo Proof</th>
                                        <th className="px-5 py-3.5">Status</th>
                                        <th className="px-5 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredQueueAudits.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-400">
                                                No self-audits match your filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredQueueAudits.map(audit => {
                                            const icon = ASSET_ICONS[audit.asset?.category || ''] || ASSET_ICONS.default;

                                            return (
                                                <tr key={audit.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                                                    {/* Date & Deadline */}
                                                    <td className="px-5 py-4 whitespace-nowrap text-xs">
                                                        {audit.status === 'Requested' ? (
                                                            <div>
                                                                <span className="font-semibold text-amber-600 dark:text-amber-400">Due: {audit.dueDate ? new Date(audit.dueDate).toLocaleDateString() : 'Pending'}</span>
                                                                <p className="text-[11px] text-slate-400 mt-0.5">Requested on {audit.requestedAt ? new Date(audit.requestedAt).toLocaleDateString() : new Date(audit.auditDate).toLocaleDateString()}</p>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <span className="font-medium text-slate-800 dark:text-white">{audit.submittedAt ? new Date(audit.submittedAt).toLocaleDateString() : new Date(audit.auditDate).toLocaleDateString()}</span>
                                                                {audit.dueDate && <p className="text-[11px] text-slate-400">Deadline: {new Date(audit.dueDate).toLocaleDateString()}</p>}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Employee */}
                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-slate-900 dark:text-white text-xs">
                                                            {audit.user?.name || 'Unknown'}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                                                            {audit.user?.email}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {audit.user?.company && (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                                                                    {audit.user.company}
                                                                </span>
                                                            )}
                                                            {audit.user?.department?.name && (
                                                                <span className="text-[10px] text-slate-400">
                                                                    {audit.user.department.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Asset */}
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                                                                {icon}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                                                                    {audit.asset?.name || 'Device'}
                                                                </p>
                                                                <p className="font-mono text-[11px] text-slate-400">
                                                                    {audit.asset?.assetId}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Health & Condition */}
                                                    <td className="px-5 py-4 text-xs">
                                                        {audit.status === 'Requested' ? (
                                                            <span className="text-slate-400 italic">Not submitted yet</span>
                                                        ) : (
                                                            <div>
                                                                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                                    audit.condition === 'Good' 
                                                                        ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                                                                        : audit.condition === 'Minor Scratches'
                                                                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                                                            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
                                                                }`}>
                                                                    {audit.condition || 'Reported'}
                                                                </span>
                                                                {audit.location && (
                                                                    <p className="text-[11px] text-slate-400 mt-0.5">Loc: {audit.location}</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Photo Proof */}
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        {audit.imageUrl ? (
                                                            <div 
                                                                onClick={() => setSelectedAudit(audit)}
                                                                className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 cursor-pointer hover:scale-105 transition-transform"
                                                                title="Click to view full photo"
                                                            >
                                                                <img src={audit.imageUrl} alt="Proof" className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">No image</span>
                                                        )}
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                            audit.status === 'Approved' ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800' :
                                                            audit.status === 'Rejected' ? 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800' :
                                                            audit.status === 'Requested' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800' :
                                                            'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                                        }`}>
                                                            {audit.status === 'Requested' ? 'Pending Submission' : audit.status}
                                                        </span>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-5 py-4 text-right whitespace-nowrap space-x-2">
                                                        {audit.status === 'Pending Review' && isAdmin && (
                                                            <button
                                                                onClick={() => setSelectedAudit(audit)}
                                                                className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                                            >
                                                                Review Audit
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setSelectedAudit(audit)}
                                                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-block"
                                                            title="View Details"
                                                        >
                                                            <span className="w-4 h-4 block">{ICONS.view}</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: TARGETED DISPATCHER (REQUEST AUDITS) */}
            {activeTab === 'assign' && (
                <div className="space-y-6">
                    {/* Top Dispatcher Header & Info Banner */}
                    <div className="p-4 bg-brand-50/60 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-900/40 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <span>🎯 Manual Audit Assignment Roster</span>
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                Select specific employees with assigned equipment to request an audit. Unselected employees and top executives will not receive any banners or reminders.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsAssignModalOpen(true)}
                            disabled={selectedAssignKeys.size === 0}
                            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 shrink-0"
                        >
                            <span>Assign Self-Audit ({selectedAssignKeys.size})</span>
                        </button>
                    </div>

                    {/* Roster Filter Bar */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3 flex-1">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                                    {ICONS.search}
                                </span>
                                <input
                                    type="text"
                                    value={assignSearch}
                                    onChange={(e) => setAssignSearch(e.target.value)}
                                    placeholder="Filter by name, title, asset..."
                                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 text-slate-800 dark:text-white"
                                />
                            </div>

                            {/* Company Filter */}
                            <select
                                value={assignCompany}
                                onChange={(e) => setAssignCompany(e.target.value)}
                                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200"
                            >
                                <option value="All">All Companies</option>
                                <option value="AMD">AMD</option>
                                <option value="ASSP">ASSP</option>
                                <option value="ATS">ATS</option>
                            </select>

                            {/* Audit History Filter */}
                            <select
                                value={assignAuditStatusFilter}
                                onChange={(e) => setAssignAuditStatusFilter(e.target.value as any)}
                                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200"
                            >
                                <option value="All">All Audit Histories</option>
                                <option value="Never">Never Audited</option>
                                <option value="Active">Currently Active Audit</option>
                            </select>
                        </div>

                        {/* Select All */}
                        <div className="flex items-center gap-2 text-xs">
                            <button
                                onClick={handleSelectAllFiltered}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold transition-colors"
                            >
                                {selectedAssignKeys.size === filteredRoster.length && filteredRoster.length > 0 ? 'Deselect All' : `Select All Filtered (${filteredRoster.length})`}
                            </button>
                        </div>
                    </div>

                    {/* Roster Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="w-12 px-5 py-3.5 text-center">
                                            <input
                                                type="checkbox"
                                                checked={filteredRoster.length > 0 && selectedAssignKeys.size === filteredRoster.length}
                                                onChange={handleSelectAllFiltered}
                                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                                            />
                                        </th>
                                        <th className="px-5 py-3.5">Employee</th>
                                        <th className="px-5 py-3.5">Assigned Asset</th>
                                        <th className="px-5 py-3.5">Last Audited Date</th>
                                        <th className="px-5 py-3.5">Active Audit Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredRoster.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-slate-400">
                                                No assigned equipment found matching filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRoster.map(({ user: u, asset: a, activeAudit, lastAudit }) => {
                                            const key = `${u.id}-${a.id}`;
                                            const isSelected = selectedAssignKeys.has(key);

                                            return (
                                                <tr
                                                    key={key}
                                                    onClick={() => toggleAssignSelection(key)}
                                                    className={`transition-colors cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-brand-50/50 dark:bg-brand-950/30'
                                                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/40'
                                                    }`}
                                                >
                                                    <td className="px-5 py-4 text-center" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleAssignSelection(key)}
                                                            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                                                        />
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-slate-900 dark:text-white text-xs">
                                                            {u.name}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400">
                                                            {u.jobTitle ? `${u.jobTitle} • ` : ''}{u.email}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {u.company && (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                                                                    {u.company}
                                                                </span>
                                                            )}
                                                            {u.department?.name && (
                                                                <span className="text-[10px] text-slate-400">
                                                                    {u.department.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-xs text-slate-900 dark:text-white">
                                                            {a.name}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            Tag: <span className="font-mono">{a.assetId}</span> &bull; {a.category}
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 text-xs whitespace-nowrap">
                                                        {a.lastAuditedAt ? (
                                                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                                {new Date(a.lastAuditedAt).toLocaleDateString()}
                                                            </span>
                                                        ) : lastAudit?.submittedAt ? (
                                                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                                {new Date(lastAudit.submittedAt).toLocaleDateString()}
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                                                                Never Audited
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="px-5 py-4 whitespace-nowrap text-xs">
                                                        {activeAudit ? (
                                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                                activeAudit.status === 'Requested'
                                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                            }`}>
                                                                {activeAudit.status === 'Requested' ? 'Audit Requested' : 'Submitted (Review Pending)'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-[11px] italic">No active audit</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Comprehensive Review Modal */}
            {selectedAudit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedAudit(null)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Review Self-Audit: {selectedAudit.asset?.name || 'Equipment'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Submitted by {selectedAudit.user?.name || 'User'} &bull; Asset Tag: <span className="font-mono font-bold">{selectedAudit.asset?.assetId}</span>
                                </p>
                            </div>
                            <button onClick={() => setSelectedAudit(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                                {ICONS.close}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-300">
                            {/* Overview Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Location</span>
                                    <p className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{selectedAudit.location || 'Not specified'}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Physical Condition</span>
                                    <p className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{selectedAudit.condition || 'Not specified'}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Tag Verified</span>
                                    <p className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5">{selectedAudit.scannedAssetId || 'N/A'}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Status</span>
                                    <p className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{selectedAudit.status}</p>
                                </div>
                            </div>

                            {/* Hardware health checks */}
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider mb-2">
                                    Hardware Component Verification
                                </h4>
                                {(() => {
                                    const checks = parseChecks(selectedAudit.hardwareChecks);
                                    return (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-600 text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <span className={checks.screenOk ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{checks.screenOk ? '✓' : '✗'}</span>
                                                <span>Screen / Display</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={checks.keyboardOk ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{checks.keyboardOk ? '✓' : '✗'}</span>
                                                <span>Keyboard / Touchpad</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={checks.batteryOk ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{checks.batteryOk ? '✓' : '✗'}</span>
                                                <span>Battery Backup</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={checks.chargerOk ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{checks.chargerOk ? '✓' : '✗'}</span>
                                                <span>Power Adapter</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={checks.bodyOk ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{checks.bodyOk ? '✓' : '✗'}</span>
                                                <span>Chassis / Hinges</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Employee remarks */}
                            {(selectedAudit.userRemarks || selectedAudit.remarks) && (
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider mb-1">
                                        Employee Notes
                                    </h4>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-600 whitespace-pre-wrap">
                                        {selectedAudit.userRemarks || selectedAudit.remarks}
                                    </div>
                                </div>
                            )}

                            {/* Photo Proof */}
                            {selectedAudit.imageUrl && (
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider mb-1.5">
                                        Photo Proof
                                    </h4>
                                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 flex justify-center max-h-72">
                                        <img src={selectedAudit.imageUrl} alt="Audit Proof" className="max-h-72 object-contain" />
                                    </div>
                                </div>
                            )}

                            {/* Reviewer inputs (if actionable) */}
                            {isAdmin && selectedAudit.status === 'Pending Review' && (
                                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                            Admin Verification Notes (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={adminRemarks}
                                            onChange={e => setAdminRemarks(e.target.value)}
                                            placeholder="e.g., Verified physical condition and serial tag."
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
                                        />
                                    </div>

                                    {/* Defect escalation toggle */}
                                    <div className="p-3 bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl">
                                        <label className="flex items-start gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={createTicket}
                                                onChange={e => setCreateTicket(e.target.checked)}
                                                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 mt-0.5"
                                            />
                                            <div>
                                                <span className="font-bold text-red-900 dark:text-red-200 block text-xs">
                                                    Escalate Defect to IT Support Ticket
                                                </span>
                                                <span className="text-[11px] text-red-700 dark:text-red-300 block mt-0.5">
                                                    Automatically create an open high-priority support ticket linked to this asset and user for hardware repair or charger replacement.
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end items-center gap-3">
                            <button
                                onClick={() => setSelectedAudit(null)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                Close
                            </button>

                            {isAdmin && selectedAudit.status === 'Pending Review' && (
                                <>
                                    <button
                                        onClick={() => handleUpdateAuditStatus('Rejected')}
                                        disabled={isSubmittingReview}
                                        className="px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => handleUpdateAuditStatus('Approved')}
                                        disabled={isSubmittingReview}
                                        className="px-5 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {isSubmittingReview ? 'Processing...' : 'Approve & Verify'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Assigning Audits */}
            <AssignAuditModal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                selectedItems={selectedAssignItems}
                onConfirm={handleConfirmAssign}
            />
        </div>
    );
};

export default SelfAuditsList;
