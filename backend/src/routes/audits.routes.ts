import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendSelfAuditEmail } from '../utils/email';

const router = Router();

router.get('/api/self-audits', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let audits;

        const baseInclude = {
            user: { 
                select: { 
                    id: true, 
                    name: true, 
                    email: true, 
                    company: true, 
                    department: { select: { id: true, name: true } }, 
                    employeeId: true,
                    jobTitle: true 
                } 
            },
            asset: {
                select: {
                    id: true,
                    assetId: true,
                    name: true,
                    category: true,
                    brand: true,
                    model: true,
                    serialNumber: true,
                    company: true,
                    status: true,
                    condition: true,
                    lastAuditedAt: true
                }
            },
            requestedBy: { select: { id: true, name: true, email: true } },
            reviewedBy: { select: { id: true, name: true, email: true } }
        };

        if (role === 'Admin') {
            audits = await prisma.selfAudit.findMany({
                include: baseInclude,
                orderBy: { auditDate: 'desc' }
            });
        } else {
            audits = await prisma.selfAudit.findMany({
                where: { userId: id },
                include: baseInclude,
                orderBy: { auditDate: 'desc' }
            });
        }
        res.json(audits);
    } catch (error) {
        console.error('Failed to fetch self audits:', error);
        res.status(500).json({ error: 'Failed to fetch self audits' });
    }
});

// Admin-Only: Assign Self-Audit to specific employees/assets
router.post('/api/self-audits/assign', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // @ts-ignore
        const { id: adminId } = req.user;
        const { assignments, dueDate, instructions, notifyEmail } = req.body;

        if (!Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({ error: 'At least one employee/asset assignment is required.' });
        }

        const parsedDueDate = dueDate ? new Date(dueDate) : null;
        const createdAudits = [];

        for (const item of assignments) {
            const { userId, assetId } = item;
            if (!userId || !assetId) continue;

            // Check if there is already an active "Requested" or "Pending Review" audit
            const existing = await prisma.selfAudit.findFirst({
                where: {
                    userId: Number(userId),
                    assetId: Number(assetId),
                    status: { in: ['Requested', 'Pending Review'] }
                }
            });

            let audit;
            if (existing) {
                audit = await prisma.selfAudit.update({
                    where: { id: existing.id },
                    data: {
                        status: 'Requested',
                        requestedById: adminId,
                        requestedAt: new Date(),
                        dueDate: parsedDueDate,
                        adminRemarks: instructions || null
                    },
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                        asset: true
                    }
                });
            } else {
                audit = await prisma.selfAudit.create({
                    data: {
                        userId: Number(userId),
                        assetId: Number(assetId),
                        status: 'Requested',
                        requestedById: adminId,
                        requestedAt: new Date(),
                        dueDate: parsedDueDate,
                        adminRemarks: instructions || null
                    },
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                        asset: true
                    }
                });
            }
            createdAudits.push(audit);

            // Send notification email to employee
            if (notifyEmail && audit.user?.email && audit.asset) {
                const formattedDate = parsedDueDate ? parsedDueDate.toLocaleDateString() : 'within 7 days';
                sendSelfAuditEmail({
                    toEmail: audit.user.email,
                    toName: audit.user.name,
                    auditId: audit.id,
                    assetName: audit.asset.name,
                    assetIdTag: audit.asset.assetId,
                    actionType: 'ASSIGNED',
                    actionTitle: 'IT Equipment Self-Audit Required',
                    actionMessage: `IT Administration has scheduled a physical & functional verification for your assigned equipment. Please log in to the portal and complete your verification by ${formattedDate}.`,
                    dueDate: formattedDate,
                    instructions: instructions || undefined
                }).catch(e => console.error('[SelfAudit Assign Email Error]', e));
            }
        }

        res.status(201).json({ success: true, count: createdAudits.length, audits: createdAudits });
    } catch (error) {
        console.error('Failed to assign self audits:', error);
        res.status(500).json({ error: 'Failed to assign self audits' });
    }
});

