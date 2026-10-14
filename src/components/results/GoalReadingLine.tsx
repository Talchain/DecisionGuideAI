import { Fragment } from 'react'
import { typography } from '@/styles/typography'
import { openNodeInspector } from '../../canvas/nodes/shared/openNodeInspector'
import type { GoalChanceGoalReading } from './utils/goalChanceLicence'

/**
 * CEE #3059: the goal chance rests on Olumi's OWN, unconfirmed reading of the goal (`goal_reading`). Said once beside the
 * chance, attributed to Olumi, with CEE's words verbatim in quotes (never the user's), and a control that opens the
 * existing editor for the node the reading is held on (the inspector: a goal node's opens its target editor). Several
 * readings are listed, each with its own control. No reading ⇒ nothing renders.
 */
export function GoalReadingLine({ reading, onChange = openNodeInspector, testId = 'goal-reading-line' }: {
  reading: GoalChanceGoalReading | null | undefined
  onChange?: (nodeId: string) => unknown
  testId?: string
}) {
  const readings = reading?.origin === 'olumi' ? reading.readings : []
  if (readings.length === 0) return null
  const control = (nodeId: string, label: string) => (
    <button
      type="button"
      data-testid={`${testId}-change`}
      data-node-id={nodeId}
      onClick={() => { onChange(nodeId) }}
      className="text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
    >
      {label}
    </button>
  )
  // CEE's words are already Olumi's own whole sentence ("Olumi works out … tell me if it's wrong"), so they are shown
  // once under an "Olumi's reading" label, never wrapped in a second "Olumi read …" sentence (Paul's UI session, 14 Oct).
  return (
    <p className={`${typography.panelBody} text-text-light`} data-testid={testId} data-origin="olumi">
      {readings.map((r, i) => (
        <Fragment key={`${r.nodeId}-${i}`}>
          {i > 0 && ' '}
          <span className="text-text-body">Olumi’s reading: </span>
          <span data-testid={`${testId}-words`} data-kind={r.kind ?? undefined}>{r.words}</span>{' '}
          {control(r.nodeId, 'Change goal')}
        </Fragment>
      ))}
    </p>
  )
}
