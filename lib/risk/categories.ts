export type RiskActionValue = 'ALLOW' | 'ALLOW_WITH_VERIFICATION' | 'MANUAL_REVIEW' | 'REQUIRE_PREPAYMENT' | 'TEMPORARILY_RESTRICT' | 'BLOCK'
export type BusinessRiskCategory = 'GOOD' | 'MEDIUM' | 'BAD' | 'BLOCK'

export function businessRiskCategoryForAction(action: RiskActionValue | null | undefined): BusinessRiskCategory {
  if (action === 'BLOCK') return 'BLOCK'
  if (action === 'ALLOW_WITH_VERIFICATION') return 'MEDIUM'
  if (action === 'ALLOW') return 'GOOD'
  return 'BAD'
}