// Employee submission
router.post('/api/self-audits', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id: userId, role } = req.user;
        const { assetId, scannedAssetId, imageUrl, userRemarks, remarks, location, condition, hardwareChecks } = req.body;

        const asset = await prisma.asset.findUnique({ where: { id: Number(assetId) } });
        if (!asset) return res.status(404).json({ error: 'Asset not found.' });

        // Security check: Only assigned user (or Admin) can submit
        const isAssigned = asset.userId === userId || (asset.assigneeType === 'User' && asset.assigneeId === userId);
        if (role !== 'Admin' && !isAssigned) {
            return res.status(403).json({ error: 'Access denied. You can only submit audits for assets assigned to you.' });
        }

        // Check if there's an existing 'Requested' audit for this asset/user
        const existingRequested = await prisma.selfAudit.findFirst({
            where: {
                userId: Number(userId),
                assetId: Number(assetId),
                status: 'Requested'
            }
        });

        const effectiveUserRemarks = userRemarks || remarks || null;
        const hwChecksString = typeof hardwareChecks === 'object' ? JSON.stringify(hardwareChecks) : hardwareChecks;

        let audit;
        if (existingRequested) {
            audit = await prisma.selfAudit.update({
                where: { id: existingRequested.id },
                data: {
                    scannedAssetId,
                    imageUrl,
                    userRemarks: effectiveUserRemarks,
                    remarks: effectiveUserRemarks,
                    location: location || null,
                    condition: condition || null,
                    hardwareChecks: hwChecksString || null,
                    status: 'Pending Review',
                    submittedAt: new Date(),
                    auditDate: new Date()
                },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    asset: true
                }
            });
        } else {
            audit = await prisma.selfAudit.create({
                data: {
                    assetId: Number(assetId),
                    userId: Number(userId),
                    scannedAssetId,
                    imageUrl,
                    userRemarks: effectiveUserRemarks,
                    remarks: effectiveUserRemarks,
                    location: location || null,
                    condition: condition || null,
                    hardwareChecks: hwChecksString || null,
                    status: 'Pending Review',
                    submittedAt: new Date(),
                    auditDate: new Date()
                },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    asset: true
                }
            });
        }

        res.status(201).json(audit);
    } catch (error) {
        console.error('Failed to submit self audit:', error);
        res.status(500).json({ error: 'Failed to submit self audit' });
    }
});

