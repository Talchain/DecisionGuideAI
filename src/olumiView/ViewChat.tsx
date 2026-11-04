/**
 * The Olumi tab on the olumi-core lane, drawn from the View (olumi.view/2) and writing straight to core (View API design §2): the
 * conversation exactly as core wrote it and the change card for a proposal Olumi holds (`ViewChat`), and the composer, which the dock's
 * footer holds (`ViewComposer`). Every word is core's; each drawn View string carries `data-view`, the path to the string it shows.
 *
 * Before core holds the scenario, or after its first draft was set aside, the composer takes the brief, which starts it
 * (`startScenario`). One write at a time. After a write the View, and the team's read (which moves the canvas to a newly approved
 * model), are read again. A write that fails keeps what was typed and says core's own words; one whose answer never came may have been
 * saved, and is sent again only with the same op id, so core saves it once. What was typed and its op ids live in `useViewChat`, so
 * closing the dock loses neither (review 00052).
 */
import { create } from 'zustand'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { newOp, TeamApiError, UNCERTAIN_WRITE } from '../olumiCore/team/api'
import { registerDockedOlumiFocus } from '../canvas/conversation/dockedOlumiFocus'
import { writes, type View, type ViewTurn } from './client'
import { useViewStore } from './store'
import { derivedUuidOf } from '../olumiCore/team/sid'
import { useCanvasStore } from '../canvas/store'
import { setCurrentScenarioId } from '../canvas/store/scenarios'
import { scenarioIdWrite } from '../canvas/stores/unboundModelBinding'
import { typography } from '../styles/typography'
import { useGuidanceStore, withOlumiReveal } from '../canvas/stores/guidanceStore'
import { takeAskTargetBinding } from '../canvas/ui/inspector-v2/askTargetBinding'
import type { AIInputBarProps } from '../canvas/components/AIInputBar'
import { useUIStore } from '../stores/uiStore'
import { FigureEdit } from './FigureEdit'

type Said = NonNullable<ViewTurn['answer']>['answer']

function Words({ parts, at }: { parts: Said; at: string }) {
  return (
    <>
      {parts.map((p, i) => ('cite' in p
        ? <sup key={i} data-view-cite={`${at}.${i}.cite`} title={p.cite} aria-label={p.cite}>◦</sup>
        : <span key={i} data-view={`${at}.${i}.text`}>{p.text}</span>))}
    </>
  )
}

/** One turn of the conversation as the View holds it. `answerFirst`: Olumi's reply above the words it answers (the newest turn, lane C). */
function Turn({ t, at, answerFirst = false }: { t: ViewTurn; at: string; answerFirst?: boolean }) {
  const said = answerFirst
    // One line under the reply, the whole of what was said on hover: a brief quoted in full repeated the person's own words (4 Nov drive).
    ? <p className={`${typography.panelMeta} line-clamp-1`} title={t.said} data-testid="view-chat-in-reply">In reply to: <span data-view={`${at}.said`}>{t.said}</span></p>
    : <p data-view={`${at}.said`}>{t.said}</p>
  const answer = t.answer === null ? null : (
    <div className={answerFirst ? 'space-y-2' : 'mt-2 space-y-2'}>
      <p><Words parts={t.answer.answer} at={`${at}.answer.answer`} /></p>
      {t.answer.why.length === 0 ? null : (
        <details>
          <summary>Why</summary>
          <ul className="list-disc pl-4">{t.answer.why.map((w, j) => <li key={j}><Words parts={w} at={`${at}.answer.why.${j}`} /></li>)}</ul>
        </details>
      )}
      <p><span className={typography.panelHeader} data-view={`${at}.answer.next.label`}>{t.answer.next.label}</span> <Words parts={t.answer.next.text} at={`${at}.answer.next.text`} /></p>
    </div>
  )
  return (
    <li data-view-turn={at}>
      <div className={typography.panelMeta}>
        <span data-view={`${at}.by`}>{t.by}</span> · <span data-view={`${at}.version`}>{t.version}</span>
        {t.status === null ? null : <> · <span data-view={`${at}.status`}>{t.status}</span></>}
      </div>
      {answerFirst ? <>{answer}{said}</> : <>{said}{answer}</>}
      {t.broke === null ? null : <p data-view={`${at}.broke`}>{t.broke}</p>}
      {t.problem === null ? null : <p role="alert" data-view={`${at}.problem`}>{t.problem}</p>}
      {t.marks.map((m, j) => <p key={j} title={m.title}><span data-view={`${at}.marks.${j}.what`}>{m.what}</span>: <span data-view={`${at}.marks.${j}.status`}>{m.status}</span></p>)}
    </li>
  )
}

