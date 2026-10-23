import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/api/accessories/batches', authenticateToken, async (req, res) => {
    try {
        const batches = await prisma.accessoryBatch.findMany({
            orderBy: { purchaseDate: 'desc' },
            include: {
                _count: { select: { assignments: true } }
            }
        });
        res.json(batches);
    } catch (error: any) {
        console.error('[Accessory Batches] Error fetching batches:', error);
        res.status(500).json({ error: 'Failed to fetch accessory batches' });
    }
});

// 2. Create a new accessory purchase batch (with warranty calculation)
router.post('/api/accessories/batches', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name,
            category,
            brand,
            model,
            quantityPurchased,
            purchaseDate,
            warrantyMonths,
            vendor,
            invoiceNumber,
            unitCost,
            purchaseRecordId,
            notes
        } = req.body;

        if (!name || !category || !quantityPurchased || !purchaseDate) {
            return res.status(400).json({ error: 'Name, category, quantity, and purchase date are required.' });
        }

        const qty = Number(quantityPurchased);
        if (isNaN(qty) || qty < 1) {
            return res.status(400).json({ error: 'Quantity must be a positive integer.' });
        }

        const pDate = new Date(purchaseDate);
        let warrantyEndDate: Date | null = null;
        if (warrantyMonths && Number(warrantyMonths) > 0) {
            const wMonths = Number(warrantyMonths);
            warrantyEndDate = new Date(pDate);
            warrantyEndDate.setMonth(warrantyEndDate.getMonth() + wMonths);
        }

        const batch = await prisma.accessoryBatch.create({
            data: {
                name: name.trim(),
                category: category.trim(),
                brand: brand ? brand.trim() : null,
                model: model ? model.trim() : null,
                quantityPurchased: qty,
                quantityAvailable: qty,
                purchaseDate: pDate,
                warrantyMonths: warrantyMonths ? Number(warrantyMonths) : null,
                warrantyEndDate,
                vendor: vendor ? vendor.trim() : null,
                invoiceNumber: invoiceNumber ? invoiceNumber.trim() : null,
                unitCost: unitCost ? Number(unitCost) : null,
                purchaseRecordId: purchaseRecordId ? Number(purchaseRecordId) : null,
                notes: notes ? notes.trim() : null
            }
        });

        res.status(201).json(batch);
    } catch (error: any) {
        console.error('[Accessory Batches] Error creating batch:', error);
        res.status(500).json({ error: 'Failed to create accessory batch' });
    }
});

// 3. Update an accessory batch
router.put('/api/accessories/batches/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            category,
            brand,
            model,
            quantityPurchased,
            quantityAvailable,
            purchaseDate,
            warrantyMonths,
            vendor,
            invoiceNumber,
            unitCost,
            notes
        } = req.body;

        const existing = await prisma.accessoryBatch.findUnique({ where: { id: Number(id) } });
        if (!existing) {
            return res.status(404).json({ error: 'Accessory batch not found.' });
        }

        const pDate = purchaseDate ? new Date(purchaseDate) : existing.purchaseDate;
        let warrantyEndDate = existing.warrantyEndDate;
        if (warrantyMonths !== undefined || purchaseDate !== undefined) {
            const wMonths = warrantyMonths !== undefined ? Number(warrantyMonths) : existing.warrantyMonths;
            if (wMonths && wMonths > 0) {
                warrantyEndDate = new Date(pDate);
                warrantyEndDate.setMonth(warrantyEndDate.getMonth() + wMonths);
            } else {
                warrantyEndDate = null;
            }
        }

        const updated = await prisma.accessoryBatch.update({
            where: { id: Number(id) },
            data: {
                name: name !== undefined ? name.trim() : existing.name,
                category: category !== undefined ? category.trim() : existing.category,
                brand: brand !== undefined ? (brand ? brand.trim() : null) : existing.brand,
                model: model !== undefined ? (model ? model.trim() : null) : existing.model,
                quantityPurchased: quantityPurchased !== undefined ? Number(quantityPurchased) : existing.quantityPurchased,
                quantityAvailable: quantityAvailable !== undefined ? Number(quantityAvailable) : existing.quantityAvailable,
                purchaseDate: pDate,
                warrantyMonths: warrantyMonths !== undefined ? (warrantyMonths ? Number(warrantyMonths) : null) : existing.warrantyMonths,
                warrantyEndDate,
                vendor: vendor !== undefined ? (vendor ? vendor.trim() : null) : existing.vendor,
                invoiceNumber: invoiceNumber !== undefined ? (invoiceNumber ? invoiceNumber.trim() : null) : existing.invoiceNumber,
                unitCost: unitCost !== undefined ? (unitCost ? Number(unitCost) : null) : existing.unitCost,
                notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes
            }
        });

        // Also cascade update warranty dates to active user assignments from this batch
        if (warrantyEndDate !== existing.warrantyEndDate) {
            await prisma.userAccessory.updateMany({
                where: { batchId: Number(id), status: 'Assigned' },
                data: {
                    purchaseDate: pDate,
                    warrantyEndDate
                }
            });
        }

        res.json(updated);
    } catch (error: any) {
        console.error('[Accessory Batches] Error updating batch:', error);
        res.status(500).json({ error: 'Failed to update accessory batch' });
    }
});

// 4. Delete an accessory batch (only if no active assignments)
router.delete('/api/accessories/batches/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const count = await prisma.userAccessory.count({ where: { batchId: Number(id) } });
        if (count > 0) {
            return res.status(400).json({ error: `Cannot delete batch. ${count} item(s) are assigned to employees.` });
        }

        await prisma.accessoryBatch.delete({ where: { id: Number(id) } });
        res.json({ success: true, message: 'Accessory batch deleted successfully.' });
    } catch (error: any) {
        console.error('[Accessory Batches] Error deleting batch:', error);
        res.status(500).json({ error: 'Failed to delete accessory batch' });
    }
});

// 5. List an employee's assigned accessories
router.get('/api/users/:userId/accessories', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const accessories = await prisma.userAccessory.findMany({
            where: { userId: Number(userId) },
            include: { batch: true },
            orderBy: { assignedAt: 'desc' }
        });
        res.json(accessories);
    } catch (error: any) {
        console.error('[User Accessories] Error fetching accessories:', error);
        res.status(500).json({ error: 'Failed to fetch user accessories' });
    }
});

// 6. Issue an accessory to an employee (from batch or ad-hoc custom)
router.post('/api/users/:userId/accessories', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            batchId,
            category,
            name,
            brand,
            serialNumber,
            purchaseDate,
            warrantyEndDate,
            condition,
            notes
        } = req.body;

        const targetUser = await prisma.user.findUnique({ where: { id: Number(userId) } });
        if (!targetUser) {
            return res.status(404).json({ error: 'Employee not found.' });
        }

        let effectiveName = name?.trim();
        let effectiveCategory = category?.trim();
        let effectiveBrand = brand ? brand.trim() : null;
        let effectivePurchaseDate = purchaseDate ? new Date(purchaseDate) : null;
        let effectiveWarrantyEndDate = warrantyEndDate ? new Date(warrantyEndDate) : null;

        // If drawn from a purchase batch:
        if (batchId) {
            const batch = await prisma.accessoryBatch.findUnique({ where: { id: Number(batchId) } });
            if (!batch) {
                return res.status(404).json({ error: 'Selected accessory batch not found.' });
            }
            if (batch.quantityAvailable < 1) {
                return res.status(400).json({ error: `No units available in batch "${batch.name}". Stock is 0.` });
            }

            effectiveName = effectiveName || batch.name;
            effectiveCategory = effectiveCategory || batch.category;
            effectiveBrand = effectiveBrand || batch.brand;
            effectivePurchaseDate = batch.purchaseDate;
            effectiveWarrantyEndDate = batch.warrantyEndDate;

            // Decrement available stock
            await prisma.accessoryBatch.update({
                where: { id: batch.id },
                data: { quantityAvailable: batch.quantityAvailable - 1 }
            });
        }

        if (!effectiveName || !effectiveCategory) {
            return res.status(400).json({ error: 'Accessory name and category are required.' });
        }

        const newAccessory = await prisma.userAccessory.create({
            data: {
                userId: Number(userId),
                batchId: batchId ? Number(batchId) : null,
                category: effectiveCategory,
                name: effectiveName,
                brand: effectiveBrand,
                serialNumber: serialNumber ? serialNumber.trim() : null,
                purchaseDate: effectivePurchaseDate,
                warrantyEndDate: effectiveWarrantyEndDate,
                condition: condition || 'Good',
                notes: notes ? notes.trim() : null,
                status: 'Assigned'
            },
            include: { batch: true }
        });

        res.status(201).json(newAccessory);
    } catch (error: any) {
        console.error('[User Accessories] Error assigning accessory:', error);
        res.status(500).json({ error: 'Failed to assign accessory to employee' });
    }
});

// 7. Update or return an accessory
router.put('/api/users/:userId/accessories/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId, id } = req.params;
        const {
            name,
            category,
            brand,
            serialNumber,
            condition,
            status,
            notes,
            purchaseDate,
            warrantyEndDate
        } = req.body;

        const existing = await prisma.userAccessory.findUnique({
            where: { id: Number(id) },
            include: { batch: true }
        });

        if (!existing || existing.userId !== Number(userId)) {
            return res.status(404).json({ error: 'Accessory not found for this user.' });
        }

        // If status changed from Assigned to Returned, restore stock to batch
        if (status === 'Returned' && existing.status === 'Assigned' && existing.batchId) {
            await prisma.accessoryBatch.update({
                where: { id: existing.batchId },
                data: { quantityAvailable: { increment: 1 } }
            });
        } else if (status === 'Assigned' && existing.status === 'Returned' && existing.batchId) {
            // Re-assigned from returned: check and decrement
            await prisma.accessoryBatch.update({
                where: { id: existing.batchId },
                data: { quantityAvailable: { decrement: 1 } }
            });
        }

        const updated = await prisma.userAccessory.update({
            where: { id: Number(id) },
            data: {
                name: name !== undefined ? name.trim() : existing.name,
                category: category !== undefined ? category.trim() : existing.category,
                brand: brand !== undefined ? (brand ? brand.trim() : null) : existing.brand,
                serialNumber: serialNumber !== undefined ? (serialNumber ? serialNumber.trim() : null) : existing.serialNumber,
                condition: condition !== undefined ? condition : existing.condition,
                status: status !== undefined ? status : existing.status,
                returnedAt: status === 'Returned' ? (existing.returnedAt || new Date()) : (status === 'Assigned' ? null : existing.returnedAt),
                notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
                purchaseDate: purchaseDate !== undefined ? (purchaseDate ? new Date(purchaseDate) : null) : existing.purchaseDate,
                warrantyEndDate: warrantyEndDate !== undefined ? (warrantyEndDate ? new Date(warrantyEndDate) : null) : existing.warrantyEndDate
            },
            include: { batch: true }
        });

        res.json(updated);
    } catch (error: any) {
        console.error('[User Accessories] Error updating accessory:', error);
        res.status(500).json({ error: 'Failed to update accessory' });
    }
});

// 8. Delete / Unlink an accessory record
router.delete('/api/users/:userId/accessories/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId, id } = req.params;
        const existing = await prisma.userAccessory.findUnique({ where: { id: Number(id) } });
        if (!existing || existing.userId !== Number(userId)) {
            return res.status(404).json({ error: 'Accessory not found for this user.' });
        }

        // If it was currently assigned and came from a batch, restore stock
        if (existing.status === 'Assigned' && existing.batchId) {
            await prisma.accessoryBatch.update({
                where: { id: existing.batchId },
                data: { quantityAvailable: { increment: 1 } }
            }).catch(() => {});
        }

        await prisma.userAccessory.delete({ where: { id: Number(id) } });
        res.json({ success: true, message: 'Accessory record removed.' });
    } catch (error: any) {
        console.error('[User Accessories] Error deleting accessory:', error);
        res.status(500).json({ error: 'Failed to delete accessory record' });
    }
});

// 9. Reconcile declared accessories from Self-Audit into User Profile (without creating Asset IDs)

export default router;
