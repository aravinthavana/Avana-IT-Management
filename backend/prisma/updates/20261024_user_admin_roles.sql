-- Decouple Portal Access, Organizational Role, and IT Admin Privileges
BEGIN;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPortalUser" BOOLEAN DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "orgRole" TEXT DEFAULT 'Employee';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT false;

-- 1. Singaravel is Manager for Service & IT AND IT Admin:
UPDATE "User" SET "isAdmin" = true, "orgRole" = 'Manager', "isPortalUser" = true WHERE LOWER("email") = 'singaravel@avanamedical.com';

-- 2. Aravinth is the Main IT Person with full IT Admin privileges:
UPDATE "User" SET "isAdmin" = true, "orgRole" = 'Employee', "isPortalUser" = true WHERE LOWER("email") = 'aravinth@avanamedical.com';

-- 3. Any other user currently marked 'Admin':
UPDATE "User" SET "isAdmin" = true, "orgRole" = 'Manager', "isPortalUser" = true WHERE "role" = 'Admin' AND LOWER("email") NOT IN ('singaravel@avanamedical.com', 'aravinth@avanamedical.com');

-- 4. Users currently marked 'Manager':
UPDATE "User" SET "isAdmin" = false, "orgRole" = 'Manager', "isPortalUser" = true WHERE "role" = 'Manager' AND LOWER("email") NOT IN ('singaravel@avanamedical.com', 'aravinth@avanamedical.com');

-- 5. Users currently marked 'User':
UPDATE "User" SET "isAdmin" = false, "orgRole" = 'Employee', "isPortalUser" = true WHERE "role" = 'User' AND LOWER("email") NOT IN ('singaravel@avanamedical.com', 'aravinth@avanamedical.com');

-- 6. Shared / Non-login accounts:
UPDATE "User" SET "isPortalUser" = false WHERE "accountType" IN ('Shared Account', 'Others');

COMMIT;
