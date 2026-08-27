import 'server-only'

export type FraudIntelligenceResult = {
  provider: string
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'ERROR'
  signal: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'
  reference: string | null
}

export type FraudAssessmentInput = {
  phoneHash: string
  orderTotal: number
  currency: 'BDT'
}

export interface FraudIntelligenceProvider {
  name: string
  assessCustomer(input: FraudAssessmentInput): Promise<FraudIntelligenceResult>
}

export function unavailableFraudIntelligence(provider = 'none'): FraudIntelligenceResult {
  return { provider, status: 'UNAVAILABLE', signal: 'UNKNOWN', reference: null }
}
