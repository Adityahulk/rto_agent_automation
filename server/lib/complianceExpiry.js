/** Date helpers and expiry status for insurance / fitness / PUC / permits */

export function readIsoDate(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: `${label} is required` }
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `Invalid ${label}` }
  }
  return { ok: true, date: d }
}

export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function startOfNextDay(d) {
  const x = startOfDay(d)
  x.setDate(x.getDate() + 1)
  return x
}

export function startOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x
}

export function startOfNextMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Upper bound for "within 30 days from today" (exclusive): start of day 31 days after today */
export function startOfDayAfter30From(d) {
  return startOfDay(addDays(d, 31))
}

/**
 * DB / API status filter: active | expiring | expired
 * - expired: expiry before start of today
 * - expiring: expiry from today through day+30 (inclusive window by date)
 * - active: expiry after day+30
 */
export function prismaStatusWhere(status, field = 'expiryDate') {
  const now = new Date()
  const today = startOfDay(now)
  const after30 = startOfDayAfter30From(now)
  const s = String(status ?? '').trim().toLowerCase()
  if (s === 'expired') {
    return { [field]: { lt: today } }
  }
  if (s === 'expiring') {
    return { [field]: { gte: today, lt: after30 } }
  }
  if (s === 'active') {
    return { [field]: { gte: after30 } }
  }
  return {}
}

/** Badge + stored status: ACTIVE | EXPIRING_SOON | EXPIRED */
export function statusFromExpiryDate(expiryDate) {
  const now = new Date()
  const today = startOfDay(now)
  const exp = startOfDay(new Date(expiryDate))
  const after30 = startOfDayAfter30From(now)
  if (exp < today) return 'EXPIRED'
  if (exp < after30) return 'EXPIRING_SOON'
  return 'ACTIVE'
}

export function statsForModel({
  tenantId,
  prismaModel,
  field = 'expiryDate',
  lastRenewedField = 'lastRenewedAt',
  extraWhere = {},
}) {
  const now = new Date()
  const today = startOfDay(now)
  const monthStart = startOfMonth(now)
  const monthEnd = startOfNextMonth(now)
  const base = { tenantId, ...extraWhere }

  return Promise.all([
    prismaModel.count({ where: { ...base } }),
    prismaModel.count({
      where: {
        ...base,
        [field]: { gte: today, lt: monthEnd },
      },
    }),
    prismaModel.count({
      where: {
        ...base,
        [field]: { lt: today },
      },
    }),
    prismaModel.count({
      where: {
        ...base,
        [lastRenewedField]: { gte: monthStart, lt: monthEnd },
      },
    }),
  ]).then(([totalTracked, expiringThisMonth, expired, renewedThisMonth]) => ({
    totalTracked,
    expiringThisMonth,
    expired,
    renewedThisMonth,
  }))
}

export function searchVehicleClientOr(search) {
  if (!search) return null
  const q = search.trim()
  if (!q) return null
  return {
    OR: [
      { vehicle: { vehicleNumber: { contains: q, mode: 'insensitive' } } },
      { vehicle: { client: { name: { contains: q, mode: 'insensitive' } } } },
    ],
  }
}
