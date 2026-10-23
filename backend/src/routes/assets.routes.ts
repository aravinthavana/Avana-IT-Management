import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { assetSchema } from '../schemas';

const router = Router();

router.get('/api/assets', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let assets;
        
        if (role === 'Admin') {
            assets = await prisma.asset.findMany({ include: { user: true, purchase: true } });
        } else if (role === 'Manager') {
            // Managers see all assets in their department or their own
            const user = await prisma.user.findUnique({ where: { id } });
            assets = await prisma.asset.findMany({
                where: {
                    OR: [
                        { userId: id },
                        { user: { managerId: id } },
                        { user: { departmentId: user?.departmentId || -1 } }
                    ]
                },
                include: { user: true, purchase: true }
            });
        } else {
            // Regular users only see their own assigned assets
            assets = await prisma.asset.findMany({
                where: { userId: id },
                include: { user: true, purchase: true }
            });
        }
        res.json(assets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

router.post('/api/assets', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = assetSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const { condition, wipeDetails, ...data } = validation.data;

        // Auto-populate serialNumber from specs.serviceTag if serialNumber is missing/blank
        if (!data.serialNumber || data.serialNumber.trim() === '') {
            let serviceTagVal: string | null = null;
            if (data.specs) {
                if (typeof data.specs === 'object' && data.specs.serviceTag) {
                    serviceTagVal = String(data.specs.serviceTag).trim();
                } else if (typeof data.specs === 'string') {
                    try {
                        const parsed = JSON.parse(data.specs);
                        if (parsed.serviceTag) serviceTagVal = String(parsed.serviceTag).trim();
                    } catch (_) {}
                }
            }
            if (serviceTagVal) {
                data.serialNumber = serviceTagVal;
            }
        }

        const newUserId = data.assigneeType === 'User' ? data.assigneeId : null;
        const assetCompany = data.company || (data.assetId ? data.assetId.split('-')[0] : null);
        const finalStatus = newUserId ? (data.status === 'Assigned' ? 'Assigned' : 'Pending Handover') : (data.status || 'In Stock');

        // Auto-derive effective location from assignee if location not specified or empty
        let effectiveLocation = data.location;
        if (!effectiveLocation || effectiveLocation.trim() === '') {
            if (newUserId) {
                const u = await prisma.user.findUnique({ where: { id: newUserId }, include: { branch: true } });
                effectiveLocation = u?.location || (typeof u?.branch === 'object' ? u?.branch?.name : null) || 'Remote / Field';
            } else if (data.assigneeType === 'Branch' && data.assigneeId) {
                const b = await prisma.branch.findUnique({ where: { id: data.assigneeId } });
                effectiveLocation = b?.location || b?.name || 'Branch';
            } else if (data.assigneeType === 'Department' && data.assigneeId) {
                const d = await prisma.department.findUnique({ where: { id: data.assigneeId } });
                effectiveLocation = d?.name || 'Department';
            } else {
                effectiveLocation = 'In Stock';
            }
        }

        const asset = await prisma.asset.create({
            data: { 
                ...data, 
                location: effectiveLocation,
                company: assetCompany,
                status: finalStatus,
                condition: condition || 'Good',
                specs: data.specs ? (typeof data.specs === 'string' ? data.specs : JSON.stringify(data.specs)) : null,
                userId: newUserId // Ensure relation is set
            } as any
        });

        // Add history for creation
        // @ts-ignore
        const actionUserId = req.user.id;
        await prisma.assetHistory.create({
            data: {
                assetId: asset.id,
                userId: actionUserId,
                event: 'Asset Created',
                condition: condition || 'Good',
                details: `Asset '${asset.name}' with ID '${asset.assetId}' was created.`
            }
        });

        if (newUserId) {
            await prisma.handoverLog.create({
                data: {
                    assetId: asset.id,
                    userId: newUserId,
                    status: finalStatus === 'Assigned' ? 'Signed' : 'Pending',
                    signature: finalStatus === 'Assigned' ? 'Admin Confirmed Handover' : null,
                    condition: condition || null
                }
            });
        }

        if (data.assigneeType && data.assigneeId) {
            let assigneeName = '';
            if (data.assigneeType === 'User') {
                const u = await prisma.user.findUnique({ where: { id: data.assigneeId } });
                assigneeName = u ? u.name : 'Unknown User';
            } else if (data.assigneeType === 'Department') {
                const d = await prisma.department.findUnique({ where: { id: data.assigneeId } });
                assigneeName = d ? d.name : 'Unknown Department';
            } else if (data.assigneeType === 'Branch') {
                const b = await prisma.branch.findUnique({ where: { id: data.assigneeId } });
                assigneeName = b ? b.name : 'Unknown Branch';
            }
            await prisma.assetHistory.create({
                data: {
                    assetId: asset.id,
                    userId: actionUserId,
                    event: 'Assigned',
                    details: `Assigned to ${data.assigneeType === 'User' ? assigneeName : `${data.assigneeType}: ${assigneeName}`}.${condition ? ` Condition: ${condition}.` : ''}`
                }
            });
        }

        res.json(asset);
    } catch (error) {
        console.error('Error creating asset:', error);
        res.status(500).json({ error: 'Failed to create asset' });
    }
});

