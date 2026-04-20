/**
 * Expects `req.tenant` (e.g. after verifyAgentToken).
 * Returns 403 if subscription end date is on or before now.
 */
export function checkSubscription(req, res, next) {
  const tenant = req.tenant
  if (!tenant) {
    return res.status(500).json({ message: 'Tenant context missing' })
  }

  const { subscriptionExpiresAt } = tenant
  if (subscriptionExpiresAt && subscriptionExpiresAt <= new Date()) {
    return res.status(403).json({
      message: 'Your subscription has expired. Please renew.',
      subscriptionExpiresAt: subscriptionExpiresAt.toISOString(),
    })
  }

  next()
}
