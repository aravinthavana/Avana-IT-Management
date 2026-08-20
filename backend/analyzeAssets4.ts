import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

const rawData = [
  {"Sl": 1, "Name": "Srinivasan M", "EmpID": "AMD_002", "Type": "Laptop", "Brand": "Lenovo", "Model": "E14 Gen 7", "AssetID": "AMD-LAP-BF-0170", "Additional": "Monitor, Keyboard, Mouse", "Location": "Chennai", "Condition": "New"},
  {"Sl": 2, "Name": "Kumaresan M", "EmpID": "AMD_005", "Type": "Laptop", "Brand": "Lenovo", "Model": "ThinkPad T14 Gen 2", "AssetID": "ATS-LAP-BA-0010", "Additional": "Mouse", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 3, "Name": "Singaravel S", "EmpID": "AMD_007", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 3410", "AssetID": "ATS-LAP-BA-0009", "Additional": "", "Location": "Chennai", "Condition": "Fair"},
  {"Sl": 4, "Name": "Anand A", "EmpID": "AMD_010", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad T480", "AssetID": "AMD-LAP-AH-0003", "Additional": "", "Location": "Chennai", "Condition": "Fair"},
  {"Sl": 7, "Name": "Prabakaran P", "EmpID": "AMD_026", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad L14", "AssetID": "AMD-LAP-BD-0178", "Additional": "", "Location": "Chennai", "Condition": "In Repair"},
  {"Sl": 8, "Name": "Richard Abheek Biswas", "EmpID": "AMD_031", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad L14 Gen 2", "AssetID": "AMD-LAP-BE-0004", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 9, "Name": "Sakthivel P", "EmpID": "AMD_037", "Type": "Laptop", "Brand": "Lenovo", "Model": "ThinkBook 14", "AssetID": "AMD-LAP-BE-0044", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 10, "Name": "Praveen Raghavendra", "EmpID": "AMD_038", "Type": "Laptop", "Brand": "Apple", "Model": "Macbook Air", "AssetID": "AMD-LAP-BE-0161", "Additional": "Mouse", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 11, "Name": "Sathish S", "EmpID": "AMD_039", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad L14", "AssetID": "AMD-LAP-BD-0179", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 12, "Name": "Sutheesh R", "EmpID": "AMD_052", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 7480", "AssetID": "AMD-LAP-AG-0261", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 14, "Name": "Nachiyappan N", "EmpID": "AMD_061", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 5300", "AssetID": "AMD-LAP-BD-0180", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 15, "Name": "Rajan E", "EmpID": "AMD_063", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad L14", "AssetID": "AMD-LAP-B0-0005", "Additional": "Mouse", "Location": "Chennai", "Condition": "New"},
  {"Sl": 16, "Name": "Vignesh M", "EmpID": "AMD_069", "Type": "Laptop", "Brand": "HP", "Model": "HP 240 G10", "AssetID": "AMD-LAP-BE-0059", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 17, "Name": "Dinesh Kumar A", "EmpID": "AMD_079", "Type": "Laptop", "Brand": "HP", "Model": "240 G10", "AssetID": "ATS-LAP-BE-0151", "Additional": "Mouse, USB to RJ45", "Location": "Chennai", "Condition": "New"},
  {"Sl": 18, "Name": "Ranjith T", "EmpID": "AMD_090", "Type": "Laptop", "Brand": "HP", "Model": "EliteBook 840 G7", "AssetID": "ATS-LAP-BE-0013", "Additional": "Mouse, USB to RJ45", "Location": "Chennai", "Condition": "New"},
  {"Sl": 19, "Name": "Malini A", "EmpID": "AMD_091", "Type": "Laptop", "Brand": "Lenovo", "Model": "(ThinkPad) - E14", "AssetID": "ATS-LAP-BA-0012", "Additional": "Mouse", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 20, "Name": "Sudarsan R", "EmpID": "AMD_101", "Type": "Laptop", "Brand": "HP", "Model": "ProBook 430 G8 Notbook", "AssetID": "AMD-LAP-BE-0038", "Additional": "", "Location": "Chennai", "Condition": "New"},
  {"Sl": 22, "Name": "Karthick S", "EmpID": "AMD_131", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad L13 Yoga ", "AssetID": "AMD-LAP-BA-0006", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 23, "Name": "Suganthan L", "EmpID": "AMD_134", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad L14", "AssetID": "AMD-LAP-BE-0008", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 25, "Name": "Aravinth Kumar", "EmpID": "AMD_145", "Type": "Laptop", "Brand": "DELL", "Model": "Latitude 7390", "AssetID": "ATS-LAP-BB-0014", "Additional": "Pendrive", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 27, "Name": "Sujithra Nagarajan", "EmpID": "AMD_155", "Type": "Laptop", "Brand": "HP", "Model": "HP 240R 14 inch G9", "AssetID": "AMD-LAP-AI-0020", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 28, "Name": "Gnana Sekar p", "EmpID": "AMD_157", "Type": "Laptop", "Brand": "Lenovo", "Model": "ThinkBook 14", "AssetID": "AMD-LAP-BE-0064", "Additional": "", "Location": "Chennai", "Condition": "New - In repair"},
  {"Sl": 30, "Name": "Sureshgobi SR", "EmpID": "AMD_166", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad L14", "AssetID": "AMD-LAP-BD-0156", "Additional": "Wireless Keyboard & Mouse Combo", "Location": "Chennai", "Condition": "New"},
  {"Sl": 31, "Name": "Lokshni D", "EmpID": "AMD_167", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude", "AssetID": "AMD-LAP-BE-0157", "Additional": "Mouse, USB hub, Headphone", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 32, "Name": "Shanmugam M", "EmpID": "AMD_169", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad L14", "AssetID": "AMD-LAP-BE-0158", "Additional": "", "Location": "Chennai", "Condition": "New"},
  {"Sl": 35, "Name": "Sam Joshua A", "EmpID": "AMD_173", "Type": "Laptop", "Brand": "HP", "Model": "EliteBook 840", "AssetID": "AMD-LAP-BF-0166", "Additional": "", "Location": "Chennai", "Condition": "New"},
  {"Sl": 36, "Name": "Abhinandh MD", "EmpID": "AMD_174", "Type": "Laptop", "Brand": "HP", "Model": "EliteBook 840", "AssetID": "AMD-LAP-BF-0165", "Additional": "", "Location": "Chennai", "Condition": "New"},
  {"Sl": 37, "Name": "Manikandan S", "EmpID": "AMD_175", "Type": "Laptop", "Brand": "HP", "Model": "EliteBook 840", "AssetID": "AMD-LAP-BF-0167", "Additional": "", "Location": "Chennai", "Condition": "New"},
  {"Sl": 38, "Name": "Aryan Malhotra", "EmpID": "AMD_176", "Type": "Laptop", "Brand": "Own Laptop", "Model": "", "AssetID": "", "Additional": "", "Location": "Chennai", "Condition": ""},
  {"Sl": 39, "Name": "Jagadeeswaran T", "EmpID": "AMD_177", "Type": "Laptop", "Brand": "HP", "Model": "EliteBook 840", "AssetID": "AMD-LAP-BF-0168", "Additional": "", "Location": "Chennai", "Condition": "New"},
  {"Sl": 40, "Name": "Ramesh Arunachalam", "EmpID": "ASSP_002", "Type": "Laptop", "Brand": "HP", "Model": "G40 G10", "AssetID": "ASSP-LAP-BD-0028", "Additional": "", "Location": "Chennai", "Condition": ""},
  {"Sl": 41, "Name": "Y Azgar Hussain", "EmpID": "ASSP_003", "Type": "Laptop", "Brand": "Apple", "Model": "Macbook Air", "AssetID": "ASSP-LAP-BD-0225", "Additional": "", "Location": "Chennai", "Condition": ""},
  {"Sl": 42, "Name": "Manikandan M", "EmpID": "ASSP_005", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad", "AssetID": "ASSP-LAP-BE-0226", "Additional": "", "Location": "Chennai", "Condition": ""},
  {"Sl": 43, "Name": "Ashok  Krishna Raj", "EmpID": "ASSP_010", "Type": "Laptop", "Brand": "HP", "Model": "Pavilion 14", "AssetID": "ASSP-LAP-BD-0263", "Additional": "", "Location": "Chennai", "Condition": ""},
  {"Sl": 44, "Name": "Bubesh  Kumar", "EmpID": "ASSP_012", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad L14 Gen 2", "AssetID": "ASSP-LAP-BB-0016", "Additional": "Monitor, Keyboard, Mouse, LAN to Type C", "Location": "Chennai", "Condition": "New"},
  {"Sl": 45, "Name": "Ajay Tanwar - Naresh Babu D", "EmpID": "ASSP_013", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 7490", "AssetID": "ASSP-LAP-BD-0281", "Additional": "", "Location": "Delhi", "Condition": "Battery issue"},
  {"Sl": 46, "Name": "Navaneetha Krishnan", "EmpID": "ASSP_015", "Type": "Laptop", "Brand": "HP", "Model": "250 15.6 inch G10 Notebook", "AssetID": "ASSP-LAP-BD-0017", "Additional": "Monitor, Keyboard, Mouse, SD Card Reader, USB Hub, External SSD", "Location": "Chennai", "Condition": "In Repair"},
  {"Sl": 47, "Name": "Sathish Kumar A", "EmpID": "ASSP_019", "Type": "Laptop", "Brand": "HP", "Model": "HP 240R 14 inch G9", "AssetID": "ASSP-LAP-00-0224", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 48, "Name": "Kishore Kumar", "EmpID": "ASSP_022", "Type": "Laptop", "Brand": "HP", "Model": "HP Zbook Firefly 14 G7", "AssetID": "ASSP-LAP-BD-0128", "Additional": "", "Location": "Chennai", "Condition": "Fair"},
  {"Sl": 49, "Name": "Pushkar Dnyaneshwar Morankar", "EmpID": "ASSP_028", "Type": "Laptop", "Brand": "Lenovo", "Model": "ThinkPad  X1 Carbon", "AssetID": "ASSP-LAP-BB-0034", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 50, "Name": "Hari Hara Sudhan M", "EmpID": "ASSP_035", "Type": "Laptop", "Brand": "HP", "Model": "G50 G10", "AssetID": "ASSP-LAP-BD-0257", "Additional": "", "Location": "Chennai", "Condition": "Good"},
  {"Sl": 51, "Name": "Srinivasaraja S", "EmpID": "AMD_106", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad T14", "AssetID": "AMD-LAP-BC-0265", "Additional": "", "Location": "Chennai", "Condition": ""},
  {"Sl": 57, "Name": "Pushparaj", "EmpID": "ASSP_052", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude  7420", "AssetID": "ASSP-LAP-BE-0228", "Additional": "", "Location": "Chennai", "Condition": "New"},
  {"Sl": 58, "Name": "ATS Service", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 3400", "AssetID": "ATS-LAP-BC-0229", "Additional": "", "Location": "Chennai", "Condition": "Fair"},
  {"Sl": 59, "Name": "Pushpavasagan", "EmpID": "", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkbook 14", "AssetID": "ASSP-LAP-BE-0230", "Additional": "", "Location": "Chennai", "Condition": "New"},
  {"Sl": 60, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 3410", "AssetID": "AMD-LAP-BA-0232", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 61, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 3410", "AssetID": "AMD-LAP-BA-0233", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 62, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 3410", "AssetID": "ASSP-LAP-BA-0234", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 63, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad X250", "AssetID": "AMD-LAP-BA-0235", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 64, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad X1 Carbon", "AssetID": "AMD-LAP-BB-0236", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 65, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "Inspiron 15", "AssetID": "ASSP-LAP-BA-0237", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 66, "Name": "Not Assigned", "EmpID": "", "Type": "Laptop", "Brand": "Apple", "Model": "Macbook Air", "AssetID": "AMD-LAP-AH-0238", "Additional": "", "Location": "Chennai", "Condition": "Fair"},
  {"Sl": 67, "Name": "Not Assigned", "EmpID": "", "Type": "Laptop", "Brand": "Apple", "Model": "Macbook Air", "AssetID": "AMD-LAP-AH-0239", "Additional": "", "Location": "Chennai", "Condition": "Fair"},
  {"Sl": 68, "Name": "Hemant Singh", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 3400", "AssetID": "AMD-LAP-AI-0240", "Additional": "", "Location": "Delhi", "Condition": "Fair"},
  {"Sl": 69, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "HP", "Model": "Pavilion", "AssetID": "AMD-LAP-B0-0241", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 70, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "Inspiron 15", "AssetID": "AMD-LAP-BA-0242", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 71, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "E7250", "AssetID": "AMD-LAP-AE-0243", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 72, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "HP", "Model": "Pavilion x360", "AssetID": "AMD-LAP-BA-0244", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 73, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "HP", "Model": "Pavilion x360", "AssetID": "AMD-LAP-BA-0245", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 74, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "HP", "Model": "Pavilion x360", "AssetID": "AMD-LAP-BA-0246", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 75, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "Inspiron 11", "AssetID": "AMD-LAP-AI-0247", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 76, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 7280", "AssetID": "AMD-LAP-AI-0248", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 77, "Name": "Not Working", "EmpID": "", "Type": "Laptop", "Brand": "Dell", "Model": "Latitude 7280", "AssetID": "AMD-LAP-AI-0249", "Additional": "", "Location": "Chennai", "Condition": "Not Working - Very old"},
  {"Sl": 78, "Name": "Sourabh Joshi", "EmpID": "", "Type": "Laptop", "Brand": "Lenovo", "Model": "E14 Gen 7", "AssetID": "AMD-LAP-BF-0174", "Additional": "", "Location": "Delhi", "Condition": "New"},
  {"Sl": 79, "Name": "Not Assigned - New", "EmpID": "", "Type": "Laptop", "Brand": "Lenovo", "Model": "E14 Gen 7", "AssetID": "AMD-LAP-BF-0175", "Additional": "", "Location": "Chennai", "Condition": "New"},
  {"Sl": 80, "Name": "Not Assigned - New", "EmpID": "", "Type": "Laptop", "Brand": "Lenovo", "Model": "E14 Gen 7", "AssetID": "AMD-LAP-BF-0176", "Additional": "", "Location": "Chennai", "Condition": "New"},
  {"Sl": 81, "Name": "Kamal Nath", "EmpID": "", "Type": "Laptop", "Brand": "HP", "Model": "240 G10", "AssetID": "AMD-LAP-BD-0250", "Additional": "", "Location": "Ranchi", "Condition": "Good"},
  {"Sl": 82, "Name": "Srinivasan", "EmpID": "", "Type": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad", "AssetID": "AMD-LAP-BC-0227", "Additional": "", "Location": "Chennai", "Condition": "Fair"}
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

    const nonUsers = ["Not Working", "Not Assigned", "Not Assigned - New", "ATS Service"];
    
    for (const item of rawData) {
        let user = null;
        if (item.EmpID) {
            user = await prisma.user.findFirst({ where: { employeeId: item.EmpID } });
        }
        if (!user && item.Name && !nonUsers.includes(item.Name)) {
            user = await prisma.user.findFirst({ where: { name: { contains: item.Name.trim() } } });
        }

        if (!user && item.Name && !nonUsers.includes(item.Name)) {
            conflicts.push(`User not found: ${item.Name} (${item.EmpID || 'No ID'})`);
        } else if (nonUsers.includes(item.Name)) {
            conflicts.push(`Notice: Asset ${item.AssetID} is ${item.Name}. It will be added but left Unassigned.`);
        }

        if (item.AssetID) {
            const existingAsset = await prisma.asset.findFirst({ where: { assetId: item.AssetID }, include: { user: true } });
            if (existingAsset) {
                if (existingAsset.assigneeId && existingAsset.assigneeId !== user?.id && !nonUsers.includes(item.Name)) {
                    conflicts.push(`Conflict: Asset ${item.AssetID} is currently assigned to ${existingAsset.user?.name}, but sheet assigns it to ${user?.name || item.Name}.`);
                }
            }
        }
    }

    fs.writeFileSync('C:/Users/EAravinthkumar/.gemini/antigravity/brain/92896137-1476-4a04-9f57-5058f8ec32e9/asset_conflicts_4.md', '# Asset Conflicts Report 4\n\n' + conflicts.map(c => `- ${c}`).join('\n'));
    console.log(`Generated conflict report with ${conflicts.length} notices.`);
}

main().finally(() => prisma.$disconnect());
