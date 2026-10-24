import React, { useMemo, useState } from 'react';
import SelfAuditModal from '../assets/SelfAuditModal';
import AssetDeclarationModal from '../audits/AssetDeclarationModal';
import { useAppContext } from '../../hooks/useAppContext';
import Card from '../ui/Card';
import { ICONS } from '../../constants';
import DoughnutChart from '../ui/DoughnutChart';
import RecentAssetsTable from './RecentAssetsTable';
import WarrantyAlertsTable from './WarrantyAlertsTable';
import LocationAnalytics from './LocationAnalytics';
import CompanyAnalyticsCard from './CompanyAnalyticsCard';
import WarrantyStatusOverview from './WarrantyStatusOverview';
import { WarrantyStatus } from '../../types';
import ExpiringLicensesTable from '../dashboard/ExpiringLicensesTable';
import PendingHandovers from '../handovers/PendingHandovers';
import MyAccessoriesCard from './MyAccessoriesCard';

import { useAuth } from '../../contexts/AuthContext';

const Home: React.FC = () => {
    const { assets, users, navigate, setAssetFilters, setSelectedAssetId, tickets, assetRequests, selfAudits } = useAppContext();
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditTargetAsset, setAuditTargetAsset] = useState<any>(null);
    const [auditTargetRecord, setAuditTargetRecord] = useState<any>(null);

    // Pre-Audit Asset Declaration & Discovery Modal state
    const [isDeclarationModalOpen, setIsDeclarationModalOpen] = useState(false);
    const [declarationTargetAsset, setDeclarationTargetAsset] = useState<any>(null);
    const [declarationTargetAudit, setDeclarationTargetAudit] = useState<any>(null);

    const { user } = useAuth();

    const handleStartAuditFlow = (targetAsset: any, auditRecord?: any) => {
        setDeclarationTargetAsset(targetAsset);
        setDeclarationTargetAudit(auditRecord || null);
        setIsDeclarationModalOpen(true);
    };

    const myAssets = useMemo(() => {
        if (!user) return [];
        return assets.filter(a => a.assigneeType === 'User' && a.assigneeId === user.id);
    }, [assets, user]);

    const myPendingAudits = useMemo(() => {
        if (!user) return [];
        return selfAudits.filter(a => a.userId === user.id && a.status === 'Requested');
    }, [selfAudits, user]);

    // USER VIEW
    if (user?.role === 'User') {
        const myRequests = assetRequests.filter(r => r.userId === user.id).slice(0, 3);

        return (
            <div className="space-y-8 animate-fade-in">
                <PendingHandovers />

                {/* Targeted Self-Audit Alert Banner (Only appears for employees specifically assigned an audit by IT Admin) */}
                {myPendingAudits.length > 0 && (
                    <div className="bg-gradient-to-r from-olive/10 via-surface to-olive/10 border-2 border-line rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-md relative overflow-hidden animate-fade-in">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
                            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-olive text-on-strong flex items-center justify-center shrink-0 shadow-lg shadow-strong/15 text-xl sm:text-2xl">
                                    📷
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                        <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-olive text-on-strong">
                                            Action Required
                                        </span>
                                        {myPendingAudits[0].dueDate && (
                                            <span className="text-[11px] sm:text-xs font-bold text-ink">
                                                Due: {new Date(myPendingAudits[0].dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-base sm:text-xl font-black text-ink leading-tight">
                                        IT Equipment Self-Audit Assigned
                                    </h3>
                                    <p className="text-xs sm:text-sm text-quiet max-w-2xl leading-relaxed">
                                        IT Administration has requested an equipment verification for your assigned device{myPendingAudits.length > 1 ? 's' : ''} ({myPendingAudits.map(a => a.asset?.name || 'Device').join(', ')}). Please verify your hardware status, check key components, and submit a photo.
                                    </p>
                                    {myPendingAudits[0].adminRemarks && (
                                        <div className="mt-2 text-[11px] sm:text-xs text-ink font-medium italic bg-surface/60 px-2.5 sm:px-3 py-1.5 rounded-xl border border-line inline-flex items-center gap-1.5">
                                            <span>💬 Note from IT:</span> &ldquo;{myPendingAudits[0].adminRemarks}&rdquo;
                                        </div>
                                    )}
                                    <div className="mt-2.5 flex items-start sm:items-center gap-2 px-3 py-1.5 rounded-xl bg-olive/10 border border-line text-[11px] sm:text-xs text-ink font-medium w-full sm:w-fit">
                                        <span className="text-sm shrink-0">📱</span>
                                        <span><strong>Camera Required:</strong> We recommend opening this portal on your <strong>mobile phone browser</strong> to easily snap photos.</span>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full md:w-auto shrink-0 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                                {myPendingAudits.map((audit) => {
                                    const targetAsset = myAssets.find(a => a.id === audit.assetId) || audit.asset;
                                    return (
                                        <button
                                            key={audit.id}
                                            onClick={() => {
                                                if (targetAsset) {
                                                    handleStartAuditFlow(targetAsset, audit);
                                                }
                                            }}
                                            className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 bg-olive hover:bg-olive active:scale-95 text-on-strong font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md shadow-strong/15 transition-all flex items-center justify-center gap-2"
                                        >
                                            📷 Complete Audit: {targetAsset?.name || 'Asset'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Hero / Welcome Section */}
                <div className="bg-gradient-to-br from-strong via-strong to-strong rounded-3xl p-6 sm:p-10 text-on-strong shadow-xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-surface/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-strong/10 rounded-full blur-2xl" />

                    <div className="relative z-10">
                        <h2 className="text-2xl sm:text-4xl font-bold mb-2">Hello, {user.name}!</h2>
                        <p className="text-on-strong text-sm sm:text-base max-w-lg opacity-90">Welcome to your IT service portal. Manage your assets and requests in one place.</p>

                        <div className="mt-6 sm:mt-8 flex flex-wrap gap-3 sm:gap-4">
                            <button onClick={() => navigate('requests')} className="px-5 py-2.5 sm:px-6 sm:py-3 bg-surface text-ink rounded-xl font-bold text-sm transition-all hover:bg-muted active:scale-95 flex items-center gap-2 shadow-md">
                                {ICONS.add} Submit New Request
                            </button>
                            <button onClick={() => navigate('tickets')} className="px-5 py-2.5 sm:px-6 sm:py-3 bg-surface/10 backdrop-blur-md border border-line/20 text-on-strong rounded-xl font-bold text-sm transition-all hover:bg-surface/20 active:scale-95 flex items-center gap-2">
                                {ICONS.tickets} Get Support
                            </button>
                            <button onClick={() => navigate('kb')} className="px-5 py-2.5 sm:px-6 sm:py-3 bg-surface/10 backdrop-blur-md border border-line/20 text-on-strong rounded-xl font-bold text-sm transition-all hover:bg-surface/20 active:scale-95 flex items-center gap-2">
                                {ICONS.kb} Knowledge Base
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Assets Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
                            <div className="px-6 py-5 border-b border-line flex justify-between items-center bg-canvas">
                                <h3 className="text-base sm:text-lg font-bold text-ink uppercase tracking-tight">My Assigned Assets</h3>
                                <span className="px-3 py-1 bg-surface text-ink rounded-full text-xs font-bold">{myAssets.length} Total</span>
                            </div>
                            {myAssets.length > 0 ? (
                                <div className="divide-y divide-line">
                                    {myAssets.map(asset => {
                                        const pendingAudit = myPendingAudits.find(a => a.assetId === asset.id);
                                        return (
                                            <div key={asset.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-canvas transition-colors group">
                                                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-quiet group-hover:scale-110 transition-transform shadow-inner">
                                                        {ICONS.assets}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-ink text-lg">{asset.name}</h4>
                                                            {pendingAudit && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-olive text-on-strong animate-pulse">
                                                                    Audit Due
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-quiet font-medium">{asset.category} • <span className="font-mono text-xs">{asset.assetId}</span></p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                                    <div className="flex-1 text-right sm:block hidden">
                                                        <p className="text-[10px] font-black text-quiet uppercase tracking-widest mb-1">Status</p>
                                                        <span className="px-2 py-1 bg-surface text-ink rounded-lg text-xs font-bold">In Use</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleStartAuditFlow(asset, pendingAudit)}
                                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm flex items-center gap-2 ${
                                                            pendingAudit
                                                                ? 'bg-olive hover:bg-olive text-on-strong shadow-strong/15 animate-pulse'
                                                                : 'bg-olive hover:bg-olive text-on-strong shadow-strong/15'
                                                        }`}
                                                    >
                                                        📷 {pendingAudit ? 'Audit Due' : 'Self Audit'}
                                                    </button>
                                                    <button onClick={() => setSelectedAssetId(asset.id)} className="flex-1 sm:flex-none px-4 py-2 border border-line rounded-xl text-sm font-bold text-quiet hover:bg-canvas transition-all active:scale-95">
                                                        View Details
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-16 text-center">
                                    <div className="w-20 h-20 bg-canvas rounded-full flex items-center justify-center mx-auto mb-4 text-on-strong">
                                        {ICONS.assets}
                                    </div>
                                    <p className="text-quiet font-medium">You currently have no assets assigned to you.</p>
                                </div>
                            )}
                        </div>

                        {/* My Peripherals & Accessories */}
                        <MyAccessoriesCard userId={user.id} onNavigateAssets={() => setSelectedAssetId(null)} />
                    </div>

                    {/* Quick Info / Recent Requests */}
                    <div className="space-y-6">
                        <div className="bg-surface rounded-2xl shadow-sm border border-line p-6">
                            <h3 className="text-lg font-black text-ink mb-4 uppercase tracking-tight">Recent Requests</h3>
                            {myRequests.length > 0 ? (
                                <div className="space-y-4">
                                    {myRequests.map(req => (
                                        <div key={req.id} className="flex items-start gap-3 p-3 rounded-xl bg-canvas border border-line">
                                            <div className={`mt-1 w-2 h-2 rounded-full ${req.status.includes('Approved') ? 'bg-olive' : req.status.includes('Rejected') ? 'bg-olive' : 'bg-olive animate-pulse'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-ink truncate">{req.category}</p>
                                                <p className="text-xs text-quiet">{req.status}</p>
                                            </div>
                                            <p className="text-[10px] text-quiet font-medium whitespace-nowrap">{new Date(req.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    ))}
                                    <button onClick={() => navigate('requests')} className="w-full py-2 text-sm font-bold text-ink hover:underline">
                                        View All Requests &rarr;
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-quiet text-center py-4">No recent requests.</p>
                            )}
                        </div>

                        <div className="bg-surface rounded-2xl shadow-sm border border-line p-6">
                            <h3 className="text-lg font-black text-ink mb-4 uppercase tracking-tight">Support Tickets</h3>
                            {tickets.filter(t => t.userId === user.id).length > 0 ? (
                                <div className="space-y-4">
                                    {tickets.filter(t => t.userId === user.id).slice(0, 3).map(ticket => (
                                        <div key={ticket.id} className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-line">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-ink truncate">{ticket.subject}</p>
                                                <p className="text-[10px] text-quiet font-medium uppercase tracking-widest">{ticket.status}</p>
                                            </div>
                                            <span className={`w-2 h-2 rounded-full ${ticket.status === 'Open' ? 'bg-olive animate-pulse' : ticket.status === 'In Progress' ? 'bg-olive' : 'bg-muted'}`} />
                                        </div>
                                    ))}
                                    <button onClick={() => navigate('tickets')} className="w-full py-2 text-sm font-bold text-ink hover:underline text-center">
                                        View All Tickets &rarr;
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-quiet text-center py-4 italic">No active tickets.</p>
                            )}
                        </div>

                        <div className="bg-surface/60 rounded-2xl p-6 border border-accent/60">
                            <h4 className="font-bold text-ink mb-2 flex items-center gap-2">
                                {ICONS.info} Need Help?
                            </h4>
                            <p className="text-sm text-quiet mb-4">Contact IT support if you're having issues with your equipment.</p>
                            <a href="mailto:itsupport@avanamedical.com" className="block w-full py-2.5 bg-surface text-ink border border-line rounded-xl text-center text-sm font-bold shadow-sm hover:shadow-md transition-all">
                                Email IT Support
                            </a>
                        </div>
                    </div>
                </div>
                <AssetDeclarationModal
                    isOpen={isDeclarationModalOpen}
                    onClose={() => {
                        setIsDeclarationModalOpen(false);
                        setDeclarationTargetAsset(null);
                        setDeclarationTargetAudit(null);
                    }}
                    userAssignedAssets={myAssets}
                    targetAudit={declarationTargetAudit}
                    targetAsset={declarationTargetAsset}
                    onCompleted={(declarationId, shouldContinueToAudit, assetToAudit) => {
                        setIsDeclarationModalOpen(false);
                        if (shouldContinueToAudit && (assetToAudit || declarationTargetAsset)) {
                            setAuditTargetAsset(assetToAudit || declarationTargetAsset);
                            setAuditTargetRecord(declarationTargetAudit);
                            setIsAuditModalOpen(true);
                        }
                    }}
                />

                {auditTargetAsset && (
                    <SelfAuditModal
                        isOpen={isAuditModalOpen}
                        onClose={() => {
                            setIsAuditModalOpen(false);
                            setAuditTargetAsset(null);
                            setAuditTargetRecord(null);
                        }}
                        asset={auditTargetAsset}
                        auditRecord={auditTargetRecord}
                    />
                )}
            </div>
        );
    }

    const [selectedCompany, setSelectedCompany] = useState<string>('All');
    const [alertsTab, setAlertsTab] = useState<'recent' | 'warranty' | 'licenses'>('recent');

    const companyCounts = useMemo(() => {
        return {
            AMD: assets.filter(a => (a.company || '').toUpperCase() === 'AMD').length,
            ASSP: assets.filter(a => (a.company || '').toUpperCase() === 'ASSP').length,
            ATS: assets.filter(a => (a.company || '').toUpperCase() === 'ATS').length,
        };
    }, [assets]);

    const activeAssets = useMemo(() => {
        if (selectedCompany === 'All') return assets;
        return assets.filter(a => (a.company || '').toUpperCase() === selectedCompany);
    }, [assets, selectedCompany]);

    const stats = useMemo(() => {
        const total = activeAssets.length;
        const assigned = activeAssets.filter(a => a.status === 'Assigned').length;
        const inStock = activeAssets.filter(a => a.status === 'In Stock').length;
        const inRepair = activeAssets.filter(a => a.status === 'In Repair' || a.status === 'Under Inspection').length;
        const retired = activeAssets.filter(a => a.status === 'Retired').length;
        const utilizationRate = total > 0 ? ((assigned / total) * 100).toFixed(0) : '0';

        return {
            totalAssets: total,
            assignedAssets: assigned,
            inStockAssets: inStock,
            inRepairAssets: inRepair,
            retiredAssets: retired,
            utilizationRate
        };
    }, [activeAssets]);

    const assetsByStatus = useMemo(() => activeAssets.reduce((acc, asset) => {
        acc[asset.status] = (acc[asset.status] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number }), [activeAssets]);

    const assetsByCategory = useMemo(() => activeAssets.reduce((acc, asset) => {
        acc[asset.category] = (acc[asset.category] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number }), [activeAssets]);

    const handleFilterNavigation = (field: string, value: string) => {
        const filters: any[] = [];
        if (selectedCompany !== 'All') {
            filters.push({ id: Date.now(), field: 'company', value: selectedCompany });
        }
        if (value !== 'All') {
            filters.push({ id: Date.now() + 1, field, value });
        }
        setAssetFilters(filters.length > 0 ? filters : [{ id: Date.now(), field: 'status', value: 'All' }]);
        navigate('assets');
    };

    const handleNavigateToCompanyAssets = (companyCode: string) => {
        setAssetFilters([{ id: Date.now(), field: 'company', value: companyCode }]);
        navigate('assets');
    };

    const handleWarrantyFilter = (status: any) => {
        const filters: any[] = [];
        if (selectedCompany !== 'All') {
            filters.push({ id: Date.now(), field: 'company', value: selectedCompany });
        }
        filters.push({ id: Date.now() + 1, field: 'warrantyStatus', value: status });
        setAssetFilters(filters);
        navigate('assets');
    };

    const chartColors1 = ['#b27f0d', '#172025', '#404131', '#aab2b2', '#d7d0bc'];
    const chartColors2 = ['#b27f0d', '#404131', '#aab2b2', '#172025', '#d7d0bc'];

    return (
        <div className="space-y-8 animate-fade-in">
            <PendingHandovers />

            {/* Top Company Filter Bar & Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-line">
                <div>
                    <h2 className="text-2xl font-black text-ink tracking-tight">
                        IT Asset &amp; Operations Dashboard
                    </h2>
                    <p className="text-xs text-quiet mt-0.5">
                        Real-time hardware inventory, multi-company analytics, and fleet lifecycle tracking.
                    </p>
                </div>

                {/* Company Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted rounded-2xl border border-line">
                    <button
                        onClick={() => setSelectedCompany('All')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            selectedCompany === 'All'
                                ? 'bg-surface  text-ink  shadow-sm'
                                : 'text-quiet hover:text-ink  '
                        }`}
                    >
                        All Companies ({assets.length})
                    </button>
                    <button
                        onClick={() => setSelectedCompany('AMD')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            selectedCompany === 'AMD'
                                ? 'bg-accent text-on-strong shadow-sm shadow-strong/15'
                                : 'text-quiet hover:text-ink  '
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-accent"></span>
                        <span>AMD ({companyCounts.AMD})</span>
                    </button>
                    <button
                        onClick={() => setSelectedCompany('ASSP')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            selectedCompany === 'ASSP'
                                ? 'bg-olive text-on-strong shadow-sm shadow-strong/15'
                                : 'text-quiet hover:text-ink  '
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-muted"></span>
                        <span>ASSP ({companyCounts.ASSP})</span>
                    </button>
                    <button
                        onClick={() => setSelectedCompany('ATS')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            selectedCompany === 'ATS'
                                ? 'bg-olive text-on-strong shadow-sm shadow-strong/15'
                                : 'text-quiet hover:text-ink  '
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-muted"></span>
                        <span>ATS ({companyCounts.ATS})</span>
                    </button>
                </div>
            </div>

            {/* Executive KPI Grid (Clean 5-column, no horizontal scroll) */}
            <section>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
                    <Card
                        title={selectedCompany === 'All' ? 'Total Fleet' : `${selectedCompany} Fleet`}
                        value={stats.totalAssets}
                        icon={ICONS.assets}
                        color="bg-surface text-ink   border border-line "
                        onClick={() => handleFilterNavigation('status', 'All')}
                        badge={`${stats.utilizationRate}% Deployed`}
                    />
                    <Card
                        title="Assigned (In Use)"
                        value={stats.assignedAssets}
                        icon={ICONS.users}
                        color="bg-surface text-ink   border border-line "
                        onClick={() => handleFilterNavigation('status', 'Assigned')}
                    />
                    <Card
                        title="In Stock (Available)"
                        value={stats.inStockAssets}
                        icon={ICONS.qr}
                        color="bg-surface text-ink   border border-line "
                        onClick={() => handleFilterNavigation('status', 'In Stock')}
                    />
                    <Card
                        title="In Repair / Inspection"
                        value={stats.inRepairAssets}
                        icon={ICONS.filter}
                        color="bg-surface text-ink   border border-line "
                        onClick={() => handleFilterNavigation('status', 'In Repair')}
                    />
                    <Card
                        title="Retired / Scrapped"
                        value={stats.retiredAssets}
                        icon={ICONS.delete}
                        color="bg-canvas text-ink   border border-line "
                        onClick={() => handleFilterNavigation('status', 'Retired')}
                    />
                </div>
            </section>

            {/* Primary Analytics Grid: Company, Status, and Location */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-ink">
                            Fleet Analytics &amp; Demographics
                        </h2>
                        <p className="text-xs text-quiet">
                            {selectedCompany === 'All' ? 'System-wide fleet metrics across Avana Group' : `Filtered exclusively for ${selectedCompany}`}
                        </p>
                    </div>
                    {selectedCompany !== 'All' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-surface text-ink">
                            Viewing: {selectedCompany}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 1. Multi-Company Analytics Card */}
                    <CompanyAnalyticsCard
                        assets={assets}
                        selectedCompany={selectedCompany}
                        onSelectCompany={setSelectedCompany}
                        onNavigateToCompanyAssets={handleNavigateToCompanyAssets}
                    />

                    {/* 2. Assets by Lifecycle Status */}
                    <DoughnutChart
                        title="Assets by Status"
                        data={assetsByStatus}
                        colors={chartColors1}
                        onItemClick={(status) => handleFilterNavigation('status', status)}
                    />

                    {/* 3. Assets by Location (Major Corporate Hubs + Clickable Other/Remote) */}
                    <LocationAnalytics
                        assets={activeAssets}
                        onLocationClick={(location) => handleFilterNavigation('location', location)}
                    />
                </div>

                {/* Secondary Row: Hardware Category & Warranty Health */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <DoughnutChart
                        title="Assets by Category"
                        data={assetsByCategory}
                        colors={chartColors2}
                        onItemClick={(category) => handleFilterNavigation('category', category)}
                    />
                    <WarrantyStatusOverview
                        assets={activeAssets}
                        onStatusClick={handleWarrantyFilter}
                    />
                </div>
            </section>

            {/* Tabbed Intelligence & Alerts Center */}
            <section className="space-y-4">
                <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
                    {/* Tab Navigation Header */}
                    <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-canvas/70">
                        <div>
                            <h3 className="text-base font-bold text-ink">
                                Activity &amp; Fleet Intelligence
                            </h3>
                            <p className="text-xs text-quiet">
                                Real-time additions, upcoming warranty cutoffs, and software subscriptions
                            </p>
                        </div>

                        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl">
                            <button
                                onClick={() => setAlertsTab('recent')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    alertsTab === 'recent'
                                        ? 'bg-surface  text-ink  shadow-sm'
                                        : 'text-quiet  hover:text-ink'
                                }`}
                            >
                                ⚡ Recent Assets
                            </button>
                            <button
                                onClick={() => setAlertsTab('warranty')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    alertsTab === 'warranty'
                                        ? 'bg-surface  text-ink  shadow-sm'
                                        : 'text-quiet  hover:text-ink'
                                }`}
                            >
                                🛡️ Warranty Alerts
                            </button>
                            <button
                                onClick={() => setAlertsTab('licenses')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    alertsTab === 'licenses'
                                        ? 'bg-surface  text-ink  shadow-sm'
                                        : 'text-quiet  hover:text-ink'
                                }`}
                            >
                                🔑 Subscriptions
                            </button>
                        </div>
                    </div>

                    {/* Tab Body */}
                    <div className="p-4 sm:p-6">
                        {alertsTab === 'recent' && (
                            <RecentAssetsTable assets={activeAssets} />
                        )}
                        {alertsTab === 'warranty' && (
                            <WarrantyAlertsTable assets={activeAssets} />
                        )}
                        {alertsTab === 'licenses' && (
                            <ExpiringLicensesTable selectedCompany={selectedCompany} />
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;