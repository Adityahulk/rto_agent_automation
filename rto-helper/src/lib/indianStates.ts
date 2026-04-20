/** Common states / UTs for client address filters */
export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Chandigarh',
  'Delhi',
  'Gujarat',
  'Karnataka',
  'Kerala',
  'Maharashtra',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
].sort()

export const VEHICLE_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'TWO_W', label: 'Two Wheeler' },
  { value: 'FOUR_W', label: 'Four Wheeler' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'EV', label: 'Electric' },
] as const

export function formatVehicleType(v: string) {
  const m: Record<string, string> = {
    TWO_W: '2W',
    FOUR_W: '4W',
    COMMERCIAL: 'Commercial',
    EV: 'EV',
  }
  return m[v] ?? v
}
