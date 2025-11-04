-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('PILOT', 'SPECTATOR', 'SPONSOR');

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "services" TEXT,
ADD COLUMN     "type" "RegistrationType" NOT NULL DEFAULT 'PILOT',
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "SponsorLocation" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsorLocation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SponsorLocation" ADD CONSTRAINT "SponsorLocation_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
