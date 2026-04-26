import React from 'react';
import { useAppContext } from '../../hooks/useAppContext';

const Breadcrumbs: React.FC = () => {
    const {
        view,
        selectedAssetId,
        selectedUserId,
        selectedDepartmentId,
        selectedBranchId,
        assets,
        users,
        departments,
        branches,
        navigate,
        setSelectedAssetId,
        setSelectedUserId,
        setSelectedDepartmentId,
        setSelectedBranchId,
        assetFilters,
    } = useAppContext();

    const viewTitles: { [key: string]: string } = {
        dashboard: 'Home',
        assets: 'Asset Management',
        users: 'User Management',
        departments: 'Department Management',
        branches: 'Branch Management',
        requests: 'Asset Requests',
        purchases: 'Purchase Management',
        licenses: 'License Management',
        profile: 'My Profile',
    };

    const fullPath = React.useMemo(() => {
        const path: { label: string; onClick?: () => void }[] = [];

        if (view !== 'dashboard') {
             path.push({ label: 'Home', onClick: () => navigate('dashboard') });
        }

        const baseViewTitle = viewTitles[view];
        if (!baseViewTitle) return path;

        const isDetailView = (view === 'assets' && selectedAssetId) || 
                             (view === 'users' && selectedUserId) ||
                             (view === 'departments' && selectedDepartmentId) ||
                             (view === 'branches' && selectedBranchId);

        path.push({
            label: baseViewTitle,
            onClick: isDetailView ? () => {
                if (view === 'assets') setSelectedAssetId(null);
                if (view === 'users') setSelectedUserId(null);
                if (view === 'departments') setSelectedDepartmentId(null);
                if (view === 'branches') setSelectedBranchId(null);
            } : (view === 'dashboard' ? undefined : () => navigate(view))
        });
        
        // Add asset filter crumb
        if (view === 'assets' && assetFilters.length > 0) {
            const statusFilter = assetFilters.find(f => f.field === 'status' && f.value !== 'All');
            if(statusFilter && !selectedAssetId) {
                path.push({ label: statusFilter.value });
            }
            const warrantyFilter = assetFilters.find(f => f.field === 'warrantyStatus' && f.value !== 'All');
            if(warrantyFilter && !selectedAssetId) {
                path.push({ label: `Warranty: ${warrantyFilter.value}` });
            }
        }


        if (view === 'users' && selectedUserId) {
            const user = users.find(u => u.id === selectedUserId);
            path.push({ label: user ? user.name : '...' });
        } else if (view === 'departments' && selectedDepartmentId) {
            const department = departments.find(d => d.id === selectedDepartmentId);
            path.push({ label: department ? department.name : '...' });
        } else if (view === 'branches' && selectedBranchId) {
            const branch = branches.find(b => b.id === selectedBranchId);
            path.push({ label: branch ? branch.name : '...' });
        }
        
        if (selectedAssetId) {
            const asset = assets.find(a => a.id === selectedAssetId);
            if(asset) {
                const parentViewIsAssetList = view === 'assets';
                const lastCrumb = path[path.length - 1];

                // If the last crumb is an entity name (like a user or department), it won't have an onClick.
                // We add one to allow navigating from the asset detail back to the entity detail.
                if (lastCrumb && !lastCrumb.onClick && !parentViewIsAssetList) {
                    lastCrumb.onClick = () => setSelectedAssetId(null);
                }
                path.push({ label: asset.name });
            }
        }
        
        return path;
    }, [
        view, selectedAssetId, selectedUserId, selectedDepartmentId, selectedBranchId, 
        assets, users, departments, branches, assetFilters,
        navigate, 
        setSelectedAssetId, setSelectedUserId, setSelectedDepartmentId, setSelectedBranchId
    ]);


    if (fullPath.length <= 1) {
        return <div className="mb-6 h-5"></div>; // Keep space consistent even when empty
    }

    return (
        <nav className="mb-6" aria-label="Breadcrumb">
            <ol role="list" className="flex items-center space-x-2 text-sm">
                {fullPath.map((crumb, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && (
                            <li>
                                <svg className="h-5 w-5 flex-shrink-0 text-slate-400 dark:text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                </svg>
                            </li>
                        )}
                        <li>
                            {index < fullPath.length - 1 ? (
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        crumb.onClick && crumb.onClick();
                                    }}
                                    className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline"
                                >
                                    {crumb.label}
                                </a>
                            ) : (
                                <span className="font-medium text-slate-700 dark:text-slate-200" aria-current="page">
                                    {crumb.label}
                                </span>
                            )}
                        </li>
                    </React.Fragment>
                ))}
            </ol>
        </nav>
    );
};

export default Breadcrumbs;