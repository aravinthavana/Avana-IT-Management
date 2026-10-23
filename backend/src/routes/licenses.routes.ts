import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { licenseSchema } from '../schemas';

const router = Router();

router.get('/api/licenses', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role } = req.user;
        const licenses = await prisma.license.findMany({ 
            include: { 
                assignments: { 
                    include: { 
                        user: { select: { id: true, name: true, email: true } }, 
                        asset: { select: { id: true, assetId: true, name: true } } 
                    } 
                } 
            } 
        });

        // Security: Non-admin users cannot see raw product license keys
        const sanitized = licenses.map(l => {
            if (role !== 'Admin') {
                const { key, ...rest } = l;
                return { ...rest, key: null };
            }
            return l;
        });

        res.json(sanitized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch licenses' });
    }
});

router.post('/api/licenses', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = licenseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const license = await prisma.license.create({ data: validation.data });
        res.json(license);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create license' });
    }
});

router.put('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const validation = licenseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const license = await prisma.license.update({ 
            where: { id: Number(id) }, 
            data: validation.data 
        });
        res.json(license);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update license' });
    }
});

router.delete('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.license.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete license' });
    }
});

// --- License Assignments ---
router.post('/api/license-assignments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { licenseId, userId, assetId } = req.body;
        if (!licenseId) return res.status(400).json({ error: 'License ID is required' });

        const license = await prisma.license.findUnique({
            where: { id: Number(licenseId) },
            include: { assignments: true }
        });

        if (!license) return res.status(404).json({ error: 'License not found' });

        // Enforce seat limit
        if (license.assignments.length >= license.seats) {
            return res.status(400).json({ error: `Seat limit reached. All ${license.seats} seat(s) for "${license.name}" are assigned.` });
        }

        // Duplicate assignment prevention
        if (userId && license.assignments.some(a => a.userId === Number(userId))) {
            return res.status(400).json({ error: 'This user is already assigned to this license.' });
        }
        if (assetId && license.assignments.some(a => a.assetId === Number(assetId))) {
            return res.status(400).json({ error: 'This asset is already assigned to this license.' });
        }

        const assignment = await prisma.licenseAssignment.create({ 
            data: { 
                licenseId: Number(licenseId), 
                userId: userId ? Number(userId) : null, 
                assetId: assetId ? Number(assetId) : null 
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                asset: { select: { id: true, assetId: true, name: true } }
            }
        });
        res.status(201).json(assignment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to assign license' });
    }
});

router.delete('/api/license-assignments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.licenseAssignment.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove license assignment' });
    }
});

// --- Asset Requests ---

export default router;
