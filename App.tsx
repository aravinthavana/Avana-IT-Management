import React, { useState, useMemo } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Home from './components/home/Home';
import AssetManagement from './components/assets/AssetManagement';
import UserManagement from './components/users/UserManagement';
import DepartmentManagement from './components/departments/DepartmentManagement';
import BranchManagement from './components/branches/BranchManagement';
import PurchaseManagement from './components/purchases/PurchaseManagement';
import LicenseManagement from './components/licenses/LicenseManagement';
import UserProfile from './components/profile/UserProfile';
import Notification from './components/ui/Notification';
import { useAppContext } from './hooks/useAppContext';
import Breadcrumbs from './components/ui/Breadcrumbs';
import AssetDetailView from './components/assets/AssetDetailView';
import PurchaseDetailView from './components/purchases/PurchaseDetailView';
import DeclarationFormPreview from './components/previews/DeclarationFormPreview';
import PrintLabelPreview from './components/previews/PrintLabelPreview';
import Login from './components/auth/Login';
import AssetRequestList from './components/requests/AssetRequestList';
import SupportTickets from './components/tickets/SupportTickets';
import KnowledgeBase from './components/kb/KnowledgeBase';
import { useAuth } from './contexts/AuthContext';

export default function App() {
    const { 
        view, pageState, clearPageState, notification, setNotification, 
        selectedAssetId, assets, setSelectedAssetId, 
        selectedPurchaseId, purchaseRecords, setSelectedPurchaseId, 
        previewTarget 
    } = useAppContext();
    const { isAuthenticated, user } = useAuth();
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const selectedAsset = useMemo(() => assets.find(a => a.id === selectedAssetId), [assets, selectedAssetId]);
    const selectedPurchase = useMemo(() => purchaseRecords.find(p => p.id === selectedPurchaseId), [purchaseRecords, selectedPurchaseId]);

    if (!isAuthenticated) {
        return <Login />;
    }

    // If a preview is active, render it in full-screen mode
    if (previewTarget) {
        if (previewTarget.type === 'declaration') {
            return <DeclarationFormPreview />;
        }
        if (previewTarget.type === 'label') {
            return <PrintLabelPreview />;
        }
    }

    const renderView = () => {
        // Detail views take precedence
        if (selectedAsset) {
            return <AssetDetailView asset={selectedAsset} onBack={() => setSelectedAssetId(null)} />;
        }
        if (selectedPurchase) {
            return <PurchaseDetailView purchase={selectedPurchase} onBack={() => setSelectedPurchaseId(null)} />;
        }

        switch (view) {
            case 'dashboard':
                return <Home />;
            case 'assets':
                return <AssetManagement />;
            case 'users':
                if (user?.role === 'User') return <div className="p-8 text-center text-red-500">Access Denied</div>;
                return <UserManagement initialFilters={pageState?.initialFilters} onFiltersApplied={clearPageState} />;
            case 'requests':
                return <AssetRequestList />;
            case 'departments':
                if (user?.role === 'User') return <div className="p-8 text-center text-red-500">Access Denied</div>;
                return <DepartmentManagement />;
            case 'branches':
                if (user?.role === 'User') return <div className="p-8 text-center text-red-500">Access Denied</div>;
                return <BranchManagement />;
            case 'purchases':
                if (user?.role !== 'Admin') return <div className="p-8 text-center text-red-500">Access Denied</div>;
                return <PurchaseManagement pageState={pageState} onPageStateConsumed={clearPageState} />;
            case 'licenses':
                if (user?.role !== 'Admin') return <div className="p-8 text-center text-red-500">Access Denied</div>;
                 return <LicenseManagement />;
            case 'profile':
                return <UserProfile />;
            case 'tickets':
                return <SupportTickets />;
            case 'kb':
                return <KnowledgeBase />;
            default:
                return <Home />;
        }
    };

    return (
        <>
            <style>
                {`
                    body {
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                    }
                    .no-print, .no-print * {
                        display: none !important;
                    }
                `}
            </style>
            <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <Sidebar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
                <div className="flex flex-col flex-1 md:ml-64 min-w-0">
                    <Header setSidebarOpen={setSidebarOpen} />
                    <main className="flex-1 p-4 sm:p-6 lg:p-8">
                        <Breadcrumbs />
                        {renderView()}
                    </main>
                </div>
                <Notification notification={notification} onClear={() => setNotification(null)} />
            </div>
        </>
    );
}