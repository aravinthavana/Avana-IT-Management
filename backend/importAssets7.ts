import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rawData = [
  {"Name": "Kshitij Rajebhosale", "Type": "Laptop", "Location": "Mumbai", "Brand": "Dell", "Model": "Latitude 3400", "SN": "3JDD463", "OS": "Win 11 Pro 64-bit", "Storage": "256 GB + 1TB", "RAM": "16GB", "CPU": "Intel(R) Core(TM) i5-8265U CPU @ 1.60GHz", "Year": "2024", "AssetID": "AMD-LAP-BD-0000"},
  {"Name": "Pavithran V", "Type": "Desktop", "Location": "Chennai", "Brand": "ASUS", "Model": "N/A", "SN": "N/A", "OS": "Win 11 Pro 64-bit", "Storage": "232.88 GB (Other)", "RAM": "8GB", "CPU": "12th Gen Intel(R) Core(TM) i5-12400", "Year": "2022", "AssetID": "AMD-DES-BB-0001"},
  {"Name": "Roshini S", "Type": "Desktop", "Location": "Chennai", "Brand": "Gigabyte Technology Co., Ltd.", "Model": "B760M GAMING DDR4", "SN": "96YF872", "OS": "Win 11 Pro 64-bit", "Storage": "223.57 GB (SSD)", "RAM": "16GB", "CPU": "12th Gen Intel(R) Core(TM) i5-12400", "Year": "2025", "AssetID": "AMD-DES-BE-0002"},
  {"Name": "Ajith Kumar A", "Type": "Desktop", "Location": "Chennai", "Brand": "ASUS", "Model": "N/A", "SN": "N/A", "OS": "Win 11 Pro 64-bit", "Storage": "465.76 GB (NVMe/SAS SSD)", "RAM": "16GB", "CPU": "12th Gen Intel(R) Core(TM) i5-12400", "Year": "2024", "AssetID": "AMD-DES-BD-0003"},
  {"Name": "Anitha V", "Type": "Desktop", "Location": "Chennai", "Brand": "Gigabyte Technology Co., Ltd.", "Model": "B760M GAMING AC", "SN": "N/A", "OS": "Win 11 Pro 64-bit", "Storage": "465.76 GB (NVMe/SAS SSD)", "RAM": "16GB", "CPU": "12th Gen Intel(R) Core(TM) i5-12400", "Year": "2023", "AssetID": "AMD-DES-BC-0004"},
  {"Name": "Bhuvanesh Ravi", "Type": "Desktop", "Location": "Chennai", "Brand": "ASUS", "Model": "N/A", "SN": "N/A", "OS": "Win 11 Pro 64-bit", "Storage": "465.76 GB (NVMe/SAS SSD)", "RAM": "16GB", "CPU": "12th Gen Intel(R) Core(TM) i5-12400", "Year": "2024", "AssetID": "AMD-DES-BD-0005"},
  {"Name": "Silambarasan G", "Type": "Desktop", "Location": "Chennai", "Brand": "Asus", "Model": "Prime B760M-A", "SN": "N/A", "OS": "Win 11 Pro 64-bit", "Storage": "128GB SSD", "RAM": "16GB", "CPU": "12th Gen Intel Core i5 12400 @2.50 GHz", "Year": "2023", "AssetID": "AMD-DES-BC-0006"},
  {"Name": "Siva Sankar A", "Type": "Desktop", "Location": "Chennai", "Brand": "HP", "Model": "HP ProDesk 400 G6", "SN": "1N113501YS", "OS": "Win 11 Pro 64-bit", "Storage": "500GB SSD", "RAM": "16GB", "CPU": "Intel Core i5-10500T @ 2.30GHz", "Year": "2023", "AssetID": "AMD-DES-BC-0007"},
  {"Name": "ManiKandan B", "Type": "Desktop", "Location": "Chennai", "Brand": "LENOVO", "Model": "F0DT009WIN", "SN": "MP1FMCA1", "OS": "Win 10 Home 64-bit", "Storage": "238.47 GB (NVMe/SAS SSD)", "RAM": "12GB", "CPU": "Intel(R) Core(TM) i3-8100T CPU @ 3.10GHz", "Year": "2018", "AssetID": "AMD-DES-AH-0008"}
];

async function main() {
    let processed = 0;

    for (const item of rawData) {
        if (!item.AssetID) continue; 

        const user = await prisma.user.findFirst({ where: { name: item.Name } });

        let remarks = `Specs: ${item.OS}, ${item.RAM}, ${item.Storage}, ${item.CPU}. Year: ${item.Year}`;

        let assignedUserId: number | null = user?.id || null;
        let assignedUserName: string = user?.name || "Unassigned";
        
        let status = assignedUserId ? 'Assigned' : 'In Stock';

        let name = `${item.Brand} ${item.Model}`.trim();
        if (name.endsWith("N/A")) name = item.Brand; // "ASUS N/A" -> "ASUS"

        const data = {
            name: name,
            category: item.Type === 'Desktop' ? 'Desktop' : 'Laptop',
            brand: item.Brand,
            model: item.Model === "N/A" ? "" : item.Model,
            status: status,
            remarks: remarks,
            assigneeId: assignedUserId,
            assigneeType: assignedUserId ? 'User' : null,
            userId: assignedUserId,
            serialNumber: item.SN === "N/A" ? 'TBD' : item.SN,
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
