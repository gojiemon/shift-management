-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "loginId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "deadlineAt" DATETIME,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "startMin" INTEGER,
    "endMin" INTEGER,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Availability_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ShiftPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Availability_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ShiftPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftAssignment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ShiftPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftAssignment_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LineLink" (
    "staffUserId" TEXT NOT NULL PRIMARY KEY,
    "lineUserId" TEXT NOT NULL,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LineLink_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LineLinkCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    CONSTRAINT "LineLinkCode_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_periodId_staffUserId_date_key" ON "Availability"("periodId", "staffUserId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_periodId_staffUserId_key" ON "Submission"("periodId", "staffUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_periodId_staffUserId_date_key" ON "ShiftAssignment"("periodId", "staffUserId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LineLink_lineUserId_key" ON "LineLink"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LineLinkCode_code_key" ON "LineLinkCode"("code");
