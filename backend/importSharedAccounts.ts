import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const data = {
  "category": "Non-users / Shared Accounts",
  "totalAccounts": 19,
  "accounts": [
    {
      "accountType": "Non User",
      "name": "Avana Stores",
      "email": "stores@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "accountType": "Non User",
      "name": "Receivables",
      "email": "receivables@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "accountType": "Non User",
      "name": "Avana Marketing",
      "email": "AvanaMarketing@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "Avana Delhi Store",
      "email": "delhistore@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "avanaone",
      "email": "avanaone@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "info",
      "email": "info@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "orders",
      "email": "orders@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "Arthrex Innovations",
      "email": "arthrexinnovations@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "Printers Delhi",
      "email": "printersdelhi@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "Avana Zoho",
      "email": "AvanaZoho@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "Printers Bengaluru",
      "email": "printersbengaluru@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "recruitment",
      "email": "recruitment@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "Printers Mumbai",
      "email": "printersmumbai@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "Printers Chennai",
      "email": "printerschennai@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "HR-Avana",
      "email": "hr@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "No Reply",
      "email": "noreply@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "info",
      "email": "info@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Non User",
      "name": "Accounts Department Avana Surgical Systems Pvt Ltd",
      "email": "accountsassp@avanasurgical.com",
      "m365License": "Basic"
    },
    {
      "accountType": "Zoho-partner",
      "name": "muhilan",
      "email": "muhilan@avanasurgical.com",
      "m365License": "Basic"
    }
  ]
};

async function main() {
  console.log("Fetching M365 Licenses...");
  
  let basicLicense = await prisma.license.findFirst({ where: { name: 'Microsoft 365 Basic' }});
  if (!basicLicense) throw new Error("Microsoft 365 Basic license not found in DB.");

  let stdLicense = await prisma.license.findFirst({ where: { name: 'Microsoft 365 Standard' }});
  if (!stdLicense) throw new Error("Microsoft 365 Standard license not found in DB.");

  console.log("Updating Talentpro users to External Employee...");
  await prisma.user.updateMany({
    where: { employeeId: 'Talentpro' },
    data: { accountType: 'External Employee' }
  });

  console.log("Importing Shared Accounts...");
  let count = 0;
  for (const acc of data.accounts) {
    let type = 'Shared Account';
    if (acc.accountType === 'Zoho-partner') {
        type = 'Others';
    }

    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        name: acc.name,
        accountType: type
      },
      create: {
        email: acc.email,
        name: acc.name,
        role: "User",
        status: "Active",
        accountType: type
      }
    });

    const licenseToAssign = acc.m365License === 'Standard' ? stdLicense : basicLicense;
    
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
  
  console.log(`Successfully imported ${count} shared accounts and updated Talentpro users.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
