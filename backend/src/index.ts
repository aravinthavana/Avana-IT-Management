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
import jwksClient from 'jwks-rsa';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined.');
    process.exit(1);
}

// --- Zod Schemas for Validation ---

const userSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6).optional().nullable(),
    role: z.enum(['Admin', 'Manager', 'User']).default('User'),
    status: z.enum(['Active', 'Inactive']).default('Active'),
    departmentId: z.number().nullable().optional(),
    branchId: z.number().nullable().optional(),
    managerId: z.number().nullable().optional(),
});

const assetSchema = z.object({
    assetId: z.string().min(3),
    name: z.string().min(2),
    category: z.string(),
    status: z.enum(['In Stock', 'Assigned', 'In Repair', 'Retired']).default('In Stock'),
    assigneeId: z.number().nullable().optional(),
    assigneeType: z.enum(['User', 'Department', 'Branch']).nullable().optional(),
    company: z.string().nullable().optional(),
    brand: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    serialNumber: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    purchaseId: z.number().nullable().optional(),
    warrantyType: z.string().nullable().optional(),
    warrantyStartDate: z.string().nullable().optional(),
    warrantyYears: z.string().nullable().optional(),
    warrantyEndDate: z.string().nullable().optional(),
    remarks: z.string().nullable().optional(),
    specs: z.any().nullable().optional(), // Parsed JSON
});

const purchaseSchema = z.object({
    invoiceNumber: z.string().min(1),
    purchaseDate: z.string(),
    vendor: z.string().nullable().optional(),
    amount: z.number().nullable().optional(),
    poNumber: z.string().nullable().optional(),
    invoiceAttachmentUrl: z.string().nullable().optional(),
    invoiceAttachmentFilename: z.string().nullable().optional(),
    poAttachmentUrl: z.string().nullable().optional(),
    poAttachmentFilename: z.string().nullable().optional(),
});

const licenseSchema = z.object({
    name: z.string().min(2),
    category: z.string(),
    key: z.string().nullable().optional(),
    seats: z.number().int().min(1).default(1),
    startDate: z.string().nullable().optional(),
    expirationDate: z.string().nullable().optional(),
    cost: z.number().nullable().optional(),
    status: z.string().default('Active'),
    remarks: z.string().nullable().optional(),
});

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || ['http://localhost', 'http://localhost:5173'],
    credentials: true,
}));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

app.use(express.json());
app.use(cookieParser());

// Request Logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    if (req.method !== 'GET') console.log('Body:', JSON.stringify(req.body, null, 2));
    next();
});

// --- M365 Authentication Logic ---
const client = jwksClient({
    jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
});

function getKey(header: any, callback: (err: Error | null, key?: string) => void) {
    client.getSigningKey(header.kid, function (err, key: any) {
        if (err) return callback(err);
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

app.post('/api/auth/m365', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ error: 'Token is required' });

        (jwt as any).verify(idToken, getKey as any, {
            audience: process.env.AZURE_CLIENT_ID,
            ignoreIssuer: true 
        }, (err: any, decoded: any) => {
            if (err) {
                console.error('Token verification error:', err);
                return res.status(401).json({ error: 'Invalid Microsoft token' });
            }

            // Execute the rest in an async IIFE to handle DB calls
            (async () => {
                try {
                    const decodedToken = decoded as any;
                    const { email, name, preferred_username } = decodedToken;
            const userEmail = (email || preferred_username || '').toLowerCase();

            if (!userEmail) return res.status(400).json({ error: 'Email not found in token' });

            if (!userEmail.endsWith('@avanamedical.com') && !userEmail.endsWith('@avanasurgical.com')) {
                return res.status(403).json({ error: 'Access denied. Unauthorized domain.' });
            }

            if (decodedToken.tid && decodedToken.tid !== process.env.AZURE_TENANT_ID) {
                return res.status(403).json({ error: 'Access denied. Invalid tenant.' });
            }

            // Upsert User
            let user = await prisma.user.findUnique({ 
                where: { email: userEmail },
                include: { department: true, branch: true }
            });

            if (!user) {
                const userCount = await prisma.user.count();
                user = await prisma.user.create({
                    data: {
                        email: userEmail,
                        name: name || userEmail.split('@')[0],
                        role: userCount === 0 ? 'Admin' : 'User',
                        status: 'Active'
                    },
                    include: { department: true, branch: true }
                });
            }

            if (user.status === 'Inactive') {
                return res.status(403).json({ error: 'Account is inactive' });
            }

            const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
            res.cookie('authToken', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 8 * 60 * 60 * 1000 // 8 hours
            });
            res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status } });
                } catch (dbError) {
                    console.error('M365 DB Error:', dbError);
                    res.status(500).json({ error: 'Failed to sync user data' });
                }
            })();
        });
    } catch (error) {
        console.error('M365 Auth Error:', error);
        res.status(500).json({ error: 'Microsoft authentication failed' });
    }
});

