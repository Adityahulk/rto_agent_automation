-- DropForeignKey
ALTER TABLE "RtoForm" DROP CONSTRAINT IF EXISTS "RtoForm_clientId_fkey";

-- AlterTable
ALTER TABLE "RtoForm" ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RtoForm" ADD COLUMN     "vehicleId" TEXT,
ADD COLUMN     "formData" JSONB;

-- AddForeignKey
ALTER TABLE "RtoForm" ADD CONSTRAINT "RtoForm_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RtoForm" ADD CONSTRAINT "RtoForm_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "RtoForm_vehicleId_idx" ON "RtoForm"("vehicleId");
