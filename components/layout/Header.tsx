import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';

interface HeaderProps {
    setSidebarOpen: (isOpen: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen }) => {
    const { currentUser, view: currentView, theme, setTheme } = useAppContext();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const viewTitles: { [key: string]: string } = {
        dashboard: 'Home',
        assets: 'Asset Management',
        users: 'User Management',
        departments: 'Department Management',
        branches: 'Branch Management',
        purchases: 'Purchase Management',
        profile: 'My Profile',
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
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);


    return (
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
            <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center">
                    <button className="md:hidden mr-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" onClick={() => setSidebarOpen(true)}>
                        {ICONS.menu}
                    </button>
                    <h1 className="text-xl font-semibold text-slate-900 dark:text-white capitalize">{viewTitles[currentView]}</h1>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setDropdownOpen(!dropdownOpen)} 
                            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                            aria-label="Toggle theme"
                        >
                            {themeIcons[theme]}
                        </button>
                        <div className={`absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 border border-slate-200 dark:border-slate-700 origin-top-right transition-all duration-200 ease-out ${dropdownOpen ? 'transform opacity-100 scale-100' : 'transform opacity-0 scale-95 pointer-events-none'}`}>
                            {(['light', 'dark', 'system'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => { setTheme(t); setDropdownOpen(false); }}
                                    className={`w-full text-left flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                                        theme === t 
                                        ? 'bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400' 
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {themeIcons[t]}
                                    <span>{themeNames[t]}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <span className="hidden sm:inline font-medium text-slate-700 dark:text-slate-300">{currentUser.name}</span>
                    <img src={currentUser.avatar} alt="User Avatar" className="w-9 h-9 rounded-full"/>
                </div>
            </div>
        </header>
    );
};

export default Header;