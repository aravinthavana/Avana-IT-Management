import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/api/kb', authenticateToken, async (req, res) => {
    try {
        const articles = await prisma.knowledgeBase.findMany({
            include: { author: { select: { name: true } } },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch KB articles' });
    }
});

router.post('/api/kb', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // @ts-ignore
        const { id } = req.user;
        const { title, category, content } = req.body;
        
        const article = await prisma.knowledgeBase.create({
            data: {
                title,
                category,
                content,
                authorId: id
            }
        });
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create KB article' });
    }
});

router.put('/api/kb/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, category, content } = req.body;
        
        const article = await prisma.knowledgeBase.update({
            where: { id: Number(id) },
            data: { title, category, content }
        });
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update KB article' });
    }
});

router.delete('/api/kb/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.knowledgeBase.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete KB article' });
    }
});

// --- Self Audits ---


export default router;
