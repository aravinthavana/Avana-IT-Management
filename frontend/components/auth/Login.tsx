import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../../authConfig";

const Login: React.FC = () => {
    const { login } = useAuth();
    const { instance } = useMsal();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            login(data.user);
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred. Is the backend running?');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMicrosoftLogin = async () => {
        setError('');
        setIsLoading(true);
        try {
            await instance.loginRedirect(loginRequest);
        } catch (err: any) {
            console.error(err);
            setError('Failed to start Microsoft login. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex text-slate-800 dark:text-slate-200">
            {/* Left Side - Visual */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/90 via-slate-900 to-slate-900 z-10" />
                <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="relative z-20 flex flex-col items-center justify-center p-12 text-center text-white">
                    <img src="https://avanamedical.com/wp-content/themes/avana/assets/images/logo.png" alt="Avana Logo" className="h-20 mb-8 filter brightness-0 invert" />
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">IT Asset Management</h1>
                    <p className="text-lg text-slate-300 max-w-md">Streamline your hardware, licenses, and user requests with our secure enterprise platform.</p>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900">
                <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-10 border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 to-red-600" />
                    
                    <div className="text-center mb-10">
                        <img src="https://avanamedical.com/wp-content/themes/avana/assets/images/logo.png" alt="Company Logo" className="h-12 mx-auto mb-6 lg:hidden" />
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Welcome Back</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Access your IT workspace</p>
                    </div>

                    <button
                        onClick={handleMicrosoftLogin}
                        disabled={isLoading}
                        className="w-full mb-8 flex items-center justify-center gap-3 py-3.5 px-4 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all transform active:scale-[0.98] group"
                    >
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg"><path fill="#f3f3f3" d="M0 0h23v23H0z"/><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                        Sign in with Microsoft 365
                    </button>

                    <div className="relative mb-8">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700"></div></div>
                        <div className="relative flex justify-center text-xs uppercase tracking-widest font-black"><span className="px-4 bg-white dark:bg-slate-800 text-slate-400">Or use email</span></div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm rounded-xl flex items-center animate-shake">
                            <span className="mr-3 text-lg">⚠️</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="loginEmail" className="block text-xs font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest">Email Address</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                    {ICONS.profile}
                                </span>
                                    <input
                                        id="loginEmail"
                                        name="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-3.5 border-0 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all placeholder:text-slate-400"
                                        placeholder="name@avana.com"
                                    />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="loginPassword" className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Password</label>
                                <a href="#" className="text-xs font-bold text-red-600 hover:text-red-500 dark:text-red-400">Forgot?</a>
                            </div>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                </span>
                                <input
                                    id="loginPassword"
                                    name="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-3.5 border-0 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all placeholder:text-slate-400"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl text-lg font-black text-white bg-red-600 hover:bg-red-700 transition-all transform active:scale-[0.98] disabled:opacity-50"
                        >
                            {isLoading ? 'Processing...' : 'Sign In'}
                        </button>
                    </form>
                    
                    <div className="mt-10 text-center text-xs text-slate-400 font-bold uppercase tracking-tighter">
                        <p>Secured by Avana Enterprise Security</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
