import { controls } from '../../../styles/controls'
import type { ViewCard, ViewModel } from '../../client'
import { HoverButton } from '../../look/Hover'
import { measureQuestionOf, type Question } from '../../reasoning/answer'
import { useReasoningFocus } from '../../reasoning/focusRequest'
import { useViewStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { NOT_COUNTED_YET } from './words'

export function waitingMeasureQuestion(card: ViewCard, model: ViewModel | null): Question | null {
  if (card.family !== 'goal' || (card.bound as { measured?: boolean } | null)?.measured !== false || card.doubt !== true) return null
  return model === null ? null : measureQuestionOf(model, card.id)
}

export function GoalMeasureLine({ question, className }: { question: Question; className: string }): JSX.Element {
  return (
    <HoverButton type="button" className={`${controls.chipText} ${className} nodrag nopan cursor-pointer text-left`} words={question.text}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
      onClick={(e) => {
        e.stopPropagation()
        const { sid } = useViewStore.getState()
        if (sid !== null) useReasoningFocus.setState({ request: { sid, key: `q:${question.id}` } })
        useUIStore.getState().forceActivateOutputTab('analysisNew')
      }}>
      {NOT_COUNTED_YET}
    </HoverButton>
  )
}
