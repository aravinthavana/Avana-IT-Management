import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { purchaseSchema } from '../schemas';

const router = Router();

router.get('/api/purchases', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role } = req.user;
        if (role !== 'Admin' && role !== 'Manager') {
            return res.status(403).json({ error: 'Access denied. Purchase and financial records are restricted to Admins and Managers.' });
        }
        const purchases = await prisma.purchaseRecord.findMany({
            include: { assets: true },
            orderBy: { purchaseDate: 'desc' }
        });
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch purchases' });
    }
});

router.post('/api/purchases', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = purchaseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const purchase = await prisma.purchaseRecord.create({ data: validation.data });
        res.status(201).json(purchase);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create purchase' });
    }
});

router.put('/api/purchases/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const validation = purchaseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const purchase = await prisma.purchaseRecord.update({ 
            where: { id: Number(id) }, 
            data: validation.data 
        });
        res.json(purchase);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update purchase' });
    }
});

router.delete('/api/purchases/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.purchaseRecord.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete purchase' });
    }
});

// --- Asset History ---

export default router;
