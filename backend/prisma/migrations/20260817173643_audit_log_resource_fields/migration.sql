-- DropIndex
DROP INDEX "audit_logs_restaurant_id_idx";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "resource_id" TEXT,
ADD COLUMN     "resource_type" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_restaurant_id_created_at_idx" ON "audit_logs"("restaurant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");
