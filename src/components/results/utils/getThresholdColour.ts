/**
 * §11.6 — Evaluative colour thresholds (Design System v4)
 *
 * Universal threshold system for metrics judged as good/moderate/poor.
 * Returns a Tailwind background-colour class for use on bar fills.
 *
 *   0–39%  → danger  (needs attention)
 *   40–69% → warning (moderate)
 *   ≥ 70%  → success (strong)
 *
 * Does NOT apply to: driver influence bars (magnitude, not quality),
 * confidence glyph badges (use getConfidenceGlyph), win probability bars
 * (entity-coloured per option).
 */
export function getThresholdColour(value: number): string {
  // Round to integer percentage to avoid floating-point boundary issues
  // (e.g. 0.6999999 should be treated as 70%, not 69%)
  const pct = Math.round(value * 100)
  if (pct >= 70) return 'bg-success'
  if (pct >= 40) return 'bg-warning'
  return 'bg-danger'
}
