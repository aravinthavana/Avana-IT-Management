import { API_URL } from '../../utils/apiClient';
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { SelfAudit, Asset, User, HardwareChecks, AssetDeclaration, DeclaredAssetItem, AccessoryBatch } from '../../types';
import { ICONS, ASSET_ICONS } from '../../constants';
import AssignAuditModal from './AssignAuditModal';
import { useAuth } from '../../contexts/AuthContext';


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

    // Declared Accessory to Profile Reconciliation state
    const [reconcileAccDeclaration, setReconcileAccDeclaration] = useState<AssetDeclaration | null>(null);
    const [reconcileAccItem, setReconcileAccItem] = useState<DeclaredAssetItem | null>(null);
    const [accessoryBatches, setAccessoryBatches] = useState<AccessoryBatch[]>([]);
    const [selectedAccBatchId, setSelectedAccBatchId] = useState<number | ''>('');
    const [accCategory, setAccCategory] = useState('Mouse');
    const [accName, setAccName] = useState('');
    const [accBrand, setAccBrand] = useState('');
    const [accSerial, setAccSerial] = useState('');
    const [accCondition, setAccCondition] = useState('Good');
    const [accNotes, setAccNotes] = useState('');
    const [isReconcilingAcc, setIsReconcilingAcc] = useState(false);
    const [isBulkReconcilingId, setIsBulkReconcilingId] = useState<number | null>(null);

    const fetchAccessoryBatches = async () => {
        try {
            const res = await fetch(`${API_URL}/api/accessories/batches`, {
                headers: getHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setAccessoryBatches(data);
            }
        } catch (err) {
            console.error('Failed to load accessory batches:', err);
        }
    };

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

    const isPeripheralCategory = (category?: string) => {
        if (!category) return true;
        const cat = category.toLowerCase();
        return !['laptop', 'desktop', 'macbook', 'imac', 'server', 'workstation'].includes(cat);
    };

    const handleOpenReconcileAccModal = (declaration: AssetDeclaration, item: DeclaredAssetItem) => {
        setReconcileAccDeclaration(declaration);
        setReconcileAccItem(item);
        setAccCategory(item.category || 'Mouse');
        setAccName(item.name || `${item.category || 'Peripheral'}`);
        setAccBrand(item.brand || '');
        setAccSerial(item.serialNumber || '');
        setAccCondition(item.condition || 'Good');
        setAccNotes('Reconciled from employee self-audit declaration.');
        setSelectedAccBatchId('');
        fetchAccessoryBatches();
    };

    const handleConfirmReconcileAcc = async () => {
        if (!reconcileAccDeclaration || !reconcileAccItem) return;
        setIsReconcilingAcc(true);
        try {
            const res = await fetch(`${API_URL}/api/asset-declarations/${reconcileAccDeclaration.id}/reconcile-accessories`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    items: [{
                        itemId: reconcileAccItem.id,
                        batchId: selectedAccBatchId ? Number(selectedAccBatchId) : undefined,
                        category: accCategory,
                        name: accName.trim(),
                        brand: accBrand.trim() || undefined,
                        serialNumber: accSerial.trim() || undefined,
                        condition: accCondition,
                        notes: accNotes.trim() || undefined
                    }]
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to save accessory to profile.');
            }

            const data = await res.json();
            setNotification({
                message: data.message || `Added "${accName}" to ${reconcileAccDeclaration.user?.name}'s profile accessories!`,
                type: 'success'
            });
            setReconcileAccDeclaration(null);
            setReconcileAccItem(null);
            fetchDeclarations();
        } catch (error: any) {
            setNotification({ message: error.message || 'Error saving accessory', type: 'error' });
        } finally {
            setIsReconcilingAcc(false);
        }
    };

    const handleBulkReconcileAllPeripherals = async (declaration: AssetDeclaration, itemsToReconcile: DeclaredAssetItem[]) => {
        if (itemsToReconcile.length === 0) return;
        setIsBulkReconcilingId(declaration.id);
        try {
            const payloadItems = itemsToReconcile.map(i => ({
                itemId: i.id,
                category: i.category || 'Other',
                name: i.name || `${i.category || 'Peripheral'}`,
                brand: i.brand || undefined,
                serialNumber: i.serialNumber || undefined,
                condition: i.condition || 'Good',
                notes: 'Quick bulk-reconciled from self-audit.'
            }));

            const res = await fetch(`${API_URL}/api/asset-declarations/${declaration.id}/reconcile-accessories`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({ items: payloadItems })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to bulk-reconcile accessories.');
            }

            const data = await res.json();
            setNotification({
                message: data.message || `Saved ${itemsToReconcile.length} accessories to ${declaration.user?.name}'s profile!`,
                type: 'success'
            });
            fetchDeclarations();
        } catch (error: any) {
            setNotification({ message: error.message || 'Error bulk reconciling accessories', type: 'error' });
        } finally {
            setIsBulkReconcilingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Tab Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-ink flex items-center gap-2.5">
                        <span>Equipment Self-Audits</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-quiet font-semibold uppercase tracking-wider">
                            Targeted Fleet Verification
                        </span>
                    </h2>
                    <p className="text-sm text-quiet mt-1">
                        Selectively assign verification requests, inspect hardware health checklists, and escalate defects.
                    </p>
                </div>

                {isAdmin && (
                    <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl">
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'queue'
                                    ? 'bg-surface  text-ink  shadow-sm'
                                    : 'text-quiet  hover:text-ink '
                            }`}
                        >
                            Audit Queue ({metrics.pendingReview})
                        </button>
                        <button
                            onClick={() => setActiveTab('reconcile')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'reconcile'
                                    ? 'bg-olive text-on-strong shadow-sm'
                                    : 'text-quiet  hover:text-ink '
                            }`}
                        >
                            <span>Asset Reconciliation</span>
                            {reconcileMetrics.ghostCount > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                    activeTab === 'reconcile' ? 'bg-surface text-ink' : 'bg-olive text-on-strong'
                                }`}>
                                    {reconcileMetrics.ghostCount} Ghost
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('assign')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'assign'
                                    ? 'bg-accent text-on-strong shadow-sm'
                                    : 'text-quiet  hover:text-ink '
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
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-quiet uppercase tracking-wider">Total Audits</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.total}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Awaiting IT Review</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.pendingReview}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Waiting on Employee</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.requested}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Approved</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.approved}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm col-span-2 sm:col-span-1">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Rejected</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.rejected}</p>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            {/* Status Tabs */}
                            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted rounded-xl">
                                {(['All', 'Pending Review', 'Requested', 'Approved', 'Rejected'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setQueueStatusFilter(tab)}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                            queueStatusFilter === tab
                                                ? 'bg-surface  text-ink  shadow-sm'
                                                : 'text-quiet  hover:text-ink '
                                        }`}
                                    >
                                        {tab === 'Pending Review' ? 'Needs Review' : tab === 'Requested' ? 'Pending Submission' : tab}
                                    </button>
                                ))}
                            </div>

                            {/* Search and Company filter */}
                            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-quiet pointer-events-none">
                                        {ICONS.search}
                                    </span>
                                    <input
                                        type="text"
                                        value={queueSearch}
                                        onChange={(e) => setQueueSearch(e.target.value)}
                                        placeholder="Search employee, asset, notes..."
                                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-canvas border border-line rounded-xl focus:ring-2 focus:ring-accent text-ink placeholder-quiet"
                                    />
                                </div>

                                {isAdmin && (
                                    <select
                                        value={queueCompany}
                                        onChange={(e) => setQueueCompany(e.target.value)}
                                        className="px-3 py-1.5 text-xs bg-canvas border border-line rounded-xl text-ink focus:ring-2 focus:ring-accent font-medium"
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
                    <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
                        <div tabIndex={0} role="region" aria-label="Self audits table; scroll horizontally for more columns" className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-quiet">
                                <thead className="bg-canvas text-ink text-xs uppercase tracking-wider font-semibold border-b border-line">
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
                                <tbody className="divide-y divide-line">
                                    {filteredQueueAudits.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-quiet">
                                                No self-audits match your filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredQueueAudits.map(audit => {
                                            const icon = ASSET_ICONS[audit.asset?.category || ''] || ASSET_ICONS.default;

                                            return (
                                                <tr key={audit.id} className="hover:bg-canvas/80 transition-colors">
                                                    {/* Date & Deadline */}
                                                    <td className="px-5 py-4 whitespace-nowrap text-xs">
                                                        {audit.status === 'Requested' ? (
                                                            <div>
                                                                <span className="font-semibold text-ink">Due: {audit.dueDate ? new Date(audit.dueDate).toLocaleDateString() : 'Pending'}</span>
                                                                <p className="text-[11px] text-quiet mt-0.5">Requested on {audit.requestedAt ? new Date(audit.requestedAt).toLocaleDateString() : new Date(audit.auditDate).toLocaleDateString()}</p>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <span className="font-medium text-ink">{audit.submittedAt ? new Date(audit.submittedAt).toLocaleDateString() : new Date(audit.auditDate).toLocaleDateString()}</span>
                                                                {audit.dueDate && <p className="text-[11px] text-quiet">Deadline: {new Date(audit.dueDate).toLocaleDateString()}</p>}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Employee */}
                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-ink text-xs">
                                                            {audit.user?.name || 'Unknown'}
                                                        </div>
                                                        <div className="text-[11px] text-quiet truncate max-w-[130px]">
                                                            {audit.user?.email}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {audit.user?.company && (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface text-ink font-medium">
                                                                    {audit.user.company}
                                                                </span>
                                                            )}
                                                            {audit.user?.department?.name && (
                                                                <span className="text-[10px] text-quiet">
                                                                    {audit.user.department.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Asset */}
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 p-1 rounded bg-muted text-quiet shrink-0">
                                                                {icon}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-xs text-ink">
                                                                    {audit.asset?.name || 'Device'}
                                                                </p>
                                                                <p className="font-mono text-[11px] text-quiet">
                                                                    {audit.asset?.assetId}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Health & Condition */}
                                                    <td className="px-5 py-4 text-xs">
                                                        {audit.status === 'Requested' ? (
                                                            <span className="text-quiet italic">Not submitted yet</span>
                                                        ) : (
                                                            <div>
                                                                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                                    audit.condition === 'Good'
                                                                        ? 'bg-surface text-ink  '
                                                                        : audit.condition === 'Minor Scratches'
                                                                            ? 'bg-surface text-ink  '
                                                                            : 'bg-surface text-ink   border border-line '
                                                                }`}>
                                                                    {audit.condition || 'Reported'}
                                                                </span>
                                                                {audit.location && (
                                                                    <p className="text-[11px] text-quiet mt-0.5">Loc: {audit.location}</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Photo Proof */}
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        {audit.imageUrl ? (
                                                            <div
                                                                onClick={() => setSelectedAudit(audit)}
                                                                className="w-10 h-10 rounded-lg overflow-hidden border border-line cursor-pointer hover:scale-105 transition-transform"
                                                                title="Click to view full photo"
                                                            >
                                                                <img src={audit.imageUrl} alt="Proof" className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-quiet italic">No image</span>
                                                        )}
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                            audit.status === 'Approved' ? 'bg-surface text-ink   border border-line ' :
                                                            audit.status === 'Rejected' ? 'bg-surface text-ink   border border-line ' :
                                                            audit.status === 'Requested' ? 'bg-surface text-ink   border border-line ' :
                                                            'bg-surface text-ink   border border-line '
                                                        }`}>
                                                            {audit.status === 'Requested' ? 'Pending Submission' : audit.status}
                                                        </span>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-5 py-4 text-right whitespace-nowrap space-x-2">
                                                        {audit.status === 'Pending Review' && isAdmin && (
                                                            <button
                                                                onClick={() => setSelectedAudit(audit)}
                                                                className="px-3 py-1 bg-accent hover:bg-accent text-on-strong rounded-lg text-xs font-bold transition-colors shadow-sm"
                                                            >
                                                                Review Audit
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setSelectedAudit(audit)}
                                                            className="p-1.5 text-quiet hover:text-quiet rounded-lg hover:bg-muted transition-colors inline-block"
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
                    <div className="p-4 bg-surface/60 border border-accent rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                                <span>🎯 Manual Audit Assignment Roster</span>
                            </h3>
                            <p className="text-xs text-quiet mt-0.5">
                                Select specific employees with assigned equipment to request an audit. Unselected employees and top executives will not receive any banners or reminders.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsAssignModalOpen(true)}
                            disabled={selectedAssignKeys.size === 0}
                            className="px-5 py-2.5 bg-accent hover:bg-accent disabled:opacity-50 text-on-strong rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 shrink-0"
                        >
                            <span>Assign Self-Audit ({selectedAssignKeys.size})</span>
                        </button>
                    </div>

                    {/* Roster Filter Bar */}
                    <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3 flex-1">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-quiet pointer-events-none">
                                    {ICONS.search}
                                </span>
                                <input
                                    type="text"
                                    value={assignSearch}
                                    onChange={(e) => setAssignSearch(e.target.value)}
                                    placeholder="Filter by name, title, asset..."
                                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-canvas border border-line rounded-xl focus:ring-2 focus:ring-accent text-ink"
                                />
                            </div>

                            {/* Company Filter */}
                            <select
                                value={assignCompany}
                                onChange={(e) => setAssignCompany(e.target.value)}
                                className="px-3 py-1.5 text-xs bg-canvas border border-line rounded-xl text-ink"
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
                                className="px-3 py-1.5 text-xs bg-canvas border border-line rounded-xl text-ink"
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
                                className="px-3 py-1.5 rounded-lg border border-line text-ink hover:bg-canvas font-semibold transition-colors"
                            >
                                {selectedAssignKeys.size === filteredRoster.length && filteredRoster.length > 0 ? 'Deselect All' : `Select All Filtered (${filteredRoster.length})`}
                            </button>
                        </div>
                    </div>

                    {/* Roster Table */}
                    <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
                        <div tabIndex={0} role="region" aria-label="Self audits table; scroll horizontally for more columns" className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-quiet">
                                <thead className="bg-canvas text-ink text-xs uppercase tracking-wider font-semibold border-b border-line">
                                    <tr>
                                        <th className="w-12 px-5 py-3.5 text-center">
                                            <input
                                                type="checkbox"
                                                checked={filteredRoster.length > 0 && selectedAssignKeys.size === filteredRoster.length}
                                                onChange={handleSelectAllFiltered}
                                                className="w-4 h-4 rounded text-ink focus:ring-accent"
                                            />
                                        </th>
                                        <th className="px-5 py-3.5">Employee</th>
                                        <th className="px-5 py-3.5">Assigned Asset</th>
                                        <th className="px-5 py-3.5">Last Audited Date</th>
                                        <th className="px-5 py-3.5">Active Audit Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {filteredRoster.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-quiet">
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
                                                            ? 'bg-surface/50 '
                                                            : 'hover:bg-canvas/80 '
                                                    }`}
                                                >
                                                    <td className="px-5 py-4 text-center" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleAssignSelection(key)}
                                                            className="w-4 h-4 rounded text-ink focus:ring-accent"
                                                        />
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-ink text-xs">
                                                            {u.name}
                                                        </div>
                                                        <div className="text-[11px] text-quiet">
                                                            {u.jobTitle ? `${u.jobTitle} • ` : ''}{u.email}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {u.company && (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface text-ink font-medium">
                                                                    {u.company}
                                                                </span>
                                                            )}
                                                            {u.department?.name && (
                                                                <span className="text-[10px] text-quiet">
                                                                    {u.department.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-xs text-ink">
                                                            {a.name}
                                                        </div>
                                                        <div className="text-[11px] text-quiet">
                                                            Tag: <span className="font-mono">{a.assetId}</span> &bull; {a.category}
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 text-xs whitespace-nowrap">
                                                        {a.lastAuditedAt ? (
                                                            <span className="text-ink font-medium">
                                                                {new Date(a.lastAuditedAt).toLocaleDateString()}
                                                            </span>
                                                        ) : lastAudit?.submittedAt ? (
                                                            <span className="text-ink font-medium">
                                                                {new Date(lastAudit.submittedAt).toLocaleDateString()}
                                                            </span>
                                                        ) : (
                                                            <span className="text-ink font-medium text-[11px]">
                                                                Never Audited
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="px-5 py-4 whitespace-nowrap text-xs">
                                                        {activeAudit ? (
                                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                                activeAudit.status === 'Requested'
                                                                    ? 'bg-surface text-ink  '
                                                                    : 'bg-surface text-ink  '
                                                            }`}>
                                                                {activeAudit.status === 'Requested' ? 'Audit Requested' : 'Submitted (Review Pending)'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-quiet text-[11px] italic">No active audit</span>
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
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-quiet uppercase tracking-wider">Total Declarations</span>
                            <p className="text-2xl font-bold text-ink mt-1">{reconcileMetrics.total}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm bg-surface/20">
                            <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                                <span>👻 Ghost Assets Declared</span>
                            </span>
                            <p className="text-2xl font-bold text-ink mt-1">{reconcileMetrics.ghostCount}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm bg-surface/20">
                            <span className="text-xs font-bold text-ink uppercase tracking-wider">Discrepancies Reported</span>
                            <p className="text-2xl font-bold text-ink mt-1">{reconcileMetrics.discrepancies}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Reconciled Cleanly</span>
                            <p className="text-2xl font-bold text-ink mt-1">{reconcileMetrics.reconciled}</p>
                        </div>
                    </div>

                    {/* Filter / Search bar */}
                    <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                        <div className="flex-1 flex flex-wrap items-center gap-3">
                            <input
                                type="text"
                                value={reconcileSearch}
                                onChange={(e) => setReconcileSearch(e.target.value)}
                                placeholder="Search by employee, items, or discrepancy remarks..."
                                className="w-full sm:w-72 px-3 py-1.5 text-xs bg-canvas border border-line rounded-xl focus:ring-2 focus:ring-accent text-ink"
                            />

                            <select
                                value={reconcileStatusFilter}
                                onChange={(e) => setReconcileStatusFilter(e.target.value as any)}
                                className="px-3 py-1.5 text-xs bg-canvas border border-line rounded-xl text-ink"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Pending Review">Pending Review</option>
                                <option value="Reconciled">Reconciled</option>
                            </select>

                            <select
                                value={reconcileCompany}
                                onChange={(e) => setReconcileCompany(e.target.value)}
                                className="px-3 py-1.5 text-xs bg-canvas border border-line rounded-xl text-ink"
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
                            className="px-3.5 py-1.5 bg-muted hover:bg-muted text-ink rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-end sm:self-auto"
                        >
                            <span>🔄</span>
                            <span>{isLoadingDeclarations ? 'Refreshing...' : 'Refresh'}</span>
                        </button>
                    </div>

                    {/* Declarations List */}
                    <div className="space-y-4">
                        {filteredDeclarations.length === 0 ? (
                            <div className="p-12 text-center bg-surface rounded-2xl border border-line text-quiet text-sm">
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
                                        className="p-5 rounded-2xl bg-surface border border-line shadow-sm space-y-4 transition-all hover:border-accent"
                                    >
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-line">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-surface text-ink flex items-center justify-center font-bold text-sm">
                                                    {dec.user?.name?.charAt(0) || 'U'}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-ink text-sm">
                                                        {dec.user?.name}
                                                    </h4>
                                                    <p className="text-xs text-quiet">
                                                        {dec.user?.email} &bull; {dec.user?.company || 'AMD'} &bull; {dec.user?.department?.name || 'Department'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    dec.systemRecordsOk
                                                        ? 'bg-surface text-ink  '
                                                        : 'bg-surface text-ink   animate-pulse'
                                                }`}>
                                                    {dec.systemRecordsOk ? '✅ Records Matched' : '⚠️ Discrepancy Reported'}
                                                </span>

                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    dec.status === 'Reconciled'
                                                        ? 'bg-muted text-ink  '
                                                        : 'bg-surface text-ink  '
                                                }`}>
                                                    {dec.status}
                                                </span>

                                                {dec.status !== 'Reconciled' && (
                                                    <button
                                                        onClick={() => handleReconcileDeclaration(dec.id)}
                                                        className="px-3 py-1 bg-olive hover:bg-olive text-on-strong rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
                                                    >
                                                        Mark Reconciled
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Discrepancy Remarks Callout */}
                                        {dec.discrepancyNotes && (
                                            <div className="p-3.5 bg-surface border border-line rounded-xl text-xs text-ink">
                                                <strong>Employee Discrepancy Remarks:</strong> &ldquo;{dec.discrepancyNotes}&rdquo;
                                            </div>
                                        )}

                                        {/* Declared Items List */}
                                        <div>
                                            {(() => {
                                                const unreconciledPeripherals = items.filter(
                                                    it => !it.convertedAssetId && !it.reconciled && !it.userAccessoryId && isPeripheralCategory(it.category)
                                                );

                                                return (
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                                        <div className="text-[11px] font-bold text-quiet uppercase tracking-wider">
                                                            Declared Equipment ({items.length} items)
                                                        </div>
                                                        {unreconciledPeripherals.length > 0 && (
                                                            <button
                                                                type="button"
                                                                disabled={isBulkReconcilingId === dec.id}
                                                                onClick={() => handleBulkReconcileAllPeripherals(dec, unreconciledPeripherals)}
                                                                className="px-2.5 py-1 bg-surface hover:bg-surface text-ink border border-line rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
                                                                title="Adds all declared accessories straight into employee profile without creating Asset IDs"
                                                            >
                                                                <span>🎧</span>
                                                                <span>{isBulkReconcilingId === dec.id ? 'Saving...' : `Add All Peripherals to Profile (${unreconciledPeripherals.length})`}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {items.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                                                            item.reconciled || item.userAccessoryId
                                                                ? 'bg-surface/20  border-line '
                                                                : item.convertedAssetId
                                                                ? 'bg-surface/20  border-line '
                                                                : item.isGhost
                                                                ? 'bg-surface/40  border-line '
                                                                : 'bg-canvas  border-line '
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                                                <span className="font-bold text-ink">
                                                                    {item.name}
                                                                </span>
                                                                {item.convertedAssetTag ? (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-olive text-on-strong shrink-0 flex items-center gap-1">
                                                                        <span>🏷️</span> {item.convertedAssetTag}
                                                                    </span>
                                                                ) : (item.reconciled || item.userAccessoryId) ? (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-surface text-ink shrink-0 flex items-center gap-1">
                                                                        <span>🎧</span> Profile Accessory
                                                                    </span>
                                                                ) : item.isGhost ? (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-olive text-on-strong shrink-0">
                                                                        Ghost Asset
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-muted text-ink shrink-0">
                                                                        Matched
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <p className="text-[11px] text-quiet">
                                                                {item.category} {item.brand ? `• ${item.brand}` : ''} {item.serialNumber ? `• SN: ${item.serialNumber}` : ''}
                                                            </p>
                                                            <p className="text-[10px] text-quiet mt-0.5">
                                                                Condition: <span className="font-semibold text-ink">{item.condition || 'Good'}</span> &bull; {item.location || 'Head Office'}
                                                            </p>
                                                        </div>

                                                        {/* Photo Proof thumbnail & Actions */}
                                                        <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-line">
                                                            {item.imageUrl ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setImagePreviewUrl(item.imageUrl!)}
                                                                    className="flex items-center gap-1.5 text-[11px] font-bold text-ink hover:text-ink"
                                                                >
                                                                    <img src={item.imageUrl} alt="Proof" className="w-6 h-6 rounded object-cover border border-line" />
                                                                    <span>Proof</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-quiet italic">No photo</span>
                                                            )}

                                                            <div className="flex items-center justify-end gap-1.5 ml-auto">
                                                                {(item.reconciled || item.userAccessoryId) ? (
                                                                    <span className="text-[11px] text-ink font-bold flex items-center gap-1">
                                                                        ✓ In Profile
                                                                    </span>
                                                                ) : item.convertedAssetId ? (
                                                                    <span className="text-[11px] text-ink font-bold flex items-center gap-1">
                                                                        ✓ Tagged
                                                                    </span>
                                                                ) : isPeripheralCategory(item.category) ? (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenReconcileAccModal(dec, item)}
                                                                            className="px-2.5 py-1 bg-olive hover:bg-olive active:scale-95 text-on-strong rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                                                                            title="Record in employee profile checklist without generating an Asset Tag"
                                                                        >
                                                                            <span>🎧 Add to Profile</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenConvertModal(dec, item)}
                                                                            title="Only if this requires a physical barcode asset tag"
                                                                            className="px-2 py-1 text-quiet hover:text-ink rounded-lg text-[10px] font-medium transition-all"
                                                                        >
                                                                            Tag ID
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenConvertModal(dec, item)}
                                                                            className="px-2.5 py-1 bg-olive hover:bg-olive active:scale-95 text-on-strong rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                                                                        >
                                                                            <span>✨ 1-Click Register</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenReconcileAccModal(dec, item)}
                                                                            title="Add as un-tagged accessory instead"
                                                                            className="px-2 py-1 text-quiet hover:text-ink rounded-lg text-[10px] font-medium transition-all"
                                                                        >
                                                                            Profile
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-strong/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedAudit(null)}>
                    <div className="bg-surface rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-line flex flex-col max-h-[calc(100dvh-1rem)]" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-line flex justify-between items-center bg-canvas">
                            <div>
                                <h3 className="text-lg font-bold text-ink">
                                    Review Self-Audit: {selectedAudit.asset?.name || 'Equipment'}
                                </h3>
                                <p className="text-xs text-quiet mt-0.5">
                                    Submitted by {selectedAudit.user?.name || 'User'} &bull; Asset Tag: <span className="font-mono font-bold">{selectedAudit.asset?.assetId}</span>
                                </p>
                            </div>
                            <button aria-label="Close dialog" onClick={() => setSelectedAudit(null)} className="text-quiet hover:text-quiet p-1">
                                {ICONS.close}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-5 text-xs text-ink">
                            {/* Overview Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3 rounded-xl bg-canvas border border-line">
                                    <span className="text-quiet text-[10px] uppercase font-bold">Location</span>
                                    <p className="font-bold text-ink text-xs mt-0.5">{selectedAudit.location || 'Not specified'}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-canvas border border-line">
                                    <span className="text-quiet text-[10px] uppercase font-bold">Physical Condition</span>
                                    <p className="font-bold text-ink text-xs mt-0.5">{selectedAudit.condition || 'Not specified'}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-canvas border border-line">
                                    <span className="text-quiet text-[10px] uppercase font-bold">Tag Verified</span>
                                    <p className="font-mono font-bold text-ink text-xs mt-0.5">{selectedAudit.scannedAssetId || 'N/A'}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-canvas border border-line">
                                    <span className="text-quiet text-[10px] uppercase font-bold">Status</span>
                                    <p className="font-bold text-ink text-xs mt-0.5">{selectedAudit.status}</p>
                                </div>
                            </div>

                            {/* Hardware health checks */}
                            <div>
                                <h4 className="font-bold text-ink text-xs uppercase tracking-wider mb-2">
                                    Hardware Component Verification
                                </h4>
                                {(() => {
                                    const checks = parseChecks(selectedAudit.hardwareChecks);
                                    return (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-canvas rounded-xl border border-line text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <span className={checks.screenOk ? 'text-ink font-bold' : 'text-ink font-bold'}>{checks.screenOk ? '✓' : '✗'}</span>
                                                <span>Screen / Display</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={checks.keyboardOk ? 'text-ink font-bold' : 'text-ink font-bold'}>{checks.keyboardOk ? '✓' : '✗'}</span>
                                                <span>Keyboard / Touchpad</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={checks.batteryOk ? 'text-ink font-bold' : 'text-ink font-bold'}>{checks.batteryOk ? '✓' : '✗'}</span>
                                                <span>Battery Backup</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={checks.chargerOk ? 'text-ink font-bold' : 'text-ink font-bold'}>{checks.chargerOk ? '✓' : '✗'}</span>
                                                <span>Power Adapter</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={checks.bodyOk ? 'text-ink font-bold' : 'text-ink font-bold'}>{checks.bodyOk ? '✓' : '✗'}</span>
                                                <span>Chassis / Hinges</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Employee remarks */}
                            {(selectedAudit.userRemarks || selectedAudit.remarks) && (
                                <div>
                                    <h4 className="font-bold text-ink text-xs uppercase tracking-wider mb-1">
                                        Employee Notes
                                    </h4>
                                    <div className="p-3 bg-canvas rounded-xl border border-line whitespace-pre-wrap">
                                        {selectedAudit.userRemarks || selectedAudit.remarks}
                                    </div>
                                </div>
                            )}

                            {/* Photo Proof */}
                            {selectedAudit.imageUrl && (
                                <div>
                                    <h4 className="font-bold text-ink text-xs uppercase tracking-wider mb-1.5">
                                        Photo Proof
                                    </h4>
                                    <div className="rounded-xl overflow-hidden border border-line bg-strong flex justify-center max-h-72">
                                        <img src={selectedAudit.imageUrl} alt="Audit Proof" className="max-h-72 object-contain" />
                                    </div>
                                </div>
                            )}

                            {/* Reviewer inputs (if actionable) */}
                            {isAdmin && selectedAudit.status === 'Pending Review' && (
                                <div className="space-y-3 pt-2 border-t border-line">
                                    <div>
                                        <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                                            Admin Verification Notes (Optional)
                                        </label>
                                        <input aria-label="Admin Verification Notes (Optional)"
                                            type="text"
                                            value={adminRemarks}
                                            onChange={e => setAdminRemarks(e.target.value)}
                                            placeholder="e.g., Verified physical condition and serial tag."
                                            className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs focus:ring-2 focus:ring-accent text-ink"
                                        />
                                    </div>

                                    {/* Defect escalation toggle */}
                                    <div className="p-3 bg-surface/70 border border-line rounded-xl">
                                        <label className="flex items-start gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={createTicket}
                                                onChange={e => setCreateTicket(e.target.checked)}
                                                className="w-4 h-4 rounded text-ink focus:ring-accent mt-0.5"
                                            />
                                            <div>
                                                <span className="font-bold text-ink block text-xs">
                                                    Escalate Defect to IT Support Ticket
                                                </span>
                                                <span className="text-[11px] text-ink block mt-0.5">
                                                    Automatically create an open high-priority support ticket linked to this asset and user for hardware repair or charger replacement.
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-line bg-canvas flex justify-end items-center gap-3">
                            <button
                                onClick={() => setSelectedAudit(null)}
                                className="px-4 py-2 text-xs font-semibold text-quiet hover:bg-muted rounded-xl transition-colors"
                            >
                                Close
                            </button>

                            {isAdmin && selectedAudit.status === 'Pending Review' && (
                                <>
                                    <button
                                        onClick={() => handleUpdateAuditStatus('Rejected')}
                                        disabled={isSubmittingReview}
                                        className="px-4 py-2 text-xs font-bold text-ink bg-surface hover:bg-surface border border-line rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => handleUpdateAuditStatus('Approved')}
                                        disabled={isSubmittingReview}
                                        className="px-5 py-2 text-xs font-bold text-on-strong bg-olive hover:bg-olive rounded-xl transition-colors shadow-sm disabled:opacity-50"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-strong/50 backdrop-blur-sm animate-fade-in" onClick={() => { setConvertingDeclaration(null); setConvertingItem(null); }}>
                    <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-line flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-line flex justify-between items-center bg-surface">
                            <div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-olive text-on-strong">
                                    Ghost Asset Registration
                                </span>
                                <h3 className="text-base font-bold text-ink mt-1">
                                    Register &ldquo;{convertingItem.name}&rdquo; into Official Inventory
                                </h3>
                            </div>
                            <button
                                onClick={() => { setConvertingDeclaration(null); setConvertingItem(null); }}
                                className="text-quiet hover:text-quiet text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {convertingItem.imageUrl && (
                                <div className="rounded-xl overflow-hidden border border-line max-h-40 bg-strong flex items-center justify-center">
                                    <img src={convertingItem.imageUrl} alt="Declared Photo Proof" className="max-h-40 object-contain" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-quiet uppercase tracking-wider mb-1">
                                        Assignee
                                    </label>
                                    <p className="text-xs font-bold text-ink">
                                        {convertingDeclaration.user?.name}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-quiet uppercase tracking-wider mb-1">
                                        Reported Condition
                                    </label>
                                    <p className="text-xs font-bold text-ink">
                                        {convertingItem.condition || 'Good'}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                                    Asset ID / Tag <span className="text-ink">*</span>
                                </label>
                                <input aria-label="Asset ID / Tag"
                                    type="text"
                                    value={convertAssetTag}
                                    onChange={(e) => setConvertAssetTag(e.target.value)}
                                    className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-sm font-mono font-bold text-ink"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                                        Company
                                    </label>
                                    <select aria-label="Company"
                                        value={convertCompany}
                                        onChange={(e) => setConvertCompany(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-semibold text-ink"
                                    >
                                        <option value="AMD">AMD</option>
                                        <option value="ASSP">ASSP</option>
                                        <option value="ATS">ATS</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                                        Category
                                    </label>
                                    <select aria-label="Category"
                                        value={convertCategory}
                                        onChange={(e) => setConvertCategory(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-semibold text-ink"
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

                        <div className="p-4 border-t border-line bg-canvas flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setConvertingDeclaration(null); setConvertingItem(null); }}
                                className="px-4 py-2 text-xs font-semibold text-quiet hover:bg-muted rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isConverting || !convertAssetTag.trim()}
                                onClick={handleConfirmConvertGhost}
                                className="px-5 py-2.5 bg-olive hover:bg-olive disabled:opacity-50 text-on-strong text-xs font-bold rounded-xl shadow-md shadow-strong/15 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                                {isConverting ? 'Registering...' : 'Confirm & Register into Inventory'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Adding Declared Peripheral to Profile Checklist (No Asset ID) */}
            {reconcileAccDeclaration && reconcileAccItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-strong/50 backdrop-blur-sm animate-fade-in" onClick={() => { setReconcileAccDeclaration(null); setReconcileAccItem(null); }}>
                    <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-line flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-line flex justify-between items-center bg-surface">
                            <div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-olive text-on-strong">
                                    Profile Peripheral Checklist
                                </span>
                                <h3 className="text-base font-bold text-ink mt-1">
                                    Add &ldquo;{reconcileAccItem.name}&rdquo; to {reconcileAccDeclaration.user?.name}&apos;s Profile
                                </h3>
                                <p className="text-xs text-quiet mt-0.5">
                                    Records peripheral directly onto employee profile without generating an Asset Tag.
                                </p>
                            </div>
                            <button
                                onClick={() => { setReconcileAccDeclaration(null); setReconcileAccItem(null); }}
                                className="text-quiet hover:text-quiet text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            {reconcileAccItem.imageUrl && (
                                <div className="rounded-xl overflow-hidden border border-line max-h-36 bg-strong flex items-center justify-center">
                                    <img src={reconcileAccItem.imageUrl} alt="Declared Photo Proof" className="max-h-36 object-contain" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                                        Category <span className="text-ink">*</span>
                                    </label>
                                    <select aria-label="Category"
                                        value={accCategory}
                                        onChange={(e) => setAccCategory(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-semibold text-ink"
                                    >
                                        <option value="Mouse">Mouse</option>
                                        <option value="Keyboard">Keyboard</option>
                                        <option value="Headset">Headset / Headphones</option>
                                        <option value="Monitor">Monitor</option>
                                        <option value="Dock">Docking Station / Hub</option>
                                        <option value="Storage">Pen Drive / Storage</option>
                                        <option value="Webcam">Webcam</option>
                                        <option value="Adapter">Charger / Adapter</option>
                                        <option value="Cables">Cables / Dongle</option>
                                        <option value="Other">Other Peripheral</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                                        Item Name <span className="text-ink">*</span>
                                    </label>
                                    <input aria-label="Item Name"
                                        type="text"
                                        value={accName}
                                        onChange={(e) => setAccName(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-semibold text-ink"
                                        placeholder="e.g. Dell Optical Mouse"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                                        Brand / Make
                                    </label>
                                    <input aria-label="Brand / Make"
                                        type="text"
                                        value={accBrand}
                                        onChange={(e) => setAccBrand(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-semibold text-ink"
                                        placeholder="e.g. Logitech, Dell"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                                        Serial Number (Optional)
                                    </label>
                                    <input aria-label="Serial Number (Optional)"
                                        type="text"
                                        value={accSerial}
                                        onChange={(e) => setAccSerial(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-semibold text-ink"
                                        placeholder="e.g. SN123456"
                                    />
                                </div>
                            </div>

                            {/* Optional Stock / Batch Link for Warranty */}
                            <div>
                                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1 flex items-center justify-between">
                                    <span>Link to Purchase Stock Batch (Optional)</span>
                                    <span className="text-[10px] text-ink font-normal">Auto-links Purchase Date & Warranty</span>
                                </label>
                                <select
                                    value={selectedAccBatchId}
                                    onChange={(e) => {
                                        const val = e.target.value ? Number(e.target.value) : '';
                                        setSelectedAccBatchId(val);
                                        if (val) {
                                            const b = accessoryBatches.find(x => x.id === val);
                                            if (b) {
                                                if (!accBrand && b.brand) setAccBrand(b.brand);
                                                if (b.category) setAccCategory(b.category);
                                            }
                                        }
                                    }}
                                    className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-semibold text-ink"
                                >
                                    <option value="">No Batch Link (Legacy / Existing Employee Item)</option>
                                    {accessoryBatches.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.name} ({b.category}) &bull; Stock: {b.quantityAvailable} left &bull; {b.warrantyMonths}m Warranty {b.invoiceNo ? `(Inv: ${b.invoiceNo})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {selectedAccBatchId ? (
                                    <p className="text-[11px] text-ink mt-1 flex items-center gap-1 font-medium">
                                        <span>🛡️</span> Purchase date & warranty tracking will be automatically linked from this stock batch!
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-quiet mt-1">
                                        Item will be recorded in checklist without warranty tracking.
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                                        Condition
                                    </label>
                                    <select aria-label="Condition"
                                        value={accCondition}
                                        onChange={(e) => setAccCondition(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-semibold text-ink"
                                    >
                                        <option value="Good">Good</option>
                                        <option value="Minor Scratches">Minor Scratches</option>
                                        <option value="Damaged">Damaged</option>
                                        <option value="Needs IT Attention">Needs IT Attention</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                                        Remarks / Notes
                                    </label>
                                    <input aria-label="Remarks / Notes"
                                        type="text"
                                        value={accNotes}
                                        onChange={(e) => setAccNotes(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-semibold text-ink"
                                        placeholder="Optional notes"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-line bg-canvas flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setReconcileAccDeclaration(null); setReconcileAccItem(null); }}
                                className="px-4 py-2 text-xs font-semibold text-quiet hover:bg-muted rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isReconcilingAcc || !accName.trim()}
                                onClick={handleConfirmReconcileAcc}
                                className="px-5 py-2.5 bg-olive hover:bg-olive disabled:opacity-50 text-on-strong text-xs font-bold rounded-xl shadow-md shadow-strong/15 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                                {isReconcilingAcc ? 'Saving...' : 'Save to Profile Accessories'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Zoom Modal */}
            {imagePreviewUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-strong/80 backdrop-blur-md animate-fade-in" onClick={() => setImagePreviewUrl(null)}>
                    <div className="relative max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-strong" onClick={e => e.stopPropagation()}>
                        <img src={imagePreviewUrl} alt="Enlarged proof" className="max-w-full max-h-[85vh] object-contain" />
                        <button
                            type="button"
                            onClick={() => setImagePreviewUrl(null)}
                            className="absolute top-3 right-3 px-3 py-1 bg-strong/70 hover:bg-strong text-on-strong rounded-lg text-xs font-bold"
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
