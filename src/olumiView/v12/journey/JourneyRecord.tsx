/**
 * Catch up on a scenario (`journey.ts` says what each part is and which field feeds it), at the top of the history panel the top bar's clock
 * opens, above core's version list. Loaded only when that panel opens (WhatChangedPanel's lazy import), so its imports never enter the
 * page's first load order (an early static import once put olumiView/layout's CARD_WIDTH in the TDZ, 18 Nov picture run 1).
 *
 * Every row is one control on the whole row (its label and the person's or core's words inside it), opening the exact record: a card in
 * front, that piece of evidence, that commitment, outcome form or disagreement in Team, the views, the chat's Next step. A row that cannot
 * open now is drawn plain with its reason, never as a button that does nothing. Olumi's marks are blue; the page's own chrome is neutral.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { typography } from '../../../styles/typography'
import { useUIStore } from '../../../stores/uiStore'
import { useCanvasStore } from '../../../canvas/store'
import { focusNodeById } from '../../../canvas/utils/focusHelpers'
import { goToOutcome } from '../../../olumiCore/team/outcomeNav'
import { openStep, type StepId } from '../../../olumiCore/team/flow'
import { useViewStore } from '../../store'
import { useReveal } from '../../reveal'
import { forgetLanded } from '../../revealReturn'
import { nextStepOf, useViewChat } from '../../ViewChat'
import { keptIdeasOf } from '../ideas'
import { IDEA_PREFIX } from '../bands/bands'
import type { View } from '../../types'
import { isEmpty, journeyOf, JOURNEY_WORDS as W, type JourneyPress, type JourneyRef, type Moved, type Changed } from './journey'

const BODY = `${typography.viewPanelBody} text-text-body m-0`
const META = `${typography.viewPanelMeta} text-text-light m-0`
const HEAD = `${typography.viewPanelHeading} text-text-header m-0`
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header'
const ROW = `block w-full min-w-0 rounded-sm text-left hover:bg-panel-hover ${FOCUS}`
const WORDS = 'whitespace-pre-wrap break-words'

/** When a record happened, as the version history writes a time (`olumiCore/versions.tsx` `when`). */
export const journeyWhen = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const onCanvas = (id: string): boolean => useCanvasStore.getState().nodes.some((n) => n.id === id)
/** The Team tab with no reveal or evidence view filling it, as `goToOutcome` clears it (olumiCore/team/outcomeNav.ts). */
const teamClear = (): void => { forgetLanded(); useReveal.getState().select(null); useUIStore.getState().forceActivateOutputTab('team') }
/**
 * Bring a Team record into view: open the Team step that holds it (`openStep`, core flow.ts, as the commitment and outcome forms are opened
 * from outside the tab), then, once drawn (two frames, as `goToOutcome` waits), any closed fold around it (a native <details>, e.g. "Where you
 * differ"'s disagreements), and scroll to it. Picture run 19 Nov: without the step, the record sat in a closed step and nothing showed.
 */
const into = (step: StepId | null, testid: string | null): void => {
  if (step !== null) openStep(step)
  teamClear()
  if (testid === null) return
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)
    if (el === null) return
    for (let d = el.closest('details'); d !== null; d = d.parentElement?.closest('details') ?? null) d.open = true
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }))
}

/**
 * Open what a row names. Null when it opened; otherwise why not (said under the row). The exact record each time: a commitment, an
 * outcome or a disagreement is scrolled into view in Team, not left to be searched for.
 */
