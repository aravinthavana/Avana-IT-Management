import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Create Manikanta
    let manikanta = await prisma.user.findFirst({ where: { employeeId: 'AMD_073' } });
    if (!manikanta) {
        manikanta = await prisma.user.create({
            data: {
                name: 'Manikanta',
                email: 'manikanta@avana.com',
                employeeId: 'AMD_073',
                role: 'User',
                status: 'Active',
                password: 'password123'
            }
        });
        console.log('Created user Manikanta (AMD_073)');
    }

    // 2. Add Kaleeshwaran's Desktop
    const user = await prisma.user.findFirst({ where: { name: { contains: 'Kaleeshwaran' } } });
    if (user) {
        const item = {
            "Brand": "Dell Inc.",
            "Model": "Inspiron 20-3059",
            "SN": "96YF872",
            "OS": "Win 10 Pro 64-bit",
            "Storage": "931.51 GB (Other)",
            "RAM": "12GB",
            "CPU": "Intel(R) Core(TM) i3-6100U CPU @ 2.30GHz",
            "Year": "2019",
            "AssetID": "AMD-DES-AI-0026",
            "Location": "Chennai"
        };
        
        let remarks = `Specs: ${item.OS}, ${item.RAM}, ${item.Storage}, ${item.CPU}. Year: ${item.Year}`;

        const data = {
            name: `${item.Brand} ${item.Model}`.trim(),
            category: 'Desktop',
            brand: item.Brand,
            model: item.Model,
            status: 'Assigned',
            remarks: remarks,
            assigneeId: user.id,
            assigneeType: 'User',
            userId: user.id,
            serialNumber: item.SN,
            location: item.Location,
        };

        const existingAsset = await prisma.asset.findFirst({ where: { assetId: item.AssetID } });
        if (existingAsset) {
            await prisma.asset.update({
                where: { id: existingAsset.id },
                data
            });
            console.log(`Updated asset ${item.AssetID} for Kaleeshwaran`);
        } else {
            await prisma.asset.create({
                data: {
                    ...data,
                    assetId: item.AssetID
                }
            });
            console.log(`Created asset ${item.AssetID} for Kaleeshwaran`);
        }
    } else {
        console.log('WARNING: Kaleeshwaran not found');
    }

}

main().finally(() => prisma.$disconnect());