// --- Authentication Routes ---

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.password) return res.status(400).json({ error: 'Invalid credentials' });

        if (user.status === 'Inactive') return res.status(403).json({ error: 'Account is inactive. Please contact IT support.' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });
        res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('authToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id } = req.user;
        const user = await prisma.user.findUnique({
            where: { id: Number(id) },
            include: { department: true, branch: true }
        });
        if (!user || user.status === 'Inactive') {
            return res.status(401).json({ error: 'User not found or inactive' });
        }
        res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Health check - unprotected
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Secured Avana IT Backend is running' });
});

// --- Users Routes ---

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let users;

        if (role === 'Admin') {
            users = await prisma.user.findMany({
                include: { department: true, branch: true, manager: true },
                orderBy: { name: 'asc' }
            });
        } else if (role === 'Manager') {
            // Managers see themselves and their direct reports
            users = await prisma.user.findMany({
                where: { OR: [{ id }, { managerId: id }] },
                include: { department: true, branch: true, manager: true },
                orderBy: { name: 'asc' }
            });
        } else {
            // Regular users only see themselves
            users = await prisma.user.findMany({
                where: { id },
                include: { department: true, branch: true, manager: true }
            });
        }

        // Never expose passwords
        const sanitized = users.map(({ password, ...u }) => u);
        res.json(sanitized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = userSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });
        
        const { name, email, password, role, status, departmentId, branchId, managerId } = validation.data;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || 'User',
                status: status || 'Active',
                departmentId: departmentId ? Number(departmentId) : null,
                branchId: branchId ? Number(branchId) : null,
                managerId: managerId ? Number(managerId) : null,
            },
            include: { department: true, branch: true, manager: true }
        });
        const { password: _, ...sanitized } = user;
        res.status(201).json(sanitized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const { id: requestingUserId, role: requestingUserRole } = req.user;

        // Security: only admin can edit others; users can only edit their own name/email
        if (requestingUserRole !== 'Admin' && Number(id) !== requestingUserId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const validation = userSchema.partial().safeParse(req.body);
        if (!validation.success) {
            console.error('Validation error updating user:', validation.error.format());
            return res.status(400).json({ error: validation.error.format() });
        }
        
        const { name, email, role, status, departmentId, branchId, managerId, password } = validation.data;

        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        
        // Only admin can change role/status/depts
        if (requestingUserRole === 'Admin') {
            if (role) updateData.role = role;
            if (status) updateData.status = status;
            if (departmentId !== undefined) updateData.departmentId = departmentId;
            if (branchId !== undefined) updateData.branchId = branchId;
            if (managerId !== undefined) updateData.managerId = managerId;
        }

        if (password) {
            if (requestingUserRole !== 'Admin') {
                const { currentPassword } = req.body;
                if (!currentPassword) {
                    return res.status(400).json({ error: 'Current password is required to set a new password.' });
                }
                const existingUser = await prisma.user.findUnique({ where: { id: Number(id) } });
                if (!existingUser?.password) {
                    return res.status(400).json({ error: 'Please contact admin to set an initial password or use Microsoft Login.' });
                }
                const valid = await bcrypt.compare(currentPassword, existingUser.password);
                if (!valid) {
                    return res.status(400).json({ error: 'Invalid current password.' });
                }
            }
            updateData.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: updateData,
            include: { department: true, branch: true, manager: true }
        });
        const { password: _, ...sanitized } = user;
        res.json(sanitized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.put('/api/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // @ts-ignore
        const requestingUserId = req.user.id;

        if (Number(id) === requestingUserId) {
            return res.status(400).json({ error: 'You cannot change the status of your own account.' });
        }

        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: { status },
        });
        const { password: _, ...sanitized } = user;
        res.json(sanitized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const requestingUserId = req.user.id;

        if (Number(id) === requestingUserId) {
            return res.status(400).json({ error: 'You cannot delete your own account.' });
        }

        await prisma.user.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// --- Assets Routes ---

app.get('/api/assets', authenticateToken, async (req, res) => {
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

app.post('/api/assets', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = assetSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const data = validation.data;
        const asset = await prisma.asset.create({
            data: { 
                ...data, 
                specs: data.specs ? JSON.stringify(data.specs) : null,
                userId: data.assigneeType === 'User' ? data.assigneeId : null // Ensure relation is set
            }
        });
        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create asset' });
    }
});

app.put('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const validation = assetSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const data = validation.data;
        const asset = await prisma.asset.update({
            where: { id: Number(id) },
            data: { 
                ...data, 
                specs: data.specs ? JSON.stringify(data.specs) : null,
                userId: data.assigneeType === 'User' ? data.assigneeId : null 
            }
        });
        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update asset' });
    }
});

