// src/lib/currency.ts
export function formatUSD(v?: number): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '$0.00'
  return `$${v.toFixed(2)}`
}
