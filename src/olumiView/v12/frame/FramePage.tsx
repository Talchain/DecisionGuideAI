import { barCardOf } from '../../layout'
import { BODY, H, LABEL } from '../../../olumiCore/team/ui'
import { typography } from '../../../styles/typography'
import { requestAsk } from '../../../canvas/ui/inspector-v2/askSemantic'
import { OkIcon } from '../../look/icons'
import { Hover, HoverButton } from '../../look/Hover'
import type { View, ViewCard } from '../../client'
import { OlumiMark, PersonMark } from '../cards/marks'
import { VIEW_EDIT_CHIP_CLASS } from '../../../v5/blocks/chipClass'
import { isOlumiCoreLane } from '../../../olumiCore/lane'
import { targetCardOf } from '../../model/targets'
import { useModelEdit } from '../../model/editing'
import { useLaneInspector } from '../edit/inspectorStore'
import { findingOf as modelFindingOf } from '../contract'
import { FindingLine } from '../../FindingLine'
import { useFindingSurface } from '../../findingSurface'
import { withheldWords } from '../cards/words'

/**
 * The Frame page (Paul, 19 Nov: "open on the question, with the aims beneath"; spec framing-20261119/mock/SPEC.md rows 1, 3, 4, 5, 8, 9 and "No model yet").
 * It reads the View's own fields and composes no sentence about the model: the question, each aim's and limit's own words, core's finding line and
 * the option names. Edit uses what the canvas uses (the details panel for a card; the composer, then the proposal path, for the question).
 * Attribution is per field: the card's `olumi` marks the card Olumi's (dashed, blue); `bound.olumi` marks the bound alone; "yours" only where
 * neither is Olumi's, with core's `author.text` on hover. Two aims are two cards: they are never merged.
 */
/** Investor audit #2 (20 Nov: the chances sat behind the Results tab): a route says its chance at rest, core's headline words as its option card says them
 *  ("about 51% chance"), quiet beside its name. A withheld chance says nothing here: its reason is long and lives on the card. */
const shownChance = (c: ViewCard): NonNullable<ViewCard['headline']> | null => {
  const h = c.headline
  return h == null || h.text === '' || withheldWords(h) !== null ? null : h
}
/** What each chance is OF (Codex, 7923dd8c): core's run lead ("Chance of ‘…’, in this model on current information") once over the routes whose chance is the
 *  run's aim; a route whose chance is another aim's names that aim, by its card's own heading, on the route. Bound by id (`headline.aim_id`, `run.aim`). */
function routeChance(c: ViewCard, model: NonNullable<View['model']>): JSX.Element | null {
  const h = shownChance(c)
  if (h === null) return null
  const other = h.aim_id != null && h.aim_id !== (model.run?.aim ?? null) ? model.cards.find((x) => x.id === h.aim_id) ?? null : null
  return <span className="text-text-light" data-view={`${c.id}.headline.text`}> · {h.text}{other === null ? null : <> (<span data-view={`${other.id}.heading`}>{other.heading}</span>)</>}</span>
}
const runScoped = (c: ViewCard, model: NonNullable<View['model']>): boolean => { const h = shownChance(c); return h !== null && (h.aim_id == null || h.aim_id === (model.run?.aim ?? null)) }

