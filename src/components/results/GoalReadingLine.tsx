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
  const single = readings.length === 1
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
  // CEE's words are whole sentences; a closing stop is added only where they have none.
  const quoted = (words: string) => `“${words}”${single && !/[.!?]$/.test(words) ? '.' : ''}`
  return (
    <p className={`${typography.panelBody} text-text-light`} data-testid={testId} data-origin="olumi">
      {'Olumi read your goal as '}
      {readings.map((r, i) => (
        <Fragment key={`${r.nodeId}-${i}`}>
          {i > 0 && (i === readings.length - 1 ? ' and ' : ', ')}
          <span data-testid={`${testId}-words`} data-kind={r.kind ?? undefined}>{quoted(r.words)}</span>
          {single ? <> {control(r.nodeId, 'Change it')} if that’s wrong.</> : <> ({control(r.nodeId, 'change it')})</>}
        </Fragment>
      ))}
      {!single && '.'}
    </p>
  )
}
