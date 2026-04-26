import { PrismaClient } from '@prisma/client';
import data from './importData.json';

const prisma = new PrismaClient();

async function importData() {
    let type1 = true;
    let successCount = 0;
    
    // Ensure Chennai branch exists
    let chennaiBranch = await prisma.branch.findFirst({ where: { name: 'Chennai' } });
    if (!chennaiBranch) {
        chennaiBranch = await prisma.branch.create({ data: { name: 'Chennai', location: 'Chennai' } });
    }

    for (const row of data) {
        if (!row) continue;
        
        // Switch parsing mode when we hit the header
        if (row["Sl. No"] === "Sl. No" && row["Name"] === "Asset Type") {
            type1 = false;
            continue;
        }
        
        if (row["Sl. No"] === null || row["Sl. No"] === "Other IT Assets") {
            continue;
        }

        let assetId = "";
        let category = "";
        let brand = "";
        let model = "";
        let remarks = "";
        let status = "In Stock";
        let location = "Chennai";
        let condition = row["Condition"] || "Good";
        let userName = "";

        if (type1) {
            assetId = row["Asset ID"] || `TEMP-ID-${Math.random().toString(36).substring(7)}`;
            category = row["Laptop/Desktop"] || "Other";
            brand = row["Brand"] || "";
            model = row["Model"] || "";
            remarks = row["Additional "] || "";
            userName = row["Name"] || "";
            
            if (userName.includes("Not Working")) {
                status = "Retired";
                userName = "";
            } else if (userName.includes("Not Assigned")) {
                status = "In Stock";
                userName = "";
            } else if (userName === "Biometric System" || userName === "Avana Head Office" || userName === "ATS Service") {
                status = "Assigned";
                // Keep userName to create a dummy user or assign abstractly?
                // For simplicity, we create them as Users
            } else if (userName) {
                status = "Assigned";
            }
        } else {
            // Type 2 format
            // "Name": "PBX Phone" -> Category
            // "Emp ID": "Panasonic" -> Brand
            // "Laptop/Desktop": "KX-TSC60XB" -> Model
            // "Brand": "AMD-PBXPH-BC-0075" -> AssetId
            assetId = row["Brand"] || `TEMP-ID-${Math.random().toString(36).substring(7)}`;
            category = row["Name"] || "Other";
            brand = row["Emp ID"] || "";
            model = row["Laptop/Desktop"] || "";
            remarks = row["Additional "] || "";
            userName = ""; // All unassigned according to prompt context
            status = "In Stock";
        }

        if (condition === "In Repair" || condition.includes("In repair")) {
            status = "In Repair";
        }
        if (condition.includes("Not Working")) {
            status = "Retired";
        }

        let userId = null;
        if (userName) {
            // Find or create user
            let user = await prisma.user.findFirst({ where: { name: userName } });
            if (!user) {
                let email = userName.toLowerCase().replace(/[^a-z0-9]/g, '') + "@avana.com";
                user = await prisma.user.create({
                    data: {
                        name: userName,
                        email: email,
                        branchId: chennaiBranch.id
                    }
                });
            }
            userId = user.id;
        }

        // Handle case where assetID may simply be blank or null -> Skip or fake
        if (!assetId || assetId.trim() === "") {
             assetId = `TEMP-ID-${Math.random().toString(36).substring(7)}`;
        }

        try {
            await prisma.asset.upsert({
                where: { assetId: assetId.trim() },
                update: {
                    name: `${brand} ${model}`.trim() || category,
                    category,
                    brand,
                    model,
                    status,
                    location,
                    remarks,
                    userId,
                    assigneeId: userId,
                    assigneeType: userId ? "User" : null
                },
                create: {
                    assetId: assetId.trim(),
                    name: `${brand} ${model}`.trim() || category,
                    category,
                    brand,
                    model,
                    status,
                    location,
                    remarks,
                    userId,
                    assigneeId: userId,
                    assigneeType: userId ? "User" : null
                }
            });
            successCount++;
        } catch(e) {
            console.error("Error creating asset", assetId, e);
        }
    }
    
    console.log(`Successfully imported ${successCount} assets.`);
}

importData().catch(console.error).finally(() => prisma.$disconnect());
