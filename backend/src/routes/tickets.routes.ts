import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendTicketEmail } from '../utils/email';

const router = Router();

router.get('/api/tickets', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let tickets;

        const baseInclude = { 
            user: { 
                select: { 
                    id: true, 
                    name: true, 
                    email: true, 
                    company: true,
                    department: { select: { name: true } },
                    managerId: true
                } 
            },
            assignedTo: { select: { id: true, name: true, email: true } },
            asset: true,
            comments: {
                select: { id: true, createdAt: true, isInternal: true }
            }
        };

        if (role === 'Admin') {
            tickets = await prisma.supportTicket.findMany({ 
                include: baseInclude, 
                orderBy: { createdAt: 'desc' } 
            });
        } else {
            // Find if current user has any subordinates (i.e. is a department / team manager)
            const subordinates = await prisma.user.findMany({
                where: { managerId: id },
                select: { id: true }
            });
            const subordinateIds = subordinates.map(s => s.id);

            tickets = await prisma.supportTicket.findMany({
                where: {
                    userId: { in: [id, ...subordinateIds] }
                },
                include: baseInclude,
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json(tickets);
    } catch (error) {
        console.error('Failed to fetch tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

router.post('/api/tickets', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id, role } = req.user;
        const { subject, category, priority, description, assetId, attachments, targetUserId, assignedToId } = req.body;
        
        if (!subject || !category || !description) {
            return res.status(400).json({ error: 'Subject, category, and description are required' });
        }

        // Feature #4: Log on behalf of employee (Admin only)
        let effectiveUserId = id;
        let loggedOnBehalf = false;
        if (role === 'Admin' && targetUserId && Number(targetUserId) !== id) {
            effectiveUserId = Number(targetUserId);
            loggedOnBehalf = true;
        }

        const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : null;

        const ticket = await prisma.supportTicket.create({
            data: {
                userId: effectiveUserId,
                assignedToId: assignedToId ? Number(assignedToId) : null,
                subject,
                category,
                priority: priority || 'Medium',
                description,
                assetId: assetId ? Number(assetId) : null,
                attachments: attachmentsStr
            },
            include: { 
                user: { select: { id: true, name: true, email: true, company: true, department: { select: { name: true } } } }, 
                assignedTo: { select: { id: true, name: true, email: true } },
                asset: true 
            }
        });

        // Respond immediately — don't block the client on email sending
        res.status(201).json(ticket);

        // Fire email notifications in background — errors here NEVER affect the response
        (async () => {
            try {
                const assetName = ticket.asset ? `${(ticket.asset as any).name} (${(ticket.asset as any).assetId})` : undefined;

                if (loggedOnBehalf && ticket.user?.email) {
                    // Notify the employee that IT has logged a ticket on their behalf
                    await sendTicketEmail({
                        toEmail: ticket.user.email, 
                        toName: ticket.user.name,
                        ticketId: ticket.id, 
                        ticketSubject: ticket.subject,
                        senderName: 'Avana IT Helpdesk',
                        senderEmail: process.env.SMTP_FROM || process.env.SMTP_USER,
                        messageBody: `An IT Support ticket has been created on your behalf by IT Administration.\n\nDescription:\n${ticket.description}`,
                        category: ticket.category, 
                        priority: ticket.priority,
                        status: ticket.status, 
                        assetName,
                        isReply: false,
                    });
                } else {
                    const admins = await prisma.user.findMany({ where: { role: 'Admin', status: 'Active' }, select: { name: true, email: true } });
                    for (const admin of admins) {
                        await sendTicketEmail({
                            toEmail: admin.email, toName: admin.name,
                            ticketId: ticket.id, ticketSubject: ticket.subject,
                            senderName: ticket.user?.name || 'Employee',
                            senderEmail: ticket.user?.email,
                            messageBody: ticket.description,
                            category: ticket.category, priority: ticket.priority,
                            status: ticket.status, assetName,
                            isReply: false,
                        });
                    }
                }
            } catch (e: any) {
                console.error('[Email] Background ticket notification failed:', e.message || e);
            }
        })();
    } catch (error) {
        console.error('Failed to create ticket:', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

router.put('/api/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const { role } = req.user;
        
        if (role !== 'Admin') return res.status(403).json({ error: 'Only admins can update tickets' });

        const { status, priority, resolvedAt, resolutionNotes, assignedToId } = req.body;
        
        const updateData: any = {};
        if (status !== undefined) {
            updateData.status = status;
            if (status === 'Resolved') {
                updateData.resolvedAt = new Date();
            } else if (status === 'Open' || status === 'In Progress' || status === 'Waiting on User' || status === 'Waiting on Vendor') {
                updateData.resolvedAt = null;
            } else if (resolvedAt) {
                updateData.resolvedAt = new Date(resolvedAt);
            }
        }
        if (priority !== undefined) updateData.priority = priority;
        if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;
        if (assignedToId !== undefined) updateData.assignedToId = assignedToId ? Number(assignedToId) : null;

        const ticket = await prisma.supportTicket.update({
            where: { id: Number(id) },
            data: updateData,
            include: { 
                user: { select: { id: true, name: true, email: true, company: true, department: { select: { name: true } } } }, 
                assignedTo: { select: { id: true, name: true, email: true } },
                asset: true 
            }
        });

        // Respond immediately
        res.json(ticket);

        // Fire email in background — never blocks or crashes the response
        if (status && ticket.user?.email) {
            (async () => {
                try {
                    let messageBody = `The status of your support ticket #${ticket.id} has been updated to "${status}".`;
                    if (status === 'Resolved' && ticket.resolutionNotes) {
                        messageBody += `\n\nResolution Summary / Root Cause:\n${ticket.resolutionNotes}`;
                    }

                    await sendTicketEmail({
                        toEmail: ticket.user!.email,
                        toName: ticket.user!.name,
                        ticketId: ticket.id,
                        ticketSubject: ticket.subject,
                        senderName: 'Avana IT Support',
                        senderEmail: process.env.SMTP_FROM || process.env.SMTP_USER,
                        messageBody,
                        status: ticket.status,
                        priority: ticket.priority,
                        isReply: true,
                    });
                } catch (e: any) {
                    console.error('[Email] Background status-change notification failed:', e.message || e);
                }
            })();
        }
    } catch (error) {
        console.error('Failed to update ticket:', error);
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});

// Admin Delete Ticket Endpoint
router.delete('/api/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const { role } = req.user;

        if (role !== 'Admin') {
            return res.status(403).json({ error: 'Only admins can delete tickets' });
        }

        const ticket = await prisma.supportTicket.findUnique({ where: { id: Number(id) } });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Delete related comments first to ensure clean deletion regardless of DB-level cascade
        await prisma.ticketComment.deleteMany({
            where: { ticketId: Number(id) }
        });

        // Unlink any self-audits referencing this ticket
        await prisma.selfAudit.updateMany({
            where: { ticketId: Number(id) },
            data: { ticketId: null }
        });

        await prisma.supportTicket.delete({
            where: { id: Number(id) }
        });

        res.json({ message: 'Ticket deleted successfully', id: Number(id) });
    } catch (error) {
        console.error('Failed to delete ticket:', error);
        res.status(500).json({ error: 'Failed to delete ticket' });
    }
});

router.get('/api/tickets/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const { id: userId, role } = req.user;

        const ticket = await prisma.supportTicket.findUnique({ 
            where: { id: Number(id) },
            include: { user: { select: { id: true, managerId: true } } }
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const isManagerOfOwner = ticket.user?.managerId === userId;
        if (role !== 'Admin' && role !== 'Manager' && ticket.userId !== userId && !isManagerOfOwner) {
            return res.status(403).json({ error: 'Access denied to this ticket discussion' });
        }

        const whereClause: any = { ticketId: Number(id) };
        if (role !== 'Admin') {
            whereClause.isInternal = false;
        }

        const comments = await prisma.ticketComment.findMany({
            where: whereClause,
            include: {
                user: { select: { id: true, name: true, email: true, role: true, avatar: true } }
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(comments);
    } catch (error) {
        console.error('Failed to fetch ticket comments:', error);
        res.status(500).json({ error: 'Failed to fetch ticket comments' });
    }
});

router.post('/api/tickets/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const { id: userId, role } = req.user;
        const { message, attachments, source, emailMessageId, isInternal } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'Comment message is required' });
        }

        const ticket = await prisma.supportTicket.findUnique({ 
            where: { id: Number(id) },
            include: { user: { select: { id: true, managerId: true } } }
        });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const isManagerOfOwner = ticket.user?.managerId === userId;
        if (role !== 'Admin' && role !== 'Manager' && ticket.userId !== userId && !isManagerOfOwner) {
            return res.status(403).json({ error: 'Access denied to post on this ticket' });
        }

        // Only Admin can create internal notes
        const internalFlag = role === 'Admin' && Boolean(isInternal);

        const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : null;

        const comment = await prisma.ticketComment.create({
            data: {
                ticketId: Number(id),
                userId,
                message: message.trim().slice(0, 5000),
                attachments: attachmentsStr,
                source: source || 'Portal',
                emailMessageId: emailMessageId || null,
                isInternal: internalFlag
            },
            include: {
                user: { select: { id: true, name: true, email: true, role: true, avatar: true } }
            }
        });

        await prisma.supportTicket.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        // Respond immediately — client doesn't wait for email
        res.json(comment);

        // If it's an internal note, skip sending email notifications completely!
        if (internalFlag) {
            console.log(`[Comment Email] Internal IT note posted on ticket #${id}. Skipping email notifications.`);
            return;
        }

        // Fire email in background — isolated from the HTTP request lifecycle
        const ticketIdNum = Number(id);
        const msgBody = message.trim();
        (async () => {
            try {
                const fullTicket = await prisma.supportTicket.findUnique({
                    where: { id: ticketIdNum },
                    include: { user: { select: { id: true, name: true, email: true } } }
                });
                if (!fullTicket) return;

                const commenter = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, name: true, email: true, role: true }
                });

                const commenterRole = (commenter?.role || role || '').toLowerCase();
                const isAdminOrManager = commenterRole === 'admin' || commenterRole === 'manager';
                const senderName = commenter?.name || 'Avana Support';
                const senderEmail = commenter?.email;

                console.log(`[Comment Email] User ${userId} (${commenterRole}) commented on ticket #${ticketIdNum}`);

                if (isAdminOrManager) {
                    const recipientEmail = fullTicket.user?.email;
                    const recipientName = fullTicket.user?.name || 'Ticket Requester';
                    if (recipientEmail) {
                        console.log(`[Comment Email] Admin replied. Notifying ticket owner: ${recipientEmail}`);
                        await sendTicketEmail({
                            toEmail: recipientEmail, toName: recipientName,
                            ticketId: fullTicket.id, ticketSubject: fullTicket.subject || 'Support Ticket',
                            senderName, senderEmail, messageBody: msgBody,
                            status: fullTicket.status, priority: fullTicket.priority, isReply: true,
                        });
                    }
                } else {
                    const admins = await prisma.user.findMany({
                        where: { role: { equals: 'Admin', mode: 'insensitive' }, status: 'Active' },
                        select: { name: true, email: true }
                    });
                    console.log(`[Comment Email] User replied. Notifying ${admins.length} admins.`);
                    for (const admin of admins) {
                        await sendTicketEmail({
                            toEmail: admin.email, toName: admin.name,
                            ticketId: fullTicket.id, ticketSubject: fullTicket.subject || 'Support Ticket',
                            senderName, senderEmail, messageBody: msgBody,
                            status: fullTicket.status, priority: fullTicket.priority, isReply: true,
                        });
                    }
                }
            } catch (e: any) {
                console.error('[Comment Email] Background notification failed:', e.message || e);
            }
        })();
    } catch (error) {
        console.error('Failed to post ticket comment:', error);
        res.status(500).json({ error: 'Failed to post comment' });
    }
});

