import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    console.log("Loading employee details...");
    const data = JSON.parse(fs.readFileSync('employee_details.json', 'utf-8'));

    // Cache departments and branches
    const departments = await prisma.department.findMany();
    const branches = await prisma.branch.findMany();

    const deptMap = new Map<string, number>(departments.map(d => [d.name, d.id]));
    const branchMap = new Map<string, number>(branches.map(b => [b.name, b.id]));

    // We'll also cache users by email and by employeeId for manager lookups
    const allUsers = await prisma.user.findMany();
    const userByEmail = new Map<string, any>();
    const userByEmpId = new Map<string, any>();

    for (const u of allUsers) {
        if (u.email) userByEmail.set(u.email.toLowerCase(), u);
        if (u.employeeId) userByEmpId.set(u.employeeId, u);
    }

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const emp of data) {
        const email = emp["Email address"]?.trim().toLowerCase();
        if (!email) continue;

        let user = userByEmail.get(email);

        // if user not found, we can't update.
        if (!user) {
            console.log(`User not found for email: ${email}`);
            notFoundCount++;
            continue;
        }

        // 1. Department
        let departmentId = user.departmentId;
        const deptName = emp["Department"]?.trim();
        if (deptName && deptName !== "NA") {
            if (deptMap.has(deptName)) {
                departmentId = deptMap.get(deptName);
            } else {
                const newDept = await prisma.department.create({ data: { name: deptName } });
                deptMap.set(deptName, newDept.id);
                departmentId = newDept.id;
                console.log(`Created new department: ${deptName}`);
            }
        }

        // 2. Branch (Location)
        let branchId = user.branchId;
        const locName = emp["Location"]?.trim();
        if (locName && locName !== "NA") {
            if (branchMap.has(locName)) {
                branchId = branchMap.get(locName);
            } else {
                const newBranch = await prisma.branch.create({ data: { name: locName } });
                branchMap.set(locName, newBranch.id);
                branchId = newBranch.id;
                console.log(`Created new branch: ${locName}`);
            }
        }

        // 3. Employee ID
        const employeeId = emp["Employee ID"]?.trim() || user.employeeId;

        // 4. Job Title
        let jobTitle = emp["Designation"]?.trim() || user.jobTitle;
        // Optionally append grade
        const grade = emp["Grade"]?.trim();
        if (grade && grade !== "NA") {
            if (jobTitle && !jobTitle.includes(grade)) {
                jobTitle = `${jobTitle} (${grade})`;
            } else if (!jobTitle) {
                jobTitle = grade;
            }
        }

        // 5. Mobile
        const mobile = emp["Work Phone Number"]?.trim() || user.mobile;
        const mobileToSave = (mobile === "NA") ? user.mobile : mobile;

        // 6. Name
        const firstName = emp["First Name"]?.trim() || "";
        const lastName = emp["Last Name"]?.trim() || "";
        let name = firstName;
        if (lastName) name += " " + lastName;
        if (!name || name === "") name = user.name;

        // Prepare update data
        const updateData: any = {
            employeeId,
            jobTitle,
            mobile: mobileToSave,
            departmentId,
            branchId,
            name
        };

        // We will update the user to save the employee ID so we can do manager lookups accurately.
        user = await prisma.user.update({
            where: { id: user.id },
            data: updateData
        });
        
        userByEmpId.set(employeeId, user);
        userByEmail.set(email, user); // update cache
        updatedCount++;
    }

    // Pass 2: Update managers
    // We couldn't do it reliably in Pass 1 because some managers might not have had their employeeIds saved yet
    let managerUpdateCount = 0;
    for (const emp of data) {
        const email = emp["Email address"]?.trim().toLowerCase();
        if (!email) continue;
        
        const user = userByEmail.get(email);
        if (!user) continue;

        const mgrString = emp["Reporting Manager"]?.trim();
        if (!mgrString || mgrString === "NA") continue;

        // Extract manager employee ID. Typical format: "Manish Gautam AMD_009"
        const match = mgrString.match(/([A-Za-z]+_\d+)$/i); // Matches AMD_009, Temp_01, etc.
        let managerIdToSet = user.managerId;

        if (match && match[1]) {
            const mgrEmpId = match[1];
            // case insensitive lookup in cache
            for (const [k, v] of userByEmpId.entries()) {
                if (k.toLowerCase() === mgrEmpId.toLowerCase()) {
                    managerIdToSet = v.id;
                    break;
                }
            }
        } else {
            // try to match by name
            for (const v of userByEmail.values()) {
                if (mgrString.toLowerCase().includes(v.name.toLowerCase())) {
                    managerIdToSet = v.id;
                    break;
                }
            }
        }

        if (managerIdToSet && managerIdToSet !== user.managerId) {
            await prisma.user.update({
                where: { id: user.id },
                data: { managerId: managerIdToSet }
            });
            managerUpdateCount++;
        }
    }

    console.log(`Updated ${updatedCount} users.`);
    console.log(`Could not find ${notFoundCount} users from the JSON.`);
    console.log(`Updated manager for ${managerUpdateCount} users.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
