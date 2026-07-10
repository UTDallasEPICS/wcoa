-- AlterTable
ALTER TABLE "ride" ADD COLUMN "cachedDistanceText" TEXT;
ALTER TABLE "ride" ADD COLUMN "cachedDistanceValue" INTEGER;
ALTER TABLE "ride" ADD COLUMN "cachedDurationText" TEXT;
ALTER TABLE "ride" ADD COLUMN "cachedDurationValue" INTEGER;
ALTER TABLE "ride" ADD COLUMN "estimatedAt" DATETIME;
