/*
  Warnings:

  - Made the column `social_links` on table `restaurants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `schedule` on table `restaurants` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "restaurants" ALTER COLUMN "social_links" SET NOT NULL,
ALTER COLUMN "social_links" SET DEFAULT '{}',
ALTER COLUMN "schedule" SET NOT NULL,
ALTER COLUMN "schedule" SET DEFAULT '[]';
