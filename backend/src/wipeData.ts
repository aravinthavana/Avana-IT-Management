import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function wipeDatabase() {
    console.log("⚠️ WARNING: Wiping all data from the database...");

    try {
        // Delete in order of dependencies (child records first)
        await prisma.licenseAssignment.deleteMany();
        await prisma.assetHistory.deleteMany();
        await prisma.assetRequest.deleteMany();
        await prisma.supportTicket.deleteMany();
        await prisma.knowledgeBase.deleteMany();
        
        await prisma.asset.deleteMany();
        await prisma.license.deleteMany();
        await prisma.purchaseRecord.deleteMany();
        
        await prisma.user.deleteMany();
        await prisma.department.deleteMany();
        await prisma.branch.deleteMany();
        
        console.log("✅ Database successfully wiped.");
        console.log("🚀 You can now start freshly with M365 sync.");
    } catch (error) {
        console.error("❌ Failed to wipe database:", error);
    } finally {
        await prisma.$disconnect();
    }
}

wipeDatabase();
