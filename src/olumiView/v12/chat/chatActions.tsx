/** Every write from the Olumi tab: the composer's state (`useViewChat`), saying, resending and the kept pending turn, and the presses (challenges, figure first, moves, asks) (moved verbatim from ViewChat.tsx). */
import { create } from 'zustand'
import { useEffect } from 'react'
import { call, newOp, READ_FAILED, TeamApiError, UNCERTAIN_WRITE } from '../../../olumiCore/team/api'
import { writes, VIEW_SHAPE_CHANGED, type DraftAccepted, type FigureFirstShown, type View, type ViewTurn } from '../../client'
import { useViewStore } from '../../store'
import { usePreMortemGate, useViewLens } from '../../lens'
import { figureFirstOf, optionInFocusOf } from '../../layout'
import { derivedUuidOf } from '../../../olumiCore/team/sid'
import { useMe } from '../../../olumiCore/me'
import { useCanvasStore } from '../../../canvas/store'
import { setCurrentScenarioId } from '../../../canvas/store/scenarios'
import { scenarioIdWrite } from '../../../canvas/stores/unboundModelBinding'
import { controls } from '../../../styles/controls'
import { useGuidanceStore, withOlumiReveal } from '../../../canvas/stores/guidanceStore'
import { takeAskTargetBinding } from '../../../canvas/ui/inspector-v2/askTargetBinding'
import { focusNodeById } from '../../../canvas/utils/focusHelpers'
import { armedIntent } from '../../armedIntent'
import { useEscapeFloor } from '../edit/escapeLayers'
import { revealOlumiSurface } from '../../../canvas/conversation/revealOlumi'
import { V10_METHODS, withMethodPrefix } from '../../../presentation/V10MethodChips'
import { Button } from '../../../components/ui/Button'
import { FIGURE_FIRST_CLOSED, useFigureFirst } from '../../ViewFigureFirst'
import { useModelNotice } from '../../notice'
import { onFloor } from '../../early'
import { pressFieldOf, pressKindFor, type PressKind } from '../../press'
import { FIGURE_FIRST_ID, isRealMove } from '../actions'
import { closeUntouchedCommit } from '../team'
import { OkIcon } from '../../look/icons'

/** A write core saved whose View could not then be read: it is not lost, and it is not shown yet (review 00052 #7). */
export const SAVED_NOT_SHOWN = 'Saved, but Olumi could not show it just now. Reload the page to see it.'

export interface ViewChatState {
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
  /** A move core refused as no longer the newest (409): its tap is not offered again, and it is not retried. */
  readonly gone?: string | null
  /** Words-start (Codex root 03:42:17Z): a brief put back after a reload that was sent to start in words. Sending those same words again keeps that
   *  choice and its op, whichever button is pressed; changed words are a new brief. */
  readonly wordsBrief?: string | null
  /** Typed fields 13b (Codex HOLD 03:05:28Z): a press put back after a reload. Sending those same words again resends the same press about the
   *  same card under its op (core answers a replay with the turn it has); changed words are the person's own message. */
  readonly pressBack?: { readonly text: string; readonly about: string; readonly press: PressKind; /** The scenario (page uuid) and person it was made for: used only there (Codex 6afc8c1a). */ readonly uuid: string | null; readonly person: string | null } | null
  /** A challenge picked in the composer with no single card selected (menu brief UI-A, 18 Nov): it runs on the next card the person picks. */
  readonly armed?: ChallengeKind | null
  /** The words a canvas ask put in an EMPTY box (the Frame question's "Ask Olumi to change it"): while the box still holds exactly them nothing of the person's is in it and Escape clears it. Any typing clears this. */
  readonly prefilled?: string | null
}

export const useViewChat = create<ViewChatState>()(() => ({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null }))
// Any write to the text (typing, a send, a restore) that is not the prefill itself makes the box the person's: `prefilled` is cleared at the one place every write passes.
useViewChat.subscribe((st, was) => { if (st.text !== was.text && st.prefilled != null && st.text !== st.prefilled) useViewChat.setState({ prefilled: null }) })

/** A past version is on the canvas (the version history's Draw): nothing is written until the person is back on the latest. */
export const PAST_HELD = 'Go back to the latest version to change the model.'

/** One write, then the View read again. An approval changes the model: the View is stale until the new one lands (00051). */
/** Where a write's words go when it does not go through: the composer's line, unless the write has its own panel (the figure-first entry). */
const toComposer = (said: string | null): void => useViewChat.setState({ said })

