-- Additive: AI import jobs (proposal + review before posts are created). Does not modify existing tables.
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "calendarVersionId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "filesJson" TEXT NOT NULL,
    "mediaJson" TEXT NOT NULL DEFAULT '[]',
    "resultJson" TEXT,
    "error" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "postsCreated" INTEGER NOT NULL DEFAULT 0,
    "committedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportJob_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportJob_calendarVersionId_fkey" FOREIGN KEY ("calendarVersionId") REFERENCES "CalendarVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ImportJob_organizationId_createdAt_idx" ON "ImportJob"("organizationId", "createdAt");

CREATE INDEX "ImportJob_clientId_status_idx" ON "ImportJob"("clientId", "status");

CREATE INDEX "ImportJob_calendarVersionId_idx" ON "ImportJob"("calendarVersionId");

CREATE INDEX "ImportJob_createdByUserId_idx" ON "ImportJob"("createdByUserId");
