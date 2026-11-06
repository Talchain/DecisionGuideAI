/**
 * THE LANE'S SUMMARY (DL 4 Nov): the top bar's Summary on the olumi-core lane, drawn from what core's View already holds and nothing else.
 * The question, the Run's own lines (its lead, which option is most likely, its notes, the blockers options share, what it waits on), and
 * each option's chance rows, status and blockers, every string verbatim with core's hover. No sentence is written here and nothing is
 * worked out: an absent field draws nothing. Off the lane the legacy `DecisionBriefTrigger` (the adapter's saved model) stays.
 */
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, X } from 'lucide-react'
import { typography } from '../styles/typography'
import { DECISION_BRIEF_TRIGGER_LABEL } from '../canvas/decisionBrief/DecisionBriefTrigger'
import { allOptionCards, notesBesideTiming } from './layout'
import { mostLikelyHover } from './ViewChances'
import { currentModel, useViewStore } from './store'
import type { View } from './types'

type Model = NonNullable<View['model']>
type Card = Model['cards'][number]
type Mark = { glyph: string; title: string } | null

const MarkOf = ({ mark }: { mark: Mark }) => (mark === null ? null : <span title={mark.title} aria-label={mark.title}> {mark.glyph}</span>)

/** One option's rows as its card draws them: a chance or limit row's aim and value with its marks, or the row's own text. */
function OptionRows({ card }: { card: Card }) {
  return (
    <>
      {card.rows.map((row, i) => (
        <p key={i} title={row.title} className={typography.panelBody} data-view-brief-row={`${card.id}.${i}`}>
          {row.kind === 'none' ? row.text : <>{row.aim} <span className={typography.panelTabular}>{row.kind === 'chance' ? row.approx : ''}{row.value}</span>{row.kind === 'chance' && row.companion != null ? <span className={typography.panelMeta} title={row.companion_title ?? row.companion} data-view-brief-companion={`${card.id}.${i}`}> {row.companion}</span> : null}{row.kind === 'chance' && row.timing != null ? <span className={typography.panelMeta} title={row.timing_title ?? row.timing} data-view-brief-timing-row={`${card.id}.${i}`}> {row.timing}</span> : null}<MarkOf mark={row.olumi} />{row.kind === 'chance' ? <MarkOf mark={row.likely} /> : null}</>}
        </p>
      ))}
      {card.status === null ? null : <p className={typography.panelBody} data-view-brief-status={card.id}>{card.status}</p>}
      {card.reason === null ? null : <p className={typography.panelBody} data-view-brief-reason={card.id}>{card.reason}</p>}
    </>
  )
}

/** The Summary's body: the View's question, its Run and its options, in that order. */
export function ViewBriefBody({ model }: { model: Model }) {
  const run = model.run, options = allOptionCards(model)
  return (
    <div className="flex flex-col gap-3" data-testid="view-brief-body">
      <h2 className={`${typography.panelHeader} text-text-header`} data-testid="view-brief-question">{model.question.text}</h2>
      {run === null ? null : (
        <section className="flex flex-col gap-1" data-testid="view-brief-run">
          {run.lead === null ? null : <p className={typography.panelBody}>{run.lead}</p>}
          {run.most_likely === null ? null : <p className={typography.panelBody} title={mostLikelyHover(run.most_likely)} data-testid="view-brief-most-likely">{run.most_likely.text}</p>}
          {notesBesideTiming(run).map((n, i) => <p key={`n${i}`} className={typography.panelBody} title={n.title}>{n.text}</p>)}
          {(run.timing ?? []).map((t) => <p key={`t${t.quantity}`} className={typography.panelBody} data-view-brief-timing={t.quantity}>{t.text}</p>)}
          {(run.shared_blockers ?? []).map((b, i) => <p key={`b${i}`} className={typography.panelBody}>{b.text}</p>)}
          {run.waits_on === null ? null : (
            <div data-testid="view-brief-waits">
              <p className={typography.panelBody}>{run.waits_on.head}</p>
              <p className={typography.panelBody}>{run.waits_on.text}</p>
              {run.waits_on.items.map((w) => <p key={w.id} className={typography.panelBody} title={w.title}>{w.text}</p>)}
            </div>
          )}
        </section>
      )}
      {options.map((card) => (
        <section key={card.id} className="flex flex-col gap-0.5" data-testid={`view-brief-option-${card.id}`}>
          <h3 className={`${typography.panelHeader} text-text-header`} title={card.detail === '' ? undefined : card.detail}>{card.glyph} {card.heading}<MarkOf mark={card.olumi} /></h3>
          <OptionRows card={card} />
        </section>
      ))}
    </div>
  )
}

/** The top bar's Summary control on the lane, and its panel beside the canvas (non-modal, as the legacy one). */
export function ViewBriefTrigger({ className = '' }: { className?: string }) {
  // Only the approved, current model's results, as Analysis and Reasoning show them (store.ts currentModel): with a proposal held,
  // a read that failed, or a canvas changed since the read, none is stated (R1 review P1).
  const model = useViewStore(currentModel)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])
  if (model === null) return null
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} className={className} aria-expanded={open} aria-label={DECISION_BRIEF_TRIGGER_LABEL} data-testid="view-brief-trigger">
        <FileText size={14} aria-hidden="true" />
      </button>
      {open && createPortal(
        <aside role="complementary" aria-label={DECISION_BRIEF_TRIGGER_LABEL} data-testid="view-brief-panel"
          className="fixed bottom-3 right-3 top-16 z-[1600] flex w-[400px] max-w-[calc(100vw-24px)] flex-col rounded-lg border border-panel-border bg-panel shadow-panel">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="text-sm font-semibold text-text-header">{DECISION_BRIEF_TRIGGER_LABEL}</span>
            <span className="flex-1" />
            <button type="button" onClick={close} className="rounded-md p-1.5 text-text-light hover:bg-panel-hover hover:text-text-header" aria-label="Close summary" data-testid="view-brief-close">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3"><ViewBriefBody model={model} /></div>
        </aside>,
        document.body,
      )}
    </>
  )
}