export async function act(f: () => Promise<unknown>, changesModel = false, sink: (said: string | null) => void = toComposer): Promise<boolean> {
  if (useViewChat.getState().busy) return false
  if (useViewStore.getState().at !== null) { sink(PAST_HELD); return false }
  // A write that settles after the page has moved to another scenario says nothing there: its words belong to the scenario it was made in
  // (delta review of 006 #1: A's refusal appeared in B's composer).
  const at = useViewStore.getState().uuid, here = () => useViewStore.getState().uuid === at
  useViewChat.setState({ busy: true })
  sink(null)
  try {
    await f()
    const views = useViewStore.getState()
    const shown = await (changesModel ? views.modelChanged() : views.refresh())
    if (!shown && here()) sink(SAVED_NOT_SHOWN)
    return true
  } catch (e) {
    if (here()) sink(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    return false
  } finally { useViewChat.setState({ busy: false }) }
}

/**
 * A brief starts a scenario in core, and the page moves to core's id's own UUID form (`sid.ts`), the scenario's one address: the address
 * bar then names it (`/#/scenario/<uuid>`), so the link opens the same scenario in any browser of a member. An answer that lands after the
 * page moved on to another scenario moves nothing (review 00052 #5).
 */
/**
 * Start in words (core `POST /api/scenarios { brief, start: 'words' }`, words-start CONTRACT 1, 17 Nov): core saves the scenario and its brief and
 * builds no model (no draft job, no AI call). The page then sends the same words as the person's first message (`POST …/messages`, the existing
 * route), so Olumi answers them on the floor at once, in words; that answer is the only AI call. Its op is derived from the brief's op, so a
 * retry after a lost answer replays the same message instead of sending a second one.
 */
const createInWords = (brief: string, op: string) => call<DraftAccepted>('POST', '/api/scenarios', { brief, op, start: 'words' })
const firstMessageOp = (op: string) => `${op}-m`.slice(0, 64)

async function startScenario(brief: string, op: string, uuid: string | null, words = false): Promise<void> {
  watchPageMoves()
  const left = pageMoves
  // AI jobs (core API v1.26): core accepts the brief at once (202) and drafts it in the server. Until it names the scenario, the brief and its
  // op stay in this tab for this person, so an answer lost on the way is recovered after a reload by the same op (pendingBrief), never redrafted.
  keepPending(brief, op, words)
  const made = words ? await createInWords(brief, op) : await writes.create(brief, op)
  // An answer that names no scenario (unreadable, or JSON null) may still have been saved: uncertain, never "nothing saved" (00054 #4).
  if (typeof made?.scenario !== 'string' || !/^s_[0-9a-f]+$/.test(made.scenario)) throw new TeamApiError(0, UNCERTAIN_WRITE, true)
  // Words-start (Codex root 04:07:06Z #1): the first message's receipt (the brief, its op) is saved for the named scenario BEFORE the brief's
  // receipt is dropped and before any read, so a close or reload in between still finds the brief to send, by that same op.
  const mop = firstMessageOp(op)
  if (words) keepPendingTurn(made.scenario, brief, mop)
  dropPending(op)
  const derived = derivedUuidOf(made.scenario)
  if (derived === null) throw new TeamApiError(502, 'Olumi made the scenario but named it in a way this page cannot open. Reload the page.')
  // The page moved away while the answer was on its way, even if it has since come back (A → B → A): it moves nothing (review 00002).
  if (pageMoves !== left || useCanvasStore.getState().currentScenarioId !== uuid) return
  useCanvasStore.setState(scenarioIdWrite(useCanvasStore.getState().currentScenarioId, derived))
  setCurrentScenarioId(derived)
  try { window.history.replaceState(window.history.state, '', `/#/scenario/${derived}`) } catch { /* the address bar keeps its old address */ }
  await useViewStore.getState().use(derived)
  if (words) {
    // The brief is sent ONCE as the first message, under its op saved above (as any message's), so a reload or a lost acceptance asks core
    // again by that op. If it does not go through, the words go back in this scenario's box with that op and core's
    // own words, so one press sends the same message again; the person never types it again.
    try { await writes.message(made.scenario, brief, mop); dropPendingTurn(mop) } catch (e) {
      const said = e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.'
      if (useViewStore.getState().uuid === derived) useViewChat.setState({ text: brief, said, ops: new Map(useViewChat.getState().ops).set(opKey(derived, 'message', brief), mop) })
      throw e
    }
  }
  // The central brief box goes away when a draft starts. Take this writer to the ordinary follow-up composer, wherever they keep Olumi.
  const opened = useViewStore.getState()
  if (opened.uuid === derived && useCanvasStore.getState().currentScenarioId === derived && (words || opened.view?.draft?.status === 'drafting')) revealOlumiSurface()
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

/** The scenario on screen is drafting its first model in core (core API v1.26: the View's `draft`, the job's state in core's words). */
export const isDrafting = (view: View | null): boolean => view?.draft?.status === 'drafting'
/** A turn on the scenario on screen is being answered in core (core API v1.28: the View's `turn`); Send waits until it has answered. */
export const isAnswering = (view: View | null): boolean => view?.turn?.status === 'answering'

/** A message sent whose acceptance has not come back yet: kept in this tab per person, as a brief is, so a reload asks core again by the SAME op. */
const PENDING_TURN = (person: string) => `olumi-pending-turn:${person}`
function keepPendingTurn(sid: string, text: string, op: string, about: string | null = null, press: PressKind | null = null): void {
  const me = pendingPerson()
  if (me === null) return
  try { sessionStorage.setItem(PENDING_TURN(me), JSON.stringify(about === null ? { sid, text, op } : press === null ? { sid, text, op, about } : { sid, text, op, about, press })) } catch { /* no storage: the op lives only in this page */ }
}
function dropPendingTurn(op: string): void {
  const me = pendingPerson()
  if (me === null) return
  try { if (pendingTurn(me)?.op === op) sessionStorage.removeItem(PENDING_TURN(me)) } catch { /* nothing kept */ }
}
/** This person's message still waiting for core's acceptance in this tab, if any: its scenario, words and op. */
export function pendingTurn(person: string): { sid: string; text: string; op: string; about: string | null; press?: PressKind } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING_TURN(person)) ?? 'null') as { sid?: unknown; text?: unknown; op?: unknown; about?: unknown; press?: unknown } | null
    // `about` (the card the message was about) is optional: a record kept before it existed restores as a plain message, as it was sent.
    return v !== null && typeof v.sid === 'string' && /^s_[0-9a-f]+$/.test(v.sid) && typeof v.text === 'string' && v.text.trim() !== '' && typeof v.op === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v.op)
      ? { sid: v.sid, text: v.text, op: v.op, about: typeof v.about === 'string' && v.about !== '' ? v.about : null, ...(v.press === 'explain' || v.press === 'ask_about' ? { press: v.press } : {}) } : null
  } catch { return null }
}
/**
 * After a reload, a message whose acceptance never came back is put back in the box with the op it was sent with, so Send asks core again
 * by that op: core answers a replay with the turn it already has (never a second answer), or takes it as new if it never arrived. It is
 * never dropped because the View shows the same words, which may be someone else's or an earlier message of theirs (Codex review 07 #5).
 * Reloading sends nothing.
 */
