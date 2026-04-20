export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'just now'
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  const mo = Math.floor(d / 30)
  return `${mo} month${mo === 1 ? '' : 's'} ago`
}
