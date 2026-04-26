import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '../types';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "../authConfig";

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (userData: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { instance, accounts } = useMsal();
    const isMsalAuthenticated = useIsAuthenticated();

    const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

    const login = useCallback((userData: User) => {
        setUser(userData);
        window.dispatchEvent(new Event('app:login'));
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch(`${API_URL}/api/logout`, { method: 'POST', credentials: 'include' });
        } catch(e) {}
        setUser(null);
        if (accounts.length > 0) {
            instance.logoutPopup().catch(console.error);
        }
    }, [instance, accounts, API_URL]);

    useEffect(() => {
        const checkAuth = async () => {
            // 1. Check for valid cookie session via backend
            try {
                const res = await fetch(`${API_URL}/api/users/me`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    setIsLoading(false);
                    return;
                }
            } catch (e) {
                console.error("Session check failed", e);
            }

            // 2. Check for MSAL redirect result
            try {
                const response = await instance.handleRedirectPromise();
                if (response && response.idToken) {
                    // Sync with our backend
                    const res = await fetch(`${API_URL}/api/auth/m365`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: response.idToken, accessToken: response.accessToken }),
                        credentials: 'include'
                    });
                    if (res.ok) {
                        const data = await res.json();
                        login(data.user);
                    }
                } else if (accounts.length > 0) {
                    // If already logged in to MSAL but no local session, try to get a token silently
                    const silentRes = await instance.acquireTokenSilent({
                        ...loginRequest,
                        account: accounts[0]
                    });
                    if (silentRes.idToken) {
                        const res = await fetch(`${API_URL}/api/auth/m365`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ idToken: silentRes.idToken, accessToken: silentRes.accessToken }),
                            credentials: 'include'
                        });
                        if (res.ok) {
                            const data = await res.json();
                            login(data.user);
                        }
                    }
                }
            } catch (error) {
                console.error("MSAL Auth Sync Error:", error);
            }

            setIsLoading(false);
        };

        checkAuth();
    }, [instance, accounts, login, API_URL]);

    useEffect(() => {
        const handleGlobalLogout = () => logout();
        window.addEventListener('app:logout', handleGlobalLogout);
        return () => window.removeEventListener('app:logout', handleGlobalLogout);
    }, [logout]);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div></div>;
    }

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
