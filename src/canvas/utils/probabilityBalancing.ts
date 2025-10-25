/**
 * Probability Balancing Utilities
 *
 * Implements two strategies for adjusting probabilities to sum to 100%:
 * 1. Auto-balance: Preserves relative proportions, rounds to nice numbers
 * 2. Equal split: Divides remaining percentage equally (ignores current ratios)
 *
 * Both strategies respect locked rows and configurable constraints.
 */

export interface BalanceOptions {
  /** Target sum (typically 100) */
  target?: number
  /** Rounding step (5 for 5% increments, 1 for precise) */
  step?: number
  /** Minimum value for non-zero rows (0 allows zeroing out) */
  minNonZero?: number
  /** Preserve rank order of values */
  preserveRank?: boolean
}

export interface BalanceResult {
  values: number[]
  error?: string
}

export interface BalanceRow {
  value: number
  locked: boolean
}

/**
 * Normalizes unlocked values to fill remaining target
 *
 * @example
 * // Locked=30, unlocked=[40, 20], target=100
 * // Remaining = 70, ratio = 70/60 = 1.167
 * // Result: [46.67, 23.33]
 */
function normalizeTo(
  rows: BalanceRow[],
  target: number = 100
): number[] {
  const lockedSum = rows
    .filter(r => r.locked)
    .reduce((sum, r) => sum + r.value, 0)

  const remaining = target - lockedSum

  if (remaining <= 0) {
    // All locked or over target - return current values
    return rows.map(r => r.value)
  }

  const unlockedSum = rows
    .filter(r => !r.locked)
    .reduce((sum, r) => sum + r.value, 0)

  if (unlockedSum === 0) {
    // All unlocked are zero - can't preserve ratios, fallback to equal split
    const unlockedCount = rows.filter(r => !r.locked).length
    if (unlockedCount === 0) return rows.map(r => r.value)

    const perUnlocked = remaining / unlockedCount
    return rows.map(r => r.locked ? r.value : perUnlocked)
  }

  const ratio = remaining / unlockedSum

  return rows.map(r =>
    r.locked ? r.value : r.value * ratio
  )
}

/**
 * Rounds values to "nice" numbers (multiples of step)
 *
 * @example
 * roundNice([46.67, 23.33], 5) → [45, 25]
 */
function roundNice(values: number[], step: number = 5): number[] {
  return values.map(v => Math.round(v / step) * step)
}

/**
 * Hamilton/Largest-Remainder method for apportioning seats
 *
 * This is the same algorithm used in electoral systems to fairly
 * distribute seats after rounding. It ensures the sum equals target
 * while minimizing distortion from rounding.
 *
 * @example
 * // Values: [45, 25] (sum=70, target=100, remaining=30)
 * // Add 6 steps (5% each) to rows with largest fractional remainders
 * // Result: [50, 50] or [55, 45] depending on fractional parts
 */
function apportionRemainder(
  rows: BalanceRow[],
  rounded: number[],
  target: number = 100,
  step: number = 5,
  options: BalanceOptions = {}
): number[] {
  const { minNonZero = 0, preserveRank = true } = options

  const result = [...rounded]

  // First pass: ensure all non-zero values meet minNonZero
  // This may cause sum to exceed target temporarily
  for (let i = 0; i < result.length; i++) {
    if (!rows[i].locked && rows[i].value > 0 && result[i] > 0 && result[i] < minNonZero) {
      result[i] = minNonZero
    }
  }

  const currentSum = result.reduce((sum, v) => sum + v, 0)
  let delta = target - currentSum

  if (delta === 0) return result

  // Calculate fractional remainders (how much was lost in rounding)
  const normalized = normalizeTo(rows, target)
  const remainders = rounded.map((r, i) => ({
    index: i,
    locked: rows[i].locked,
    value: r,
    normalized: normalized[i],
    remainder: rows[i].locked ? 0 : Math.abs(normalized[i] - r)
  }))

  // Sort by remainder (largest first), then by original rank to break ties
  remainders.sort((a, b) => {
    if (a.locked) return 1  // Locked go last
    if (b.locked) return -1
    if (Math.abs(b.remainder - a.remainder) > 0.001) {
      return b.remainder - a.remainder
    }
    // Tie-breaker: prefer higher original values
    return b.normalized - a.normalized
  })

  if (delta > 0) {
    // Need to add steps
    let stepsToAdd = Math.round(delta / step)

    for (let i = 0; i < remainders.length && stepsToAdd > 0; i++) {
      const { index, locked } = remainders[i]
      if (locked) continue

      result[index] += step
      stepsToAdd--
    }
  } else if (delta < 0) {
    // Need to remove steps
    let stepsToRemove = Math.round(Math.abs(delta) / step)

    // Sort by smallest remainder for removal (remove from least deserving)
    remainders.sort((a, b) => {
      if (a.locked) return 1
      if (b.locked) return -1
      if (Math.abs(a.remainder - b.remainder) > 0.001) {
        return a.remainder - b.remainder
      }
      return a.normalized - b.normalized
    })

    for (let i = 0; i < remainders.length && stepsToRemove > 0; i++) {
      const { index, locked } = remainders[i]
      if (locked) continue
      // Don't remove if it would violate minNonZero for originally non-zero values
      if (rows[index].value > 0 && result[index] - step < minNonZero) continue

      result[index] -= step
      stepsToRemove--
    }
  }

  // Preserve rank order if requested
  if (preserveRank) {
    const originalOrder = rows.map((r, i) => ({ index: i, value: r.value }))
    originalOrder.sort((a, b) => b.value - a.value)

    const resultOrder = result.map((v, i) => ({ index: i, value: v }))
    resultOrder.sort((a, b) => b.value - a.value)

    // Check if rank changed (simple check for adjacent swaps)
    for (let i = 0; i < originalOrder.length - 1; i++) {
      const origIdx1 = originalOrder[i].index
      const origIdx2 = originalOrder[i + 1].index

      if (result[origIdx1] < result[origIdx2] && !rows[origIdx1].locked && !rows[origIdx2].locked) {
        // Rank inverted, try to fix by swapping one step
        if (result[origIdx1] + step <= 100 && result[origIdx2] - step >= minNonZero) {
          result[origIdx1] += step
          result[origIdx2] -= step
        }
      }
    }
  }

  return result
}

