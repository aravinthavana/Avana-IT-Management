import React, { useState, useEffect } from 'react';
import { ICONS } from '../../constants';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
    isSidebarOpen: boolean;
    setSidebarOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setSidebarOpen }) => {
    const { view: currentView, navigate, setSelectedAssetId, setSelectedUserId, setSelectedDepartmentId, setSelectedBranchId, setSelectedPurchaseId, setAssetFilters, assetFilters, assetRequests } = useAppContext();
    const { user } = useAuth();
    const [isAssetsSubMenuOpen, setIsAssetsSubMenuOpen] = useState(currentView === 'assets');

    const pendingCount = assetRequests.filter(r => r.status === (user?.role === 'Admin' ? 'Pending Admin' : 'Pending Manager')).length;

    useEffect(() => {
        setIsAssetsSubMenuOpen(currentView === 'assets');
    }, [currentView]);
    
    const navItems = [
        { name: 'Home', icon: ICONS.dashboard, view: 'dashboard', roles: ['Admin', 'Manager', 'User'] },
        { 
            name: user?.role === 'User' ? 'My Assets' : 'Asset Management', 
            icon: ICONS.assets, 
            view: 'assets',
            roles: ['Admin', 'Manager', 'User'],
            subItems: user?.role === 'User' ? undefined : [
                { name: 'In Stock', status: 'In Stock'},
                { name: 'Assigned', status: 'Assigned'},
                { name: 'In Repair', status: 'In Repair'},
                { name: 'Retired', status: 'Retired'},
            ]
        },
        { name: 'Requests', icon: ICONS.assets, view: 'requests', roles: ['Admin', 'Manager', 'User'] },
        { name: 'Support Tickets', icon: ICONS.tickets, view: 'tickets', roles: ['Admin', 'User'] },
        { name: 'Knowledge Base', icon: ICONS.kb, view: 'kb', roles: ['Admin', 'Manager', 'User'] },
        { name: 'Purchases', icon: ICONS.purchases, view: 'purchases', roles: ['Admin'] },
        { name: 'User Management', icon: ICONS.users, view: 'users', roles: ['Admin', 'Manager'] },
        { name: 'Licenses & Subs', icon: ICONS.licenses, view: 'licenses', roles: ['Admin'] },
        { name: 'Departments', icon: ICONS.departments, view: 'departments', roles: ['Admin', 'Manager'] },
        { name: 'Branches', icon: ICONS.branches, view: 'branches', roles: ['Admin', 'Manager'] },
        { name: 'My Profile', icon: ICONS.profile, view: 'profile', roles: ['Admin', 'Manager', 'User'] },
    ];

    const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));
    
    const handleNav = (view: string) => {
        setSelectedAssetId(null);
        setSelectedUserId(null);
        setSelectedDepartmentId(null);
        setSelectedBranchId(null);
        setSelectedPurchaseId(null);
        navigate(view); 
        if(window.innerWidth < 768) setSidebarOpen(false);
    };
    
    const handleAssetFilterNav = (status: string) => {
        setAssetFilters([{ id: Date.now(), field: 'status', value: status }]);
        handleNav('assets');
    };

    const activeFilterStatus = assetFilters.length === 1 && assetFilters[0].field === 'status' ? assetFilters[0].value : 'All';

    return (
        <>
            <aside className={`bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-64 fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-40 border-r border-slate-200 dark:border-slate-800`}>
                <div className="p-4 flex items-center justify-center border-b border-slate-200 dark:border-slate-800 h-16">
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate('dashboard');
                        }}
                        className="block"
                        aria-label="Go to dashboard"
                    >
                        <img src="https://avanamedical.com/wp-content/themes/avana/assets/images/logo.png" alt="Company Logo" className="h-10" />
                    </a>
                </div>
                <nav className="flex-1 px-2 py-4 space-y-1">
                    {filteredNavItems.map(item => (
                        <div key={item.name}>
                             <a 
                                href="#" 
                                onClick={(e) => { 
                                    e.preventDefault();
                                    if(item.subItems) {
                                        setIsAssetsSubMenuOpen(!isAssetsSubMenuOpen);
                                        if (currentView !== 'assets') {
                                            handleAssetFilterNav('All');
                                        }
                                    } else {
                                        handleNav(item.view);
                                    }
                                }} 
                                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg transition-colors duration-200 font-medium ${currentView === item.view ? 'bg-red-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                <div className="flex items-center flex-1">
                                    <span className="w-6 h-6 mr-3">{item.icon}</span>
                                    <span className="flex-1">{item.name}</span>
                                    {item.view === 'requests' && pendingCount > 0 && (
                                        <span className="ml-2 bg-white text-red-600 dark:bg-red-600 dark:text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                                            {pendingCount}
                                        </span>
                                    )}
                                    {item.view === 'tickets' && user?.role === 'Admin' && useAppContext().tickets?.filter((t: any) => t.status === 'Open').length > 0 && (
                                        <span className="ml-2 bg-white text-red-600 dark:bg-red-600 dark:text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                                            {useAppContext().tickets.filter((t: any) => t.status === 'Open').length}
                                        </span>
                                    )}
                                </div>
                                {item.subItems && (
                                    <svg className={`w-4 h-4 transition-transform ${isAssetsSubMenuOpen ? 'rotate-90' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
                                )}
                            </a>
                            {item.subItems && isAssetsSubMenuOpen && (
                                <div className="pl-8 py-1 space-y-1">
                                    <a href="#" onClick={(e) => { e.preventDefault(); handleAssetFilterNav('All'); }} className={`flex items-center text-sm px-4 py-2 rounded-md ${activeFilterStatus === 'All' ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>All Assets</a>
                                    {item.subItems.map(subItem => (
                                        <a key={subItem.name} href="#" onClick={(e) => { e.preventDefault(); handleAssetFilterNav(subItem.status); }} className={`flex items-center text-sm px-4 py-2 rounded-md ${activeFilterStatus === subItem.status ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                                            {subItem.name}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>
            </aside>
            {isSidebarOpen && <div className="fixed inset-0 bg-black opacity-50 z-30 md:hidden" onClick={() => setSidebarOpen(false)}></div>}
        </>
    );
};

export default Sidebar;