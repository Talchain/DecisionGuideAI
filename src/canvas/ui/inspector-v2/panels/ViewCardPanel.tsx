/**
 * THE INSPECTOR FOR A VIEW CARD ON THE OLUMI-CORE LANE (canvas A B6, 00057 #2): a selected `viewCard`, or the question, shows what core
 * wrote for it and nothing else. Every drawn string is the View's own, at the `data-view` path the canvas card uses (`ViewCardLines` is
 * the canvas card's renderer, so the two cannot disagree); every hover is core's. No kind label, rename or technical-detail toggle: the
 * inspector shell's words are DGAI's, and the View has none for them. Only the drag surface and Close are kept.
 */
import { type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import type { ViewCard, ViewModel } from '../../../../olumiView/client'
import { Mark, ViewCardLines } from '../../../nodes/ViewCardNode'
import { typography } from '../../../../styles/typography'
import { INSPECTOR_SHELL_STYLE, inspectorIconButton } from '../inspectorStyle'
import type { DragHandlers } from '../types'

export type ViewCardPanelSubject = { card: ViewCard } | { question: ViewModel['question'] }

export function ViewCardPanel({ subject, onClose, dragHandlers }: { subject: ViewCardPanelSubject; onClose: () => void; dragHandlers?: DragHandlers }) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }
  const dragging = dragHandlers?.isDragging ?? false
  return (
    <div className="bg-panel overflow-hidden font-sans flex flex-col" style={INSPECTOR_SHELL_STYLE} role="region" aria-label="Inspector panel" onKeyDown={onKeyDown} data-testid="view-card-panel">
      <div
        className={`flex items-start gap-2 px-3.5 py-[13px] select-none shrink-0 ${dragHandlers ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        {...(dragHandlers ? { onPointerDown: dragHandlers.onPointerDown, onPointerMove: dragHandlers.onPointerMove, onPointerUp: dragHandlers.onPointerUp, onPointerCancel: dragHandlers.onPointerCancel } : {})}
      >
        <div className={`flex-1 min-w-0 flex items-baseline gap-1 ${typography.panelHeader} text-text-header`}>
          {'card' in subject ? (
            <>
              <span data-view={`${subject.card.id}.glyph`}>{subject.card.glyph}</span>
              <span data-view={`${subject.card.id}.heading`}>{subject.card.heading}</span>
              <Mark at={`${subject.card.id}.olumi`} mark={subject.card.olumi} />
              <Mark at={`${subject.card.id}.change`} mark={subject.card.change} />
            </>
          ) : <span data-view="question.text">{subject.question.text}</span>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close inspector" title="Close inspector" className={inspectorIconButton}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <div className={`px-3.5 pb-3.5 overflow-y-auto min-h-0 flex-1 space-y-1 ${typography.panelBody} text-text-body`}>
        {'card' in subject ? <ViewCardLines card={subject.card} value={typography.panelTabular} /> : <QuestionLines question={subject.question} />}
      </div>
    </div>
  )
}

/** The question's date (core's hover; Olumi's colour when Olumi set it) and its badge, as the canvas question draws them. */
function QuestionLines({ question: q }: { question: ViewModel['question'] }) {
  return (
    <>
      {q.decide_by === null ? null : (
        <p title={q.decide_by.title} className={q.decide_by.olumi ? 'text-info' : undefined} data-olumi={q.decide_by.olumi || undefined} data-view="question.decide_by.text">{q.decide_by.text}</p>
      )}
      {q.badge === null ? null : <p title={q.badge.title} aria-label={q.badge.label} data-view="question.badge.text">{q.badge.text}</p>}
    </>
  )
}
