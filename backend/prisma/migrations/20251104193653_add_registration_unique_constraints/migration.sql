/*
  Warnings:

  - A unique constraint covering the columns `[routeId,email,type]` on the table `Registration` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[routeId,license,type]` on the table `Registration` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[routeId,motoPlate,type]` on the table `Registration` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Registration_routeId_email_type_key" ON "Registration"("routeId", "email", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_routeId_license_type_key" ON "Registration"("routeId", "license", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_routeId_motoPlate_type_key" ON "Registration"("routeId", "motoPlate", "type");
