/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Route` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Route_slug_key" ON "Route"("slug");
