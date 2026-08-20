import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const data = {
  "company": "Avana Surgical Systems",
  "totalEmployees": 29,
  "employees": [
    {
      "employeeId": "ASSP_001",
      "name": "M Vivekananda",
      "email": "vivek@avanasurgical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "ASSP_003",
      "name": "Y Azgar Hussain",
      "email": "azgarhussain@avanasurgical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "ASSP_010",
      "name": "Ashok Krishna Raj",
      "email": "ashokkrishnaraj@avanasurgical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "ASSP_012",
      "name": "Bubesh Kumar",
      "email": "bubeshkumar@avanasurgical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "ASSP_043",
      "name": "Mohan Sundar G",
      "email": "mohan@avanasurgical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "ASSP_002",
      "name": "Ramesh Arunachalam",
      "email": "ramesh@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_005",
      "name": "Manikandan M",
      "email": "mani@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_006",
      "name": "Subash M",
      "email": "subash@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_007",
      "name": "Deb Kishor Roy",
      "email": "debkishor@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_015",
      "name": "Navaneetha Krishnan",
      "email": "navaneeth@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_016",
      "name": "Sachin Sapkal",
      "email": "sachinsapkal@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_017",
      "name": "Sugumar R",
      "email": "sugumar@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_019",
      "name": "Sathish Kumar A",
      "email": "sathishkumar@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_022",
      "name": "Kishore Kumar",
      "email": "kishorekumar@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_028",
      "name": "Pushkar Dnyaneshwar Morankar",
      "email": "pushkar@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_029",
      "name": "Chandan Yadav",
      "email": "chandanyadav@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_031",
      "name": "Kathiravan M",
      "email": "kathiravan@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_035",
      "name": "Hari Hara Sudhan M",
      "email": "hari@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_041",
      "name": "Dheeraj",
      "email": "dheeraj@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_042",
      "name": "Aaqib Perwez",
      "email": "aaqibperwez@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_044",
      "name": "Yogeshwaran S",
      "email": "yogeshwaran@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_045",
      "name": "Sourabh Shete",
      "email": "sourabhshete@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_046",
      "name": "Anurag A Singh",
      "email": "anurag@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_047",
      "name": "Keerthan M",
      "email": "keerthan@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_048",
      "name": "Ravikumar Gupta",
      "email": "ravikumargupta@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_049",
      "name": "Shashank Mishra",
      "email": "shashankmishra@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_050",
      "name": "Dipta Manna",
      "email": "diptamanna@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "ASSP_052",
      "name": "Pushparaj K",
      "email": "Pushparaj@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_20",
      "name": "Saran Raj S",
      "email": "saran@avanasurgical.com",
      "m365License": "Basic"
    }
  ]
};

async function main() {
  console.log("Fetching M365 Licenses...");
  
  let basicLicense = await prisma.license.findFirst({ where: { name: 'Microsoft 365 Basic' }});
  if (!basicLicense) {
    throw new Error("Microsoft 365 Basic license not found in DB.");
  }

  let stdLicense = await prisma.license.findFirst({ where: { name: 'Microsoft 365 Standard' }});
  if (!stdLicense) {
    throw new Error("Microsoft 365 Standard license not found in DB.");
  }

  console.log("Importing users and assigning licenses...");
  let count = 0;
  for (const emp of data.employees) {
    // Upsert user based on email
    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: {
        name: emp.name,
        employeeId: emp.employeeId,
        company: data.company
      },
      create: {
        email: emp.email,
        name: emp.name,
        employeeId: emp.employeeId,
        company: data.company,
        role: "User",
        status: "Active"
      }
    });

    const licenseToAssign = emp.m365License === 'Standard' ? stdLicense : basicLicense;
    
    // Check if assignment exists
    const existingAssignment = await prisma.licenseAssignment.findFirst({
      where: { userId: user.id, licenseId: licenseToAssign.id }
    });

    if (!existingAssignment) {
      await prisma.licenseAssignment.create({
        data: {
          userId: user.id,
          licenseId: licenseToAssign.id
        }
      });
    }
    
    count++;
  }
  
  console.log(`Successfully imported ${count} users and assigned licenses.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
