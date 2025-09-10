export type OptionInput = {
  id: string
  p: number // probability [0,1]
  c: number // confidence [0,1]
  lastUpdatedMs?: number // ms since epoch of last edit for decay
}

export type ProjectionBands = {
  p10: number
  p50: number
  p90: number
}

export type ProjectionResult = {
  bands: ProjectionBands
}

export type ComputeProjectionOptions = {
  asOfMs: number
  decayHalfLifeMs?: number // default 14 days
}
