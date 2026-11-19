import { BODY, H, LABEL } from '../../../olumiCore/team/ui'
import { typography } from '../../../styles/typography'
import { requestAsk } from '../../../canvas/ui/inspector-v2/askSemantic'
import { OkIcon } from '../../look/icons'
import type { View, ViewCard } from '../../client'
import { OlumiMark, PersonMark } from '../cards/marks'
import { useLaneInspector } from '../edit/inspectorStore'
import { findingOf as modelFindingOf } from '../contract'
import { FindingLine } from '../../FindingLine'

/**
 * The Frame page (Paul, 19 Nov: "open on the question, with the aims beneath"; spec framing-20261119/mock/SPEC.md rows 1, 3, 4, 5, 8, 9 and "No model yet").
 * It reads the View's own fields and composes no sentence about the model: the question, each aim's and limit's own words, core's finding line and
 * the option names. Edit uses what the canvas uses (the details panel for a card; the composer, then the proposal path, for the question).
 * Attribution is per field: the card's `olumi` marks the card Olumi's (dashed, blue); `bound.olumi` marks the bound alone; "yours" only where
 * neither is Olumi's, with core's `author.text` on hover. Two aims are two cards: they are never merged.
 */
export const FRAME_WORDS = {
  question: 'Question', edit: 'Edit', matters: 'What matters', aims: 'Aims', limits: 'Limits', routes: 'Routes you could take', fullGraph: 'Full graph',
  inWords: 'kept in words', noModel: 'No model yet', build: 'Build a model from this',
} as const
export const moreCardsWords = (n: number): string => `${n} more ${n === 1 ? 'card' : 'cards'} in the full graph`

const CARD_BOX = 'grid gap-1 rounded-md border p-3'
const EDIT = `${typography.viewPanelMeta} inline-flex min-h-[24px] items-center gap-1 text-text-body underline underline-offset-2 hover:text-text-header focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/50`
const BTN = `${typography.viewPanelMeta} inline-flex min-h-[24px] items-center rounded-md border border-panel-border px-2 text-text-body hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/50`

/** Core's finding words, verbatim: `run.most_likely.text`, else the head, label and text of `run.waits_on`. */
export function findingOf(model: NonNullable<View['model']>): readonly string[] | null {
  const run = model.run
  if (run?.most_likely != null && run.most_likely.text.trim() !== '') return [run.most_likely.text]
  const w = run?.waits_on
  return w == null ? null : [w.head, w.label, w.text].filter((x) => x.trim() !== '')
}

function Mark({ card, bound }: { card: ViewCard; bound: boolean }): JSX.Element | null {
  const own = card.olumi != null, boundOwn = card.bound?.olumi != null
  if (bound) return boundOwn ? <OlumiMark words={card.bound!.olumi!.title} /> : null
  if (own) return <OlumiMark words={card.olumi!.title} />
  // "Yours" only where neither the card nor its bound is Olumi's; core's author words on hover.
  return boundOwn ? null : <PersonMark words={card.author?.text ?? null} />
}

function Aim({ card }: { card: ViewCard }): JSX.Element {
  const own = card.olumi != null
  const b = card.bound
  return (
    <li className={`${CARD_BOX} ${own ? 'border-dashed border-info' : 'border-panel-border'}`} data-testid={`frame-card-${card.id}`} data-olumi-card={own ? '' : undefined}>
      <div className="flex items-start gap-1.5">
        <span className={`${BODY} min-w-0 flex-1 break-words`} data-frame="heading"><Mark card={card} bound={false} /> {card.heading}</span>
        <button type="button" className={EDIT} data-testid={`frame-edit-${card.id}`} aria-label={`${FRAME_WORDS.edit}: ${card.heading}`}
          onClick={() => useLaneInspector.getState().open({ kind: 'card', id: card.id })}>{FRAME_WORDS.edit}</button>
      </div>
      <span className={`${BODY} text-text-light`} data-frame="bound" title={b?.title}>
        {b != null && b.measured ? <>{b.text}<Mark card={card} bound /></> : FRAME_WORDS.inWords}
      </span>
    </li>
  )
}

