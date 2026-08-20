import { PrismaClient } from '@prisma/client';

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
  { "Name": "Senthil Kumar Shanmugam", "Emp ID": "AMD_057", "Type": "Laptop", "Brand": "HP", "Model": "HP PROBOOK 440 G7", "Asset ID": "AMD-LAP-B0-0046", "Additional": "", "Condition": "" }
  // Omitted "Store System" to resolve duplicate asset ID AMD-DES-BC-0048
];

async function main() {
    let processed = 0;

    for (const item of rawData) {
        let user = null;
        if (item["Emp ID"]) {
            user = await prisma.user.findFirst({ where: { employeeId: item["Emp ID"] } });
        }
        if (!user && item.Name) {
            let searchName = item.Name.trim();
            user = await prisma.user.findFirst({ where: { name: { contains: searchName } } });
        }

        const type = item.Type.toLowerCase();
        const hasNoLaptop = ["n/a", "no laptop"].includes(type);
        
        // Ensure no laptop if specified
        if (user && hasNoLaptop) {
            await prisma.asset.updateMany({
                where: { assigneeId: user.id },
                data: { assigneeId: null, assigneeType: null, status: 'In Stock' }
            });
            console.log(`Unassigned all assets for ${user.name}`);
        }

        if (item["Asset ID"]) {
            let assignedUserId: number | null = user?.id || null;
            let assignedUserName: string = user?.name || "";

            // If user is not found, leave as unassigned.
            if (!user) {
                assignedUserId = null;
                assignedUserName = "Unassigned";
            }

            const status = assignedUserId ? 'Assigned' : 'In Stock';
            
            let remarks = "";
            if (item.Condition) remarks += `Condition: ${item.Condition}. `;
            if (item.Additional) remarks += `Additional: ${item.Additional}. `;

            const data = {
                name: `${item.Brand} ${item.Model}`.trim(),
                category: item.Type === 'Desktop' ? 'Desktop' : 'Laptop',
                brand: item.Brand,
                model: item.Model,
                status: status,
                remarks: remarks.trim(),
                assigneeId: assignedUserId,
                assigneeType: assignedUserId ? 'user' : null,
                userId: assignedUserId,
                serialNumber: 'TBD',
            };

            const existingAsset = await prisma.asset.findFirst({ where: { assetId: item["Asset ID"] } });
            if (existingAsset) {
                await prisma.asset.update({
                    where: { id: existingAsset.id },
                    data
                });
                console.log(`Updated asset ${item["Asset ID"]} for ${assignedUserName}`);
            } else {
                await prisma.asset.create({
                    data: {
                        ...data,
                        assetId: item["Asset ID"]
                    }
                });
                console.log(`Created asset ${item["Asset ID"]} for ${assignedUserName}`);
            }
            processed++;
        }
    }

    console.log(`Finished processing ${processed} assets.`);
}

main().finally(() => prisma.$disconnect());
