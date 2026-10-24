import React, { useState, useMemo, Suspense, lazy } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Home from './components/home/Home';
import Notification from './components/ui/Notification';
import { useAppContext } from './hooks/useAppContext';
import Breadcrumbs from './components/ui/Breadcrumbs';
import Login from './components/auth/Login';
import { useAuth } from './contexts/AuthContext';

// Dynamic lazy-loaded view components
const AssetManagement = lazy(() => import('./components/assets/AssetManagement'));
const UserManagement = lazy(() => import('./components/users/UserManagement'));
const DepartmentManagement = lazy(() => import('./components/departments/DepartmentManagement'));
const BranchManagement = lazy(() => import('./components/branches/BranchManagement'));
const PurchaseManagement = lazy(() => import('./components/purchases/PurchaseManagement'));
const LicenseManagement = lazy(() => import('./components/licenses/LicenseManagement'));
const UserProfile = lazy(() => import('./components/profile/UserProfile'));
const AssetDetailView = lazy(() => import('./components/assets/AssetDetailView'));
const PurchaseDetailView = lazy(() => import('./components/purchases/PurchaseDetailView'));
const DeclarationFormPreview = lazy(() => import('./components/previews/DeclarationFormPreview'));
const PrintLabelPreview = lazy(() => import('./components/previews/PrintLabelPreview'));
const AssetRequestList = lazy(() => import('./components/requests/AssetRequestList'));
const SupportTickets = lazy(() => import('./components/tickets/SupportTickets'));
const KnowledgeBase = lazy(() => import('./components/kb/KnowledgeBase'));
const SelfAuditsList = lazy(() => import('./components/audits/SelfAuditsList'));
const OnboardingManagement = lazy(() => import('./components/onboarding/OnboardingManagement'));

class ErrorBoundary extends React.Component<any, any> {
    public state = { hasError: false, error: null as Error | null };
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught React Error:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center border rounded-xl m-6 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                    <h2 className="text-lg font-bold text-red-800 dark:text-red-400">Something went wrong</h2>
                    <p className="text-sm mt-2 mb-4 text-red-600 dark:text-red-300">{this.state.error?.message || 'An unexpected rendering error occurred.'}</p>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 font-semibold rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700">Reload Page</button>
                </div>
            );
        }
        return (this as any).props.children;
    }
}

const ViewLoadingFallback: React.FC = () => (
    <div className="flex flex-col items-center justify-center py-28 text-slate-400">
        <div className="w-8 h-8 border-3 border-[#b27f0d] border-t-transparent rounded-full animate-spin mb-3"></div>
        <span className="text-sm font-medium font-body text-slate-500 dark:text-slate-400">Loading view...</span>
    </div>
);

