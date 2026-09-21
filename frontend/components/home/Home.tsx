import React, { useMemo, useState } from 'react';
import SelfAuditModal from '../assets/SelfAuditModal';
import { useAppContext } from '../../hooks/useAppContext';
import Card from '../ui/Card';
import { ICONS } from '../../constants';
import DoughnutChart from '../ui/DoughnutChart';
import RecentAssetsTable from './RecentAssetsTable';
import WarrantyAlertsTable from './WarrantyAlertsTable';
import BarChart from './BarChart';
import WarrantyStatusOverview from './WarrantyStatusOverview';
import { WarrantyStatus } from '../../types';
import ExpiringLicensesTable from '../dashboard/ExpiringLicensesTable';
import PendingHandovers from '../handovers/PendingHandovers';

import { useAuth } from '../../contexts/AuthContext';

const Home: React.FC = () => {
    const { assets, users, navigate, setAssetFilters, setSelectedAssetId, tickets, assetRequests, selfAudits } = useAppContext();
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditTargetAsset, setAuditTargetAsset] = useState<any>(null);
    const [auditTargetRecord, setAuditTargetRecord] = useState<any>(null);
    const { user } = useAuth();

    const stats = useMemo(() => ({
        totalAssets: assets.length,
        assignedAssets: assets.filter(a => a.status === 'Assigned').length,
        inStockAssets: assets.filter(a => a.status === 'In Stock').length,
        inRepairAssets: assets.filter(a => a.status === 'In Repair').length,
        retiredAssets: assets.filter(a => a.status === 'Retired').length,
    }), [assets]);

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
                    <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 dark:via-amber-950/20 to-orange-500/10 border-2 border-amber-400 dark:border-amber-500/50 rounded-3xl p-6 shadow-md relative overflow-hidden animate-fade-in">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30 text-2xl">
                                    📷
                                </div>
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                                            Action Required
                                        </span>
                                        {myPendingAudits[0].dueDate && (
                                            <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                                Due: {new Date(myPendingAudits[0].dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                                        IT Equipment Self-Audit Assigned
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                                        IT Administration has requested an equipment verification for your assigned device{myPendingAudits.length > 1 ? 's' : ''} ({myPendingAudits.map(a => a.asset?.name || 'Device').join(', ')}). Please verify your hardware status, check key components, and submit a photo.
                                    </p>
                                    {myPendingAudits[0].adminRemarks && (
                                        <div className="mt-2 text-xs text-amber-800 dark:text-amber-200/90 font-medium italic bg-amber-100/60 dark:bg-amber-900/30 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800/40 inline-flex items-center gap-1.5">
                                            <span>💬 Note from IT:</span> &ldquo;{myPendingAudits[0].adminRemarks}&rdquo;
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="w-full md:w-auto shrink-0 flex flex-col sm:flex-row gap-3">
                                {myPendingAudits.map((audit) => {
                                    const targetAsset = myAssets.find(a => a.id === audit.assetId) || audit.asset;
                                    return (
                                        <button
                                            key={audit.id}
                                            onClick={() => {
                                                if (targetAsset) {
                                                    setAuditTargetAsset(targetAsset);
                                                    setAuditTargetRecord(audit);
                                                    setIsAuditModalOpen(true);
                                                }
                                            }}
                                            className="px-6 py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-sm rounded-2xl shadow-md shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
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
                <div className="bg-gradient-to-br from-avana-dark via-slate-900 to-brand-800 rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-black/10 rounded-full blur-2xl" />
                    
                    <div className="relative z-10">
                        <h2 className="text-2xl sm:text-4xl font-bold mb-2">Hello, {user.name}!</h2>
                        <p className="text-slate-200 text-sm sm:text-base max-w-lg opacity-90">Welcome to your IT service portal. Manage your assets and requests in one place.</p>
                        
                        <div className="mt-6 sm:mt-8 flex flex-wrap gap-3 sm:gap-4">
                            <button onClick={() => navigate('requests')} className="px-5 py-2.5 sm:px-6 sm:py-3 bg-white text-avana-dark rounded-xl font-bold text-sm transition-all hover:bg-slate-100 active:scale-95 flex items-center gap-2 shadow-md">
                                {ICONS.add} Submit New Request
                            </button>
                            <button onClick={() => navigate('tickets')} className="px-5 py-2.5 sm:px-6 sm:py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl font-bold text-sm transition-all hover:bg-white/20 active:scale-95 flex items-center gap-2">
                                {ICONS.tickets} Get Support
                            </button>
                            <button onClick={() => navigate('kb')} className="px-5 py-2.5 sm:px-6 sm:py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl font-bold text-sm transition-all hover:bg-white/20 active:scale-95 flex items-center gap-2">
                                {ICONS.kb} Knowledge Base
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Assets Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">My Assigned Assets</h3>
                                <span className="px-3 py-1 bg-brand-100 text-brand-800 dark:bg-brand-950/60 dark:text-brand-300 rounded-full text-xs font-bold">{myAssets.length} Total</span>
                            </div>
                            {myAssets.length > 0 ? (
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {myAssets.map(asset => {
                                        const pendingAudit = myPendingAudits.find(a => a.assetId === asset.id);
                                        return (
                                            <div key={asset.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform shadow-inner">
                                                        {ICONS.assets}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-slate-900 dark:text-white text-lg">{asset.name}</h4>
                                                            {pendingAudit && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white animate-pulse">
                                                                    Audit Due
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{asset.category} • <span className="font-mono text-xs">{asset.assetId}</span></p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                                    <div className="flex-1 text-right sm:block hidden">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                                        <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-xs font-bold">In Use</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => { 
                                                            setAuditTargetAsset(asset); 
                                                            setAuditTargetRecord(pendingAudit || null);
                                                            setIsAuditModalOpen(true); 
                                                        }} 
                                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm flex items-center gap-2 ${
                                                            pendingAudit
                                                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30 animate-pulse'
                                                                : 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20'
                                                        }`}
                                                    >
                                                        📷 {pendingAudit ? 'Audit Due' : 'Self Audit'}
                                                    </button>
                                                    <button onClick={() => setSelectedAssetId(asset.id)} className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
                                                        View Details
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-16 text-center">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                        {ICONS.assets}
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">You currently have no assets assigned to you.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Info / Recent Requests */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tight">Recent Requests</h3>
                            {myRequests.length > 0 ? (
                                <div className="space-y-4">
                                    {myRequests.map(req => (
                                        <div key={req.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                                            <div className={`mt-1 w-2 h-2 rounded-full ${req.status.includes('Approved') ? 'bg-green-500' : req.status.includes('Rejected') ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{req.category}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{req.status}</p>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{new Date(req.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    ))}
                                    <button onClick={() => navigate('requests')} className="w-full py-2 text-sm font-bold text-brand-600 dark:text-red-400 hover:underline">
                                        View All Requests &rarr;
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No recent requests.</p>
                            )}
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tight">Support Tickets</h3>
                            {tickets.filter(t => t.userId === user.id).length > 0 ? (
                                <div className="space-y-4">
                                    {tickets.filter(t => t.userId === user.id).slice(0, 3).map(ticket => (
                                        <div key={ticket.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{ticket.subject}</p>
                                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">{ticket.status}</p>
                                            </div>
                                            <span className={`w-2 h-2 rounded-full ${ticket.status === 'Open' ? 'bg-green-500 animate-pulse' : ticket.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                        </div>
                                    ))}
                                    <button onClick={() => navigate('tickets')} className="w-full py-2 text-sm font-bold text-brand-600 dark:text-brand-400 hover:underline text-center">
                                        View All Tickets &rarr;
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4 italic">No active tickets.</p>
                            )}
                        </div>

                        <div className="bg-brand-50/60 dark:bg-slate-800/80 rounded-2xl p-6 border border-brand-200/60 dark:border-slate-700">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                                {ICONS.info} Need Help?
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Contact IT support if you're having issues with your equipment.</p>
                            <a href="mailto:it-support@avana.com" className="block w-full py-2.5 bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-sm font-bold shadow-sm hover:shadow-md transition-all">
                                Email IT Support
                            </a>
                        </div>
                    </div>
                </div>
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

    const assetsByStatus = useMemo(() => assets.reduce((acc, asset) => {
        acc[asset.status] = (acc[asset.status] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number }), [assets]);
    
    const assetsByCategory = useMemo(() => assets.reduce((acc, asset) => {
        acc[asset.category] = (acc[asset.category] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number }), [assets]);

    const assetsByLocation = useMemo(() => assets.reduce((acc, asset) => {
        if(asset.location) {
            acc[asset.location] = (acc[asset.location] || 0) + 1;
        }
        return acc;
    }, {} as { [key: string]: number }), [assets]);
    
    const handleFilterNavigation = (field: string, value: string) => {
        setAssetFilters([{ id: Date.now(), field, value }]);
        navigate('assets');
    };

    const handleWarrantyFilter = (status: any) => {
        setAssetFilters([{ id: Date.now(), field: 'warrantyStatus', value: status }]);
        navigate('assets');
    }
    
    const chartColors1 = ['#2ecc71', '#3498db', '#f1c40f', '#95a5a6', '#e74c3c'];
    const chartColors2 = ['#1abc9c', '#e67e22', '#34495e', '#f39c12', '#c0392b', '#8e44ad', '#2980b9'];

    return (
        <div className="space-y-8">
            <PendingHandovers />
            <section>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">At a Glance</h2>
                 <div className="flex gap-6 pb-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 overflow-x-auto">
                    <div className="min-w-[240px] flex-shrink-0">
                        <Card title="Total Assets" value={stats.totalAssets} icon={ICONS.assets} color="bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" onClick={() => handleFilterNavigation('status', 'All')} />
                    </div>
                    <div className="min-w-[240px] flex-shrink-0">
                       <Card title="Assigned" value={stats.assignedAssets} icon={ICONS.users} color="bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400" onClick={() => handleFilterNavigation('status', 'Assigned')} />
                    </div>
                    <div className="min-w-[240px] flex-shrink-0">
                        <Card title="In Stock" value={stats.inStockAssets} icon={ICONS.qr} color="bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400" onClick={() => handleFilterNavigation('status', 'In Stock')} />
                    </div>
                    <div className="min-w-[240px] flex-shrink-0">
                        <Card title="In Repair" value={stats.inRepairAssets} icon={ICONS.filter} color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400" onClick={() => handleFilterNavigation('status', 'In Repair')} />
                    </div>
                     <div className="min-w-[240px] flex-shrink-0">
                        <Card title="Retired" value={stats.retiredAssets} icon={ICONS.delete} color="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" onClick={() => handleFilterNavigation('status', 'Retired')} />
                    </div>
                </div>
            </section>
            
            <section>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Analytics</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                    <DoughnutChart title="Assets by Status" data={assetsByStatus} colors={chartColors1} onItemClick={(status) => handleFilterNavigation('status', status)} />
                    <BarChart title="Assets by Location" data={assetsByLocation} onItemClick={(location) => handleFilterNavigation('location', location)} />
                    <WarrantyStatusOverview onStatusClick={handleWarrantyFilter} />
                    <div className="lg:col-span-2 xl:col-span-3">
                         <DoughnutChart title="Assets by Category" data={assetsByCategory} colors={chartColors2} onItemClick={(category) => handleFilterNavigation('category', category)} />
                    </div>
                </div>
            </section>
            
            <section>
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Activity & Alerts</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <RecentAssetsTable />
                     <div className="space-y-8">
                         <WarrantyAlertsTable />
                         <ExpiringLicensesTable />
                     </div>
                </div>
            </section>
        </div>
    );
};

export default Home;