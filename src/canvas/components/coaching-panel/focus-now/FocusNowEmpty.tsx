/**
 * FocusNowEmpty — honest, non-theatrical empty state.
 *
 * Because the static hygiene rows are always available, the live panel is
 * effectively never empty today; this shows only when a caller suppresses the
 * static rows and no server rows exist, or defensively when malformed input
 * collapses everything. Sparse-but-true: a calm line, no judgement, no theatrics.
 */
import { typography } from '@/styles/typography'
import { FOCUS_COPY } from './focusConstants'

export function FocusNowEmpty() {
  return (
    <p className={`${typography.panelBody} text-text-light`} data-testid="focus-empty">
      {FOCUS_COPY.emptyState}
    </p>
  )
}

export default FocusNowEmpty
