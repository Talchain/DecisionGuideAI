// src/canvas/useKeyboardShortcuts.ts
// Keyboard shortcuts for canvas

import { useEffect, useRef } from 'react'
import { useCanvasStore } from './store'
import { CANONICAL_EDIT_AUTHORITY, hasServerGraphAuthority } from './mutations/mutationAuthority'

export type InteractionMode = 'select' | 'hand'

/**
 * Single definition of "the user is typing into a text surface".
 *
 * Consumed by the keydown guard below AND by the canvas pointer-down focus
 * release in ReactFlowGraph. One definition, two consumers — deliberately not
 * two hand-maintained copies that can drift apart.
 */
export function isTextEntryElement(el: Element | null | undefined): boolean {
  if (!el) return false
  const node = el as HTMLElement
  const tag = node.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || node.isContentEditable === true
}

/**
 * Controls for which Space is a native activation key.
 *
 * Hold-to-pan is window-scoped, so without this guard it prevents Space from
 * clicking focused buttons and other controls anywhere around the canvas.
 * Keep this separate from `isTextEntryElement`: text focus and native control
 * activation have different pointer/shortcut semantics.
 */
export function isKeyboardActivationElement(el: Element | null | undefined): boolean {
  if (!el || typeof el.closest !== 'function') return false
  return el.closest([
    'button',
    'a[href]',
    'select',
    'summary',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    '[role="slider"]',
  ].join(',')) !== null
}

/**
 * The mode the canvas is ACTUALLY behaving in right now.
 *
 * `spaceHeld` is a transient hold-to-pan override (Figma grammar): while the
 * spacebar is down the canvas pans regardless of the persisted tool. Every
 * consumer that shows or acts on the mode must read this, never the raw
 * persisted `interactionMode` — L-01's first failure mode was precisely a
 * toolbar icon bound to the raw value while behaviour used the effective one,
 * so the icon and the pointer disagreed.
 */
export function resolveEffectiveInteractionMode(
  interactionMode: InteractionMode,
  spaceHeld: boolean,
): InteractionMode {
  return spaceHeld ? 'hand' : interactionMode
}

/**
 * True when a pointer-down on the canvas should release text-entry focus so
 * the canvas keyboard shortcuts (V/H, Delete, arrows, undo) become live again.
 *
 * Why this exists: the canvas composer is a `<textarea>`. Once it holds focus
 * it keeps it — clicking the graph pane does not move focus by itself — so
 * every single-key canvas shortcut stays inert while the user is manifestly
 * working on the canvas. That is the mechanism behind "Escape was needed":
 * Escape blurred the composer, and the shortcuts came back to life.
 *
 * The fix is to release focus when the user engages the canvas, NOT to let
 * single-key shortcuts fire inside text fields — typing "have" in the composer
 * must never flip the canvas into hand mode.
 *
 * Returns false when the pointer landed IN a text surface (the user is
 * clicking INTO a field, e.g. an on-node label editor, not away from one).
 */
export function shouldReleaseTextFocusOnCanvasPointerDown(
  target: Element | null | undefined,
  activeElement: Element | null | undefined,
): boolean {
  if (!isTextEntryElement(activeElement)) return false
  if (isTextEntryElement(target)) return false
  return true
}

/** Space, across `code`-capable browsers and `key`-only environments. */
function isSpaceKey(event: KeyboardEvent): boolean {
  return event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar'
}

/**
 * Modifier keys whose arrival invalidates any in-flight spacebar hold.
 *
 * macOS suppresses `keyup` for ordinary keys while Command is down, so a
 * "space down → Cmd down → space up → Cmd up" sequence never delivers the
 * space keyup and the hold leaks `true` forever: the canvas stays in pan mode
 * while the toolbar shows the select tool. Releasing the hold when a modifier
 * arrives (and again when one leaves) is the safe direction — the user loses a
 * transient pan, instead of being stranded in one.
 */
const HOLD_INVALIDATING_MODIFIERS = new Set(['Meta', 'Control', 'Alt', 'OS'])

