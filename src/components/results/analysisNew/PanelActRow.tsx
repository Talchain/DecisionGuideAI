/**
 * PanelActRow — ONE LAYOUT FOR A ROW OF ACTS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT
 * ═══════════════════════════════════════════════════════════════════════════
 * `StrengthenTheReasoning` alone carries THREE act-row layouts:
 *
 *   :1096  flex flex-wrap items-center gap-1.5 mt-1   ← a CHIP row, not acts
 *   :1243  flex flex-wrap items-center gap-2   mt-2   ← the row's acts
 *   :1408  mt-1 flex items-center gap-3               ← the dispute form's acts
 *
 * Two of those are the same thing — a horizontal run of controls under a block
 * of text — rendered at two gaps and two top margins. **And the third cannot
 * wrap at all**: no `flex-wrap`, so at a narrow dock its buttons overflow their
 * container rather than moving to a second line.
 *
 * ⚠ THE CHIP ROW IS NOT AN ACT ROW AND IS LEFT ALONE. Chips are labels that
 * happen to be pressable; acts are things the reader does to this finding. One
 * component for both would have to take a `gap` prop, which is the drift this
 * closes wearing a parameter.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS FIXED
 * ═══════════════════════════════════════════════════════════════════════════
 * `flex-wrap`, the gap, and vertical alignment. A caller supplies its own top
 * margin, because the space ABOVE a row is about what the row follows — a
 * paragraph, a form, a list — and that is genuinely the caller's question.
 *
 * ⭐ `flex-wrap` IS NOT NEGOTIABLE AND IS WHY THIS EXISTS RATHER THAN A SHARED
 * CONSTANT. The panel renders inside a dock the user can narrow; a row of four
 * acts at 280px has to become two lines. A constant can be copied minus one
 * class — which is exactly what happened at `:1408`.
 */
import type { ReactNode } from 'react'

/** Fixed: wrap, gap and alignment. Copying this string is the defect. */
export const ACT_ROW = 'flex flex-wrap items-center gap-2'

export interface PanelActRowProps {
  children: ReactNode
  /** Spacing ABOVE the row — the caller's question, since it depends on what precedes it. */
  className?: string
  testId?: string
}

export function PanelActRow({ children, className = '', testId }: PanelActRowProps): JSX.Element {
  return (
    <div className={`${ACT_ROW} ${className}`.trim()} {...(testId ? { 'data-testid': testId } : {})}>
      {children}
    </div>
  )
}