export function go(to: JourneyRef): string | null {
  switch (to.kind) {
    case 'card': case 'kept': {
      const id = to.kind === 'card' ? to.id : to.node
      if (!onCanvas(id)) return W.offCanvas
      focusNodeById(id)
      return null
    }
    case 'evidence':
      forgetLanded(); useReveal.getState().selectEvidence(to.id); useUIStore.getState().forceActivateOutputTab('team')
      return null
    case 'outcome-form': {
      const sid = useViewStore.getState().sid
      if (sid === null) return W.earlier
      goToOutcome(sid, to.commitment)
      return null
    }
    case 'commitment': into('outcome', `team-commitment-${to.id}`); return null
    case 'outcome': into('outcome', `team-outcome-${to.id}`); return null
    case 'dissent': into('differ', `team-dissent-${to.id}`); return null
    case 'views': into(to.step, null); return null
    case 'chat':
      useUIStore.getState().forceActivateOutputTab('olumi')
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector('[data-testid="view-next-step"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })))
      return null
  }
}

/** One row: the whole row is the control when it can open; plain, with its reason, when it cannot; plain alone for a record with no card. */
function Press({ id, press, onDone, children }: { id: string; press: JourneyPress; onDone?: () => void; children: ReactNode }): JSX.Element {
  const [refused, setRefused] = useState<string | null>(null)
  // A record the model holds with no card to open: drawn as it is, no control and no reason.
  if ('plain' in press) return <div className="min-w-0" data-testid={`journey-${id}`} data-plain="true">{children}</div>
  if ('unavailable' in press) {
    return (
      <div className="min-w-0" data-testid={`journey-${id}`} data-unavailable="true">
        {children}
        <p className={META} data-testid={`journey-${id}-why`}>{press.unavailable}</p>
      </div>
    )
  }
  return (
    <div className="min-w-0">
      <button type="button" className={ROW} data-testid={`journey-${id}`} onClick={() => { const why = go(press.to); setRefused(why); if (why === null) onDone?.() }}>
        {children}
      </button>
      {refused !== null && <p role="status" className={META} data-testid={`journey-${id}-why`}>{refused}</p>}
    </div>
  )
}

/** Core's two chances on one 0–100% track: the earlier one hollow, the newer one filled. Numbers place the marks only (SVG attributes,
 *  no inline style); core's words say them. */
function Track({ m }: { m: Moved }): JSX.Element {
  const at = (x: number) => Math.min(100, Math.max(0, x * 100))
  const a = at(m.from), b = at(m.to)
  return (
    <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="mt-1 block h-1.5 w-full" aria-hidden="true" data-testid={`journey-track-${m.key}`}>
      <rect x="0" y="2" width="100" height="2" className="fill-panel-border" />
      <rect x={Math.min(a, b)} y="2" width={Math.max(0.5, Math.abs(b - a))} height="2" className="fill-text-light" />
      <rect x={Math.max(0, a - 0.75)} y="0" width="1.5" height="6" className="fill-text-light" data-mark="from" />
      <rect x={Math.max(0, b - 0.75)} y="0" width="1.5" height="6" className="fill-text-header" data-mark="to" />
    </svg>
  )
}

function MovedRow({ m }: { m: Moved }): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <li className="min-w-0" data-testid={`journey-${m.key}`}>
      <button type="button" className={ROW} aria-expanded={open} onClick={() => setOpen((x) => !x)} data-testid={`journey-${m.key}-toggle`}>
        <p className={`${BODY} ${WORDS}`}><span className="text-text-header">{m.option}</span> · {m.aim}</p>
        <p className={`${META} ${WORDS}`}>{`${m.fromText} → ${m.toText}`}</p>
        <Track m={m} />
      </button>
      {open && <p className={`${META} ${WORDS} pt-1`} data-testid={`journey-${m.key}-line`}>{m.line}</p>}
    </li>
  )
}

function Chip({ c, onDone }: { c: Changed; onDone?: () => void }): JSX.Element {
  const tone = c.olumi ? 'border-info/40 text-info' : 'border-panel-border text-text-body'
  const was = c.was === 'olumi' ? W.wasOlumi : c.was === 'theirs' ? W.wasTheirs : null
  const body = <span className={`${typography.viewPanelMeta} inline-block max-w-full break-words rounded-full border px-2 ${tone}`} data-olumi={c.olumi ? 'true' : undefined}>{c.label}{was === null ? null : <span className="text-text-light"> ({was})</span>}</span>
  return <li className="min-w-0 max-w-full"><Press id={`card-${c.id}`} press={c.press} onDone={onDone}>{body}</Press></li>
}

