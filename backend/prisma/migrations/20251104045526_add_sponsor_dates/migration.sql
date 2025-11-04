-- CreateTable
CREATE TABLE "SponsorDate" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "when" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsorDate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SponsorDate" ADD CONSTRAINT "SponsorDate_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
