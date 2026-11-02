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
import { useEffect, useRef, type ReactNode } from 'react'
import { newOp, TeamApiError, UNCERTAIN_WRITE } from '../olumiCore/team/api'
import { useTeamStore } from '../olumiCore/team/store'
import { registerDockedOlumiFocus } from '../canvas/conversation/dockedOlumiFocus'
import { writes, type View, type ViewTurn } from './client'
import { useViewStore } from './store'
import { derivedUuidOf, pairCoreScenario } from '../olumiCore/team/sid'
import { useCanvasStore } from '../canvas/store'
import { setCurrentScenarioId } from '../canvas/store/scenarios'
import { scenarioIdWrite } from '../canvas/stores/unboundModelBinding'
import { typography } from '../styles/typography'
import { useGuidanceStore, withOlumiReveal } from '../canvas/stores/guidanceStore'
import { takeAskTargetBinding } from '../canvas/ui/inspector-v2/askTargetBinding'
import type { AIInputBarProps } from '../canvas/components/AIInputBar'

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

/** The conversation, oldest first, as the View holds it. */
export function ViewTurns({ chat }: { chat: View['chat'] }) {
  return (
    <ol className={`${typography.panelBody} space-y-4`} data-testid="view-chat-turns">
      {chat.map((t, i) => {
        const at = `chat.${i}`
        return (
          <li key={t.id} data-view-turn={at}>
            <div className={typography.panelMeta}>
              <span data-view={`${at}.by`}>{t.by}</span> · <span data-view={`${at}.version`}>{t.version}</span>
              {t.status === null ? null : <> · <span data-view={`${at}.status`}>{t.status}</span></>}
            </div>
            <p data-view={`${at}.said`}>{t.said}</p>
            {t.answer === null ? null : (
              <div className="mt-2 space-y-2">
                <p><Words parts={t.answer.answer} at={`${at}.answer.answer`} /></p>
                {t.answer.why.length === 0 ? null : (
                  <details>
                    <summary>Why</summary>
                    <ul className="list-disc pl-4">{t.answer.why.map((w, j) => <li key={j}><Words parts={w} at={`${at}.answer.why.${j}`} /></li>)}</ul>
                  </details>
                )}
                <p><span className={typography.panelHeader} data-view={`${at}.answer.next.label`}>{t.answer.next.label}</span> <Words parts={t.answer.next.text} at={`${at}.answer.next.text`} /></p>
              </div>
            )}
            {t.broke === null ? null : <p data-view={`${at}.broke`}>{t.broke}</p>}
            {t.problem === null ? null : <p role="alert" data-view={`${at}.problem`}>{t.problem}</p>}
            {t.marks.map((m, j) => <p key={j} title={m.title}><span data-view={`${at}.marks.${j}.what`}>{m.what}</span>: <span data-view={`${at}.marks.${j}.status`}>{m.status}</span></p>)}
          </li>
        )
      })}
    </ol>
  )
}

