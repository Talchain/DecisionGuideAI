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

type Figure = View['collab']['shared'][number]['figures'][number]

/** The figures a person gave with their view, each in core's words (its `text`, with core's `title` on hover), in core's order. */
function Figures({ at, figures }: { at: string; figures: Figure[] }): JSX.Element | null {
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
 * names nothing. A figure core did not run is listed under core's heading for that, its reason code not translated.
 */
export function Effects({ at, view, by: by_id, figures, effects, headings }: { at: string; view: View; by: string; figures: Figure[]; effects: readonly ViewEffect[]; headings: EffectHeadings | null }): JSX.Element | null {
  if (effects.length === 0 || headings === null) return null
  // A figure the "Where you differ" picture already places shows there its status (the mark and the legend), its most-likely option (its lane)
  // and the model's (once per aim): none of these is said again in its row.
  const placed = differPlaced(view)
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
export function ViewsPanel({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element {
  const c = view.collab
  const [text, setText, dropText] = useDraft(`${sid}:view`, '')
  // D7 from the screen (R5): a figure of the member's own for each card core offers a figure edit for, given with the view. Core takes
  // figures of the approved version only, so none are offered before one, or while a pending proposal is the model shown.
  const shownIsProposal = view.proposal !== null && view.model?.edit_base === null
  const givable = view.version === null || shownIsProposal ? [] : (view.model?.cards ?? []).filter((card) => card.figure?.edit)
  const [typed, setTyped] = useState<Record<string, string>>({})
  const figures = givable.flatMap((card) => ((typed[card.id] ?? '').trim() === '' ? [] : [{ quantity: card.id, typed: typed[card.id]! }]))
  // Core's own limit (`collab.max_view_figures`) and its words for it (`view_figures_limit_text`); a core that sends none sets no cap here.
  const maxFigures = typeof c.max_view_figures === 'number' ? c.max_view_figures : Infinity
  const atCap = figures.length >= maxFigures
  const dropView = () => { dropText(); setTyped({}) }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A view and a reveal have no operation id in core: one whose answer was lost may have been saved, so it is not sent again (`writes.ts`).
  const viewLocked = useWriteLocked(`${sid}:view`)
  // A write still on its way (this panel drawn again meanwhile) keeps its buttons held: it is never sent twice.
  const viewSending = useWriteSending(`${sid}:view`), revealSending = useWriteSending(`${sid}:reveal`)
  const sending = viewSending || revealSending
  // A share has no operation id either: one whose answer was lost is not sent again.
  const locks = useWrites((s) => s.locked)
  const shareLocked = (id: number) => locks[`${sid}:share:${id}`] === true

  const run = async (key: string, write: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setError(null)
    try { await runWrite(key, { op: false }, null, write); after?.(); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }

  return (
    <section data-testid="team-views" aria-label={c.heading} className="grid gap-2">
      <h3 className={H} data-testid="team-views-heading">{c.heading}</h3>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" data-testid="team-members">
        {view.members.map((m) => (
          <li key={m.id} data-testid={`team-member-${m.id}`} className={`${META} inline-flex items-center gap-1.5`}>
            <span aria-hidden="true" className={AVATAR}>{m.name.slice(0, 1).toUpperCase()}</span>
            {m.name}{m.id === view.you_id ? ' (you)' : ''}
          </li>
        ))}
      </ul>

      {/* Core holds a member who has not given or skipped their own view (`gated`): no one else's view, an early-shared one included, is
          drawn until they have, so none can anchor them (DL R2, cut check a). Core's rule; nothing worked out here. From R3 core withholds
          the shared views itself (`shared` is empty for a gated viewer, core 550ad5f), so the line is drawn on `gated` alone (DL ruling a),
          in words true whether or not anyone has shared yet (the DL's final text, 4 Nov). */}
      {view.gated && <p className={META} data-testid="team-revealed-held">Give or skip your own view first: the others’ views show here once you have.</p>}
      {!view.gated && c.shared.length > 0 && (
        <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-revealed">
          {c.shared.map((v) => (
            <li key={v.id} data-testid={`team-revealed-${v.id}`} className={CARD}>
              <p className={`${BODY} text-text-header`}>{v.by}</p>
              {v.skip ? <p className={META}>Chose not to answer.</p> : <p className={`${BODY} whitespace-pre-wrap break-words`}>{v.text}</p>}
              <Figures at={`team-revealed-${v.id}`} figures={v.figures} />
              <Effects at={`team-revealed-${v.id}`} view={view} by={v.by_id} figures={v.figures} effects={effectsOf(v)} headings={effectHeadingsOf(c)} />
            </li>
          ))}
        </ul>
      )}

      {!view.gated && <WhereYouDiffer view={view} />}

      {c.mine.length > 0 && (
        <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-mine">
          {c.mine.map((v) => (
            <li key={v.id} data-testid={`team-mine-${v.id}`} className={CARD}>
              <p className={`${META} flex items-center gap-1.5 text-text-header`}><Lock aria-hidden="true" className="h-3 w-3 flex-none" />Private to you until everyone’s views are revealed</p>
              {v.skip ? <p className={META}>You chose not to answer.</p> : <p className={`${BODY} whitespace-pre-wrap break-words`}>{v.text}</p>}
              <Figures at={`team-mine-${v.id}`} figures={v.figures} />
              {/* `can_share` is core's rule whole (a second member, this round's view, not a skip): nothing here adds to it. */}
              {v.can_share && (
                <div>
                  <Button size="sm" variant="secondary" data-testid={`team-share-${v.id}`} disabled={busy || sending || shareLocked(v.id)}
                    title="Shows this view to the team now, before the others are revealed. Olumi does not read it until then."
                    onClick={() => void run(`${sid}:share:${v.id}`, () => teamApi.shareView(sid, v.id))}>
                    <span className="inline-flex items-center gap-1.5"><Share2 aria-hidden="true" className="h-3.5 w-3.5" />Share with the team now</span>
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
        {givable.length === 0 ? null : (
          <div className="grid gap-1" data-testid="team-view-figures">
            {givable.map((card) => {
              // A field already holding a figure stays editable; an empty one is held once three are entered, so a fourth cannot be given.
              const held = atCap && (typed[card.id] ?? '').trim() === ''
              return (
              <label key={card.id} className={`${META} grid gap-0.5`} title={card.figure!.edit!.prompt}>
                <span className="text-text-header">{card.heading}</span>
                <input type="text" autoComplete="off" spellCheck={false} data-testid={`team-view-figure-${card.id}`} className={FIELD}
                  // Core's own neutral words for the entry (what to type, never a figure): Olumi's figure is not shown before the member's.
                  placeholder={card.figure!.edit!.prompt}
                  value={typed[card.id] ?? ''} disabled={busy || sending || viewLocked || held} data-held={held ? '' : undefined}
                  onChange={(e) => { const v = e.target.value; setTyped((t) => ({ ...t, [card.id]: v })); if (error) setError(null) }} />
              </label>
              )
            })}
            {atCap && nonEmpty(c.view_figures_limit_text) && <p className={META} data-testid="team-view-figures-cap">{c.view_figures_limit_text}</p>}
          </div>
        )}
        {nonEmpty(c.private_view_prompt) && <p className={META} data-testid="team-view-private-prompt">{c.private_view_prompt}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" data-testid="team-view-give" disabled={busy || sending || viewLocked || text.trim() === '' || figures.length > maxFigures} onClick={() => void run(`${sid}:view`, () => teamApi.giveView(sid, text, figures, view.version?.n ?? null), dropView)}>Add my view</Button>
          <button
            type="button" data-testid="team-view-skip" disabled={busy || sending || viewLocked}
            className={`${META} cursor-pointer underline underline-offset-2 hover:text-text-body disabled:opacity-50`}
            onClick={() => void run(`${sid}:view`, () => teamApi.skipView(sid))}
          >I would rather not answer this</button>
        </div>
        {viewLocked ? <p role="alert" data-testid="team-views-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="team-views-error" className={ERR}>{error}</p>}
      </div>
    </section>
  )
}
