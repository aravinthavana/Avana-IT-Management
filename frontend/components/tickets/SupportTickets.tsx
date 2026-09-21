import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import { SupportTicket, TicketComment, TicketAttachment } from '../../types';
import { useMsal } from "@azure/msal-react";
import { syncIncomingEmailReplies } from '../../utils/graphMail';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8080';

const SupportTickets: React.FC = () => {
    const { tickets, setTickets, getHeaders, setNotification, assets, navigate, users } = useAppContext();
    const { user } = useAuth();
    const { instance } = useMsal();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isInternalComment, setIsInternalComment] = useState(false);
    const [loadingComments, setLoadingComments] = useState(false);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [submittingTicket, setSubmittingTicket] = useState(false);
    const [isSyncingReplies, setIsSyncingReplies] = useState(false);

    // Support Admin Contacts
    const [supportAdmins, setSupportAdmins] = useState<Array<{ id: number; name: string; email: string }>>([]);

    // Resolution Modal State
    const [resolvingTicketId, setResolvingTicketId] = useState<number | null>(null);
    const [resolutionNotesInput, setResolutionNotesInput] = useState('');
    const [submittingResolution, setSubmittingResolution] = useState(false);

    // Delete Ticket State
    const [deletingTicketId, setDeletingTicketId] = useState<number | null>(null);
    const [isDeletingTicket, setIsDeletingTicket] = useState(false);

    // Attachments State
    const [ticketAttachments, setTicketAttachments] = useState<TicketAttachment[]>([]);
    const [commentAttachments, setCommentAttachments] = useState<TicketAttachment[]>([]);
    const [isUploadingTicketFile, setIsUploadingTicketFile] = useState(false);
    const [isUploadingCommentFile, setIsUploadingCommentFile] = useState(false);
    
    const ticketFileInputRef = useRef<HTMLInputElement>(null);
    const commentFileInputRef = useRef<HTMLInputElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [comments]);

    const [formData, setFormData] = useState({
        targetUserId: '',
        assignedToId: '',
        subject: '',
        category: 'Hardware',
        priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
        description: '',
        assetId: ''
    });

    const categories = ['Hardware', 'Software', 'Email', 'Network', 'Account', 'Other'];
    const priorities: Array<'Low' | 'Medium' | 'High' | 'Urgent'> = ['Low', 'Medium', 'High', 'Urgent'];
    const statuses: Array<'Open' | 'In Progress' | 'Waiting on User' | 'Waiting on Vendor' | 'Resolved' | 'Closed'> = [
        'Open', 'In Progress', 'Waiting on User', 'Waiting on Vendor', 'Resolved', 'Closed'
    ];

    // Manager / Team detection
    const isManager = Boolean(user && users.some(u => u.managerId === user.id));
    const [teamViewTab, setTeamViewTab] = useState<'all' | 'my' | 'team'>('all');

    // Fetch support contacts on mount
    useEffect(() => {
        const fetchContacts = async () => {
            try {
                const res = await fetch(`${API_URL}/api/support-contacts`, {
                    headers: getHeaders(),
                    credentials: 'include'
                });
                if (res.ok) {
                    setSupportAdmins(await res.json());
                }
            } catch {
                // Fallback
            }
        };
        fetchContacts();
    }, [getHeaders]);

    const fetchComments = useCallback(async (ticketId: number) => {
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
    }, [getHeaders]);

    const handleSyncReplies = useCallback(async (ticketId: number, isManual = false) => {
        setIsSyncingReplies(true);
        try {
            const count = await syncIncomingEmailReplies(instance, ticketId, getHeaders, (newComment) => {
                setComments(prev => {
                    if (prev.some(c => c.id === newComment.id || (newComment.emailMessageId && c.emailMessageId === newComment.emailMessageId))) {
                        return prev;
                    }
                    return [...prev, newComment];
                });
            }, isManual);
            if (count > 0) {
                setNotification({ message: `Synced ${count} new reply from Outlook!`, type: 'success' });
            } else if (isManual) {
                setNotification({ message: 'No new replies found.', type: 'info' });
            }
        } catch (e) {
            console.warn('Sync replies failed:', e);
        } finally {
            setIsSyncingReplies(false);
        }
    }, [instance, getHeaders, setNotification]);

    useEffect(() => {
        if (selectedTicket) {
            fetchComments(selectedTicket.id);
            setCommentAttachments([]);
            setIsInternalComment(false);
            // Auto-check for any Outlook replies for this ticket (passive, no popups)
            handleSyncReplies(selectedTicket.id, false);
        } else {
            setComments([]);
            setNewComment('');
            setCommentAttachments([]);
            setIsInternalComment(false);
        }
    }, [selectedTicket?.id, fetchComments, handleSyncReplies]);

    // Auto-poll comments every 10 seconds while a ticket is open
    useEffect(() => {
        if (!selectedTicket) return;
        const ticketId = selectedTicket.id;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
                    headers: getHeaders(),
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    setComments(data);
                }
            } catch {
                // Silently ignore
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [selectedTicket?.id, getHeaders]);

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
                source: 'Portal',
                isInternal: user?.role === 'Admin' && isInternalComment
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
            setCommentAttachments([]);
            setIsInternalComment(false);
            setNotification({
                message: payload.isInternal ? 'Internal IT note added (Private)' : 'Comment posted successfully',
                type: 'success'
            });
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
                targetUserId: formData.targetUserId ? Number(formData.targetUserId) : undefined,
                assignedToId: formData.assignedToId ? Number(formData.assignedToId) : undefined,
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
            setTickets(prev => [newTicket, ...prev]);
            setIsModalOpen(false);
            setFormData({
                targetUserId: '',
                assignedToId: '',
                subject: '',
                category: 'Hardware',
                priority: 'Medium',
                description: '',
                assetId: ''
            });
            setTicketAttachments([]);
            setNotification({
                message: formData.targetUserId ? 'Ticket logged on behalf of employee!' : 'Ticket submitted successfully!',
                type: 'success'
            });
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to submit ticket', type: 'error' });
        } finally {
            setSubmittingTicket(false);
        }
    };

    const handleUpdateStatus = async (ticketId: number, newStatus: string) => {
        if (newStatus === 'Resolved') {
            setResolvingTicketId(ticketId);
            setResolutionNotesInput(selectedTicket?.resolutionNotes || '');
            return;
        }

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
                setSelectedTicket(updated);
            }
            setNotification({ message: `Ticket status updated to ${newStatus}`, type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
    };

    const handleConfirmResolve = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resolvingTicketId) return;
        setSubmittingResolution(true);

        try {
            const res = await fetch(`${API_URL}/api/tickets/${resolvingTicketId}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    status: 'Resolved',
                    resolutionNotes: resolutionNotesInput.trim() || 'Issue resolved by IT Administration.'
                })
            });
            if (!res.ok) throw new Error('Failed to resolve ticket');
            const updated = await res.json();
            setTickets(tickets.map(t => t.id === resolvingTicketId ? updated : t));
            if (selectedTicket && selectedTicket.id === resolvingTicketId) {
                setSelectedTicket(updated);
            }
            setResolvingTicketId(null);
            setResolutionNotesInput('');
            setNotification({ message: 'Ticket marked as Resolved with resolution notes!', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to resolve ticket', type: 'error' });
        } finally {
            setSubmittingResolution(false);
        }
    };

    const handleConfirmDeleteTicket = async () => {
        if (!deletingTicketId) return;
        setIsDeletingTicket(true);
        try {
            const res = await fetch(`${API_URL}/api/tickets/${deletingTicketId}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Failed to delete ticket');
            setTickets(prev => prev.filter(t => t.id !== deletingTicketId));
            if (selectedTicket && selectedTicket.id === deletingTicketId) {
                setSelectedTicket(null);
            }
            setDeletingTicketId(null);
            setNotification({ message: 'Ticket deleted permanently', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to delete ticket', type: 'error' });
        } finally {
            setIsDeletingTicket(false);
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
            case 'Urgent': return 'text-brand-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-900/50';
            case 'High': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50';
            case 'Medium': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50';
            default: return 'text-slate-600 bg-slate-100 dark:bg-slate-900/30 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Open': return 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
            case 'In Progress': return 'text-blue-700 bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
            case 'Waiting on User': return 'text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800';
            case 'Waiting on Vendor': return 'text-purple-700 bg-purple-100 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-800';
            case 'Resolved': return 'text-teal-700 bg-teal-100 dark:bg-teal-950/60 dark:text-teal-400 border border-teal-200 dark:border-teal-800';
            case 'Closed': return 'text-slate-500 bg-slate-100 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200 dark:border-slate-700';
            default: return 'text-slate-600 bg-slate-100 dark:bg-slate-800 border border-slate-200';
        }
    };

    const getTicketAging = (ticket: SupportTicket) => {
        if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
            return null;
        }
        const lastDate = new Date(ticket.updatedAt || ticket.createdAt);
        const now = new Date();
        const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays >= 7) {
            return {
                label: `Stale (${diffDays}d)`,
                color: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50',
                dot: 'bg-red-500'
            };
        }
        if (diffDays >= 3) {
            return {
                label: `Idle (${diffDays}d)`,
                color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50',
                dot: 'bg-amber-500'
            };
        }
        return {
            label: 'Active (<48h)',
            color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
            dot: 'bg-emerald-500'
        };
    };

    // Metrics for KPI Cards
    const activeTicketsCount = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress' || t.status === 'Waiting on User' || t.status === 'Waiting on Vendor').length;
    const inProgressCount = tickets.filter(t => t.status === 'In Progress').length;
    const waitingCount = tickets.filter(t => t.status === 'Waiting on User' || t.status === 'Waiting on Vendor').length;
    const staleCount = tickets.filter(t => {
        if (t.status === 'Resolved' || t.status === 'Closed') return false;
        const diffDays = (new Date().getTime() - new Date(t.updatedAt || t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 7;
    }).length;
    const resolvedCount = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

    // Subordinate IDs for managers
    const subordinateIds = users.filter(u => u.managerId === user?.id).map(u => u.id);
    const subordinatesTicketsCount = tickets.filter(t => subordinateIds.includes(t.userId)).length;

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const filteredTickets = React.useMemo(() => {
        return tickets.filter(t => {
            // Team view tab filter
            if (user?.role !== 'Admin') {
                if (teamViewTab === 'my' && t.userId !== user?.id) return false;
                if (teamViewTab === 'team' && !subordinateIds.includes(t.userId)) return false;
            } else if (teamViewTab === 'my') {
                if (t.userId !== user?.id && t.assignedToId !== user?.id) return false;
            }

            const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.user?.name && t.user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (t.resolutionNotes && t.resolutionNotes.toLowerCase().includes(searchTerm.toLowerCase()));
            
            let matchesStatus = true;
            if (statusFilter === 'Waiting') {
                matchesStatus = t.status === 'Waiting on User' || t.status === 'Waiting on Vendor';
            } else if (statusFilter === 'Stale') {
                if (t.status === 'Resolved' || t.status === 'Closed') matchesStatus = false;
                else {
                    const diffDays = (new Date().getTime() - new Date(t.updatedAt || t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                    matchesStatus = diffDays >= 7;
                }
            } else if (statusFilter !== 'All') {
                matchesStatus = t.status === statusFilter;
            }

            return matchesSearch && matchesStatus;
        });
    }, [tickets, searchTerm, statusFilter, teamViewTab, user, subordinateIds]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Support Tickets</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Submit and track IT technical support requests with 2-way Outlook email sync and live resolution tracking.
                    </p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)} 
                    className="bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-brand-600/20 font-bold"
                >
                    {ICONS.add} New Ticket
                </button>
            </div>

            {/* KPI Summary Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                <div 
                    onClick={() => setStatusFilter('All')} 
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        statusFilter === 'All' 
                            ? 'bg-brand-50 border-brand-300 dark:bg-red-950/20 dark:border-brand-600/50 shadow-sm ring-2 ring-brand-500/20' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Active</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{activeTicketsCount}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">In queue / open</p>
                </div>

                <div 
                    onClick={() => setStatusFilter('In Progress')} 
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        statusFilter === 'In Progress' 
                            ? 'bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700 shadow-sm ring-2 ring-blue-500/20' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                    <p className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">In Progress</p>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{inProgressCount}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Being worked on</p>
                </div>

                <div 
                    onClick={() => setStatusFilter('Waiting')} 
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        statusFilter === 'Waiting' 
                            ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700 shadow-sm ring-2 ring-amber-500/20' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Waiting</p>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{waitingCount}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">User / Vendor ball</p>
                </div>

                <div 
                    onClick={() => setStatusFilter('Stale')} 
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        statusFilter === 'Stale' 
                            ? 'bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700 shadow-sm ring-2 ring-red-500/20' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">Stale (7d+)</p>
                        {staleCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                    </div>
                    <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{staleCount}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Needs attention</p>
                </div>

                <div 
                    onClick={() => setStatusFilter('Resolved')} 
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        statusFilter === 'Resolved' 
                            ? 'bg-teal-50 border-teal-300 dark:bg-teal-950/30 dark:border-teal-700 shadow-sm ring-2 ring-teal-500/20' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                    <p className="text-[11px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">Resolved</p>
                    <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">{resolvedCount}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Completed tickets</p>
                </div>
            </div>

            {/* Manager / Scope Tabs */}
            {(user?.role === 'Admin' || isManager) && (
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-fit">
                    {user?.role === 'Admin' ? (
                        <>
                            <button
                                onClick={() => setTeamViewTab('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    teamViewTab === 'all'
                                        ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                All Organization Tickets ({tickets.length})
                            </button>
                            <button
                                onClick={() => setTeamViewTab('my')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    teamViewTab === 'my'
                                        ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                Assigned to Me / Logged by Me
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setTeamViewTab('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    teamViewTab === 'all'
                                        ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                All Accessible ({tickets.length})
                            </button>
                            <button
                                onClick={() => setTeamViewTab('my')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    teamViewTab === 'my'
                                        ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                My Own Tickets
                            </button>
                            <button
                                onClick={() => setTeamViewTab('team')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    teamViewTab === 'team'
                                        ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                👥 My Team&apos;s Tickets ({subordinatesTicketsCount})
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full max-w-md">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                        {ICONS.search}
                    </span>
                    <input
                        type="text"
                        placeholder="Search tickets by subject, category, user, or root cause..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
                    />
                </div>
                <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                    {['All', 'Open', 'In Progress', 'Waiting', 'Stale', 'Resolved', 'Closed'].map(status => (
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

            {/* Tickets Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Ticket</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Status & Aging</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Priority</th>
                                {(user?.role === 'Admin' || isManager) && (
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">User / Dept</th>
                                )}
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Assigned IT</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredTickets.map(ticket => {
                                const aging = getTicketAging(ticket);
                                return (
                                    <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-800 dark:text-white">{ticket.subject}</p>
                                                {ticket.attachments && parseAttachments(ticket.attachments).length > 0 && (
                                                    <span className="text-xs text-slate-400" title="Has attachments">📎</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    #{ticket.id} &bull; {ticket.category} &bull; {new Date(ticket.createdAt).toLocaleDateString()}
                                                </span>
                                                {ticket.resolutionNotes && (
                                                    <span className="text-[10px] bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 font-bold px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800" title="Has resolution summary">
                                                        ✓ Root Cause
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getStatusColor(ticket.status)}`}>
                                                    {ticket.status}
                                                </span>
                                                {aging && (
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${aging.color}`} title="Last activity aging">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${aging.dot}`}></span>
                                                        {aging.label}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getPriorityColor(ticket.priority)}`}>
                                                {ticket.priority}
                                            </span>
                                        </td>
                                        {(user?.role === 'Admin' || isManager) && (
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{ticket.user?.name || 'Unknown'}</p>
                                                <p className="text-xs text-slate-400">
                                                    {(ticket.user as any)?.department?.name || ticket.user?.email || 'Employee'}
                                                </p>
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            {ticket.assignedTo ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg">
                                                    👤 {ticket.assignedTo.name}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button 
                                                    onClick={() => setSelectedTicket(ticket)} 
                                                    className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                    title="View Discussion & Details"
                                                >
                                                    {ICONS.view}
                                                </button>
                                                {user?.role === 'Admin' && (
                                                    <button 
                                                        onClick={() => setDeletingTicketId(ticket.id)} 
                                                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                        title="Delete Ticket"
                                                    >
                                                        {ICONS.delete}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredTickets.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 italic">
                                        No support tickets match your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Ticket Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">New Support Request</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Submit technical issue to IT Helpdesk</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">
                                {ICONS.close}
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                            <div className="p-8 space-y-5 overflow-y-auto">
                                {/* Admin: Log on behalf of employee */}
                                {user?.role === 'Admin' && (
                                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                        <div>
                                            <label className="block text-xs font-black text-brand-600 dark:text-red-400 mb-1.5 uppercase tracking-wider">
                                                👤 Log Ticket On Behalf Of (Walk-in / Phone Support)
                                            </label>
                                            <select 
                                                value={formData.targetUserId} 
                                                onChange={e => setFormData({ ...formData, targetUserId: e.target.value, assetId: '' })} 
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-white text-sm outline-none focus:border-brand-500"
                                            >
                                                <option value="">Self ({user?.name || 'IT Admin'})</option>
                                                {users.filter(u => u.status === 'Active' && u.id !== user?.id).map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.name} ({u.email || u.employeeId || 'Employee'})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-slate-400 mt-1">
                                                Selecting an employee links this ticket directly to their account and emails them updates.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                                                🛠️ Assign IT Technician (Optional)
                                            </label>
                                            <select 
                                                value={formData.assignedToId} 
                                                onChange={e => setFormData({ ...formData, assignedToId: e.target.value })} 
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-white text-sm outline-none focus:border-brand-500"
                                            >
                                                <option value="">General Support Queue (Unassigned)</option>
                                                {supportAdmins.map(admin => (
                                                    <option key={admin.id} value={admin.id}>
                                                        {admin.name} ({admin.email})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Subject</label>
                                    <input 
                                        required 
                                        value={formData.subject} 
                                        onChange={e => setFormData({ ...formData, subject: e.target.value })} 
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none placeholder:text-slate-400" 
                                        placeholder="Brief summary of the issue..." 
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Category</label>
                                        <select 
                                            value={formData.category} 
                                            onChange={e => setFormData({ ...formData, category: e.target.value })} 
                                            className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none text-sm"
                                        >
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Priority</label>
                                        <select 
                                            value={formData.priority} 
                                            onChange={e => setFormData({ ...formData, priority: e.target.value as any })} 
                                            className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none text-sm"
                                        >
                                            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Related Asset (Optional)</label>
                                    <select 
                                        value={formData.assetId} 
                                        onChange={e => setFormData({ ...formData, assetId: e.target.value })} 
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none text-sm"
                                    >
                                        <option value="">No specific asset</option>
                                        {(() => {
                                            const effectiveTargetId = formData.targetUserId ? Number(formData.targetUserId) : user?.id;
                                            return assets
                                                .filter(a => user?.role === 'Admin' || a.assigneeId === effectiveTargetId)
                                                .map(a => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.name} ({a.assetId}){a.assignee ? ` - ${a.assignee.name}` : ''}
                                                    </option>
                                                ));
                                        })()}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Description</label>
                                    <textarea 
                                        required 
                                        rows={4} 
                                        value={formData.description} 
                                        onChange={e => setFormData({ ...formData, description: e.target.value })} 
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none placeholder:text-slate-400" 
                                        placeholder="Provide specific details about the issue..." 
                                    />
                                </div>

                                {/* Attachments section */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                                            Attachments (Screenshots / Logs)
                                        </label>
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
                                        onChange={e => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0], false)}
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
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="flex-1 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 py-3 rounded-2xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submittingTicket || isUploadingTicketFile} 
                                    className="flex-1 bg-brand-600 text-white py-3 rounded-2xl font-bold hover:bg-brand-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-xl shadow-brand-600/20"
                                >
                                    {submittingTicket ? 'Submitting & Dispatching...' : 'Submit Ticket'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Ticket Detail & Discussion Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-in max-h-[92vh] flex flex-col">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">{selectedTicket.subject}</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Ticket #{selectedTicket.id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {user?.role === 'Admin' && (
                                    <button 
                                        onClick={() => setDeletingTicketId(selectedTicket.id)} 
                                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                        title="Delete Ticket"
                                    >
                                        {ICONS.delete}
                                    </button>
                                )}
                                <button 
                                    onClick={() => setSelectedTicket(null)} 
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                                >
                                    {ICONS.close}
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-6 overflow-y-auto">
                            {/* Key Metadata Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block ${getStatusColor(selectedTicket.status)}`}>
                                        {selectedTicket.status}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Priority</p>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block ${getPriorityColor(selectedTicket.priority)}`}>
                                        {selectedTicket.priority}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                                    <p className="font-bold text-slate-800 dark:text-white text-sm">{selectedTicket.category}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Submitted By</p>
                                    <p className="font-bold text-slate-800 dark:text-white text-sm">{selectedTicket.user?.name || 'Employee'}</p>
                                </div>
                            </div>

                            {/* Assignee & Resolution Timestamps */}
                            <div className="flex flex-wrap gap-4 text-xs">
                                <div>
                                    <span className="text-slate-400 font-medium">Assigned IT Technician: </span>
                                    {user?.role === 'Admin' ? (
                                        <select
                                            value={selectedTicket.assignedToId || ''}
                                            onChange={async (e) => {
                                                const newAssignedId = e.target.value ? Number(e.target.value) : null;
                                                try {
                                                    const res = await fetch(`${API_URL}/api/tickets/${selectedTicket.id}`, {
                                                        method: 'PUT',
                                                        headers: getHeaders(),
                                                        credentials: 'include',
                                                        body: JSON.stringify({ assignedToId: newAssignedId })
                                                    });
                                                    if (res.ok) {
                                                        const updated = await res.json();
                                                        setTickets(tickets.map(t => t.id === selectedTicket.id ? updated : t));
                                                        setSelectedTicket(updated);
                                                        setNotification({ message: 'IT technician assignment updated', type: 'success' });
                                                    }
                                                } catch {
                                                    setNotification({ message: 'Failed to update assignment', type: 'error' });
                                                }
                                            }}
                                            className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-bold text-slate-700 dark:text-slate-300 outline-none ml-1.5"
                                        >
                                            <option value="">Unassigned</option>
                                            {supportAdmins.map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                            {selectedTicket.assignedTo?.name || 'Unassigned'}
                                        </span>
                                    )}
                                </div>

                                {selectedTicket.resolvedAt && (
                                    <div>
                                        <span className="text-slate-400 font-medium">Resolved On: </span>
                                        <span className="font-bold text-teal-600 dark:text-teal-400">
                                            {new Date(selectedTicket.resolvedAt).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Resolution Notes / Root Cause Box */}
                            {selectedTicket.resolutionNotes && (
                                <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 p-4 rounded-2xl">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-teal-800 dark:text-teal-300 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                            ✅ Resolution Summary & Root Cause
                                        </span>
                                    </div>
                                    <p className="text-sm text-teal-950 dark:text-teal-200 whitespace-pre-wrap leading-relaxed font-medium">
                                        {selectedTicket.resolutionNotes}
                                    </p>
                                </div>
                            )}

                            {/* Related Asset */}
                            {selectedTicket.assetId && (() => {
                                const relatedAsset = assets.find(a => a.id === selectedTicket.assetId);
                                return relatedAsset ? (
                                    <div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Related Asset</p>
                                        <button
                                            onClick={() => { setSelectedTicket(null); navigate('assets'); }}
                                            className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group w-full text-left"
                                        >
                                            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center text-brand-600 dark:text-red-400 flex-shrink-0">
                                                {ICONS.assets || '💻'}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-brand-600 dark:group-hover:text-red-400 transition-colors">
                                                    {relatedAsset.name}
                                                </p>
                                                <p className="text-xs text-slate-500 font-mono">{relatedAsset.assetId}</p>
                                            </div>
                                        </button>
                                    </div>
                                ) : null;
                            })()}

                            {/* Description & Attachments */}
                            <div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Issue Description</p>
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-100 dark:border-slate-800">
                                    {selectedTicket.description}
                                </div>
                                
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

                            {/* Discussion Thread */}
                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        💬 Discussion & Activity ({comments.length})
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => handleSyncReplies(selectedTicket.id, true)}
                                        disabled={isSyncingReplies}
                                        className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-red-400 flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-950/40 rounded-lg transition-all"
                                    >
                                        <span className={isSyncingReplies ? 'animate-spin' : ''}>🔄</span>
                                        {isSyncingReplies ? 'Syncing Outlook...' : 'Check Outlook Replies'}
                                    </button>
                                </div>

                                {/* Comments list */}
                                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                    {loadingComments && (
                                        <div className="flex justify-center py-4">
                                            <span className="animate-pulse text-xs text-slate-400 font-medium">Loading messages...</span>
                                        </div>
                                    )}
                                    {!loadingComments && comments.length === 0 && (
                                        <p className="text-xs text-center text-slate-400 font-medium italic py-4">
                                            No comments yet. Start the discussion below or reply directly from Outlook.
                                        </p>
                                    )}
                                    {comments.map(c => {
                                        const isAuthorAdmin = c.user?.role === 'Admin';
                                        const isMe = c.user?.email === user?.email;
                                        const commentAtts = parseAttachments(c.attachments);
                                        const isInternal = c.isInternal;
                                        
                                        return (
                                            <div key={c.id} className={`flex flex-col ${isMe && !isInternal ? 'items-end' : 'items-start'}`}>
                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                    {!isMe && (
                                                        <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wide">
                                                            {c.user?.name || 'User'}
                                                        </span>
                                                    )}
                                                    {isAuthorAdmin && (
                                                        <span className="px-1.5 py-0.5 bg-red-100 text-brand-600 dark:bg-red-950/60 dark:text-red-400 rounded text-[9px] font-black uppercase">
                                                            IT Admin
                                                        </span>
                                                    )}
                                                    {isInternal && (
                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded text-[9px] font-black uppercase flex items-center gap-1">
                                                            🔒 Internal IT Note
                                                        </span>
                                                    )}
                                                    {c.source === 'Email' && (
                                                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 rounded text-[9px] font-bold">
                                                            Via Outlook
                                                        </span>
                                                    )}
                                                    <span className="text-[9px] font-medium text-slate-400">
                                                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                
                                                <div className={`p-3.5 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-sm ${
                                                    isInternal
                                                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-800 rounded-tl-sm'
                                                        : isMe 
                                                            ? 'bg-brand-600 text-white rounded-tr-sm' 
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-sm'
                                                }`}>
                                                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                                                        isInternal 
                                                            ? 'text-amber-900 dark:text-amber-200' 
                                                            : isMe ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                                                    }`}>
                                                        {c.message}
                                                    </p>
                                                    
                                                    {/* Comment Attachments */}
                                                    {commentAtts.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 pt-2 mt-2 border-t border-black/10 dark:border-white/10">
                                                            {commentAtts.map((att, idx) => (
                                                                <a
                                                                    key={idx}
                                                                    href={att.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity ${
                                                                        isMe && !isInternal
                                                                            ? 'bg-black/20 text-white' 
                                                                            : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-brand-600 dark:text-red-400'
                                                                    }`}
                                                                >
                                                                    <span>📎 {att.name}</span>
                                                                    <span className="text-[10px] opacity-75">({(att.size / 1024).toFixed(1)} KB)</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={commentsEndRef} />
                                </div>

                                {/* Comment Form */}
                                <form onSubmit={handleAddComment} className="space-y-3">
                                    {/* Admin-only Internal Note toggle */}
                                    {user?.role === 'Admin' && (
                                        <div className="flex items-center justify-between px-1">
                                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-700 dark:text-amber-400 select-none">
                                                <input 
                                                    type="checkbox"
                                                    checked={isInternalComment}
                                                    onChange={e => setIsInternalComment(e.target.checked)}
                                                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                                                />
                                                <span>🔒 Internal IT Note (Admin Only — Hidden from Employee)</span>
                                            </label>
                                            {isInternalComment && (
                                                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 italic">
                                                    Will not dispatch Outlook email to user
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={newComment}
                                            onChange={e => setNewComment(e.target.value)}
                                            placeholder={isInternalComment ? "Add a private IT note (only visible to admins)..." : "Add a reply to the ticket..."}
                                            className={`flex-1 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none transition-colors ${
                                                isInternalComment
                                                    ? 'bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-400 focus:border-amber-500'
                                                    : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-brand-500'
                                            }`}
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
                                            onChange={e => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0], true)}
                                            className="hidden"
                                            accept="image/*,.pdf,.txt,.docx,.xlsx,.zip"
                                        />

                                        <button
                                            type="submit"
                                            disabled={submittingComment || (!newComment.trim() && commentAttachments.length === 0)}
                                            className={`px-5 py-2.5 font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 shrink-0 ${
                                                isInternalComment
                                                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                                                    : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/20'
                                            } disabled:opacity-50`}
                                        >
                                            {submittingComment ? 'Sending...' : isInternalComment ? '🔒 Post Private' : 'Send'}
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

                            {/* Status Change Toolbar (Admin Only) */}
                            {user?.role === 'Admin' && (
                                <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                                        Update Ticket Status
                                    </p>
                                    <div className="flex flex-wrap gap-2.5">
                                        {statuses.map(s => (
                                            <button 
                                                key={s} 
                                                onClick={() => handleUpdateStatus(selectedTicket.id, s)} 
                                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                                    selectedTicket.status === s 
                                                        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20' 
                                                        : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                                                }`}
                                            >
                                                {s === 'Resolved' ? '✓ Mark Resolved' : s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Resolution Modal */}
            {resolvingTicketId !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">Resolve Ticket #{resolvingTicketId}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Capture root cause & solution for employee</p>
                            </div>
                            <button 
                                onClick={() => setResolvingTicketId(null)} 
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                            >
                                {ICONS.close}
                            </button>
                        </div>
                        <form onSubmit={handleConfirmResolve} className="p-8 space-y-4">
                            <div>
                                <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">
                                    Resolution Summary / Root Cause <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    value={resolutionNotesInput}
                                    onChange={e => setResolutionNotesInput(e.target.value)}
                                    placeholder="Explain how the issue was resolved (e.g. Replaced faulty HDMI dongle, cleared Outlook credential manager cache, issued new laptop charger)..."
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-400"
                                />
                                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                                    This summary will be included in the resolution email notification dispatched to the employee and stored permanently in the audit history.
                                </p>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setResolvingTicketId(null)}
                                    className="flex-1 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 py-3 rounded-2xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingResolution || !resolutionNotesInput.trim()}
                                    className="flex-1 bg-teal-600 text-white py-3 rounded-2xl font-bold hover:bg-teal-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-teal-600/20"
                                >
                                    {submittingResolution ? 'Resolving...' : 'Confirm & Resolve'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingTicketId !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in p-6 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                            {ICONS.delete}
                        </div>
                        <div className="text-center space-y-1.5">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white">Delete Ticket #{deletingTicketId}?</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Are you sure you want to delete this ticket? All discussion messages, internal notes, and attachments will be permanently removed. This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeletingTicketId(null)}
                                disabled={isDeletingTicket}
                                className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteTicket}
                                disabled={isDeletingTicket}
                                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-md shadow-red-600/20"
                            >
                                {isDeletingTicket ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupportTickets;
