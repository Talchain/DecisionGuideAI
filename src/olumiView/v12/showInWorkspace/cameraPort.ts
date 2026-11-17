/**
 * The one camera port between "Show in the workspace" and the canvas. This folder calls no React Flow hook: the canvas registers this port
 * once (the canvas owner's hunk: `registerShowCameraPort(makeShowCameraPort({...}))`, canvasSide.ts) and everything here goes through it.
 * With no canvas on the page nothing is registered, and the control is not drawn.
 *
 * It also holds THE ONE PREDICATE the canvas's own framing reads, `showHolds()`: true while a show or a return is rearranging the board,
 * so the board's framing (a badge opening or closing, a resize) leaves the camera alone until it is done.
 *
 * This file imports nothing of the board, so the canvas can import it without a cycle.
 */
import { useSyncExternalStore } from 'react'

export interface Viewport { readonly x: number; readonly y: number; readonly zoom: number }
export interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface Pane { readonly size: { readonly w: number; readonly h: number }; readonly inset: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number } }

/** The same free canvas: its size and its four insets. */
export const samePane = (a: Pane | null, b: Pane | null): boolean =>
  a === b || (a !== null && b !== null && a.size.w === b.size.w && a.size.h === b.size.h && a.inset.left === b.inset.left && a.inset.top === b.inset.top && a.inset.right === b.inset.right && a.inset.bottom === b.inset.bottom)

export interface ShowCameraPort {
  /** The camera now, and whether the person holds it (their own pan, zoom or a control they pressed; the board does not refit under it). */
  capture(): { readonly viewport: Viewport; readonly held: boolean }
  /**
   * True once the canvas holds exactly the cards the View now draws, each measured and in the same place for two frames, with no layout
   * running. False when `signal` aborts. A state, not a delay: it never resolves on a timer alone.
   */
  settled(signal: AbortSignal): Promise<boolean>
  /** The box around these nodes, in the board's own coordinates; null until every one of them is on the canvas and measured. */
  boxOf(ids: readonly string[]): Box | null
  /** The free canvas (the pane less the dock and the header), as the board's own framing reads it; null with no pane on the page. */
  pane(): Pane | null
  /** Move the camera as the person's own move: pending pans stand down and the board's own framing leaves it alone afterwards. */
  moveTo(to: Viewport, opts: { readonly duration: number }): void
  /** Hand the camera back to the board: its own framing of the board now on screen, asked for once. */
  refit(): void
  /**
   * Hold the board's own framing off until the release is called (always, in a `finally`). The release takes what "the person holds the
   * camera" should read afterwards: true after a show that moved the camera or unfolded something; after a return, true where it changed
   * the open badges (the board's framing must not replace the camera it put back), else the value captured before the show; and null
   * from a run that something newer overtook, which must write nothing.
   */
  hold(): (held: boolean | null) => void
}

let port: ShowCameraPort | null = null
const listeners = new Set<() => void>()
const tell = (): void => { for (const l of [...listeners]) l() }

/** The canvas registers its port while it is on the page; the function returned takes it away (only if it is still the one registered). */
export function registerShowCameraPort(p: ShowCameraPort): () => void {
  port = p
  tell()
  return () => { if (port === p) { port = null; tell() } }
}

export const showCameraPort = (): ShowCameraPort | null => port

/** Told whenever a canvas registers or leaves. */
export function onShowCameraPort(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l) } }
/** Whether a canvas is there to show cards in. */
export const useHasShowCamera = (): boolean => useSyncExternalStore(onShowCameraPort, () => port !== null, () => false)

let holds = 0
/**
 * THE ONE PREDICATE for the canvas's framing: a show or a return is rearranging the board, so the board's own framing waits. It is put
 * off, never dropped: when the hold ends the framing loop goes on, and frames the board unless the person (or the show for them) holds
 * the camera. The canvas's resize refit cannot wait (it is an effect, not a loop): it is skipped while this is true, and the port makes
 * it good when the last hold ends (canvasSide.ts `hold`).
 */
export const showHolds = (): boolean => holds > 0
/** One hold (canvasSide.ts). The function returned ends it once and says whether this call was the one that ended it. */
export function takeShowHold(): () => boolean {
  holds += 1
  let open = true
  return () => { if (!open) return false; open = false; holds -= 1; return true }
}