const AccessDenied: React.FC<{ message?: string }> = ({
    message = 'You do not have permission to view this page. Contact an Administrator if you believe this is an error.'
}) => (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl shadow-sm border text-center max-w-md mx-auto my-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 text-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <svg className="w-7 h-7 text-[#b27f0d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        </div>
        <h2 className="text-xl font-bold font-heading text-slate-800 dark:text-slate-100">Access Denied</h2>
        <p className="text-sm mt-2 font-body leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
        <button
            onClick={() => window.location.href = '/'}
            className="mt-6 px-5 py-2.5 bg-[#b27f0d] font-medium rounded-lg hover:opacity-90 text-sm transition-all shadow-sm text-white"
        >
            Return to Dashboard
        </button>
    </div>
);

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
        return (
            <Suspense fallback={<ViewLoadingFallback />}>
                {previewTarget.type === 'declaration' ? <DeclarationFormPreview /> : <PrintLabelPreview />}
            </Suspense>
        );
    }

    const renderView = () => {
        // Detail views take precedence
        if (selectedAssetId) {
            if (assets.length === 0) {
                return (
                    <div className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400">
                        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mr-3 border-brand-500"></div>
                        <span className="font-body text-sm">Loading asset details...</span>
                    </div>
                );
            }
            if (!selectedAsset) {
                return (
                    <div className="text-center p-8 rounded-2xl shadow-sm border max-w-md mx-auto my-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <h2 className="text-xl font-bold font-heading text-slate-800 dark:text-slate-100">Asset Not Found</h2>
                        <p className="text-sm mt-2 font-body text-slate-500 dark:text-slate-400">The requested asset could not be located.</p>
                        <button onClick={() => setSelectedAssetId(null)} className="mt-5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700">&larr; Back to Assets</button>
                    </div>
                );
            }
            return <AssetDetailView asset={selectedAsset} onBack={() => setSelectedAssetId(null)} />;
        }

        if (selectedPurchaseId) {
            if (user?.role !== 'Admin') {
                return <AccessDenied message="Purchases are restricted to Administrators only." />;
            }
            if (purchaseRecords.length === 0) {
                return (
                    <div className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400">
                        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mr-3 border-brand-500"></div>
                        <span className="font-body text-sm">Loading purchase details...</span>
                    </div>
                );
            }
            if (!selectedPurchase) {
                return (
                    <div className="text-center p-8 rounded-2xl shadow-sm border max-w-md mx-auto my-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <h2 className="text-xl font-bold font-heading text-slate-800 dark:text-slate-100">Purchase Record Not Found</h2>
                        <p className="text-sm mt-2 font-body text-slate-500 dark:text-slate-400">The requested purchase record could not be located.</p>
                        <button onClick={() => setSelectedPurchaseId(null)} className="mt-5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700">&larr; Back to Purchases</button>
                    </div>
                );
            }
            return <PurchaseDetailView purchase={selectedPurchase} onBack={() => setSelectedPurchaseId(null)} />;
        }

        switch (view) {
            case 'dashboard':
                return <Home />;
            case 'assets':
                return <AssetManagement />;
            case 'users':
                if (user?.role === 'User') return <AccessDenied message="User Management is restricted to Administrators and Managers." />;
                return <UserManagement initialFilters={pageState?.initialFilters} onFiltersApplied={clearPageState} />;
            case 'onboarding':
                if (user?.role === 'User') return <AccessDenied message="Onboarding Management is restricted to Administrators and Managers." />;
                return <OnboardingManagement />;
            case 'requests':
                return <AssetRequestList />;
            case 'departments':
                if (user?.role === 'User') return <AccessDenied message="Department Management is restricted to Administrators and Managers." />;
                return <DepartmentManagement />;
            case 'branches':
                if (user?.role === 'User') return <AccessDenied message="Branch Management is restricted to Administrators and Managers." />;
                return <BranchManagement />;
            case 'purchases':
                if (user?.role !== 'Admin') return <AccessDenied message="Purchases are restricted to Administrators only." />;
                return <PurchaseManagement pageState={pageState} onPageStateConsumed={clearPageState} />;
            case 'licenses':
                if (user?.role !== 'Admin') return <AccessDenied message="Licenses & Subscriptions are restricted to Administrators only." />;
                 return <LicenseManagement />;
            case 'profile':
                return <UserProfile />;
            case 'tickets':
                return <SupportTickets />;
            case 'kb':
                return <KnowledgeBase />;
            case 'audits':
                if (user?.role === 'User') return <AccessDenied message="Self-Audits are restricted to Administrators and Managers." />;
                return <SelfAuditsList />;
            default:
                return <Home />;
        }
    };

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="flex min-h-dvh bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <Sidebar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
                <div className="flex flex-col flex-1 lg:ml-64 min-w-0">
                    <Header isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
                    <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8">
                        <Breadcrumbs />
                        <div key={view} className="page-transition">
                            <ErrorBoundary>
                                <Suspense fallback={<ViewLoadingFallback />}>
                                    {renderView()}
                                </Suspense>
                            </ErrorBoundary>
                        </div>
                    </main>
                </div>
                <Notification notification={notification} onClear={() => setNotification(null)} />
            </div>
        </>
    );
}
