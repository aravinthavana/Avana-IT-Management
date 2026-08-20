import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const data = {
  "company": "Avana Medical Devices",
  "totalEmployees": 117,
  "employees": [
    {
      "employeeId": "AMD_001",
      "name": "Sundararajan P",
      "email": "sundar@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_002",
      "name": "Srinivasan M",
      "email": "srinivasan@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_007",
      "name": "Singaravel S",
      "email": "singaravel@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_008",
      "name": "Avadhut Kaluskar",
      "email": "avadhut@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_009",
      "name": "Manish Gautam",
      "email": "manish@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_010",
      "name": "Anand A",
      "email": "anandashok@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_019",
      "name": "Siva Sankar A",
      "email": "siva@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_024",
      "name": "Ruchir Gupta",
      "email": "ruchir@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_031",
      "name": "Richard Abheek Biswas",
      "email": "richard@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_038",
      "name": "Praveen Raghavendra",
      "email": "praveen@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_056",
      "name": "Kiran B G",
      "email": "kiran@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_057",
      "name": "Senthil Kumar Shanmugam",
      "email": "senthilkumar@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_063",
      "name": "Rajan E",
      "email": "traveldesk@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_065",
      "name": "Prince Kumar",
      "email": "princekumar@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_069",
      "name": "Vignesh M",
      "email": "vignesh@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_076",
      "name": "Savitha M M",
      "email": "savitha@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_087",
      "name": "Selva Kumar B",
      "email": "selvakumar@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_091",
      "name": "Malini A",
      "email": "malini@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_134",
      "name": "Suganthan L",
      "email": "suganthan@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_137",
      "name": "Kaleeshwaran Selvaraj",
      "email": "accounts@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_142",
      "name": "Md kashif Faridi",
      "email": "kashif@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_143",
      "name": "Avichal Anil Hirekhan",
      "email": "avichal@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_145",
      "name": "Aravinthkumar E",
      "email": "aravinth@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_155",
      "name": "Sujithra Nagarajan",
      "email": "sujithra@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_165",
      "name": "Pavithran V",
      "email": "pavithran@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_166",
      "name": "Sureshgobi SR",
      "email": "sureshgobi@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_167",
      "name": "Lokshni D",
      "email": "lokshni@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_168",
      "name": "Kaushik S",
      "email": "kaushik@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_169",
      "name": "Shanmugam M",
      "email": "shanmugam@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_181",
      "name": "Gyanu Devnarayan Yadav",
      "email": "gyanuyadav@avanamedical.com",
      "m365License": "Standard"
    },
    {
      "employeeId": "AMD_004",
      "name": "Siva Praveen E",
      "email": "sivapraveen@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_005",
      "name": "Kumaresan M",
      "email": "kumaresan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_013",
      "name": "Sachin Kisan Talekar",
      "email": "sachint@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_014",
      "name": "Silambarasan G",
      "email": "silambarasan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_018",
      "name": "Karthikeyan D",
      "email": "karthikeyan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_021",
      "name": "Anas Azam",
      "email": "anasazam@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_022",
      "name": "Kritibas Sahoo",
      "email": "kritibas@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_023",
      "name": "Veeramaneni Kranthi",
      "email": "kranthi@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_026",
      "name": "Prabakaran P",
      "email": "prabakaran@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_028",
      "name": "Jayasish Dey",
      "email": "jayasishdey@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_030",
      "name": "Ashadip Kanungo",
      "email": "ashadip@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_032",
      "name": "Robin Joseph",
      "email": "robin@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_037",
      "name": "Sakthivel P",
      "email": "sakthivel@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_039",
      "name": "Sathish S",
      "email": "sathish@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_045",
      "name": "Gaurang K. Prajapati",
      "email": "gaurang@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_052",
      "name": "Sutheesh R",
      "email": "sutheesh@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_053",
      "name": "Sridhara M.L",
      "email": "sridhara@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_054",
      "name": "Selvamani C",
      "email": "selvamani@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_055",
      "name": "ManiKandan B",
      "email": "manikandan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_060",
      "name": "Shaikh Abdul Raees",
      "email": "shaikh@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_061",
      "name": "Nachiyappan N",
      "email": "nachiyappan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_062",
      "name": "Devi Prasad",
      "email": "deviprasad@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_070",
      "name": "Saran Raj R",
      "email": "saranraj@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_071",
      "name": "Sebastin David A",
      "email": "sabastindavid@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_077",
      "name": "Kshitij Rajebhosale",
      "email": "kshitij@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_079",
      "name": "Dinesh Kumar A",
      "email": "dineshkumar@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_082",
      "name": "Santhosh V",
      "email": "santhosh@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_083",
      "name": "Khuzema Husain",
      "email": "khuzemahusain@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_085",
      "name": "Amit Sayyad",
      "email": "amitsayyad@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_088",
      "name": "Thanigaivel C",
      "email": "thanigaivel@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_089",
      "name": "Surya S",
      "email": "surya@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_090",
      "name": "Ranjith T",
      "email": "ranjith@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_093",
      "name": "Selva Murukan S",
      "email": "selvamurukan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_096",
      "name": "Jaimin Shah",
      "email": "jaiminshah@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_098",
      "name": "Chetan Keshaorao Ippar",
      "email": "chetan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_100",
      "name": "Lalith Sairam S V",
      "email": "lalithsairam@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_101",
      "name": "Sudarsan R",
      "email": "sudarsan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_105",
      "name": "Abhishek Dubey",
      "email": "abhishek@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_106",
      "name": "Srinivasaraja S",
      "email": "srinivasaraja@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_107",
      "name": "Sudeep Sadesh Bose",
      "email": "sudeepsadeshbose@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_110",
      "name": "Sonu Chandran",
      "email": "sonu@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_112",
      "name": "Naresh Kumar",
      "email": "nareshkumar@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_115",
      "name": "Avinashi Saxena",
      "email": "avinash@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_118",
      "name": "Vinay R A",
      "email": "vinayra@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_119",
      "name": "Sudhir Rampujan Jaiswara",
      "email": "sudhir@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_122",
      "name": "Gokulakannan S",
      "email": "gokulakannan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_127",
      "name": "Shabeer Ali",
      "email": "shabeer@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_129",
      "name": "R Vignesh",
      "email": "vigneshr@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_130",
      "name": "Ajith Kumar A",
      "email": "ajith@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_131",
      "name": "Karthick S",
      "email": "karthicksankar@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_132",
      "name": "Kapil Sharma",
      "email": "kapilsharma@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_133",
      "name": "Robin Jonathap S",
      "email": "robinjonathap@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_138",
      "name": "Vishnu Nair",
      "email": "vishnu@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_139",
      "name": "Rajesh Panda",
      "email": "rajesh@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_144",
      "name": "Dipendu Sarkar",
      "email": "dipendu@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_147",
      "name": "Sridhar D",
      "email": "sridhar@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_148",
      "name": "Arun Kumar",
      "email": "arun@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_149",
      "name": "Sabarinathan I",
      "email": "sabarinathan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_150",
      "name": "Sonik Kumar",
      "email": "sonikkumar@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_151",
      "name": "Kumar Sourav",
      "email": "kumarsourav@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_153",
      "name": "Umesh Patil",
      "email": "umesh@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_156",
      "name": "Mohamed shafique Rao",
      "email": "mohamedshafique@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_157",
      "name": "Gnana Sekar p",
      "email": "gnanasekar@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_160",
      "name": "Sankha Suvra Bandyopadhyay",
      "email": "sankha@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_161",
      "name": "Sanjay V",
      "email": "sanjay@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_163",
      "name": "Shanmukharao Avala",
      "email": "shanmukharao@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_164",
      "name": "Dhurubajyoti Kashyap",
      "email": "dhrubajyoti@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_170",
      "name": "Anitha V",
      "email": "anitha@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_171",
      "name": "Bhuvanesh Ravi",
      "email": "bhuvaneshravi@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_172",
      "name": "Suvarna Kumar Thanniru",
      "email": "suvarnakumar@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_173",
      "name": "Sam Joshua A",
      "email": "samjoshua@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_174",
      "name": "Abhinandh MD",
      "email": "abhinandh@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_175",
      "name": "Manikandan S",
      "email": "manikandan_s@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_176",
      "name": "Aryan Malhotra",
      "email": "aryanmalhotra@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_177",
      "name": "Jegadeeswaran T",
      "email": "jegadeeswaran@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_178",
      "name": "Mehul Shah",
      "email": "mehulshah@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_179",
      "name": "Subhransu Sekhar Swain",
      "email": "subhransusekhar@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_180",
      "name": "Prachi Rinesh Palshetkar",
      "email": "prachi@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_182",
      "name": "Sujeet Singh",
      "email": "sujeet@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_183",
      "name": "Roshini S",
      "email": "roshini@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_184",
      "name": "Aman Kumar Shukla",
      "email": "amankumar@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_185",
      "name": "Samadhan Gade",
      "email": "samadhan@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_186",
      "name": "Hemant Nrapat Singh",
      "email": "hemantsingh@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "AMD_187",
      "name": "Kamal Nath Mahto",
      "email": "kamalnath@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "Talentpro",
      "name": "Achyutananda Behera",
      "email": "achyutananda@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "Talentpro",
      "name": "VishnuDev",
      "email": "vishnudev@avanamedical.com",
      "m365License": "Basic"
    },
    {
      "employeeId": "MD",
      "name": "Bharathi",
      "email": "bharathi@avanamedical.com",
      "m365License": "Basic"
    }
  ]
};

async function main() {
  console.log("Ensuring M365 Licenses exist...");
  
  let basicLicense = await prisma.license.findFirst({ where: { name: 'Microsoft 365 Basic' }});
  if (!basicLicense) {
    basicLicense = await prisma.license.create({
      data: {
        name: 'Microsoft 365 Basic',
        category: 'Software',
        seats: 200,
      }
    });
  }

  let stdLicense = await prisma.license.findFirst({ where: { name: 'Microsoft 365 Standard' }});
  if (!stdLicense) {
    stdLicense = await prisma.license.create({
      data: {
        name: 'Microsoft 365 Standard',
        category: 'Software',
        seats: 100,
      }
    });
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

    // Since users may have been dummy generated without this actual license logic,
    // optionally clear old assignments for this user if they have a different m365 license?
    // Let's just assure they have the requested one for now.
    
    count++;
  }
  
  console.log(`Successfully imported ${count} users and assigned licenses.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
