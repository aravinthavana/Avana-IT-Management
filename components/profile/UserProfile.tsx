import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';

const UserProfile: React.FC = () => {
    const { currentUser, setCurrentUser, setNotification } = useAppContext();
    const [name, setName] = useState(currentUser.name);
    const [email, setEmail] = useState(currentUser.email);

    const handleUpdateProfile = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentUser({...currentUser, name, email});
        setNotification({ message: 'Profile updated successfully!', type: 'success' });
    };
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm text-center">
                    <img src={currentUser.avatar} alt="User Avatar" className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-white dark:border-slate-700 shadow-lg"/>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{currentUser.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400">{currentUser.email}</p>
                    <p className="mt-4"><span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${currentUser.role === 'Admin' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'}`}>{currentUser.role}</span></p>
                </div>
            </div>
            <div className="md:col-span-2">
                 <form onSubmit={handleUpdateProfile} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm space-y-4">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Profile Information</h3>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 dark:text-slate-100" />
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="submit" className="w-full sm:w-auto bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 font-medium transition-all duration-200 active:scale-95">Update Profile</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserProfile;