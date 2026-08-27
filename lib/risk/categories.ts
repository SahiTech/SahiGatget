export type RiskLevelValue = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'
export type RiskCategory = 'GOOD' | 'MEDIUM' | 'BAD' | 'BLOCK'

export function riskCategoryForLevel(level: RiskLevelValue): RiskCategory {
  if (level === 'LOW') return 'GOOD'
  if (level === 'MEDIUM') return 'MEDIUM'
  if (level === 'HIGH') return 'BAD'
  return 'BLOCK'
}
