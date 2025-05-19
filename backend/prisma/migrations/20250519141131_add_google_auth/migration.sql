-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleRefreshToken" TEXT;
