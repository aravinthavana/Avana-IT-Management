import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rawData = [
  {"Sl": 1, "Name": "Avadhut Kaluskar", "EmpID": "AMD_008", "Type": "Laptop", "Brand": "Apple", "Model": "Macbook Air", "AssetID": "AMD-LAP-BE-0159", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 2, "Name": "Sridhara M.L", "EmpID": "AMD_053", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 5400", "AssetID": "AMD-LAP-00-0213", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 3, "Name": "Kiran B G", "EmpID": "AMD_056", "Type": "Desktop", "Brand": "Lenovo", "Model": "All in one", "AssetID": "AMD-DES-00-0205", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 4, "Name": "Manikanta", "EmpID": "AMD_073", "Type": "N/A", "Brand": "N/A", "Model": "N/A", "AssetID": "", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 5, "Name": "Savitha M", "EmpID": "AMD_076", "Type": "Laptop", "Brand": "LENOVO", "Model": "ThinkPad T480", "AssetID": "AMD-LAP-BC-0137", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 6, "Name": "Vinay R A", "EmpID": "AMD_118", "Type": "Laptop", "Brand": "LENOVO", "Model": "Thinkpad t14", "AssetID": "AMD-LAP-B0-0278", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 7, "Name": "Gokulakannan S", "EmpID": "AMD_122", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 3420", "AssetID": "AMD-LAP-BA-0007", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 8, "Name": "Vishnu Nair", "EmpID": "AMD_138", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 3400", "AssetID": "AMD-LAP-B0-0033", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 9, "Name": "Sabarinathan I", "EmpID": "AMD_149", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 3400", "AssetID": "AMD-LAP-B0-0057", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 10, "Name": "Subash  M", "EmpID": "ASSP_006", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad E14", "AssetID": "ASSP-LAP-BC-0269", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 11, "Name": "Sugumar R", "EmpID": "ASSP_017", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 7400", "AssetID": "ASSP-LAP-BB-0279", "Additional": "", "Location": "Bangalore", "Condition": ""},
  {"Sl": 12, "Name": "Keerthan M", "EmpID": "ASSP_047", "Type": "Laptop", "Brand": "Lenovo", "Model": "ThinkBook 14", "AssetID": "ASSP-LAP-BE-0067", "Additional": "", "Location": "Bangalore", "Condition": "New"}
];

async function main() {
    let processed = 0;

    for (const item of rawData) {
        if (item.Type === "N/A" || !item.AssetID) {
            // Unassign any existing assets for this N/A user
            if (item.EmpID) {
                const user = await prisma.user.findFirst({ where: { employeeId: item.EmpID } });
                if (user) {
                    await prisma.asset.updateMany({
                        where: { assigneeId: user.id },
                        data: { assigneeId: null, assigneeType: null, status: 'In Stock' }
                    });
                    console.log(`Unassigned all assets for ${user.name} (N/A User)`);
                }
            }
            continue; 
        }

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

        if (!user) {
            console.log(`WARNING: User not found for ${item.Name} (${item.EmpID})`);
        }

        status = assignedUserId ? 'Assigned' : 'In Stock';

        let name = `${item.Brand} ${item.Model}`.trim();
        if (name === "") name = "Unknown Asset";

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