/** The conversation, oldest first, as the View holds it. */
export function ViewTurns({ chat }: { chat: View['chat'] }) {
  return (
    <ol className={`${typography.panelBody} space-y-4`} data-testid="view-chat-turns">
      {chat.map((t, i) => <Turn key={t.id} t={t} at={`chat.${i}`} />)}
    </ol>
  )
}

/**
 * The newest turn first, Olumi's reply above the words it answers, and the earlier turns folded under it (lane C, Paul 3 Nov: a
 * first-time person reads Olumi's reply first). Every turn keeps its path in the View (`chat.<i>`).
 */
export function ViewConversation({ chat }: { chat: View['chat'] }) {
  if (chat.length === 0) return null
  const last = chat.length - 1
  return (
    <div className={`${typography.panelBody} space-y-3`} data-testid="view-chat-turns">
      <ol className="space-y-4" data-testid="view-chat-latest"><Turn t={chat[last]!} at={`chat.${last}`} answerFirst /></ol>
      {last === 0 ? null : (
        <details data-testid="view-chat-earlier">
          <summary className={typography.panelMeta}>Earlier in this conversation ({last})</summary>
          <ol className="mt-2 space-y-4">{chat.slice(0, last).map((t, i) => <Turn key={t.id} t={t} at={`chat.${i}`} />)}</ol>
        </details>
      )}
    </div>
  )
}

/** The change card for the proposal Olumi holds, with core's words and marks, and the two acts on it. */
type Change = NonNullable<View['proposal']>['changes'][number]
/** A line's key: its id and whether it is a top-level field, since a record named like a field gives two lines with one id (API v1.9). */
const keyOf = (c: Change) => `${c.top ? 'top' : 'rec'}:${c.id}`

/**
 * One change line of core's change card (View `proposal.changes`, L8): its tick, core's line, and what a tap opens (`detail`), with Olumi's
 * mark on a line of Olumi's. Every word is core's.
 */
function ChangeLine({ c, i, ticked, toggle, busy }: { c: Change; i: number; ticked: boolean | null; toggle: (c: Change) => void; busy: boolean }) {
  const line = <><span data-view={`proposal.changes.${i}.text`}>{c.text}</span>{c.olumi === null ? null : <> <span title={c.olumi.title} aria-label={c.olumi.title} data-view={`proposal.changes.${i}.olumi.glyph`}>{c.olumi.glyph}</span></>}</>
  return (
    <li className="flex items-start gap-2" data-change={keyOf(c)}>
      {ticked === null ? null : <input type="checkbox" checked={ticked} disabled={busy} onChange={() => toggle(c)} aria-label={`Choose ${c.text}`} data-testid={`view-change-tick-${i}`} className="mt-1" />}
      {c.detail === '' ? <span>{line}</span> : (
        <details><summary className="cursor-pointer">{line}</summary><p className="whitespace-pre-line text-text-light" data-view={`proposal.changes.${i}.detail`}>{c.detail}</p></details>
      )}
    </li>
  )
}

/**
 * The proposal, as core's change card: its heading, the change list (flat, or under core's group headings over 12), and Approve (the whole
 * card), Approve ticked (exactly the ticked lines, core's `only` / `only_top`) and Set aside. A proposal held without a list has Approve alone.
 */
