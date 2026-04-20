-- CreateTable
CREATE TABLE "FeeRateVersion" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "FeeRateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- Replace composite index with unique constraint for upserts
DROP INDEX IF EXISTS "FeeRate_state_vehicleType_idx";

CREATE UNIQUE INDEX "FeeRate_state_vehicleType_key" ON "FeeRate"("state", "vehicleType");
