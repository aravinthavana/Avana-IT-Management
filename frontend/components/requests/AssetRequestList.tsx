import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AssetRequest } from '../../types';
import RequestForm from './RequestForm';
import { ICONS } from '../../constants';

const AssetRequestList: React.FC = () => {
    const { user, token } = useAuth();
    const [requests, setRequests] = useState<AssetRequest[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080';

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/requests`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch requests');
            const data = await res.json();
            setRequests(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchRequests();
    }, [token]);

    const handleCreateRequest = async (data: any) => {
        try {
            const res = await fetch(`${API_URL}/api/requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                fetchRequests();
            } else {
                throw new Error('Failed to create request');
            }
        } catch(err: any) {
            setError(err.message);
        }
    };

    const handleStatusChange = async (id: number, newStatus: string) => {
        try {
            const res = await fetch(`${API_URL}/api/requests/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                fetchRequests();
            } else {
                 setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus as any } : r));
            }
        } catch (e) {
            setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus as any } : r));
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Pending Manager': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400">Pending Manager</span>;
            case 'Pending Admin': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400">Pending Admin</span>;
            case 'Approved': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400">Approved</span>;
            case 'Rejected by Manager': 
            case 'Rejected by Admin': 
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400">Rejected</span>;
            default: return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Asset Requests</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage hardware and software requests.</p>
                </div>
                <button 
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-95"
                >
                    {ICONS.add} New Request
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Request ID</th>
                                <th className="px-6 py-4 font-semibold">Requester</th>
                                <th className="px-6 py-4 font-semibold">Details</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {requests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4 font-medium">REQ-{req.id.toString().padStart(4, '0')}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900 dark:text-white">{req.user?.name || 'Unknown User'}</div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <div className="font-medium">{req.requestType} - {req.category}</div>
                                        <div className="text-xs text-slate-500 truncate mt-1" title={req.description}>{req.description}</div>
                                    </td>
                                    <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                                    <td className="px-6 py-4">{new Date(req.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {/* Manager Actions */}
                                        {user?.role === 'Manager' && req.status === 'Pending Manager' && (
                                            <>
                                                <button onClick={() => handleStatusChange(req.id, 'Pending Admin')} className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 font-medium text-xs">Approve</button>
                                                <button onClick={() => handleStatusChange(req.id, 'Rejected by Manager')} className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 font-medium text-xs">Reject</button>
                                            </>
                                        )}
                                        {/* Admin Actions */}
                                        {user?.role === 'Admin' && req.status === 'Pending Admin' && (
                                            <>
                                                <button onClick={() => handleStatusChange(req.id, 'Approved')} className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 font-medium text-xs">Approve & Assign</button>
                                                <button onClick={() => handleStatusChange(req.id, 'Rejected by Admin')} className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 font-medium text-xs">Reject</button>
                                            </>
                                        )}
                                        {/* Read-only state */}
                                        {((user?.role === 'User') || 
                                         (user?.role === 'Manager' && req.status !== 'Pending Manager') ||
                                         (user?.role === 'Admin' && req.status !== 'Pending Admin')) && (
                                            <span className="text-xs text-slate-400 italic">No actions</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {requests.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No asset requests found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <RequestForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSubmit={handleCreateRequest} />
        </div>
    );
};

export default AssetRequestList;
