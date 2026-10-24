import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { API_URL } from '../../utils/apiClient';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import { SupportTicket, TicketComment, TicketAttachment, KnowledgeBaseArticle } from '../../types';
import { sanitizeHtml } from '../../utils/sanitize';


// Standardized Ticket ID Formatter
export const formatTicketId = (id: number) => `#TKT-${String(id).padStart(4, '0')}`;

// 1-Click Canned Responses for Solo IT Administrator
const CANNED_RESPONSES = [
    {
        title: '🔄 Restart & Recheck',
        text: 'Please perform a full restart of your laptop, ensure you are connected to the network, and test again to see if the issue persists.'
    },
    {
        title: '🏢 Bring to IT Desk',
        text: 'Kindly bring your device to the IT Support Room for a physical hardware diagnostic check and inspection.'
    },
    {
        title: '🔑 Password / MFA Reset',
        text: 'Your account credentials / MFA authentication token have been reset. Please follow the instructions sent to your registered mobile number / email.'
    },
    {
        title: '🛠️ Warranty Service Logged',
        text: 'Hardware defect has been confirmed. An official warranty service call has been registered with the manufacturer (Dell/Lenovo). We will update you once the technician is scheduled.'
    },
    {
        title: '📦 Standby Device Ready',
        text: 'A temporary standby laptop / peripheral has been prepared and allocated for you while your primary device undergoes repairs.'
    },
    {
        title: '✅ Configuration Complete',
        text: 'The requested software installation / configuration update has been completed. Please test and confirm if everything works as expected on your end.'
    },
    {
        title: '⏳ Waiting on Details',
        text: 'We require additional information to proceed with troubleshooting. Could you please reply with a screenshot or photo of the exact error message?'
    }
];

