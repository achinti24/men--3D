/*
  Warnings:

  - Made the column `logo_url` on table `restaurants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `cover_image_url` on table `restaurants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `address` on table `restaurants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `restaurants` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "restaurants" ALTER COLUMN "logo_url" SET NOT NULL,
ALTER COLUMN "logo_url" SET DEFAULT '',
ALTER COLUMN "cover_image_url" SET NOT NULL,
ALTER COLUMN "cover_image_url" SET DEFAULT '',
ALTER COLUMN "address" SET NOT NULL,
ALTER COLUMN "address" SET DEFAULT '',
ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "phone" SET DEFAULT '';
