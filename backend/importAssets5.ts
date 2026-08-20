import { PrismaClient } from '@prisma/client';

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
    let processed = 0;

    for (const item of rawData) {
        if (!item.AssetID) continue; 

        let user = null;
        let remarks = "";
        let status = 'In Stock';
        
        if (item.Condition) remarks += `Condition: ${item.Condition}. `;
        if (item.Additional) remarks += `Additional: ${item.Additional}. `;

        if (item.EmpID) {
            user = await prisma.user.findFirst({ where: { employeeId: item.EmpID } });
        }
        if (!user && item.Name) {
            user = await prisma.user.findFirst({ where: { name: { contains: item.Name.trim() } } });
        }

        let assignedUserId: number | null = user?.id || null;
        let assignedUserName: string = user?.name || "Unassigned";

        if (item.Name === "tushar gupta") {
            // Missing user, leave unassigned
            assignedUserId = null;
            assignedUserName = "Unassigned";
            remarks += "Intended for tushar gupta. ";
        }

        status = assignedUserId ? 'Assigned' : 'In Stock';

        let name = `${item.Brand} ${item.Model}`.trim();
        if (name === "") name = "Unknown Laptop";

        const data = {
            name: name,
            category: item.Type === 'Desktop' ? 'Desktop' : 'Laptop',
            brand: item.Brand || 'Unknown',
            model: item.Model || 'Unknown',
            status: status,
            remarks: remarks.trim(),
            assigneeId: assignedUserId,
            assigneeType: assignedUserId ? 'User' : null,
            userId: assignedUserId,
            serialNumber: 'TBD',
            location: item.Location,
        };

        const existingAsset = await prisma.asset.findFirst({ where: { assetId: item.AssetID } });
        if (existingAsset) {
            await prisma.asset.update({
                where: { id: existingAsset.id },
                data
            });
            console.log(`Updated asset ${item.AssetID} for ${assignedUserName}`);
        } else {
            await prisma.asset.create({
                data: {
                    ...data,
                    assetId: item.AssetID
                }
            });
            console.log(`Created asset ${item.AssetID} for ${assignedUserName}`);
        }
        processed++;
    }

    console.log(`Finished processing ${processed} assets.`);
}

main().finally(() => prisma.$disconnect());
