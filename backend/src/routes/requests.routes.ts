import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendAssetRequestEmail } from '../utils/email';

const router = Router();

router.get('/api/requests', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;

        // Check if current user has direct reports (making them a manager in practice)
        const subordinates = await prisma.user.findMany({ where: { managerId: id }, select: { id: true } });
        const hasSubordinates = subordinates.length > 0;

        const requestInclude = {
            user: { 
                select: { 
                    id: true, 
                    name: true, 
                    email: true, 
                    company: true, 
                    employeeId: true, 
                    jobTitle: true,
                    department: { select: { id: true, name: true } },
                    branch: { select: { id: true, name: true } }
                } 
            },
            manager: { 
                select: { 
                    id: true, 
                    name: true, 
                    email: true 
                } 
            },
            allocatedAsset: {
                select: {
                    id: true,
                    assetId: true,
                    name: true,
                    category: true,
                    brand: true,
                    model: true,
                    serialNumber: true,
                    status: true,
                    company: true
                }
            },
            currentAsset: {
                select: {
                    id: true,
                    assetId: true,
                    name: true,
                    category: true,
                    brand: true,
                    model: true,
                    serialNumber: true
                }
            }
        };

        let requests;

        if (role === 'Admin') {
            requests = await prisma.assetRequest.findMany({ 
                include: requestInclude, 
                orderBy: { createdAt: 'desc' } 
            });
        } else if (role === 'Manager' || hasSubordinates) {
            requests = await prisma.assetRequest.findMany({
                where: { OR: [{ managerId: id }, { userId: id }] },
                include: requestInclude,
                orderBy: { createdAt: 'desc' }
            });
        } else {
            requests = await prisma.assetRequest.findMany({
                where: { userId: id },
                include: requestInclude,
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json(requests);
    } catch (error) {
        console.error('Failed to fetch asset requests:', error);
        res.status(500).json({ error: 'Failed to fetch asset requests' });
    }
});

router.post('/api/requests', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id } = req.user;
        const user = await prisma.user.findUnique({ 
            where: { id },
            include: { manager: true }
        });
        const { requestType, category, description, priority, currentAssetId } = req.body;
        
        const initialStatus = user?.managerId ? 'Pending Manager' : 'Pending Admin';

        const request = await prisma.assetRequest.create({
            data: { 
                userId: id, 
                managerId: user?.managerId || null, 
                requestType: requestType || 'New Asset', 
                category: category || 'Laptop', 
                description: description || null, 
                priority: priority || 'Medium',
                currentAssetId: currentAssetId ? Number(currentAssetId) : null,
                status: initialStatus 
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        company: true,
                        employeeId: true,
                        department: { select: { id: true, name: true } }
                    }
                },
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                currentAsset: true
            }
        });

        // Fire-and-forget email notification
        if (user?.manager && user.manager.email) {
            sendAssetRequestEmail({
                toEmail: user.manager.email,
                toName: user.manager.name,
                requestId: request.id,
                requestType: request.requestType,
                category: request.category,
                priority: request.priority,
                status: initialStatus,
                actionTitle: 'New Asset Request Requires Your Approval',
                actionMessage: `${user.name} has submitted a new asset request requiring your review and approval.`,
                actorName: user.name,
                description: request.description || undefined
            }).catch(e => console.error('[AssetRequest Email Error]', e));
        } else {
            const itAdminEmail = process.env.SMTP_USER || 'aravinth@avanamedical.com';
            sendAssetRequestEmail({
                toEmail: itAdminEmail,
                toName: 'IT Administrator',
                requestId: request.id,
                requestType: request.requestType,
                category: request.category,
                priority: request.priority,
                status: initialStatus,
                actionTitle: 'New Asset Request (Direct IT Approval)',
                actionMessage: `${user?.name} has submitted an asset request directly to IT.`,
                actorName: user?.name || 'Employee',
                description: request.description || undefined
            }).catch(e => console.error('[AssetRequest Email Error]', e));
        }

        res.status(201).json(request);
    } catch (error) {
        console.error('Failed to create asset request:', error);
        res.status(500).json({ error: 'Failed to create asset request' });
    }
});

