import { prisma } from './prisma.js'

export async function assertVehicleForTenant(vehicleId, tenantId) {
  return prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      client: { tenantId, deletedAt: null },
    },
    select: { id: true, clientId: true },
  })
}
