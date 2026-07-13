-- AlterTable
ALTER TABLE "client" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "ride" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "user" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "user" ADD COLUMN "deletedEmail" TEXT;
ALTER TABLE "user" ADD COLUMN "deletedPhone" TEXT;

-- AlterTable
ALTER TABLE "volunteer" ADD COLUMN "deletedAt" DATETIME;
