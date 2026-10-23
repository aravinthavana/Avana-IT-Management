import { Router } from 'express';
import { prisma } from '../db';

const router = Router();

router.post('/api/webhooks/graph', async (req, res) => {
    try {
        // 1. Microsoft Graph Validation Handshake
        if (req.query.validationToken) {
            res.set('Content-Type', 'text/plain');
            return res.status(200).send(req.query.validationToken as string);
        }

        // 2. Process Change Notifications
        const { value } = req.body;
        if (Array.isArray(value)) {
            for (const notification of value) {
                console.log('Received MS Graph Notification for resource:', notification.resource);
                // Background async processor will ingest message
            }
        }

        res.status(202).send('Accepted');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Webhook processing error');
    }
});

// ==========================================
// --- ACCESSORY & PERIPHERALS MANAGEMENT ---
// ==========================================

// 1. List all accessory purchase batches with stock & warranty info

export default router;