// Admin review / approval / rejection / escalation
router.put('/api/self-audits/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // @ts-ignore
        const { id: reviewerId } = req.user;
        const { id } = req.params;
        const { status, adminRemarks, rejectionReason, createTicket, ticketSubject, ticketDescription, ticketPriority } = req.body;

        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be Approved or Rejected.' });
        }

        const existingAudit = await prisma.selfAudit.findUnique({
            where: { id: Number(id) },
            include: { user: true, asset: true }
        });

        if (!existingAudit) {
            return res.status(404).json({ error: 'Self-audit not found.' });
        }

        let createdTicketId: number | null = null;

        // If Admin requests escalation to Support Ticket for defective equipment
        if (createTicket && existingAudit.userId && existingAudit.assetId) {
            const ticket = await prisma.supportTicket.create({
                data: {
                    userId: existingAudit.userId,
                    assetId: existingAudit.assetId,
                    subject: ticketSubject || `Defect Reported via Self-Audit: ${existingAudit.asset.name}`,
                    description: ticketDescription || `An equipment issue was identified during self-audit.\nReported Condition: ${existingAudit.condition || 'N/A'}\nLocation: ${existingAudit.location || 'N/A'}\nUser Remarks: ${existingAudit.userRemarks || 'None'}\nAdmin Note: ${adminRemarks || 'Follow-up required'}`,
                    priority: ticketPriority || 'High',
                    category: 'Hardware',
                    status: 'Open'
                }
            });
            createdTicketId = ticket.id;
        }

        const updatedAudit = await prisma.selfAudit.update({
            where: { id: Number(id) },
            data: { 
                status,
                adminRemarks: adminRemarks || null,
                rejectionReason: status === 'Rejected' ? (rejectionReason || adminRemarks || null) : null,
                reviewedById: reviewerId,
                reviewedAt: new Date(),
                ...(createdTicketId && { ticketId: createdTicketId })
            },
            include: {
                user: { select: { id: true, name: true, email: true, company: true } },
                asset: true,
                reviewedBy: { select: { id: true, name: true, email: true } },
                requestedBy: { select: { id: true, name: true, email: true } }
            }
        });

        // On Approval, update Asset condition, lastAuditedAt, and log AssetHistory
        if (status === 'Approved') {
            await prisma.asset.update({
                where: { id: existingAudit.assetId },
                data: {
                    ...(existingAudit.condition && { condition: existingAudit.condition }),
                    lastAuditedAt: new Date()
                }
            });

            await prisma.assetHistory.create({
                data: {
                    assetId: existingAudit.assetId,
                    userId: reviewerId,
                    event: 'Self-Audit Approved',
                    details: `IT Admin verified equipment health. Condition: ${existingAudit.condition || 'Good'}.${adminRemarks ? ` Notes: ${adminRemarks}` : ''}`,
                    condition: existingAudit.condition || 'Good'
                }
            });
        }

        // Send email feedback to employee
        if (existingAudit.user && existingAudit.user.email && existingAudit.asset) {
            sendSelfAuditEmail({
                toEmail: existingAudit.user.email,
                toName: existingAudit.user.name,
                auditId: existingAudit.id,
                assetName: existingAudit.asset.name,
                assetIdTag: existingAudit.asset.assetId,
                actionType: status === 'Approved' ? 'APPROVED' : 'REJECTED',
                actionTitle: status === 'Approved' ? 'Self-Audit Verification Approved' : 'Self-Audit Verification Rejected',
                actionMessage: status === 'Approved'
                    ? 'Thank you! Your equipment self-audit submission has been reviewed and verified by IT Administration.'
                    : 'Your equipment self-audit was reviewed by IT Administration but could not be accepted.',
                rejectionReason: rejectionReason || adminRemarks || undefined,
                adminRemarks: adminRemarks || undefined
            }).catch(e => console.error('[Audit Decision Email Error]', e));
        }

        res.json(updatedAudit);
    } catch (error) {
        console.error('Failed to update self audit status:', error);
        res.status(500).json({ error: 'Failed to update self audit status' });
    }
});

// --- Asset Declarations & Reconciliation Routes ---

// GET /api/asset-declarations
router.get('/api/asset-declarations', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id, role } = req.user;
        const baseInclude = {
            user: { select: { id: true, name: true, email: true, company: true, department: true, location: true } },
            audit: { select: { id: true, assetId: true, status: true, asset: true } },
            reconciledBy: { select: { id: true, name: true, email: true } }
        };

        let declarations;
        if (role === 'Admin') {
            declarations = await prisma.assetDeclaration.findMany({
                include: baseInclude,
                orderBy: { createdAt: 'desc' }
            });
        } else {
            declarations = await prisma.assetDeclaration.findMany({
                where: { userId: id },
                include: baseInclude,
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json(declarations);
    } catch (error) {
        console.error('Failed to fetch asset declarations:', error);
        res.status(500).json({ error: 'Failed to fetch asset declarations' });
    }
});

// POST /api/asset-declarations (Employee submits declared gear, ghost audits, and discrepancy notes)
router.post('/api/asset-declarations', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id: userId } = req.user;
        const { hasAssets, selectedTypes, declaredItems, systemRecordsOk, discrepancyNotes, auditId } = req.body;

        const selectedTypesStr = typeof selectedTypes === 'object' ? JSON.stringify(selectedTypes) : (selectedTypes || '[]');
        const declaredItemsStr = typeof declaredItems === 'object' ? JSON.stringify(declaredItems) : (declaredItems || '[]');

        const parsedItems = Array.isArray(declaredItems) ? declaredItems : [];
        const hasGhosts = parsedItems.some((it: any) => it.isGhost);
        const status = (!systemRecordsOk || hasGhosts) ? 'Pending Review' : 'Pending Review';

        const declaration = await prisma.assetDeclaration.create({
            data: {
                userId: Number(userId),
                hasAssets: Boolean(hasAssets),
                selectedTypes: selectedTypesStr,
                declaredItems: declaredItemsStr,
                systemRecordsOk: Boolean(systemRecordsOk),
                discrepancyNotes: discrepancyNotes || null,
                auditId: auditId ? Number(auditId) : null,
                status
            },
            include: {
                user: { select: { id: true, name: true, email: true, company: true } },
                audit: true
            }
        });

        res.status(201).json(declaration);
    } catch (error) {
        console.error('Failed to submit asset declaration:', error);
        res.status(500).json({ error: 'Failed to submit asset declaration' });
    }
});

