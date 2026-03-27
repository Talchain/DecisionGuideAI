/**
 * DS v5 §11.6 — Evaluative colour thresholds.
 *
 * Universal system for metrics judged good/moderate/poor:
 *   0–39%  → danger  (needs attention)
 *   40–69% → warning (moderate)
 *   ≥70%   → success (strong)
 *
 * Two return forms:
 * - `evaluativeToken(v)` → token name ('success' | 'warning' | 'danger')
 *    for Tailwind class composition (e.g. `text-${token}`, `bg-${token}`)
 * - `evaluativeVar(v)` → CSS variable string (e.g. 'var(--success)')
 *    for inline `style={{ color }}` or SVG stroke attributes
 */

export type EvaluativeToken = 'success' | 'warning' | 'danger'

/** Returns the DS token name for a 0-1 metric value. */
export function evaluativeToken(value: number): EvaluativeToken {
  const pct = value * 100
  if (pct >= 70) return 'success'
  if (pct >= 40) return 'warning'
  return 'danger'
}

/** Returns a CSS variable reference for a 0-1 metric value. */
export function evaluativeVar(value: number): string {
  return `var(--${evaluativeToken(value)})`
}
