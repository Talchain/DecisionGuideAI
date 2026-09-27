/**
 * B5 — one quiet line per stated limit, under the Success row: whether this run could
 * check it, and on whose figure. Words only (`limitVerdictView.ts`): no probability,
 * no "met", no raw code. Renders nothing when CEE sent no verdict for the analysis on
 * screen, so a model without verdicts reads exactly as before.
 */
import { typography } from '../../../../styles/typography'
import type { LimitVerdictView } from '../limitVerdictView'

export function LimitVerdictLines({
  view,
  testId = 'analysis-new-limit-verdicts',
}: {
  view: LimitVerdictView | null
  testId?: string
}) {
  if (!view) return null
  return (
    <ul className="flex flex-col gap-1 mt-1" data-testid={testId}>
      {view.rows.map((row) => (
        <li
          key={row.id}
          className={`${typography.panelMeta} text-text-light`}
          data-testid={`${testId}-row`}
          data-constraint-id={row.id}
          data-state={row.state}
        >
          {/* A full stop, not a dash (no em dashes in product text) and not a colon (the
              unscored words already carry one). */}
          <span className="text-text-body">{row.limitText}.</span> {row.words}
        </li>
      ))}
      {view.jointWords ? (
        <li className={`${typography.panelMeta} text-text-light`} data-testid={`${testId}-joint`}>
          {view.jointWords}
        </li>
      ) : null}
    </ul>
  )
}
