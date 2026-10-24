import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';

interface HeaderProps {
    isSidebarOpen: boolean;
    setSidebarOpen: (isOpen: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ isSidebarOpen, setSidebarOpen }) => {
    const { view: currentView, theme, setTheme } = useAppContext();
    const { user, logout } = useAuth();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const viewTitles: { [key: string]: string } = {
        dashboard: 'Home',
        assets: 'Asset Management',
        users: 'User Management',
        departments: 'Department Management',
        branches: 'Branch Management',
        purchases: 'Purchase Management',
        profile: 'My Profile',
        onboarding: 'Onboarding & Offboarding', requests: 'Asset Requests',
        audits: 'Self-Audits', tickets: user?.role === 'Admin' ? 'Support & Work Log' : 'Support Tickets', kb: 'Knowledge Base', licenses: 'Licenses & Subscriptions',
    };

    const themeIcons = {
        light: ICONS.themeLight,
        dark: ICONS.themeDark,
        system: ICONS.themeSystem
    };

    const themeNames = {
        light: 'Light',
        dark: 'Dark',
        system: 'System'
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
        };
        const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDropdownOpen(false); setUserMenuOpen(false); } };
        document.addEventListener('keydown', onEscape);
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener('keydown', onEscape);
        };
    }, []);


    return (
        <header className="backdrop-blur-sm border-b sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800">
            <div className="px-3 sm:px-6 lg:px-8 min-h-16 gap-2 flex items-center justify-between">
                <div className="flex items-center min-w-0 gap-2">
                    <button aria-label="Open navigation" aria-controls="primary-navigation" aria-expanded={isSidebarOpen} className="lg:hidden shrink-0 p-2 text-quiet hover:text-ink" onClick={() => setSidebarOpen(true)}>
                        {ICONS.menu}
                    </button>
                    <h1 className="text-base sm:text-xl font-semibold truncate capitalize text-slate-900 dark:text-white">{viewTitles[currentView] || 'IT Workspace'}</h1>
                </div>
                <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => { setDropdownOpen(!dropdownOpen); setUserMenuOpen(false); }}
                            aria-expanded={dropdownOpen}
                            aria-controls="theme-options"
                            className="p-2 rounded-full transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                            aria-label="Toggle theme"
                        >
                            {themeIcons[theme]}
                        </button>
                        <div id="theme-options" hidden={!dropdownOpen} className={`absolute right-0 mt-2 w-40 rounded-xl shadow-lg py-1 border origin-top-right transition-all duration-200 ease-out z-50 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ${dropdownOpen ? 'transform opacity-100 scale-100' : 'transform opacity-0 scale-95 pointer-events-none'}`}>
                            {(['light', 'dark', 'system'] as const).map(t => (
                                <button
                                    key={t}
                                    aria-pressed={theme === t}
                                    onClick={() => { setTheme(t); setDropdownOpen(false); }}
                                    className={`w-full text-left flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                                        theme === t
                                        ? 'font-semibold bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {themeIcons[t]}
                                    <span>{themeNames[t]}</span>{theme === t && <span aria-hidden="true" className="ml-auto">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="relative" ref={userMenuRef}>
                        <button aria-label="Open account menu" aria-expanded={userMenuOpen} aria-controls="account-options" onClick={() => { setUserMenuOpen(!userMenuOpen); setDropdownOpen(false); }} className="flex items-center space-x-2.5 focus:outline-none p-1 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                            <span className="hidden sm:inline max-w-40 truncate font-medium text-sm text-slate-700 dark:text-slate-300">{user?.name}</span>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm bg-avana-dark text-white">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                        </button>
                        <div id="account-options" hidden={!userMenuOpen} className={`absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-1 border origin-top-right transition-all duration-200 ease-out z-50 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ${userMenuOpen ? 'transform opacity-100 scale-100' : 'transform opacity-0 scale-95 pointer-events-none'}`}>
                            <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">{user?.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role}</p>
                            </div>
                            <button
                                onClick={logout}
                                className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