/**
 * Auto-balance: Preserves relative proportions, rounds to nice numbers
 *
 * Algorithm:
 * 1. Normalize unlocked values to fill remaining space
 * 2. Round to nearest "nice" number (5% or 1% steps)
 * 3. Use Hamilton method to apportion remainder
 * 4. Preserve rank order (bigger stays bigger)
 *
 * @example
 * autoBalance([{value: 67, locked: false}, {value: 8, locked: false}])
 * // → [90, 10]  (preserves 67:8 ≈ 8.4:1 ratio → 90:10 = 9:1)
 *
 * autoBalance([{value: 41, locked: false}, {value: 33, locked: false}, {value: 18, locked: false}])
 * // → [45, 35, 20]  (preserves relative sizes and rank order)
 */
export function autoBalance(
  rows: BalanceRow[],
  options: BalanceOptions = {}
): BalanceResult {
  const {
    target = 100,
    step = 5,
    minNonZero = 0,
    preserveRank = true
  } = options

  // Check for locked sum overflow
  const lockedSum = rows
    .filter(r => r.locked)
    .reduce((sum, r) => sum + r.value, 0)

  if (lockedSum > target) {
    return {
      values: rows.map(r => r.value),
      error: `Locked rows sum to ${lockedSum}% (exceeds ${target}%). Unlock some rows to continue.`
    }
  }

  // Step 1: Normalize to target
  const normalized = normalizeTo(rows, target)

  // Step 2: Round to nice numbers
  const rounded = roundNice(normalized, step)

  // Step 3: Apportion remainder using Hamilton method
  const values = apportionRemainder(rows, rounded, target, step, {
    minNonZero,
    preserveRank
  })

  return { values }
}

/**
 * Equal split: Divides remaining percentage equally across unlocked rows
 *
 * Ignores current proportions - pure equal division.
 * Rounds to nice numbers and assigns remainder to first rows.
 *
 * @example
 * equalSplit([{value: 67, locked: false}, {value: 8, locked: false}])
 * // → [50, 50]  (ignores 67:8 ratio, splits 100% equally)
 *
 * equalSplit([{value: 10, locked: true}, {value: 45, locked: false}, {value: 45, locked: false}])
 * // → [10, 45, 45]  (splits remaining 90% equally: 45/45)
 */
export function equalSplit(
  rows: BalanceRow[],
  options: BalanceOptions = {}
): BalanceResult {
  const {
    target = 100,
    step = 5,
    minNonZero = 0
  } = options

  const lockedSum = rows
    .filter(r => r.locked)
    .reduce((sum, r) => sum + r.value, 0)

  if (lockedSum > target) {
    return {
      values: rows.map(r => r.value),
      error: `Locked rows sum to ${lockedSum}% (exceeds ${target}%). Unlock some rows to continue.`
    }
  }

  const remaining = target - lockedSum
  const unlockedCount = rows.filter(r => !r.locked).length

  if (unlockedCount === 0) {
    return { values: rows.map(r => r.value) }
  }

  // Pure equal division
  const perRow = remaining / unlockedCount

  // Round to nearest step
  const roundedPerRow = Math.round(perRow / step) * step

  // Calculate remainder after rounding
  const totalRounded = roundedPerRow * unlockedCount
  const remainder = remaining - totalRounded
  const extraSteps = Math.abs(Math.round(remainder / step))

  // Distribute equally, assign remainder to first rows
  let unlockedIndex = 0
  const values = rows.map(r => {
    if (r.locked) return r.value

    const base = roundedPerRow
    let extra = 0

    if (remainder > 0 && unlockedIndex < extraSteps) {
      // Need to add steps
      extra = step
    } else if (remainder < 0 && unlockedIndex < extraSteps) {
      // Need to subtract steps
      extra = -step
    }

    unlockedIndex++

    return Math.max(base + extra, minNonZero)
  })

  return { values }
}
