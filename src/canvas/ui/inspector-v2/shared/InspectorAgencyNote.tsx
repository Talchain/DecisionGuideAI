/**
 * InspectorAgencyNote — the ONE human-agency statement plus the pane's own
 * save truth, in one box (Paul 23 Sep contract feedback point 11: "One
 * human-agency statement, not three versions of the same disclaimer").
 *
 * ⚠ THE NOTICE KEEPS ITS IDENTITY. `id="inspector-authority-notice"` is what
 * the Router's `<fieldset disabled>` names in `aria-describedby`, and specs
 * bind the notice by `textContent` equality with the pane's constant. The
 * agency line is therefore a SIBLING inside the box, never text inside the
 * notice — so a disabled control is still described by the save truth alone,
 * and the truth each spec pins is unchanged.
 *
 * Contrast (point 12): the save truth uses `text-text-light`, the design
 * system's muted token (#6E6B6B, ≥5:1 on `bg-panel-hover`).
 */
import type { ReactNode } from 'react'
import { typography } from '../../../../styles/typography'
import { INSPECTOR_AGENCY_STATEMENT } from '../useInspectorMutations'

export function InspectorAgencyNote({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="inspector-agency-note"
      className="rounded border border-panel-border bg-panel-hover px-3 py-2"
    >
      <p
        data-testid="inspector-agency-statement"
        className={`${typography.panelBody} text-text-body m-0`}
      >
        {INSPECTOR_AGENCY_STATEMENT}
      </p>
      <p
        id="inspector-authority-notice"
        role="note"
        data-testid="inspector-authority-notice"
        className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
      >
        {children}
      </p>
    </div>
  )
}
