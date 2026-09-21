import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { SelfAudit, Asset, User, HardwareChecks, AssetDeclaration, DeclaredAssetItem } from '../../types';
import { ICONS, ASSET_ICONS } from '../../constants';
import AssignAuditModal from './AssignAuditModal';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

const SelfAuditsList: React.FC = () => {
    const { user } = useAuth();
    const { selfAudits, setSelfAudits, assets, users, getHeaders, setNotification, fetchAllData } = useAppContext();
    const isAdmin = user?.role === 'Admin';

    // Active View Tab: 'queue' (Review Audits) vs 'assign' (Targeted Assignment Dispatcher) vs 'reconcile' (Pre-Audit Declarations & Ghost Assets)
    const [activeTab, setActiveTab] = useState<'queue' | 'assign' | 'reconcile'>('queue');

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

    // Declarations & Reconciliation state
    const [declarations, setDeclarations] = useState<AssetDeclaration[]>([]);
    const [isLoadingDeclarations, setIsLoadingDeclarations] = useState(false);
    const [reconcileSearch, setReconcileSearch] = useState('');
    const [reconcileStatusFilter, setReconcileStatusFilter] = useState<'All' | 'Pending Review' | 'Reconciled'>('All');
    const [reconcileCompany, setReconcileCompany] = useState('All');
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    // Ghost Asset Registration Modal state
    const [convertingDeclaration, setConvertingDeclaration] = useState<AssetDeclaration | null>(null);
    const [convertingItem, setConvertingItem] = useState<DeclaredAssetItem | null>(null);
    const [convertAssetTag, setConvertAssetTag] = useState('');
    const [convertCategory, setConvertCategory] = useState('Laptop');
    const [convertCompany, setConvertCompany] = useState('AMD');
    const [convertLocation, setConvertLocation] = useState('Head Office');
    const [isConverting, setIsConverting] = useState(false);

    const fetchDeclarations = async () => {
        setIsLoadingDeclarations(true);
        try {
            const res = await fetch(`${API_URL}/api/asset-declarations`, {
                headers: getHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setDeclarations(data);
            }
        } catch (err) {
            console.error('Failed to load declarations:', err);
        } finally {
            setIsLoadingDeclarations(false);
        }
    };

    useEffect(() => {
        fetchDeclarations();
    }, []);

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

    // Reconciliation metrics
    const reconcileMetrics = useMemo(() => {
        const total = declarations.length;
        const discrepancies = declarations.filter(d => !d.systemRecordsOk).length;
        const pending = declarations.filter(d => d.status !== 'Reconciled').length;
        const reconciled = declarations.filter(d => d.status === 'Reconciled').length;
        
        let ghostCount = 0;
        declarations.forEach(d => {
            try {
                const items: DeclaredAssetItem[] = JSON.parse(d.declaredItems || '[]');
                ghostCount += items.filter(it => it.isGhost && !it.convertedAssetId).length;
            } catch (_) {}
        });

        return { total, discrepancies, pending, reconciled, ghostCount };
    }, [declarations]);

    const filteredDeclarations = useMemo(() => {
        return declarations.filter(d => {
            if (reconcileStatusFilter !== 'All' && d.status !== reconcileStatusFilter) return false;
            if (reconcileCompany !== 'All' && d.user?.company !== reconcileCompany) return false;
            if (reconcileSearch.trim()) {
                const q = reconcileSearch.toLowerCase();
                const uName = (d.user?.name || '').toLowerCase();
                const uEmail = (d.user?.email || '').toLowerCase();
                const notes = (d.discrepancyNotes || '').toLowerCase();
                const itemsStr = (d.declaredItems || '').toLowerCase();
                return uName.includes(q) || uEmail.includes(q) || notes.includes(q) || itemsStr.includes(q);
            }
            return true;
        });
    }, [declarations, reconcileStatusFilter, reconcileCompany, reconcileSearch]);

    const handleOpenConvertModal = (declaration: AssetDeclaration, item: DeclaredAssetItem) => {
        setConvertingDeclaration(declaration);
        setConvertingItem(item);
        const comp = declaration.user?.company || 'AMD';
        const cat = item.category || 'Laptop';
        const compPrefix = comp.slice(0, 3).toUpperCase();
        const catPrefix = cat.slice(0, 3).toUpperCase();
        const rand = Math.floor(1000 + Math.random() * 9000);
        setConvertAssetTag(`${compPrefix}-${catPrefix}-${rand}`);
        setConvertCategory(cat);
        setConvertCompany(comp);
        setConvertLocation(item.location || declaration.user?.location || 'Head Office');
    };

    const handleConfirmConvertGhost = async () => {
        if (!convertingDeclaration || !convertingItem) return;
        setIsConverting(true);
        try {
            const res = await fetch(`${API_URL}/api/asset-declarations/${convertingDeclaration.id}/convert-ghost-asset`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    itemId: convertingItem.id,
                    assetIdTag: convertAssetTag.trim(),
                    category: convertCategory,
                    company: convertCompany,
                    location: convertLocation
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to register asset.');
            }

            setNotification({ message: `Successfully registered "${convertingItem.name}" (${convertAssetTag}) into official inventory!`, type: 'success' });
            setConvertingDeclaration(null);
            setConvertingItem(null);
            fetchDeclarations();
            fetchAllData().catch(() => {});
        } catch (error: any) {
            setNotification({ message: error.message || 'Error registering asset', type: 'error' });
        } finally {
            setIsConverting(false);
        }
    };

    const handleReconcileDeclaration = async (declarationId: number) => {
        try {
            const res = await fetch(`${API_URL}/api/asset-declarations/${declarationId}/reconcile`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({ status: 'Reconciled' })
            });

            if (!res.ok) throw new Error('Failed to reconcile declaration.');
            setNotification({ message: 'Declaration marked as Reconciled.', type: 'success' });
            fetchDeclarations();
        } catch (err: any) {
            setNotification({ message: err.message || 'Error reconciling declaration', type: 'error' });
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
                            Audit Queue ({metrics.pendingReview})
                        </button>
                        <button
                            onClick={() => setActiveTab('reconcile')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'reconcile'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <span>Asset Reconciliation</span>
                            {reconcileMetrics.ghostCount > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                    activeTab === 'reconcile' ? 'bg-white text-purple-700' : 'bg-purple-600 text-white'
                                }`}>
                                    {reconcileMetrics.ghostCount} Ghost
                                </span>
                            )}
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

            {/* TAB 3: ASSET RECONCILIATION & GHOST ASSETS */}
            {activeTab === 'reconcile' && (
                <div className="space-y-6 animate-fade-in">
                    {/* KPI Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Declarations</span>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{reconcileMetrics.total}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-purple-200 dark:border-purple-900/50 shadow-sm bg-purple-50/20">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span>👻 Ghost Assets Declared</span>
                            </span>
                            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{reconcileMetrics.ghostCount}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm bg-amber-50/20">
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Discrepancies Reported</span>
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{reconcileMetrics.discrepancies}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Reconciled Cleanly</span>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{reconcileMetrics.reconciled}</p>
                        </div>
                    </div>

                    {/* Filter / Search bar */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                        <div className="flex-1 flex flex-wrap items-center gap-3">
                            <input
                                type="text"
                                value={reconcileSearch}
                                onChange={(e) => setReconcileSearch(e.target.value)}
                                placeholder="Search by employee, items, or discrepancy remarks..."
                                className="w-full sm:w-72 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
                            />

                            <select
                                value={reconcileStatusFilter}
                                onChange={(e) => setReconcileStatusFilter(e.target.value as any)}
                                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Pending Review">Pending Review</option>
                                <option value="Reconciled">Reconciled</option>
                            </select>

                            <select
                                value={reconcileCompany}
                                onChange={(e) => setReconcileCompany(e.target.value)}
                                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200"
                            >
                                <option value="All">All Companies</option>
                                <option value="AMD">AMD</option>
                                <option value="ASSP">ASSP</option>
                                <option value="ATS">ATS</option>
                            </select>
                        </div>

                        <button
                            onClick={fetchDeclarations}
                            disabled={isLoadingDeclarations}
                            className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-end sm:self-auto"
                        >
                            <span>🔄</span>
                            <span>{isLoadingDeclarations ? 'Refreshing...' : 'Refresh'}</span>
                        </button>
                    </div>

                    {/* Declarations List */}
                    <div className="space-y-4">
                        {filteredDeclarations.length === 0 ? (
                            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 text-sm">
                                No asset declarations found matching filters.
                            </div>
                        ) : (
                            filteredDeclarations.map((dec) => {
                                let items: DeclaredAssetItem[] = [];
                                try {
                                    items = JSON.parse(dec.declaredItems || '[]');
                                } catch (_) {}

                                return (
                                    <div
                                        key={dec.id}
                                        className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 transition-all hover:border-brand-300 dark:hover:border-slate-600"
                                    >
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-sm">
                                                    {dec.user?.name?.charAt(0) || 'U'}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                                        {dec.user?.name}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {dec.user?.email} &bull; {dec.user?.company || 'AMD'} &bull; {dec.user?.department?.name || 'Department'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    dec.systemRecordsOk
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse'
                                                }`}>
                                                    {dec.systemRecordsOk ? '✅ Records Matched' : '⚠️ Discrepancy Reported'}
                                                </span>

                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    dec.status === 'Reconciled'
                                                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                }`}>
                                                    {dec.status}
                                                </span>

                                                {dec.status !== 'Reconciled' && (
                                                    <button
                                                        onClick={() => handleReconcileDeclaration(dec.id)}
                                                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
                                                    >
                                                        Mark Reconciled
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Discrepancy Remarks Callout */}
                                        {dec.discrepancyNotes && (
                                            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                                                <strong>Employee Discrepancy Remarks:</strong> &ldquo;{dec.discrepancyNotes}&rdquo;
                                            </div>
                                        )}

                                        {/* Declared Items List */}
                                        <div>
                                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                Declared Equipment ({items.length} items)
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {items.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                                                            item.isGhost && !item.convertedAssetId
                                                                ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40'
                                                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                                                <span className="font-bold text-slate-900 dark:text-white">
                                                                    {item.name}
                                                                </span>
                                                                {item.isGhost && !item.convertedAssetId ? (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-purple-600 text-white shrink-0">
                                                                        Ghost Asset
                                                                    </span>
                                                                ) : item.convertedAssetTag ? (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-green-600 text-white shrink-0">
                                                                        {item.convertedAssetTag}
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                                                                        Matched
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                {item.category} {item.brand ? `• ${item.brand}` : ''} {item.serialNumber ? `• SN: ${item.serialNumber}` : ''}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                                Condition: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.condition || 'Good'}</span> &bull; {item.location || 'Head Office'}
                                                            </p>
                                                        </div>

                                                        {/* Photo Proof thumbnail & 1-Click Register button */}
                                                        <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                                                            {item.imageUrl ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setImagePreviewUrl(item.imageUrl!)}
                                                                    className="flex items-center gap-1.5 text-[11px] font-bold text-brand-600 hover:text-brand-700"
                                                                >
                                                                    <img src={item.imageUrl} alt="Proof" className="w-6 h-6 rounded object-cover border border-slate-300" />
                                                                    <span>View Photo Proof</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 italic">No photo attached</span>
                                                            )}

                                                            {item.isGhost && !item.convertedAssetId && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenConvertModal(dec, item)}
                                                                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1 ml-auto"
                                                                >
                                                                    <span>✨ 1-Click Register</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
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

            {/* Modal for 1-Click Ghost Asset Registration */}
            {convertingDeclaration && convertingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={() => { setConvertingDeclaration(null); setConvertingItem(null); }}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-purple-50 dark:bg-purple-950/40">
                            <div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white">
                                    Ghost Asset Registration
                                </span>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                                    Register &ldquo;{convertingItem.name}&rdquo; into Official Inventory
                                </h3>
                            </div>
                            <button
                                onClick={() => { setConvertingDeclaration(null); setConvertingItem(null); }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {convertingItem.imageUrl && (
                                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-40 bg-black flex items-center justify-center">
                                    <img src={convertingItem.imageUrl} alt="Declared Photo Proof" className="max-h-40 object-contain" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                        Assignee
                                    </label>
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        {convertingDeclaration.user?.name}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                        Reported Condition
                                    </label>
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        {convertingItem.condition || 'Good'}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                    Asset ID / Tag <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={convertAssetTag}
                                    onChange={(e) => setConvertAssetTag(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-mono font-bold text-brand-600 dark:text-brand-400"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                        Company
                                    </label>
                                    <select
                                        value={convertCompany}
                                        onChange={(e) => setConvertCompany(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                                    >
                                        <option value="AMD">AMD</option>
                                        <option value="ASSP">ASSP</option>
                                        <option value="ATS">ATS</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={convertCategory}
                                        onChange={(e) => setConvertCategory(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                                    >
                                        <option value="Laptop">Laptop</option>
                                        <option value="Desktop">Desktop</option>
                                        <option value="Monitor">Monitor</option>
                                        <option value="Keyboard">Keyboard</option>
                                        <option value="Mouse">Mouse</option>
                                        <option value="Headset">Headset</option>
                                        <option value="Dock">Dock</option>
                                        <option value="Storage">Pen Drive / Storage</option>
                                        <option value="Mobile">Mobile / Tablet</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setConvertingDeclaration(null); setConvertingItem(null); }}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isConverting || !convertAssetTag.trim()}
                                onClick={handleConfirmConvertGhost}
                                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                                {isConverting ? 'Registering...' : 'Confirm & Register into Inventory'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Zoom Modal */}
            {imagePreviewUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setImagePreviewUrl(null)}>
                    <div className="relative max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-black" onClick={e => e.stopPropagation()}>
                        <img src={imagePreviewUrl} alt="Enlarged proof" className="max-w-full max-h-[85vh] object-contain" />
                        <button
                            type="button"
                            onClick={() => setImagePreviewUrl(null)}
                            className="absolute top-3 right-3 px-3 py-1 bg-black/70 hover:bg-black text-white rounded-lg text-xs font-bold"
                        >
                            ✕ Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SelfAuditsList;