router.put('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const validation = assetSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const data = validation.data;
        const existingAsset = await prisma.asset.findUnique({ where: { id: Number(id) } });
        if (!existingAsset) return res.status(404).json({ error: 'Asset not found' });
        
        const { condition, wipeDetails, ...assetUpdateData } = data;

        // Auto-populate serialNumber from specs.serviceTag if serialNumber is missing/blank
        if (!assetUpdateData.serialNumber || assetUpdateData.serialNumber.trim() === '') {
            let serviceTagVal: string | null = null;
            const specsToCheck = assetUpdateData.specs || existingAsset.specs;
            if (specsToCheck) {
                if (typeof specsToCheck === 'object' && specsToCheck.serviceTag) {
                    serviceTagVal = String(specsToCheck.serviceTag).trim();
                } else if (typeof specsToCheck === 'string') {
                    try {
                        const parsed = JSON.parse(specsToCheck);
                        if (parsed.serviceTag) serviceTagVal = String(parsed.serviceTag).trim();
                    } catch (_) {}
                }
            }
            if (serviceTagVal) {
                assetUpdateData.serialNumber = serviceTagVal;
            }
        }

        const newUserId = assetUpdateData.assigneeType === 'User' ? assetUpdateData.assigneeId : null;

        let finalStatus = assetUpdateData.status;
        if (newUserId && existingAsset && existingAsset.userId !== newUserId) {
            // New assignment!
            if (assetUpdateData.status === 'Assigned') {
                await prisma.handoverLog.create({
                    data: {
                        assetId: Number(id),
                        userId: newUserId,
                        status: 'Signed',
                        signature: 'Admin Confirmed Handover',
                        condition: condition || null
                    }
                });
                finalStatus = 'Assigned';
            } else {
                await prisma.handoverLog.create({
                    data: {
                        assetId: Number(id),
                        userId: newUserId,
                        status: 'Pending',
                        condition: condition || null
                    }
                });
                finalStatus = 'Pending Handover';
            }
        } else if (assetUpdateData.status === 'Assigned' && existingAsset.status === 'Pending Handover') {
            // Admin explicitly confirms handover / changes status to Assigned
            await prisma.handoverLog.updateMany({
                where: {
                    assetId: Number(id),
                    status: 'Pending'
                },
                data: {
                    status: 'Signed',
                    signature: 'Admin Confirmed Handover'
                }
            });
            finalStatus = 'Assigned';
        } else if (finalStatus !== 'Pending Handover' && existingAsset.status === 'Pending Handover') {
            // Cancelled or returned while pending handover
            await prisma.handoverLog.updateMany({
                where: {
                    assetId: Number(id),
                    status: 'Pending'
                },
                data: {
                    status: 'Rejected'
                }
            });
        }

        const updatedCompany = assetUpdateData.company || existingAsset.company || (assetUpdateData.assetId ? assetUpdateData.assetId.split('-')[0] : (existingAsset.assetId ? existingAsset.assetId.split('-')[0] : null));

        // Auto-derive effective location from assignee
        let effectiveLocation = assetUpdateData.location;
        const isAssigneeChanging = (newUserId && existingAsset.userId !== newUserId) || 
                                   (assetUpdateData.assigneeId && assetUpdateData.assigneeId !== existingAsset.assigneeId) ||
                                   (!assetUpdateData.assigneeId && !newUserId && (existingAsset.assigneeId || existingAsset.userId));
        
        if (!effectiveLocation || effectiveLocation.trim() === '' || isAssigneeChanging) {
            if (newUserId) {
                const u = await prisma.user.findUnique({ where: { id: newUserId }, include: { branch: true } });
                effectiveLocation = u?.location || (typeof u?.branch === 'object' ? u?.branch?.name : null) || 'Remote / Field';
            } else if (assetUpdateData.assigneeType === 'Branch' && assetUpdateData.assigneeId) {
                const b = await prisma.branch.findUnique({ where: { id: assetUpdateData.assigneeId } });
                effectiveLocation = b?.location || b?.name || 'Branch';
            } else if (assetUpdateData.assigneeType === 'Department' && assetUpdateData.assigneeId) {
                const d = await prisma.department.findUnique({ where: { id: assetUpdateData.assigneeId } });
                effectiveLocation = d?.name || 'Department';
            } else if (!assetUpdateData.assigneeId && !newUserId) {
                effectiveLocation = 'In Stock';
            }
        }

        const asset = await prisma.asset.update({
            where: { id: Number(id) },
            data: { 
                ...assetUpdateData, 
                location: effectiveLocation,
                company: updatedCompany,
                status: finalStatus,
                condition: condition !== undefined ? (condition || 'Good') : (existingAsset.condition || 'Good'),
                specs: assetUpdateData.specs ? (typeof assetUpdateData.specs === 'string' ? assetUpdateData.specs : JSON.stringify(assetUpdateData.specs)) : null,
                userId: newUserId 
            } as any
        });

        // @ts-ignore
        const actionUserId = req.user.id;
        
        // Log wipe event if provided
        let loggedAny = false;
        if (wipeDetails) {
            await prisma.assetHistory.create({
                data: {
                    assetId: asset.id,
                    userId: actionUserId,
                    event: 'Data Wiped',
                    details: wipeDetails,
                    condition: condition || null
                }
            });
            loggedAny = true;
        }

        // Check for assignee change (case-insensitive on assigneeType)
        const oldType = existingAsset.assigneeType ? existingAsset.assigneeType.toLowerCase() : null;
        const newType = data.assigneeType ? data.assigneeType.toLowerCase() : null;
        const oldId = existingAsset.assigneeId ?? null;
        const newId = data.assigneeId ?? null;
        const assigneeChanged = oldType !== newType || oldId !== newId;

        if (assigneeChanged) {
            if (data.assigneeType && data.assigneeId) {
                let assigneeName = '';
                if (data.assigneeType === 'User') {
                    const u = await prisma.user.findUnique({ where: { id: data.assigneeId } });
                    assigneeName = u ? u.name : 'Unknown User';
                } else if (data.assigneeType === 'Department') {
                    const d = await prisma.department.findUnique({ where: { id: data.assigneeId } });
                    assigneeName = d ? d.name : 'Unknown Department';
                } else if (data.assigneeType === 'Branch') {
                    const b = await prisma.branch.findUnique({ where: { id: data.assigneeId } });
                    assigneeName = b ? b.name : 'Unknown Branch';
                }
                await prisma.assetHistory.create({
                    data: {
                        assetId: asset.id,
                        userId: actionUserId,
                        event: 'Assigned',
                        details: `Assigned to ${data.assigneeType === 'User' ? assigneeName : `${data.assigneeType}: ${assigneeName}`}.${condition ? ` Condition: ${condition}.` : ''}`,
                        condition: condition || null
                    }
                });
                loggedAny = true;
            } else if (!data.assigneeType && !data.assigneeId && (existingAsset.assigneeType || existingAsset.assigneeId || existingAsset.userId)) {
                let prevAssigneeName = '';
                if (existingAsset.assigneeType === 'User' || existingAsset.userId) {
                    const prevUserId = existingAsset.assigneeId || existingAsset.userId;
                    if (prevUserId) {
                        const u = await prisma.user.findUnique({ where: { id: prevUserId } });
                        prevAssigneeName = u ? u.name : `User #${prevUserId}`;
                    }
                } else if (existingAsset.assigneeType === 'Department' && existingAsset.assigneeId) {
                    const d = await prisma.department.findUnique({ where: { id: existingAsset.assigneeId } });
                    prevAssigneeName = d ? `Department: ${d.name}` : `Department #${existingAsset.assigneeId}`;
                } else if (existingAsset.assigneeType === 'Branch' && existingAsset.assigneeId) {
                    const b = await prisma.branch.findUnique({ where: { id: existingAsset.assigneeId } });
                    prevAssigneeName = b ? `Branch: ${b.name}` : `Branch #${existingAsset.assigneeId}`;
                }

                const detailParts = [
                    prevAssigneeName ? `Asset returned/unassigned from ${prevAssigneeName}.` : 'Asset was unassigned manually.',
                    condition ? `Condition: ${condition}.` : null,
                    assetUpdateData.remarks ? `Remarks: ${assetUpdateData.remarks}` : null
                ].filter(Boolean);

                await prisma.assetHistory.create({
                    data: {
                        assetId: asset.id,
                        userId: actionUserId,
                        event: 'Unassigned',
                        details: detailParts.join(' '),
                        condition: condition || null
                    }
                });
                loggedAny = true;
            }
        }

        // Check for status change independently so both assignee change & status change are logged
        if (existingAsset.status !== asset.status) {
            await prisma.assetHistory.create({
                data: {
                    assetId: asset.id,
                    userId: actionUserId,
                    event: 'Status Changed',
                    details: `Status changed from '${existingAsset.status}' to '${asset.status}'.${condition ? ` Condition: ${condition}.` : ''}`,
                    condition: condition || null
                }
            });
            loggedAny = true;
        }

        // If no specific event was triggered, log generic update
        if (!loggedAny) {
            await prisma.assetHistory.create({
                data: {
                    assetId: asset.id,
                    userId: actionUserId,
                    event: 'Asset Updated',
                    details: condition ? `Asset details updated. Condition: ${condition}` : 'Asset details were updated.',
                    condition: condition || null
                }
            });
        }

        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update asset' });
    }
});

