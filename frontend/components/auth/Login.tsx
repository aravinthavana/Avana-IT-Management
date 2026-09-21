import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../../authConfig";

type AuthMode = 'otp-email' | 'otp-verify' | 'password';

const Login: React.FC = () => {
    const { login } = useAuth();
    const { instance } = useMsal();
    
    const [authMode, setAuthMode] = useState<AuthMode>('otp-email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
    
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

    // Countdown effect for OTP resend cooldown
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const interval = setInterval(() => {
            setResendCooldown((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [resendCooldown]);

    // Focus first OTP box when entering verify mode
    useEffect(() => {
        if (authMode === 'otp-verify') {
            setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 100);
        }
    }, [authMode]);

    // Handle sending OTP email
    const handleSendOtp = async (targetEmail = email) => {
        const cleanedEmail = targetEmail.trim().toLowerCase();
        if (!cleanedEmail || !cleanedEmail.includes('@')) {
            setError('Please enter a valid work email address.');
            return;
        }

        setError('');
        setSuccessMessage('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanedEmail }),
                credentials: 'include'
            });

            const contentType = response.headers.get('content-type') || '';
            let data: any = {};
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Backend deployment is updating on Render. If you just deployed, please wait 1-2 minutes for Render to finish building.');
                    }
                    if (response.status === 502 || response.status === 503) {
                        throw new Error('Backend server is spinning up. Please wait 30 seconds and try again.');
                    }
                    throw new Error(`Server returned ${response.status}. Please try again shortly.`);
                }
            }

            if (!response.ok) {
                if (response.status === 429 && data.retryAfter) {
                    setResendCooldown(data.retryAfter);
                }
                throw new Error(data.error || 'Failed to send verification code.');
            }

            setEmail(data.email || cleanedEmail);
            setOtp(['', '', '', '', '', '']);
            setSuccessMessage(`Verification code sent to ${data.email || cleanedEmail}`);
            setResendCooldown(data.cooldownSeconds || 60);
            setAuthMode('otp-verify');
        } catch (err: any) {
            setError(err.message || 'Unable to connect to server. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle verifying 6-digit OTP
    const handleVerifyOtp = async (codeToVerify?: string) => {
        const fullCode = codeToVerify || otp.join('');
        if (fullCode.length !== 6 || !/^\d{6}$/.test(fullCode)) {
            setError('Please enter all 6 digits of the verification code.');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), otp: fullCode }),
                credentials: 'include'
            });

            const contentType = response.headers.get('content-type') || '';
            let data: any = {};
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Backend deployment is updating on Render. Please wait 1-2 minutes and try again.');
                    }
                    throw new Error(`Server returned ${response.status}. Please try again.`);
                }
            }

            if (!response.ok) {
                throw new Error(data.error || 'Invalid verification code.');
            }

            login(data.user);
        } catch (err: any) {
            setError(err.message || 'Verification failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // OTP Input keyboard navigation
    const handleOtpChange = (index: number, val: string) => {
        const digit = val.replace(/\D/g, '').slice(-1);
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);
        setError('');

        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto verify when all 6 digits filled
        if (digit && index === 5 && newOtp.every(d => d !== '')) {
            handleVerifyOtp(newOtp.join(''));
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (!otp[index] && index > 0) {
                inputRefs.current[index - 1]?.focus();
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Handle paste of 6-digit code
    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;

        const newOtp = ['', '', '', '', '', ''];
        for (let i = 0; i < pasted.length; i++) {
            newOtp[i] = pasted[i];
        }
        setOtp(newOtp);

        const nextIndex = Math.min(pasted.length, 5);
        inputRefs.current[nextIndex]?.focus();

        if (pasted.length === 6) {
            handleVerifyOtp(pasted);
        }
    };

    // Handle traditional password login
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
                credentials: 'include'
            });

            const contentType = response.headers.get('content-type') || '';
            let data: any = {};
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}. Please try again.`);
                }
            }

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

    // Handle Microsoft Entra ID login
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
                <div className="absolute inset-0 bg-gradient-to-br from-brand-600/90 via-slate-900 to-slate-900 z-10" />
                <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="relative z-20 flex flex-col items-center justify-center p-12 text-center text-white">
                    <img src="/logo-light.png" alt="Avana Logo" className="w-full max-w-sm object-contain mb-8" />
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">IT Asset Management</h1>
                    <p className="text-lg text-slate-300 max-w-md">Streamline your hardware, licenses, and user requests with our secure enterprise platform.</p>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 bg-slate-50 dark:bg-slate-900">
                <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 sm:p-10 border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-500 to-brand-600" />
                    
                    <div className="text-center mb-8">
                        <img src="/logo.png" alt="Company Logo" className="w-44 object-contain mx-auto mb-5 lg:hidden" />
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            {authMode === 'otp-verify' ? 'Check Your Inbox' : 'Welcome Back'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
                            {authMode === 'otp-verify' 
                                ? 'Enter the verification code sent to your email' 
                                : 'Access your IT workspace'}
                        </p>
                    </div>

                    {/* Microsoft SSO - Always available at top */}
                    {authMode !== 'otp-verify' && (
                        <>
                            <button
                                onClick={handleMicrosoftLogin}
                                disabled={isLoading}
                                className="w-full mb-6 flex items-center justify-center gap-3 py-3.5 px-4 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all transform active:scale-[0.98] group"
                            >
                                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                                    <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                                </svg>
                                Sign in with Microsoft 365
                            </button>

                            <div className="relative mb-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase tracking-widest font-black">
                                    <span className="px-4 bg-white dark:bg-slate-800 text-slate-400">
                                        Or sign in with email
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Feedback Messages */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm rounded-xl flex items-start animate-shake">
                            <span className="mr-3 text-lg leading-none">⚠️</span>
                            <div className="text-xs sm:text-sm">{error}</div>
                        </div>
                    )}

                    {successMessage && !error && (
                        <div className="mb-6 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm rounded-xl flex items-center">
                            <span className="mr-2.5 text-base">✉️</span>
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* MODE 1: OTP Email Entry (Default) */}
                    {authMode === 'otp-email' && (
                        <form onSubmit={(e) => { e.preventDefault(); handleSendOtp(); }} className="space-y-5">
                            <div>
                                <label htmlFor="loginEmail" className="block text-xs font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest">
                                    Work Email Address
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                        {ICONS.profile}
                                    </span>
                                    <input
                                        id="loginEmail"
                                        name="email"
                                        type="email"
                                        required
                                        autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-3.5 border-0 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all placeholder:text-slate-400 text-sm sm:text-base font-medium"
                                        placeholder="name@avanamedical.com"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 pl-1">
                                    We'll send a 6-digit secure verification code to this inbox.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !email}
                                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-2xl shadow-xl text-base font-black text-white bg-brand-600 hover:bg-brand-700 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        <span>Sending Code...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Send Verification Code</span>
                                        <span className="text-lg">&rarr;</span>
                                    </>
                                )}
                            </button>

                            <div className="pt-2 text-center">
                                <button
                                    type="button"
                                    onClick={() => { setError(''); setSuccessMessage(''); setAuthMode('password'); }}
                                    className="text-xs font-bold text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-white transition-colors"
                                >
                                    Prefer password? <span className="underline underline-offset-2">Sign in with password</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* MODE 2: OTP 6-Digit Code Verification */}
                    {authMode === 'otp-verify' && (
                        <div className="space-y-6">
                            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                                <div className="truncate mr-3">
                                    <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Code Sent To</div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{email}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setError(''); setSuccessMessage(''); setAuthMode('otp-email'); }}
                                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline shrink-0"
                                >
                                    Change
                                </button>
                            </div>

                            {/* 6 Digit Input Boxes */}
                            <div>
                                <label className="block text-xs font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-widest text-center">
                                    Enter 6-Digit Code
                                </label>
                                <div className="flex justify-between gap-2 max-w-sm mx-auto" onPaste={handleOtpPaste}>
                                    {otp.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            ref={(el) => { inputRefs.current[idx] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                            className="w-11 h-14 sm:w-12 sm:h-14 text-center text-2xl font-black rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20 transition-all"
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="button"
                                onClick={() => handleVerifyOtp()}
                                disabled={isLoading || otp.some(d => d === '')}
                                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-2xl shadow-xl text-base font-black text-white bg-brand-600 hover:bg-brand-700 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        <span>Verifying Code...</span>
                                    </>
                                ) : (
                                    <span>Verify &amp; Sign In</span>
                                )}
                            </button>

                            {/* Resend Cooldown / Actions */}
                            <div className="flex items-center justify-between pt-1 text-xs">
                                <button
                                    type="button"
                                    onClick={() => handleSendOtp(email)}
                                    disabled={resendCooldown > 0 || isLoading}
                                    className="font-bold text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                                >
                                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setError(''); setSuccessMessage(''); setAuthMode('password'); }}
                                    className="font-semibold text-slate-500 dark:text-slate-400 hover:underline"
                                >
                                    Use password instead
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODE 3: Traditional Password Fallback */}
                    {authMode === 'password' && (
                        <form onSubmit={handlePasswordSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="loginEmail" className="block text-xs font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest">
                                    Work Email Address
                                </label>
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
                                        className="block w-full pl-12 pr-4 py-3.5 border-0 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all placeholder:text-slate-400 text-sm sm:text-base font-medium"
                                        placeholder="name@avanamedical.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label htmlFor="loginPassword" className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => { setError(''); setSuccessMessage(''); handleSendOtp(); }}
                                        className="text-xs font-bold text-brand-600 hover:text-brand-500 dark:text-red-400"
                                    >
                                        Forgot? Use OTP
                                    </button>
                                </div>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </span>
                                    <input
                                        id="loginPassword"
                                        name="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-3.5 border-0 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all placeholder:text-slate-400 text-sm sm:text-base font-medium"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-2xl shadow-xl text-base font-black text-white bg-brand-600 hover:bg-brand-700 transition-all transform active:scale-[0.98] disabled:opacity-50"
                            >
                                {isLoading ? 'Processing...' : 'Sign In'}
                            </button>

                            <div className="pt-2 text-center">
                                <button
                                    type="button"
                                    onClick={() => { setError(''); setSuccessMessage(''); setAuthMode('otp-email'); }}
                                    className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-white transition-colors"
                                >
                                    &larr; Switch back to <span className="underline underline-offset-2">Email Code (OTP) login</span>
                                </button>
                            </div>
                        </form>
                    )}
                    
                    <div className="mt-8 text-center text-xs text-slate-400 font-bold uppercase tracking-tighter">
                        <p>Secured by Avana Enterprise Security</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
