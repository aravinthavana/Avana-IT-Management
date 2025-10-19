import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import Card from '../ui/Card';
import { ICONS } from '../../constants';
import DoughnutChart from '../ui/DoughnutChart';
import RecentAssetsTable from './RecentAssetsTable';
import WarrantyAlertsTable from './WarrantyAlertsTable';
import BarChart from './BarChart';
import WarrantyStatusOverview from './WarrantyStatusOverview';
import { WarrantyStatus } from '../../types';

const Home: React.FC = () => {
    const { assets, users, navigate, setAssetFilters } = useAppContext();

    const stats = useMemo(() => ({
        totalAssets: assets.length,
        assignedAssets: assets.filter(a => a.status === 'Assigned').length,
        inStockAssets: assets.filter(a => a.status === 'In Stock').length,
        inRepairAssets: assets.filter(a => a.status === 'In Repair').length,
        retiredAssets: assets.filter(a => a.status === 'Retired').length,
    }), [assets]);

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

    const handleWarrantyFilter = (status: WarrantyStatus['label']) => {
        setAssetFilters([{ id: Date.now(), field: 'warrantyStatus', value: status }]);
        navigate('assets');
    }
    
    const chartColors1 = ['#2ecc71', '#3498db', '#f1c40f', '#95a5a6', '#e74c3c'];
    const chartColors2 = ['#1abc9c', '#e67e22', '#34495e', '#f39c12', '#c0392b', '#8e44ad', '#2980b9'];

    return (
        <div className="space-y-8">
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
                     <WarrantyAlertsTable />
                </div>
            </section>
        </div>
    );
};

export default Home;