import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../ui/Card';
import { ICONS } from '../../constants';
import DoughnutChart from '../ui/DoughnutChart';
import RecentAssetsTable from './RecentAssetsTable';
import ExpiringWarrantyTable from './ExpiringWarrantyTable';

const Dashboard: React.FC = () => {
    const { assets, users, navigate, setAssetFilters, setSelectedAssetId, tickets } = useAppContext();
    const { user } = useAuth();

    const stats = useMemo(() => ({
        totalAssets: assets.length,
        assignedAssets: assets.filter(a => a.status === 'Assigned').length,
        totalUsers: users.length,
        assetsInRepair: assets.filter(a => a.status === 'In Repair').length
    }), [assets, users]);

    const myAssets = useMemo(() => {
        if (!user) return [];
        return assets.filter(a => a.assigneeType === 'User' && a.assigneeId === user.id);
    }, [assets, user]);

    const assetsByStatus = useMemo(() => assets.reduce((acc, asset) => {
        acc[asset.status] = (acc[asset.status] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number }), [assets]);
    
    const assetsByCategory = useMemo(() => assets.reduce((acc, asset) => {
        acc[asset.category] = (acc[asset.category] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number }), [assets]);
    
    const handleCardClick = (field: string, value: string) => {
        if (user?.role === 'User') return; // Users shouldn't filter global assets
        setAssetFilters([{ id: Date.now(), field, value }]);
        navigate('assets');
    };
    
    const chartColors1 = ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'];
    const chartColors2 = ['#1abc9c', '#e67e22', '#34495e', '#f39c12', '#c0392b'];

    // USER VIEW
    if (user?.role === 'User') {
        const { assetRequests } = useAppContext();
        const myRequests = assetRequests.filter(r => r.userId === user.id).slice(0, 3);
        
        return (
            <div className="space-y-8 animate-fade-in">
                {/* Hero / Welcome Section */}
                <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-3xl p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-black/10 rounded-full blur-2xl" />
                    
                    <div className="relative z-10">
                        <h2 className="text-3xl sm:text-4xl font-black mb-2">Hello, {user.name}!</h2>
                        <p className="text-red-100 text-lg max-w-lg opacity-90">Welcome to your IT service portal. Manage your assets and requests in one place.</p>
                        
                        <div className="mt-8 flex flex-wrap gap-4">
                            <button onClick={() => navigate('requests')} className="px-6 py-3 bg-white text-red-600 rounded-xl font-bold transition-all hover:bg-red-50 active:scale-95 flex items-center gap-2 shadow-lg">
                                {ICONS.add} Submit New Request
                            </button>
                            <button onClick={() => navigate('tickets')} className="px-6 py-3 bg-red-500/30 backdrop-blur-md border border-white/20 text-white rounded-xl font-bold transition-all hover:bg-red-500/40 active:scale-95 flex items-center gap-2">
                                {ICONS.tickets} Get Support
                            </button>
                            <button onClick={() => navigate('kb')} className="px-6 py-3 bg-red-500/30 backdrop-blur-md border border-white/20 text-white rounded-xl font-bold transition-all hover:bg-red-500/40 active:scale-95 flex items-center gap-2">
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
                                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">My Assigned Assets</h3>
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">{myAssets.length} Total</span>
                            </div>
                            {myAssets.length > 0 ? (
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {myAssets.map(asset => (
                                        <div key={asset.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform shadow-inner">
                                                    {ICONS.assets}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-lg">{asset.name}</h4>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{asset.category} • <span className="font-mono text-xs">{asset.assetId}</span></p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                                <div className="flex-1 text-right sm:block hidden">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-xs font-bold">In Use</span>
                                                </div>
                                                <button onClick={() => setSelectedAssetId(asset.id)} className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    ))}
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
                                    <button onClick={() => navigate('requests')} className="w-full py-2 text-sm font-bold text-red-600 dark:text-red-400 hover:underline">
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
                                    <button onClick={() => navigate('tickets')} className="w-full py-2 text-sm font-bold text-red-600 dark:text-red-400 hover:underline text-center">
                                        View All Tickets &rarr;
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4 italic">No active tickets.</p>
                            )}
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-100 dark:border-red-900/30">
                            <h4 className="font-bold text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                                {ICONS.info} Need Help?
                            </h4>
                            <p className="text-sm text-red-700/80 dark:text-red-300/80 mb-4">Contact IT support if you're having issues with your equipment.</p>
                            <a href="mailto:it-support@avana.com" className="block w-full py-2 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 rounded-lg text-center text-sm font-bold shadow-sm hover:shadow-md transition-all">
                                Email IT Support
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ADMIN & MANAGER VIEW
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Overview</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">System-wide statistics and metrics.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate('requests')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium shadow-sm transition-all flex items-center gap-2">
                        View Requests
                    </button>
                    {user?.role === 'Admin' && (
                        <button onClick={() => navigate('users')} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium shadow-sm transition-all flex items-center gap-2">
                            {ICONS.add} Add User
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card title="Total Assets" value={stats.totalAssets} icon={ICONS.assets} color="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/20" onClick={() => handleCardClick('status', 'All')} />
                <Card title="Assigned Assets" value={stats.assignedAssets} icon={ICONS.assets} color="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-500/20" onClick={() => handleCardClick('status', 'Assigned')} />
                <Card title="Total Users" value={stats.totalUsers} icon={ICONS.users} color="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-purple-500/20" onClick={() => navigate('users')} />
                <Card title="Assets In Repair" value={stats.assetsInRepair} icon={ICONS.assets} color="bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/20" onClick={() => handleCardClick('status', 'In Repair')} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <DoughnutChart title="Assets by Status" data={assetsByStatus} colors={chartColors1} onItemClick={(status) => handleCardClick('status', status)} />
                <DoughnutChart title="Assets by Category" data={assetsByCategory} colors={chartColors2} onItemClick={(category) => handleCardClick('category', category)} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <RecentAssetsTable />
                 <ExpiringWarrantyTable />
            </div>
        </div>
    );
};

export default Dashboard;