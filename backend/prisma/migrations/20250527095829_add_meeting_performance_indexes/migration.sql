-- CreateIndex
CREATE INDEX "Meeting_teamMemberId_idx" ON "Meeting"("teamMemberId");

-- CreateIndex
CREATE INDEX "Meeting_createdBy_idx" ON "Meeting"("createdBy");

-- CreateIndex
CREATE INDEX "Meeting_date_idx" ON "Meeting"("date");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "Meeting_teamMemberId_date_idx" ON "Meeting"("teamMemberId", "date");

-- CreateIndex
CREATE INDEX "Meeting_createdBy_date_idx" ON "Meeting"("createdBy", "date");

-- CreateIndex
CREATE INDEX "Meeting_status_date_idx" ON "Meeting"("status", "date");
