import { useState } from 'react'
import { Lock, Share2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { effectHeadingsOf, effectsOf, type EffectHeadings, type ViewEffect } from '../../olumiView/standin'
import { teamApi, TeamApiError } from './api'
import { useDraft } from './drafts'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWrites, useWriteSending } from './writes'
import { nonEmpty } from '../../olumiView/tipping'
import { AVATAR, BODY, CARD, ERR, FIELD, GO, LABEL, META, QUIET } from './ui'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { OkIcon } from '../../olumiView/look/icons'
import { DoubtsFailure, sendDoubts, useDoubtsSending, ViewDoubts } from './ViewDoubts'
import { viewFigureCardsOf } from './viewFigureCards'
import { itemsOf, needsStance, NO_PICK, StrategyFields, useStrategyVocabulary, type StrategyPick } from '../../olumiView/strategy/StrategyCompose'

/** A view's figure as both a revealed and a private view carry it (a revealed one also carries its mark words, N3). */
type Figure = View['collab']['mine'][number]['figures'][number]

/** The figures a person gave with their view, each in core's words (its `text`, with core's `title` on hover), in core's order. */
/** The heading of the card a reveal mark is about, or null when the canvas draws no such card. */
const markHeading = (view: View, card: string): string | null => view.model?.cards.find((c) => c.id === card)?.heading ?? null

export function Figures({ at, figures }: { at: string; figures: Figure[] }): JSX.Element | null {
  if (figures.length === 0) return null
  return (
    <ul className="m-0 grid list-none gap-0.5 p-0" data-testid={`${at}-figures`}>
      {figures.map((f, i) => (
        <li key={i} className={META} title={f.title} data-testid={`${at}-figure-${i}`}>
          <span className="text-text-header">{f.label}</span>: {f.text}
        </li>
      ))}
    </ul>
  )
}

/**
 * D7 (R5; DL 4 Nov, finish line 3): what each figure on a revealed view does when the model's Run is run again with it, beside that view.
 * Only core's fields (`effects`, read through standin.ts), no sentence composed and no value formatted (DL: the View carries every label and
 * value): each status, and each row's label, as core gives it (`effect_headings`); the move as core words it (`gap_text`); the figure by the
 * view's own label for it, else its card's heading; the aim, the options and the conditions by their cards' headings, by id; a null leader
 * names nothing. A figure core did not run is listed under core's heading for that, its reason code not translated. Where core compared
 * only some options (`not_compared`), its `scope_text` is drawn verbatim beside the consequences, so a subset never reads as the whole.
 */
/** `alone` is accepted from older callers and changes nothing: no lane picture stands beside these rows any more (overnight 18 Nov: the
 *  Team tab draws each difference as a chart instead), so every row says all of it. */