// GET /api/assets/:id/history - Full history for a specific asset
router.get('/api/assets/:id/history', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const assetId = Number(id);
        if (isNaN(assetId)) {
            return res.status(400).json({ error: 'Invalid asset ID' });
        }

        // @ts-ignore
        const { role, id: requestingUserId } = req.user;

        // Authorization check for non-Admins
        if (role !== 'Admin') {
            const asset = await prisma.asset.findUnique({
                where: { id: assetId },
                include: { user: true }
            });
            if (!asset) return res.status(404).json({ error: 'Asset not found' });

            if (role === 'Manager') {
                const manager = await prisma.user.findUnique({ where: { id: requestingUserId } });
                const isAuthorized = asset.userId === requestingUserId ||
                    asset.user?.managerId === requestingUserId ||
                    (manager?.departmentId && asset.user?.departmentId === manager.departmentId);
                if (!isAuthorized) {
                    return res.status(403).json({ error: 'Unauthorized to view this asset history' });
                }
            } else {
                // Regular User
                if (asset.userId !== requestingUserId) {
                    return res.status(403).json({ error: 'Unauthorized to view this asset history' });
                }
            }
        }

        const userSelect = { select: { id: true, name: true, email: true, role: true } };
        const history = await prisma.assetHistory.findMany({
            where: { assetId },
            include: { user: userSelect },
            orderBy: { timestamp: 'desc' }
        });

        res.json(history);
    } catch (error) {
        console.error('Failed to fetch asset history:', error);
        res.status(500).json({ error: 'Failed to fetch asset history' });
    }
});

