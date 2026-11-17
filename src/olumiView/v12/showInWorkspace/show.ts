/**
 * "Show in the workspace" and "Return to where you were": the two sequences, each cancellable. No AI call and nothing is written to the
 * model: opening a badge is a new READ of the View (store.ts `setOpened`); everything else is this page's own view state.
 *
 * SHOW     snapshot (the first one stands across further shows) → hold the board's own framing → open what is folded and AWAIT the read
 *          → wait for the board to settle → resolve the reply's ids AGAIN on the View now (and open, once, a fold of Simple's that a
 *          card the badge handed out stands behind) → step aside only a layer, lens or selection
 *          that would set a target back (and settle again if the layer changed: a layer's notes change card heights) → where something
 *          was unfolded and the person does not hold the camera, the board frames itself, and says where to → move the camera, as
 *          the person's own move, only if the cards will not be whole in view there → pulse the cards once → release the hold.
 * RETURN   cancel anything pending → hold → put back layer, lens, folds and badges and AWAIT the read → wait for the board to settle
 *          → put back the selection and the camera → release the hold with "the person holds the camera" as it was before the show
 *          (or held, where putting the badges back changed the board: its own framing must not replace the camera just put back).
 *
 * Nothing is announced that did not happen: a read that fails moves nothing and says so, in core's own words where it gave any. A first
 * show that fails leaves nothing behind. A run that something newer overtook writes nothing more, whenever it finishes. A snapshot whose
 * reader, scenario, version, level or canvas is no longer the one on screen is discarded with whatever was pending; nothing of it is
 * restored.
 */
import { create } from 'zustand'
import { onShowCameraPort, samePane, showCameraPort, type ShowCameraPort, type Viewport } from './cameraPort'
import { VIEW_CARD, levelOf, openBadgesKeyOf, pulseCards, setGroupOpen, setInputsOpen, useCanvasStore, useInputsOpen, useLayer, useSimpleLevel, useViewLens, useViewStore, type View } from './deps'
import { noteUnfolded, restoreLocal, restoreSelection, restoreStores, scopeOf, takeSnapshot, type Snapshot } from './snapshot'
import { activeLayerOf, cameraFor, layerFor, lensSetsBack, planShow, selectionSetsBack, type BoardNow, type Next } from './targets'

/** Chrome words, said only where core gave none of its own for the read that failed. Each says what did not happen and what to do next. */
export const COULD_NOT_SHOW = 'That could not be shown just now. Try again.'
export const COULD_NOT_RETURN = 'That did not go back just now. Try again.'

/** The camera's move to the cards, as a new reply's own move takes (replyInView.ts); none under reduced motion. */
export const MOVE_MS = 300
/** The most moves one show makes: the first, and one more each time the board laid itself out again for the zoom it was moved to. */
export const MAX_MOVES = 3
/** The longest the board is waited for. A board that has not settled by then is a failure that is said, never a move made anyway. */
export const SETTLE_MS = 8000

interface Shown {
  /** The reply whose cards are shown (or are being shown): its control is the one that reads "Return to where you were". */
  readonly turn: number | null
  readonly busy: boolean
  /** What to say under a reply's control after a show or a return that did not happen. */
  readonly said: { readonly turn: number; readonly words: string } | null
}
export const useShown = create<Shown>(() => ({ turn: null, busy: false, said: null }))

interface Run { readonly ctl: AbortController; readonly kind: 'show' | 'return'; readonly turn: number | null; readonly fresh: boolean; readonly was: number | null }
let snapshot: Snapshot | null = null
/** The canvas the snapshot was taken on: a camera kept for one canvas is never put on another. */
let snapshotPort: ShowCameraPort | null = null
let run: Run | null = null
let unpulse: (() => void) | null = null
let pulseTimer: ReturnType<typeof setTimeout> | null = null
let unwatch: (() => void) | null = null

const boardNow = (sid: string | null): BoardNow => ({ sid, level: levelOf(sid), inputsOpen: useInputsOpen.getState().open })
const scopeNow = (): string => { const s = useViewStore.getState(); return scopeOf(s, levelOf(s.sid)) }
const reducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const frames = (n: number): Promise<void> => new Promise((done) => {
  const step = (left: number): void => { if (left <= 0) done(); else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => step(left - 1)); else setTimeout(() => step(left - 1), 16) }
  step(n)
})

function clearPulse(): void {
  if (pulseTimer !== null) { clearTimeout(pulseTimer); pulseTimer = null }
  unpulse?.()
  unpulse = null
}