export function restorePendingTurn(): boolean {
  const me = pendingPerson(), { uuid, sid, view } = useViewStore.getState()
  if (me === null || sid === null || view === null) return false
  const p = pendingTurn(me)
  if (p === null || p.sid !== sid) return false
  if (useViewChat.getState().text !== '' || useViewChat.getState().busy) return false
  // A message about a card comes back about that card (Codex 008, 18 Nov): the card is selected again, so the composer shows its subject and
  // Send asks core again with the same card and the same op. A card no longer in the model: the words come back alone, under a new op.
  const about = p.about !== null && view.model?.cards.some((c) => c.id === p.about) ? p.about : null
  if (p.about !== null && about === null) { useViewChat.setState({ text: p.text, said: ABOUT_GONE }); return true }
  // A press comes back as that press (Codex HOLD 03:05:28Z): the same words sent unchanged resend its kind, card and op; changed words are the
  // person's own message, about no card unless they pick one (an edited prefill is their message, typed fields 13b (b)).
  if (p.press !== undefined && about !== null) {
    useViewChat.setState({ text: p.text, pressBack: { text: p.text, about, press: p.press, uuid, person: me }, ops: new Map(useViewChat.getState().ops).set(opKey(uuid, `message:${about}:${p.press}`, p.text), p.op) })
    return true
  }
  if (about !== null) useCanvasStore.setState({ selection: { nodeIds: new Set([about]), edgeIds: new Set(), anchorPosition: null } })
  useViewChat.setState({ text: p.text, ops: new Map(useViewChat.getState().ops).set(opKey(uuid, about === null ? 'message' : `message:${about}`, p.text), p.op) })
  return true
}
/** Said when a message put back after a reload was about a card the model no longer holds (Codex 008 P2): it goes as a new message, about no card. */
export const ABOUT_GONE = 'The card this message was about is no longer in the model, so it will be sent without it.'
/** Try again on a plain message that ended unanswered (failed or lost): the same words, under a new op. A challenge, method question, move
 *  or evidence to consider is asked again from its own control, so it keeps what it was (Codex review 07 #4); it never becomes words. */
export function sayAgain(): Promise<boolean> {
  const { sid, view } = useViewStore.getState()
  const t = view?.turn
  if (sid === null || t == null || t.status === 'answering' || t.said === null || t.ask !== 'message') return Promise.resolve(false)
  const said = t.said
  // A pressed message is asked again as the same press about the same card (typed fields 13b, Codex ROOT 02:53:03Z): core's `turn.press`;
  // where core says the card is gone (null), neither goes, and the words are a plain message, as with ABOUT_GONE.
  const p = pressFieldOf(t)
  // A plain message sent about a card keeps that card too (typed fields 13b: core's `turn.about`, null where this reader's model lacks it, absent
  // where it was about none or on an older core, which sends it about none as before).
  const was = (t as { about?: unknown }).about
  const card = p !== null ? p.card : typeof was === 'string' ? was : null
  const about = card !== null && view?.model?.cards.some((c) => c.id === card) ? card : null
  return write('turn-again', `${sid}:${t.job}`, (op) => writes.message(sid, said, op, about, about === null || p === null ? null : p.kind))
}

/** A brief sent whose answer has not named its scenario yet: kept in this tab (sessionStorage) under the person's id, never another's. */
const PENDING = (person: string) => `olumi-pending-brief:${person}`
const pendingPerson = (): string | null => useMe.getState().me?.id ?? null
function keepPending(brief: string, op: string, words = false): void {
  const me = pendingPerson()
  if (me === null) return
  try { sessionStorage.setItem(PENDING(me), JSON.stringify({ brief, op, ...(words ? { words: true } : {}) })) } catch { /* no storage: the op lives only in this page */ }
}
function dropPending(op: string): void {
  const me = pendingPerson()
  if (me === null) return
  try { if (pendingBrief(me)?.op === op) sessionStorage.removeItem(PENDING(me)) } catch { /* nothing kept */ }
}
/** This person's brief still waiting for core's answer in this tab, if any: its words and the op it was sent with. */
export function pendingBrief(person: string): { brief: string; op: string; words?: true } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING(person)) ?? 'null') as { brief?: unknown; op?: unknown; words?: unknown } | null
    return v !== null && typeof v.brief === 'string' && v.brief.trim() !== '' && typeof v.op === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v.op) ? { brief: v.brief, op: v.op, ...(v.words === true ? { words: true as const } : {}) } : null
  } catch { return null }
}
/**
 * After a reload, a brief whose answer never arrived is put back in the box with the op it was sent with, so Send asks core again by that op:
 * the same scenario and job when core had it (a replay never drafts again), a first draft only when it never arrived. Reloading alone
 * sends nothing.
 */
export function restorePendingBrief(): boolean {
  const me = pendingPerson(), { uuid, sid, view } = useViewStore.getState()
  if (me === null || sid !== null || !takesBrief(sid, view) || useViewChat.getState().text !== '' || useViewChat.getState().busy) return false
  const p = pendingBrief(me)
  if (p === null) return false
  // A brief sent to start in words keeps that choice and its op (Codex root 03:42:17Z): the same words sent again replay that start.
  useViewChat.setState({ text: p.brief, wordsBrief: p.words === true ? p.brief : null, ops: new Map(useViewChat.getState().ops).set(opKey(uuid, p.words === true ? 'brief-words' : 'brief', p.brief), p.op) })
  return true
}

