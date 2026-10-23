/**
 * The goal card's today line, as the vision spec draws it (§2a, §3; 23 Oct 2026): "today 400 customers a week" with
 * its author as a glyph before the figure — your brief (page), worked out from the goal's parts (calculator), yours
 * (person), confirmed by you (tick), or Olumi's reading (the Olumi mark). The full sentence ("Today: 400 customers a
 * week — from your brief", "… — worked out from Weekly customers × Average spend per customer") is the hover and the
 * screen-reader text, so nothing the card said before is hidden.
 */
import { Calculator } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { typography } from '../../../styles/typography'
import type { GoalTodayLevel } from '../../domain/goalTarget'
import { cardMark, type CardMarkIcon } from './cardMarks'
import { SOURCE_MARK_GLYPH_CLASSES } from './EstimateMarker'
import { GOAL_TODAY_WORD, goalTodayLevelFigure } from './goalTodayLevelCopy'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'

const TODAY_GLYPH: Readonly<Record<GoalTodayLevel['basis'], CardMarkIcon>> = Object.freeze({
  from_brief: cardMark('source-brief').Icon,
  from_parts: Calculator,
  user_stated: cardMark('source-you').Icon,
  user_confirmed: cardMark('source-confirmed').Icon,
  olumi_reading: cardMark('source-olumi').Icon,
})

export function GoalTodayLevelText({ level, sentence, testId }: { level: GoalTodayLevel; sentence: string; testId: string }) {
  const Glyph = TODAY_GLYPH[level.basis]
  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={sentence}>
      <span className="inline" data-today-basis={level.basis}>
        <span aria-hidden="true" data-testid={`${testId}-visible`}>
          {GOAL_TODAY_WORD}{' '}
          <Glyph aria-hidden="true" data-today-glyph={level.basis} className={`${SOURCE_MARK_GLYPH_CLASSES} mr-0.5 align-[-1px]`} />
          {goalTodayLevelFigure(level)}
        </span>
        <span className={typography.screenReaderOnly} data-testid={`${testId}-sentence`}>{sentence}</span>
      </span>
    </Tooltip>
  )
}