router.put('/api/requests/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason, remarks } = req.body;
        // @ts-ignore
        const { role, id: requestingUserId } = req.user;

        const existingRequest = await prisma.assetRequest.findUnique({ 
            where: { id: Number(id) },
            include: {
                user: true,
                manager: true,
                allocatedAsset: true,
                currentAsset: true
            }
        });
        if (!existingRequest) return res.status(404).json({ error: 'Request not found.' });

        const isManagerOfReq = existingRequest.managerId === requestingUserId || role === 'Admin';

        // Manager Approval / Rejection
        if (status === 'Pending Admin' || status === 'Rejected by Manager') {
            if (!isManagerOfReq) {
                return res.status(403).json({ error: 'Not authorized to manage this request.' });
            }

            if (status === 'Rejected by Manager' && (!rejectionReason || !rejectionReason.trim())) {
                return res.status(400).json({ error: 'A rejection reason is mandatory.' });
            }

            const updatedRequest = await prisma.assetRequest.update({ 
                where: { id: Number(id) }, 
                data: { 
                    status,
                    rejectionReason: status === 'Rejected by Manager' ? rejectionReason.trim() : null,
                    managerRemarks: remarks || null,
                    managerDecisionAt: new Date()
                },
                include: {
                    user: { select: { id: true, name: true, email: true, company: true, department: true, employeeId: true } },
                    manager: { select: { id: true, name: true, email: true } },
                    allocatedAsset: true,
                    currentAsset: true
                }
            });

            // Trigger email notification
            if (status === 'Pending Admin') {
                const itAdminEmail = process.env.SMTP_USER || 'aravinth@avanamedical.com';
                sendAssetRequestEmail({
                    toEmail: itAdminEmail,
                    toName: 'IT Administrator',
                    requestId: updatedRequest.id,
                    requestType: updatedRequest.requestType,
                    category: updatedRequest.category,
                    priority: updatedRequest.priority,
                    status: updatedRequest.status,
                    actionTitle: 'Asset Request Approved by Manager',
                    actionMessage: `${existingRequest.manager?.name || 'Manager'} has approved ${existingRequest.user.name}'s request for ${updatedRequest.category}. It is now awaiting IT Admin allocation/approval.`,
                    actorName: existingRequest.manager?.name || 'Manager',
                    remarks: remarks || undefined
                }).catch(e => console.error('[Manager Approve Email Error]', e));
            } else {
                if (existingRequest.user && existingRequest.user.email) {
                    sendAssetRequestEmail({
                        toEmail: existingRequest.user.email,
                        toName: existingRequest.user.name,
                        requestId: updatedRequest.id,
                        requestType: updatedRequest.requestType,
                        category: updatedRequest.category,
                        priority: updatedRequest.priority,
                        status: updatedRequest.status,
                        actionTitle: 'Asset Request Rejected by Manager',
                        actionMessage: `Your asset request has been rejected by your manager.`,
                        actorName: existingRequest.manager?.name || 'Manager',
                        rejectionReason: rejectionReason.trim(),
                        remarks: remarks || undefined
                    }).catch(e => console.error('[Manager Reject Email Error]', e));
                }
            }

            return res.json(updatedRequest);
        }

        // Admin Approval / Rejection
        if (status === 'Approved' || status === 'Rejected by Admin') {
            if (role !== 'Admin') {
                return res.status(403).json({ error: 'Only IT admins can provide final IT approval or rejection.' });
            }

            if (status === 'Rejected by Admin' && (!rejectionReason || !rejectionReason.trim())) {
                return res.status(400).json({ error: 'A rejection reason is mandatory.' });
            }

            const updatedRequest = await prisma.assetRequest.update({ 
                where: { id: Number(id) }, 
                data: { 
                    status,
                    rejectionReason: status === 'Rejected by Admin' ? rejectionReason.trim() : null,
                    adminRemarks: remarks || null,
                    adminDecisionAt: new Date()
                },
                include: {
                    user: { select: { id: true, name: true, email: true, company: true, department: true, employeeId: true } },
                    manager: { select: { id: true, name: true, email: true } },
                    allocatedAsset: true,
                    currentAsset: true
                }
            });

            if (existingRequest.user && existingRequest.user.email) {
                sendAssetRequestEmail({
                    toEmail: existingRequest.user.email,
                    toName: existingRequest.user.name,
                    requestId: updatedRequest.id,
                    requestType: updatedRequest.requestType,
                    category: updatedRequest.category,
                    priority: updatedRequest.priority,
                    status: updatedRequest.status,
                    actionTitle: status === 'Approved' ? 'Asset Request Approved by IT Admin' : 'Asset Request Rejected by IT Admin',
                    actionMessage: status === 'Approved' 
                        ? `Your asset request has been approved by IT Administration. Device allocation will be processed shortly.`
                        : `Your asset request has been rejected by IT Administration.`,
                    actorName: 'IT Administrator',
                    rejectionReason: status === 'Rejected by Admin' ? rejectionReason.trim() : undefined,
                    remarks: remarks || undefined
                }).catch(e => console.error('[Admin Decision Email Error]', e));
            }

            return res.json(updatedRequest);
        }

        return res.status(400).json({ error: 'Invalid status provided.' });
    } catch (error) {
        console.error('Failed to update asset request status:', error);
        res.status(500).json({ error: 'Failed to update asset request status' });
    }
});

