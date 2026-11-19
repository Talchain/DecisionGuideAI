/**
 * THE LANE'S SUMMARY (DL 4 Nov): the top bar's Summary on the olumi-core lane, drawn from what core's View already holds and nothing else.
 * The question, the Run's own lines (its lead, which option is most likely, its notes, the blockers options share, what it waits on), and
 * each option's chance rows, status and blockers, every string verbatim with core's hover. No sentence is written here and nothing is
 * worked out: an absent field draws nothing. Only the body remains; the top bar's trigger and panel were deleted (nothing mounted them). Off the lane the legacy `DecisionBriefTrigger` (the adapter's saved model) stays.
 */
import { typography } from '../styles/typography'
import { allOptionCards, notesBesideTiming } from './layout'
import { mostLikelyHover } from './ViewChances'
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
        <p key={i} title={row.title} className={typography.viewPanelBody} data-view-brief-row={`${card.id}.${i}`}>
          {row.kind === 'none' ? row.text : <>{row.aim} <span className={typography.viewPanelTabular}>{row.kind === 'chance' ? row.approx : ''}{row.value}</span>{row.kind === 'chance' && row.companion != null ? <span className={typography.viewPanelMeta} title={row.companion_title ?? row.companion} data-view-brief-companion={`${card.id}.${i}`}> {row.companion}</span> : null}{row.kind === 'chance' && row.timing != null ? <span className={typography.viewPanelMeta} title={row.timing_title ?? row.timing} data-view-brief-timing-row={`${card.id}.${i}`}> {row.timing}</span> : null}<MarkOf mark={row.olumi} />{row.kind === 'chance' ? <MarkOf mark={row.likely} /> : null}</>}
        </p>
      ))}
      {card.status === null ? null : <p className={typography.viewPanelBody} data-view-brief-status={card.id}>{card.status}</p>}
      {card.reason === null ? null : <p className={typography.viewPanelBody} data-view-brief-reason={card.id}>{card.reason}</p>}
    </>
  )
}

/** The Summary's body: the View's question, its Run and its options, in that order. */
export function ViewBriefBody({ model }: { model: Model }) {
  const run = model.run, options = allOptionCards(model)
  return (
    <div className="flex flex-col gap-4" data-testid="view-brief-body">
      <h2 className={`${typography.panelHeader} text-text-header`} data-testid="view-brief-question">{model.question.text}</h2>
      {run === null ? null : (
        <section className="flex flex-col gap-1" data-testid="view-brief-run">
          {run.lead === null ? null : <p className={typography.viewPanelBody}>{run.lead}</p>}
          {run.most_likely === null ? null : <p className={typography.viewPanelBody} title={mostLikelyHover(run.most_likely)} data-testid="view-brief-most-likely">{run.most_likely.text}</p>}
          {notesBesideTiming(run).map((n, i) => <p key={`n${i}`} className={typography.viewPanelBody} title={n.title}>{n.text}</p>)}
          {(run.timing ?? []).map((t) => <p key={`t${t.quantity}`} className={typography.viewPanelBody} data-view-brief-timing={t.quantity}>{t.text}</p>)}
          {(run.shared_blockers ?? []).map((b, i) => <p key={`b${i}`} className={typography.viewPanelBody}>{b.text}</p>)}
          {run.waits_on === null ? null : (
            <div data-testid="view-brief-waits">
              <p className={typography.viewPanelBody}>{run.waits_on.head}</p>
              <p className={typography.viewPanelBody}>{run.waits_on.text}</p>
              {run.waits_on.items.map((w) => <p key={w.id} className={typography.viewPanelBody} title={w.title}>{w.text}</p>)}
            </div>
          )}
        </section>
      )}
      {options.map((card) => (
        <section key={card.id} className="flex flex-col gap-1" data-testid={`view-brief-option-${card.id}`}>
          <h3 className={`${typography.viewPanelMeta} font-medium text-text-header`} title={card.detail === '' ? undefined : card.detail}>{card.glyph} {card.heading}<MarkOf mark={card.olumi} /></h3>
          <OptionRows card={card} />
        </section>
      ))}
    </div>
  )
}
