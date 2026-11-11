import { useState } from 'react'
import { Lock, Share2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { effectHeadingsOf, effectsOf, type EffectHeadings, type ViewEffect } from '../../olumiView/standin'
import { teamApi, TeamApiError } from './api'
import { useDraft } from './drafts'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWrites, useWriteSending } from './writes'
import { differPlaced, WhereYouDiffer } from './WhereYouDiffer'
import { nonEmpty } from '../../olumiView/tipping'
import { AVATAR, BODY, CARD, ERR, FIELD, H, META } from './ui'
import { sendDoubts, ViewDoubts } from './ViewDoubts'
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
export function Effects({ at, view, by: by_id, figures, effects, headings, alone = false }: { at: string; view: View; by: string; figures: Figure[]; effects: readonly ViewEffect[]; headings: EffectHeadings | null; alone?: boolean }): JSX.Element | null {
  if (effects.length === 0 || headings === null) return null
  // A figure the "Where you differ" picture already places shows there its status (the mark and the legend), its most-likely option (its lane)
  // and the model's (once per aim): none of these is said again in its row. `alone`: drawn where no such picture is beside it (the
  // Reasoning tab's people strip), so every row says all of it.
  const placed = alone ? null : differPlaced(view)
  const inLane = (q: string) => placed?.has(`${by_id}:${q}`) === true
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
          {'refused' in e || !inLane(e.quantity) ? <p className="text-text-header" data-effect-status="">{'refused' in e ? headings.refused : headings[e.status]}</p> : null}
          {'refused' in e ? null : (
            <>
              <Labelled label={headings.leader} at="data-effect-leader">{inLane(e.quantity) || card(e.leader) === null ? null : <Option id={e.leader} />}</Labelled>
              {!inLane(e.quantity) && e.leader === null && e.status === 'changes' && headings.no_leader !== undefined ? <p data-effect-no-leader="">{headings.no_leader}</p> : null}
              <Labelled label={headings.model_leader} at="data-effect-model-leader">{inLane(e.quantity) || card(e.model_leader) === null ? null : <Option id={e.model_leader} />}</Labelled>
              {!inLane(e.quantity) && e.model_leader === null && e.status === 'changes' && headings.no_model_leader !== undefined ? <p data-effect-no-model-leader="">{headings.no_model_leader}</p> : null}
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

/**
 * Each person's own view, given before they see anyone else's, then revealed together (spec §8 steps 1 and 2). Everything here is the
 * View's `collab`: the heading, the placeholder, your own views still private to you, the team's revealed views, whether the reveal is
 * open (`can_reveal`) and whom it waits for. Words go to core exactly as typed; a given view is never edited.
 */
/** Core's stance pill on a revealed view (olumi-core V11, `collab.shared[].stance`), drawn as given; none when absent, null or empty. */
const stanceOf = (v: unknown): string | null => { const s = (v as { stance?: unknown }).stance; return typeof s === 'string' && s !== '' ? s : null }

export function ViewsPanel({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element {
  const c = view.collab
  const [text, setText, dropText] = useDraft(`${sid}:view`, '')
  // D7 from the screen (R5): a figure of the member's own for each card core offers a figure edit for, given with the view. Core takes
  // figures of the approved version only, so none are offered before one, or while a pending proposal is the model shown.
  const shownIsProposal = view.proposal !== null && view.model?.edit_base === null
  // D3: only the cards core lists for a view's figures (`collab.view_figure_cards`), in its order; none when core sends no list.
  const givable = view.version === null || shownIsProposal ? [] : viewFigureCardsOf(view).map((x) => x.card)
  const [typed, setTyped] = useState<Record<string, string>>({})
  const figures = givable.flatMap((card) => ((typed[card.id] ?? '').trim() === '' ? [] : [{ quantity: card.id, typed: typed[card.id]! }]))
  // Core's own limit (`collab.max_view_figures`) and its words for it (`view_figures_limit_text`); a core that sends none sets no cap here.
  const maxFigures = typeof c.max_view_figures === 'number' ? c.max_view_figures : Infinity
  const atCap = figures.length >= maxFigures
  // The strategy lane's fields (a card, a stance, a source), part of this one form: drawn only once core's vocabulary answers.
  const vocab = useStrategyVocabulary(sid)
  const [pick, setPick] = useState<StrategyPick>(NO_PICK)
  const items = itemsOf(pick, vocab, text)
  // V11 pixel pass, DL ruling 9 Nov: the form opens on one box, the view in their own words. Its figures, card, stance and doubted links
  // follow once they start writing, or behind "Add figures to your view" (it opened on nine fields before one act). Anything already
  // entered keeps them shown.
  const [more, setMore] = useState(false)
  const open = more || text.trim() !== '' || figures.length > 0 || pick !== NO_PICK
  const dropView = () => { dropText(); setTyped({}); setPick(NO_PICK); setMore(false) }
  // Both core projections keep the contribution id: draw its items, never another person's words.
  const itemLines = (v: { id: number; text: string; items?: View['collab']['shared'][number]['items'] }) => {
    const lines = v.items?.map((l) => ({ ...l, about: { id: l.about, label: view.model?.cards.find((c) => c.id === l.about)?.heading } }))
      ?? view.strategy?.views.filter((l) => l.view === v.id) ?? []
    return lines.length === 0 ? null : <ul className="m-0 grid list-none gap-1.5 p-0" data-testid={`team-view-items-${v.id}`}>
      {lines.map((l) => <li key={l.about.id} data-item-about={l.about.id}>
        <p className={META}><span className="text-text-header">{l.about.label}</span> <span data-item-pill="" title={l.source ?? undefined}>{l.pill}</span></p>
        {l.text === v.text ? null : <p className={`${BODY} whitespace-pre-wrap break-words`} data-item-words="">{l.text}</p>}
      </li>)}
    </ul>
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A view carries an op (core API v1.24): a lost answer resends the same op. A skip and a reveal are sent without one: one whose answer was
  // lost may have been saved, so it is not sent again (`writes.ts`).
  const viewLocked = useWriteLocked(`${sid}:view`)
  // A write still on its way (this panel drawn again meanwhile) keeps its buttons held: it is never sent twice.
  const viewSending = useWriteSending(`${sid}:view`), revealSending = useWriteSending(`${sid}:reveal`)
  const sending = viewSending || revealSending
  // A share has no operation id either: one whose answer was lost is not sent again.
  const locks = useWrites((s) => s.locked)
  const shareLocked = (id: number) => locks[`${sid}:share:${id}`] === true

  // `request`: the write carries an op id (core keeps one for a view, API v1.24: API.md:1044-1050; src/server/app.ts:229), so a lost answer
  // resends the same op and core's answer to it is the truth; without one, a lost answer locks the write (writes.ts).
  const run = async (key: string, write: (op: string | null) => Promise<unknown>, after?: () => void, request?: unknown) => {
    setBusy(true); setError(null)
    try { await runWrite(key, { op: request !== undefined }, request ?? null, write); after?.(); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : view.team_words.failed)
    } finally { setBusy(false) }
  }

  return (
    <section data-testid="team-views" aria-label={c.heading} className="grid gap-2">
      <h3 className={H} data-testid="team-views-heading">{c.heading}</h3>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" data-testid="team-members">
        {/* Each member's own line in core's words (N3 `team_presence.members`, "(you)" on the viewer), by id. */}
        {view.team_presence.members.map((m) => (
          <li key={m.id} data-testid={`team-member-${m.id}`} className={`${META} inline-flex items-center gap-1.5`}>
            <span aria-hidden="true" className={AVATAR}>{(Array.from(m.text)[0] ?? '').toUpperCase()}</span>
            {m.text}
          </li>
        ))}
      </ul>

      {/* Core holds a member who has not given or skipped their own view (`gated`): no one else's view, an early-shared one included, is
          drawn until they have, so none can anchor them (DL R2, cut check a). Core's rule; nothing worked out here. From R3 core withholds
          the shared views itself (`shared` is empty for a gated viewer, core 550ad5f), so the line is drawn on `gated` alone (DL ruling a),
          in words true whether or not anyone has shared yet (the DL's final text, 4 Nov). */}
      {view.gated && <p className={META} data-testid="team-revealed-held">{view.team_words.views.held}</p>}
      {!view.gated && c.shared.length > 0 && (
        <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-revealed">
          {c.shared.map((v) => (
            <li key={v.id} data-testid={`team-revealed-${v.id}`} className={CARD}>
              <p className={`${BODY} text-text-header`}>{v.by}{stanceOf(v) !== null && (
                <span className={`${META} ml-2 rounded-full border border-panel-border px-2 py-0.5`} data-testid={`team-revealed-stance-${v.id}`}>{stanceOf(v)}</span>
              )}</p>
              {v.skip ? <p className={META}>{view.team_words.views.theirSkip}</p> : <p className={`${BODY} whitespace-pre-wrap break-words`}>{v.text}</p>}
              {itemLines(v)}
              <Figures at={`team-revealed-${v.id}`} figures={v.figures} />
              <Effects at={`team-revealed-${v.id}`} view={view} by={v.by_id} figures={v.figures} effects={effectsOf(v)} headings={effectHeadingsOf(c)} />
            </li>
          ))}
        </ul>
      )}

      {!view.gated && <>
        {(c.marks ?? []).map((m) => <div key={`${m.card}:${m.kind}`} className={CARD} data-testid={`team-mark-${m.card}-${m.kind}`} data-mark-views={m.views.join(',')}>
          {/* DL round 5 (rehearsal 6f/6g): the card says which figure it is about, by that card's heading (core's words), so "Only Sam raised
              it" is never an orphan; a card the canvas does not draw has no heading here, and the mark's words stand alone as before. */}
          {markHeading(view, m.card) === null ? null : <p className={META} data-testid={`team-mark-heading-${m.card}`} data-view={`${m.card}.heading`}>{markHeading(view, m.card)}</p>}
          <p className={`${BODY} text-text-header`}>{m.text}</p>
          {m.reading === null ? null : <div data-testid={`team-reading-${m.card}-${m.kind}`}>
            <p className={BODY}>{m.reading.text}</p><p className={META}>{m.reading.note}</p>
          </div>}
          {m.options.map((o) => <p key={o.option} className={BODY} data-mark-option={o.option}>{o.text}</p>)}
        </div>)}
        {c.next == null ? null : <p className={BODY} data-testid="team-views-next">{c.next.text}</p>}
      </>}

      {!view.gated && <WhereYouDiffer view={view} />}

      {c.mine.length > 0 && (
        <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-mine">
          {c.mine.map((v) => (
            <li key={v.id} data-testid={`team-mine-${v.id}`} className={CARD}>
              <p className={`${META} flex items-center gap-1.5 text-text-header`}><Lock aria-hidden="true" className="h-3 w-3 flex-none" />{view.team_words.views.private}</p>
              {v.skip ? <p className={META}>{view.team_words.views.mySkip}</p> : <p className={`${BODY} whitespace-pre-wrap break-words`}>{v.text}</p>}
              {itemLines(v)}
              <Figures at={`team-mine-${v.id}`} figures={v.figures} />
              {/* `can_share` is core's rule whole (a second member, this round's view, not a skip): nothing here adds to it. */}
              {v.can_share && (
                <div>
                  <Button size="sm" variant="secondary" data-testid={`team-share-${v.id}`} disabled={busy || sending || shareLocked(v.id)}
                    title={view.team_words.views.shareTitle}
                    onClick={() => void run(`${sid}:share:${v.id}`, () => teamApi.shareView(sid, v.id))}>
                    <span className="inline-flex items-center gap-1.5"><Share2 aria-hidden="true" className="h-3.5 w-3.5" />{view.team_words.views.share}</span>
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={CARD}>
        <textarea
          aria-label={c.placeholder} placeholder={c.placeholder} data-testid="team-view-text" className={`${FIELD} min-h-[72px]`}
          value={text} disabled={busy || sending || viewLocked} onChange={(e) => { setText(e.target.value); if (error) setError(null) }}
        />
        {open || (givable.length === 0 && vocab === null) ? null : (
          <button type="button" data-testid="team-view-more" disabled={busy || sending || viewLocked} onClick={() => setMore(true)}
            className={`${META} inline-flex min-h-[24px] cursor-pointer items-center self-start underline underline-offset-2 hover:text-text-body disabled:cursor-not-allowed disabled:text-text-light`}
          >Add figures to your view</button>
        )}
        {!open || givable.length === 0 ? null : (
          <div className="grid gap-1" data-testid="team-view-figures">
            {givable.map((card) => {
              // A field already holding a figure stays editable; an empty one is held once three are entered, so a fourth cannot be given.
              const held = atCap && (typed[card.id] ?? '').trim() === ''
              return (
              <label key={card.id} className={`${META} grid gap-0.5`} title={card.figure!.edit!.prompt}>
                <span className="text-text-header">{card.heading}</span>
                {/* D3: this card's own words for what to type (core's `figure.edit.prompt`: its unit and a range in its own scale), whole on
                    a line of its own: as a placeholder in the 300 px dock they were cut mid-word (V11 pixel pass, 9 Nov). */}
                <span className="text-text-body" data-testid={`team-view-figprompt-${card.id}`}>{card.figure!.edit!.prompt}</span>
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
          <Button size="sm" data-testid="team-view-give" disabled={busy || sending || viewLocked || text.trim() === '' || figures.length > maxFigures || needsStance(pick, vocab)} onClick={() => void run(`${sid}:view`, (op) => teamApi.giveView(sid, text, figures, view.version?.n ?? null, { items, op }).then(async (r) => { await sendDoubts(sid, r.contribution, pick.stance || null); return r }), dropView, { text, figures, version: view.version?.n ?? null, items })}>{view.team_words.views.give}</Button>
          {/* Why "Add my view" waits (DL ruling 9 Nov: a disabled button says why, never dims). */}
          {busy || sending || viewLocked ? null : text.trim() === '' ? <span className={META} data-testid="team-view-give-why">Write your view first</span>
            : needsStance(pick, vocab) ? <span className={META} data-testid="team-view-give-why">Choose how you hold it first</span> : null}
          <button
            type="button" data-testid="team-view-skip" disabled={busy || sending || viewLocked}
            className={`${META} inline-flex min-h-[24px] cursor-pointer items-center underline underline-offset-2 hover:text-text-body disabled:text-text-light disabled:cursor-not-allowed`}
            onClick={() => void run(`${sid}:view`, () => teamApi.skipView(sid))}
          >{view.team_words.views.skip}</button>
        </div>
        {viewLocked ? <p role="alert" data-testid="team-views-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="team-views-error" className={ERR}>{error}</p>}
      </div>
    </section>
  )
}
