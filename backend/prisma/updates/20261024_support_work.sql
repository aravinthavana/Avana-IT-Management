-- Additive support work log update; apply once before deploying the new backend.
BEGIN;
-- CreateTable
CREATE TABLE "SupportWorkCase" (
    "id" SERIAL NOT NULL,
    "subject" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactUserId" INTEGER,
    "affectedUserId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "assignedToId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "waitingReason" TEXT,
    "nextAction" TEXT,
    "followUpDate" DATE,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportWorkCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportWorkActivity" (
    "id" SERIAL NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "caseId" INTEGER,
    "workDate" DATE NOT NULL,
    "subject" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactUserId" INTEGER,
    "affectedUserId" INTEGER,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "workDone" TEXT NOT NULL,
    "statusAfter" TEXT NOT NULL,
    "waitingReason" TEXT,
    "nextAction" TEXT,
    "followUpDate" DATE,
    "performedById" INTEGER NOT NULL,
    "recordedById" INTEGER NOT NULL,
    "effortMinutes" INTEGER,
    "assetId" INTEGER,
    "attachments" TEXT,
    "notificationStatus" TEXT NOT NULL DEFAULT 'Not requested',
    "importKey" TEXT,
    "originalStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportWorkActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportWorkAttachment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportWorkAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportWorkCase_status_followUpDate_idx" ON "SupportWorkCase"("status", "followUpDate");

-- CreateIndex
CREATE INDEX "SupportWorkCase_assignedToId_idx" ON "SupportWorkCase"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportWorkActivity_clientRequestId_key" ON "SupportWorkActivity"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportWorkActivity_importKey_key" ON "SupportWorkActivity"("importKey");

-- CreateIndex
CREATE INDEX "SupportWorkActivity_workDate_performedById_idx" ON "SupportWorkActivity"("workDate", "performedById");

-- CreateIndex
CREATE INDEX "SupportWorkActivity_caseId_workDate_idx" ON "SupportWorkActivity"("caseId", "workDate");

-- AddForeignKey
ALTER TABLE "SupportWorkCase" ADD CONSTRAINT "SupportWorkCase_contactUserId_fkey" FOREIGN KEY ("contactUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportWorkCase" ADD CONSTRAINT "SupportWorkCase_affectedUserId_fkey" FOREIGN KEY ("affectedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportWorkCase" ADD CONSTRAINT "SupportWorkCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportWorkCase" ADD CONSTRAINT "SupportWorkCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportWorkActivity" ADD CONSTRAINT "SupportWorkActivity_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportWorkCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportWorkActivity" ADD CONSTRAINT "SupportWorkActivity_contactUserId_fkey" FOREIGN KEY ("contactUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportWorkActivity" ADD CONSTRAINT "SupportWorkActivity_affectedUserId_fkey" FOREIGN KEY ("affectedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportWorkActivity" ADD CONSTRAINT "SupportWorkActivity_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportWorkActivity" ADD CONSTRAINT "SupportWorkActivity_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;
