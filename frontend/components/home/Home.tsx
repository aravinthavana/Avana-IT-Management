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
                    <div className="bg-gradient-to-r border-2 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-md relative overflow-hidden animate-fade-in from-amber-500/10 via-amber-50 dark:via-amber-950/20 to-orange-500/10 border-amber-400 dark:border-amber-500/50">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
                            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-xl sm:text-2xl bg-amber-500 text-white shadow-amber-500/30">
                                    📷
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                        <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                                            Action Required
                                        </span>
                                        {myPendingAudits[0].dueDate && (
                                            <span className="text-[11px] sm:text-xs font-bold text-amber-900 dark:text-amber-200">
                                                Due: {new Date(myPendingAudits[0].dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-base sm:text-xl font-black leading-tight text-slate-900 dark:text-white">
                                        IT Equipment Self-Audit Assigned
                                    </h3>
                                    <p className="text-xs sm:text-sm max-w-2xl leading-relaxed text-slate-600 dark:text-slate-300">
                                        IT Administration has requested an equipment verification for your assigned device{myPendingAudits.length > 1 ? 's' : ''} ({myPendingAudits.map(a => a.asset?.name || 'Device').join(', ')}). Please verify your hardware status, check key components, and submit a photo.
                                    </p>
                                    {myPendingAudits[0].adminRemarks && (
                                        <div className="mt-2 text-[11px] sm:text-xs font-medium italic px-2.5 sm:px-3 py-1.5 rounded-xl border inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-200/90 bg-amber-100/60 dark:bg-amber-900/30 border-amber-300 dark:border-amber-800/40">
                                            <span>💬 Note from IT:</span> &ldquo;{myPendingAudits[0].adminRemarks}&rdquo;
                                        </div>
                                    )}
                                    <div className="mt-2.5 flex items-start sm:items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-medium w-full sm:w-fit bg-blue-500/10 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50 text-blue-900 dark:text-blue-200">
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
                                            className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 active:scale-95 font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25"
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
                <div className="bg-gradient-to-br rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden from-avana-dark via-slate-900 to-brand-800 text-white">
                    <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full blur-3xl bg-white/10" />
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full blur-2xl bg-black/10" />

                    <div className="relative z-10">
                        <h2 className="text-2xl sm:text-4xl font-bold mb-2">Hello, {user.name}!</h2>
                        <p className="text-sm sm:text-base max-w-lg opacity-90 text-slate-200">Welcome to your IT service portal. Manage your assets and requests in one place.</p>

                        <div className="mt-6 sm:mt-8 flex flex-wrap gap-3 sm:gap-4">
                            <button onClick={() => navigate('requests')} className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2 shadow-md bg-white text-avana-dark hover:bg-slate-100">
                                {ICONS.add} Submit New Request
                            </button>
                            <button onClick={() => navigate('tickets')} className="px-5 py-2.5 sm:px-6 sm:py-3 backdrop-blur-md border rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20">
                                {ICONS.tickets} Get Support
                            </button>
                            <button onClick={() => navigate('kb')} className="px-5 py-2.5 sm:px-6 sm:py-3 backdrop-blur-md border rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20">
                                {ICONS.kb} Knowledge Base
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Assets Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="rounded-2xl shadow-sm border overflow-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <div className="px-6 py-5 border-b flex justify-between items-center border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-base sm:text-lg font-bold uppercase tracking-tight text-slate-800 dark:text-white">My Assigned Assets</h3>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-100 text-brand-800 dark:bg-brand-950/60 dark:text-brand-300">{myAssets.length} Total</span>
                            </div>
                            {myAssets.length > 0 ? (
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {myAssets.map(asset => {
                                        const pendingAudit = myPendingAudits.find(a => a.assetId === asset.id);
                                        return (
                                            <div key={asset.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between transition-colors group hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                                        {ICONS.assets}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-lg text-slate-900 dark:text-white">{asset.name}</h4>
                                                            {pendingAudit && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse bg-amber-500 text-white">
                                                                    Audit Due
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{asset.category} • <span className="font-mono text-xs">{asset.assetId}</span></p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                                    <div className="flex-1 text-right sm:block hidden">
                                                        <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">Status</p>
                                                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">In Use</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleStartAuditFlow(asset, pendingAudit)}
                                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm flex items-center gap-2 ${
                                                            pendingAudit
                                                                ? 'animate-pulse bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30'
                                                                : 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20'
                                                        }`}
                                                    >
                                                        📷 {pendingAudit ? 'Audit Due' : 'Self Audit'}
                                                    </button>
                                                    <button onClick={() => setSelectedAssetId(asset.id)} className="flex-1 sm:flex-none px-4 py-2 border rounded-xl text-sm font-bold transition-all active:scale-95 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                                                        View Details
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-16 text-center">
                                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-slate-50 dark:bg-slate-900 text-slate-300">
                                        {ICONS.assets}
                                    </div>
                                    <p className="font-medium text-slate-500 dark:text-slate-400">You currently have no assets assigned to you.</p>
                                </div>
                            )}
                        </div>

                        {/* My Peripherals & Accessories */}
                        <MyAccessoriesCard userId={user.id} onNavigateAssets={() => setSelectedAssetId(null)} />
                    </div>

                    {/* Quick Info / Recent Requests */}
                    <div className="space-y-6">
                        <div className="rounded-2xl shadow-sm border p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-black mb-4 uppercase tracking-tight text-slate-800 dark:text-white">Recent Requests</h3>
                            {myRequests.length > 0 ? (
                                <div className="space-y-4">
                                    {myRequests.map(req => (
                                        <div key={req.id} className="flex items-start gap-3 p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700">
                                            <div className={`mt-1 w-2 h-2 rounded-full ${req.status.includes('Approved') ? 'bg-green-500' : req.status.includes('Rejected') ? 'bg-red-500' : 'animate-pulse bg-amber-500'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate text-slate-800 dark:text-white">{req.category}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{req.status}</p>
                                            </div>
                                            <p className="text-[10px] font-medium whitespace-nowrap text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    ))}
                                    <button onClick={() => navigate('requests')} className="w-full py-2 text-sm font-bold hover:underline text-brand-600 dark:text-red-400">
                                        View All Requests &rarr;
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-center py-4 text-slate-500 dark:text-slate-400">No recent requests.</p>
                            )}
                        </div>

                        <div className="rounded-2xl shadow-sm border p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-black mb-4 uppercase tracking-tight text-slate-800 dark:text-white">Support Tickets</h3>
                            {tickets.filter(t => t.userId === user.id).length > 0 ? (
                                <div className="space-y-4">
                                    {tickets.filter(t => t.userId === user.id).slice(0, 3).map(ticket => (
                                        <div key={ticket.id} className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate text-slate-800 dark:text-white">{ticket.subject}</p>
                                                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{ticket.status}</p>
                                            </div>
                                            <span className={`w-2 h-2 rounded-full ${ticket.status === 'Open' ? 'animate-pulse bg-green-500' : ticket.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                        </div>
                                    ))}
                                    <button onClick={() => navigate('tickets')} className="w-full py-2 text-sm font-bold hover:underline text-center text-brand-600 dark:text-brand-400">
                                        View All Tickets &rarr;
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-center py-4 italic text-slate-500 dark:text-slate-400">No active tickets.</p>
                            )}
                        </div>

                        <div className="rounded-2xl p-6 border bg-brand-50/60 dark:bg-slate-800/80 border-brand-200/60 dark:border-slate-700">
                            <h4 className="font-bold mb-2 flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                {ICONS.info} Need Help?
                            </h4>
                            <p className="text-sm mb-4 text-slate-600 dark:text-slate-300">Contact IT support if you're having issues with your equipment.</p>
                            <a href="mailto:itsupport@avanamedical.com" className="block w-full py-2.5 border rounded-xl text-center text-sm font-bold shadow-sm hover:shadow-md transition-all bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 border-slate-200 dark:border-slate-700">
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

    const chartColors1 = ['#2ecc71', '#3498db', '#f1c40f', '#95a5a6', '#e74c3c'];
    const chartColors2 = ['#1abc9c', '#e67e22', '#34495e', '#f39c12', '#c0392b', '#8e44ad', '#2980b9'];

    return (
        <div className="space-y-8 animate-fade-in">
            <PendingHandovers />

            {/* Top Company Filter Bar & Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        IT Asset &amp; Operations Dashboard
                    </h2>
                    <p className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">
                        Real-time hardware inventory, multi-company analytics, and fleet lifecycle tracking.
                    </p>
                </div>

                {/* Company Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setSelectedCompany('All')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            selectedCompany === 'All'
                                ? 'shadow-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                        All Companies ({assets.length})
                    </button>
                    <button
                        onClick={() => setSelectedCompany('AMD')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            selectedCompany === 'AMD'
                                ? 'shadow-sm bg-brand-600 text-white shadow-brand-600/30'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-brand-400"></span>
                        <span>AMD ({companyCounts.AMD})</span>
                    </button>
                    <button
                        onClick={() => setSelectedCompany('ASSP')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            selectedCompany === 'ASSP'
                                ? 'shadow-sm bg-emerald-600 text-white shadow-emerald-600/30'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>ASSP ({companyCounts.ASSP})</span>
                    </button>
                    <button
                        onClick={() => setSelectedCompany('ATS')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            selectedCompany === 'ATS'
                                ? 'shadow-sm bg-purple-600 text-white shadow-purple-600/30'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span>
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
                        color="border bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900/50"
                        onClick={() => handleFilterNavigation('status', 'All')}
                        badge={`${stats.utilizationRate}% Deployed`}
                    />
                    <Card
                        title="Assigned (In Use)"
                        value={stats.assignedAssets}
                        icon={ICONS.users}
                        color="border bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50"
                        onClick={() => handleFilterNavigation('status', 'Assigned')}
                    />
                    <Card
                        title="In Stock (Available)"
                        value={stats.inStockAssets}
                        icon={ICONS.qr}
                        color="border bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-900/50"
                        onClick={() => handleFilterNavigation('status', 'In Stock')}
                    />
                    <Card
                        title="In Repair / Inspection"
                        value={stats.inRepairAssets}
                        icon={ICONS.filter}
                        color="border bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/50"
                        onClick={() => handleFilterNavigation('status', 'In Repair')}
                    />
                    <Card
                        title="Retired / Scrapped"
                        value={stats.retiredAssets}
                        icon={ICONS.delete}
                        color="border bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        onClick={() => handleFilterNavigation('status', 'Retired')}
                    />
                </div>
            </section>

            {/* Primary Analytics Grid: Company, Status, and Location */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            Fleet Analytics &amp; Demographics
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {selectedCompany === 'All' ? 'System-wide fleet metrics across Avana Group' : `Filtered exclusively for ${selectedCompany}`}
                        </p>
                    </div>
                    {selectedCompany !== 'All' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300">
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
                <div className="rounded-2xl shadow-sm border overflow-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    {/* Tab Navigation Header */}
                    <div className="p-4 sm:p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Activity &amp; Fleet Intelligence
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Real-time additions, upcoming warranty cutoffs, and software subscriptions
                            </p>
                        </div>

                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-700">
                            <button
                                onClick={() => setAlertsTab('recent')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    alertsTab === 'recent'
                                        ? 'shadow-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                }`}
                            >
                                ⚡ Recent Assets
                            </button>
                            <button
                                onClick={() => setAlertsTab('warranty')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    alertsTab === 'warranty'
                                        ? 'shadow-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                }`}
                            >
                                🛡️ Warranty Alerts
                            </button>
                            <button
                                onClick={() => setAlertsTab('licenses')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    alertsTab === 'licenses'
                                        ? 'shadow-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
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