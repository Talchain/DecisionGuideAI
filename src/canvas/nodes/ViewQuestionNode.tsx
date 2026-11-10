/**
 * The question on the olumi-core lane's canvas (decision A, 00057 #1): the View's `model.question` exactly as core wrote it, across the
 * top as core's page draws it. Its date carries core's hover and, when Olumi set it, Olumi's colour; its badge is core's; a question
 * Olumi points at (`focus`) or proposes a change to (`proposed`) shows it as a card does. Each drawn string carries `data-view`.
 */
import { Handle, Position, useStore, type NodeProps } from '@xyflow/react'
import { reducedFaceSize } from '../../olumiView/camera'
import { ReducedFace } from './ReducedFace'
import { useLinkSides } from '../../olumiView/canvas'
import type { ViewModel } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { Badge } from '../../olumiView/Badge'
import { QUESTION } from '../../olumiView/layout'
import { NodeShapeIndicator } from './NodeShapeIndicator'

export type ViewQuestionData = { question: ViewModel['question']; width: number }

/** The question, pure: a test draws it from a golden View. */
export function ViewQuestion({ question, width, reducedPx = 0 }: ViewQuestionData & { reducedPx?: number }) {
  const q = question
  return (
    <div
      data-reduced={reducedPx > 0 || undefined}
      className={`relative ${typography.viewLabel} rounded-xl border bg-panel px-3 py-2.5 space-y-1 shadow-[0_2px_4px_rgba(37,37,32,0.02)] ${q.proposed ? 'border-info' : 'border-text-light'} ${q.focus ? 'shadow-[0_0_0_3px_rgba(39,122,157,0.14)]' : ''}`}
      style={{ width }} data-view-question="" data-focus={q.focus || undefined} data-proposed={q.proposed || undefined}
    >
      {/* J1 step 5: the model's question is the board's one 18px headline (Paul's three sizes, 12 / 14 / 18); J1 gate: its shape inline. */}
      <p className={`${typography.viewHeadline} flex items-start gap-2 text-text-header`}><span className="mt-[5px] inline-flex flex-none" aria-hidden="true"><NodeShapeIndicator nodeKind="decision" size={14} /></span><span data-view="question.text">{q.text}</span></p>
      {q.decide_by === null ? null : (
        <p title={q.decide_by.title} className={q.decide_by.olumi ? 'text-info' : undefined} data-olumi={q.decide_by.olumi || undefined} data-view="question.decide_by.text">{q.decide_by.text}</p>
      )}
      {q.badge === null ? null : <p><Badge cardId={QUESTION} badge={q.badge} at="question" /></p>}
      {reducedPx === 0 ? null : (
        // Zoomed out (Paul, 10 Nov): the question alone, inside the full face's box (ReducedFace). Core's words.
        <ReducedFace scale={reducedPx} semibold grow title={q.text} titleAttrs={{ 'data-view-reduced-question': '', 'data-view': 'question.text' }} />
      )}
    </div>
  )
}

/** The React Flow node: the question, with the handle the links about the question as a whole end at. */
export function ViewQuestionNode({ data }: NodeProps) {
  // The question heads the board: a link about it arrives on the side the board runs to (the layout's direction).
  const side = useLinkSides().out as Position
  const reducedPx = useStore((st) => reducedFaceSize(st.transform[2]))
  return (
    <>
      <ViewQuestion {...(data as ViewQuestionData)} reducedPx={reducedPx} />
      <Handle type="target" position={side} isConnectable={false} className="!opacity-0" />
    </>
  )
}
