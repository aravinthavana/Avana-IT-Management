import { API_URL } from '../../utils/apiClient';
import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';

const UserProfile: React.FC = () => {
    const { currentUser, setCurrentUser, setNotification, getHeaders } = useAppContext();
    const [name, setName] = useState(currentUser.name);
    const [email, setEmail] = useState(currentUser.email);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [mobile, setMobile] = useState(currentUser.mobile || '');
    const [jobTitle, setJobTitle] = useState(currentUser.jobTitle || '');
    const [company, setCompany] = useState(currentUser.company || '');
    const [employeeId, setEmployeeId] = useState(currentUser.employeeId || '');

    React.useEffect(() => {
        setName(currentUser.name);
        setEmail(currentUser.email);
        setMobile(currentUser.mobile || '');
        setJobTitle(currentUser.jobTitle || '');
        setCompany(currentUser.company || '');
        setEmployeeId(currentUser.employeeId || '');
    }, [currentUser]);

    const defaultAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.name) + '&background=random';

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password && password !== confirmPassword) {
            setNotification({ message: 'Passwords do not match', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            const body: any = { name, email, mobile, jobTitle, company, employeeId };
            if (password) {
                body.password = password;
                body.currentPassword = currentPassword;
            }

            const res = await fetch(`${API_URL}/api/users/${currentUser.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(body),
                credentials: 'include'
            });
            if (!res.ok) throw new Error((await res.json()).error);
            const updated = await res.json();

            setCurrentUser(updated);
            setPassword('');
            setConfirmPassword('');
            setCurrentPassword('');
            setNotification({ message: 'Profile updated successfully!', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to update profile', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
            <div className="md:col-span-1 space-y-6">
                <div className="p-6 rounded-xl shadow-sm text-center bg-white dark:bg-slate-800">
                    <img src={currentUser.avatar || defaultAvatar} alt="User Avatar" className="w-32 h-32 rounded-full mx-auto mb-4 border-4 shadow-lg border-white dark:border-slate-700"/>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{currentUser.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400">{currentUser.email}</p>
                    <p className="mt-4"><span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${currentUser.role === 'Admin' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'}`}>{currentUser.role}</span></p>
                </div>

                <div className="p-6 rounded-xl shadow-sm bg-white dark:bg-slate-800">
                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        {ICONS.info} Account Status
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Status</span>
                            <span className="font-medium text-green-600">Active</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">ID</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">#{currentUser.id}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="md:col-span-2 space-y-6">
                 <form onSubmit={handleUpdateProfile} className="p-6 rounded-xl shadow-sm space-y-4 bg-white dark:bg-slate-800">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Profile Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                            <input id="fullName" name="fullName" type="text" value={name} onChange={(e) => setName(e.target.value)} required readOnly={currentUser.role === 'User'} className={`mt-1 block w-full px-3 py-2 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 text-slate-900 dark:text-slate-100 ${currentUser.role === 'User' ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:ring-brand-500'}`} />
                        </div>
                        <div>
                            <label htmlFor="profileEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                            <input id="profileEmail" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required readOnly={currentUser.role === 'User'} className={`mt-1 block w-full px-3 py-2 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 text-slate-900 dark:text-slate-100 ${currentUser.role === 'User' ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:ring-brand-500'}`} />
                        </div>
                        <div>
                            <label htmlFor="mobile" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Mobile Number</label>
                            <input id="mobile" name="mobile" type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:ring-brand-500 text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                            <label htmlFor="jobTitle" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Job Title</label>
                            <input id="jobTitle" name="jobTitle" type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:ring-brand-500 text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                            <label htmlFor="company" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Company</label>
                            <input id="company" name="company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:ring-brand-500 text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                            <label htmlFor="employeeId" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Employee ID</label>
                            <input id="employeeId" name="employeeId" type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:ring-brand-500 text-slate-900 dark:text-slate-100" />
                        </div>
                    </div>

                    <h3 className="text-xl font-semibold pt-4 border-t text-slate-800 dark:text-slate-100 border-slate-100 dark:border-slate-700">Security</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Current Password</label>
                            <input id="currentPassword" name="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required if changing password" className="mt-1 block w-full px-3 py-2 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 placeholder-slate-400 dark:placeholder-slate-400 focus:border-brand-500 focus:ring-brand-500 text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
                            <input id="newPassword" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" className="mt-1 block w-full px-3 py-2 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 placeholder-slate-400 dark:placeholder-slate-400 focus:border-brand-500 focus:ring-brand-500 text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm New Password</label>
                            <input id="confirmPassword" name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 placeholder-slate-400 dark:placeholder-slate-400 focus:border-brand-500 focus:ring-brand-500 text-slate-900 dark:text-slate-100" />
                        </div>
                    </div>

                    <div className="flex justify-end pt-6">
                        <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-8 py-2.5 rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-md bg-brand-600 text-white hover:bg-brand-700">
                            {isSubmitting ? 'Updating...' : 'Save All Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserProfile;