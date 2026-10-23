import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { serviceRecordSchema } from '../schemas';

const router = Router();

async function generateNextServiceId(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `SRV-${currentYear}-`;
    const latestRecord = await prisma.serviceRecord.findFirst({
        where: { serviceId: { startsWith: prefix } },
        orderBy: { id: "desc" },
        select: { serviceId: true }
    });
    let nextNum = 1;
    if (latestRecord && latestRecord.serviceId) {
        const parts = latestRecord.serviceId.split("-");
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) nextNum = lastSeq + 1;
    }
    return prefix + String(nextNum).padStart(4, "0");
}

router.get("/api/assets/:id/services", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const assetId = Number(id);
        if (isNaN(assetId)) {
            return res.status(400).json({ error: "Invalid asset ID" });
        }

        const services = await prisma.serviceRecord.findMany({
            where: { assetId },
            include: {
                performedBy: { select: { id: true, name: true, email: true, role: true } }
            },
            orderBy: { serviceDate: "desc" }
        });

        res.json(services);
    } catch (error) {
        console.error("Failed to fetch asset service history:", error);
        res.status(500).json({ error: "Failed to fetch asset service history" });
    }
});

// GET /api/services - Global list of service records across assets (Admin & Manager)
router.get("/api/services", authenticateToken, async (req, res) => {
    try {
        const { status, vendor, search } = req.query;
        const whereClause: any = {};

        if (status && typeof status === "string") {
            whereClause.status = status;
        }
        if (vendor && typeof vendor === "string") {
            whereClause.vendor = { contains: vendor, mode: "insensitive" };
        }
        if (search && typeof search === "string" && search.trim()) {
            const s = search.trim();
            whereClause.OR = [
                { serviceId: { contains: s, mode: "insensitive" } },
                { issueDescription: { contains: s, mode: "insensitive" } },
                { workDone: { contains: s, mode: "insensitive" } },
                { vendor: { contains: s, mode: "insensitive" } },
                { invoiceNumber: { contains: s, mode: "insensitive" } },
                { asset: { assetId: { contains: s, mode: "insensitive" } } },
                { asset: { name: { contains: s, mode: "insensitive" } } }
            ];
        }

        const services = await prisma.serviceRecord.findMany({
            where: whereClause,
            include: {
                asset: { select: { id: true, assetId: true, name: true, category: true, brand: true, model: true, serialNumber: true, status: true, company: true } },
                performedBy: { select: { id: true, name: true, email: true } }
            },
            orderBy: { serviceDate: "desc" }
        });

        res.json(services);
    } catch (error) {
        console.error("Failed to fetch services:", error);
        res.status(500).json({ error: "Failed to fetch services" });
    }
});

// POST /api/assets/:id/services - Log a new service record for an asset
router.post("/api/assets/:id/services", authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id: requestingUserId, role: requestingUserRole } = req.user;
        if (requestingUserRole !== "Admin" && requestingUserRole !== "Manager") {
            return res.status(403).json({ error: "Only administrators and managers can log service records." });
        }

        const { id } = req.params;
        const assetId = Number(id);
        if (isNaN(assetId)) {
            return res.status(400).json({ error: "Invalid asset ID" });
        }

        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) {
            return res.status(404).json({ error: "Asset not found" });
        }

        const validation = serviceRecordSchema.safeParse(req.body);
        if (!validation.success) {
            const firstErr = validation.error.issues[0]?.message || "Invalid service record data";
            return res.status(400).json({ error: firstErr });
        }

        const {
            serviceType,
            serviceDate,
            completionDate,
            vendor,
            vendorContact,
            invoiceNumber,
            cost,
            isWarrantyClaim,
            issueDescription,
            workDone,
            status,
            invoiceAttachmentUrl,
            invoiceAttachmentFilename,
            updateAssetStatus,
            targetAssetStatus
        } = validation.data;

        const serviceId = await generateNextServiceId();

        const serviceRecord = await prisma.serviceRecord.create({
            data: {
                serviceId,
                assetId,
                serviceType,
                serviceDate: new Date(serviceDate),
                completionDate: completionDate ? new Date(completionDate) : null,
                vendor: vendor?.trim() || null,
                vendorContact: vendorContact?.trim() || null,
                invoiceNumber: invoiceNumber?.trim() || null,
                cost: cost || 0,
                isWarrantyClaim: Boolean(isWarrantyClaim),
                issueDescription: issueDescription.trim(),
                workDone: workDone?.trim() || null,
                status: status || "Completed",
                invoiceAttachmentUrl: invoiceAttachmentUrl || null,
                invoiceAttachmentFilename: invoiceAttachmentFilename || null,
                performedById: requestingUserId
            },
            include: {
                performedBy: { select: { id: true, name: true, email: true, role: true } }
            }
        });

        // Handle Asset Status Synchronization if requested
        if (updateAssetStatus) {
            let newAssetStatus = asset.status;
            if (targetAssetStatus) {
                newAssetStatus = targetAssetStatus;
            } else if (status === "In Progress") {
                newAssetStatus = "In Repair";
            } else if (status === "Completed" && asset.status === "In Repair") {
                newAssetStatus = "In Stock";
            }

            if (newAssetStatus !== asset.status) {
                await prisma.asset.update({
                    where: { id: assetId },
                    data: { status: newAssetStatus }
                });
            }
        }

        // Log entry in AssetHistory
        const invoiceNote = invoiceAttachmentFilename ? (" Invoice attached: " + invoiceAttachmentFilename) : "";
        const historyDetails = "Service " + serviceId + " (" + serviceType + ") - " + status + " by " + (vendor || "Service Vendor") + ". Cost: ₹" + (cost || 0) + (isWarrantyClaim ? " (Warranty Claim)" : "") + "." + invoiceNote;
        await prisma.assetHistory.create({
            data: {
                assetId,
                userId: requestingUserId,
                event: status === "In Progress" ? "Sent for Service" : "Service Completed",
                details: historyDetails,
                condition: asset.condition || "Good"
            }
        });

        res.status(201).json(serviceRecord);
    } catch (error) {
        console.error("Failed to create service record:", error);
        res.status(500).json({ error: "Failed to create service record" });
    }
});

// PUT /api/services/:id - Update an existing service record
router.put("/api/services/:id", authenticateToken, async (req, res) => {
    try {
        // @ts-ignore
        const { id: requestingUserId, role: requestingUserRole } = req.user;
        if (requestingUserRole !== "Admin" && requestingUserRole !== "Manager") {
            return res.status(403).json({ error: "Only administrators and managers can update service records." });
        }

        const { id } = req.params;
        const serviceRecordId = Number(id);
        if (isNaN(serviceRecordId)) {
            return res.status(400).json({ error: "Invalid service record ID" });
        }

        const existingRecord = await prisma.serviceRecord.findUnique({
            where: { id: serviceRecordId },
            include: { asset: true }
        });
        if (!existingRecord) {
            return res.status(404).json({ error: "Service record not found" });
        }

        const validation = serviceRecordSchema.partial().safeParse(req.body);
        if (!validation.success) {
            const firstErr = validation.error.issues[0]?.message || "Invalid service record data";
            return res.status(400).json({ error: firstErr });
        }

        const data: any = { ...validation.data };
        delete data.updateAssetStatus;
        delete data.targetAssetStatus;

        if (data.serviceDate) data.serviceDate = new Date(data.serviceDate);
        if (data.completionDate !== undefined) {
            data.completionDate = data.completionDate ? new Date(data.completionDate) : null;
        }

        const updated = await prisma.serviceRecord.update({
            where: { id: serviceRecordId },
            data,
            include: {
                performedBy: { select: { id: true, name: true, email: true, role: true } }
            }
        });

        // Optional status transition if completing service
        if (validation.data.updateAssetStatus) {
            let nextStatus = validation.data.targetAssetStatus;
            if (!nextStatus && data.status === "Completed" && existingRecord.asset.status === "In Repair") {
                nextStatus = "In Stock";
            }

            if (nextStatus && nextStatus !== existingRecord.asset.status) {
                await prisma.asset.update({
                    where: { id: existingRecord.assetId },
                    data: { status: nextStatus }
                });

                await prisma.assetHistory.create({
                    data: {
                        assetId: existingRecord.assetId,
                        userId: requestingUserId,
                        event: "Asset Status Updated via Service",
                        details: "Status transitioned from " + existingRecord.asset.status + " to " + nextStatus + " following Service " + existingRecord.serviceId,
                        condition: existingRecord.asset.condition || "Good"
                    }
                });
            }
        }

        res.json(updated);
    } catch (error) {
        console.error("Failed to update service record:", error);
        res.status(500).json({ error: "Failed to update service record" });
    }
});

// DELETE /api/services/:id - Delete a service record (Admin only)
router.delete("/api/services/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
        // @ts-ignore
        const { id: requestingUserId } = req.user;
        const { id } = req.params;
        const serviceRecordId = Number(id);
        if (isNaN(serviceRecordId)) {
            return res.status(400).json({ error: "Invalid service record ID" });
        }

        const existingRecord = await prisma.serviceRecord.findUnique({
            where: { id: serviceRecordId }
        });
        if (!existingRecord) {
            return res.status(404).json({ error: "Service record not found" });
        }

        await prisma.serviceRecord.delete({ where: { id: serviceRecordId } });

        await prisma.assetHistory.create({
            data: {
                assetId: existingRecord.assetId,
                userId: requestingUserId,
                event: "Service Record Deleted",
                details: "Service record " + existingRecord.serviceId + " (" + existingRecord.serviceType + ") was deleted."
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Failed to delete service record:", error);
        res.status(500).json({ error: "Failed to delete service record" });
    }
});

// --- Departments Routes ---


export default router;
