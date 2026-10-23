import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { syncFromM365, updateM365User } from '../services/m365.service';

const router = Router();

// 1. Trigger Full Inbound Sync from Microsoft 365
router.post('/api/m365/sync', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
        console.log(`[M365 Sync Triggered] by admin user ID: ${req.user?.id}`);
        const result = await syncFromM365();

        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to sync with Microsoft 365' });
        }

        res.json({
            success: true,
            message: `M365 synchronization complete. ${result.usersCreated} created, ${result.usersUpdated} updated, ${result.licensesSynced} licenses refreshed.`,
            data: result
        });
    } catch (error: any) {
        console.error('[M365 Sync Route Error]:', error);
        res.status(500).json({ error: error.message || 'Internal server error during M365 sync' });
    }
});

// 2. Get M365 Sync Status & Summary
router.get('/api/m365/status', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const totalUsers = await prisma.user.count();
        const m365Users = await prisma.user.count({
            where: { azureAdId: { not: null } }
        });
        const m365Licenses = await prisma.license.findMany({
            where: { isM365: true },
            include: {
                assignments: true
            }
        });

        const latestUser = await prisma.user.findFirst({
            where: { lastM365Sync: { not: null } },
            orderBy: { lastM365Sync: 'desc' },
            select: { lastM365Sync: true }
        });

        res.json({
            connected: true,
            totalUsers,
            m365SyncedUsers: m365Users,
            m365LicensePoolsCount: m365Licenses.length,
            m365Licenses: m365Licenses.map(l => ({
                id: l.id,
                name: l.name,
                seatsTotal: l.seats,
                seatsConsumed: l.assignments.length,
                status: l.status
            })),
            lastSyncTimestamp: latestUser?.lastM365Sync || null
        });
    } catch (error: any) {
        console.error('[M365 Status Error]:', error);
        res.status(500).json({ error: 'Failed to retrieve M365 status' });
    }
});

// 3. Outbound Push User to M365
router.post('/api/m365/push-user/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: Number(id) },
            include: { department: true, branch: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const target = user.azureAdId || user.email;
        const updateResult = await updateM365User(target, {
            displayName: user.name,
            jobTitle: user.jobTitle || undefined,
            department: user.department?.name || undefined,
            mobilePhone: user.mobile || undefined,
            officeLocation: user.location || user.branch?.name || undefined,
            city: user.city || undefined,
            state: user.state || undefined,
            country: user.country || undefined,
            postalCode: user.postalCode || undefined,
            accountEnabled: user.status === 'Active'
        });

        if (!updateResult.success) {
            return res.status(500).json({ error: updateResult.error || 'Failed to update user in M365' });
        }

        res.json({
            success: true,
            message: `User '${user.name}' successfully synchronized to Microsoft 365.`
        });
    } catch (error: any) {
        console.error('[M365 Push User Error]:', error);
        res.status(500).json({ error: error.message || 'Failed to push user to M365' });
    }
});

export default router;