function Proposal({ p, busy }: { p: NonNullable<View['proposal']>; busy: boolean }) {
  // A core before L8 serves no list (absent, never []): its card has Approve alone, as a proposal held without a list.
  const changes = p.changes ?? [], groups = p.groups ?? null
  // One line is the whole proposal: ticking it would only repeat Approve, so there are ticks from two lines (4 Nov drive at 1280).
  const tickable = changes.length > 1
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
  const toggle = (c: Change) => setTicked((t) => { const n = new Set(t), k = keyOf(c); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const toggleGroup = (lines: number[], on: boolean) => setTicked((t) => { const n = new Set(t); for (const i of lines) { const c = changes[i]; if (c) { if (on) n.add(keyOf(c)); else n.delete(keyOf(c)) } } return n })
  // The ticked lines, in core's order: a record's id in `only`, a top-level field's name in `only_top`, never mixed (API v1.8).
  const pick: { only: string[]; only_top: string[] } = { only: [], only_top: [] }
  for (const c of changes) if (ticked.has(keyOf(c))) (c.top ? pick.only_top : pick.only).push(c.id)
  const chosen = pick.only.length + pick.only_top.length
  const line = (i: number) => { const c = changes[i]!; return <ChangeLine key={keyOf(c)} c={c} i={i} ticked={tickable ? ticked.has(keyOf(c)) : null} toggle={toggle} busy={busy} /> }
  return (
    <div className={`${typography.panelBody} rounded border border-border p-3 space-y-2`} data-testid="view-chat-proposal">
      <div><span className={typography.panelHeader} data-view="proposal.heading">{p.heading}</span> <span data-view="proposal.on">{p.on}</span>
        {p.removed === null ? null : <> <span title={p.removed.title} data-view="proposal.removed.text">{p.removed.text}</span></>}</div>
      {p.problem === null ? null : <p role="alert" data-view="proposal.problem">{p.problem}</p>}
      {p.marks.map((m, j) => <p key={j} title={m.title}><span data-view={`proposal.marks.${j}.what`}>{m.what}</span>: <span data-view={`proposal.marks.${j}.status`}>{m.status}</span></p>)}
      {changes.length === 0 ? null : groups === null
        ? <ul className="m-0 grid list-none gap-1 p-0" data-testid="view-changes">{changes.map((_, i) => line(i))}</ul>
        : (
          <ul className="m-0 grid list-none gap-1 p-0" data-testid="view-changes">
            {groups.map((g, gi) => {
              const all = g.lines.length > 0 && g.lines.every((i) => changes[i] !== undefined && ticked.has(keyOf(changes[i]!)))
              return (
                <li key={gi}>
                  <details>
                    <summary className="cursor-pointer">
                      <input type="checkbox" checked={all} disabled={busy} onClick={(e) => e.stopPropagation()} onChange={() => toggleGroup(g.lines, !all)}
                        aria-label={`Choose every change under ${g.heading}`} data-testid={`view-change-group-${gi}`} className="mr-2" />
                      <b data-view={`proposal.groups.${gi}.heading`}>{g.heading}</b>
                    </summary>
                    <ul className="m-0 mt-1 grid list-none gap-1 p-0 pl-3">{g.lines.map(line)}</ul>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className="rounded px-3 py-2 bg-primary text-text-on-color disabled:opacity-50" onClick={() => void act(() => writes.approve(p.id, p.base), true)}>Approve</button>
        {!tickable ? null : (
          <button type="button" disabled={busy || chosen === 0} data-testid="view-approve-ticked" title="Approve only the changes you ticked"
            className="rounded px-3 py-2 border border-info/30 text-info disabled:opacity-50" onClick={() => void act(() => writes.approve(p.id, p.base, pick), true)}>Approve ticked · {chosen}</button>
        )}
        <button type="button" disabled={busy} className="rounded px-3 py-2 border border-border disabled:opacity-50" onClick={() => void act(() => writes.discard(p.id))}>Set aside</button>
      </div>
    </div>
  )
}

/** A write core saved whose View could not then be read: it is not lost, and it is not shown yet (review 00052 #7). */
export const SAVED_NOT_SHOWN = 'Saved, but Olumi could not show it just now. Reload the page to see it.'

interface ViewChatState {
  /** What is typed in the composer. */
  readonly text: string
  /**
   * One op id per write: the same words sent again after a dropped connection are saved once. Keyed by the scenario, the kind of write
   * and the words (`opKey`), so one scenario's op is never reused for another's (review 00054 #5).
   */
  readonly ops: ReadonlyMap<string, string>
  readonly busy: boolean
  /** Core's words for the last write that did not go through, or SAVED_NOT_SHOWN. */
  readonly said: string | null
  /**
   * A challenge that did not go through, its words waiting in the composer: sending those words again resends THAT challenge, with its
   * op id (it may already be saved), never a plain message (review 00002 #3). Changed words are a new message.
   */
  readonly held: { readonly text: string; readonly kind: string; readonly record: string; readonly sid: string; readonly uuid: string | null } | null
}

export const useViewChat = create<ViewChatState>()(() => ({ text: '', ops: new Map(), busy: false, said: null, held: null }))

/** One write, then the View read again. An approval changes the model: the View is stale until the new one lands (00051). */
async function act(f: () => Promise<unknown>, changesModel = false): Promise<boolean> {
  if (useViewChat.getState().busy) return false
  useViewChat.setState({ busy: true, said: null })
  try {
    await f()
    const views = useViewStore.getState()
    const shown = await (changesModel ? views.modelChanged() : views.refresh())
    if (!shown) useViewChat.setState({ said: SAVED_NOT_SHOWN })
    return true
  } catch (e) {
    useViewChat.setState({ said: e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.' })
    return false
  } finally { useViewChat.setState({ busy: false }) }
}

/**
 * A brief starts a scenario in core, and the page moves to core's id's own UUID form (`sid.ts`), the scenario's one address: the address
 * bar then names it (`/#/scenario/<uuid>`), so the link opens the same scenario in any browser of a member. An answer that lands after the
 * page moved on to another scenario moves nothing (review 00052 #5).
 */
async function startScenario(brief: string, op: string, uuid: string | null): Promise<void> {
  watchPageMoves()
  const left = pageMoves
  const made = await writes.create(brief, op)
  // An answer that names no scenario (unreadable, or JSON null) may still have been saved: uncertain, never "nothing saved" (00054 #4).
  if (typeof made?.scenario !== 'string' || !/^s_[0-9a-f]+$/.test(made.scenario)) throw new TeamApiError(0, UNCERTAIN_WRITE, true)
  const derived = derivedUuidOf(made.scenario)
  if (derived === null) throw new TeamApiError(502, 'Olumi made the scenario but named it in a way this page cannot open. Reload the page.')
  // The page moved away while the answer was on its way, even if it has since come back (A → B → A): it moves nothing (review 00002).
  if (pageMoves !== left || useCanvasStore.getState().currentScenarioId !== uuid) return
  useCanvasStore.setState(scenarioIdWrite(useCanvasStore.getState().currentScenarioId, derived))
  setCurrentScenarioId(derived)
  try { window.history.replaceState(window.history.state, '', `/#/scenario/${derived}`) } catch { /* the address bar keeps its old address */ }
  await useViewStore.getState().use(derived)
}

/** How many times the page has moved to another scenario: an answer is applied only to the page it was asked from. */
let pageMoves = 0
let watching = false
/** Counted from the first scenario this page starts, not from import: a module that only imports this file subscribes to nothing. */
function watchPageMoves(): void {
  if (watching) return
  watching = true
  useCanvasStore.subscribe((now, before) => { if (now.currentScenarioId !== before.currentScenarioId) pageMoves += 1 })
}

/** Core holds no model and no proposal for this scenario (none yet, or its first draft was set aside): a message is a new brief (00052 #6). */
const takesBrief = (sid: string | null, view: View | null) => sid === null || (view !== null && view.version === null && view.proposal === null)

const opKey = (uuid: string | null, kind: string, text: string) => `${uuid ?? '-'}\u0000${kind}\u0000${text}`

/** One write of `text`, with its op id kept until core has it; true when it went through. `uuid`: the scenario it belongs to (the page's). */
async function write(kind: string, text: string, f: (op: string) => Promise<unknown>, changesModel = false, uuid = useViewStore.getState().uuid): Promise<boolean> {
  const key = opKey(uuid, kind, text)
  const op = useViewChat.getState().ops.get(key) ?? newOp()
  useViewChat.setState({ ops: new Map(useViewChat.getState().ops).set(key, op) })
  const sent = await act(() => f(op), changesModel)
  if (sent) { const left = new Map(useViewChat.getState().ops); left.delete(key); useViewChat.setState({ ops: left }) }
  return sent
}

/** Words to core: a new brief while it holds no model for this scenario, else a message. */
function say(text: string): Promise<boolean> {
  const { uuid, sid, view } = useViewStore.getState()
  return takesBrief(sid, view) ? write('brief', text, (op) => startScenario(text, op, uuid)) : write('message', text, (op) => writes.message(sid!, text, op))
}

async function send(): Promise<void> {
  const { text, held } = useViewChat.getState()
  if (text.trim() === '') return
  const again = held !== null && held.text === text ? held : null
  if (held !== null && again === null) useViewChat.setState({ held: null })
  if (!(await (again !== null ? challenge(again.kind, again.record, again.text, again) : say(text)))) return
  if (useViewChat.getState().text === text) useViewChat.setState({ text: '' })
}

/**
 * A challenge on one card, to core's challenge route; one that does not go through is held for the same resend (`held`). A resend goes to
 * the scenario it was made in, with that scenario's op, whichever scenario is on screen now (review 00003 #2): it is the same write.
 */
async function challenge(kind: string, record: string, text: string, at = { sid: useViewStore.getState().sid, uuid: useViewStore.getState().uuid }): Promise<boolean> {
  const { sid, uuid } = at
  if (sid === null) return false
  const sent = await write(`challenge:${kind}:${record}`, text, (op) => writes.challenge(sid, kind, record, op), false, uuid)
  useViewChat.setState({ held: sent ? null : { text, kind, record, sid, uuid } })
  return sent
}

/** core's four challenges (API `POST …/challenge` `kind`), by the press's chip id. */
const CHALLENGES: Readonly<Record<string, string>> = { 'ask:challenge': 'assumption', 'ask:method-opposite': 'opposite', 'ask:falsify': 'disconfirming', 'ask:method-outside-view': 'outside' }

export type Press = { id?: string; parameters?: Record<string, unknown>; message: string }

/**
 * A press on the canvas (a coaching icon, a chip). A challenge on exactly one card of the model goes to core's challenge route for that
 * card; anything else is its words, said to core. The card is the ask's own target, else the canvas's selection.
 */
function press(opts: Press): Promise<boolean> {
  const chip = opts.id ?? (typeof opts.parameters?.['chip_id'] === 'string' ? opts.parameters['chip_id'] as string : '')
  const kind = CHALLENGES[chip]
  const { sid, view } = useViewStore.getState()
  const target = takeAskTargetBinding(opts.message)?.nodeIds ?? useCanvasStore.getState().selection.nodeIds
  const ids = [...target]
  const record = ids.length === 1 && view?.model?.cards.some((c) => c.id === ids[0]) ? ids[0]! : null
  if (kind !== undefined && record !== null && sid !== null) return challenge(kind, record, opts.message)
  return say(opts.message)
}

/** An ask made while a write is in flight: its words wait in the composer, never lost or sent twice (review 00055). */
export const STILL_ANSWERING = 'Olumi is still answering. Your words are in the message box: send them once it has.'
/** Words from the canvas the person can still send: put after whatever the composer already holds, never over it (review 00056). */
const keep = (text: string): void => {
  const now = useViewChat.getState().text
  if (now.split('\n').includes(text)) return
  useViewChat.setState({ text: now.trim() === '' ? text : `${now}\n${text}` })
}
const keptWhileBusy = (text: string): boolean => {
  if (!useViewChat.getState().busy) return false
  keep(text)
  useViewChat.setState({ said: STILL_ANSWERING })
  return true
}
/** An ask from the canvas that did not go through (core refused it, or its answer never came) keeps its words beside core's sentence. */
const keptIfNotSent = (text: string) => (sent: boolean) => { if (!sent) keep(text) }

/** The canvas's asks, answered by this writer: one set for the page, so every holder registers the same functions. */
const ASKS = {
  _sendMessage: withOlumiReveal((text: string) => { if (!keptWhileBusy(text)) void say(text).then(keptIfNotSent(text)) }),
  _prefillChat: withOlumiReveal((text: string) => { useViewChat.setState({ text }) }),
  _dispatchAction: withOlumiReveal((opts: Press) => { if (!keptWhileBusy(opts.message)) void press(opts).then(keptIfNotSent(opts.message)) }),
  _isConversationBusy: () => useViewChat.getState().busy,
}
let holders = 0

/**
 * While the tab, or the dock that holds it, is on the page it answers the canvas's asks (the coaching icons need one), as the /bff
 * Olumi tab did (00054 #3): with the dock collapsed too (lane audit 24), each ask then fronting the Olumi tab. Released when the last
 * holder leaves.
 */
export function useAnswersAsks(on = true): void {
  useEffect(() => {
    if (!on) return
    holders += 1
    useGuidanceStore.setState(ASKS)
    return () => {
      holders -= 1
      if (holders > 0) return
      const now = useGuidanceStore.getState(), gone: Record<string, null> = {}
      for (const [k, f] of Object.entries(ASKS)) if (now[k as keyof typeof ASKS] === f) gone[k] = null
      useGuidanceStore.setState(gone)
    }
  }, [on])
}

type WaitsOnItem = NonNullable<NonNullable<NonNullable<View['model']>['run']>['waits_on']>['items'][number]
export type NextStep = { readonly kind: 'approve' } | { readonly kind: 'figure'; readonly item: WaitsOnItem & { edit: NonNullable<WaitsOnItem['edit']> } } | { readonly kind: 'invite' }

/**
 * The one thing for the person to do next (lane C, Paul 3 Nov: a first-time person knows what to do within a minute), chosen from what
 * the View already states, in this order: a proposal Olumi holds is checked first (nothing is kept until it is approved); then the
 * first figure the chances wait on that core lets them type; then, while they are the only member, bringing a colleague in. Else
 * nothing: the conversation is the next step.
 */
export function nextStepOf(view: View): NextStep | null {
  if (view.proposal !== null) return { kind: 'approve' }
  const item = view.model?.edit_base == null ? undefined : view.model.run?.waits_on?.items.find((i) => i.edit !== null)
  if (item) return { kind: 'figure', item: item as WaitsOnItem & { edit: NonNullable<WaitsOnItem['edit']> } }
  if (view.version !== null && view.collab.alone) return { kind: 'invite' }
  return null
}

export const NEXT_STEP_WORDS = {
  approve: 'Olumi proposes changes to the model, shown on the canvas. Check them against your situation, then approve them or set them aside. Nothing changes until you approve.',
  figure: 'The chances wait on a figure only you can give:',
  invite: 'Bring in a colleague: each of you gives your own view privately, then you reveal them together and see where you differ.',
} as const

/** The next step, highlighted at the top of the Olumi tab: its words and the one control that does it. */
function NextStepCard({ view, busy }: { view: View; busy: boolean }) {
  const step = nextStepOf(view)
  if (step === null) return null
  return (
    <section className={`${typography.panelBody} rounded-lg border border-info/40 bg-panel p-3 space-y-2 ring-1 ring-info/20`} data-testid="view-next-step" data-step={step.kind} aria-label="Next step">
      <p className={typography.panelHeader}>Next step</p>
      <p>{NEXT_STEP_WORDS[step.kind]}</p>
      {step.kind === 'approve' ? <Proposal key={view.proposal!.id} p={view.proposal!} busy={busy} /> : null}
      {step.kind === 'figure' ? (
        <div className="space-y-1">
          <p title={step.item.title} data-view={`run.waits_on.items.${view.model!.run!.waits_on!.items.indexOf(step.item)}.text`}>{step.item.text}</p>
          <FigureEdit id={step.item.id} edit={step.item.edit} label="Add the figure" place="next-figure" />
        </div>
      ) : null}
      {step.kind === 'invite' ? (
        <button type="button" data-testid="view-next-invite" className="rounded px-3 py-2 bg-primary text-text-on-color" onClick={() => useUIStore.getState().forceActivateOutputTab('team')}>Invite a colleague</button>
      ) : null}
    </section>
  )
}

/** The tab on the core lane: the next step, then the conversation, newest first, from the View (the composer is the dock's footer). */
export function ViewChat() {
  useAnswersAsks()
  const view = useViewStore((s) => s.view), error = useViewStore((s) => s.error)
  const busy = useViewChat((s) => s.busy)
  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="view-chat">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* A read that failed says so, before a View or after a good one (lane audit 5.4). */}
        {error === null ? null : <p role="alert" data-testid="view-chat-unread">{error}</p>}
        {view === null ? null : <NextStepCard view={view} busy={busy} />}
        {view === null ? null : <ViewConversation chat={view.chat} />}
      </div>
    </div>
  )
}

export const DRAFTING_WORDS = 'Olumi is drafting a model from your brief. A first model can take a few minutes.'
export const THINKING_WORDS = 'Olumi is thinking…'

/**
 * While a write is in flight the composer is held and says why (lane audit 5.7), with the seconds since it started: a first draft takes
 * minutes, and a line that never moves reads as stuck (PL review, 4 Nov). Status only; nothing streams.
 */
function Working({ brief }: { brief: boolean }) {
  // What the write is, as it was when it started: the page moves to the new scenario while a brief is still drafting.
  const [drafting] = useState(brief)
  const [started] = useState(() => Date.now())
  const [now, setNow] = useState(started)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const s = Math.floor((now - started) / 1000)
  return (
    <p role="status" className={typography.panelMeta} data-testid="view-chat-working">
      {drafting ? DRAFTING_WORDS : THINKING_WORDS} <span data-testid="view-chat-working-seconds">{s} s</span>
    </p>
  )
}

/** What a first-time person needs before their brief (lane C, Paul 3 Nov: understood within a minute): what to write and what happens. */
export const BRIEF_INTRO = 'Describe the situation in your own words: the options you are weighing, what you are aiming for, and any figures you know. Olumi builds a model from it for you to check and change.'
export const BRIEF_EXAMPLE = 'For example: should we hire a second engineer now or wait until next quarter? We need the release out by June, and each engineer ships about two features a month.'

/**
 * The composer on the core lane, in the dock's footer in place of the /bff conversation's (review 00052 #3): a brief while core holds
 * no model for this scenario, else a message. It keeps the footer's run control (`analysisAction`, the dock's canonical runner).
 */
export function ViewComposer({ analysisAction }: { analysisAction?: AIInputBarProps['analysisAction'] }): ReactNode {
  const sid = useViewStore((s) => s.sid), view = useViewStore((s) => s.view), error = useViewStore((s) => s.error)
  const { text, busy, said } = useViewChat()
  const box = useRef<HTMLTextAreaElement>(null)
  const brief = takesBrief(sid, view)
  // A scenario waiting for its brief puts the person in the brief box (canvas A S6 D6), once no write holds it disabled (00065).
  useEffect(() => { if (brief && !busy) box.current?.focus() }, [brief, busy])
  // The dock's focus channel reaches this composer (review 00065 ledger).
  useEffect(() => registerDockedOlumiFocus(() => box.current?.focus()), [])
  if (sid !== null && view === null && error === null) return null
  const blocked = analysisAction !== undefined && !analysisAction.canRun && !analysisAction.isRunning
  return (
    <div className={`${typography.panelBody} border-t border-border p-3 space-y-2`} data-testid="view-composer">
      {said === null ? null : <p role="alert" data-testid="view-chat-said">{said}</p>}
      {/* While a write is in flight the composer is held: it says why (lane audit 5.7), in core's page's words. */}
      {busy ? <Working brief={brief} /> : null}
      <label className={brief ? typography.panelHeader : 'sr-only'} htmlFor="view-chat-text">{brief ? 'Your brief' : 'Message Olumi'}</label>
      {brief ? <p id="view-brief-intro" className="text-text-body" data-testid="view-brief-intro">{BRIEF_INTRO}</p> : null}
      <textarea ref={box} id="view-chat-text" className="w-full rounded border border-border p-2" rows={brief ? 6 : 3} value={text}
        placeholder={brief ? BRIEF_EXAMPLE : undefined} aria-describedby={brief ? 'view-brief-intro' : undefined} disabled={busy} onChange={(e) => useViewChat.setState({ text: e.target.value })} />
      <div className="flex gap-2">
        <button type="button" disabled={busy || text.trim() === ''} className="rounded px-3 py-2 bg-primary text-text-on-color disabled:opacity-50" onClick={() => void send()}>Send</button>
        {analysisAction === undefined ? null : (
          <button type="button" onClick={analysisAction.onRun} disabled={analysisAction.isRunning || !analysisAction.canRun} aria-label={analysisAction.label}
            title={blocked ? analysisAction.blockedReason ?? analysisAction.label : analysisAction.label} className="rounded px-3 py-2 border border-border disabled:opacity-50"
            data-testid="view-composer-analyse">{analysisAction.label}</button>
        )}
      </div>
    </div>
  )
}
