import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteTickets() {
    console.log('Deleting all test tickets and their comments...');
    try {
        await prisma.ticketComment.deleteMany();
        console.log('Deleted all ticket comments.');
        
        await prisma.supportTicket.deleteMany();
        console.log('Deleted all support tickets.');
    } catch (e) {
        console.error('Error deleting tickets:', e);
    } finally {
        await prisma.$disconnect();
    }
}

deleteTickets();