// POST /api/asset-declarations/:id/convert-ghost-asset (Admin 1-click registers an unrecorded asset into official inventory)
router.post('/api/asset-declarations/:id/convert-ghost-asset', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // @ts-ignore
        const { id: adminId } = req.user;
        const { id } = req.params;
        const { itemId, assetIdTag, category, company, location } = req.body;

        const declaration = await prisma.assetDeclaration.findUnique({
            where: { id: Number(id) },
            include: { user: true }
        });

        if (!declaration) {
            return res.status(404).json({ error: 'Asset declaration not found.' });
        }

        let items: any[] = [];
        try {
            items = JSON.parse(declaration.declaredItems || '[]');
        } catch (_) {}

        const itemIndex = items.findIndex((it: any) => it.id === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Declared item not found in this declaration.' });
        }

        const targetItem = items[itemIndex];
        const effectiveCompany = company || declaration.user?.company || 'AMD';
        const effectiveCategory = category || targetItem.category || 'Other';
        const effectiveLocation = location || targetItem.location || declaration.user?.location || 'Head Office';

        // Auto-generate tag if not provided
        let finalAssetTag = assetIdTag;
        if (!finalAssetTag || finalAssetTag.trim() === '') {
            const prefix = effectiveCompany.toUpperCase().slice(0, 3);
            const catCode = effectiveCategory.toUpperCase().slice(0, 3);
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            finalAssetTag = `${prefix}-${catCode}-${randomNum}`;
        }

        // 1. Create the official Asset in database
        const newAsset = await prisma.asset.create({
            data: {
                assetId: finalAssetTag.trim(),
                name: targetItem.name || `${effectiveCategory} Device`,
                category: effectiveCategory,
                brand: targetItem.brand || null,
                serialNumber: targetItem.serialNumber || null,
                company: effectiveCompany,
                location: effectiveLocation,
                condition: targetItem.condition || 'Good',
                status: 'Assigned',
                assigneeType: 'User',
                assigneeId: declaration.userId,
                userId: declaration.userId,
                lastAuditedAt: new Date()
            }
        });

        // 2. Create an Approved SelfAudit record for this asset using the ghost photo proof
        const selfAudit = await prisma.selfAudit.create({
            data: {
                assetId: newAsset.id,
                userId: declaration.userId,
                imageUrl: targetItem.imageUrl || null,
                condition: targetItem.condition || 'Good',
                location: effectiveLocation,
                status: 'Approved',
                reviewedById: adminId,
                reviewedAt: new Date(),
                adminRemarks: 'Auto-registered into official inventory from employee asset declaration. Condition and photo verified.'
            }
        });

        // 3. Log history
        await prisma.assetHistory.create({
            data: {
                assetId: newAsset.id,
                userId: adminId,
                event: 'Asset Created & Self-Audited',
                details: `Registered from employee asset declaration (#${declaration.id}). Assigned to ${declaration.user.name}.`,
                condition: targetItem.condition || 'Good'
            }
        });

        // 4. Update the item in declaration JSON
        items[itemIndex] = {
            ...targetItem,
            isGhost: false,
            convertedAssetId: newAsset.id,
            convertedAssetTag: newAsset.assetId,
            convertedAt: new Date().toISOString()
        };

        const updatedDeclaration = await prisma.assetDeclaration.update({
            where: { id: Number(id) },
            data: {
                declaredItems: JSON.stringify(items)
            },
            include: {
                user: { select: { id: true, name: true, email: true, company: true } },
                audit: true,
                reconciledBy: { select: { id: true, name: true, email: true } }
            }
        });

        res.json({ success: true, asset: newAsset, audit: selfAudit, declaration: updatedDeclaration });
    } catch (error) {
        console.error('Failed to convert ghost asset:', error);
        res.status(500).json({ error: 'Failed to convert ghost asset into inventory' });
    }
});

