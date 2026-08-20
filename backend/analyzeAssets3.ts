import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

const rawData = [
  { "Name": "Selvinjasper R", "Emp ID": "AMD_017", "Type": "Desktop", "Brand": "Gigabyte", "Model": "B760M GAMING AC", "Asset ID": "AMD-DES-BC-0053", "Additional": "Monitor, Keyboard, Mouse", "Condition": "Good" },
  { "Name": "Karthikeyan D", "Emp ID": "AMD_018", "Type": "Desktop", "Brand": "Gigabyte", "Model": "B760M GAMING AC", "Asset ID": "AMD-DES-BC-0049", "Additional": "Monitor, Keyboard, Mouse", "Condition": "Good" },
  { "Name": "Saran Raj S", "Emp ID": "AMD_020", "Type": "Desktop", "Brand": "Asus", "Model": "Assembled", "Asset ID": "AMD-DES-BC-0051", "Additional": "Monitor, Keyboard, Mouse", "Condition": "Good" },
  { "Name": "Saran Raj R", "Emp ID": "AMD_070", "Type": "N/A", "Brand": "", "Model": "", "Asset ID": "", "Additional": "", "Condition": "" },
  { "Name": "Sebastin David A", "Emp ID": "AMD_071", "Type": "N/A", "Brand": "", "Model": "", "Asset ID": "", "Additional": "", "Condition": "" },
  { "Name": "Ramakrishnan M", "Emp ID": "AMD_084", "Type": "Desktop", "Brand": "Asus", "Model": "Assembled", "Asset ID": "AMD-DES-BC-0050", "Additional": "Monitor, Keyboard, Mouse", "Condition": "Good" },
  { "Name": "Selva Kumar B", "Emp ID": "AMD_087", "Type": "Desktop", "Brand": "HP", "Model": "HP ProDesk 400 G6", "Asset ID": "AMD-DES-BC-0052", "Additional": "Monitor, Keyboard, Mouse", "Condition": "Good" },
  { "Name": "Thanigaivel C", "Emp ID": "AMD_088", "Type": "N/A", "Brand": "", "Model": "", "Asset ID": "", "Additional": "", "Condition": "" },
  { "Name": "Surya S", "Emp ID": "AMD_089", "Type": "N/A", "Brand": "", "Model": "", "Asset ID": "", "Additional": "", "Condition": "" },
  { "Name": "R Vignesh", "Emp ID": "AMD_129", "Type": "Desktop", "Brand": "Gigabyte", "Model": "B760M GAMING AC", "Asset ID": "AMD-DES-BC-0055", "Additional": "Monitor, Keyboard, Mouse", "Condition": "Good" },
  { "Name": "Sridhar D", "Emp ID": "AMD_147", "Type": "Desktop", "Brand": "Gigabyte", "Model": "B760M GAMING AC", "Asset ID": "AMD-DES-BC-0054", "Additional": "Monitor, Keyboard, Mouse", "Condition": "Good" },
  { "Name": "Sanjay V", "Emp ID": "AMD_161", "Type": "Desktop", "Brand": "Gigabyte", "Model": "B760M GAMING AC", "Asset ID": "AMD-DES-BC-0048", "Additional": "Monitor, Keyboard, Mouse", "Condition": "Good" },
  { "Name": "Mohan Sundar. G", "Emp ID": "ASSP_043", "Type": "Laptop", "Brand": "Lenovo", "Model": "82KU", "Asset ID": "ASSP-LAP-BC-0045", "Additional": "Mouse, Lan to Type c", "Condition": "Good" },
  { "Name": "Senthil Kumar Shanmugam", "Emp ID": "AMD_057", "Type": "Laptop", "Brand": "HP", "Model": "HP PROBOOK 440 G7", "Asset ID": "AMD-LAP-B0-0046", "Additional": "", "Condition": "" },
  { "Name": "Store System", "Emp ID": "", "Type": "Desktop", "Brand": "Gigabyte Technology Co., Ltd.", "Model": "B760M GAMING AC", "Asset ID": "AMD-DES-BC-0048", "Additional": "Monitor, Mouse, Keyboard", "Condition": "Good" }
];

async function main() {
    let conflicts: string[] = [];

    // Check internal sheet conflicts
    const assetIdCounts: Record<string, number> = {};
    for (const item of rawData) {
        if (item["Asset ID"]) {
            assetIdCounts[item["Asset ID"]] = (assetIdCounts[item["Asset ID"]] || 0) + 1;
        }
    }
    for (const [id, count] of Object.entries(assetIdCounts)) {
        if ((count as number) > 1) {
            conflicts.push(`CRITICAL CONFLICT: Asset ID ${id} appears ${count} times in the sheet!`);
        }
    }

    for (const item of rawData) {
        let user = null;
        if (item["Emp ID"]) {
            user = await prisma.user.findFirst({ where: { employeeId: item["Emp ID"] } });
        }
        if (!user && item.Name && item.Name !== 'Store System') {
            let searchName = item.Name.trim();
            user = await prisma.user.findFirst({ where: { name: { contains: searchName } } });
        }

        if (!user && item.Name !== 'Store System') {
            conflicts.push(`User not found: ${item.Name} (${item["Emp ID"]})`);
        } else if (item.Name === 'Store System') {
            conflicts.push(`Notice: "Store System" is not a person. Asset ${item["Asset ID"]} will be created but left 'Unassigned' in inventory.`);
        }

        const type = item.Type.toLowerCase();
        const hasNoLaptop = ["n/a", "no laptop"].includes(type);
        
        if (user && hasNoLaptop) {
            const currentAssets = await prisma.asset.findMany({ where: { assigneeId: user.id } });
            if (currentAssets.length > 0) {
                conflicts.push(`Notice: ${user.name} has assets assigned in DB, but sheet says 'N/A'. Will unassign them.`);
            }
        }

        if (item["Asset ID"]) {
            const existingAsset = await prisma.asset.findFirst({ where: { assetId: item["Asset ID"] }, include: { user: true } });
            if (existingAsset) {
                if (existingAsset.assigneeId && existingAsset.assigneeId !== user?.id && item.Name !== 'Store System') {
                    conflicts.push(`Conflict: Asset ${item["Asset ID"]} is currently assigned to ${existingAsset.user?.name}, but sheet assigns it to ${user?.name || item.Name}.`);
                }
            } else {
                conflicts.push(`Notice: Asset ${item["Asset ID"]} is a NEW asset and will be created.`);
            }
        }
    }

    fs.writeFileSync('C:/Users/EAravinthkumar/.gemini/antigravity/brain/92896137-1476-4a04-9f57-5058f8ec32e9/asset_conflicts_3.md', '# Asset Conflicts Report 3\n\n' + conflicts.map(c => `- ${c}`).join('\n'));
    console.log(`Generated conflict report with ${conflicts.length} notices.`);
}

main().finally(() => prisma.$disconnect());
