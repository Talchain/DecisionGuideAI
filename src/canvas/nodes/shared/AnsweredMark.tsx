/**
 * THE ANSWERED TICK: a card whose Olumi question the person answered on the note keeps a small tick in its bottom band,
 * with the question and the answer on hover and as its accessible description (`answeredQuestionsStore.ts`). Quiet,
 * like the card's other marks: it records the person's reasoning, it does not grade it.
 */
import { CheckCircle2 } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import { useAnsweredQuestion } from '../../stores/answeredQuestionsStore'
import { BottomCardMark } from './CardMark'
import { SOURCE_MARK_GLYPH_CLASSES } from './EstimateMarker'

export const ANSWERED_MARK_COPY = {
  label: 'You answered Olumi',
  detail: (question: string, answer: string) => `${question} — ${answer}`,
} as const

export function AnsweredMark({ nodeId }: { nodeId: string }) {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  const answered = useAnsweredQuestion(scenarioId, nodeId)
  if (answered === null) return null
  const detail = ANSWERED_MARK_COPY.detail(answered.question, answered.answer)
  return (
    <BottomCardMark>
      <Tooltip asChild content={`${ANSWERED_MARK_COPY.label}: ${detail}`}>
        <span className="inline-flex">
          <span
            data-testid={`answered-mark-${nodeId}`}
            role="img"
            tabIndex={0}
            aria-label={ANSWERED_MARK_COPY.label}
            aria-description={detail}
            className={`${typography.edgeLabel} inline-flex shrink-0 items-center text-text-light`}
          >
            <CheckCircle2 aria-hidden="true" className={SOURCE_MARK_GLYPH_CLASSES} />
          </span>
        </span>
      </Tooltip>
    </BottomCardMark>
  )
}
