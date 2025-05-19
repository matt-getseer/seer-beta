/*
  Warnings:

  - A unique constraint covering the columns `[clerkId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
-- First make clerkId nullable to allow adding it to existing records
ALTER TABLE "User" ADD COLUMN "adminId" INTEGER,
ADD COLUMN "clerkId" TEXT;

-- Add a default temporary value for existing records (will be replaced when users login)
UPDATE "User" SET "clerkId" = 'temp_' || id::text WHERE "clerkId" IS NULL;

-- Now make clerkId NOT NULL
ALTER TABLE "User" ALTER COLUMN "clerkId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