/** Try again (core API v1.26): a new attempt on the scenario's saved brief after its first draft failed, was lost or was stopped, under a new op. */
export function tryAgain(): Promise<boolean> {
  const { sid, view } = useViewStore.getState(), status = view?.draft?.status
  if (sid === null || (status !== 'failed' && status !== 'lost' && status !== 'stopped')) return Promise.resolve(false)
  return write('redraft', `${sid}:${view!.draft!.job ?? ''}`, (op) => writes.redraft(sid, op))
}

/**
 * "Build a model from this" (DL 06:0xZ; Codex UI review 05:44:59Z): core's offer to draft a model from the reasoning so far (the conversation with
 * its writers, revealed views, kept ideas as Olumi's provisional ones). Core sends ONE View field shaped as `draft.stop` ({ label, title }) only
 * where a press would draft from the current reasoning; the page draws the offer only then, in core's words, and never decides it itself.
 * The path is core's (sx-team 06:11:29Z): top-level `build_model: { label, title }`, absent everywhere else; BUILD_FIELD is the one place it is read.
 */
export const BUILD_FIELD = 'build_model'
export function buildOfferOf(view: View | null): { label: string; title: string } | null {
  const b = view === null ? undefined : (view as unknown as Record<string, unknown>)[BUILD_FIELD] as { label?: unknown; title?: unknown } | null | undefined
  return b != null && typeof b.label === 'string' && b.label.trim() !== '' && typeof b.title === 'string' ? { label: b.label, title: b.title } : null
}
/** The press: the same write as Try again (POST …/draft, its op kept until core has it), only while core offers it; the first model then drafts
 *  on the DraftingBoard as any first draft, and its proposal is reviewed as any other. */
export function buildModel(): Promise<boolean> {
  const { sid, view } = useViewStore.getState()
  if (sid === null || buildOfferOf(view) === null) return Promise.resolve(false)
  return write('build', sid, (op) => writes.redraft(sid, op))
}

/** Stop (core API v1.34): only while core offers it (`draft.stop`, the draft's author, while it drafts); then the View is read again. */
export function stopDraft(): Promise<boolean> {
  const { sid, view } = useViewStore.getState(), d = view?.draft
  if (sid === null || d?.status !== 'drafting' || d.stop == null || typeof d.job !== 'number') return Promise.resolve(false)
  const job = d.job
  return act(() => writes.stopDraft(sid, job))
}

/** Core holds no model and no proposal for this scenario (none yet, or its first draft was set aside): a message is a new brief (00052 #6). */
// A scenario that already holds a kept idea is under way: what the person sends there is a message about it (core answers a message on a
// scenario with no model in words, turns.ts chat floor), never a new brief that would start another scenario (Codex 008e).
const holdsKept = (view: View): boolean => { const k = (view as { kept?: unknown }).kept; return Array.isArray(k) && k.length > 0 }
/** A scenario started in words: core's own `start: "words"` in the View, read from the stored header (words-start CONTRACT 3, revised 03:55Z),
 *  so it holds before the first reply and after any reopen. Never inferred from what is absent. What the person sends there is a message in that
 *  scenario, answered on the floor, never a new brief. */
export const startedInWords = (view: View | null): boolean => view !== null && (view as { start?: unknown }).start === 'words'
export const takesBrief = (sid: string | null, view: View | null) => sid === null || (view !== null && view.version === null && view.proposal === null && !onFloor(view) && !holdsKept(view) && !startedInWords(view))

const opKey = (uuid: string | null, kind: string, text: string) => `${uuid ?? '-'}\u0000${kind}\u0000${text}`

/** One write of `text`, with its op id kept until core has it; true when it went through. `uuid`: the scenario it belongs to (the page's). */
export async function write(kind: string, text: string, f: (op: string) => Promise<unknown>, changesModel = false, uuid = useViewStore.getState().uuid): Promise<boolean> {
  const key = opKey(uuid, kind, text)
  const op = useViewChat.getState().ops.get(key) ?? newOp()
  useViewChat.setState({ ops: new Map(useViewChat.getState().ops).set(key, op) })
  const sent = await act(() => f(op), changesModel)
  if (sent) { const left = new Map(useViewChat.getState().ops); left.delete(key); useViewChat.setState({ ops: left }) }
  return sent
}

/** Words to core: a new brief while it holds no model for this scenario, else a message. */
export function say(text: string, words = false, about: string | null = selectedRecord(), press: PressKind | null = null): Promise<boolean> {
  const { uuid, sid, view } = useViewStore.getState()
  if (sid !== null) closeUntouchedCommit(sid)
  // A message while its first model drafts is a message to THIS scenario (onFloor), never a second scenario: core answers it, or refuses it in its own words.
  return takesBrief(sid, view) ? write(words ? 'brief-words' : 'brief', text, (op) => startScenario(text, op, uuid, words))
    // The card the composer shows as "About: <card>" goes with the words, by id (core candidate 8); the same words about another card are another write.
    // A press's kind (typed fields 13b) goes only with its card; the same words pressed differently are another write.
    : ((about, kind) => write(about === null ? 'message' : `message:${about}${kind === null ? '' : `:${kind}`}`, text, async (op) => { keepPendingTurn(sid!, text, op, about, kind); const r = await writes.message(sid!, text, op, about, kind); dropPendingTurn(op); return r }))(about, about === null ? null : press)
      // A new message starts a new exchange: the last save's receipt and comparison stand down (they followed the thread's newest line).
      .then((sent) => { if (sent) useModelNotice.setState({ notice: null }); return sent })
}

