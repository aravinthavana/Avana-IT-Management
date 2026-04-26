import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import { SupportTicket } from '../../types';

const SupportTickets: React.FC = () => {
    const { tickets, setTickets, getHeaders, setNotification, assets, navigate } = useAppContext();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [formData, setFormData] = useState({
        subject: '',
        category: 'Hardware',
        priority: 'Medium',
        description: '',
        assetId: ''
    });

    const categories = ['Hardware', 'Software', 'Email', 'Network', 'Account', 'Other'];
    const priorities = ['Low', 'Medium', 'High', 'Urgent'];
    const statuses = ['Open', 'In Progress', 'Resolved', 'Closed'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/tickets`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(formData)
            });
            if (!res.ok) throw new Error('Failed to submit ticket');
            const newTicket = await res.json();
            setTickets([newTicket, ...tickets]);
            setIsModalOpen(false);
            setFormData({ subject: '', category: 'Hardware', priority: 'Medium', description: '', assetId: '' });
            setNotification({ message: 'Ticket submitted successfully', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
    };

    const handleUpdateStatus = async (ticketId: number, newStatus: string) => {
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/tickets/${ticketId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error('Failed to update status');
            const updated = await res.json();
            setTickets(tickets.map(t => t.id === ticketId ? updated : t));
            setNotification({ message: `Ticket status updated to ${newStatus}`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'Urgent': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
            case 'High': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
            case 'Medium': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'text-slate-600 bg-slate-100 dark:bg-slate-900/30 dark:text-slate-400';
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Open': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
            case 'In Progress': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Resolved': return 'text-slate-600 bg-slate-100 dark:bg-slate-900/30 dark:text-slate-400';
            case 'Closed': return 'text-slate-400 bg-slate-50 dark:bg-slate-800/30 dark:text-slate-500';
            default: return 'text-slate-600 bg-slate-100';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Support Tickets</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Submit and track your technical support requests.</p>
                </div>
                {user?.role === 'User' && (
                    <button onClick={() => setIsModalOpen(true)} className="bg-red-600 text-white px-5 py-2.5 rounded-xl hover:bg-red-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-red-600/20 font-bold">
                        {ICONS.add} New Ticket
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Ticket</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Priority</th>
                                {user?.role === 'Admin' && <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">User</th>}
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {tickets.map(ticket => (
                                <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-800 dark:text-white">{ticket.subject}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{ticket.category} • {new Date(ticket.createdAt).toLocaleDateString()}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                                    </td>
                                    {user?.role === 'Admin' && (
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{ticket.user?.name}</p>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => setSelectedTicket(ticket)} className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                                            {ICONS.view}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {tickets.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 italic">No tickets found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Submit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">New Support Request</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">{ICONS.close}</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div>
                                <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Subject</label>
                                <input required value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none placeholder:text-slate-400" placeholder="Summary of the issue" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Category</label>
                                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none">
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Priority</label>
                                    <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none">
                                        {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Related Asset (Optional)</label>
                                <select value={formData.assetId} onChange={e => setFormData({...formData, assetId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none">
                                    <option value="">No specific asset</option>
                                    {assets.filter(a => a.assigneeId === user?.id).map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetId})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Description</label>
                                <textarea required rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none placeholder:text-slate-400" placeholder="Provide more details about the problem..." />
                            </div>
                            <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-red-700 transition-all active:scale-[0.98] shadow-xl shadow-red-600/20">Submit Ticket</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail View Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">{selectedTicket.subject}</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Ticket #{selectedTicket.id}</p>
                            </div>
                            <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">{ICONS.close}</button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getStatusColor(selectedTicket.status)}`}>{selectedTicket.status}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Priority</p>
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getPriorityColor(selectedTicket.priority)}`}>{selectedTicket.priority}</span>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                                        <p className="font-bold text-slate-800 dark:text-white">{selectedTicket.category}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Submitted By</p>
                                        <p className="font-bold text-slate-800 dark:text-white">{selectedTicket.user?.name}</p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</p>
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-100 dark:border-slate-800">{selectedTicket.description}</div>
                            </div>
                            {user?.role === 'Admin' && (
                                <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-3">
                                    {statuses.map(s => (
                                        <button key={s} onClick={() => handleUpdateStatus(selectedTicket.id, s)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${selectedTicket.status === s ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupportTickets;
