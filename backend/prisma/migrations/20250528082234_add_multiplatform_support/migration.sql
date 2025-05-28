-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "autoReschedulingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "calendarEventId" TEXT,
ADD COLUMN     "calendarProvider" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "meetingBaasCalendarId" TEXT,
ADD COLUMN     "platform" TEXT NOT NULL DEFAULT 'google_meet',
ADD COLUMN     "platformMeetingId" TEXT,
ADD COLUMN     "platformMeetingUrl" TEXT;

-- CreateTable
CREATE TABLE "CalendarIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "externalCalendarId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "settings" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarIntegration_userId_idx" ON "CalendarIntegration"("userId");

-- CreateIndex
CREATE INDEX "CalendarIntegration_provider_idx" ON "CalendarIntegration"("provider");

-- CreateIndex
CREATE INDEX "CalendarIntegration_calendarId_idx" ON "CalendarIntegration"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarIntegration_userId_provider_key" ON "CalendarIntegration"("userId", "provider");

-- CreateIndex
CREATE INDEX "PlatformIntegration_userId_idx" ON "PlatformIntegration"("userId");

-- CreateIndex
CREATE INDEX "PlatformIntegration_platform_idx" ON "PlatformIntegration"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformIntegration_userId_platform_key" ON "PlatformIntegration"("userId", "platform");

-- CreateIndex
CREATE INDEX "Meeting_platform_idx" ON "Meeting"("platform");

-- CreateIndex
CREATE INDEX "Meeting_calendarEventId_idx" ON "Meeting"("calendarEventId");

-- CreateIndex
CREATE INDEX "Meeting_platform_status_idx" ON "Meeting"("platform", "status");

-- CreateIndex
CREATE INDEX "MeetingChange_eventId_idx" ON "MeetingChange"("eventId");

-- AddForeignKey
ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformIntegration" ADD CONSTRAINT "PlatformIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
