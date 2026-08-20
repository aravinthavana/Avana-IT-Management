import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rawData = [
  { "Sl No": 1, "Name": "Siva Praveen E", "Emp ID": "AMD_004", "Laptop/Desktop": "", "Brand": "", "Model": "", "Asset ID": "", "Additional": "", "Location": "Hyderabad", "Condition": "" },
  { "Sl No": 2, "Name": "Anas Azam", "Emp ID": "AMD_021", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad", "Asset ID": "AMD-LAP-AI-0267", "Additional": "", "Location": "Nagpur", "Condition": "Very Old - Need to Change" },
  { "Sl No": 3, "Name": "Kritibas Sahoo", "Emp ID": "AMD_022", "Laptop/Desktop": "No Laptop", "Brand": "N/A", "Model": "N/A", "Asset ID": "", "Additional": "", "Location": "Bhubaneswar", "Condition": "" },
  { "Sl No": 4, "Name": "Veeramaneni Kranthi", "Emp ID": "AMD_023", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Inspiron", "Asset ID": "AMD-LAP-AI-0272", "Additional": "", "Location": "Hyderabad", "Condition": "" },
  { "Sl No": 5, "Name": "Jayasish Dey", "Emp ID": "AMD_028", "Laptop/Desktop": "Laptop", "Brand": "DELL", "Model": "Latitude 3420", "Asset ID": "AMD-LAP-BA-0042", "Additional": "", "Location": "Kolkata", "Condition": "" },
  { "Sl No": 6, "Name": "Ashadip Kanungo", "Emp ID": "AMD_030", "Laptop/Desktop": "No Laptop", "Brand": "N/A", "Model": "N/A", "Asset ID": "", "Additional": "", "Location": "Bhubaneswar", "Condition": "" },
  { "Sl No": 7, "Name": "Robin Joseph", "Emp ID": "AMD_032", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Latitude 3420", "Asset ID": "AMD-LAP-BB-0282", "Additional": "", "Location": "Kerala", "Condition": "" },
  { "Sl No": 8, "Name": "Gaurang K. Prajapati", "Emp ID": "AMD_045", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad E14", "Asset ID": "AMD-LAP-BD-0164", "Additional": "", "Location": "Vadodara", "Condition": "" },
  { "Sl No": 9, "Name": "Selvamani C", "Emp ID": "AMD_054", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad X1 Carbon", "Asset ID": "AMD-LAP-BB-0068", "Additional": "", "Location": "Kerala", "Condition": "" },
  { "Sl No": 10, "Name": "Shaikh Abdul Raees", "Emp ID": "AMD_060", "Laptop/Desktop": "No Laptop", "Brand": "N/A", "Model": "N/A", "Asset ID": "", "Additional": "", "Location": "Mumbai", "Condition": "" },
  { "Sl No": 11, "Name": "Devi Prasad", "Emp ID": "AMD_062", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Latitude  7420", "Asset ID": "AMD-LAP-BE-0071", "Additional": "", "Location": "Mangalore", "Condition": "New" },
  { "Sl No": 12, "Name": "Santhosh V", "Emp ID": "AMD_082", "Laptop/Desktop": "using own", "Brand": "N/A", "Model": "N/A", "Asset ID": "", "Additional": "", "Location": "Coimbatore", "Condition": "" },
  { "Sl No": 13, "Name": "Khuzema Husain", "Emp ID": "AMD_083", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Latitude", "Asset ID": "AMD-LAP-BC-0283", "Additional": "", "Location": "Bhopal", "Condition": "" },
  { "Sl No": 14, "Name": "Amit Sayyad", "Emp ID": "AMD_085", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Inspiron", "Asset ID": "AMD-LAP-AI-0276", "Additional": "", "Location": "Pune", "Condition": "" },
  { "Sl No": 15, "Name": "Selva Murukan S", "Emp ID": "AMD_093", "Laptop/Desktop": "Laptop", "Brand": "", "Model": "", "Asset ID": "", "Additional": "", "Location": "Kerala", "Condition": "" },
  { "Sl No": 16, "Name": "Jaimin Shah(Unassigned)", "Emp ID": "AMD_096", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad", "Asset ID": "AMD-LAP-B0-0275", "Additional": "", "Location": "Ahmedabad", "Condition": "Display Damage" },
  { "Sl No": 17, "Name": "Lalith Sairam S V", "Emp ID": "AMD_100", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Latitude 3410", "Asset ID": "AMD-LAP-BC-0268", "Additional": "", "Location": "Bubaneswar", "Condition": "" },
  { "Sl No": 18, "Name": "Sudeep Sadesh Bose", "Emp ID": "AMD_107", "Laptop/Desktop": "Laptop", "Brand": "HP", "Model": "G40r G9", "Asset ID": "AMD-LAP-BC-0273", "Additional": "", "Location": "Ahmedabad", "Condition": "" },
  { "Sl No": 19, "Name": "Sonu Chandran", "Emp ID": "AMD_110", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad", "Asset ID": "AMD-LAP-B0-0277", "Additional": "", "Location": "Kerala", "Condition": "" },
  { "Sl No": 20, "Name": "Naresh Kumar Volla", "Emp ID": "AMD_112", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Latitude 7420", "Asset ID": "AMD-LAP-BE-0169", "Additional": "", "Location": "Hyderabad", "Condition": "New" },
  { "Sl No": 21, "Name": "Sudhir Rampujan Jaiswara", "Emp ID": "AMD_119", "Laptop/Desktop": "No Laptop", "Brand": "N/A", "Model": "N/A", "Asset ID": "", "Additional": "", "Location": "Ahmedabad", "Condition": "" },
  { "Sl No": 22, "Name": "Shabeer Ali", "Emp ID": "AMD_127", "Laptop/Desktop": "Laptop", "Brand": "HP", "Model": "G40 G10", "Asset ID": "AMD-LAP-BD-0270", "Additional": "", "Location": "Cochin", "Condition": "" },
  { "Sl No": 23, "Name": "Kapil Sharma", "Emp ID": "AMD_132", "Laptop/Desktop": "Own Laptop", "Brand": "N/A", "Model": "N/A", "Asset ID": "", "Additional": "", "Location": "Jaipur", "Condition": "" },
  { "Sl No": 24, "Name": "Robin Jonathap S", "Emp ID": "AMD_133", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "ThinkBook 14", "Asset ID": "AMD-LAP-BE-0043", "Additional": "", "Location": "Vellore", "Condition": "New" },
  { "Sl No": 25, "Name": "Rajesh Panda", "Emp ID": "AMD_139", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad L14 Gen2", "Asset ID": "AMD-LAP-BE-0280", "Additional": "", "Location": "Odisha", "Condition": "" },
  { "Sl No": 26, "Name": "Nitin Bhawsar", "Emp ID": "AMD_141", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Latitude 3410", "Asset ID": "AMD-LAP-BC-0274", "Additional": "", "Location": "Indore", "Condition": "" },
  { "Sl No": 27, "Name": "Dipendu Sarkar", "Emp ID": "AMD_144", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "ThinkBook 14", "Asset ID": "AMD-LAP-BE-0035", "Additional": "", "Location": "Kolkata", "Condition": "New" },
  { "Sl No": 28, "Name": "Arun Kumar", "Emp ID": "AMD_148", "Laptop/Desktop": "Laptop", "Brand": "HP", "Model": "ProBook 430 G8 Notbook", "Asset ID": "AMD-LAP-BE-0040", "Additional": "", "Location": "Cochin", "Condition": "New" },
  { "Sl No": 29, "Name": "Umesh Patil", "Emp ID": "AMD_153", "Laptop/Desktop": "Laptop", "Brand": "HP", "Model": "HP 250 G10", "Asset ID": "AMD-LAP-BE-0060", "Additional": "", "Location": "Pune", "Condition": "" },
  { "Sl No": 30, "Name": "Shanmukharao Avala", "Emp ID": "AMD_163", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Latitude  7420", "Asset ID": "AMD-LAP-BE-0152", "Additional": "", "Location": "Hyderabad", "Condition": "New" },
  { "Sl No": 31, "Name": "Dhurubajyoti Kashyap", "Emp ID": "AMD_164", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "XPS 13 9360", "Asset ID": "AMD-LAP-BD-0153", "Additional": "", "Location": "Guwahti", "Condition": "" },
  { "Sl No": 32, "Name": "Subhransu Sekhar Swain", "Emp ID": "AMD_179", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Dell Latitude 3400", "Asset ID": "AMD-LAP-B0-0011", "Additional": "", "Location": "Odisha", "Condition": "" },
  { "Sl No": 33, "Name": "Kathiravan M", "Emp ID": "ASSP_031", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Latitude  7420", "Asset ID": "ASSP-LAP-BE-0072", "Additional": "", "Location": "Hyderabad", "Condition": "New" },
  { "Sl No": 34, "Name": "Dheeraj .", "Emp ID": "ASSP_041", "Laptop/Desktop": "Laptop", "Brand": "HP", "Model": "ProBook 430 G8 Notbook", "Asset ID": "ASSP-LAP-BE-0037", "Additional": "", "Location": "Chandigarh", "Condition": "New" },
  { "Sl No": 35, "Name": "Yogeshwaran S", "Emp ID": "ASSP_044", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "ThinkBook 14", "Asset ID": "ASSP-LAP-BE-0041", "Additional": "", "Location": "Cochin", "Condition": "New" },
  { "Sl No": 36, "Name": "Sourabh Shete", "Emp ID": "ASSP_045", "Laptop/Desktop": "Laptop", "Brand": "HP", "Model": "ProBook 430 G8 Notbook", "Asset ID": "ASSP-LAP-BE-0058", "Additional": "", "Location": "Pune", "Condition": "New" },
  { "Sl No": 37, "Name": "Shashank Mishra", "Emp ID": "ASSP_049", "Laptop/Desktop": "Laptop", "Brand": "Dell", "Model": "Latitude 7420", "Asset ID": "ASSP-LAP-BE-0154", "Additional": "", "Location": "Pune", "Condition": "New" },
  { "Sl No": 38, "Name": "Vivek Sir", "Emp ID": "", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "ThinkPad L14 Gen 2", "Asset ID": "ASSP-LAP-BE-0129", "Additional": "", "Location": "Hyderabad", "Condition": "" },
  { "Sl No": 39, "Name": "MD Sundararajan", "Emp ID": "", "Laptop/Desktop": "Laptop", "Brand": "HP", "Model": "EliteBook 840 G7", "Asset ID": "AMD-LAP-BE-0065", "Additional": "", "Location": "Madurai", "Condition": "New" },
  { "Sl No": 40, "Name": "Sujeet Singh", "Emp ID": "", "Laptop/Desktop": "Laptop", "Brand": "HP", "Model": "ProBook 430 G8 Notebook", "Asset ID": "AMD-LAP-BE-0056", "Additional": "", "Location": "Lucknow", "Condition": "New" },
  { "Sl No": 41, "Name": "Aman Kumar Shukla", "Emp ID": "", "Laptop/Desktop": "Laptop", "Brand": "Lenovo", "Model": "Thinkpad T14s", "Asset ID": "AMD-LAP-BD-0070", "Additional": "", "Location": "Lucknow", "Condition": "" },
  { "Sl No": 42, "Name": "Siva Praveen E", "Emp ID": "", "Laptop/Desktop": "Laptop", "Brand": "LENOVO", "Model": "ThinkPad T480", "Asset ID": "AMD-LAP-AI-0066", "Additional": "", "Location": "Hyderabad", "Condition": "" },
  { "Sl No": 43, "Name": "Bhuvan Chandra", "Emp ID": "", "Laptop/Desktop": "Laptop", "Brand": "HP", "Model": "240 G10", "Asset ID": "ASSP-LAP-BD-0284", "Additional": "", "Location": "Hyderabad", "Condition": "" }
];

async function main() {
    let processed = 0;

    for (const item of rawData) {
        let user = null;
        if (item["Emp ID"]) {
            user = await prisma.user.findFirst({ where: { employeeId: item["Emp ID"] } });
        }
        
        // Manual mapping for the missing/mismatched names
        if (!user && item.Name === 'Vivek Sir') user = await prisma.user.findFirst({ where: { name: 'M Vivekananda' } });
        if (!user && item.Name === 'MD Sundararajan') user = await prisma.user.findFirst({ where: { name: 'Sundararajan P' } });
        if (!user && item.Name) {
            let searchName = item.Name.replace('(Unassigned)', '').trim();
            user = await prisma.user.findFirst({ where: { name: { contains: searchName } } });
        }

        const type = item["Laptop/Desktop"].toLowerCase();
        const hasNoLaptop = ["no laptop", "using own", "own laptop"].includes(type);
        
        // Ensure no laptop if specified
        if (user && hasNoLaptop) {
            await prisma.asset.updateMany({
                where: { assigneeId: user.id, category: 'Laptop' },
                data: { assigneeId: null, assigneeType: null, status: 'In Stock' }
            });
            console.log(`Unassigned all laptops for ${user.name}`);
        }

        if (item["Asset ID"]) {
            let assignedUserId: number | null = user?.id || null;
            let assignedUserName: string = user?.name || "";

            // Exceptions based on feedback
            if (item["Asset ID"] === "AMD-LAP-BC-0274") {
                // Nitin's laptop -> Unassigned
                assignedUserId = null;
                assignedUserName = "Unassigned";
            }
            if (item["Asset ID"] === "AMD-LAP-B0-0275") {
                // Jaimin's old laptop -> Unassigned
                assignedUserId = null;
                assignedUserName = "Unassigned";
            }

            const status = assignedUserId ? 'Assigned' : 'In Stock';
            
            let remarks = "";
            if (item.Condition) remarks += `Condition: ${item.Condition}. `;
            if (item.Additional) remarks += `Additional: ${item.Additional}. `;

            const data = {
                name: `${item.Brand} ${item.Model}`.trim(),
                category: 'Laptop',
                brand: item.Brand,
                model: item.Model,
                status: status,
                location: item.Location || null,
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
                console.log(`Updated asset ${item["Asset ID"]} for ${assignedUserName || 'Unassigned'}`);
            } else {
                await prisma.asset.create({
                    data: {
                        ...data,
                        assetId: item["Asset ID"]
                    }
                });
                console.log(`Created asset ${item["Asset ID"]} for ${assignedUserName || 'Unassigned'}`);
            }
            processed++;
        }
    }

    console.log(`Finished processing ${processed} assets.`);
}

main().finally(() => prisma.$disconnect());
