-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastAnalyzedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wins" TEXT[],
    "areasForSupport" TEXT[],
    "actionItems" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAnalysis_userId_key" ON "UserAnalysis"("userId");

-- AddForeignKey
ALTER TABLE "UserAnalysis" ADD CONSTRAINT "UserAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
