-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "reasoning" TEXT,
ADD COLUMN     "relatedAreaForSupport" TEXT,
ADD COLUMN     "suggestedAssignee" TEXT;

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");
