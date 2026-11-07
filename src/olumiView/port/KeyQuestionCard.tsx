/**
 * The crafted key-question card (`components/results/analysis-hero/KeyQuestionCard.tsx`), ported onto olumi.view/3: core's first prompt about
 * the model's shape (`model.sharpen[0]`) as the question, its lead and its emphasis in core's words, and the principle it rests on (core's
 * `rationale`, e.g. "Pre-mortem (Klein): …") as the grounding line, verbatim. Core holds no evidence strength, so the crafted card's
 * " · strong evidence" and its "General guidance" twin are not drawn. Nothing when core sends no prompt.
 */
import type { ReactNode } from 'react'
import type { ViewModel } from '../client'
import { TYPE } from './type'

export interface KeyQuestionCardProps {
  model: ViewModel
  /** Mounted under the question (e.g. the coach move the prompt relates to, `sharpen[0].move`). */
  action?: ReactNode
}

export function KeyQuestionCard({ model, action }: KeyQuestionCardProps) {
  const q = model.sharpen?.[0]
  if (q === undefined || (q.lead === '' && q.emphasis === '')) return null
  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-panel-border bg-panel p-3" aria-label="Key question" data-testid="port-key-question" data-sharpen={q.id}>
      <h3 className={`${TYPE.meta} text-text-light`}>Key question</h3>
      <p className={`${TYPE.body} break-words text-text-header`} data-testid="port-key-question-text">
        <span data-view="sharpen.0.lead">{q.lead}</span>{' '}
        <span className="font-medium" data-view="sharpen.0.emphasis">{q.emphasis}</span>
      </p>
      {q.rationale === '' ? null : <p className={`${TYPE.meta} break-words text-text-light`} data-testid="port-key-question-grounding" data-view="sharpen.0.rationale">{q.rationale}</p>}
      {action}
    </section>
  )
}

export default KeyQuestionCard