/**
 * The held challenge a Send resends: only the one made in the scenario on screen, and only for its own words. A challenge held for another
 * scenario is neither resent here (the address guard, `team/api.ts`, would refuse it) nor dropped: it waits for its own scenario.
 */
export function resendOf(held: ViewChatState['held'], text: string, here: string | null): { readonly again: ViewChatState['held']; readonly drop: boolean } {
  const mine = held !== null && held.uuid === here ? held : null
  const again = mine !== null && mine.text === text ? mine : null
  return { again, drop: mine !== null && again === null }
}

export async function send(pressedWords = false): Promise<void> {
  const { text, held, wordsBrief, pressBack } = useViewChat.getState()
  if (text.trim() === '') return
  const words = pressedWords || (wordsBrief != null && wordsBrief === text)
  // A press put back is resent as that press only on its own scenario, for its own person, with its words unchanged (Codex 6afc8c1a); anywhere
  // else the same words are an ordinary message.
  const back = pressBack != null && pressBack.text === text && pressBack.uuid === useViewStore.getState().uuid && pressBack.person === pendingPerson() ? pressBack : null
  const { again, drop } = resendOf(held, text, useViewStore.getState().uuid)
  if (drop) useViewChat.setState({ held: null })
  if (!(await (again !== null ? challenge(again.kind, again.record, again.text, again) : back !== null ? say(text, words, back.about, back.press) : say(text, words)))) return
  if (useViewChat.getState().text === text) useViewChat.setState({ text: '', wordsBrief: null, pressBack: null })
}

/** The composer's one choice for a new brief (words-start, 17 Nov): build a model from it (Send, the default), or talk it through first. */
export const TALK_FIRST = 'Talk it through first'
export const TALK_FIRST_HOVER = 'Olumi answers in the conversation and does not build a model. You can keep its ideas.'

/**
 * A challenge on one card, to core's challenge route; one that does not go through is held for the same resend (`held`). A resend goes to
 * the scenario it was made in, with that scenario's op (review 00003 #2): it is the same write. Since Codex 006 #1 it is sent only while that
 * scenario is on screen (`resendOf`; the address guard refuses any other), and its words return to the composer when the page is back on it.
 */
/** The four challenge kinds core's challenge route takes (writes.challenge), as the chips and asks send them. */
export const CHALLENGE_KINDS = ['assumption', 'opposite', 'disconfirming', 'outside'] as const
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number]
/** Exported for the port's ChallengeCard "Respond" (DL 7 Nov, port ruling R3): the one write path for a challenge, unchanged. */
export async function challenge(kind: string, record: string, text: string, at = { sid: useViewStore.getState().sid, uuid: useViewStore.getState().uuid }): Promise<boolean> {
  const { sid, uuid } = at
  if (sid === null) return false
  const sent = await write(`challenge:${kind}:${record}`, text, (op) => writes.challenge(sid, kind, record, op), false, uuid)
  useViewChat.setState({ held: sent ? null : { text, kind, record, sid, uuid } })
  return sent
}

/**
 * What the team came for (core `POST …/goal`, canon wave step 1): one of the View's goal ids, or null to clear it. No AI call and no change
 * to the model; core orders the menu by it. One write at a time, with its op id, then the View read again (its `session` then says it).
 */
export async function chooseGoal(goal: string | null): Promise<boolean> {
  const { sid, uuid } = useViewStore.getState()
  if (sid === null) return false
  return write('goal', goal ?? '', (op) => writes.goal(sid, goal, op), false, uuid)
}

/**
 * One plain question from the menu (core `POST …/method`): core answers it as one turn on the challenges' path. It may propose a change,
 * which is held for the person's approval like any other proposal (core 7035, Codex 18 Nov; it was once discussion-only). Its reply lands as the newest turn when the View is read again, as a
 * challenge's does. The same press after a dropped connection is sent with the same op id, so core answers (and pays) once.
 */
export async function askMethod(method: string): Promise<boolean> {
  const { sid, uuid, view } = useViewStore.getState()
  if (sid === null) return false
  // "What could go wrong?" and the pre-mortem name the one option card selected (core's named route, rule 1); none or several selected sends none.
  const option = (method === 'go_wrong' || method === PRE_MORTEM) && view !== null ? optionInFocusOf(view, useCanvasStore.getState().selection.nodeIds) : null
  let refused = false
  const sent = await write('method', option === null ? method : `${method}:${option}`, async (op) => {
    try { return await writes.method(sid, method, op, option ?? undefined) } catch (e) { if (method === PRE_MORTEM && e instanceof TeamApiError && e.status === 409) refused = true; throw e }
  }, false, uuid)
  if (refused) await openPreMortemEntry()
  return sent
}

/** The pre-mortem move (core's `session.methods` id, and the coach's next move). */
const PRE_MORTEM = 'pre_mortem'

/**
 * A tap on the pre-mortem move while the person's gate is closed is core's `409` with the gate sentence, and no AI call. The tap opens the entry
 * instead (the "If it failed" key, where core's question, their box and "Show me Olumi's now" are drawn): the View is read again first, so a gate that has
 * opened since (another tab) shows Olumi's stories rather than the entry. The composer carries nothing: the refusal is not a message to correct.
 */
async function openPreMortemEntry(): Promise<boolean> {
  useViewChat.setState({ said: null })
  await useViewStore.getState().refresh()
  if (useViewStore.getState().view?.session?.pre_mortem?.state !== 'closed') return false
  useViewLens.setState({ lens: 'premortem' })
  return true
}

const toGate = (said: string | null): void => usePreMortemGate.setState({ said })

