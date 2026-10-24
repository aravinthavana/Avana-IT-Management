import { prisma } from '../db';

// Updating the subscription first locks its row until commit. Both scheduled sync
// and on-demand refresh follow this order so concurrent refreshes cannot append
// duplicate cached memberships. The cloud remains the source of truth.
export async function reconcileM365Assignments(licenseId: number, userIds: number[], seats: number) {
    await prisma.$transaction(async tx => {
        await tx.license.update({ where: { id: licenseId }, data: { seats } });
        await tx.licenseAssignment.deleteMany({ where: { licenseId } });
        const unique = [...new Set(userIds)];
        if (unique.length) await tx.licenseAssignment.createMany({ data: unique.map(userId => ({ licenseId, userId })) });
    });
}