/** The change card for the proposal Olumi holds, with core's words and marks, and the two acts on it. */
function Proposal({ p, busy }: { p: NonNullable<View['proposal']>; busy: boolean }) {
  return (
    <div className={`${typography.panelBody} rounded border border-border p-3 space-y-2`} data-testid="view-chat-proposal">
      <div><span className={typography.panelHeader} data-view="proposal.heading">{p.heading}</span> <span data-view="proposal.on">{p.on}</span>
        {p.removed === null ? null : <> <span title={p.removed.title} data-view="proposal.removed.text">{p.removed.text}</span></>}</div>
      {p.problem === null ? null : <p role="alert" data-view="proposal.problem">{p.problem}</p>}
      {p.marks.map((m, j) => <p key={j} title={m.title}><span data-view={`proposal.marks.${j}.what`}>{m.what}</span>: <span data-view={`proposal.marks.${j}.status`}>{m.status}</span></p>)}
      <div className="flex gap-2">
        <button type="button" disabled={busy} className="rounded px-3 py-2 bg-primary text-text-on-color disabled:opacity-50" onClick={() => void act(() => writes.approve(p.id, p.base), true)}>Approve</button>
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
}

export const useViewChat = create<ViewChatState>()(() => ({ text: '', ops: new Map(), busy: false, said: null }))

/** One write, then the View and the team read again. An approval changes the model: the View is stale until the new one lands (00051). */
async function act(f: () => Promise<unknown>, changesModel = false): Promise<boolean> {
  if (useViewChat.getState().busy) return false
  useViewChat.setState({ busy: true, said: null })
  try {
    await f()
    const views = useViewStore.getState()
    const [shown] = await Promise.all([changesModel ? views.modelChanged() : views.refresh(), useTeamStore.getState().refresh()])
    if (!shown) useViewChat.setState({ said: SAVED_NOT_SHOWN })
    return true
  } catch (e) {
    useViewChat.setState({ said: e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.' })
    return false
  } finally { useViewChat.setState({ busy: false }) }
}

/**
 * A brief starts a scenario in core. Its id is kept against the scenario the brief was sent from (`uuid`, read before the write, so an
 * answer that lands after the page moved on pairs the right one: review 00052 #5), as the adapter page kept it from `x-olumi-alias`.
 * A canvas with no scenario yet, or a page that cannot keep the pairing, moves to core's id's own UUID form, if it is still on it.
 */
async function startScenario(brief: string, op: string, uuid: string | null): Promise<void> {
  const made = await writes.create(brief, op)
  // A 201 whose body could not be read names no scenario: it may have been saved, so it is said so and sent again with its op (00054 #4).
  // An answer that names no scenario (unreadable, or JSON null) may still have been saved: uncertain, never "nothing saved".
  if (typeof made?.scenario !== 'string' || !/^s_[0-9a-f]+$/.test(made.scenario)) throw new TeamApiError(0, UNCERTAIN_WRITE, true)
  const views = useViewStore.getState()
  if (uuid !== null && pairCoreScenario(uuid, made.scenario)) {
    if (views.uuid === uuid) await views.use(uuid)
    return
  }
  const derived = derivedUuidOf(made.scenario)
  if (derived === null) throw new TeamApiError(502, 'Olumi made the scenario but named it in a way this page cannot open. Reload the page.')
  if (useCanvasStore.getState().currentScenarioId !== uuid) return
  useCanvasStore.setState(scenarioIdWrite(useCanvasStore.getState().currentScenarioId, derived))
  setCurrentScenarioId(derived)
  await views.use(derived)
}

/** Core holds no model and no proposal for this scenario (none yet, or its first draft was set aside): a message is a new brief (00052 #6). */
const takesBrief = (sid: string | null, view: View | null) => sid === null || (view !== null && view.version === null && view.proposal === null)

const opKey = (uuid: string | null, kind: string, text: string) => `${uuid ?? '-'}\u0000${kind}\u0000${text}`

/** One write of `text`, with its op id kept until core has it; true when it went through. */
async function write(kind: string, text: string, f: (op: string) => Promise<unknown>, changesModel = false): Promise<boolean> {
  const key = opKey(useViewStore.getState().uuid, kind, text)
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
  const { text } = useViewChat.getState()
  if (text.trim() === '' || !(await say(text))) return
  if (useViewChat.getState().text === text) useViewChat.setState({ text: '' })
}

/** core's four challenges, by the press's chip id (as the adapter page routed them, scripts/olumi-core/lib/turn.mjs CHALLENGE_KINDS). */
const CHALLENGES: Readonly<Record<string, string>> = { 'ask:challenge': 'assumption', 'ask:method-opposite': 'opposite', 'ask:falsify': 'disconfirming', 'ask:method-outside-view': 'outside' }

type Press = { id?: string; parameters?: Record<string, unknown>; message: string }

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
  if (kind !== undefined && record !== null && sid !== null) return write(`challenge:${kind}:${record}`, opts.message, (op) => writes.challenge(sid, kind, record, op))
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

/** While the tab is on the page it answers the canvas's asks (the coaching icons need one), as the /bff Olumi tab did (00054 #3). */
function useAnswersAsks(): void {
  useEffect(() => {
    const mine = {
      _sendMessage: withOlumiReveal((text: string) => { if (!keptWhileBusy(text)) void say(text).then(keptIfNotSent(text)) }),
      _prefillChat: withOlumiReveal((text: string) => { useViewChat.setState({ text }) }),
      _dispatchAction: withOlumiReveal((opts: Press) => { if (!keptWhileBusy(opts.message)) void press(opts).then(keptIfNotSent(opts.message)) }),
      _isConversationBusy: () => useViewChat.getState().busy,
    }
    useGuidanceStore.setState(mine)
    return () => {
      const now = useGuidanceStore.getState(), gone: Record<string, null> = {}
      for (const [k, f] of Object.entries(mine)) if (now[k as keyof typeof mine] === f) gone[k] = null
      useGuidanceStore.setState(gone)
    }
  }, [])
}

/** The tab on the core lane: the conversation and the proposal from the View (the composer is the dock's footer, `ViewComposer`). */
export function ViewChat() {
  useAnswersAsks()
  const view = useViewStore((s) => s.view), error = useViewStore((s) => s.error)
  const busy = useViewChat((s) => s.busy)
  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="view-chat">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {view === null ? (error === null ? null : <p role="alert" data-testid="view-chat-unread">{error}</p>) : <ViewTurns chat={view.chat} />}
        {view?.proposal ? <Proposal p={view.proposal} busy={busy} /> : null}
      </div>
    </div>
  )
}

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
      <label className={brief ? typography.panelHeader : 'sr-only'} htmlFor="view-chat-text">{brief ? 'Your brief' : 'Message Olumi'}</label>
      <textarea ref={box} id="view-chat-text" className="w-full rounded border border-border p-2" rows={brief ? 6 : 3} value={text} disabled={busy} onChange={(e) => useViewChat.setState({ text: e.target.value })} />
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