/**
 * "Write mine first" (core `POST …/pre-mortem`): their own reasons, one per line (core takes 1 to `max_reasons`, each up to `max_chars`; it refuses the rest in
 * its own words, said in the entry). Then the View is read again: the gate is open for them, and Olumi's stories show. No AI call.
 */
export async function giveReasons(): Promise<boolean> {
  const { sid } = useViewStore.getState(), { text } = usePreMortemGate.getState()
  if (sid === null) return false
  const reasons: string[] = []
  for (const line of text.split('\n')) { const r = line.trim(); if (r !== '') reasons.push(r) }       // their own sentences, as typed: nothing of the View's
  const sent = await act(() => writes.preMortem(sid, reasons), false, toGate)
  if (sent) usePreMortemGate.setState({ text: '' })
  return sent
}

/** "Show me Olumi's now" (core `POST …/pre-mortem/show`): a logged choice, no reasons written; then the View is read again. */
export async function showOlumisNow(): Promise<boolean> {
  const { sid } = useViewStore.getState()
  if (sid === null) return false
  return act(() => writes.preMortemShow(sid), false, toGate)
}

/** The menu item core sends while it offers "Let us give our figure first" (API.md): a press opens its entry, never POST …/method. */
export const FIGURE_FIRST = FIGURE_FIRST_ID

/**
 * Open the blind entry (`GET …/figure-first`, a read that writes nothing), keeping core's headings from the View (the show answer has none).
 * Opened again when the View moves on while it is open (ViewChat), keeping what was typed. A refused read says core's words in the panel.
 */
export async function openFigureFirst(): Promise<boolean> {
  const { sid, uuid, view } = useViewStore.getState()
  if (sid === null || view === null) return false
  const keep = useFigureFirst.getState().uuid === uuid ? {} : { typed: '', text: '' }
  useFigureFirst.setState({ ...keep, uuid, reading: true, said: null, shown: null, headings: figureFirstOf(view)?.headings ?? null })
  try {
    const entry = await writes.figureFirstEntry(sid)
    if (entry === null || typeof entry !== 'object' || typeof entry.quantity !== 'string' || typeof entry.version !== 'number' || typeof entry.heading !== 'string'
      || typeof entry.question !== 'string' || typeof entry.ask !== 'string' || typeof entry.note !== 'string' || typeof entry.show !== 'string') throw new TeamApiError(0, VIEW_SHAPE_CHANGED)
    if (useViewStore.getState().uuid !== uuid) return false
    useFigureFirst.setState({ entry, signature: view.signature, reading: false })
    return true
  } catch (e) {
    useFigureFirst.setState({ entry: null, signature: null, reading: false, said: e instanceof TeamApiError ? e.message : READ_FAILED })
    return false
  }
}

const toPanel = (said: string | null): void => useFigureFirst.setState({ said })

/**
 * Their figure and their words for the offered quantity (`POST …/figure-first { quantity, version, text, typed }`), the quantity and version
 * the entry was read with; the figure goes as typed and core reads it (or refuses in the card's ask, said in the panel). One write at a time,
 * then the View read again: it then holds their figure beside Olumi's, and the entry closes.
 */
export async function giveFigureFirst(): Promise<boolean> {
  const { sid } = useViewStore.getState(), { entry, typed, text } = useFigureFirst.getState()
  if (sid === null || entry === null) return false
  const sent = await act(() => writes.figureFirstGive(sid, entry.quantity, entry.version, text, typed), false, toPanel)
  if (sent) useFigureFirst.setState({ entry: null, signature: null, typed: '', text: '' })
  return sent
}

/** "Show me Olumi's figure instead" (`POST …/figure-first/show { quantity, version }`): Olumi's figure and basis, drawn under the headings kept. */
export async function showOlumiFigure(): Promise<boolean> {
  const { sid } = useViewStore.getState(), { entry, headings } = useFigureFirst.getState()
  if (sid === null || entry === null) return false
  let got = null as FigureFirstShown | null
  const sent = await act(async () => {
    const r = await writes.figureFirstShow(sid, entry.quantity, entry.version)
    if (r === null || typeof r !== 'object' || typeof r.olumi?.text !== 'string' || typeof r.olumi.title !== 'string' || typeof r.olumi.basis !== 'string') throw new TeamApiError(0, VIEW_SHAPE_CHANGED)
    got = r
  }, false, toPanel)
  if (sent && got !== null) useFigureFirst.setState({ entry: null, signature: null, shown: { ...got, headings }, typed: '', text: '' })
  return sent
}

export const closeFigureFirst = () => useFigureFirst.setState({ ...FIGURE_FIRST_CLOSED })

/** Bring a panel of the Olumi tab into view once drawn (a press is seen to be answered). */
export const bringIntoView = (from: Element | null, testid: string) =>
  requestAnimationFrame(() => from?.closest('[data-testid="view-chat"]')?.querySelector(`[data-testid="${testid}"]`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }))

type Next = NonNullable<ViewTurn['answer']>['next']
/** The one key for a refused move (sid, turn, move); the Journey's Next step press uses it too, so the two never disagree. */
export const moveKey = (sid: string, turn: number, move: string) => `${sid}\u0000${turn}\u0000${move}`

/**
 * The coach's next move, taken in one tap (R2 W1; DL 16:36Z): a structured choice `{ move, at }`, never words, through the same write as a
 * message (one op id, then the View read again). The person's turn is what core records for it (the move's label); `next.text`, Olumi's
 * own words to the person, is never sent as theirs. A move core refuses as no longer the newest (409) re-reads the View, and its tap is
 * dropped, not retried.
 */
