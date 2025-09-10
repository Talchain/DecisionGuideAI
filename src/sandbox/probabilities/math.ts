// Returns n numbers summing to 1.00, 2-dp, fixing the last to absorb rounding.
export function evenSplit(n: number): number[] {
  if (n <= 0) return []
  const base = +(1 / n).toFixed(2)
  const arr = Array.from({ length: n }, () => base)
  const sum = +(arr.reduce((a, b) => a + b, 0)).toFixed(2)
  const diff = +(1 - sum).toFixed(2)
  // Fix tail
  arr[n - 1] = +(arr[n - 1] + diff).toFixed(2)
  return arr
}

// Scales values so that sum === 1.00 (2-dp), fixing the last to absorb rounding.
export function normalize(values: number[]): number[] {
  if (!values.length) return []
  const rawSum = values.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0)
  if (rawSum <= 0) return evenSplit(values.length)
  const scale = 1 / rawSum
  const scaled = values.map(v => +( (v || 0) * scale ).toFixed(2))
  const sum = +(scaled.reduce((a, b) => a + b, 0)).toFixed(2)
  const diff = +(1 - sum).toFixed(2)
  scaled[scaled.length - 1] = +(scaled[scaled.length - 1] + diff).toFixed(2)
  return scaled
}