export function FramePage({ view, onClose }: { view: View; onClose: () => void }): JSX.Element | null {
  const model = view.model
  if (model == null) return null
  const q = model.question
  const aims = model.cards.filter((c) => c.family === 'goal'), limits = model.cards.filter((c) => c.family === 'limit'), routes = model.cards.filter((c) => c.family === 'option')
  const more = model.cards.length - aims.length - limits.length - routes.length
  const finding = modelFindingOf(model) === null ? findingOf(model) : null
  const editQuestion = () => { if (q.text.trim() !== '') requestAsk({ text: q.text, label: q.text, source: 'frame' }) }
  return (
    <div className="mx-auto grid max-w-[880px] gap-5 px-6 pb-12 pt-16" data-testid="frame-page">
      <section className="grid gap-2" aria-label={FRAME_WORDS.question}>
        <div className="flex items-start gap-2">
          <h2 className={`${typography.viewPanelBody} m-0 min-w-0 flex-1 break-words font-medium text-text-header`} data-testid="frame-question">{q.text}</h2>
          {model.cards.length === 0 ? null : <button type="button" className={EDIT} data-testid="frame-edit-question" aria-label={`${FRAME_WORDS.edit}: ${FRAME_WORDS.question}`} onClick={editQuestion}>{FRAME_WORDS.edit}</button>}
        </div>
      </section>
      {model.cards.length === 0 ? (
        <section className="grid gap-2" data-testid="frame-no-model">
          <p className={H}>{FRAME_WORDS.noModel}</p>
          <div><button type="button" className={BTN} data-testid="frame-build" onClick={() => { onClose(); editQuestion() }}>{FRAME_WORDS.build}</button></div>
        </section>
      ) : (
        <>
          {aims.length + limits.length === 0 ? null : (
            <section className="grid gap-3" aria-label={FRAME_WORDS.matters}>
              <h3 className={H}>{FRAME_WORDS.matters}</h3>
              {aims.length === 0 ? null : <div className="grid gap-1"><span className={LABEL}>{FRAME_WORDS.aims}</span><ul className="m-0 grid list-none gap-2 p-0" data-testid="frame-aims">{aims.map((c) => <Aim key={c.id} card={c} />)}</ul></div>}
              {limits.length === 0 ? null : <div className="grid gap-1"><span className={LABEL}>{FRAME_WORDS.limits}</span><ul className="m-0 grid list-none gap-2 p-0" data-testid="frame-limits">{limits.map((c) => <Aim key={c.id} card={c} />)}</ul></div>}
            </section>
          )}
          {finding === null ? <FindingLine model={model} at="frame" onFocusFigure={onClose} />
            : <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid="frame-finding">{finding.join(' ')}</p>}
          {routes.length === 0 ? null : (
            <section className="grid gap-1" aria-label={FRAME_WORDS.routes}>
              <h3 className={H}>{FRAME_WORDS.routes}</h3>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0" data-testid="frame-routes">
                {routes.map((c) => <li key={c.id} className={`${BODY} rounded-md border px-2 py-1 ${c.olumi != null ? 'border-dashed border-info' : 'border-panel-border'}`} data-testid={`frame-route-${c.id}`}>{c.olumi != null ? <><OlumiMark words={c.olumi.title} /> </> : null}{c.heading}</li>)}
              </ul>
            </section>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {more > 0 ? <span className={`${BODY} text-text-light`} data-testid="frame-more">{moreCardsWords(more)}</span> : null}
            <button type="button" className={BTN} data-testid="frame-full-graph" onClick={onClose}><OkIcon id="show-in-workspace" size={14} decorative inherit className="mr-1" />{FRAME_WORDS.fullGraph}</button>
          </div>
        </>
      )}
    </div>
  )
}
