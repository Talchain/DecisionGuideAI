export function mape(actuals: number[], forecasts: number[], eps = 1e-6): number {
  if (!Array.isArray(actuals) || !Array.isArray(forecasts) || actuals.length !== forecasts.length || actuals.length === 0) return 0
  let sum = 0
  for (let i = 0; i < actuals.length; i++) {
    const a = actuals[i]
    const f = forecasts[i]
    const denom = Math.max(eps, Math.abs(a))
    sum += Math.abs((a - f) / denom)
  }
  return (sum / actuals.length) * 100
}

export function brier(probabilities: number[], outcomes: number[]): number {
  if (!Array.isArray(probabilities) || !Array.isArray(outcomes) || probabilities.length !== outcomes.length || probabilities.length === 0) return 0
  let sum = 0
  for (let i = 0; i < probabilities.length; i++) {
    const p = clamp01(probabilities[i])
    const o = outcomes[i] ? 1 : 0
    sum += (p - o) * (p - o)
  }
  return sum / probabilities.length
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)) }
