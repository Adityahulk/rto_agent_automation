-- CreateEnum
CREATE TYPE "TenantSubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TWO_W', 'FOUR_W', 'COMMERCIAL', 'EV');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "whatsappNumber" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionStatus" "TenantSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "fuelType" TEXT,
    "vehicleType" "VehicleType" NOT NULL,
    "chassisNumber" TEXT,
    "engineNumber" TEXT,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurancePolicy" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "premium" DECIMAL(14,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PUCRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PUCRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRate" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "minPrice" DECIMAL(14,2) NOT NULL,
    "maxPrice" DECIMAL(14,2) NOT NULL,
    "roadTaxPercent" DECIMAL(8,4) NOT NULL,
    "registrationFee" DECIMAL(14,2) NOT NULL,
    "hsrpFee" DECIMAL(14,2) NOT NULL,
    "smartCardFee" DECIMAL(14,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeCalculation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "invoicePrice" DECIMAL(14,2) NOT NULL,
    "totalTax" DECIMAL(14,2) NOT NULL,
    "totalFees" DECIMAL(14,2) NOT NULL,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "sentViaWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RtoForm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RtoForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- CreateIndex
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");

-- CreateIndex
CREATE INDEX "Vehicle_clientId_idx" ON "Vehicle"("clientId");

-- CreateIndex
CREATE INDEX "InsurancePolicy_tenantId_idx" ON "InsurancePolicy"("tenantId");

-- CreateIndex
CREATE INDEX "InsurancePolicy_vehicleId_idx" ON "InsurancePolicy"("vehicleId");

-- CreateIndex
CREATE INDEX "FitnessRecord_tenantId_idx" ON "FitnessRecord"("tenantId");

-- CreateIndex
CREATE INDEX "FitnessRecord_vehicleId_idx" ON "FitnessRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "PUCRecord_tenantId_idx" ON "PUCRecord"("tenantId");

-- CreateIndex
CREATE INDEX "PUCRecord_vehicleId_idx" ON "PUCRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "FeeRate_state_vehicleType_idx" ON "FeeRate"("state", "vehicleType");

-- CreateIndex
CREATE INDEX "FeeCalculation_tenantId_idx" ON "FeeCalculation"("tenantId");

-- CreateIndex
CREATE INDEX "FeeCalculation_clientId_idx" ON "FeeCalculation"("clientId");

-- CreateIndex
CREATE INDEX "Quote_tenantId_idx" ON "Quote"("tenantId");

-- CreateIndex
CREATE INDEX "Quote_clientId_idx" ON "Quote"("clientId");

-- CreateIndex
CREATE INDEX "Quote_calculationId_idx" ON "Quote"("calculationId");

-- CreateIndex
CREATE INDEX "RtoForm_tenantId_idx" ON "RtoForm"("tenantId");

-- CreateIndex
CREATE INDEX "RtoForm_clientId_idx" ON "RtoForm"("clientId");

-- CreateIndex
CREATE INDEX "ServiceCharge_tenantId_idx" ON "ServiceCharge"("tenantId");

-- CreateIndex
CREATE INDEX "ServiceCharge_clientId_idx" ON "ServiceCharge"("clientId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessRecord" ADD CONSTRAINT "FitnessRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessRecord" ADD CONSTRAINT "FitnessRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PUCRecord" ADD CONSTRAINT "PUCRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PUCRecord" ADD CONSTRAINT "PUCRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCalculation" ADD CONSTRAINT "FeeCalculation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCalculation" ADD CONSTRAINT "FeeCalculation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "FeeCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RtoForm" ADD CONSTRAINT "RtoForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RtoForm" ADD CONSTRAINT "RtoForm_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCharge" ADD CONSTRAINT "ServiceCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCharge" ADD CONSTRAINT "ServiceCharge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
