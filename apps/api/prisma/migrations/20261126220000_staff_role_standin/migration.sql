-- Stand-in for the admin core agent's StaffRole (drop this migration at merge if the core migration already creates it)
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SALES', 'ACCOUNTING', 'PRODUCTION', 'SUPPORT');
ALTER TABLE "User" ADD COLUMN     "staffRole" "StaffRole";
