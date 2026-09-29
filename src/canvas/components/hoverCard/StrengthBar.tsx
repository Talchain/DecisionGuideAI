/**
 * A link's strength, drawn (Paul 29 Sep: the old pop-ups "had concrete data and visualisations on them").
 *
 * The fill is the SERVER'S magnitude (|strength|, capped at the model's 1.0 scale) — a rendering of the stated number,
 * never a band word or a percentage. The colour follows the STATED direction only (provenance-gated by the caller);
 * with no stated direction it is neutral. `aria-hidden`: the figure itself is always written beside it.
 */
export function StrengthBar({ magnitude, direction, testId }: { magnitude: number; direction: 'positive' | 'negative' | null; testId?: string }) {
  const fill = Math.max(0, Math.min(1, Math.abs(magnitude)))
  const tone = direction === 'negative' ? 'bg-danger' : direction === 'positive' ? 'bg-success' : 'bg-text-light'
  return (
    <span aria-hidden="true" data-testid={testId} className="mx-1 inline-block h-1.5 w-10 overflow-hidden rounded-full bg-panel-hover align-middle">
      <span data-testid={testId ? `${testId}-fill` : undefined} className={`block h-full ${tone}`} style={{ width: `${fill * 100}%` }} />
    </span>
  )
}