app.delete('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.asset.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete asset' });
    }
});

// --- Departments Routes ---

app.get('/api/departments', authenticateToken, async (req, res) => {
    res.json(await prisma.department.findMany({ orderBy: { name: 'asc' } }));
});

app.post('/api/departments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const dept = await prisma.department.create({ data: { name } });
        res.status(201).json(dept);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create department' });
    }
});

app.put('/api/departments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const dept = await prisma.department.update({ where: { id: Number(id) }, data: { name } });
        res.json(dept);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update department' });
    }
});

app.delete('/api/departments/:id', authenticateToken, requireAdmin, async (req, res) => {
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

app.get('/api/branches', authenticateToken, async (req, res) => {
    res.json(await prisma.branch.findMany({ orderBy: { name: 'asc' } }));
});

app.post('/api/branches', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, location } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const branch = await prisma.branch.create({ data: { name, location } });
        res.status(201).json(branch);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create branch' });
    }
});

app.put('/api/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location } = req.body;
        const branch = await prisma.branch.update({ where: { id: Number(id) }, data: { name, location } });
        res.json(branch);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update branch' });
    }
});

app.delete('/api/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
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

app.get('/api/purchases', authenticateToken, async (req, res) => {
    try {
        const purchases = await prisma.purchaseRecord.findMany({
            include: { assets: true },
            orderBy: { purchaseDate: 'desc' }
        });
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch purchases' });
    }
});

app.post('/api/purchases', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = purchaseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const purchase = await prisma.purchaseRecord.create({ data: validation.data });
        res.status(201).json(purchase);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create purchase' });
    }
});

app.put('/api/purchases/:id', authenticateToken, requireAdmin, async (req, res) => {
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

app.delete('/api/purchases/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.purchaseRecord.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete purchase' });
    }
});

// --- Asset History ---
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

app.post('/api/history', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // @ts-ignore
        const { id: userId } = req.user;
        const { assetId, event, details } = req.body;
        const entry = await prisma.assetHistory.create({
            data: { assetId: Number(assetId), userId, event, details }
        });
        res.status(201).json(entry);
    } catch (error) {
        res.status(500).json({ error: 'Failed to log history' });
    }
});

