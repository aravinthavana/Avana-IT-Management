import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { prisma } from './db';

// Modular route handlers
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import assetsRoutes from './routes/assets.routes';
import servicesRoutes from './routes/services.routes';
import orgRoutes from './routes/org.routes';
import purchasesRoutes from './routes/purchases.routes';
import licensesRoutes from './routes/licenses.routes';
import requestsRoutes from './routes/requests.routes';
import ticketsRoutes from './routes/tickets.routes';
import kbRoutes from './routes/kb.routes';
import auditsRoutes from './routes/audits.routes';
import uploadRoutes from './routes/upload.routes';
import webhooksRoutes from './routes/webhooks.routes';
import accessoriesRoutes from './routes/accessories.routes';
import m365Routes from './routes/m365.routes';
import zohoRoutes from './routes/zoho.routes';
import { syncFromM365 } from './services/m365.service';

const app = express();
const port = process.env.PORT || 8080;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.includes('avana-it-management-secure-secret')) {
    console.error('FATAL SECURITY ERROR: JWT_SECRET must be defined and at least 32 characters long. Default/weak secrets are rejected.');
    process.exit(1);
}

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
    origin: process.env.FRONTEND_URL || ['http://localhost', 'http://localhost:5173'],
    credentials: true,
}));

// Global parsing middleware
app.use(express.json());
app.use(cookieParser());

// Rate Limiting for general API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Static File Serving for Uploads (Images and Ticket Attachments)
const uploadsDir = path.join(os.tmpdir(), 'avana-uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Request Logger (Sanitized & secure)
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    if (process.env.NODE_ENV !== 'production' && req.method !== 'GET' && req.body) {
        const sanitized = { ...req.body };
        if (sanitized.password) sanitized.password = '[REDACTED]';
        if (sanitized.currentPassword) sanitized.currentPassword = '[REDACTED]';
        if (sanitized.token) sanitized.token = '[REDACTED]';
        if (sanitized.idToken) sanitized.idToken = '[REDACTED]';
        if (sanitized.accessToken) sanitized.accessToken = '[REDACTED]';
        if (sanitized.signature) sanitized.signature = '[REDACTED BASE64]';
        console.log('Body (Sanitized):', JSON.stringify(sanitized, null, 2));
    }
    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register Modular API Routers
app.use(authRoutes);
app.use(usersRoutes);
app.use(assetsRoutes);
app.use(servicesRoutes);
app.use(orgRoutes);
app.use(purchasesRoutes);
app.use(licensesRoutes);
app.use(requestsRoutes);
app.use(ticketsRoutes);
app.use(kbRoutes);
app.use(auditsRoutes);
app.use(uploadRoutes);
app.use(webhooksRoutes);
app.use(accessoriesRoutes);
app.use(m365Routes);
app.use(zohoRoutes);

app.listen(port, async () => {
    console.log(`Server running on port ${port} with security measures enabled.`);
    try {
        // Automatically ensure all legacy/existing users have onboardingStatus set to 'Completed'
        const legacyCount = await prisma.user.count({
            where: { onboardingStatus: null }
        });
        if (legacyCount > 0) {
            await prisma.user.updateMany({
                where: { onboardingStatus: null, status: 'Active' },
                data: {
                    onboardingStatus: 'Completed',
                    onboardingStep: 8,
                    m365AccountCreated: true,
                    softwareInstalled: true,
                    hardwareTested: true,
                    credentialsHandedOver: true,
                    onboardingCompletedDate: new Date()
                }
            });
            await prisma.user.updateMany({
                where: { onboardingStatus: null, status: 'Inactive' },
                data: {
                    onboardingStatus: 'Completed',
                    onboardingStep: 8,
                    offboardingStatus: 'Completed',
                    offboardingCompletedDate: new Date(),
                    m365AccountDisabled: true,
                    assetReturned: true,
                    m365LicenseRevoked: true
                }
            });
            console.log(`Auto-initialized ${legacyCount} legacy user(s) to onboardingStatus: 'Completed'`);
        }
    } catch (e) {
        console.error('Legacy user onboarding initialization notice:', e);
    }

    // Schedule automated periodic background sync from M365 (every 1 hour)
    const SYNC_INTERVAL_MS = 60 * 60 * 1000;
    setInterval(async () => {
        try {
            console.log('[Background M365 Sync] Running scheduled periodic sync...');
            await syncFromM365();
        } catch (syncErr: any) {
            console.error('[Background M365 Sync Error]:', syncErr.message);
        }
    }, SYNC_INTERVAL_MS);
});