function forget(): void {
  snapshot = null
  snapshotPort = null
  unwatch?.()
  unwatch = null
}

/**
 * The snapshot no longer belongs to what is on screen: cancel what is pending and let it go. Nothing is restored. A show that was on its
 * way when this happened did not happen, and its reply says so.
 */
function discard(): void {
  const pending = run !== null && run.kind === 'show' ? run.turn : null
  run?.ctl.abort()
  run = null
  clearPulse()
  forget()
  useShown.setState({ turn: null, busy: false, said: pending === null ? null : { turn: pending, words: COULD_NOT_SHOW } })
}

/** While a snapshot is held: the reader, scenario, version, level and canvas are watched, and a change to any discards it. */
function watch(): void {
  unwatch?.()
  const check = (): void => { if (snapshot !== null && (scopeNow() !== snapshot.scope || showCameraPort() !== snapshotPort)) discard() }
  const offs = [useViewStore.subscribe(check), useSimpleLevel.subscribe(check), onShowCameraPort(check)]
  unwatch = () => { for (const off of offs) off() }
}

/** Open Simple's folds a plan asks for (each is shut now, or the plan would not ask), and note them for the return. */
function unfold(sid: string, what: { readonly inputs: boolean; readonly groups: readonly string[] }): void {
  if (snapshot !== null) noteUnfolded(snapshot, what)
  if (what.inputs) setInputsOpen(sid, true)
  for (const g of what.groups) setGroupOpen(sid, g)
}

/** The board settled, or false: aborted, or not settled within SETTLE_MS (told apart by the signal). */
async function settledWithin(port: ShowCameraPort, signal: AbortSignal): Promise<boolean> {
  const inner = new AbortController()
  const stop = (): void => inner.abort()
  signal.addEventListener('abort', stop, { once: true })
  const timer = setTimeout(stop, SETTLE_MS)
  try { return await port.settled(inner.signal) } finally { clearTimeout(timer); signal.removeEventListener('abort', stop) }
}

/**
 * Step aside only what would set a target back: the layer, the lens, a selection in Simple. Each is in the snapshot and goes back on
 * return. True when the LAYER changed: its notes on the cards change their heights, so the board lays out again.
 */
function stepAside(view: View | null, sid: string | null, cards: readonly string[]): boolean {
  const active = activeLayerOf(view, sid, useLayer.getState())
  const layer = layerFor(view, active, cards) !== active
  if (layer) useLayer.setState({ layer: 'full', sid })
  if (lensSetsBack(view, useViewLens.getState().lens, cards)) useViewLens.setState({ lens: 'full' })
  const canvas = useCanvasStore.getState()
  const selected = canvas.nodes.find((n) => n.selected === true && n.type === VIEW_CARD)?.id ?? null
  if (selectionSetsBack(view?.model ?? null, levelOf(sid), selected, cards)) canvas.clearSelection()
  return layer
}

/**
 * Show the cards a reply is about. Does nothing with no canvas on the page or when nothing the reply names is in the reader's View.
 * Resolves when the cards are in view, when it failed (and said so), or when something newer took over.
 */