/**
 * ⭐ THE ASYMMETRY THIS CLOSES, measured on the deployed build `daf6537a`.
 *
 * `CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations` is `'disabled'` — a
 * COMPILE-TIME CONSTANT, not a flag — so every branch below that reads
 * `canMutateSharedModel` is permanently inert. Meanwhile Delete/Backspace
 * carries no such gate. A user can therefore remove a node from their model
 * and then press the one key everybody reaches for, and get NOTHING: no
 * revert, no refusal, no message. Witnessed in a browser at the deployed
 * tip — `store.canUndo()` was `true`, `history.past.length` stayed 1, and
 * `history.future` stayed empty, with no toast of any kind.
 *
 * ⚠ THIS DOES NOT RE-ENABLE UNDO, AND MUST NOT BE CHANGED INTO SOMETHING
 * THAT DOES. `useHistoryToast`'s header records why the Undo action was
 * removed rather than rewired: a canvas history entry has no canonical
 * counterpart, and pointing it at `restoreModelVersion` would restore a
 * DIFFERENT object and "overwrite the working model for everyone with
 * access". Local undo has no return leg. That ruling stands.
 *
 * What changed is only that the gesture is ANSWERED instead of swallowed,
 * and answered with a route that genuinely exists: a durable delete reaches
 * CEE as a `structural_delete` turn, whose commit mints a
 * `committed_mutation` model version (`orchestrator-v5/commit.ts`
 * `buildAtomicCommittedModelVersion`), which `ServerVersionsSection` lists
 * and restores. "Version history" is rendered and ENABLED on the canvas in
 * two places while Undo sits disabled beside it — the recovery was already
 * there, with nothing connecting the moment of loss to it.
 *
 * ⚠ THE COPY DELIBERATELY SAYS "CHECK", NOT "YOUR VERSION IS THERE". The
 * version is minted when the turn COMMITS, not when the key is pressed, and
 * a guest or a purely local scratch graph gets no server version at all.
 * Asserting a restore point exists would be the confident-wrongness this
 * estate pays for; pointing at a real, reachable panel is true in every
 * state.
 */
export const CANVAS_UNDO_UNAVAILABLE_NOTICE =
  "Undo isn't available on the canvas. Check Version history to restore an earlier version of this model."

/**
 * True for the gestures a user makes when they mean "put that back":
 * Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Cmd/Ctrl+Y.
 *
 * Bound to the MODIFIED forms only. A bare `z` is a canvas key like any
 * other and must keep falling through — swallowing it would be the same
 * defect in the opposite direction.
 */
export function isUndoRedoGesture(key: string, cmdOrCtrl: boolean): boolean {
  if (!cmdOrCtrl) return false
  const lowered = key.toLowerCase()
  return lowered === 'z' || lowered === 'y'
}

/** Repeat window, so holding ⌘Z does not stack a column of identical toasts. */
const UNDO_NOTICE_QUIET_MS = 3000

interface KeyboardShortcutOptions {
  /** Callback to set interaction mode (select/hand) for V/H shortcuts */
  onModeChange?: (mode: InteractionMode) => void
  /** Callback for spacebar hold-to-pan (true on keydown, false on keyup) */
  onSpaceHeld?: (held: boolean) => void
}

