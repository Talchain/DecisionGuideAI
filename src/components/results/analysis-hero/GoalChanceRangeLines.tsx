import { typography } from '@/styles/typography'
import { GraphLink } from '../GraphLink'
import type { GoalChanceRange } from '../utils/goalChanceRange'
import { GOAL_CHANCE_RANGE_ACTION, goalChanceRangeLine } from './goalChanceCopy'

export interface GoalChanceRangeLinesProps {
  range: GoalChanceRange | null
  labelOf: (nodeId: string) => string | null
  /** The hero already rendered the licence's clause. */
  heroHorizonShown?: boolean
}

export function GoalChanceRangeLines({ range, labelOf, heroHorizonShown = false }: GoalChanceRangeLinesProps) {
  if (range === null) return null
  const horizonLine = heroHorizonShown ? null : range.horizonLine
  const lines = range.optionIds.flatMap((id) => {
    const entry = range.rangeByOption[id]
    const line = goalChanceRangeLine(entry, labelOf(id), labelOf, range.target)
    if (line === null) return []
    return [
      <p key={id} data-testid="goal-chance-range-line" data-option-id={id}>
        {line}
        {/* ONE click opens THIS link's inspector (Canvas D1 `openLinkInspector`, exact endpoints; an absent or stale
            link opens nothing and falls back to GraphLink's focus). DL #87: focus alone left the user at a dead end. */}
        {entry.kind !== 'stated_time' && <>{' '}<GraphLink edgeRef={{ fromId: entry.from, toId: entry.to }} label={GOAL_CHANCE_RANGE_ACTION[entry.kind]} opensInspector /></>}
      </p>,
    ]
  })
  if (lines.length === 0 && horizonLine === null) return null
  return (
    <div data-testid="goal-chance-range-lines" className={`flex flex-col gap-2 py-2 ${typography.panelBody}`}>
      {lines}
      {horizonLine !== null && <p data-testid="goal-chance-range-horizon">{horizonLine}</p>}
    </div>
  )
}