router.delete('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.asset.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete asset' });
    }
});

// ==========================================
// --- ASSET SERVICE & MAINTENANCE ROUTES ---
// ==========================================

async function generateNextServiceId(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = "SRV-" + currentYear + "-";
    const latestRecord = await prisma.serviceRecord.findFirst({
        where: { serviceId: { startsWith: prefix } },
        orderBy: { id: "desc" },
        select: { serviceId: true }
    });
    let nextNum = 1;
    if (latestRecord && latestRecord.serviceId) {
        const parts = latestRecord.serviceId.split("-");
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) nextNum = lastSeq + 1;
    }
    return prefix + String(nextNum).padStart(4, "0");
}

// GET /api/assets/:id/services - Fetch all service records for a specific asset

router.get('/api/history', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let history;

        const userSelect = { select: { id: true, name: true, email: true, role: true } };

        if (role === 'Admin') {
            history = await prisma.assetHistory.findMany({
                include: { user: userSelect, asset: { select: { id: true, assetId: true, name: true, category: true } } },
                orderBy: { timestamp: 'desc' },
                take: 200
            });
        } else if (role === 'Manager') {
            const user = await prisma.user.findUnique({ where: { id } });
            history = await prisma.assetHistory.findMany({
                where: {
                    OR: [
                        { userId: id },
                        { asset: { userId: id } },
                        { asset: { user: { managerId: id } } },
                        { asset: { user: { departmentId: user?.departmentId || -1 } } }
                    ]
                },
                include: { user: userSelect, asset: { select: { id: true, assetId: true, name: true, category: true } } },
                orderBy: { timestamp: 'desc' },
                take: 100
            });
        } else {
            history = await prisma.assetHistory.findMany({
                where: {
                    OR: [
                        { userId: id },
                        { asset: { userId: id } }
                    ]
                },
                include: { user: userSelect, asset: { select: { id: true, assetId: true, name: true, category: true } } },
                orderBy: { timestamp: 'desc' },
                take: 50
            });
        }

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

router.post('/api/history', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // @ts-ignore
        const { id: userId } = req.user;
        const { assetId, event, details, condition } = req.body;
        const entry = await prisma.assetHistory.create({
            data: { assetId: Number(assetId), userId, event, details, condition: condition || null }
        });
        res.status(201).json(entry);
    } catch (error) {
        res.status(500).json({ error: 'Failed to log history' });
    }
});

// --- Licenses Routes ---

export default router;
