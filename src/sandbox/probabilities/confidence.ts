export function clampConfidence(x: number): number {
  if (Number.isNaN(x)) return 0
  return Math.max(0, Math.min(1, x))
}

export function delta(oldV: number, newV: number): number {
  const d = clampConfidence(newV) - clampConfidence(oldV)
  // round to 2 decimals for telemetry stability
  return Math.round(d * 100) / 100
}
