import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rawData = [
  { name: "Manish Gautam", empId: "AMD_009", type: "Laptop", brand: "Apple", model: "Macbook Air", assetId: "AMD-LAP-BD-0162", additional: "Mouse", condition: "" },
  { name: "Sachin Kisan Talekar", empId: "AMD_013", type: "Laptop", brand: "", model: "", assetId: "", additional: "", condition: "" },
  { name: "Not Assigned", empId: "", type: "Laptop", brand: "Dell", model: "Latitude 3400", assetId: "AMD-LAP-BD-0138", additional: "", condition: "Display Damaged" },
  { name: "Chetan Keshaorao Ippar", empId: "AMD_098", type: "Laptop", brand: "Dell", model: "Latitude 3400", assetId: "ATS-LAP-B0-0259", additional: "", condition: "" },
  { name: "Abhishek Dubey", empId: "AMD_105", type: "Laptop", brand: "", model: "", assetId: "", additional: "", condition: "" },
  { name: "Jaimin Shaha(Akshay Amrutkar)", empId: "AMD_108", type: "Laptop", brand: "Lenovo", model: "Thinkpad", assetId: "AMD-LAP-BD-0201", additional: "", condition: "" },
  { name: "Avichal Anil Hirekhan", empId: "AMD_143", type: "Laptop", brand: "Lenovo", model: "ThinkPad L14", assetId: "AMD-LAP-BE-0199", additional: "", condition: "" },
  { name: "Mohamed shafique Rao", empId: "AMD_156", type: "Laptop", brand: "Lenovo", model: "ThinkPad L14 Gen 5", assetId: "AMD-LAP-BE-0062", additional: "", condition: "New" },
  { name: "Mehul Shah", empId: "AMD_178", type: "Laptop", brand: "Lenovo", model: "ThinkBook 14 G2", assetId: "AMD-LAP-BD-0172", additional: "", condition: "" },
  { name: "Prachi Rinesh Palshetkar", empId: "AMD_180", type: "Laptop", brand: "Lenovo", model: "Thinkpad L14", assetId: "AMD-LAP-BD-0171", additional: "", condition: "" },
  { name: "Gyanu Devanarayan", empId: "AMD_181", type: "Laptop", brand: "Lenovo", model: "Thinkpad L14", assetId: "AMD-LAP-00-0202", additional: "", condition: "" },
  { name: "Sachin Sapkal", empId: "ASSP_016", type: "Laptop", brand: "Dell", model: "Latitude 7400", assetId: "ASSP-LAP-BB-0266", additional: "", condition: "" },
  { name: "Aaqib Perwez", empId: "ASSP_042", type: "Laptop", brand: "Lenovo", model: "Thinkpad L14 Gen 2", assetId: "ASSP-LAP-BE-0029", additional: "", condition: "New" },
  { name: "Anurag A. Singh", empId: "ASSP_046", type: "Laptop", brand: "Lenovo", model: "Thinkpad L14 Gen 2", assetId: "ASSP-LAP-BE-0063", additional: "", condition: "New" },
  { name: "Ravikumar Gupta", empId: "ASSP_048", type: "Laptop", brand: "Lenovo", model: "ThinkBoox 14", assetId: "ASSP-LAP-BE-0047", additional: "", condition: "" },
  { name: "Mayur Barot", empId: "AMD_189", type: "Laptop", brand: "Lenovo", model: "E14 Gen 7", assetId: "AMD-LAP-BF-0173", additional: "", condition: "New" },
  { name: "Samadhan", empId: "", type: "Laptop", brand: "Lenovo", model: "Thinkpad T480", assetId: "ATS-LAP-BD-0231", additional: "", condition: "Fair" },
  { name: "Kshitij Rajebhosale", empId: "AMD_077", type: "No Laptop", brand: "", model: "", assetId: "", additional: "", condition: "" }
];

async function main() {
    console.log('Starting asset update...');
    let processed = 0;

    for (const item of rawData) {
        if (!item.assetId && item.type !== 'No Laptop') {
            console.log(`Skipping ${item.name} as no asset ID is provided.`);
            continue;
        }

        let assignedUserId: number | null = null;
        let assignedUserName: string = "";

        // Special case: Kshitij Rajebhosale with No Laptop
        if (item.empId === "AMD_077" && item.type === "No Laptop") {
            const user = await prisma.user.findFirst({ where: { employeeId: "AMD_077" } });
            if (user) {
                // unassign all laptops for him
                await prisma.asset.updateMany({
                    where: { assigneeId: user.id, category: 'Laptop' },
                    data: { assigneeId: null, assigneeType: null, status: 'In Stock' }
                });
                console.log(`Unassigned laptops for ${user.name}`);
            }
            continue;
        }

        if (item.empId || item.name !== 'Not Assigned') {
            let user = null;
            if (item.empId) {
                user = await prisma.user.findFirst({ where: { employeeId: item.empId } });
            }
            if (!user && item.name) {
                user = await prisma.user.findFirst({ where: { name: { contains: item.name } } });
            }

            if (user) {
                assignedUserId = user.id;
                assignedUserName = user.name;
            } else {
                console.log(`Warning: Could not find user for ${item.name} (${item.empId})`);
            }
        }

        if (item.assetId) {
            const status = (item.condition === 'Display Damaged') ? 'In Repair' : (assignedUserId ? 'Assigned' : 'In Stock');
            
            let remarks = "";
            if (item.condition) remarks += `Condition: ${item.condition}. `;
            if (item.additional) remarks += `Additional: ${item.additional}. `;

            const data = {
                name: `${item.brand} ${item.model}`.trim(),
                category: 'Laptop',
                brand: item.brand,
                model: item.model,
                status: status,
                remarks: remarks.trim(),
                assigneeId: assignedUserId ? assignedUserId : null,
                userId: assignedUserId ? assignedUserId : null,
                assigneeType: assignedUserId ? 'user' : null,
                serialNumber: 'TBD',
            };

            const existingAsset = await prisma.asset.findFirst({ where: { assetId: item.assetId } });
            if (existingAsset) {
                await prisma.asset.update({
                    where: { id: existingAsset.id },
                    data
                });
                console.log(`Updated asset ${item.assetId} for ${assignedUserName || 'Unassigned'}`);
            } else {
                await prisma.asset.create({
                    data: {
                        ...data,
                        assetId: item.assetId
                    }
                });
                console.log(`Created asset ${item.assetId} for ${assignedUserName || 'Unassigned'}`);
            }
            processed++;
        }
    }
    console.log(`Finished processing ${processed} assets.`);
}

main().finally(() => prisma.$disconnect());
