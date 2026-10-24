import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import {
    syncZohoLicensePool,
    applyHrChange,
    dismissHrChange,
    fetchZohoEmployees,
    detectHrChanges
} from '../services/zoho.service';

const router = Router();

/**
 * GET /api/zoho/status
 * Check Zoho People connection health
 */
router.get('/api/zoho/status', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const hasClientId = Boolean(process.env.ZOHO_CLIENT_ID);
        const hasClientSecret = Boolean(process.env.ZOHO_CLIENT_SECRET);
        const hasRefreshToken = Boolean(process.env.ZOHO_REFRESH_TOKEN);

        res.json({
            configured: hasClientId && hasClientSecret && hasRefreshToken,
            apiUrl: process.env.ZOHO_API_URL || 'https://people.zoho.in/people/api'
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/zoho/sync-licenses
 * Sync active Zoho People Plus licenses and run HR change diff
 */
router.post('/api/zoho/sync-licenses', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const result = await syncZohoLicensePool();
        res.json({
            message: 'Zoho People Plus license pool synced successfully',
            ...result
        });
    } catch (error: any) {
        console.error('Zoho sync error:', error.message);
        res.status(500).json({
            error: error.message || 'Failed to sync Zoho People Plus licenses'
        });
    }
});

/**
 * GET /api/zoho/changes
 * Get pending and recent HR changes
 */
router.get('/api/zoho/changes', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const { status } = req.query;
        const whereClause = status ? { status: String(status) } : {};

        const notifications = await prisma.hrChangeNotification.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        const pendingCount = await prisma.hrChangeNotification.count({
            where: { status: 'Pending' }
        });

        res.json({
            notifications,
            pendingCount
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/zoho/changes/:id/apply
 * Apply an HR change to the portal user
 */
router.post('/api/zoho/changes/:id/apply', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
        const pushToM365 = req.body?.pushToM365 === true;

        const updated = await applyHrChange(id, req.user?.id, pushToM365);
        res.json({
            message: pushToM365 ? 'Change applied to Portal and pushed to Microsoft 365' : 'Change applied successfully',
            notification: updated
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/zoho/changes/:id/dismiss
 * Dismiss an HR change without modifying user
 */
router.post('/api/zoho/changes/:id/dismiss', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

        const updated = await dismissHrChange(id, req.user?.id);
        res.json({
            message: 'Change dismissed',
            notification: updated
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