// PUT /api/asset-declarations/:id/reconcile (Admin marks declaration as reconciled)
router.put('/api/asset-declarations/:id/reconcile', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // @ts-ignore
        const { id: adminId } = req.user;
        const { id } = req.params;
        const { status, adminRemarks } = req.body;

        const declaration = await prisma.assetDeclaration.update({
            where: { id: Number(id) },
            data: {
                status: status || 'Reconciled',
                adminRemarks: adminRemarks || null,
                reconciledById: adminId,
                reconciledAt: new Date()
            },
            include: {
                user: { select: { id: true, name: true, email: true, company: true } },
                reconciledBy: { select: { id: true, name: true, email: true } },
                audit: true
            }
        });

        res.json(declaration);
    } catch (error) {
        console.error('Failed to reconcile asset declaration:', error);
        res.status(500).json({ error: 'Failed to reconcile asset declaration' });
    }
});

router.post('/api/asset-declarations/:id/reconcile-accessories', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { items } = req.body as {
            items: Array<{
                itemId: string;
                batchId?: number;
                category: string;
                name: string;
                brand?: string;
                serialNumber?: string;
                condition?: string;
                notes?: string;
            }>
        };

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No accessories specified to reconcile.' });
        }

        const declaration = await prisma.assetDeclaration.findUnique({
            where: { id: Number(id) },
            include: { user: true }
        });

        if (!declaration) {
            return res.status(404).json({ error: 'Asset declaration not found.' });
        }

        let existingDeclared: any[] = [];
        try {
            existingDeclared = JSON.parse(declaration.declaredItems || '[]');
        } catch (_) {}

        const createdAccessories = [];

        for (const it of items) {
            let pDate: Date | null = null;
            let wDate: Date | null = null;
            let brand = it.brand || null;
            let effectiveName = it.name || `${it.category} Accessory`;

            if (it.batchId) {
                const batch = await prisma.accessoryBatch.findUnique({ where: { id: Number(it.batchId) } });
                if (batch && batch.quantityAvailable > 0) {
                    pDate = batch.purchaseDate;
                    wDate = batch.warrantyEndDate;
                    brand = brand || batch.brand;
                    effectiveName = effectiveName || batch.name;

                    await prisma.accessoryBatch.update({
                        where: { id: batch.id },
                        data: { quantityAvailable: batch.quantityAvailable - 1 }
                    });
                }
            }

            const acc = await prisma.userAccessory.create({
                data: {
                    userId: declaration.userId,
                    batchId: it.batchId ? Number(it.batchId) : null,
                    category: it.category || 'Other',
                    name: effectiveName,
                    brand,
                    serialNumber: it.serialNumber || null,
                    purchaseDate: pDate,
                    warrantyEndDate: wDate,
                    condition: it.condition || 'Good',
                    notes: it.notes || 'Reconciled from employee self-audit discovery declaration.',
                    status: 'Assigned'
                },
                include: { batch: true }
            });
            createdAccessories.push(acc);

            // Mark this item as reconciled in declaration
            const matchIdx = existingDeclared.findIndex((d: any) => d.id === it.itemId);
            if (matchIdx !== -1) {
                existingDeclared[matchIdx].reconciled = true;
                existingDeclared[matchIdx].userAccessoryId = acc.id;
            }
        }

        // Update declaration record
        await prisma.assetDeclaration.update({
            where: { id: declaration.id },
            data: {
                declaredItems: JSON.stringify(existingDeclared)
            }
        });

        res.json({
            success: true,
            message: `Successfully saved ${createdAccessories.length} accessory(s) to ${declaration.user.name}'s profile.`,
            accessories: createdAccessories
        });
    } catch (error: any) {
        console.error('[Reconcile Accessories Error]:', error);
        res.status(500).json({ error: 'Failed to reconcile accessories' });
    }
});


export default router;