const SupportTickets: React.FC = () => {
    const { tickets, setTickets, getHeaders, setNotification, assets, navigate, users, kbArticles = [] } = useAppContext();
    const { user } = useAuth();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isInternalComment, setIsInternalComment] = useState(false);
    const [loadingComments, setLoadingComments] = useState(false);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [submittingTicket, setSubmittingTicket] = useState(false);

    // Support Admin Contacts
    const [supportAdmins, setSupportAdmins] = useState<Array<{ id: number; name: string; email: string }>>([]);

    // Resolution Modal State
    const [resolvingTicketId, setResolvingTicketId] = useState<number | null>(null);
    const [resolutionNotesInput, setResolutionNotesInput] = useState('');
    const [submittingResolution, setSubmittingResolution] = useState(false);

    // Delete Ticket State
    const [deletingTicketId, setDeletingTicketId] = useState<number | null>(null);
    const [isDeletingTicket, setIsDeletingTicket] = useState(false);

    // KB Article Preview Modal for Self-Service Deflection
    const [selectedKbPreview, setSelectedKbPreview] = useState<KnowledgeBaseArticle | null>(null);

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

    const createDialogRef = useDialogAccessibility(isModalOpen, () => setIsModalOpen(false));
    const detailDialogRef = useDialogAccessibility(Boolean(selectedTicket), () => setSelectedTicket(null));
    const previewDialogRef = useDialogAccessibility(Boolean(selectedKbPreview), () => setSelectedKbPreview(null));
    const resolutionDialogRef = useDialogAccessibility(resolvingTicketId !== null, () => setResolvingTicketId(null));
    const deleteDialogRef = useDialogAccessibility(deletingTicketId !== null, () => setDeletingTicketId(null));

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

    // Admin & Manager / Team detection
    const isAdmin = user?.role === 'Admin';
    const isManager = user?.role === 'Manager' || Boolean(user && users.some(u => u.managerId === user.id));
    const [teamViewTab, setTeamViewTab] = useState<'all' | 'my' | 'team'>('all');

    // Multi-Dimension Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [companyFilter, setCompanyFilter] = useState('All');

    const hasActiveFilters = statusFilter !== 'All' || categoryFilter !== 'All' || priorityFilter !== 'All' || (isAdmin && companyFilter !== 'All') || searchTerm.trim() !== '';

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

    useEffect(() => {
        if (selectedTicket) {
            fetchComments(selectedTicket.id);
            setCommentAttachments([]);
            setIsInternalComment(false);
        } else {
            setComments([]);
            setNewComment('');
            setCommentAttachments([]);
            setIsInternalComment(false);
        }
    }, [selectedTicket?.id, fetchComments]);

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
            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.error || `Failed to delete ticket (${res.status})`);
            }
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
            case 'Urgent': return 'text-ink bg-surface   border border-line ';
            case 'High': return 'text-ink bg-surface   border border-line ';
            case 'Medium': return 'text-ink bg-surface   border border-line ';
            default: return 'text-quiet bg-muted   border border-line ';
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Open': return 'text-ink bg-surface   border border-line ';
            case 'In Progress': return 'text-ink bg-surface   border border-line ';
            case 'Waiting on User': return 'text-ink bg-surface   border border-line ';
            case 'Waiting on Vendor': return 'text-ink bg-surface   border border-line ';
            case 'Resolved': return 'text-ink bg-surface   border border-line ';
            case 'Closed': return 'text-quiet bg-muted   border border-line ';
            default: return 'text-quiet bg-muted  border border-line';
        }
    };

    const getCompanyBadge = (company?: string | null) => {
        if (!company) return null;
        const compUpper = company.toUpperCase();
        if (compUpper.includes('MEDICAL') || compUpper.includes('AMD')) {
            return (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase bg-surface text-ink border border-line" title="Avana Medical Devices">
                    AMD
                </span>
            );
        }
        if (compUpper.includes('SURGICAL') || compUpper.includes('ASSP')) {
            return (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase bg-surface text-ink border border-line" title="Avana Surgical System India">
                    ASSP
                </span>
            );
        }
        if (compUpper.includes('TECHNOLOGY') || compUpper.includes('ATS')) {
            return (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase bg-surface text-ink border border-line" title="Avana Technology Services">
                    ATS
                </span>
            );
        }
        return (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-muted text-ink border border-line">
                {company.slice(0, 4)}
            </span>
        );
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
                color: 'text-ink bg-surface border-line   ',
                dot: 'bg-olive'
            };
        }
        if (diffDays >= 3) {
            return {
                label: `Idle (${diffDays}d)`,
                color: 'text-ink bg-surface border-line   ',
                dot: 'bg-olive'
            };
        }
        return {
            label: 'Active (<48h)',
            color: 'text-ink bg-surface border-line   ',
            dot: 'bg-olive'
        };
    };

    // Metrics for KPI Cards
    const activeTicketsCount = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress' || t.status === 'Waiting on User' || t.status === 'Waiting on Vendor').length;
    const inProgressCount = tickets.filter(t => t.status === 'In Progress').length;
    const waitingCount = tickets.filter(t => t.status === 'Waiting on User' || t.status === 'Waiting on Vendor').length;
    const waitingOnUserCount = tickets.filter(t => t.status === 'Waiting on User').length;
    const staleCount = tickets.filter(t => {
        if (t.status === 'Resolved' || t.status === 'Closed') return false;
        const diffDays = (new Date().getTime() - new Date(t.updatedAt || t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 7;
    }).length;
    const resolvedCount = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

    // Subordinate IDs for managers
    const subordinateIds = useMemo(() => users.filter(u => u.managerId === user?.id).map(u => u.id), [users, user?.id]);
    const subordinatesTicketsCount = useMemo(() => tickets.filter(t => subordinateIds.includes(t.userId)).length, [tickets, subordinateIds]);

    // Live Knowledge Base Suggestions for Ticket Subject (Deflection)
    const matchingKbArticles = useMemo(() => {
        const term = formData.subject.trim().toLowerCase();
        if (term.length < 3 || !kbArticles || kbArticles.length === 0) return [];
        return kbArticles.filter(a =>
            a.title.toLowerCase().includes(term) ||
            a.category.toLowerCase().includes(term) ||
            (a.content && a.content.toLowerCase().includes(term))
        ).slice(0, 3);
    }, [formData.subject, kbArticles]);

    // Filtered Tickets Computation
    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            // Team view tab filter
            if (user?.role !== 'Admin') {
                if (teamViewTab === 'my' && t.userId !== user?.id) return false;
                if (teamViewTab === 'team' && !subordinateIds.includes(t.userId)) return false;
            } else if (teamViewTab === 'my') {
                if (t.userId !== user?.id && t.assignedToId !== user?.id) return false;
            }

            // Text search (matches subject, category, user name, root cause, ID)
            if (searchTerm.trim()) {
                const s = searchTerm.toLowerCase().trim();
                const rawNumeric = s.replace(/^#?tkt-?/i, '');
                const formattedId = formatTicketId(t.id).toLowerCase();
                const matchesSearch =
                    t.subject.toLowerCase().includes(s) ||
                    t.category.toLowerCase().includes(s) ||
                    (t.user?.name && t.user.name.toLowerCase().includes(s)) ||
                    (t.resolutionNotes && t.resolutionNotes.toLowerCase().includes(s)) ||
                    String(t.id) === rawNumeric ||
                    formattedId.includes(s);
                if (!matchesSearch) return false;
            }

            // Status filter
            if (statusFilter === 'Waiting') {
                if (t.status !== 'Waiting on User' && t.status !== 'Waiting on Vendor') return false;
            } else if (statusFilter === 'Waiting on User') {
                if (t.status !== 'Waiting on User') return false;
            } else if (statusFilter === 'Active') {
                if (t.status === 'Resolved' || t.status === 'Closed') return false;
            } else if (statusFilter === 'Stale') {
                if (t.status === 'Resolved' || t.status === 'Closed') return false;
                const diffDays = (new Date().getTime() - new Date(t.updatedAt || t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                if (diffDays < 7) return false;
            } else if (statusFilter === 'Resolved') {
                if (t.status !== 'Resolved' && t.status !== 'Closed') return false;
            } else if (statusFilter !== 'All') {
                if (t.status !== statusFilter) return false;
            }

            // Category filter
            if (categoryFilter !== 'All' && t.category !== categoryFilter) {
                return false;
            }

            // Priority filter
            if (priorityFilter !== 'All' && t.priority !== priorityFilter) {
                return false;
            }

            // Company filter (Admin only)
            if (isAdmin && companyFilter !== 'All') {
                const comp = (t.user?.company || '').toUpperCase();
                if (!comp.includes(companyFilter)) {
                    return false;
                }
            }

            return true;
        });
    }, [tickets, searchTerm, statusFilter, categoryFilter, priorityFilter, companyFilter, teamViewTab, user, subordinateIds, isAdmin]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-ink">Support Tickets</h2>
                    <p className="text-quiet text-sm">
                        {isAdmin
                            ? 'Helpdesk operations console: track, assign, and resolve IT technical support requests.'
                            : 'Submit and track your IT technical support requests and view live resolution updates.'}
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-accent text-on-strong px-5 py-2.5 rounded-xl hover:bg-accent transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-strong/15 font-bold"
                >
                    {ICONS.add} New Ticket
                </button>
            </div>

            {/* KPI Summary Metric Cards */}
            {isAdmin ? (
                /* Admin: 5-Card Helpdesk Operations Triage Bar */
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                    <div
                        onClick={() => setStatusFilter('All')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            statusFilter === 'All'
                                ? 'bg-surface border-accent   shadow-sm ring-2 ring-accent/20'
                                : 'bg-surface  border-line  hover:border-line '
                        }`}
                    >
                        <p className="text-[11px] font-black uppercase tracking-wider text-quiet">Total Active</p>
                        <p className="text-2xl font-black text-ink mt-1">{activeTicketsCount}</p>
                        <p className="text-[11px] text-quiet mt-0.5">In queue / open</p>
                    </div>

                    <div
                        onClick={() => setStatusFilter('In Progress')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            statusFilter === 'In Progress'
                                ? 'bg-surface border-line   shadow-sm ring-2 ring-accent/20'
                                : 'bg-surface  border-line  hover:border-line '
                        }`}
                    >
                        <p className="text-[11px] font-black uppercase tracking-wider text-ink">In Progress</p>
                        <p className="text-2xl font-black text-ink mt-1">{inProgressCount}</p>
                        <p className="text-[11px] text-quiet mt-0.5">Being worked on</p>
                    </div>

                    <div
                        onClick={() => setStatusFilter('Waiting')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            statusFilter === 'Waiting'
                                ? 'bg-surface border-line   shadow-sm ring-2 ring-accent/20'
                                : 'bg-surface  border-line  hover:border-line '
                        }`}
                    >
                        <p className="text-[11px] font-black uppercase tracking-wider text-ink">Waiting</p>
                        <p className="text-2xl font-black text-ink mt-1">{waitingCount}</p>
                        <p className="text-[11px] text-quiet mt-0.5">User / Vendor ball</p>
                    </div>

                    <div
                        onClick={() => setStatusFilter('Stale')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            statusFilter === 'Stale'
                                ? 'bg-surface border-line   shadow-sm ring-2 ring-accent/20'
                                : 'bg-surface  border-line  hover:border-line '
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-black uppercase tracking-wider text-ink">Stale (7d+)</p>
                            {staleCount > 0 && <span className="w-2 h-2 rounded-full bg-olive"></span>}
                        </div>
                        <p className="text-2xl font-black text-ink mt-1">{staleCount}</p>
                        <p className="text-[11px] text-quiet mt-0.5">Needs attention</p>
                    </div>

                    <div
                        onClick={() => setStatusFilter('Resolved')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            statusFilter === 'Resolved'
                                ? 'bg-surface border-line   shadow-sm ring-2 ring-accent/20'
                                : 'bg-surface  border-line  hover:border-line '
                        }`}
                    >
                        <p className="text-[11px] font-black uppercase tracking-wider text-ink">Resolved</p>
                        <p className="text-2xl font-black text-ink mt-1">{resolvedCount}</p>
                        <p className="text-[11px] text-quiet mt-0.5">Completed tickets</p>
                    </div>
                </div>
            ) : (
                /* Regular Employee: Simplified 3-Card Summary */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div
                        onClick={() => setStatusFilter(statusFilter === 'Active' ? 'All' : 'Active')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            statusFilter === 'Active'
                                ? 'bg-surface border-accent   shadow-sm ring-2 ring-accent/20'
                                : 'bg-surface  border-line  hover:border-line '
                        }`}
                    >
                        <p className="text-[11px] font-black uppercase tracking-wider text-quiet">Active Requests</p>
                        <p className="text-2xl font-black text-ink mt-1">{activeTicketsCount}</p>
                        <p className="text-[11px] text-quiet mt-0.5">Under review &amp; in progress with IT</p>
                    </div>

                    <div
                        onClick={() => setStatusFilter(statusFilter === 'Waiting on User' ? 'All' : 'Waiting on User')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            statusFilter === 'Waiting on User'
                                ? 'bg-surface border-line   shadow-sm ring-2 ring-accent/20'
                                : 'bg-surface  border-line  hover:border-line '
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-black uppercase tracking-wider text-ink">Awaiting Your Reply</p>
                            {waitingOnUserCount > 0 && (
                                <span className="px-2 py-0.5 bg-surface text-ink text-[10px] font-black rounded-full border border-line animate-pulse">
                                    Action Needed
                                </span>
                            )}
                        </div>
                        <p className="text-2xl font-black text-ink mt-1">{waitingOnUserCount}</p>
                        <p className="text-[11px] text-quiet mt-0.5">IT technician requested additional info</p>
                    </div>

                    <div
                        onClick={() => setStatusFilter(statusFilter === 'Resolved' ? 'All' : 'Resolved')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            statusFilter === 'Resolved'
                                ? 'bg-surface border-line   shadow-sm ring-2 ring-accent/20'
                                : 'bg-surface  border-line  hover:border-line '
                        }`}
                    >
                        <p className="text-[11px] font-black uppercase tracking-wider text-ink">Resolved Requests</p>
                        <p className="text-2xl font-black text-ink mt-1">{resolvedCount}</p>
                        <p className="text-[11px] text-quiet mt-0.5">Successfully solved by IT</p>
                    </div>
                </div>
            )}

            {/* Manager / Scope Tabs */}
            {(user?.role === 'Admin' || isManager) && (
                <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
                    {user?.role === 'Admin' ? (
                        <>
                            <button
                                onClick={() => setTeamViewTab('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    teamViewTab === 'all'
                                        ? 'bg-surface  text-ink  shadow-sm'
                                        : 'text-quiet hover:text-ink '
                                }`}
                            >
                                All Organization Tickets ({tickets.length})
                            </button>
                            <button
                                onClick={() => setTeamViewTab('my')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    teamViewTab === 'my'
                                        ? 'bg-surface  text-ink  shadow-sm'
                                        : 'text-quiet hover:text-ink '
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
                                        ? 'bg-surface  text-ink  shadow-sm'
                                        : 'text-quiet hover:text-ink '
                                }`}
                            >
                                All Accessible ({tickets.length})
                            </button>
                            <button
                                onClick={() => setTeamViewTab('my')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    teamViewTab === 'my'
                                        ? 'bg-surface  text-ink  shadow-sm'
                                        : 'text-quiet hover:text-ink '
                                }`}
                            >
                                My Own Tickets
                            </button>
                            <button
                                onClick={() => setTeamViewTab('team')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    teamViewTab === 'team'
                                        ? 'bg-surface  text-ink  shadow-sm'
                                        : 'text-quiet hover:text-ink '
                                }`}
                            >
                                👥 My Team&apos;s Tickets ({subordinatesTicketsCount})
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Search and Multi-Dimension Filters */}
            <div className="bg-surface p-4 rounded-2xl border border-line space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="relative flex-1 w-full max-w-md">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-quiet">
                            {ICONS.search}
                        </span>
                        <input
                            type="text"
                            placeholder={isAdmin ? "Search by subject, category, user, root cause, or #TKT-0042..." : "Search your tickets by subject, category, or #TKT-0042..."}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-canvas border border-line rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                        />
                    </div>

                    <div className="flex gap-1.5 flex-wrap w-full sm:w-auto items-center">
                        {(isAdmin
                            ? [
                                { id: 'All', label: 'All' },
                                { id: 'Open', label: 'Open' },
                                { id: 'In Progress', label: 'In Progress' },
                                { id: 'Waiting', label: 'Waiting' },
                                { id: 'Stale', label: 'Stale' },
                                { id: 'Resolved', label: 'Resolved' },
                                { id: 'Closed', label: 'Closed' },
                              ]
                            : [
                                { id: 'All', label: 'All My Requests' },
                                { id: 'Active', label: 'Active' },
                                { id: 'Waiting on User', label: 'Needs My Reply' },
                                { id: 'Resolved', label: 'Resolved' },
                              ]
                        ).map(item => (
                            <button
                                key={item.id}
                                onClick={() => setStatusFilter(item.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    statusFilter === item.id
                                        ? 'bg-accent text-on-strong shadow-sm'
                                        : 'bg-muted  text-quiet  hover:bg-muted '
                                }`}
                            >
                                {item.label}
                                {!isAdmin && item.id === 'Waiting on User' && waitingOnUserCount > 0 && (
                                    <span className="ml-1.5 px-1.5 py-0.2 bg-olive text-on-strong text-[10px] rounded-full">
                                        {waitingOnUserCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dropdown Filters Row */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-line text-xs">
                    <span className="font-black text-quiet uppercase tracking-widest text-[10px]">
                        Filters:
                    </span>

                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-quiet font-medium">Category:</span>
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            className="bg-canvas border border-line rounded-lg px-2.5 py-1 text-ink font-bold outline-none"
                        >
                            <option value="All">All Categories</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Priority Filter */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-quiet font-medium">Priority:</span>
                        <select
                            value={priorityFilter}
                            onChange={e => setPriorityFilter(e.target.value)}
                            className="bg-canvas border border-line rounded-lg px-2.5 py-1 text-ink font-bold outline-none"
                        >
                            <option value="All">All Priorities</option>
                            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {/* Company Filter - Only visible to Admins managing multiple group companies */}
                    {isAdmin && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-quiet font-medium">Company:</span>
                            <select
                                value={companyFilter}
                                onChange={e => setCompanyFilter(e.target.value)}
                                className="bg-canvas border border-line rounded-lg px-2.5 py-1 text-ink font-bold outline-none"
                            >
                                <option value="All">All Companies</option>
                                <option value="AMD">AMD (Medical Devices)</option>
                                <option value="ASSP">ASSP (Surgical System)</option>
                                <option value="ATS">ATS (Technology Services)</option>
                            </select>
                        </div>
                    )}

                    {/* Reset Filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={() => {
                                setStatusFilter('All');
                                setCategoryFilter('All');
                                setPriorityFilter('All');
                                setCompanyFilter('All');
                                setSearchTerm('');
                            }}
                            className="text-xs font-bold text-ink hover:text-ink flex items-center gap-1 px-2.5 py-1 bg-surface rounded-lg transition-all ml-auto"
                        >
                            ✕ Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
                <div tabIndex={0} role="region" aria-label="Support tickets table; scroll horizontally for more columns" className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left">
                        <thead className="bg-canvas border-b border-line">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-quiet uppercase tracking-widest">Ticket</th>
                                <th className="px-6 py-4 text-xs font-black text-quiet uppercase tracking-widest">
                                    {isAdmin ? 'Status & Aging' : 'Status'}
                                </th>
                                <th className="px-6 py-4 text-xs font-black text-quiet uppercase tracking-widest">Priority</th>
                                {(user?.role === 'Admin' || isManager) && (
                                    <th className="px-6 py-4 text-xs font-black text-quiet uppercase tracking-widest">Employee & Company</th>
                                )}
                                <th className="px-6 py-4 text-xs font-black text-quiet uppercase tracking-widest">
                                    {isAdmin ? 'Assigned IT' : 'IT Technician'}
                                </th>
                                <th className="px-6 py-4 text-xs font-black text-quiet uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {filteredTickets.map(ticket => {
                                const aging = getTicketAging(ticket);
                                return (
                                    <tr key={ticket.id} className="hover:bg-canvas transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-black text-ink">
                                                    {formatTicketId(ticket.id)}
                                                </span>
                                                <p className="font-bold text-ink truncate max-w-xs">{ticket.subject}</p>
                                                {ticket.attachments && parseAttachments(ticket.attachments).length > 0 && (
                                                    <span className="text-xs text-quiet" title="Has attachments">📎</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-quiet">
                                                    {ticket.category} &bull; {new Date(ticket.createdAt).toLocaleDateString()}
                                                </span>
                                                {ticket.resolutionNotes && (
                                                    <span className="text-[10px] bg-surface text-ink font-bold px-1.5 py-0.5 rounded border border-line" title="Has resolution summary">
                                                        ✓ Root Cause Logged
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getStatusColor(ticket.status)}`}>
                                                    {ticket.status}
                                                </span>
                                                {isAdmin && aging && (
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
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-ink">{ticket.user?.name || 'Unknown'}</p>
                                                    {getCompanyBadge(ticket.user?.company)}
                                                </div>
                                                <p className="text-xs text-quiet">
                                                    {(ticket.user as any)?.department?.name || ticket.user?.email || 'Employee'}
                                                </p>
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            {ticket.assignedTo ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink bg-muted px-2.5 py-1 rounded-lg">
                                                    👤 {ticket.assignedTo.name}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-quiet italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => setSelectedTicket(ticket)}
                                                    className="p-2 text-quiet hover:text-ink rounded-lg hover:bg-surface transition-all"
                                                    title="View Discussion & Details"
                                                >
                                                    {ICONS.view}
                                                </button>
                                                {user?.role === 'Admin' && (
                                                    <button
                                                        onClick={() => setDeletingTicketId(ticket.id)}
                                                        className="p-2 text-quiet hover:text-ink rounded-lg hover:bg-surface transition-all"
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
                                    <td colSpan={6} className="px-6 py-12 text-center text-quiet italic">
                                        No support tickets match your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Ticket Modal with Live Knowledge Base Deflection */}
            {isModalOpen && (
                <div ref={createDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Create support ticket" className="fixed inset-0 bg-strong/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in max-h-[calc(100dvh-1rem)] flex flex-col">
                        <div className="px-8 py-6 border-b border-line flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-ink">New Support Request</h3>
                                <p className="text-xs text-quiet mt-0.5">Submit technical issue to IT Helpdesk</p>
                            </div>
                            <button aria-label="Close dialog" onClick={() => setIsModalOpen(false)} className="text-quiet hover:text-quiet transition-colors p-2 hover:bg-muted rounded-xl">
                                {ICONS.close}
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                            <div className="p-8 space-y-5 overflow-y-auto">
                                {/* Admin: Log on behalf of employee */}
                                {user?.role === 'Admin' && (
                                    <div className="bg-canvas p-4 rounded-2xl border border-line space-y-3">
                                        <div>
                                            <label className="block text-xs font-black text-ink mb-1.5 uppercase tracking-wider">
                                                👤 Log Ticket On Behalf Of (Walk-in / Phone Support)
                                            </label>
                                            <select aria-label="👤 Log Ticket On Behalf Of (Walk-in / Phone Support)"
                                                value={formData.targetUserId}
                                                onChange={e => setFormData({ ...formData, targetUserId: e.target.value, assetId: '' })}
                                                className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-ink text-sm outline-none focus:border-accent"
                                            >
                                                <option value="">Self ({user?.name || 'IT Admin'})</option>
                                                {users.filter(u => u.status === 'Active' && u.id !== user?.id).map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.name} ({u.company || 'Avana'}) &bull; {u.email || u.employeeId || 'Employee'}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-quiet mt-1">
                                                Selecting an employee links this ticket directly to their account and emails them updates.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black text-quiet mb-1.5 uppercase tracking-wider">
                                                🛠️ Assign IT Technician (Optional)
                                            </label>
                                            <select aria-label="🛠️ Assign IT Technician (Optional)"
                                                value={formData.assignedToId}
                                                onChange={e => setFormData({ ...formData, assignedToId: e.target.value })}
                                                className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-ink text-sm outline-none focus:border-accent"
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
                                    <label className="block text-sm font-black text-ink mb-2 uppercase tracking-tight">Subject</label>
                                    <input aria-label="Subject"
                                        required
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                        className="w-full bg-canvas border-0 rounded-2xl px-5 py-3 text-ink focus:ring-2 focus:ring-accent/20 transition-all outline-none placeholder:text-quiet"
                                        placeholder="Brief summary of the issue (e.g. Outlook crashing, VPN error)..."
                                    />
                                </div>

                                {/* Instant Self-Service Knowledge Base Deflection Box */}
                                {matchingKbArticles.length > 0 && (
                                    <div className="bg-surface border border-line rounded-2xl p-4 space-y-2.5 animate-fade-in">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">💡</span>
                                            <span className="text-xs font-black uppercase tracking-wider text-ink">
                                                Instant Self-Service Solutions ({matchingKbArticles.length})
                                            </span>
                                        </div>
                                        <p className="text-xs text-ink">
                                            These verified guides might fix your problem immediately without waiting:
                                        </p>
                                        <div className="flex flex-col gap-1.5 pt-1">
                                            {matchingKbArticles.map(article => (
                                                <button
                                                    key={article.id}
                                                    type="button"
                                                    onClick={() => setSelectedKbPreview(article)}
                                                    className="flex items-center justify-between p-2.5 bg-surface rounded-xl border border-line/60 text-left hover:border-line hover:shadow-sm transition-all group"
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        <span className="text-xs font-bold text-ink group-hover:text-ink">
                                                            📄 {article.title}
                                                        </span>
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-muted text-quiet rounded font-medium">
                                                            {article.category}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-ink ml-2 shrink-0 group-hover:underline">
                                                        Read Guide &rarr;
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-black text-ink mb-2 uppercase tracking-tight">Category</label>
                                        <select aria-label="Category"
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full bg-canvas border-0 rounded-2xl px-5 py-3 text-ink focus:ring-2 focus:ring-accent/20 transition-all outline-none text-sm"
                                        >
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-ink mb-2 uppercase tracking-tight">Priority</label>
                                        <select aria-label="Priority"
                                            value={formData.priority}
                                            onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                                            className="w-full bg-canvas border-0 rounded-2xl px-5 py-3 text-ink focus:ring-2 focus:ring-accent/20 transition-all outline-none text-sm"
                                        >
                                            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-ink mb-2 uppercase tracking-tight">Related Asset (Optional)</label>
                                    <select aria-label="Related Asset (Optional)"
                                        value={formData.assetId}
                                        onChange={e => setFormData({ ...formData, assetId: e.target.value })}
                                        className="w-full bg-canvas border-0 rounded-2xl px-5 py-3 text-ink focus:ring-2 focus:ring-accent/20 transition-all outline-none text-sm"
                                    >
                                        <option value="">No specific asset</option>
                                        {(() => {
                                            // When logging on behalf of an employee, strictly show ONLY their assigned assets
                                            if (formData.targetUserId) {
                                                const targetId = Number(formData.targetUserId);
                                                const targetUser = users.find(u => u.id === targetId);
                                                const targetAssets = assets.filter(a => a.assigneeId === targetId);

                                                if (targetAssets.length === 0) {
                                                    return (
                                                        <option value="" disabled>
                                                            ⚠️ No assets currently assigned to {targetUser?.name || 'this employee'}
                                                        </option>
                                                    );
                                                }

                                                return targetAssets.map(a => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.name} ({a.assetId}){a.category ? ` • ${a.category}` : ''}{a.serialNumber ? ` [S/N: ${a.serialNumber}]` : ''}
                                                    </option>
                                                ));
                                            }

                                            // If regular user (non-admin), show only their own assets
                                            if (user?.role !== 'Admin') {
                                                const myAssets = assets.filter(a => a.assigneeId === user?.id);
                                                if (myAssets.length === 0) {
                                                    return (
                                                        <option value="" disabled>
                                                            No assets assigned to your account
                                                        </option>
                                                    );
                                                }
                                                return myAssets.map(a => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.name} ({a.assetId}){a.category ? ` • ${a.category}` : ''}
                                                    </option>
                                                ));
                                            }

                                            // Admin logging for Self / IT Department (no target employee selected)
                                            const myAdminAssets = assets.filter(a => a.assigneeId === user?.id);
                                            const otherAssets = assets.filter(a => a.assigneeId !== user?.id);

                                            return (
                                                <>
                                                    {myAdminAssets.length > 0 && (
                                                        <optgroup label="Assigned to Me">
                                                            {myAdminAssets.map(a => (
                                                                <option key={a.id} value={a.id}>
                                                                    {a.name} ({a.assetId})
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    <optgroup label="All Company Inventory">
                                                        {otherAssets.map(a => (
                                                            <option key={a.id} value={a.id}>
                                                                {a.name} ({a.assetId}){a.assignee ? ` - ${a.assignee.name}` : ' (Unassigned)'}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                </>
                                            );
                                        })()}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-ink mb-2 uppercase tracking-tight">Description</label>
                                    <textarea aria-label="Description"
                                        required
                                        rows={4}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-canvas border-0 rounded-2xl px-5 py-3 text-ink focus:ring-2 focus:ring-accent/20 transition-all outline-none placeholder:text-quiet"
                                        placeholder="Provide specific details about the issue..."
                                    />
                                </div>

                                {/* Attachments section */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-black text-ink uppercase tracking-tight">
                                            Attachments (Screenshots / Logs)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => ticketFileInputRef.current?.click()}
                                            disabled={isUploadingTicketFile}
                                            className="text-xs font-bold text-ink hover:text-ink flex items-center gap-1"
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
                                                <div key={idx} className="flex items-center gap-2 bg-muted border border-line px-3 py-1.5 rounded-xl text-xs">
                                                    <span className="truncate max-w-[180px] font-medium text-ink">{att.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setTicketAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-quiet hover:text-ink font-bold ml-1"
                                                    >
                                                        &times;
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => ticketFileInputRef.current?.click()}
                                            className="border-2 border-dashed border-line rounded-2xl p-4 text-center cursor-pointer hover:border-accent transition-colors"
                                        >
                                            <p className="text-xs text-quiet">Click to upload screenshots, PDFs, or error logs (Up to 10MB)</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="px-8 py-6 border-t border-line bg-canvas flex gap-4 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-muted text-ink py-3 rounded-2xl font-bold hover:bg-muted transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingTicket || isUploadingTicketFile}
                                    className="flex-1 bg-accent text-on-strong py-3 rounded-2xl font-bold hover:bg-accent disabled:opacity-50 transition-all active:scale-[0.98] shadow-xl shadow-strong/15"
                                >
                                    {submittingTicket ? 'Submitting & Dispatching...' : 'Submit Ticket'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* KB Article Quick Self-Service Reader Modal */}
            {selectedKbPreview && (
                <div ref={previewDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Knowledge base preview" className="fixed inset-0 bg-strong/70 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
                    <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in max-h-[85vh] flex flex-col">
                        <div className="px-8 py-5 border-b border-line flex justify-between items-center shrink-0">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-ink">
                                    Knowledge Base &bull; {selectedKbPreview.category}
                                </span>
                                <h3 className="text-lg font-black text-ink">{selectedKbPreview.title}</h3>
                            </div>
                            <button aria-label="Close dialog"
                                onClick={() => setSelectedKbPreview(null)}
                                className="text-quiet hover:text-quiet p-2 hover:bg-muted rounded-xl"
                            >
                                {ICONS.close}
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-4">
                            <div
                                className="prose dark:prose-invert max-w-none text-sm text-ink leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedKbPreview.content) }}
                            />
                        </div>
                        <div className="px-8 py-4 border-t border-line bg-canvas flex justify-between items-center shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedKbPreview(null)}
                                className="text-xs font-bold text-quiet hover:text-ink"
                            >
                                &larr; Continue Submitting Ticket
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedKbPreview(null);
                                    setIsModalOpen(false);
                                    setNotification({
                                        message: 'Glad the Knowledge Base solved your problem! Ticket creation cancelled.',
                                        type: 'success'
                                    });
                                }}
                                className="px-4 py-2 bg-olive text-on-strong font-bold text-xs rounded-xl shadow-md shadow-strong/15 hover:bg-olive transition-all"
                            >
                                ✓ This Solved My Problem! (Close Request)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket Detail & Discussion Modal */}
            {selectedTicket && (
                <div ref={detailDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Support ticket details" className="fixed inset-0 bg-strong/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-in max-h-[calc(100dvh-1rem)] flex flex-col">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-line flex justify-between items-center shrink-0">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs font-black text-ink bg-surface px-2 py-0.5 rounded-md border border-line">
                                        {formatTicketId(selectedTicket.id)}
                                    </span>
                                    {getCompanyBadge(selectedTicket.user?.company)}
                                </div>
                                <h3 className="text-xl font-black text-ink">{selectedTicket.subject}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {user?.role === 'Admin' && (
                                    <button
                                        onClick={() => setDeletingTicketId(selectedTicket.id)}
                                        className="text-quiet hover:text-ink p-2 hover:bg-surface rounded-xl transition-all"
                                        title="Delete Ticket"
                                    >
                                        {ICONS.delete}
                                    </button>
                                )}
                                <button aria-label="Close dialog"
                                    onClick={() => setSelectedTicket(null)}
                                    className="text-quiet hover:text-quiet transition-colors p-2 hover:bg-muted rounded-xl"
                                >
                                    {ICONS.close}
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-6 overflow-y-auto">
                            {/* Key Metadata Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-canvas p-4 rounded-2xl border border-line">
                                <div>
                                    <p className="text-[10px] font-black text-quiet uppercase tracking-widest mb-1">Status</p>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block ${getStatusColor(selectedTicket.status)}`}>
                                        {selectedTicket.status}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-quiet uppercase tracking-widest mb-1">Priority</p>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block ${getPriorityColor(selectedTicket.priority)}`}>
                                        {selectedTicket.priority}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-quiet uppercase tracking-widest mb-1">Category</p>
                                    <p className="font-bold text-ink text-sm">{selectedTicket.category}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-quiet uppercase tracking-widest mb-1">Submitted By</p>
                                    <p className="font-bold text-ink text-sm">{selectedTicket.user?.name || 'Employee'}</p>
                                </div>
                            </div>

                            {/* Assignee & Resolution Timestamps */}
                            <div className="flex flex-wrap gap-4 text-xs">
                                <div>
                                    <span className="text-quiet font-medium">Assigned IT Technician: </span>
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
                                            className="bg-muted border border-line rounded-lg px-2 py-1 font-bold text-ink outline-none ml-1.5"
                                        >
                                            <option value="">Unassigned</option>
                                            {supportAdmins.map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="font-bold text-ink">
                                            {selectedTicket.assignedTo?.name || 'Unassigned'}
                                        </span>
                                    )}
                                </div>

                                {selectedTicket.resolvedAt && (
                                    <div>
                                        <span className="text-quiet font-medium">Resolved On: </span>
                                        <span className="font-bold text-ink">
                                            {new Date(selectedTicket.resolvedAt).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Resolution Notes / Root Cause Box */}
                            {selectedTicket.resolutionNotes && (
                                <div className="bg-surface border border-line p-4 rounded-2xl">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-ink font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                            ✅ Resolution Summary & Root Cause
                                        </span>
                                    </div>
                                    <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed font-medium">
                                        {selectedTicket.resolutionNotes}
                                    </p>
                                </div>
                            )}

                            {/* Related Asset */}
                            {selectedTicket.assetId && (() => {
                                const relatedAsset = assets.find(a => a.id === selectedTicket.assetId);
                                return relatedAsset ? (
                                    <div>
                                        <p className="text-xs font-black text-quiet uppercase tracking-widest mb-2">Related Asset</p>
                                        <button
                                            onClick={() => { setSelectedTicket(null); navigate('assets'); }}
                                            className="flex items-center gap-3 bg-canvas border border-line rounded-xl px-4 py-3 hover:border-line hover:bg-surface transition-all group w-full text-left"
                                        >
                                            <div className="w-8 h-8 bg-surface rounded-lg flex items-center justify-center text-ink flex-shrink-0">
                                                {ICONS.assets || '💻'}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold text-ink text-sm group-hover:text-ink transition-colors">
                                                    {relatedAsset.name}
                                                </p>
                                                <p className="text-xs text-quiet font-mono">{relatedAsset.assetId}</p>
                                            </div>
                                        </button>
                                    </div>
                                ) : null;
                            })()}

                            {/* Description & Attachments */}
                            <div>
                                <p className="text-xs font-black text-quiet uppercase tracking-widest mb-2">Issue Description</p>
                                <div className="bg-canvas p-4 rounded-2xl text-ink whitespace-pre-wrap leading-relaxed border border-line">
                                    {selectedTicket.description}
                                </div>

                                {selectedTicket.attachments && parseAttachments(selectedTicket.attachments).length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        <p className="text-xs font-black text-quiet uppercase tracking-widest">Ticket Attachments</p>
                                        <div className="flex flex-wrap gap-2">
                                            {parseAttachments(selectedTicket.attachments).map((att, idx) => (
                                                <a
                                                    key={idx}
                                                    href={att.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 bg-muted border border-line px-3 py-2 rounded-xl text-xs font-medium text-ink hover:underline"
                                                >
                                                    <span>📎 {att.name}</span>
                                                    <span className="text-[10px] text-quiet">({(att.size / 1024).toFixed(1)} KB)</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Discussion Thread */}
                            <div className="pt-6 border-t border-line">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
                                        💬 Discussion & Activity ({comments.length})
                                    </h4>
                                </div>

                                {/* Comments list */}
                                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                    {loadingComments && (
                                        <div className="flex justify-center py-4">
                                            <span className="animate-pulse text-xs text-quiet font-medium">Loading messages...</span>
                                        </div>
                                    )}
                                    {!loadingComments && comments.length === 0 && (
                                        <p className="text-xs text-center text-quiet font-medium italic py-4">
                                            No comments yet. Start the discussion below.
                                        </p>
                                    )}
                                    {comments.map(c => {
                                        const isAuthorAdmin = c.user?.role === 'Admin';
                                        const isMe = Boolean(
                                            user && (
                                                c.userId === user.id ||
                                                c.user?.id === user.id ||
                                                (c.user?.email && user?.email && c.user.email.toLowerCase() === user.email.toLowerCase())
                                            )
                                        );
                                        const commentAtts = parseAttachments(c.attachments);
                                        const isInternal = c.isInternal;

                                        return (
                                            <div key={c.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    <span className={`font-bold text-[10px] uppercase tracking-wide ${isMe ? 'text-ink ' : 'text-quiet '}`}>
                                                        {isMe ? 'You' : (c.user?.name || 'User')}
                                                    </span>
                                                    {isAuthorAdmin && (
                                                        <span className="px-1.5 py-0.5 bg-surface text-ink rounded text-[9px] font-black uppercase">
                                                            IT Admin
                                                        </span>
                                                    )}
                                                    {isInternal && (
                                                        <span className="px-2 py-0.5 bg-surface text-ink border border-line rounded text-[9px] font-black uppercase flex items-center gap-1">
                                                            🔒 Internal IT Note
                                                        </span>
                                                    )}
                                                    <span className="text-[9px] font-medium text-quiet">
                                                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <div className={`p-3.5 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-sm text-left ${
                                                    isInternal
                                                        ? 'bg-surface  text-ink  border border-line  ' + (isMe ? 'rounded-tr-xs' : 'rounded-tl-xs')
                                                        : isMe
                                                            ? 'bg-accent text-on-strong rounded-tr-xs shadow-strong/15'
                                                            : 'bg-muted  text-ink  border border-line  rounded-tl-xs'
                                                }`}>
                                                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                                                        isInternal
                                                            ? 'text-ink '
                                                            : isMe ? 'text-on-strong' : 'text-ink '
                                                    }`}>
                                                        {c.message}
                                                    </p>

                                                    {/* Comment Attachments */}
                                                    {commentAtts.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 pt-2 mt-2 border-t border-line/10">
                                                            {commentAtts.map((att, idx) => (
                                                                <a
                                                                    key={idx}
                                                                    href={att.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity ${
                                                                        isMe && !isInternal
                                                                            ? 'bg-strong/20 text-on-strong'
                                                                            : 'bg-surface  border border-line  text-ink '
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

                                {/* Comment Form with 1-Click Quick Replies Bar */}
                                <form onSubmit={handleAddComment} className="space-y-3">
                                    {/* 1-Click Quick Canned Responses Bar (Visible to Admins) */}
                                    {user?.role === 'Admin' && (
                                        <div className="space-y-1.5 bg-canvas p-3 rounded-2xl border border-line">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-quiet tracking-wider flex items-center gap-1">
                                                    ⚡ 1-Click IT Quick Replies
                                                </span>
                                                <span className="text-[10px] text-quiet">Clicking inserts response into message</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {CANNED_RESPONSES.map((item, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => setNewComment(item.text)}
                                                        className="text-[11px] font-bold px-2.5 py-1 bg-surface hover:bg-surface hover:text-ink text-ink rounded-lg border border-line transition-all active:scale-95 shadow-2xs"
                                                        title={item.text}
                                                    >
                                                        {item.title}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Admin-only Internal Note toggle */}
                                    {user?.role === 'Admin' && (
                                        <div className="flex items-center justify-between px-1">
                                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={isInternalComment}
                                                    onChange={e => setIsInternalComment(e.target.checked)}
                                                    className="rounded text-ink focus:ring-accent w-4 h-4 cursor-pointer"
                                                />
                                                <span>🔒 Internal IT Note (Admin Only — Hidden from Employee)</span>
                                            </label>
                                            {isInternalComment && (
                                                <span className="text-[11px] font-medium text-ink italic">
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
                                            placeholder={isInternalComment ? "Add a private IT note (only visible to admins)..." : "Add a reply to the ticket or use a quick reply above..."}
                                            className={`flex-1 rounded-xl px-4 py-2.5 text-sm text-ink  focus:outline-none transition-colors ${
                                                isInternalComment
                                                    ? 'bg-surface/70  border-2 border-line focus:border-line'
                                                    : 'bg-canvas  border border-line  focus:border-accent'
                                            }`}
                                        />

                                        <button
                                            type="button"
                                            onClick={() => commentFileInputRef.current?.click()}
                                            disabled={isUploadingCommentFile}
                                            title="Attach File"
                                            className="p-2.5 bg-muted hover:bg-muted text-quiet rounded-xl transition-all"
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
                                                    ? 'bg-olive hover:bg-olive text-on-strong shadow-strong/15'
                                                    : 'bg-accent hover:bg-accent text-on-strong shadow-strong/15'
                                            } disabled:opacity-50`}
                                        >
                                            {submittingComment ? 'Sending...' : isInternalComment ? '🔒 Post Private' : 'Send'}
                                        </button>
                                    </div>

                                    {commentAttachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {commentAttachments.map((att, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-muted border border-line px-3 py-1 rounded-lg text-xs">
                                                    <span className="truncate max-w-[150px] font-medium text-ink">{att.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCommentAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-quiet hover:text-ink font-bold"
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
                                <div className="pt-6 border-t border-line">
                                    <p className="text-xs font-black text-quiet uppercase tracking-widest mb-3">
                                        Update Ticket Status
                                    </p>
                                    <div className="flex flex-wrap gap-2.5">
                                        {statuses.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => handleUpdateStatus(selectedTicket.id, s)}
                                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                                    selectedTicket.status === s
                                                        ? 'bg-accent text-on-strong shadow-md shadow-strong/15'
                                                        : 'bg-muted  text-ink  hover:bg-muted '
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
                <div ref={resolutionDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Resolve support ticket" className="fixed inset-0 bg-strong/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col">
                        <div className="px-8 py-6 border-b border-line flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-ink">
                                    Resolve {formatTicketId(resolvingTicketId)}
                                </h3>
                                <p className="text-xs text-quiet mt-0.5">Capture root cause & solution for employee</p>
                            </div>
                            <button aria-label="Close dialog"
                                onClick={() => setResolvingTicketId(null)}
                                className="text-quiet hover:text-quiet transition-colors p-2 hover:bg-muted rounded-xl"
                            >
                                {ICONS.close}
                            </button>
                        </div>
                        <form onSubmit={handleConfirmResolve} className="p-8 space-y-4">
                            <div>
                                <label className="block text-sm font-black text-ink mb-2 uppercase tracking-tight">
                                    Resolution Summary / Root Cause <span className="text-ink">*</span>
                                </label>
                                <textarea aria-label="Resolution Summary / Root Cause"
                                    required
                                    rows={4}
                                    value={resolutionNotesInput}
                                    onChange={e => setResolutionNotesInput(e.target.value)}
                                    placeholder="Explain how the issue was resolved (e.g. Replaced faulty HDMI dongle, cleared Outlook credential manager cache, issued new laptop charger)..."
                                    className="w-full bg-canvas border border-line rounded-2xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent transition-all placeholder:text-quiet"
                                />
                                <p className="text-xs text-quiet mt-1.5 leading-relaxed">
                                    This summary will be included in the resolution email notification dispatched to the employee and stored permanently in the audit history.
                                </p>
                            </div>

                            <div className="pt-4 border-t border-line flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setResolvingTicketId(null)}
                                    className="flex-1 bg-muted text-ink py-3 rounded-2xl font-bold hover:bg-muted transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingResolution || !resolutionNotesInput.trim()}
                                    className="flex-1 bg-olive text-on-strong py-3 rounded-2xl font-bold hover:bg-olive disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-strong/15"
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
                <div ref={deleteDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Confirm ticket deletion" className="fixed inset-0 bg-strong/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in p-6 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-surface text-ink flex items-center justify-center mx-auto">
                            {ICONS.delete}
                        </div>
                        <div className="text-center space-y-1.5">
                            <h3 className="text-lg font-black text-ink">
                                Delete {formatTicketId(deletingTicketId)}?
                            </h3>
                            <p className="text-xs text-quiet leading-relaxed">
                                Are you sure you want to delete this ticket? All discussion messages, internal notes, and attachments will be permanently removed. This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeletingTicketId(null)}
                                disabled={isDeletingTicket}
                                className="flex-1 bg-muted text-ink py-2.5 rounded-xl font-bold text-sm hover:bg-muted transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteTicket}
                                disabled={isDeletingTicket}
                                className="flex-1 bg-olive text-on-strong py-2.5 rounded-xl font-bold text-sm hover:bg-olive transition-all shadow-md shadow-strong/15"
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
