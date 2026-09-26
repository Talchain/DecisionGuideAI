/**
 * PrimaryControlCard — visual wrapper for the single primary editing surface
 * in a panel (strength slider, factor value input, intervention list, etc.).
 *
 * Sits inside the "Your input" PanelGroup and signals that this is THE thing
 * the user is here to do — everything else is visually secondary.
 *
 * ── Why `data-testid` is on the WRAPPER and not left to each caller ─────────
 * A panel note that describes THIS control has to be inside THIS card, and a
 * test can only assert that if the card is addressable. Before this existed,
 * `FactorExternalPanel.priorRangeHonesty.spec.tsx` reached for exactly this
 * selector — `role.closest('[data-testid="primary-control-card"]')` — and got
 * `null` on EVERY run, because nothing rendered the attribute. Its `??
 * role.parentElement` fallback then satisfied the assertion unconditionally,
 * so the mutant that moved the note OUT of the card (text byte-identical) was
 * measured GREEN. A guard naming a hook that does not exist is a guard
 * agreeing with itself (trap 13b), and it is invisible precisely because
 * `closest()` returns null rather than throwing.
 *
 * Shared here rather than per-panel so the next panel that needs to pin
 * "this note belongs to this control" inherits the hook instead of minting a
 * second one.
 */

import type { ReactNode } from 'react'

interface PrimaryControlCardProps {
  children: ReactNode
  className?: string
}

export function PrimaryControlCard({ children, className = '' }: PrimaryControlCardProps) {
  // ⭐ v3.1 (DESIGN-GAP-v31 row 32): FLAT. This was a bordered, rounded box
  // (`bg-panel border rounded-lg px-3 py-2.5`, 14px radius measured) holding
  // further boxes — an option's three 280×134 target cards inside a 306×473
  // card. The contract's inspector has no box in a box: detail rows with
  // hairline rules. The wrapper and its test id stay, so a note that belongs
  // to THIS control is still addressable inside it (see above).
  return (
    <div className={className} data-testid="primary-control-card">
      {children}
    </div>
  )
}
