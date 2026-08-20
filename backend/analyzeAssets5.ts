import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

const rawData = [
  {"Sl": 1, "Name": "Ruchir Gupta", "EmpID": "AMD_024", "Type": "Laptop", "Brand": "Apple", "Model": "Macbook Air", "AssetID": "AMD-LAP-BE-0160", "Additional": "", "Location": "Delhi", "Condition": ""},
  {"Sl": 2, "Name": "Prince Kumar", "EmpID": "AMD_065", "Type": "Desktop", "Brand": "HP", "Model": "400G6 A/O360J9PA", "AssetID": "AMD-DES-BA-0181", "Additional": "Monitor, Keyboard, Mouse", "Location": "Delhi", "Condition": ""},
  {"Sl": 3, "Name": "Avinashi Saxena", "EmpID": "AMD_115", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 5400", "AssetID": "ATS-LAP-AI-0258", "Additional": "", "Location": "Delhi", "Condition": ""},
  {"Sl": 4, "Name": "Md kashif Faridi", "EmpID": "AMD_142", "Type": "Laptop", "Brand": "HP", "Model": "G40 G10", "AssetID": "AMD-LAP-BD-0264", "Additional": "", "Location": "Delhi", "Condition": ""},
  {"Sl": 5, "Name": "tushar gupta", "EmpID": "", "Type": "Laptop", "Brand": "", "Model": "", "AssetID": "AMD-LAP-BC-0182", "Additional": "", "Location": "Delhi", "Condition": ""},
  {"Sl": 6, "Name": "Sonik Kumar", "EmpID": "AMD_150", "Type": "Laptop", "Brand": "Lenovo", "Model": "LOQ 15IRX9", "AssetID": "AMD-LAP-BB-0039", "Additional": "", "Location": "Delhi", "Condition": ""},
  {"Sl": 7, "Name": "Kumar Sourav", "EmpID": "AMD_151", "Type": "Laptop", "Brand": "HP", "Model": "ProBook 430 G8 Notbook", "AssetID": "AMD-LAP-BE-0036", "Additional": "", "Location": "Delhi", "Condition": "New"},
  {"Sl": 8, "Name": "Sankha Suvra Bandyopadhyay", "EmpID": "AMD_160", "Type": "Laptop", "Brand": "Lenovo", "Model": "ThinkPad L14 Gen 5", "AssetID": "AMD-LAP-BE-0069", "Additional": "", "Location": "Delhi", "Condition": "New"},
  {"Sl": 9, "Name": "Suvarna Kumar Thanniru", "EmpID": "AMD_172", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 7490", "AssetID": "AMD-LAP-BD-0163", "Additional": "", "Location": "Delhi", "Condition": "New"},
  {"Sl": 10, "Name": "Deb Kishor Roy", "EmpID": "ASSP_007", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad", "AssetID": "ASSP-LAP-BA-0271", "Additional": "", "Location": "Delhi", "Condition": ""},
  {"Sl": 11, "Name": "Chandan Yadav", "EmpID": "ASSP_029", "Type": "Laptop", "Brand": "HP", "Model": "240 G10", "AssetID": "ASSP-LAP-BD-0262", "Additional": "", "Location": "Delhi", "Condition": ""},
  {"Sl": 12, "Name": "Dipta Manna", "EmpID": "ASSP_050", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 3420", "AssetID": "ASSP-LAP-BC-0155", "Additional": "", "Location": "Delhi", "Condition": ""}
];

async function main() {
    let conflicts: string[] = [];
    const assetIdCounts: Record<string, number> = {};
    
    for (const item of rawData) {
        if (item.AssetID) {
            assetIdCounts[item.AssetID] = (assetIdCounts[item.AssetID] || 0) + 1;
        }
    }
    
    for (const [id, count] of Object.entries(assetIdCounts)) {
        if (count > 1) {
            conflicts.push(`CRITICAL CONFLICT: Asset ID ${id} appears ${count} times in the sheet!`);
        }
    }

    for (const item of rawData) {
        let user = null;
        if (item.EmpID) {
            user = await prisma.user.findFirst({ where: { employeeId: item.EmpID } });
        }
        if (!user && item.Name) {
            user = await prisma.user.findFirst({ where: { name: { contains: item.Name.trim() } } });
        }

        if (!user && item.Name) {
            conflicts.push(`User not found: ${item.Name} (${item.EmpID || 'No ID'})`);
        }

        if (item.AssetID) {
            const existingAsset = await prisma.asset.findFirst({ where: { assetId: item.AssetID }, include: { user: true } });
            if (existingAsset) {
                if (existingAsset.assigneeId && existingAsset.assigneeId !== user?.id) {
                    conflicts.push(`Conflict: Asset ${item.AssetID} is currently assigned to ${existingAsset.user?.name}, but sheet assigns it to ${user?.name || item.Name}.`);
                }
            }
        }
    }

    fs.writeFileSync('C:/Users/EAravinthkumar/.gemini/antigravity/brain/92896137-1476-4a04-9f57-5058f8ec32e9/asset_conflicts_5.md', '# Asset Conflicts Report 5\n\n' + conflicts.map(c => `- ${c}`).join('\n'));
    console.log(`Generated conflict report with ${conflicts.length} notices.`);
}

main().finally(() => prisma.$disconnect());
