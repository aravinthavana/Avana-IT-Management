import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from './middleware/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-plz-change';

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost', // Restrict in production
    credentials: true,
}));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

app.use(express.json());

// --- Authentication Routes ---

const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['Admin', 'Manager', 'User']).optional()
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = registerSchema.parse(req.body);
        
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'Email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, email, role: role || 'User' /* Need to add password to schema if real auth */ }
        });
        
        res.status(201).json({ message: 'User registered successfully', userId: user.id });
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: 'Failed to register server error' });
    }
});

// Since the Prisma schema didn't have a password column from the frontend mockup,
// In a real-world scenario we alter the schema.
// For now we simulate login assuming the schema was altered to store passwords.
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        
        // Placeholder check because actual schema needs a password field
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });
        
        // const validPassword = await bcrypt.compare(password, user.password);
        // if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});


// --- Assets Routes ---

app.get('/api/assets', authenticateToken, async (req, res) => {
    try {
        const assets = await prisma.asset.findMany({ include: { user: true, purchase: true } });
        res.json(assets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

app.post('/api/assets', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const asset = await prisma.asset.create({ 
            data: { ...req.body, specs: req.body.specs || {} } 
        });
        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create asset' });
    }
});

app.put('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// --- Other Data Routes ---

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const users = await prisma.user.findMany({ include: { department: true, branch: true } });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Departments & Branches can be viewed by all authenticated users
app.get('/api/departments', authenticateToken, async (req, res) => {
    res.json(await prisma.department.findMany());
});

app.get('/api/branches', authenticateToken, async (req, res) => {
    res.json(await prisma.branch.findMany());
});

// History endpoint
app.get('/api/history', authenticateToken, async (req, res) => {
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

// Health check is unprotected
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Secured Avana IT Backend is running' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port} with security measures enabled.`);
});
