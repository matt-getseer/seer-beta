/*
  Warnings:

  - You are about to drop the column `actionItems` on the `AnalysisHistory` table. All the data in the column will be lost.
  - You are about to drop the column `actionItems` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `actionItems` on the `UserAnalysis` table. All the data in the column will be lost.
  - You are about to drop the `ActionItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ActionItem" DROP CONSTRAINT "ActionItem_meetingId_fkey";

-- AlterTable
ALTER TABLE "AnalysisHistory" DROP COLUMN "actionItems",
ADD COLUMN     "tasks" TEXT[];

-- AlterTable
ALTER TABLE "Meeting" DROP COLUMN "actionItems",
ADD COLUMN     "tasks" TEXT[];

-- AlterTable
ALTER TABLE "UserAnalysis" DROP COLUMN "actionItems",
ADD COLUMN     "tasks" TEXT[];

-- DropTable
DROP TABLE "ActionItem";

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "meetingId" TEXT NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_meetingId_idx" ON "Task"("meetingId");

-- CreateIndex
CREATE INDEX "Task_assignedTo_idx" ON "Task"("assignedTo");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
