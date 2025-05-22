-- CreateTable
CREATE TABLE "MeetingChange" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "eventId" TEXT,
    "changeData" JSONB,
    "previousTitle" TEXT,
    "previousDate" TIMESTAMP(3),
    "previousDuration" INTEGER,
    "newTitle" TEXT,
    "newDate" TIMESTAMP(3),
    "newDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingChange_meetingId_idx" ON "MeetingChange"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingChange_changeType_idx" ON "MeetingChange"("changeType");

-- AddForeignKey
ALTER TABLE "MeetingChange" ADD CONSTRAINT "MeetingChange_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
