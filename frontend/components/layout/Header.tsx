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
        audits: 'Self-Audits', tickets: 'Support Tickets', kb: 'Knowledge Base', licenses: 'Licenses & Subscriptions',
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
        <header className="bg-surface/80 backdrop-blur-sm border-b border-line sticky top-0 z-30">
            <div className="px-3 sm:px-6 lg:px-8 min-h-16 gap-2 flex items-center justify-between">
                <div className="flex items-center min-w-0 gap-2">
                    <button aria-label="Open navigation" aria-controls="primary-navigation" aria-expanded={isSidebarOpen} className="lg:hidden shrink-0 p-2 text-quiet hover:text-ink" onClick={() => setSidebarOpen(true)}>
                        {ICONS.menu}
                    </button>
                    <h1 className="text-base sm:text-xl font-semibold truncate text-ink capitalize">{viewTitles[currentView] || 'IT Workspace'}</h1>
                </div>
                <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => { setDropdownOpen(!dropdownOpen); setUserMenuOpen(false); }}
                            aria-expanded={dropdownOpen}
                            aria-controls="theme-options"
                            className="p-2 rounded-full hover:bg-muted text-quiet transition-colors"
                            aria-label="Toggle theme"
                        >
                            {themeIcons[theme]}
                        </button>
                        <div id="theme-options" hidden={!dropdownOpen} className={`absolute right-0 mt-2 w-40 bg-surface  rounded-xl shadow-lg py-1 border border-line  origin-top-right transition-all duration-200 ease-out z-50 ${dropdownOpen ? 'transform opacity-100 scale-100' : 'transform opacity-0 scale-95 pointer-events-none'}`}>
                            {(['light', 'dark', 'system'] as const).map(t => (
                                <button
                                    key={t}
                                    aria-pressed={theme === t}
                                    onClick={() => { setTheme(t); setDropdownOpen(false); }}
                                    className={`w-full text-left flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                                        theme === t
                                        ? 'bg-surface  text-ink  font-semibold'
                                        : 'text-ink  hover:bg-muted '
                                    }`}
                                >
                                    {themeIcons[t]}
                                    <span>{themeNames[t]}</span>{theme === t && <span aria-hidden="true" className="ml-auto">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="relative" ref={userMenuRef}>
                        <button aria-label="Open account menu" aria-expanded={userMenuOpen} aria-controls="account-options" onClick={() => { setUserMenuOpen(!userMenuOpen); setDropdownOpen(false); }} className="flex items-center space-x-2.5 focus:outline-none p-1 rounded-xl hover:bg-muted transition-colors">
                            <span className="hidden sm:inline max-w-40 truncate font-medium text-sm text-ink">{user?.name}</span>
                            <div className="w-8 h-8 rounded-full bg-strong text-on-strong flex items-center justify-center font-bold text-sm shadow-sm">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                        </button>
                        <div id="account-options" hidden={!userMenuOpen} className={`absolute right-0 mt-2 w-48 bg-surface  rounded-xl shadow-lg py-1 border border-line  origin-top-right transition-all duration-200 ease-out z-50 ${userMenuOpen ? 'transform opacity-100 scale-100' : 'transform opacity-0 scale-95 pointer-events-none'}`}>
                            <div className="px-4 py-2 border-b border-line">
                                <p className="text-sm font-semibold text-ink truncate">{user?.name}</p>
                                <p className="text-xs text-quiet">{user?.role}</p>
                            </div>
                            <button
                                onClick={logout}
                                className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-surface transition-colors flex items-center gap-2"
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