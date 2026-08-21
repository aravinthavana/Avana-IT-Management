import React, { useState, useRef } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import { SupportTicket, TicketComment, TicketAttachment } from '../../types';
import { useMsal } from "@azure/msal-react";
import { sendTicketEmailViaGraph } from '../../utils/graphMail';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8080';
const DEFAULT_SUPPORT_EMAIL = (import.meta as any).env.VITE_SUPPORT_EMAIL || 'itsupport@avanamedical.com';

const SupportTickets: React.FC = () => {
    const { tickets, setTickets, getHeaders, setNotification, assets, navigate, users } = useAppContext();
    const { user } = useAuth();
    const { instance } = useMsal();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [submittingTicket, setSubmittingTicket] = useState(false);

    // Attachments State
    const [ticketAttachments, setTicketAttachments] = useState<TicketAttachment[]>([]);
    const [commentAttachments, setCommentAttachments] = useState<TicketAttachment[]>([]);
    const [isUploadingTicketFile, setIsUploadingTicketFile] = useState(false);
    const [isUploadingCommentFile, setIsUploadingCommentFile] = useState(false);
    
    const ticketFileInputRef = useRef<HTMLInputElement>(null);
    const commentFileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        subject: '',
        category: 'Hardware',
        priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
        description: '',
        assetId: ''
    });

    const categories = ['Hardware', 'Software', 'Email', 'Network', 'Account', 'Other'];
    const priorities: Array<'Low' | 'Medium' | 'High' | 'Urgent'> = ['Low', 'Medium', 'High', 'Urgent'];
    const statuses: Array<'Open' | 'In Progress' | 'Resolved' | 'Closed'> = ['Open', 'In Progress', 'Resolved', 'Closed'];

    React.useEffect(() => {
        if (selectedTicket) {
            fetchComments(selectedTicket.id);
            setCommentAttachments([]);
        } else {
            setComments([]);
            setNewComment('');
            setCommentAttachments([]);
        }
    }, [selectedTicket?.id]);

    const fetchComments = async (ticketId: number) => {
        setLoadingComments(true);
        try {
            const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
                headers: getHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (err) {
            console.error('Failed to fetch comments', err);
        } finally {
            setLoadingComments(false);
        }
    };

    // Upload helper for attachments
    const handleFileUpload = async (file: File, isForComment: boolean) => {
        if (isForComment) setIsUploadingCommentFile(true);
        else setIsUploadingTicketFile(true);

        try {
            const uploadData = new FormData();
            uploadData.append('file', file);

            const headers = getHeaders() as any;
            delete headers['Content-Type']; // Let browser set boundary

            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                headers,
                body: uploadData,
                credentials: 'include'
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to upload file');
            }

            const uploaded: TicketAttachment = await res.json();
            if (isForComment) {
                setCommentAttachments(prev => [...prev, uploaded]);
            } else {
                setTicketAttachments(prev => [...prev, uploaded]);
            }
            setNotification({ message: `Attached: ${file.name}`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message || 'File upload failed', type: 'error' });
        } finally {
            if (isForComment) setIsUploadingCommentFile(false);
            else setIsUploadingTicketFile(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newComment.trim() && commentAttachments.length === 0) || !selectedTicket) return;
        setSubmittingComment(true);

        try {
            const payload = {
                message: newComment.trim() || 'Attached files to the discussion.',
                attachments: commentAttachments.length > 0 ? commentAttachments : null,
                source: 'Portal'
            };

            const res = await fetch(`${API_URL}/api/tickets/${selectedTicket.id}/comments`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to post comment');
            }

            const addedComment = await res.json();
            setComments(prev => [...prev, addedComment]);
            setNewComment('');
            const sentAttachments = [...commentAttachments];
            setCommentAttachments([]);

            // Dispatch Microsoft Graph Email in Background
            const isUserAdmin = user?.role === 'Admin';
            const recipientEmail = isUserAdmin 
                ? (selectedTicket.user?.email || DEFAULT_SUPPORT_EMAIL)
                : (users.find(u => u.role === 'Admin')?.email || DEFAULT_SUPPORT_EMAIL);
            const recipientName = isUserAdmin ? (selectedTicket.user?.name || 'User') : 'IT Admin';

            sendTicketEmailViaGraph({
                msalInstance: instance,
                toEmail: recipientEmail,
                toName: recipientName,
                subject: selectedTicket.subject,
                ticketId: selectedTicket.id,
                ticketSubject: selectedTicket.subject,
                senderName: user?.name || 'Avana Team Member',
                senderEmail: user?.email,
                messageBody: payload.message,
                status: selectedTicket.status,
                priority: selectedTicket.priority,
                attachments: sentAttachments,
                isReply: true
            }).catch(console.warn);

        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to post comment', type: 'error' });
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingTicket(true);
        try {
            const payload = {
                ...formData,
                attachments: ticketAttachments.length > 0 ? ticketAttachments : null
            };

            const res = await fetch(`${API_URL}/api/tickets`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to submit ticket');
            }

            const newTicket = await res.json();
            setTickets([newTicket, ...tickets]);
            setIsModalOpen(false);
            const sentAttachments = [...ticketAttachments];
            setFormData({ subject: '', category: 'Hardware', priority: 'Medium', description: '', assetId: '' });
            setTicketAttachments([]);
            setNotification({ message: 'Ticket submitted successfully!', type: 'success' });

            // Dispatch Microsoft Graph Email from Employee to IT Admin in Background
            const adminEmail = users.find(u => u.role === 'Admin')?.email || DEFAULT_SUPPORT_EMAIL;
            const assetObj = assets.find(a => a.id === Number(formData.assetId));

            sendTicketEmailViaGraph({
                msalInstance: instance,
                toEmail: adminEmail,
                toName: 'IT Support Team',
                subject: newTicket.subject,
                ticketId: newTicket.id,
                ticketSubject: newTicket.subject,
                senderName: user?.name || 'Employee',
                senderEmail: user?.email,
                messageBody: newTicket.description,
                category: newTicket.category,
                priority: newTicket.priority,
                status: newTicket.status,
                assetName: assetObj ? `${assetObj.name} (${assetObj.assetId})` : undefined,
                attachments: sentAttachments,
                isReply: false
            }).catch(console.warn);

        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to submit ticket', type: 'error' });
        } finally {
            setSubmittingTicket(false);
        }
    };

    const handleUpdateStatus = async (ticketId: number, newStatus: string) => {
        try {
            const res = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error('Failed to update status');
            const updated = await res.json();
            setTickets(tickets.map(t => t.id === ticketId ? updated : t));
            if (selectedTicket && selectedTicket.id === ticketId) {
                setSelectedTicket({ ...selectedTicket, status: newStatus as any });
            }
            setNotification({ message: `Ticket status updated to ${newStatus}`, type: 'success' });

            // Send notification to user about status change
            if (updated.user?.email) {
                sendTicketEmailViaGraph({
                    msalInstance: instance,
                    toEmail: updated.user.email,
                    toName: updated.user.name,
                    subject: updated.subject,
                    ticketId: updated.id,
                    ticketSubject: updated.subject,
                    senderName: user?.name || 'IT Admin',
                    senderEmail: user?.email,
                    messageBody: `The status of this ticket has been updated to "${newStatus}".`,
                    status: newStatus,
                    priority: updated.priority,
                    isReply: true
                }).catch(console.warn);
            }
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
    };

    const parseAttachments = (att: any): TicketAttachment[] => {
        if (!att) return [];
        if (Array.isArray(att)) return att;
        if (typeof att === 'string') {
            try { return JSON.parse(att); } catch { return []; }
        }
        return [];
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'Urgent': return 'text-brand-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
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

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const filteredTickets = React.useMemo(() => {
        return tickets.filter(t => {
            const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.user?.name && t.user.name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [tickets, searchTerm, statusFilter]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Support Tickets</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Submit and track your technical support requests with 2-way email sync.</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-brand-600/20 font-bold">
                    {ICONS.add} New Ticket
                </button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full max-w-md">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                        {ICONS.search}
                    </span>
                    <input
                        type="text"
                        placeholder="Search tickets by subject, category, or user..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
                    />
                </div>
                <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                    {['All', 'Open', 'In Progress', 'Resolved', 'Closed'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                statusFilter === status
                                    ? 'bg-brand-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
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
                            {filteredTickets.map(ticket => (
                                <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-800 dark:text-white">{ticket.subject}</p>
                                            {ticket.attachments && parseAttachments(ticket.attachments).length > 0 && (
                                                <span className="text-xs text-slate-400" title="Has attachments">📎</span>
                                            )}
                                        </div>
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
                                        <button onClick={() => setSelectedTicket(ticket)} className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                                            {ICONS.view}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredTickets.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 italic">No tickets match your filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Submit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">New Support Request</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">{ICONS.close}</button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                            <div className="p-8 space-y-5 overflow-y-auto">
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
                                        <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none">
                                            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Related Asset (Optional)</label>
                                    <select value={formData.assetId} onChange={e => setFormData({...formData, assetId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none">
                                        <option value="">No specific asset</option>
                                        {assets.filter(a => user?.role === 'Admin' || a.assigneeId === user?.id).map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetId})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Description</label>
                                    <textarea required rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none placeholder:text-slate-400" placeholder="Provide more details about the problem..." />
                                </div>

                                {/* Attachments section in Modal */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Attachments (Screenshots / Logs)</label>
                                        <button
                                            type="button"
                                            onClick={() => ticketFileInputRef.current?.click()}
                                            disabled={isUploadingTicketFile}
                                            className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-red-400 flex items-center gap-1"
                                        >
                                            {isUploadingTicketFile ? 'Uploading...' : '+ Add File'}
                                        </button>
                                    </div>
                                    <input
                                        type="file"
                                        ref={ticketFileInputRef}
                                        onChange={e => e.target.files && handleFileUpload(e.target.files[0], false)}
                                        className="hidden"
                                        accept="image/*,.pdf,.txt,.docx,.xlsx,.zip"
                                    />

                                    {ticketAttachments.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {ticketAttachments.map((att, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs">
                                                    <span className="truncate max-w-[180px] font-medium text-slate-700 dark:text-slate-200">{att.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setTicketAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-slate-400 hover:text-red-600 font-bold ml-1"
                                                    >
                                                        &times;
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div 
                                            onClick={() => ticketFileInputRef.current?.click()}
                                            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center cursor-pointer hover:border-brand-500 transition-colors"
                                        >
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Click to upload screenshots, PDFs, or error logs (Up to 10MB)</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex gap-4 shrink-0">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 py-3 rounded-2xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all active:scale-[0.98]">Cancel</button>
                                <button type="submit" disabled={submittingTicket || isUploadingTicketFile} className="flex-1 bg-brand-600 text-white py-3 rounded-2xl font-bold hover:bg-brand-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-xl shadow-brand-600/20">
                                    {submittingTicket ? 'Submitting & Dispatching...' : 'Submit Ticket'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail View Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">{selectedTicket.subject}</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Ticket #{selectedTicket.id}</p>
                            </div>
                            <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">{ICONS.close}</button>
                        </div>
                        <div className="p-8 space-y-6 overflow-y-auto">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getStatusColor(selectedTicket.status)}`}>{selectedTicket.status}</span>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Priority</p>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getPriorityColor(selectedTicket.priority)}`}>{selectedTicket.priority}</span>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                                    <p className="font-bold text-slate-800 dark:text-white">{selectedTicket.category}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Submitted By</p>
                                    <p className="font-bold text-slate-800 dark:text-white">{selectedTicket.user?.name || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Opened</p>
                                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                                </div>
                                {selectedTicket.resolvedAt ? (
                                    <div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Resolved At</p>
                                        <p className="font-semibold text-green-600 dark:text-green-400 text-sm">{new Date(selectedTicket.resolvedAt).toLocaleString()}</p>
                                    </div>
                                ) : selectedTicket.updatedAt && selectedTicket.updatedAt !== selectedTicket.createdAt ? (
                                    <div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Last Updated</p>
                                        <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{new Date(selectedTicket.updatedAt).toLocaleString()}</p>
                                    </div>
                                ) : null}
                            </div>

                            {/* Related Asset */}
                            {selectedTicket.assetId && (() => {
                                const relatedAsset = assets.find(a => a.id === selectedTicket.assetId);
                                return relatedAsset ? (
                                    <div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Related Asset</p>
                                        <button
                                            onClick={() => { setSelectedTicket(null); navigate('assets'); }}
                                            className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group"
                                        >
                                            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center text-brand-600 dark:text-red-400 flex-shrink-0">
                                                {ICONS.asset || '💻'}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-brand-600 dark:group-hover:text-red-400 transition-colors">{relatedAsset.name}</p>
                                                <p className="text-xs text-slate-500 font-mono">{relatedAsset.assetId}</p>
                                            </div>
                                        </button>
                                    </div>
                                ) : null;
                            })()}

                            {/* Description & Attachments */}
                            <div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</p>
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-100 dark:border-slate-800">{selectedTicket.description}</div>
                                
                                {selectedTicket.attachments && parseAttachments(selectedTicket.attachments).length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Ticket Attachments</p>
                                        <div className="flex flex-wrap gap-2">
                                            {parseAttachments(selectedTicket.attachments).map((att, idx) => (
                                                <a
                                                    key={idx}
                                                    href={att.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-medium text-brand-600 dark:text-red-400 hover:underline"
                                                >
                                                    <span>📎 {att.name}</span>
                                                    <span className="text-[10px] text-slate-400">({(att.size / 1024).toFixed(1)} KB)</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Discussion / Comment Thread */}
                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                    💬 Discussion ({comments.length})
                                </h4>

                                {/* Comments list */}
                                <div className="space-y-3 mb-6 max-h-72 overflow-y-auto pr-1">
                                    {loadingComments && (
                                        <p className="text-xs text-slate-400 font-medium">Loading messages...</p>
                                    )}
                                    {!loadingComments && comments.length === 0 && (
                                        <p className="text-xs text-slate-400 font-medium italic">No comments yet. Start the discussion below or reply directly from Outlook.</p>
                                    )}
                                    {comments.map(c => {
                                        const isAuthorAdmin = c.user?.role === 'Admin';
                                        const commentAtts = parseAttachments(c.attachments);
                                        return (
                                            <div key={c.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-xs text-slate-800 dark:text-white">{c.user?.name || 'User'}</span>
                                                        {isAuthorAdmin && (
                                                            <span className="px-2 py-0.5 bg-red-100 text-brand-600 dark:bg-red-950/60 dark:text-red-400 rounded-full text-[10px] font-black uppercase">IT Admin</span>
                                                        )}
                                                        {c.source === 'Email' && (
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 rounded-full text-[10px] font-bold">Via Outlook</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-medium text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                                                </div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{c.message}</p>
                                                
                                                {/* Comment Attachments */}
                                                {commentAtts.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        {commentAtts.map((att, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={att.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-600 dark:text-red-400 hover:underline"
                                                            >
                                                                <span>📎 {att.name}</span>
                                                                <span className="text-[10px] text-slate-400">({(att.size / 1024).toFixed(1)} KB)</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Comment Form */}
                                <form onSubmit={handleAddComment} className="space-y-2">
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={newComment}
                                            onChange={e => setNewComment(e.target.value)}
                                            placeholder="Add a reply..."
                                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-brand-500 transition-colors"
                                        />
                                        
                                        <button
                                            type="button"
                                            onClick={() => commentFileInputRef.current?.click()}
                                            disabled={isUploadingCommentFile}
                                            title="Attach File"
                                            className="p-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-all"
                                        >
                                            📎
                                        </button>
                                        <input
                                            type="file"
                                            ref={commentFileInputRef}
                                            onChange={e => e.target.files && handleFileUpload(e.target.files[0], true)}
                                            className="hidden"
                                            accept="image/*,.pdf,.txt,.docx,.xlsx,.zip"
                                        />

                                        <button
                                            type="submit"
                                            disabled={submittingComment || (!newComment.trim() && commentAttachments.length === 0)}
                                            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-brand-600/20 active:scale-95 shrink-0"
                                        >
                                            {submittingComment ? 'Sending...' : 'Send'}
                                        </button>
                                    </div>

                                    {commentAttachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {commentAttachments.map((att, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-xs">
                                                    <span className="truncate max-w-[150px] font-medium text-slate-700 dark:text-slate-200">{att.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCommentAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-slate-400 hover:text-red-600 font-bold"
                                                    >
                                                        &times;
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </form>
                            </div>

                            {user?.role === 'Admin' && (
                                <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-3">
                                    {statuses.map(s => (
                                        <button key={s} onClick={() => handleUpdateStatus(selectedTicket.id, s)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${selectedTicket.status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}>
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