export function Effects({ at, view, figures, effects, headings }: { at: string; view: View; by: string; figures: Figure[]; effects: readonly ViewEffect[]; headings: EffectHeadings | null; alone?: boolean }): JSX.Element | null {
  if (effects.length === 0 || headings === null) return null
  const card = (id: string | null) => (id === null ? null : view.model?.cards.find((c) => c.id === id)?.heading ?? null)
  const figure = (q: string) => figures.find((f) => f.quantity === q)?.label ?? card(q)
  const Option = ({ id }: { id: string | null }) => { const h = card(id); return h === null ? null : <span className="text-text-header" data-effect-option="">{h}</span> }
  // A row core labels: its label as core gives it, then the value; a core that gives no label for it draws no row (no words of the UI's own).
  const Labelled = ({ label, at, children }: { label: string | undefined; at: string; children: JSX.Element | string | null }) =>
    label === undefined || children === null ? null : <p {...{ [at]: '' }}><span>{label}</span>{': '}<span className="text-text-header">{children}</span></p>
  return (
    <ul className="m-0 grid list-none gap-1 p-0 pt-1.5" data-testid={`${at}-effects`}>
      {effects.map((e) => (
        <li key={e.quantity} className={META} data-effect={e.quantity}>
          <p>
            <span className="text-text-header" data-effect-figure="">{figure(e.quantity)}</span>
            {'refused' in e ? null : <><span aria-hidden="true"> · </span><span data-effect-aim="">{card(e.goal)}</span></>}
          </p>
          <p className="text-text-header" data-effect-status="">{'refused' in e ? headings.refused : headings[e.status]}</p>
          {'refused' in e ? null : (
            <>
              <Labelled label={headings.leader} at="data-effect-leader">{card(e.leader) === null ? null : <Option id={e.leader} />}</Labelled>
              {e.leader === null && e.status === 'changes' && headings.no_leader !== undefined ? <p data-effect-no-leader="">{headings.no_leader}</p> : null}
              <Labelled label={headings.model_leader} at="data-effect-model-leader">{card(e.model_leader) === null ? null : <Option id={e.model_leader} />}</Labelled>
              {e.model_leader === null && e.status === 'changes' && headings.no_model_leader !== undefined ? <p data-effect-no-model-leader="">{headings.no_model_leader}</p> : null}
              <Labelled label={headings.most} at="data-effect-most">{card(e.most) === null || (e.gap_text ?? null) === null ? null : <><Option id={e.most} /> <span data-effect-gap="">{e.gap_text}</span></>}</Labelled>
              <Labelled label={headings.if_absent} at="data-effect-if-absent">{e.if_absent.length === 0 ? null : e.if_absent.flatMap((id) => { const h = card(id); return h === null ? [] : [h] }).join(', ')}</Labelled>
              {/* A partial comparison (PL-243): core's words for what was and was not compared, beside the consequences, verbatim; nothing when absent. */}
              {(e.scope_text ?? '') === '' ? null : <p className="text-text-body" data-effect-scope="">{e.scope_text}</p>}
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Core's stance pill on a revealed view (olumi-core V11, `collab.shared[].stance`), drawn as given; none when absent, null or empty. */
const stanceOf = (v: unknown): string | null => { const s = (v as { stance?: unknown }).stance; return typeof s === 'string' && s !== '' ? s : null }

/** Both core projections keep the contribution id: a view's items (a card, a stance, a source), never another person's words. */
function ItemLines({ view, v }: { view: View; v: { id: number; text: string; items?: View['collab']['shared'][number]['items'] } }): JSX.Element | null {
  const lines = v.items?.map((l) => ({ ...l, about: { id: l.about, label: view.model?.cards.find((c) => c.id === l.about)?.heading } }))
    ?? view.strategy?.views.filter((l) => l.view === v.id) ?? []
  return lines.length === 0 ? null : <ul className="m-0 grid list-none gap-1.5 p-0" data-testid={`team-view-items-${v.id}`}>
    {lines.map((l) => <li key={l.about.id} data-item-about={l.about.id}>
      <p className={META}><span className="text-text-header">{l.about.label}</span> <span data-item-pill="" title={l.source ?? undefined}>{l.pill}</span></p>
      {l.text === v.text ? null : <p className={`${BODY} whitespace-pre-wrap break-words`} data-item-words="">{l.text}</p>}
    </li>)}
  </ul>
}

/**
 * YOUR VIEW (the flow's step 2; spec §8 step 1): given before you see anyone else's, private until revealed. Everything here is the View's
 * `collab`: the placeholder, your own views still private to you, whether one can be shown early (`can_share`). Words go to core exactly as
 * typed; a given view is never edited. The form opens on one box, the view in your own words; its figures, card, stance and doubted links
 * follow once you start writing, or behind "Add figures to your view".
 */
export function ViewEntry({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element {
  const c = view.collab
  const [text, setText, dropText] = useDraft(`${sid}:view`, '')
  // D7 from the screen (R5): a figure of the member's own for each card core offers a figure edit for, given with the view. Core takes
  // figures of the approved version only, so none are offered before one, or while a pending proposal is the model shown.
  const shownIsProposal = view.proposal !== null && view.model?.edit_base === null
  // D3: only the cards core lists for a view's figures (`collab.view_figure_cards`), in its order; none when core sends no list.
  const givable = view.version === null || shownIsProposal ? [] : viewFigureCardsOf(view)
  const [typed, setTyped] = useState<Record<string, string>>({})
  const figures = givable.flatMap((card) => ((typed[card.id] ?? '').trim() === '' ? [] : [{ quantity: card.id, typed: typed[card.id]! }]))
  // Core's own limit (`collab.max_view_figures`) and its words for it (`view_figures_limit_text`); a core that sends none sets no cap here.
  const maxFigures = typeof c.max_view_figures === 'number' ? c.max_view_figures : Infinity
  const atCap = figures.length >= maxFigures
  // The strategy lane's fields (a card, a stance, a source), part of this one form: drawn only once core's vocabulary answers.
  const vocab = useStrategyVocabulary(sid)
  const [pick, setPick] = useState<StrategyPick>(NO_PICK)
  const items = itemsOf(pick, vocab, text)
  const [more, setMore] = useState(false)
  const open = more || text.trim() !== '' || figures.length > 0 || pick !== NO_PICK
  const dropView = () => { dropText(); setTyped({}); setPick(NO_PICK); setMore(false) }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A view carries an op (core API v1.24): a lost answer resends the same op. A skip and a share are sent without one: one whose answer was
  // lost may have been saved, so it is not sent again (`writes.ts`).
  const viewLocked = useWriteLocked(`${sid}:view`)
  // A write still on its way (this step drawn again meanwhile) keeps its buttons held: it is never sent twice.
  const viewSending = useWriteSending(`${sid}:view`), revealSending = useWriteSending(`${sid}:reveal`)
  // A saved view's second save on its way (a retry included) holds the form too: the next view is never given under it (Codex reply 021 #1).
  const doubtsSending = useDoubtsSending(sid)
  const sending = viewSending || revealSending || doubtsSending
  const locks = useWrites((s) => s.locked)
  const shareLocked = (id: number) => locks[`${sid}:share:${id}`] === true

  // `request`: the write carries an op id (core keeps one for a view, API v1.24), so a lost answer resends the same op and core's answer to
  // it is the truth; without one, a lost answer locks the write (writes.ts).
  const run = async (key: string, write: (op: string | null) => Promise<unknown>, after?: () => void, request?: unknown) => {
    setBusy(true); setError(null)
    try { await runWrite(key, { op: request !== undefined }, request ?? null, write); after?.(); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : view.team_words.failed)
    } finally { setBusy(false) }
  }

  // Why "Add my view" waits (DL ruling 9 Nov: a disabled button says why, never dims).
  const giveWhy = busy || sending || viewLocked ? undefined : text.trim() === '' ? 'Write your view first' : needsStance(pick, vocab) ? 'Choose how you hold it first' : undefined
  const form = (
    <div className="grid gap-2" data-testid="team-view-form">
      <textarea
        aria-label={c.placeholder} placeholder={nonEmpty(view.model?.question?.text) ? view.model!.question.text : c.placeholder} data-testid="team-view-text" className={`${FIELD} min-h-[72px]`}
        value={text} disabled={busy || sending || viewLocked} onChange={(e) => { setText(e.target.value); if (error) setError(null) }}
      />
      {open || (givable.length === 0 && vocab === null) ? null : (
        <button type="button" data-testid="team-view-more" disabled={busy || sending || viewLocked} onClick={() => setMore(true)} className={`${QUIET} self-start`}>Add figures to your view</button>
      )}
      {!open || givable.length === 0 ? null : (
        <div className="grid gap-1" data-testid="team-view-figures">
          {givable.map((card) => {
            // A field already holding a figure stays editable; an empty one is held once the cap is reached, so one more cannot be given.
            const held = atCap && (typed[card.id] ?? '').trim() === ''
            return (
            <label key={card.id} className={`${META} grid gap-1`} title={card.prompt}>
              <span className="font-medium text-text-header">{card.label}</span>
              {/* D3: this card's own words for what to type (core's `figure.edit.prompt`), whole on a line of its own. */}
              <span className="text-text-body" data-testid={`team-view-figprompt-${card.id}`}>{card.prompt}</span>
              <input type="text" autoComplete="off" spellCheck={false} data-testid={`team-view-figure-${card.id}`} className={FIELD}
                value={typed[card.id] ?? ''} disabled={busy || sending || viewLocked || held} data-held={held ? '' : undefined}
                onChange={(e) => { const v = e.target.value; setTyped((t) => ({ ...t, [card.id]: v })); if (error) setError(null) }} />
            </label>
            )
          })}
          {atCap && nonEmpty(c.view_figures_limit_text) && <p className={META} data-testid="team-view-figures-cap">{c.view_figures_limit_text}</p>}
        </div>
      )}
      {!open || vocab === null ? null : <StrategyFields vocab={vocab} view={view} pick={pick} onPick={(p) => { setPick(p); if (error) setError(null) }} disabled={busy || sending || viewLocked} />}
      {open ? <ViewDoubts sid={sid} view={view} disabled={busy || sending || viewLocked} /> : null}
      {nonEmpty(c.private_view_prompt) && <p className={META} data-testid="team-view-private-prompt">{c.private_view_prompt}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={GO} data-testid="team-view-give" title={giveWhy} disabled={busy || sending || viewLocked || text.trim() === '' || figures.length > maxFigures || needsStance(pick, vocab)} onClick={() => void run(`${sid}:view`, (op) => teamApi.giveView(sid, text, figures, view.version?.n ?? null, { items, op }).then(async (r) => { await sendDoubts(sid, r.contribution, pick.stance || null); return r }), dropView, { text, figures, version: view.version?.n ?? null, items })}>
          <Lock strokeWidth={1.75} aria-hidden="true" className="h-3.5 w-3.5" />{view.team_words.views.give}
        </button>
        <button type="button" data-testid="team-view-skip" disabled={busy || sending || viewLocked} className={QUIET} onClick={() => void run(`${sid}:view`, () => teamApi.skipView(sid))}>{view.team_words.views.skip}</button>
      </div>
      {viewLocked ? <p role="alert" data-testid="team-views-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="team-views-error" className={ERR}>{error}</p>}
      <DoubtsFailure sid={sid} onWrote={onWrote} />
    </div>
  )

  return (
    <section data-testid="team-views" aria-label={c.heading} className="grid gap-3">
      {c.mine.length > 0 && (
        <ul className="m-0 grid list-none gap-3 p-0" data-testid="team-mine">
          {c.mine.map((v) => (
            <li key={v.id} data-testid={`team-mine-${v.id}`} className={CARD}>
              <p className={`${LABEL} flex items-center gap-1.5`}><Lock strokeWidth={1.75} aria-hidden="true" className="h-3.5 w-3.5 flex-none" />{view.team_words.views.private}</p>
              {v.skip ? <p className={META}>{view.team_words.views.mySkip}</p> : <p className={`${BODY} whitespace-pre-wrap break-words`}>{v.text}</p>}
              <ItemLines view={view} v={v} />
              <Figures at={`team-mine-${v.id}`} figures={v.figures} />
              {/* PL-783: core's `earlier` (written before this round began) in core's words, with the one act it leaves the author: put its words,
                  never its figures, into their own empty form below. A core that sends no `earlier` or no words for it draws neither. */}
              {v.earlier === true && view.team_words.views.earlier && view.team_words.views.reuse ? (
                <div className="grid gap-1" data-testid={`team-mine-earlier-${v.id}`}>
                  <p className={META}>{view.team_words.views.earlier}</p>
                  <div>
                    <Button size="sm" variant="secondary" data-testid={`team-reuse-${v.id}`} disabled={busy || sending || viewLocked || text.trim() !== ''}
                      onClick={() => { setText(v.text); if (error) setError(null) }}>{view.team_words.views.reuse}</Button>
                  </div>
                </div>
              ) : null}
              {/* `can_share` is core's rule whole (a second member, this round's view, not a skip): nothing here adds to it. */}
              {v.can_share && (
                <div>
                  <button type="button" className={QUIET} data-testid={`team-share-${v.id}`} disabled={busy || sending || shareLocked(v.id)}
                    title={view.team_words.views.shareTitle} onClick={() => void run(`${sid}:share:${v.id}`, () => teamApi.shareView(sid, v.id))}>
                    <Share2 strokeWidth={1.75} aria-hidden="true" className="h-3.5 w-3.5" />{view.team_words.views.share}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {form}
    </section>
  )
}

/**
 * EVERYONE'S VIEWS IN WORDS (the flow's step 4, folded): each revealed view as core gives it (who, their stance, their words, items, figures,
 * what each figure does to the Run), and the reveal's marks on the canvas. Core holds a member who has not given or skipped their own view
 * (`gated`): no one else's view, an early-shared one included, is drawn until they have; core withholds `shared` itself for them.
 */
export function RevealedViews({ view }: { view: View }): JSX.Element {
  const c = view.collab
  if (view.gated) return <p className={META} data-testid="team-revealed-held">{view.team_words.views.held}</p>
  return (
    <ul className="m-0 grid list-none gap-3 p-0" data-testid="team-revealed">
      {c.shared.map((v) => (
        <li key={v.id} data-testid={`team-revealed-${v.id}`} className={CARD}>
          <p className={`${BODY} flex flex-wrap items-center gap-1.5 text-text-header`}>
            <span aria-hidden="true" className={AVATAR}>{(Array.from(v.by)[0] ?? '').toUpperCase()}</span>{v.by}
            {stanceOf(v) !== null && <span className={`${META} rounded-full border border-panel-border px-2 py-0.5`} data-testid={`team-revealed-stance-${v.id}`}>{stanceOf(v)}</span>}
          </p>
          {v.skip ? <p className={META}>{view.team_words.views.theirSkip}</p> : <p className={`${BODY} whitespace-pre-wrap break-words`}>{v.text}</p>}
          <ItemLines view={view} v={v} />
          <Figures at={`team-revealed-${v.id}`} figures={v.figures} />
          <Effects at={`team-revealed-${v.id}`} view={view} by={v.by_id} figures={v.figures} effects={effectsOf(v)} headings={effectHeadingsOf(c)} />
        </li>
      ))}
    </ul>
  )
}

/** The reveal's marks on the canvas (core's `collab.marks`), each by its card's heading (one press to the card) with core's words for it:
 *  where several of you spoke to the same card (`shared`), where only one did (`unique`), where you differ (`disagreement`). */
export const markCounts = (view: View): { shared: number; all: number } => {
  const m = view.gated ? [] : view.collab.marks ?? []
  return { shared: m.filter((x) => x.kind === 'shared').length, all: m.length }
}
const KIND_ORDER = ['shared', 'disagreement', 'unique', 'evidence'] as const
export function RevealMarks({ view }: { view: View }): JSX.Element | null {
  const marks = view.gated ? [] : [...(view.collab.marks ?? [])].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
  if (marks.length === 0) return null
  return (
    <ul className="m-0 grid list-none gap-2 p-0" data-testid="team-marks">
      {marks.map((m) => <li key={`${m.card}:${m.kind}`} className="grid gap-0.5" data-testid={`team-mark-${m.card}-${m.kind}`} data-mark-views={m.views.join(',')} data-mark-kind={m.kind}>
        {/* DL round 5: the mark says which card it is about, by that card's heading (core's words), so "Only Sam raised it" is never an orphan. */}
        {markHeading(view, m.card) === null ? null : (
          <button type="button" className={`${BODY} inline-flex items-start gap-1.5 text-left font-medium text-text-header hover:underline`} data-testid={`team-mark-heading-${m.card}`} data-view={`${m.card}.heading`}
            title="Show it on the canvas" onClick={() => focusNodeById(m.card)}>
            <span className="min-w-0 break-words">{markHeading(view, m.card)}</span>
            <span className="mt-0.5 flex-none text-text-light"><OkIcon id="on-canvas" size={14} decorative /></span>
          </button>
        )}
        <p className={META}>{m.text}</p>
        {m.reading === null ? null : <div data-testid={`team-reading-${m.card}-${m.kind}`}>
          <p className={BODY}>{m.reading.text}</p><p className={META}>{m.reading.note}</p>
        </div>}
        {m.options.map((o) => <p key={o.option} className={BODY} data-mark-option={o.option}>{o.text}</p>)}
      </li>)}
    </ul>
  )
}
