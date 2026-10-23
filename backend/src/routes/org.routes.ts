import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/api/departments', authenticateToken, async (req, res) => {
    res.json(await prisma.department.findMany({ orderBy: { name: 'asc' } }));
});

router.post('/api/departments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Department name is required' });
        }
        const trimmedName = name.trim();
        const existing = await prisma.department.findFirst({
            where: { name: { equals: trimmedName, mode: 'insensitive' } }
        });
        if (existing) {
            return res.status(409).json({ error: 'A department with this name already exists' });
        }
        const dept = await prisma.department.create({ data: { name: trimmedName } });
        res.status(201).json(dept);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create department' });
    }
});

router.put('/api/departments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Department name is required' });
        }
        const trimmedName = name.trim();
        const existing = await prisma.department.findFirst({
            where: { name: { equals: trimmedName, mode: 'insensitive' }, NOT: { id: Number(id) } }
        });
        if (existing) {
            return res.status(409).json({ error: 'Another department with this name already exists' });
        }
        const dept = await prisma.department.update({ where: { id: Number(id) }, data: { name: trimmedName } });
        res.json(dept);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update department' });
    }
});

router.delete('/api/departments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Check for users in this department
        const usersInDept = await prisma.user.count({ where: { departmentId: Number(id) } });
        if (usersInDept > 0) {
            return res.status(400).json({ error: 'Cannot delete department as it has users assigned to it.' });
        }
        await prisma.department.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete department' });
    }
});

// --- Branches Routes ---

router.get('/api/branches', authenticateToken, async (req, res) => {
    res.json(await prisma.branch.findMany({ orderBy: { name: 'asc' } }));
});

router.post('/api/branches', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, location } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Branch name is required' });
        }
        const trimmedName = name.trim();
        const existing = await prisma.branch.findFirst({
            where: { name: { equals: trimmedName, mode: 'insensitive' } }
        });
        if (existing) {
            return res.status(409).json({ error: 'A branch with this name already exists' });
        }
        const branch = await prisma.branch.create({ data: { name: trimmedName, location: location ? location.trim() : null } });
        res.status(201).json(branch);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create branch' });
    }
});

router.put('/api/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Branch name is required' });
        }
        const trimmedName = name.trim();
        const existing = await prisma.branch.findFirst({
            where: { name: { equals: trimmedName, mode: 'insensitive' }, NOT: { id: Number(id) } }
        });
        if (existing) {
            return res.status(409).json({ error: 'Another branch with this name already exists' });
        }
        const branch = await prisma.branch.update({ where: { id: Number(id) }, data: { name: trimmedName, location: location ? location.trim() : null } });
        res.json(branch);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update branch' });
    }
});

router.delete('/api/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const usersInBranch = await prisma.user.count({ where: { branchId: Number(id) } });
        if (usersInBranch > 0) {
            return res.status(400).json({ error: 'Cannot delete branch as it has users assigned to it.' });
        }
        await prisma.branch.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete branch' });
    }
});

// --- Purchases Routes ---


export default router;