// Admin-only: Allocate inventory asset to fulfill request
router.post('/api/requests/:id/allocate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { assetId, adminRemarks } = req.body;
        // @ts-ignore
        const { id: requestingUserId } = req.user;

        if (!assetId) {
            return res.status(400).json({ error: 'Asset ID is required for allocation.' });
        }

        const request = await prisma.assetRequest.findUnique({
            where: { id: Number(id) },
            include: { user: true, manager: true }
        });

        if (!request) {
            return res.status(404).json({ error: 'Asset request not found.' });
        }

        if (request.status === 'Fulfilled') {
            return res.status(400).json({ error: 'This request has already been fulfilled.' });
        }

        const asset = await prisma.asset.findUnique({
            where: { id: Number(assetId) }
        });

        if (!asset) {
            return res.status(404).json({ error: 'Selected asset not found in inventory.' });
        }

        if (asset.status !== 'In Stock' && asset.status !== 'Available') {
            return res.status(400).json({ error: `Asset "${asset.name}" (${asset.assetId}) is currently "${asset.status}" and cannot be allocated.` });
        }

        // Atomic transaction:
        // 1. Mark Asset as 'In Use', assigned to request.userId
        // 2. Insert AssetHistory log
        // 3. Create HandoverLog in 'Pending' status
        // 4. Update AssetRequest with allocatedAssetId and 'Fulfilled' status
        const [updatedAsset, history, handover, updatedRequest] = await prisma.$transaction([
            prisma.asset.update({
                where: { id: asset.id },
                data: {
                    status: 'In Use',
                    userId: request.userId,
                    assigneeId: request.userId,
                    assigneeType: 'User'
                }
            }),
            prisma.assetHistory.create({
                data: {
                    assetId: asset.id,
                    userId: requestingUserId,
                    event: 'Asset Allocated',
                    details: `Allocated to ${request.user.name} via Asset Request #REQ-${request.id.toString().padStart(4, '0')}.${adminRemarks ? ` Remarks: ${adminRemarks}` : ''}`,
                    condition: asset.condition || 'Good'
                }
            }),
            prisma.handoverLog.create({
                data: {
                    assetId: asset.id,
                    userId: request.userId,
                    status: 'Pending',
                    condition: asset.condition || 'Good',
                    handoverDate: new Date()
                }
            }),
            prisma.assetRequest.update({
                where: { id: Number(id) },
                data: {
                    allocatedAssetId: asset.id,
                    status: 'Fulfilled',
                    adminRemarks: adminRemarks || null,
                    adminDecisionAt: request.adminDecisionAt || new Date(),
                    fulfilledAt: new Date()
                },
                include: {
                    user: { 
                        select: { 
                            id: true, 
                            name: true, 
                            email: true, 
                            company: true, 
                            employeeId: true,
                            jobTitle: true,
                            department: { select: { id: true, name: true } },
                            branch: { select: { id: true, name: true } }
                        } 
                    },
                    manager: { select: { id: true, name: true, email: true } },
                    allocatedAsset: true,
                    currentAsset: true
                }
            })
        ]);

        // Send fulfillment & handover email notification to requester
        if (request.user && request.user.email) {
            sendAssetRequestEmail({
                toEmail: request.user.email,
                toName: request.user.name,
                requestId: request.id,
                requestType: request.requestType,
                category: request.category,
                priority: request.priority,
                status: 'Fulfilled',
                actionTitle: 'Asset Allocated & Ready for Handover',
                actionMessage: `Your requested asset has been allocated by IT Administration. A digital handover record has been generated for you to inspect and sign.`,
                actorName: 'IT Administrator',
                allocatedAssetName: `${asset.name} (${asset.category})`,
                allocatedAssetSerial: asset.serialNumber || 'N/A',
                remarks: adminRemarks
            }).catch(e => console.error('[Allocate Email Error]', e));
        }

        res.json(updatedRequest);
    } catch (error) {
        console.error('Failed to allocate asset:', error);
        res.status(500).json({ error: 'Failed to allocate asset' });
    }
});



// --- Support Tickets ---


export default router;