// --- Licenses Routes ---
app.get('/api/licenses', authenticateToken, async (req, res) => {
    try {
        const licenses = await prisma.license.findMany({ include: { assignments: { include: { user: true, asset: true } } } });
        res.json(licenses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch licenses' });
    }
});

app.post('/api/licenses', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const validation = licenseSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.format() });

        const license = await prisma.license.create({ data: validation.data });
        res.json(license);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create license' });
    }
});

app.put('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
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

app.delete('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.license.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete license' });
    }
});

// --- License Assignments ---
app.post('/api/license-assignments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { licenseId, userId, assetId } = req.body;
        const assignment = await prisma.licenseAssignment.create({ data: { licenseId, userId, assetId } });
        res.status(201).json(assignment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to assign license' });
    }
});

app.delete('/api/license-assignments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.licenseAssignment.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove license assignment' });
    }
});

// --- Asset Requests ---
app.get('/api/requests', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let requests;

        if (role === 'Admin') {
            requests = await prisma.assetRequest.findMany({ include: { user: true, manager: true }, orderBy: { createdAt: 'desc' } });
        } else if (role === 'Manager') {
            requests = await prisma.assetRequest.findMany({
                where: { OR: [{ managerId: id }, { userId: id }] },
                include: { user: true, manager: true },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            requests = await prisma.assetRequest.findMany({
                where: { userId: id },
                include: { user: true, manager: true },
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch asset requests' });
    }
});

app.post('/api/requests', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id } = req.user;
        const user = await prisma.user.findUnique({ where: { id } });
        const { requestType, category, description } = req.body;
        
        const request = await prisma.assetRequest.create({
            data: { 
                userId: id, 
                managerId: user?.managerId, 
                requestType, 
                category, 
                description, 
                status: user?.managerId ? 'Pending Manager' : 'Pending Admin' 
            }
        });
        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create asset request' });
    }
});

app.put('/api/requests/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // @ts-ignore
        const { role } = req.user;

        if ((status === 'Pending Admin' || status === 'Rejected by Manager') && role !== 'Manager' && role !== 'Admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }
        if ((status === 'Approved' || status === 'Rejected by Admin') && role !== 'Admin') {
            return res.status(403).json({ error: 'Only admins can give final approval' });
        }

        const request = await prisma.assetRequest.update({ where: { id: Number(id) }, data: { status } });
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update asset request status' });
    }
});


// --- Support Tickets ---

app.get('/api/tickets', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { role, id } = req.user;
        let tickets;

        if (role === 'Admin') {
            tickets = await prisma.supportTicket.findMany({ 
                include: { user: { select: { id: true, name: true, email: true } } }, 
                orderBy: { createdAt: 'desc' } 
            });
        } else {
            tickets = await prisma.supportTicket.findMany({
                where: { userId: id },
                include: { user: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

app.post('/api/tickets', authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id } = req.user;
        const { subject, category, priority, description, assetId } = req.body;
        
        const ticket = await prisma.supportTicket.create({
            data: {
                userId: id,
                subject,
                category,
                priority: priority || 'Medium',
                description,
                assetId: assetId ? Number(assetId) : null
            },
            include: { user: { select: { id: true, name: true, email: true } } }
        });
        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

app.put('/api/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const { role } = req.user;
        
        if (role !== 'Admin') return res.status(403).json({ error: 'Only admins can update tickets' });

        const { status, priority, resolvedAt } = req.body;
        const ticket = await prisma.supportTicket.update({
            where: { id: Number(id) },
            data: { 
                status, 
                priority,
                resolvedAt: status === 'Resolved' ? new Date() : (resolvedAt ? new Date(resolvedAt) : null)
            },
            include: { user: { select: { id: true, name: true, email: true } } }
        });
        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});

// --- Knowledge Base ---

app.get('/api/kb', authenticateToken, async (req, res) => {
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

app.post('/api/kb', authenticateToken, requireAdmin, async (req, res) => {
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

app.put('/api/kb/:id', authenticateToken, requireAdmin, async (req, res) => {
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

app.delete('/api/kb/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.knowledgeBase.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete KB article' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port} with security measures enabled.`);
});
 
