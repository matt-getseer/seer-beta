-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "speakers" TEXT[] DEFAULT ARRAY[]::TEXT[];
