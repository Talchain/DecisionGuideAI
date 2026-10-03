/**
 * A link's strength, drawn (Paul 29 Sep: the old pop-ups "had concrete data and visualisations on them").
 *
 * The fill is the SERVER'S magnitude (|strength|, capped at the model's 1.0 scale) — a rendering of the stated number,
 * never a band word or a percentage. ONE NEUTRAL COLOUR, never green/red: the direction is said once, in words, and
 * a direction-coloured bar would state a disputed sign as settled (StyledEdge.connectorGrammar R7). The neutral is the
 * light ink, not `info`: Grammar v0 §2 keeps blue off every canvas surface (Paul, 1 Oct 2026). `aria-hidden`:
 * the figure itself is always written beside it.
 */
export function StrengthBar({ magnitude, testId }: { magnitude: number; testId?: string }) {
  const fill = Math.max(0, Math.min(1, Math.abs(magnitude)))
  return (
    <span aria-hidden="true" data-testid={testId} className="mx-1 inline-block h-1.5 w-10 overflow-hidden rounded-full bg-panel-hover align-middle">
      <span data-testid={testId ? `${testId}-fill` : undefined} className="block h-full bg-text-light" style={{ width: `${fill * 100}%` }} />
    </span>
  )
}
