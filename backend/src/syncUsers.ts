import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function syncM365Users() {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
        console.error("Missing required Azure environment variables: AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET");
        process.exit(1);
    }

    try {
        console.log("🚀 Starting M365 User Sync...");

        // 1. Get Access Token using Client Credentials Flow
        const tokenResponse = await axios.post(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            new URLSearchParams({
                client_id: clientId,
                scope: 'https://graph.microsoft.com/.default',
                client_secret: clientSecret,
                grant_type: 'client_credentials',
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenResponse.data.access_token;

        // 2. Fetch Users from Microsoft Graph
        // We select id, displayName, mail, and userPrincipalName
        const graphResponse = await axios.get(
            'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department',
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const m365Users = graphResponse.data.value;
        console.log(`📦 Found ${m365Users.length} users in M365 tenant.`);

        let createdCount = 0;
        let updatedCount = 0;

        for (const mUser of m365Users) {
            const email = mUser.mail || mUser.userPrincipalName;
            if (!email) continue;

            // Check if user exists
            const existingUser = await prisma.user.findUnique({ where: { email } });

            if (existingUser) {
                // Update if name changed
                if (existingUser.name !== mUser.displayName) {
                    await prisma.user.update({
                        where: { id: existingUser.id },
                        data: { name: mUser.displayName }
                    });
                    updatedCount++;
                }
            } else {
                // Create new user
                await prisma.user.create({
                    data: {
                        email: email,
                        name: mUser.displayName || email.split('@')[0],
                        role: 'User',
                        status: 'Active'
                    }
                });
                createdCount++;
            }
        }

        console.log(`✅ Sync Complete!`);
        console.log(`✨ Created: ${createdCount} new users.`);
        console.log(`🔄 Updated: ${updatedCount} existing users.`);

    } catch (error: any) {
        console.error("❌ Sync Failed:", error.response?.data || error.message);
    } finally {
        await prisma.$disconnect();
    }
}

syncM365Users();
