/**
 * CoachingCard — a GROUNDED guidance item, drawn as the contract's
 * `.section-highlight`.
 *
 * ⭐ v3.1 (DESIGN-GAP-v31 row 32): the served card was a boxed notification —
 * `rounded-lg shadow-1`, a 1px info border at 30%, a lightbulb, a dismiss ×
 * and a pill action — opening EVERY inspector with a generic nudge ("Consider
 * options that pull different levers…"). The generic nudge is gone
 * (`InspectorCoaching` renders nothing without a grounded guidance item); what
 * remains is drawn flat: a 2px `#A3C5D1` left rule, 12px text, and the one
 * inspector button style for its action. No lightbulb, no box, no shadow.
 *
 * The dismiss × is removed with the box: a section of the inspector is not a
 * notification to clear, and the guidance item keeps its own lifecycle in the
 * guidance store.
 *
 * Absent (not rendered) when no coaching data — parent controls visibility.
 */

import { typography } from '../../../../styles/typography'
import { inspectorButton, inspectorSectionHighlight } from '../inspectorStyle'

interface CoachingCardProps {
  text: string
  action?: { label: string; onClick: () => void }
}

export function CoachingCard({ text, action }: CoachingCardProps) {
  return (
    <section data-testid="inspector-guidance" className={inspectorSectionHighlight}>
      <p className={`${typography.panelBody} text-text-body m-0`}>{text}</p>
      {action && (
        <div className="mt-2">
          <button type="button" onClick={action.onClick} className={inspectorButton}>
            {action.label}
          </button>
        </div>
      )}
    </section>
  )
}
