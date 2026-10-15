import { typography } from '@/styles/typography'
import { GraphLink } from '../GraphLink'
import type { GoalChanceRange } from '../utils/goalChanceRange'
import { GOAL_CHANCE_RANGE_ACTION } from './goalChanceCopy'

export interface GoalChanceRangeLinesProps {
  /** The Run's ranges through the authority gate (`RunView.goalChanceRange`): only cells CEE serves as these bounds. */
  range: GoalChanceRange | null
  /**
   * #2747 re-scope 2 (U2): CEE's own sentence for an option's range cell (`face`), verbatim, or null. The line says it and
   * composes nothing of its own: no "chance of meeting your goal", never a sentence built from the bounds.
   */
  faceOf: (optionId: string) => string | null
  /** The hero already rendered the licence's clause. */
  heroHorizonShown?: boolean
  /**
   * DL (15 Oct, capacity e2e judge item 8): the option's label when ITS hero row already says this exact face, else null.
   * The face is then said once, in the row: this line keeps only the action, as a compact reference to that row.
   */
  heroSaidLabelOf?: (optionId: string, face: string) => string | null
}

export function GoalChanceRangeLines({ range, faceOf, heroHorizonShown = false, heroSaidLabelOf }: GoalChanceRangeLinesProps) {
  if (range === null) return null
  const horizonLine = heroHorizonShown ? null : range.horizonLine
  const lines = range.optionIds.flatMap((id) => {
    const entry = range.rangeByOption[id]
    const face = faceOf(id)
    if (face === null) return []
    const heroLabel = heroSaidLabelOf?.(id, face) ?? null
    if (heroLabel !== null) {
      // Said once: the hero row carries the sentence. A stated-time range has no action to keep, so nothing is repeated.
      if (entry.kind === 'stated_time') return []
      return [
        <p key={id} data-testid="goal-chance-range-line" data-option-id={id} data-said-in-hero="true">
          {`‘${heroLabel}’: `}
          <GraphLink edgeRef={{ fromId: entry.from, toId: entry.to }} label={GOAL_CHANCE_RANGE_ACTION[entry.kind]} opensInspector />
        </p>,
      ]
    }
    return [
      <p key={id} data-testid="goal-chance-range-line" data-option-id={id}>
        {face}
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
