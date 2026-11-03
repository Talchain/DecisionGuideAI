/**
 * The question on the olumi-core lane's canvas (decision A, 00057 #1): the View's `model.question` exactly as core wrote it, across the
 * top as core's page draws it. Its date carries core's hover and, when Olumi set it, Olumi's colour; its badge is core's; a question
 * Olumi points at (`focus`) or proposes a change to (`proposed`) shows it as a card does. Each drawn string carries `data-view`.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ViewModel } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { Badge } from '../../olumiView/Badge'
import { QUESTION } from '../../olumiView/layout'

export type ViewQuestionData = { question: ViewModel['question']; width: number }

/** The question, pure: a test draws it from a golden View. */
export function ViewQuestion({ question, width }: ViewQuestionData) {
  const q = question
  return (
    <div
      className={`${typography.nodeLabel} rounded-lg border bg-panel p-3 space-y-1 ${q.proposed ? 'border-dashed border-info' : 'border-border'} ${q.focus ? 'ring-2 ring-info' : ''}`}
      style={{ width }} data-view-question="" data-focus={q.focus || undefined} data-proposed={q.proposed || undefined}
    >
      <p className={typography.nodeTitle} data-view="question.text">{q.text}</p>
      {q.decide_by === null ? null : (
        <p title={q.decide_by.title} className={q.decide_by.olumi ? 'text-info' : undefined} data-olumi={q.decide_by.olumi || undefined} data-view="question.decide_by.text">{q.decide_by.text}</p>
      )}
      {q.badge === null ? null : <p><Badge cardId={QUESTION} badge={q.badge} at="question" /></p>}
    </div>
  )
}

/** The React Flow node: the question, with the handle the links about the question as a whole end at. */
export function ViewQuestionNode({ data }: NodeProps) {
  return (
    <>
      <ViewQuestion {...(data as ViewQuestionData)} />
      <Handle type="target" position={Position.Bottom} isConnectable={false} />
    </>
  )
}