export async function showInWorkspace(turn: number, next: Next | null): Promise<void> {
  const port = showCameraPort()
  const st = useViewStore.getState()
  const plan = planShow(st.view, next, boardNow(st.sid))
  if (port === null || plan === null) return
  run?.ctl.abort()
  clearPulse()
  const scope = scopeNow()
  if (snapshot !== null && (snapshot.scope !== scope || snapshotPort !== port)) discard()
  const fresh = snapshot === null
  if (fresh) { snapshot = takeSnapshot(port, scope); snapshotPort = port; watch() }
  const mine: Run = { ctl: new AbortController(), kind: 'show', turn, fresh, was: useShown.getState().turn }
  run = mine
  const signal = mine.ctl.signal
  useShown.setState({ turn, busy: true, said: null })
  const release = port.hold()
  let held = port.capture().held
  let failed: string | null = null, overtaken = false
  try {
    if (st.sid !== null) unfold(st.sid, plan)
    if (plan.open.length > 0) {
      const opened = useViewStore.getState().opened, open = new Map(opened.open)
      for (const b of plan.open) open.set(b.host, b.records)
      const ok = await useViewStore.getState().setOpened({ open, all: opened.all })
      if (signal.aborted) return
      if (!ok) {
        // No words from core means the read did not fail: a newer read overtook it (the person opened or closed a badge themselves, or
        // the page read again). Theirs stands; this show did not happen.
        const error = useViewStore.getState().error
        overtaken = error === null
        failed = error ?? COULD_NOT_SHOW
        return
      }
    }
    if (!(await settledWithin(port, signal))) { if (!signal.aborted) failed = COULD_NOT_SHOW; return }
    // Resolved again, on the View core has now sent: what was a record behind a badge may be a card of its own.
    let now = useViewStore.getState()
    let again = planShow(now.view, next, boardNow(now.sid))
    // A card a badge has just handed out may itself stand behind one of Simple's folds (a note in its row's group, an input among the
    // folded inputs). Those open now, once, and the ids are resolved a last time. Only after a badge opened: a fold this show had
    // already asked for and that is still shut did not land, and that is a failure, not a second try.
    if (again !== null && plan.open.length > 0 && again.open.length === 0 && (again.inputs || again.groups.length > 0) && now.sid !== null) {
      unfold(now.sid, again)
      if (!(await settledWithin(port, signal))) { if (!signal.aborted) failed = COULD_NOT_SHOW; return }
      now = useViewStore.getState()
      again = planShow(now.view, next, boardNow(now.sid))
    }
    if (again === null || again.open.length > 0 || again.inputs || again.groups.length > 0) { failed = COULD_NOT_SHOW; return }
    const cards = again.cards
    if (stepAside(now.view, now.sid, cards)) {
      await frames(2) // the layer's notes leave the cards on the next paint; only then can the board be seen to settle again
      if (signal.aborted) return
      if (!(await settledWithin(port, signal))) { if (!signal.aborted) failed = COULD_NOT_SHOW; return }
    }
    // What the show unfolded made the board another board, and the board frames it, as it does for any change of its own: always
    // after a badge opened, which the canvas frames whoever held the camera; after the inputs or a row's group opened, where the
    // person does not hold it. The canvas says where it is framing to, so ONE move is made: the board's own where the cards will be
    // whole in view there, else straight to the cards from that frame (a board too tall for the room is framed at its top, and the
    // cards may be below it; framing first and moving after was two moves in a row, seen served at 1500 x 904, 17 Nov).
    let framing: Viewport | null = null
    if (plan.open.length > 0 || ((plan.inputs || plan.groups.length > 0) && !held)) {
      framing = port.refit()
      held = false
      if (framing === null) {
        // A canvas that does not say where it framed: wait for its framing to land and read the camera then.
        await frames(2)
        if (signal.aborted) return
        if (!(await settledWithin(port, signal))) { if (!signal.aborted) failed = COULD_NOT_SHOW; return }
      }
    }
    const box = port.boxOf(cards), pane = port.pane()
    if (box === null) { failed = COULD_NOT_SHOW; return }
    const still = reducedMotion()
    // A camera the show moved is the person's own choice: the board does not refit under it.
    // A move that changes the zoom can make the board lay itself out again (Detailed draws its cards for the zoom they are seen at), and
    // the cards are then somewhere else. So after EVERY such move, once the board is still, the cards are looked for again on the camera
    // the canvas really has (it may not have taken the zoom asked for), and the camera goes the rest of the way: at most MAX_MOVES
    // moves in all (seen served on Detailed at 1232 x 704, 17 Nov: the camera arrived where the card had been). A move that only pans
    // changes no layout and is the last. The cap is not proof of showing (Codex, 17 Nov): cards that cannot be found again, or that
    // are still not whole in view after the last move allowed, were NOT shown, and that is said and undone like any failed show.
    let from = framing ?? port.capture().viewport
    let to = pane === null ? null : cameraFor(box, pane, from)
    let movedAt: number | null = null
    for (let moves = 1; to !== null; moves += 1) {
      port.moveTo(to, { duration: still ? 0 : MOVE_MS })
      movedAt = performance.now()
      held = true
      if (to.zoom === from.zoom) break
      await frames(2)
      if (signal.aborted) return
      if (!(await settledWithin(port, signal))) { if (!signal.aborted) failed = COULD_NOT_SHOW; return }
      const where = port.boxOf(cards), room = port.pane()
      if (where === null || room === null) { failed = COULD_NOT_SHOW; return }
      from = port.capture().viewport
      to = cameraFor(where, room, from)
      if (to !== null && moves >= MAX_MOVES) { failed = COULD_NOT_SHOW; return }
    }
    // The cards are pulsed once the camera has arrived: after the last move the show made, or after the board's own framing.
    const arrives = still ? 0 : movedAt !== null ? Math.max(0, MOVE_MS + 20 - (performance.now() - movedAt)) : framing !== null ? MOVE_MS + 20 : 0
    pulseTimer = setTimeout(() => { pulseTimer = null; if (!signal.aborted) unpulse = pulseCards(cards) }, arrives)
    useShown.setState({ turn, busy: false, said: null })
  } finally {
    // Overtaken by the person's own read: the board is theirs now and so is the canvas's word on who holds the camera. Nothing is written.
    release(signal.aborted || overtaken ? null : held)
    if (run === mine) run = null
    if (failed !== null) await undo(mine, failed, overtaken)
  }
}

