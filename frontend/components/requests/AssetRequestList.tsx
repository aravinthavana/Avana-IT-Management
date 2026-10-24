import { API_URL } from '../../utils/apiClient';
import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../hooks/useAppContext';
import RequestForm from './RequestForm';
import RejectRequestModal from './RejectRequestModal';
import AllocateAssetModal from './AllocateAssetModal';
import RequestDetailModal from './RequestDetailModal';
import { ICONS, ASSET_ICONS } from '../../constants';
import { AssetRequest } from '../../types';


const AssetRequestList: React.FC = () => {
    const { user } = useAuth();
    const { assetRequests, setAssetRequests, users, assets, getHeaders, setNotification, fetchAllData } = useAppContext();

    // Modals state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedDetailRequest, setSelectedDetailRequest] = useState<AssetRequest | null>(null);
    const [rejectingRequest, setRejectingRequest] = useState<{ request: AssetRequest; stage: 'Manager' | 'Admin' } | null>(null);
    const [allocatingRequest, setAllocatingRequest] = useState<AssetRequest | null>(null);

    // Filters state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusTab, setStatusTab] = useState<'All' | 'Pending' | 'Approved' | 'Fulfilled' | 'Rejected'>('All');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [selectedCompany, setSelectedCompany] = useState<string>('All');

    // Role checks
    const isAdmin = user?.role === 'Admin';
    const hasSubordinates = useMemo(() => {
        if (!user) return false;
        return users.some(u => u.managerId === user.id);
    }, [users, user]);
    const isManager = user?.role === 'Manager' || hasSubordinates;

    // Handle Create Request
    const handleCreateRequest = async (data: any) => {
        try {
            const res = await fetch(`${API_URL}/api/requests`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const newReq = await res.json();
                setAssetRequests([newReq, ...assetRequests]);
                setIsFormOpen(false);
                setNotification({ message: 'Request submitted successfully.', type: 'success' });
                fetchAllData().catch(() => {});
            } else {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to create request');
            }
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to submit request', type: 'error' });
        }
    };

    // Handle Quick Approval
    const handleApprove = async (id: number, targetStatus: string, remarks?: string) => {
        try {
            const res = await fetch(`${API_URL}/api/requests/${id}/status`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({ status: targetStatus, remarks })
            });
            if (res.ok) {
                const updated = await res.json();
                setAssetRequests(assetRequests.map(r => r.id === id ? updated : r));
                setNotification({ message: `Request successfully approved!`, type: 'success' });
                fetchAllData().catch(() => {});
            } else {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to update request status');
            }
        } catch (e: any) {
            setNotification({ message: e.message || 'Failed to approve request', type: 'error' });
        }
    };

    // Handle Rejection from Modal
    const handleConfirmReject = async (rejectionReason: string, remarks?: string) => {
        if (!rejectingRequest) return;
        const { request, stage } = rejectingRequest;
        const targetStatus = stage === 'Manager' ? 'Rejected by Manager' : 'Rejected by Admin';

        const res = await fetch(`${API_URL}/api/requests/${request.id}/status`, {
            method: 'PUT',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                status: targetStatus,
                rejectionReason,
                remarks
            })
        });

        if (res.ok) {
            const updated = await res.json();
            setAssetRequests(assetRequests.map(r => r.id === request.id ? updated : r));
            setNotification({ message: `Request REQ-${request.id.toString().padStart(4, '0')} rejected.`, type: 'info' });
            fetchAllData().catch(() => {});
        } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to reject request');
        }
    };

    // Handle Allocation from Modal
    const handleConfirmAllocate = async (assetId: number, adminRemarks?: string) => {
        if (!allocatingRequest) return;
        const res = await fetch(`${API_URL}/api/requests/${allocatingRequest.id}/allocate`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                assetId,
                adminRemarks
            })
        });

        if (res.ok) {
            const updated = await res.json();
            setAssetRequests(assetRequests.map(r => r.id === allocatingRequest.id ? updated : r));
            setNotification({ message: `Asset allocated & request fulfilled! Digital handover form created.`, type: 'success' });
            fetchAllData().catch(() => {});
        } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to allocate asset');
        }
    };

    // Filtered Requests
    const filteredRequests = useMemo(() => {
        return assetRequests.filter(req => {
            // Status tab filter
            if (statusTab === 'Pending') {
                if (req.status !== 'Pending Manager' && req.status !== 'Pending Admin') return false;
            } else if (statusTab === 'Approved') {
                if (req.status !== 'Approved') return false;
            } else if (statusTab === 'Fulfilled') {
                if (req.status !== 'Fulfilled') return false;
            } else if (statusTab === 'Rejected') {
                if (!req.status.startsWith('Rejected')) return false;
            }

            // Category filter
            if (selectedCategory !== 'All') {
                if (req.category.toLowerCase() !== selectedCategory.toLowerCase()) return false;
            }

            // Company filter (Admin only)
            if (isAdmin && selectedCompany !== 'All') {
                const reqCompany = req.user?.company || '';
                if (reqCompany.toLowerCase() !== selectedCompany.toLowerCase()) return false;
            }

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const reqIdStr = `req-${req.id.toString().padStart(4, '0')}`;
                const matchId = reqIdStr.includes(q) || req.id.toString().includes(q);
                const matchUser = req.user?.name?.toLowerCase().includes(q) || req.user?.email?.toLowerCase().includes(q);
                const matchCategory = req.category.toLowerCase().includes(q);
                const matchType = req.requestType.toLowerCase().includes(q);
                const matchDesc = req.description?.toLowerCase().includes(q);
                const matchAllocated = req.allocatedAsset?.name?.toLowerCase().includes(q) || req.allocatedAsset?.assetId?.toLowerCase().includes(q);

                if (!matchId && !matchUser && !matchCategory && !matchType && !matchDesc && !matchAllocated) {
                    return false;
                }
            }

            return true;
        });
    }, [assetRequests, statusTab, selectedCategory, selectedCompany, searchQuery, isAdmin]);

    // KPI Metrics calculation
    const metrics = useMemo(() => {
        const total = assetRequests.length;
        const pendingManager = assetRequests.filter(r => r.status === 'Pending Manager').length;
        const pendingAdmin = assetRequests.filter(r => r.status === 'Pending Admin').length;
        const approved = assetRequests.filter(r => r.status === 'Approved').length;
        const fulfilled = assetRequests.filter(r => r.status === 'Fulfilled').length;
        const rejected = assetRequests.filter(r => r.status.startsWith('Rejected')).length;

        // Manager's specific inbox
        const pendingMyReview = assetRequests.filter(r =>
            r.status === 'Pending Manager' && (r.managerId === user?.id || (r.user && r.user.managerId === user?.id))
        ).length;

        // In-stock assets available across the fleet
        const totalInStockAssets = assets.filter(a => a.status === 'In Stock' || a.status === 'Available').length;

        return { total, pendingManager, pendingAdmin, approved, fulfilled, rejected, pendingMyReview, totalInStockAssets };
    }, [assetRequests, assets, user]);

    // Helper: Priority Badge
    const renderPriorityBadge = (priority?: string) => {
        switch (priority) {
            case 'Urgent':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-surface text-ink border border-line animate-pulse">Urgent</span>;
            case 'High':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface text-ink border border-line">High</span>;
            case 'Low':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-quiet">Low</span>;
            case 'Medium':
            default:
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface text-ink border border-line">Medium</span>;
        }
    };

    // Helper: Status Badge
    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'Pending Manager':
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line">Pending Manager</span>;
            case 'Pending Admin':
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line">Pending IT Triage</span>;
            case 'Approved':
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line">Approved (Pending Stock)</span>;
            case 'Fulfilled':
                return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-surface text-ink border border-line flex items-center gap-1"><span className="text-[11px]">&#10004;</span> Fulfilled</span>;
            case 'Rejected by Manager':
            case 'Rejected by Admin':
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface text-ink border border-line flex items-center gap-1"><span className="text-[11px]">&#10008;</span> {status}</span>;
            default:
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-ink">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-ink flex items-center gap-2.5">
                        <span>IT Asset Requests</span>
                        {isAdmin && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-quiet font-semibold uppercase tracking-wider">
                                IT Operations Console
                            </span>
                        )}
                        {!isAdmin && isManager && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface text-ink font-semibold uppercase tracking-wider">
                                Manager Console
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-quiet mt-1">
                        {isAdmin
                            ? 'Triage, approve, and allocate inventory hardware with digital handover sign-offs.'
                            : isManager
                                ? 'Review team asset requests, approve requisitions, and track equipment allocations.'
                                : 'Submit requests for new hardware, replacements, upgrades, and track fulfillment.'}
                    </p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent text-on-strong rounded-xl font-semibold transition-all shadow-sm active:scale-95 text-sm"
                >
                    <span className="w-4 h-4">{ICONS.add}</span>
                    <span>New Asset Request</span>
                </button>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {isAdmin ? (
                    <>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-quiet uppercase tracking-wider">Total Requests</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.total}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Needs IT Triage</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.pendingAdmin}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Pending Manager</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.pendingManager}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Fulfilled</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.fulfilled}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm col-span-2 sm:col-span-1">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">In-Stock Fleet</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.totalInStockAssets}</p>
                        </div>
                    </>
                ) : isManager ? (
                    <>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Pending My Review</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.pendingMyReview}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-quiet uppercase tracking-wider">Team Requests</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.total}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">With IT Admin</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.pendingAdmin}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Fulfilled</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.fulfilled}</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-quiet uppercase tracking-wider">My Requests</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.total}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">In Review</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.pendingManager + metrics.pendingAdmin}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Fulfilled / Assigned</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.fulfilled}</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
                            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Rejected</span>
                            <p className="text-2xl font-bold text-ink mt-1">{metrics.rejected}</p>
                        </div>
                    </>
                )}
            </div>

            {/* Filter Bar */}
            <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    {/* Status Tabs */}
                    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted rounded-xl">
                        {(['All', 'Pending', 'Approved', 'Fulfilled', 'Rejected'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setStatusTab(tab)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    statusTab === tab
                                        ? 'bg-surface  text-ink  shadow-sm'
                                        : 'text-quiet  hover:text-ink '
                                }`}
                            >
                                {tab === 'Pending' ? 'Pending Approval' : tab}
                            </button>
                        ))}
                    </div>

                    {/* Search and Dropdown Filters */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        {/* Search Input */}
                        <div className="relative flex-1 md:w-64">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-quiet pointer-events-none">
                                {ICONS.search}
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by REQ, user, asset..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs bg-canvas border border-line rounded-xl focus:ring-2 focus:ring-accent text-ink placeholder-quiet"
                            />
                        </div>

                        {/* Category Filter */}
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-3 py-1.5 text-xs bg-canvas border border-line rounded-xl text-ink focus:ring-2 focus:ring-accent"
                        >
                            <option value="All">All Categories</option>
                            <option value="Laptop">Laptop</option>
                            <option value="Desktop">Desktop</option>
                            <option value="Monitor">Monitor</option>
                            <option value="Keyboard">Keyboard</option>
                            <option value="Mouse">Mouse</option>
                            <option value="Headset">Headset</option>
                            <option value="Docking Station">Docking Station</option>
                            <option value="Software License">Software License</option>
                            <option value="Other">Other</option>
                        </select>

                        {/* Company Filter - Admin Only */}
                        {isAdmin && (
                            <select
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                                className="px-3 py-1.5 text-xs bg-canvas border border-line rounded-xl text-ink focus:ring-2 focus:ring-accent font-medium"
                                title="Admin Company Filter"
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

            {/* Requests Table */}
            <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
                <div tabIndex={0} role="region" aria-label="Asset requests table; scroll horizontally for more columns" className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-quiet">
                        <thead className="bg-canvas text-ink text-xs uppercase tracking-wider font-semibold border-b border-line">
                            <tr>
                                <th className="px-5 py-3.5">Request ID</th>
                                <th className="px-5 py-3.5">Requester</th>
                                <th className="px-5 py-3.5">Requested Asset</th>
                                <th className="px-5 py-3.5">Justification</th>
                                <th className="px-5 py-3.5">Status</th>
                                <th className="px-5 py-3.5">Allocated Device</th>
                                <th className="px-5 py-3.5">Date</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-quiet">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-quiet mb-2">
                                                {ICONS.assets}
                                            </div>
                                            <p className="font-medium text-quiet">No asset requests found</p>
                                            <p className="text-xs text-quiet mt-0.5">Try clearing filters or search queries</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map(req => {
                                    const isManagerOfRow = isAdmin || req.managerId === user?.id || (req.user && req.user.managerId === user?.id);
                                    const icon = ASSET_ICONS[req.category] || ASSET_ICONS.default;

                                    return (
                                        <tr
                                            key={req.id}
                                            onClick={() => setSelectedDetailRequest(req)}
                                            className="hover:bg-canvas/80 transition-colors cursor-pointer"
                                        >
                                            {/* Request ID & Priority */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="font-mono text-xs font-bold text-ink">
                                                    REQ-{req.id.toString().padStart(4, '0')}
                                                </div>
                                                <div className="mt-1">
                                                    {renderPriorityBadge(req.priority)}
                                                </div>
                                            </td>

                                            {/* Requester Profile */}
                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-ink text-xs">
                                                    {req.user?.name || 'Unknown'}
                                                </div>
                                                <div className="text-[11px] text-quiet truncate max-w-[140px]">
                                                    {req.user?.email}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {req.user?.company && (
                                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface text-ink font-medium">
                                                            {req.user.company}
                                                        </span>
                                                    )}
                                                    {req.user?.department?.name && (
                                                        <span className="text-[10px] text-quiet">
                                                            {req.user.department.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Category & Type */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 p-1 rounded bg-muted text-quiet shrink-0">
                                                        {icon}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-xs text-ink">
                                                            {req.category}
                                                        </span>
                                                        <div className="text-[11px] text-quiet">
                                                            {req.requestType}
                                                        </div>
                                                    </div>
                                                </div>
                                                {req.currentAsset && (
                                                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-surface text-ink border border-line">
                                                        Current: {req.currentAsset.assetId}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Description snippet */}
                                            <td className="px-5 py-4 max-w-[180px]">
                                                <p className="text-xs text-quiet line-clamp-2" title={req.description || undefined}>
                                                    {req.description || <span className="italic text-quiet">None</span>}
                                                </p>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {renderStatusBadge(req.status)}
                                            </td>

                                            {/* Allocated Device */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {req.allocatedAsset ? (
                                                    <div className="text-xs">
                                                        <div className="font-bold text-ink flex items-center gap-1">
                                                            <span>&#10004;</span>
                                                            <span>{req.allocatedAsset.name}</span>
                                                        </div>
                                                        <div className="font-mono text-[11px] text-quiet">
                                                            {req.allocatedAsset.assetId} &bull; {req.allocatedAsset.serialNumber || 'N/A'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-quiet italic">Not allocated</span>
                                                )}
                                            </td>

                                            {/* Date */}
                                            <td className="px-5 py-4 whitespace-nowrap text-xs text-quiet">
                                                {new Date(req.createdAt).toLocaleDateString()}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-5 py-4 text-right whitespace-nowrap space-x-1.5" onClick={(e) => e.stopPropagation()}>
                                                {/* Manager Decision Buttons */}
                                                {req.status === 'Pending Manager' && isManagerOfRow && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(req.id, 'Pending Admin')}
                                                            className="px-2.5 py-1 bg-surface text-ink hover:bg-surface border border-line rounded-lg font-semibold text-xs transition-colors"
                                                            title="Approve and forward to IT Administration"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => setRejectingRequest({ request: req, stage: 'Manager' })}
                                                            className="px-2.5 py-1 bg-surface text-ink hover:bg-surface border border-line rounded-lg font-semibold text-xs transition-colors"
                                                            title="Reject request with reason"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}

                                                {/* Admin Decision / Allocation Buttons */}
                                                {isAdmin && (req.status === 'Pending Admin' || req.status === 'Approved') && (
                                                    <>
                                                        <button
                                                            onClick={() => setAllocatingRequest(req)}
                                                            className="px-3 py-1 bg-accent hover:bg-accent text-on-strong rounded-lg font-semibold text-xs transition-colors shadow-sm"
                                                            title="Allocate real inventory asset and generate handover form"
                                                        >
                                                            Allocate Asset
                                                        </button>
                                                        {req.status === 'Pending Admin' && (
                                                            <button
                                                                onClick={() => setRejectingRequest({ request: req, stage: 'Admin' })}
                                                                className="px-2.5 py-1 bg-surface text-ink hover:bg-surface border border-line rounded-lg font-semibold text-xs transition-colors"
                                                                title="Reject request with reason"
                                                            >
                                                                Reject
                                                            </button>
                                                        )}
                                                    </>
                                                )}

                                                {/* Details Button */}
                                                <button
                                                    onClick={() => setSelectedDetailRequest(req)}
                                                    className="p-1.5 text-quiet hover:text-quiet rounded-lg hover:bg-muted transition-colors inline-block"
                                                    title="View Full Audit & Timeline"
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

            {/* Modals */}
            <RequestForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={handleCreateRequest}
            />

            <RejectRequestModal
                isOpen={!!rejectingRequest}
                onClose={() => setRejectingRequest(null)}
                request={rejectingRequest?.request || null}
                stage={rejectingRequest?.stage || 'Manager'}
                onConfirm={handleConfirmReject}
            />

            <AllocateAssetModal
                isOpen={!!allocatingRequest}
                onClose={() => setAllocatingRequest(null)}
                request={allocatingRequest}
                onConfirm={handleConfirmAllocate}
            />

            <RequestDetailModal
                isOpen={!!selectedDetailRequest}
                onClose={() => setSelectedDetailRequest(null)}
                request={selectedDetailRequest}
            />
        </div>
    );
};

export default AssetRequestList;