// --- Support Contacts Endpoint ---
router.get('/api/support-contacts', authenticateToken, async (req, res) => {
    try {
        const admins = await prisma.user.findMany({
            where: { role: 'Admin', status: 'Active' },
            select: { id: true, name: true, email: true }
        });
        res.json(admins);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch support contacts' });
    }
});

// --- Sync Email Reply from Outlook/Graph ---
router.post('/api/tickets/:id/sync-email-reply', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { message, emailMessageId, senderEmail, attachments, receivedAt } = req.body;

        if (!emailMessageId || !message) {
            return res.status(400).json({ error: 'Message and emailMessageId are required' });
        }

        // Idempotency: check if already ingested
        const existing = await prisma.ticketComment.findUnique({
            where: { emailMessageId }
        });
        if (existing) {
            return res.json({ status: 'already_synced', comment: existing });
        }

        const ticket = await prisma.supportTicket.findUnique({ where: { id: Number(id) } });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        // Authorization check: User must be ticket creator, assigned technician, or Admin/Manager
        // @ts-ignore
        const { id: currentUserId, role: currentUserRole, email: currentUserEmail } = req.user;
        const isAuthorized = currentUserRole === 'Admin' || 
                             currentUserRole === 'Manager' || 
                             ticket.userId === currentUserId || 
                             ticket.assignedToId === currentUserId;
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Access denied. You are not authorized to reply to this ticket.' });
        }

        // Enforce verified sender identity (prevent impersonation)
        let commentUserId = currentUserId;
        if (currentUserRole === 'Admin' && senderEmail) {
            const matchedSender = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: { equals: senderEmail.trim(), mode: 'insensitive' } },
                        { emailAliases: { contains: senderEmail.trim() } }
                    ]
                }
            });
            if (matchedSender) {
                commentUserId = matchedSender.id;
            }
        } else if (senderEmail && currentUserEmail && senderEmail.trim().toLowerCase() !== currentUserEmail.toLowerCase()) {
            return res.status(403).json({ error: 'Sender email mismatch. You cannot post replies as another user.' });
        }

        const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : null;

        const comment = await prisma.ticketComment.create({
            data: {
                ticketId: Number(id),
                userId: commentUserId,
                message: message.trim().slice(0, 5000),
                attachments: attachmentsStr,
                source: 'Email',
                emailMessageId,
                createdAt: receivedAt ? new Date(receivedAt) : new Date()
            },
            include: {
                user: { select: { id: true, name: true, role: true, avatar: true } }
            }
        });

        await prisma.supportTicket.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        res.status(201).json({ status: 'synced', comment });
    } catch (error) {
        console.error('Failed to sync email reply:', error);
        res.status(500).json({ error: 'Failed to sync email reply' });
    }
});

// --- Knowledge Base ---


export default router;
