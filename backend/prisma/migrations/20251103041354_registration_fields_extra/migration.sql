/*
  Warnings:

  - Added the required column `license` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Made the column `phone` on table `Registration` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "license" TEXT NOT NULL,
ADD COLUMN     "motoBrand" TEXT,
ADD COLUMN     "motoClub" TEXT,
ADD COLUMN     "motoModel" TEXT,
ADD COLUMN     "motoPlate" TEXT,
ALTER COLUMN "phone" SET NOT NULL;
