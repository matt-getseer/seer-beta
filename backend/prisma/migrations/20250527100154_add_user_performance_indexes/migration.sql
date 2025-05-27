-- CreateIndex
CREATE INDEX "User_adminId_idx" ON "User"("adminId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_adminId_role_idx" ON "User"("adminId", "role");
