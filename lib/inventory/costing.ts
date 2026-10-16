import 'server-only'

export type InventoryCostSummary = {
  variantId: string
  stockQuantity: number
  costedQuantity: number
  averageCost: number | null
  inventoryValue: number | null
  potentialGrossProfitPerUnit: number | null
  costingMethod: 'WEIGHTED_AVERAGE'
}

export function calculateWeightedAverageCost(
  existingQuantity: number,
  existingTotalCost: number,
  incomingQuantity: number,
  incomingUnitCost: number,
) {
  const quantity = existingQuantity + incomingQuantity
  if (quantity <= 0) return 0
  return (existingTotalCost + incomingQuantity * incomingUnitCost) / quantity
}

export function calculateInventoryValue(stockQuantity: number, averageCost: number | null) {
  return averageCost === null ? null : stockQuantity * averageCost
}

export function calculateGrossProfit(sellingPrice: number, averageCost: number | null) {
  return averageCost === null ? null : sellingPrice - averageCost
}
