/**
 * §11.6 — Evaluative colour thresholds (Design System v3.1)
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
  if (value >= 0.7) return 'bg-success'
  if (value >= 0.4) return 'bg-warning'
  return 'bg-danger'
}