export const FRAME_WORDS = {
  question: 'Question', edit: 'Edit', askChange: 'Ask Olumi to change it', matters: 'What matters', aims: 'Aims', limits: 'Limits', routes: 'Routes you could take', fullGraph: 'Full graph',
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

function Aim({ card, onEdit, lane }: { card: ViewCard; onEdit: (() => void) | null; lane: boolean }): JSX.Element {
  const own = card.olumi != null
  const b = card.bound
  return (
    <li className={`${CARD_BOX} ${own ? 'border-dashed border-info' : 'border-panel-border'}`} data-testid={`frame-card-${card.id}`} data-olumi-card={own ? '' : undefined}>
      <div className="flex items-start gap-1.5">
        <span className={`${BODY} min-w-0 flex-1 break-words`} data-frame="heading"><Mark card={card} bound={false} /> {card.heading}</span>
        {onEdit === null ? null : <button type="button" className={lane ? VIEW_EDIT_CHIP_CLASS : EDIT} data-testid={`frame-edit-${card.id}`} aria-label={`${FRAME_WORDS.edit}: ${card.heading}`}
          onClick={onEdit}>{FRAME_WORDS.edit}</button>}
      </div>
      <Hover className={`${BODY} text-text-light`} data-frame="bound" words={b?.title}>
        {b != null && b.measured ? b.text : FRAME_WORDS.inWords}<Mark card={card} bound />
      </Hover>
    </li>
  )
}

export function FramePage({ view, onClose }: { view: View; onClose: () => void }): JSX.Element | null {
  const model = view.model
  const surface = useFindingSurface()
  const { base } = useModelEdit()
  const lane = isOlumiCoreLane()
  if (model == null) return null
  const renderAim = (card: ViewCard) => {
    const bar = barCardOf(model, card.id)
    const target = bar === null ? targetCardOf(model, card) : bar.figure?.edit == null ? null : bar
    const edit = !lane ? () => useLaneInspector.getState().open({ kind: 'card', id: card.id })
      : target === null || base === null ? null : () => {
        if (useLaneInspector.getState().openFigure({ kind: 'card', id: target.id })) onClose()
      }
    return <Aim key={card.id} card={card} onEdit={edit} lane={lane} />
  }
  const q = model.question
  const aims = model.cards.filter((c) => c.family === 'goal'), limits = model.cards.filter((c) => c.family === 'limit'), routes = model.cards.filter((c) => c.family === 'option')
  const more = model.cards.length - aims.length - limits.length - routes.length
  const finding = modelFindingOf(model) === null ? findingOf(model) : null
  const editQuestion = () => { if (q.text.trim() !== '') requestAsk({ text: q.text, label: q.text, source: 'frame' }) }
  return (
    <div className="mx-auto grid max-w-[880px] gap-4 px-6 pb-12 pt-16" data-testid="frame-page">
      <section className="grid gap-2" aria-label={FRAME_WORDS.question}>
        <div className="flex items-start gap-2">
          <h2 className={`${typography.viewPanelBody} m-0 min-w-0 flex-1 break-words font-medium text-text-header`} data-testid="frame-question">{q.text}</h2>
          {model.cards.length === 0 ? null : <HoverButton type="button" className={EDIT} data-testid="frame-edit-question" words="Puts the question in the message box, for you to finish and send" onClick={editQuestion}>{FRAME_WORDS.askChange}</HoverButton>}
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
            <section className="grid gap-4" aria-label={FRAME_WORDS.matters}>
              <h3 className={H}>{FRAME_WORDS.matters}</h3>
              {aims.length === 0 ? null : <div className="grid gap-2"><span className={LABEL}>{FRAME_WORDS.aims}</span><ul className="m-0 grid list-none gap-3 p-0" data-testid="frame-aims">{aims.map(renderAim)}</ul></div>}
              {limits.length === 0 ? null : <div className="grid gap-2"><span className={LABEL}>{FRAME_WORDS.limits}</span><ul className="m-0 grid list-none gap-3 p-0" data-testid="frame-limits">{limits.map(renderAim)}</ul></div>}
            </section>
          )}
          {finding === null ? (surface === 'frame' ? <FindingLine model={model} at="frame" onFocusFigure={onClose} /> : null)
            : <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid="frame-finding">{finding.join(' ')}</p>}
          {routes.length === 0 ? null : (
            <section className="grid gap-2" aria-label={FRAME_WORDS.routes}>
              <h3 className={H}>{FRAME_WORDS.routes}</h3>
              {model.run?.lead == null || !routes.some((c) => runScoped(c, model)) ? null : <p className={`${typography.viewPanelMeta} m-0 text-text-light`} data-view="run.lead">{model.run.lead}</p>}
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0" data-testid="frame-routes">
                {routes.map((c) => <li key={c.id} className={`${BODY} rounded-md border px-2 py-1 ${c.olumi != null ? 'border-dashed border-info' : 'border-panel-border'}`} data-testid={`frame-route-${c.id}`}>{c.olumi != null ? <><OlumiMark words={c.olumi.title} /> </> : null}{c.heading}{routeChance(c, model)}</li>)}
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