/** A show that did not happen. A first show leaves nothing behind (everything goes back); a later one leaves the earlier show standing. */
async function undo(mine: Run, words: string, overtaken: boolean): Promise<void> {
  if (mine.turn === null || run !== null) return // something newer has taken over: it owns what is on screen
  const said = { turn: mine.turn, words }
  if (!mine.fresh) { useShown.setState({ turn: mine.was, busy: false, said }); return }
  if (overtaken) {
    // The badges are as the newer read left them and stay so; only what this show changed of the page's own goes back.
    if (snapshot !== null) restoreLocal(snapshot)
    clearPulse()
    forget()
    useShown.setState({ turn: null, busy: false, said })
    return
  }
  await returnToBefore()
  // Said only when the return went through (or the snapshot was let go): a return that failed has said so itself, and stands.
  if (run === null && snapshot === null) useShown.setState({ said })
}

/** Put the person back where they were before the first show. Cancels a show still on its way. */
export async function returnToBefore(): Promise<void> {
  const snap = snapshot
  run?.ctl.abort()
  clearPulse()
  if (snap === null) { run = null; useShown.setState({ turn: null, busy: false }); return }
  const port = showCameraPort()
  if (port === null || port !== snapshotPort || scopeNow() !== snap.scope) { discard(); return }
  const turn = useShown.getState().turn
  const mine: Run = { ctl: new AbortController(), kind: 'return', turn, fresh: false, was: turn }
  run = mine
  const signal = mine.ctl.signal
  useShown.setState({ busy: true, said: null })
  const release = port.hold()
  let held = port.capture().held
  const notBack = (words: string): void => { useShown.setState({ busy: false, said: turn === null ? null : { turn, words } }) }
  try {
    const boardWas = openBadgesKeyOf(useViewStore.getState().view)
    const ok = await restoreStores(snap)
    if (signal.aborted) return
    if (!ok) { notBack(useViewStore.getState().error ?? COULD_NOT_RETURN); return }
    if (!(await settledWithin(port, signal))) { if (!signal.aborted) notBack(COULD_NOT_RETURN); return }
    restoreSelection(snap)
    // A camera the board had framed, for a pane that has since changed size (the dock opened or closed), is the board's to frame again.
    // Otherwise the camera goes back exactly, and a camera already there is not touched. Where putting the badges back changed the open
    // badges (the one part of the canvas's framing key, ViewCanvas `version`: board, open badges, level, that a return can change; a new
    // board or level discards the snapshot first, scopeOf), the canvas's framing of it is waiting on this return: the camera just put
    // back is then kept as the person's (as the canvas's own reveal-return keeps it), so that framing does not replace it. With the
    // open badges unchanged, "the person holds the camera" is as it was before the show.
    if (!snap.held && !samePane(snap.pane, port.pane())) { port.refit(); held = false }
    else {
      const now = port.capture().viewport
      if (now.x !== snap.viewport.x || now.y !== snap.viewport.y || now.zoom !== snap.viewport.zoom) port.moveTo(snap.viewport, { duration: 0 })
      held = openBadgesKeyOf(useViewStore.getState().view) !== boardWas ? true : snap.held
    }
    forget()
    useShown.setState({ turn: null, busy: false, said: null })
  } finally {
    release(signal.aborted ? null : held)
    if (run === mine) run = null
  }
}

/**
 * A reply's control has left the page. A show of its own still on its way is cancelled: a first show goes back whole (nothing is left
 * half-open with no control to return from); a later one stops where it is and the earlier show stands.
 */
export function leave(turn: number): void {
  const r = run
  if (r === null || r.kind !== 'show' || r.turn !== turn) return
  if (r.fresh) { void returnToBefore(); return }
  r.ctl.abort()
  run = null
  useShown.setState({ turn: r.was, busy: false })
}

/** For specs: nothing shown, nothing pending, no snapshot. */
export function resetShow(): void {
  run?.ctl.abort()
  run = null
  clearPulse()
  forget()
  useShown.setState({ turn: null, busy: false, said: null })
}
