import React, { useState, useMemo } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Home from './components/home/Home';
import AssetManagement from './components/assets/AssetManagement';
import UserManagement from './components/users/UserManagement';
import DepartmentManagement from './components/departments/DepartmentManagement';
import BranchManagement from './components/branches/BranchManagement';
import PurchaseManagement from './components/purchases/PurchaseManagement';
import UserProfile from './components/profile/UserProfile';
import Notification from './components/ui/Notification';
import { useAppContext } from './hooks/useAppContext';
import Breadcrumbs from './components/ui/Breadcrumbs';
import AssetDetailView from './components/assets/AssetDetailView';
import PurchaseDetailView from './components/purchases/PurchaseDetailView';
import DeclarationFormPreview from './components/previews/DeclarationFormPreview';
import PrintLabelPreview from './components/previews/PrintLabelPreview';

export default function App() {
    const { 
        view, pageState, clearPageState, notification, setNotification, 
        selectedAssetId, assets, setSelectedAssetId, 
        selectedPurchaseId, purchaseRecords, setSelectedPurchaseId, 
        previewTarget 
    } = useAppContext();
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const selectedAsset = useMemo(() => assets.find(a => a.id === selectedAssetId), [assets, selectedAssetId]);
    const selectedPurchase = useMemo(() => purchaseRecords.find(p => p.id === selectedPurchaseId), [purchaseRecords, selectedPurchaseId]);

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
                return <UserManagement initialFilters={pageState?.initialFilters} onFiltersApplied={clearPageState} />;
            case 'departments':
                return <DepartmentManagement />;
            case 'branches':
                return <BranchManagement />;
            case 'purchases':
                return <PurchaseManagement pageState={pageState} onPageStateConsumed={clearPageState} />;
            case 'profile':
                return <UserProfile />;
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