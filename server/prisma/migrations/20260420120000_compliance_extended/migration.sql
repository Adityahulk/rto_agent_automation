-- AlterTable
ALTER TABLE "InsurancePolicy" ADD COLUMN "lastRenewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FitnessRecord" ADD COLUMN     "certificateNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "issuedBy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "validFrom" TIMESTAMP(3),
ADD COLUMN     "lastRenewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PUCRecord" ADD COLUMN     "pucNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "testCenter" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastRenewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PermitRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "permitType" TEXT NOT NULL,
    "issuedState" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "lastRenewedAt" TIMESTAMP(3),

    CONSTRAINT "PermitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermitRecord_tenantId_idx" ON "PermitRecord"("tenantId");

-- CreateIndex
CREATE INDEX "PermitRecord_vehicleId_idx" ON "PermitRecord"("vehicleId");

-- AddForeignKey
ALTER TABLE "PermitRecord" ADD CONSTRAINT "PermitRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitRecord" ADD CONSTRAINT "PermitRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
