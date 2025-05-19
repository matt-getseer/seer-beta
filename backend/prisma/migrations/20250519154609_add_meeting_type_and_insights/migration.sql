-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "clientFeedback" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "keyInsights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "meetingType" TEXT NOT NULL DEFAULT 'default';
