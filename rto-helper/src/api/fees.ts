import { apiClient } from '@/api/client'
import { getAgentJwt } from '@/lib/auth'

function authHeaders() {
  const token = getAgentJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type FeeCalculateResponse = {
  state: string
  vehicleType: string
  invoicePrice: number
  ownerType: string
  registrationType?: string
  fuelType?: string | null
  roadTax: { percent: number; amount: number }
  registrationFee: { kind: string; amount: number }
  hsrpFee: { kind: string; amount: number }
  smartCardFee: { kind: string; amount: number }
  handlingCharges: number
  agentServiceFeeDefault: number
  feeRateId: string
}

export async function fetchFeeCalculate(params: {
  state: string
  vehicleType: string
  price: number
  ownerType: string
  registrationType?: string
  fuelType?: string
}): Promise<FeeCalculateResponse> {
  const { data } = await apiClient.get<FeeCalculateResponse>('/fees/calculate', {
    params: {
      state: params.state,
      vehicleType: params.vehicleType,
      price: params.price,
      ownerType: params.ownerType,
      registrationType: params.registrationType,
      fuelType: params.fuelType,
    },
    headers: authHeaders(),
  })
  return data
}

export async function saveFeeCalculation(body: {
  clientId: string
  state: string
  vehicleType: string
  invoicePrice: number
  roadTaxAmount: number
  registrationFee: number
  hsrpFee: number
  smartCardFee: number
  handlingCharges: number
  agentServiceFee: number
}) {
  const { data } = await apiClient.post('/fees/save-calculation', body, {
    headers: authHeaders(),
  })
  return data
}