export function useKeyboardShortcuts(options?: KeyboardShortcutOptions) {
  // Use ref to avoid recreating the handler when options change
  const optionsRef = useRef(options)
  optionsRef.current = options
  // Mirrors the consumer's spaceHeld so we only emit real transitions. Without
  // it the release paths below (modifiers, blur, visibilitychange) would fire
  // `false` repeatedly at a consumer that is already false.
  const spaceHeldRef = useRef(false)
  // Last time the "undo isn't available" notice was emitted, so a held or
  // repeatedly-pressed ⌘Z produces one message rather than a column of them.
  const lastUndoNoticeAtRef = useRef(0)
  // Fix: Use getState() inside handler to avoid dependency array issues.
  // Previously, all 12 action functions were in the dependency array, but
  // Zustand selectors return new function references on every render,
  // causing the effect to re-run and triggering render storms.
  // Using getState() inside the handler ensures we always get fresh state
  // without needing to list actions as dependencies.

  useEffect(() => {
    const emitSpaceHeld = (held: boolean) => {
      if (spaceHeldRef.current === held) return
      spaceHeldRef.current = held
      optionsRef.current?.onSpaceHeld?.(held)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey

      // A modifier arriving mid-hold invalidates the hold (see
      // HOLD_INVALIDATING_MODIFIERS). Runs BEFORE the text-entry guard: the
      // release path must not be gated on where focus happens to be.
      if (HOLD_INVALIDATING_MODIFIERS.has(event.key)) {
        emitSpaceHeld(false)
      }

      // Ignore if typing in an input.
      //
      // Deliberately asymmetric with the release paths: SETTING a hold or
      // changing tool from a text field would hijack typing, so it is guarded;
      // CLEARING is always safe, so keyup/blur/visibilitychange are not.
      const target = event.target as HTMLElement
      if (isTextEntryElement(target)) {
        return
      }

      // Get fresh state for each keydown - avoids stale closure issues
      const state = useCanvasStore.getState()
      const canMutateSharedModel = hasServerGraphAuthority(
        CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations,
      )

      // Answer the recovery gesture rather than swallowing it. Runs BEFORE the
      // undo/redo branches and fires only when they are inert, so the day
      // `canvasSemanticMutations` becomes `'server_graph'` this branch stops
      // firing on its own and real undo takes over — no second place to
      // remember to update.
      if (!canMutateSharedModel && isUndoRedoGesture(event.key, cmdOrCtrl)) {
        event.preventDefault()
        if (!event.repeat && Date.now() - lastUndoNoticeAtRef.current > UNDO_NOTICE_QUIET_MS) {
          lastUndoNoticeAtRef.current = Date.now()
          if (typeof window !== 'undefined') {
            // The canvas's canonical toast bridge — the same one the store's
            // delete refusal uses, listened to in ReactFlowGraph.
            window.dispatchEvent(new CustomEvent('topbar:show-toast', {
              detail: { message: CANVAS_UNDO_UNAVAILABLE_NOTICE, level: 'info' },
            }))
          }
        }
        return
      }

      // Undo: Cmd/Ctrl + Z
      if (canMutateSharedModel && cmdOrCtrl && event.key === 'z' && !event.shiftKey && state.canUndo()) {
        event.preventDefault()
        state.undo()
        return
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (canMutateSharedModel && ((cmdOrCtrl && event.key === 'z' && event.shiftKey) || (cmdOrCtrl && event.key === 'y'))) {
        if (state.canRedo()) {
          event.preventDefault()
          state.redo()
        }
        return
      }

      // Duplicate: Cmd/Ctrl + D
      if (canMutateSharedModel && cmdOrCtrl && event.key === 'd') {
        event.preventDefault()
        state.duplicateSelected()
        return
      }

      // Select All: Cmd/Ctrl + A
      if (cmdOrCtrl && event.key === 'a') {
        event.preventDefault()
        state.selectAll()
        return
      }

      // Copy: Cmd/Ctrl + C
      if (cmdOrCtrl && event.key === 'c') {
        event.preventDefault()
        state.copySelected()
        return
      }

      // Cut: Cmd/Ctrl + X
      if (canMutateSharedModel && cmdOrCtrl && event.key === 'x') {
        event.preventDefault()
        state.cutSelected()
        return
      }

      // Paste: Cmd/Ctrl + V
      if (canMutateSharedModel && cmdOrCtrl && event.key === 'v') {
        event.preventDefault()
        state.pasteClipboard()
        return
      }

      // Save Snapshot: Cmd/Ctrl + S
      if (cmdOrCtrl && event.key === 's') {
        event.preventDefault()
        state.saveSnapshot()
        return
      }

      // Delete: Delete or Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        state.deleteSelected()
        return
      }

      // V for Select mode (like Figma)
      if ((event.key === 'v' || event.key === 'V') && !cmdOrCtrl) {
        optionsRef.current?.onModeChange?.('select')
        return
      }

      // H for Hand/Pan mode (like Figma)
      if ((event.key === 'h' || event.key === 'H') && !cmdOrCtrl) {
        optionsRef.current?.onModeChange?.('hand')
        return
      }

      // Nudge with arrow keys
      const nudgeAmount = event.shiftKey ? 10 : 1
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        state.nudgeSelected(-nudgeAmount, 0)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        state.nudgeSelected(nudgeAmount, 0)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        state.nudgeSelected(0, -nudgeAmount)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        state.nudgeSelected(0, nudgeAmount)
        return
      }

      // Spacebar hold-to-pan: temporarily switch to hand mode (like Figma).
      // A hold started with a modifier already down would never receive its
      // keyup on macOS, so it is refused rather than leaked.
      if (isSpaceKey(event) && !event.repeat) {
        // Space belongs to the focused native/semantic control. Returning
        // without preventDefault preserves the browser's activation click.
        if (isKeyboardActivationElement(event.target as Element | null)) return
        event.preventDefault()
        if (event.metaKey || event.ctrlKey || event.altKey) return
        emitSpaceHeld(true)
        return
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      // Space released, or a modifier released after having swallowed the
      // space keyup. Both clear; clearing is idempotent via emitSpaceHeld.
      if (isSpaceKey(event) || HOLD_INVALIDATING_MODIFIERS.has(event.key)) {
        emitSpaceHeld(false)
      }
    }

    // Clear spacebar hold if window loses focus (prevents stuck state)
    const handleBlur = () => {
      emitSpaceHeld(false)
    }

    // Tab switch / window hide: some browsers deliver neither keyup nor blur,
    // so the hold would survive until the next space press.
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        emitSpaceHeld(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, []) // Empty deps - handler always gets fresh state via getState()
}