async function takeMove(turn: number, next: Next): Promise<boolean> {
  const { sid, uuid } = useViewStore.getState()
  if (sid === null) return false
  let stale = false
  const sent = await write(`move:${next.move}`, String(turn), async (op) => {
    // Core's one-turn-at-a-time refusal is a 409 too, told apart by its code (`turn_busy`): that move is still offered, so it is never dropped.
    try { return await writes.move(sid, next.move, next.at, op) } catch (e) { if (e instanceof TeamApiError && e.status === 409 && e.code !== 'turn_busy') stale = true; throw e }
  }, false, uuid)
  // The pre-mortem tap with the gate closed is also a 409: it opens the entry; any other 409 is the stale move below.
  if (stale && next.move === PRE_MORTEM && await openPreMortemEntry()) return sent
  if (stale) {
    useViewChat.setState({ gone: moveKey(sid, turn, next.move) })
    await useViewStore.getState().refresh()
  }
  return sent
}

/** Whether a move is drawn as a press at all (the same test MoveTap makes): a session, a real move, and not one core refused as stale. */
export const moveTapDrawn = (sid: string | null, next: Next, gone: boolean): boolean => sid !== null && isRealMove(next.move) && !gone

/** The newest reply's move as one tap, in the shell's button, with core's label for it. `arrow` (the Analysis tab's "Suggested next
 *  step", as the previous PoC drew it): the same tap as a round arrow, core's label as its name and hover. */
