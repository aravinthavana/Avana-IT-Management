import React, { useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import Card from '../ui/Card';
import { ICONS } from '../../constants';
import DoughnutChart from '../ui/DoughnutChart';
import RecentAssetsTable from './RecentAssetsTable';
import ExpiringWarrantyTable from './ExpiringWarrantyTable';

const Dashboard: React.FC = () => {
    const { assets, users, navigate, setAssetFilters } = useAppContext();

    const stats = useMemo(() => ({
        totalAssets: assets.length,
        assignedAssets: assets.filter(a => a.status === 'Assigned').length,
        totalUsers: users.length,
        assetsInRepair: assets.filter(a => a.status === 'In Repair').length
    }), [assets, users]);

    const assetsByStatus = useMemo(() => assets.reduce((acc, asset) => {
        acc[asset.status] = (acc[asset.status] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number }), [assets]);
    
    const assetsByCategory = useMemo(() => assets.reduce((acc, asset) => {
        acc[asset.category] = (acc[asset.category] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number }), [assets]);
    
    const handleCardClick = (field: string, value: string) => {
        setAssetFilters([{ id: Date.now(), field, value }]);
        navigate('assets');
    };
    
    const chartColors1 = ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'];
    const chartColors2 = ['#1abc9c', '#e67e22', '#34495e', '#f39c12', '#c0392b'];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card title="Total Assets" value={stats.totalAssets} icon={ICONS.assets} color="bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" onClick={() => handleCardClick('status', 'All')} />
                <Card title="Assigned Assets" value={stats.assignedAssets} icon={ICONS.assets} color="bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400" onClick={() => handleCardClick('status', 'Assigned')} />
                <Card title="Total Users" value={stats.totalUsers} icon={ICONS.users} color="bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400" onClick={() => navigate('users')} />
                <Card title="Assets In Repair" value={stats.assetsInRepair} icon={ICONS.assets} color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400" onClick={() => handleCardClick('status', 'In Repair')} />
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