/** The changed cards: four at rest, the rest behind one press. */
function ChangedChips({ n, cards, onDone }: { n: number; cards: readonly Changed[]; onDone?: () => void }): JSX.Element {
  const [all, setAll] = useState(false)
  const shown = all ? cards : cards.slice(0, 4)
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="journey-changed">
      <p className={META}>{W.changed} · version {n}</p>
      <ul className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
        {shown.map((c) => <Chip key={c.id} c={c} onDone={onDone} />)}
        {cards.length > 4 && <li><button type="button" className={`${META} underline underline-offset-2 hover:text-text-header ${FOCUS}`} onClick={() => setAll((x) => !x)} data-testid="journey-changed-more">{all ? W.fewer : W.more(cards.length - 4)}</button></li>}
      </ul>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }): JSX.Element {
  return <section className="flex min-w-0 flex-col gap-2" data-testid={`journey-${id}`} aria-label={title}><p className={HEAD}>{title}</p>{children}</section>
}

export function JourneyRecord({ view, at, onDone }: { view: View; at: number | null; onDone?: () => void }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const gone = useViewChat((s) => s.gone ?? null)
  const j = useMemo(() => {
    const ideas = keptIdeasOf(view)
    const keptNode = (k: { id: number; turn: number; text: string }) => {
      const idea = ideas.find((i) => i.id === `kept:${k.id}`) ?? ideas.find((i) => i.sourceTurn === String(k.turn) && i.text === k.text)
      return idea === undefined ? null : IDEA_PREFIX + idea.id
    }
    // The chat's own exclusion (ViewChat's NextStep and stepTurnOf): a move the chat refused as stale is no next step here either, so the
    // press never opens a chat with no Next step in it. The key is ViewChat's `moveKey` (sid, turn, move joined by NUL).
    const isGone = (turn: number, move: string) => sid !== null && gone === `${sid}\u0000${turn}\u0000${move}`
    // The approve step is the proposal row already listed (both go to the chat's proposal), so it is not offered twice.
    const step = nextStepOf(view, isGone)
    return journeyOf(view, { at, keptNode, hasNext: step !== null && step.kind !== 'approve' })
  }, [view, at, sid, gone])
  const [history, setHistory] = useState(false)
  if (isEmpty(j)) return null
  const h = j.history
  const hasHistory = h.evidence.length + h.dissent.length + h.kept.length > 0 || h.views !== null
  return (
    <div className="flex min-w-0 flex-col gap-4 pb-4" data-testid="journey-record">
      {j.moved !== null && (
        <Section id="moved" title={W.moved}>
          <p className={META}>{j.moved.heading} · {j.moved.from} → {j.moved.to}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">{j.moved.rows.map((m) => <MovedRow key={m.key} m={m} />)}</ul>
          {j.moved.sole !== null && (
            <div className="flex flex-wrap items-center gap-1" data-testid="journey-sole"><span className={META}>{W.credited}</span><ul className="m-0 flex list-none p-0"><Chip c={j.moved.sole} onDone={onDone} /></ul></div>
          )}
        </Section>
      )}
      {j.changed !== null && <ChangedChips n={j.changed.n} cards={j.changed.cards} onDone={onDone} />}
      {(j.open.length > 0 || j.next !== null) && (
        <Section id="open" title={W.open}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {j.open.map((o) => (
              <li key={o.key} className="min-w-0">
                <Press id={o.key} press={o.press} onDone={onDone}>
                  <p className={`${BODY} ${WORDS}`} title={o.title}>{o.label}</p>
                  {o.words !== null && o.words !== '' && <p className={`${META} ${WORDS}`}>{o.words}</p>}
                </Press>
              </li>
            ))}
            {j.next !== null && <li className="min-w-0"><Press id="next" press={j.next} onDone={onDone}><p className={BODY}>{W.next}</p></Press></li>}
          </ul>
        </Section>
      )}
      {j.commitments.length > 0 && (
        <Section id="commitments" title={W.commitments}>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {j.commitments.map((k) => (
              <li key={k.key} className="min-w-0 border-l border-panel-border pl-3">
                <Press id={k.key} press={k.press} onDone={onDone}>
                  <p className={`${BODY} ${WORDS} text-text-header`}>{k.action}</p>
                  <p className={META}>{W.owner(k.owner)}{k.reviewOn === null ? null : ` · ${W.reviewOn(k.reviewOn)}`}</p>
                  {k.expect !== '' && <p className={`${META} ${WORDS}`} data-testid={`journey-${k.key}-expect`}>{W.expected}: {k.expect}</p>}
                  {k.band !== null && <p className={`${META} ${WORDS}`} data-testid={`journey-${k.key}-band`}>{W.band}: {k.band}</p>}
                  {k.reconsider !== '' && <p className={`${META} ${WORDS}`}>{W.reconsider}: {k.reconsider}</p>}
                </Press>
                {k.outcomes.map((o) => (
                  <div key={o.key} className="mt-1"><Press id={o.key} press={o.press} onDone={onDone}>
                    <p className={BODY}>{W.happened(o.by)} <span className="text-text-light">· {journeyWhen(o.at)}</span></p>
                    <p className={`${META} ${WORDS}`}>{o.happened}{o.figure === null ? null : ` · ${o.figure}`}</p>
                    {o.versus !== null && <p className={`${META} ${WORDS}`} data-testid={`journey-${o.key}-versus`}>{o.versus}</p>}
                    {o.triggered && <p className={META}>{W.triggered}</p>}
                  </Press></div>
                ))}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {hasHistory && (
        <div className="flex min-w-0 flex-col gap-3">
          <button type="button" className={`${META} self-start underline underline-offset-2 hover:text-text-header ${FOCUS}`} aria-expanded={history} onClick={() => setHistory((x) => !x)} data-testid="journey-history-toggle">
            {history ? W.hideHistory : W.history}
          </button>
          {history && (
            <div className="flex min-w-0 flex-col gap-3" data-testid="journey-history">
              {h.evidence.length > 0 && <Section id="h-evidence" title={W.evidence}><ul className="m-0 flex list-none flex-col gap-2 p-0">{h.evidence.map((e) => (
                <li key={e.key} className="min-w-0"><Press id={e.key} press={e.press} onDone={onDone}>
                  <p className={BODY}>{e.by} <span className="text-text-light">· {journeyWhen(e.at)} · {e.considered ? W.considered : W.notYet}</span></p>
                  <p className={`${META} ${WORDS}`}>{e.text}</p><p className={META}>{e.stance}</p>
                </Press></li>))}</ul></Section>}
              {h.dissent.length > 0 && <Section id="h-dissent" title={W.dissent}><ul className="m-0 flex list-none flex-col gap-2 p-0">{h.dissent.map((d) => (
                <li key={d.key} className="min-w-0"><Press id={d.key} press={d.press} onDone={onDone}>
                  <p className={BODY}>{d.holder} <span className="text-text-light">· {journeyWhen(d.at)}</span></p>
                  <p className={`${META} ${WORDS}`}>{d.words}</p>{d.tell !== null && <p className={`${META} ${WORDS}`}>{W.tell} {d.tell}</p>}
                </Press></li>))}</ul></Section>}
              {h.kept.length > 0 && <Section id="h-kept" title={W.kept}><ul className="m-0 flex list-none flex-col gap-2 p-0">{h.kept.map((k) => (
                <li key={k.key} className="min-w-0"><Press id={k.key} press={k.press} onDone={onDone}>
                  <p className={`${BODY} ${WORDS}`}><span className="text-info">{k.text}</span></p>
                  <p className={META}>{W.keptBy(k.name)} · {journeyWhen(k.at)}</p>
                </Press></li>))}</ul></Section>}
              {h.views !== null && <Press id="views" press={at !== null ? { unavailable: W.earlier } : { to: { kind: 'views', step: 'differ' } }} onDone={onDone}><p className={META}>{h.views}</p></Press>}
            </div>
          )}
        </div>
      )}
      <p className={`${HEAD} pt-2`} data-testid="journey-versions-heading">{W.versions}</p>
    </div>
  )
}

/**
 * The history panel's mount on the lane (lazy-loaded by WhatChangedPanel): the View held, only on the canvas's own store flags (the last
 * read succeeded, `error` null, and nothing changed since, `stale` false; store `shownModel` minus its model, so a View with no model yet,
 * only kept ideas, still draws). While an approval or an edit is re-read, or after that read failed, nothing: the record never describes
 * the View before it as current.
 */
export default function JourneyRecordBlock({ onDone }: { onDone?: () => void }): JSX.Element | null {
  const view = useViewStore((s) => (s.error === null && !s.stale ? s.view : null))
  const at = useViewStore((s) => s.at)
  return view === null ? null : <JourneyRecord view={view} at={at} onDone={onDone} />
}