export function MoveTap({ turn, next, arrow = false, primary = false, at }: { turn: number; next: Next; arrow?: boolean; /** Drawn as the filled primary button, under the newest reply (14 Nov: the reply's next move is not tucked away). */ primary?: boolean; /** Where the label sits in the View, for a surface that binds every word to its path. */ at?: string }) {
  const sid = useViewStore((s) => s.sid)
  const busy = useViewChat((s) => s.busy), gone = useViewChat((s) => s.gone ?? null)
  if (!moveTapDrawn(sid, next, sid !== null && gone === moveKey(sid, turn, next.move))) return null
  return (
    arrow
      ? <button type="button" data-testid="view-next-move" data-move={next.move} disabled={busy} onClick={() => void takeMove(turn, next)} aria-label={next.label} title={next.label}
          className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-full ${controls.act}`}><OkIcon id="move-tap" size={16} decorative /></button>
      : <div><Button size="sm" variant={primary ? 'primary' : 'secondary'} data-testid="view-next-move" data-move={next.move} disabled={busy} onClick={() => void takeMove(turn, next)}>{at === undefined ? next.label : <span data-view={`${at}.label`}>{next.label}</span>}</Button></div>
  )
}

/** core's four challenges (API `POST …/challenge` `kind`), by the press's chip id. */
const CHALLENGES: Readonly<Record<string, ChallengeKind>> = { 'ask:challenge': 'assumption', 'ask:method-opposite': 'opposite', 'ask:falsify': 'disconfirming', 'ask:method-outside-view': 'outside' }

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
  // A press is about ITS OWN card (the ask's target, else the selection), never whatever the canvas selected since: the same `record`; with
  // it, what kind of press it was (typed fields 13b: Explain, else a one-card ask), sent as the page's own prefill, unedited.
  const pressed = pressKindFor(chip, record)
  // A press that did not go through keeps its whole identity for the unchanged words (Codex 037cbe59 report): Send from the message box resends
  // the same press about the same card under the same op (write() keeps it until core has it); changed words are the person's own message.
  // Made for the scenario and person on screen now; a failure that settles after the page has moved on writes nothing (keptIfNotSent's `at`).
  const at = useViewStore.getState().uuid, who = pendingPerson()
  return say(opts.message, false, record, pressed).then((sent) => {
    if (!sent && pressed !== null && record !== null && useViewStore.getState().uuid === at && pendingPerson() === who) useViewChat.setState({ pressBack: { text: opts.message, about: record, press: pressed, uuid: at, person: who } })
    return sent
  })
}

/** An ask made while a write is in flight: its words wait in the composer, never lost or sent twice (review 00055). */
export const STILL_ANSWERING = 'Olumi is still answering. Your words are in the message box: send them once it has.'
/** Words from the canvas the person can still send: put after whatever the composer already holds, never over it (review 00056). An EMPTY box takes them as `prefilled`. */
const keep = (text: string): void => {
  const now = useViewChat.getState().text
  if (now.split('\n').includes(text)) return
  const empty = now.trim() === ''
  useViewChat.setState({ text: empty ? text : `${now}\n${text}`, prefilled: empty ? text : null })
}
const keptWhileBusy = (text: string): boolean => {
  if (!useViewChat.getState().busy && !isAnswering(useViewStore.getState().view)) return false
  keep(text)
  useViewChat.setState({ said: STILL_ANSWERING })
  return true
}
/** An ask from the canvas that did not go through (core refused it, or its answer never came) keeps its words beside core's sentence. */
const keptIfNotSent = (text: string, at = useViewStore.getState().uuid) => (sent: boolean) => { if (!sent && useViewStore.getState().uuid === at) keep(text) }

/**
 * The canvas's ask path with its own result (Codex ROOT HOLD 01:11:46Z): the same guards as `_dispatchAction` (while Olumi is still answering
 * the words wait in the message box; an ask that does not go through keeps its words, for the scenario it was made in), returning the write's
 * actual result, so a deliberate press elsewhere on the page (Team's "Ask Olumi about this difference") can say sent or not sent truthfully.
 */
export function askOnPress(opts: Press): Promise<boolean> {
  if (keptWhileBusy(opts.message)) return Promise.resolve(false)
  const kept = keptIfNotSent(opts.message)
  return press(opts).then((sent) => { kept(sent); return sent })
}

/** The canvas's asks, answered by this writer: one set for the page, so every holder registers the same functions. */
const ASKS = {
  _sendMessage: withOlumiReveal((text: string) => { if (!keptWhileBusy(text)) void say(text).then(keptIfNotSent(text)) }),
  // A prefill from a card (v10's Olumi corner: "About <card>:") is put after whatever the person has typed, never over it (Codex review
  // dgai-v10 00002 #1: the corner on every card must not delete a draft).
  _prefillChat: withOlumiReveal((text: string) => { keep(text) }),
  _dispatchAction: withOlumiReveal((opts: Press) => { void askOnPress(opts) }),
  _isConversationBusy: () => useViewChat.getState().busy,
}
/**
 * The selection chip's Ask on this lane (menu brief UI-D, 18 Nov; Codex 23:56Z: a generic Ask is prefilled and never auto-sent). It was not
 * drawn at all: its legacy sender is never registered here. It starts the person's own question about that card in the message box, after
 * whatever they have typed, as a card's Olumi corner does; they finish it and send it.
 */
export const askAboutSelection = (s: { label: string }): void => { keep(`About ${s.label}: `); document.getElementById('view-chat-text')?.focus() }
/** The one card of the model the canvas has selected: null for none, several, or a node the model does not hold. Bound by id. */
const selectedRecord = (): string | null => {
  const ids = [...useCanvasStore.getState().selection.nodeIds], view = useViewStore.getState().view
  return ids.length === 1 && view?.model?.cards.some((c) => c.id === ids[0]) ? ids[0]! : null
}
armedIntent.cancel = () => { if ((useViewChat.getState().armed ?? null) !== null) useViewChat.setState({ armed: null }) }
/** Fixed chrome, said in the composer while a challenge waits for its card. */
export const PICK_A_CARD = 'pick a card on the canvas. Esc cancels.'
/** Core's typed challenge on ONE card of the model (the route a card's own Challenge uses). The words are only what returns to the box if it is not sent. */
function challengeCard(kind: ChallengeKind, record: string): void {
  useViewChat.setState({ armed: null })
  const label = useViewStore.getState().view?.model?.cards.find((c) => c.id === record)?.heading ?? ''
  const words = `${V10_METHODS.find((m) => m.key === kind)!.prefix}${label}`
  if (keptWhileBusy(words)) return
  void challenge(kind, record, words).then(keptIfNotSent(words))
  focusNodeById(record)
}
/**
 * "Challenge this idea" on an idea kept ON the model (a record of its form: menu brief UI-E, 18 Nov): core's typed challenge on that record,
 * the opposite case. Its words return to the box only if it is not sent. An idea kept before approval (a `kept:` row) has no record: the panel
 * puts its question in the box instead.
 */
export function challengeIdea(record: string, words: string): void {
  if (keptWhileBusy(words)) return
  void challenge('opposite', record, words).then(keptIfNotSent(words))
}

/**
 * A press on one of the composer's four challenge icons (menu brief UI-A, 18 Nov). They used to paste a prefix into the box, which nothing
 * read. Now: words already typed are still the person's own subject (the prefix goes before them, as before, and they send it); with an
 * empty box the challenge is core's typed one on the selected card, or (no single card selected) it waits for the next card picked. A
 * second press on a waiting icon, or Esc, cancels it. Any change Olumi proposes from it is held for the person's approval.
 */
export function pressChallenge(kind: ChallengeKind): 'prefixed' | 'sent' | 'armed' | 'cancelled' {
  const { text, armed } = useViewChat.getState()
  if (text.trim() !== '') { useViewChat.setState({ armed: null, text: withMethodPrefix(V10_METHODS.find((m) => m.key === kind)!.prefix, text) }); return 'prefixed' }
  if (armed === kind) { useViewChat.setState({ armed: null }); return 'cancelled' }
  const record = selectedRecord()
  if (record === null) { useViewChat.setState({ armed: kind }); return 'armed' }
  challengeCard(kind, record)
  return 'sent'
}
/** While a challenge waits: the next single card picked gets it; Esc, words typed or put in the box, or another scenario on screen, cancels it. */
export function useArmedChallenge(): ChallengeKind | null {
  const armed = useViewChat((st) => st.armed ?? null)
  useEffect(() => {
    if (armed === null) return undefined
    const at = useViewStore.getState().uuid
    const pick = () => {
      if (useViewChat.getState().armed !== armed) return
      if (useViewStore.getState().uuid !== at) { useViewChat.setState({ armed: null }); return }
      if (useViewChat.getState().busy) return // Olumi is still answering: the challenge keeps waiting, never turned into a plain message
      // Words in the box are a new intent (Codex 008, 18 Nov): the waiting challenge stands down and the words stay.
      if (useViewChat.getState().text.trim() !== '') { useViewChat.setState({ armed: null }); return }
      const record = selectedRecord()
      if (record !== null) challengeCard(armed, record)
    }
    const typed = (st: ViewChatState, was: ViewChatState) => { if (st.armed === armed && st.text !== was.text && st.text.trim() !== '') useViewChat.setState({ armed: null }) }
    const off = useCanvasStore.subscribe(pick), offView = useViewStore.subscribe(pick), offChat = useViewChat.subscribe(typed)
    return () => { off(); offView(); offChat() }
  }, [armed])
  // The waiting challenge is the Escape floor: any open surface closes first, whenever it opened; the next press cancels the wait.
  useEscapeFloor(armed !== null, () => useViewChat.setState({ armed: null }))
  return armed
}

/** A question from a kept idea (Codex 008e #2): put in the message box after whatever is typed, never sent; the person edits and sends it. */
export const prefillComposer = (text: string): void => {
  const f = useGuidanceStore.getState()._prefillChat
  if (f !== null) f(text)
  else { keep(text); revealOlumiSurface() }
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
