-- AlterTable
ALTER TABLE "User" ADD COLUMN     "geminiApiKey" TEXT,
ADD COLUMN     "hasGeminiKey" BOOLEAN NOT NULL DEFAULT false;
