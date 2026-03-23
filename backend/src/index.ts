import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Users
app.get('/api/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({ include: { department: true, branch: true } });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const user = await prisma.user.create({ data: req.body });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save user' });
    }
});

// Departments
app.get('/api/departments', async (req, res) => {
    try {
        const departments = await prisma.department.findMany();
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
});

// Branches
app.get('/api/branches', async (req, res) => {
    try {
        const branches = await prisma.branch.findMany();
        res.json(branches);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

// Assets
app.get('/api/assets', async (req, res) => {
    try {
        const assets = await prisma.asset.findMany({
            include: { user: true, purchase: true }
        });
        res.json(assets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

app.post('/api/assets', async (req, res) => {
    try {
        const asset = await prisma.asset.create({ 
            data: {
                ...req.body,
                specs: req.body.specs || {}
            } 
        });
        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create asset' });
    }
});

app.put('/api/assets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await prisma.asset.update({
            where: { id: Number(id) },
            data: req.body
        });
        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update asset' });
    }
});

// History
app.get('/api/history', async (req, res) => {
    try {
        const history = await prisma.assetHistory.findMany({
            include: { user: true },
            orderBy: { timestamp: 'desc' }
        });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.post('/api/history', async (req, res) => {
    try {
        const history = await prisma.assetHistory.create({ data: req.body });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to log history' });
    }
});

// Purchases
app.get('/api/purchases', async (req, res) => {
    try {
        const purchases = await prisma.purchaseRecord.findMany();
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch purchases' });
    }
});


// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Avana IT Backend is running' });
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
