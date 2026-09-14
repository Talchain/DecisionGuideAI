import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Eye,
  Hand,
  Layers,
  Plus,
  Undo2,
  Redo2,
  MousePointer2,
} from 'lucide-react'
import Tooltip from '../Tooltip'
import styles from './CanvasFloatingToolbar.module.css'
import { LensDropdown } from '../../canvas/components/LensDropdown'
import { LENS_TOGGLE_EVENT } from '../../canvas/hooks/useCanvasKeyboardShortcuts'
import { showCanvasUndoUnavailableNotice } from '../../canvas/useKeyboardShortcuts'
import { useCanvasStore } from '../../canvas/store'
import { useComparisonStore } from '../../canvas/stores/comparisonStore'
import { isGraphLensEnabled } from '../../flags'

/** Custom event: request all open menus to close (except the source). */
export const MENU_EXCLUSIVE_EVENT = 'menu:exclusive'

interface LeftSidebarProps {
  /** Current interaction mode (select vs hand/pan via keyboard) */
  interactionMode?: 'select' | 'hand'
  /** Called when user clicks select button to switch to select mode */
  onSelectClick?: () => void
  // Canvas control actions
  onUndoClick?: () => void
  onRedoClick?: () => void
  // Disabled states
  canUndo?: boolean
  canRedo?: boolean
  /**
   * ⚠ TWO DIFFERENT QUESTIONS, NAMED APART ON PURPOSE — collapsing them is
   * the bug. `canUndo` answers *"would clicking perform an undo right now?"*
   * and is false for an empty history, which is an ordinary, temporary state
   * that a greyed button describes perfectly well. These answer *"does this
   * canvas have an undo capability at all?"* — a standing fact about the
   * build, not about the session. Only the second warrants explaining itself,
   * and only the second may make the button reachable.
   */
  undoUnavailable?: boolean
  redoUnavailable?: boolean
  /**
   * ⭐⭐ THE ONLY VISIBLE DOOR TO AUTHORING YOUR OWN MODEL.
   *
   * Omitted, no button renders — the caller decides whether this build has a
   * durable node-add carrier, and it decides by reading
   * `CANONICAL_EDIT_AUTHORITY.canvasNodeAddWithServerHash`, NOT the blanket
   * `canvasSemanticMutations` that gates undo/redo above. Those are two
   * different questions (CLAUDE.md trap 21) and `contextMenu/useMenuItems.ts`
   * already separated them for this exact gesture on 13 Sep 2026. This surface
   * had not been given the same treatment because it had no add control at all.
   *
   * ⚠ NO KEYBOARD SHORTCUT IS ADVERTISED, for the reason recorded at the undo
   * button: the Command Palette's `setShowCommandPalette` is never called
   * true, so there is no shortcut to name and naming one would be a live
   * promise of a key that does nothing.
   */
  onAddToModelClick?: (anchor: { x: number; y: number }) => void
}

export function LeftSidebar({
  interactionMode = 'select',
  onSelectClick,
  // Canvas controls
  onUndoClick,
  onRedoClick,
  canUndo = true,
  canRedo = true,
  undoUnavailable = false,
  redoUnavailable = false,
  onAddToModelClick,
}: LeftSidebarProps) {
  const [lensOpen, setLensOpen] = useState(false)
  const viewBtnRef = useRef<HTMLButtonElement | null>(null)
  const addBtnRef = useRef<HTMLButtonElement | null>(null)

  /**
   * ⭐ THE ANCHOR IS THE BUTTON'S OWN RECT, so the menu opens where the user
   * clicked rather than at a guessed point. Falls back to the sidebar's known
   * left edge if the ref has not attached (it always has by click time; the
   * fallback exists so the handler is total rather than conditional).
   */
  const handleAddClick = useCallback(() => {
    if (!onAddToModelClick) return
    const rect = addBtnRef.current?.getBoundingClientRect()
    onAddToModelClick(
      rect
        ? { x: Math.round(rect.right + 8), y: Math.round(rect.top) }
        : { x: 72, y: 120 },
    )
  }, [onAddToModelClick])

  // Standard/Detailed view toggle
  const viewMode = useCanvasStore(s => s.viewMode)
  const setViewMode = useCanvasStore(s => s.setViewMode)

  const lensEnabled = isGraphLensEnabled()

  // Toggle lens + dispatch mutual exclusion event (used by both click and L key)
  const handleLensToggle = useCallback(() => {
    setLensOpen(prev => {
      const next = !prev
      if (next) {
        window.dispatchEvent(new CustomEvent(MENU_EXCLUSIVE_EVENT, { detail: { source: 'lens' } }))
      }
      return next
    })
  }, [])

  // Listen for L key toggle event from useCanvasKeyboardShortcuts
  useEffect(() => {
    window.addEventListener(LENS_TOGGLE_EVENT, handleLensToggle)
    return () => window.removeEventListener(LENS_TOGGLE_EVENT, handleLensToggle)
  }, [handleLensToggle])

  // Close lens dropdown when comparison mode hides the chip
  const comparisonActive = useComparisonStore(s => s.comparisonMode.active)
  useEffect(() => {
    if (comparisonActive) setLensOpen(false)
  }, [comparisonActive])

  // Close lens dropdown when another menu claims exclusivity
  useEffect(() => {
    const handler = (e: Event) => {
      const source = (e as CustomEvent).detail?.source
      if (source !== 'lens') setLensOpen(false)
    }
    window.addEventListener(MENU_EXCLUSIVE_EVENT, handler)
    return () => window.removeEventListener(MENU_EXCLUSIVE_EVENT, handler)
  }, [])

  const isDetailed = viewMode === 'expert'

  return (
    <nav
      className={styles.sidebar}
      aria-label="Canvas tools"
    >
      {/* ⭐⭐ AUTHORING GROUP — THE ONLY VISIBLE DOOR TO ADDING SOMETHING YOURSELF.
          It leads the toolbar because it is the only control here that changes
          the MODEL; everything below changes the VIEW of it.

          ⛔ WHY IT DID NOT EXIST, MEASURED. A founder session on 2026-09-14
          (debug export `44e349fa`, UI `ab6ae8a6`) ran 30 minutes and 18 turns
          and used ZERO canvas affordances — every action in its log is a chat
          message or a chip. The durable node-add was authorised and reachable
          the whole time: `canvasNodeAddWithServerHash` is `'server_graph'`, the
          pane context menu's `add-node` items were unblocked on 13 Sep, and the
          CEE-stamped `graph_hash` the carrier requires was on his wire
          (`40fe96a9…`). It was reachable ONLY by right-clicking empty canvas,
          which is to say it was reachable only by someone who already knew.
          His two attempts to author went through chat and both returned CEE's
          catch-all refusal.

          ⭐ A DOOR NOBODY CAN SEE IS NOT A DOOR. This is the same gesture, the
          same action and the same authority as the context-menu item — it is
          standing chrome rather than a menu you must first think to open.

          ⚠ IT OPENS THE EXISTING MENU RATHER THAN ADDING DIRECTLY, deliberately.
          The kinds on offer are derived in `contextMenu/useMenuItems.ts` from
          `WIRE_ADDABLE_NODE_KINDS` minus `SINGULAR_NODE_KINDS`, and re-deciding
          that list here would be a second derivation of one fact — the
          hand-maintained mirror this estate keeps paying for (trap 12). One
          menu, one authority, two ways in. */}
      {onAddToModelClick && (
        <div className={styles.group}>
          <Tooltip content="Add to model">
            <button
              ref={addBtnRef}
              type="button"
              className={styles.iconButton}
              aria-label="Add to model"
              aria-haspopup="menu"
              data-testid="canvas-add-to-model"
              onClick={handleAddClick}
            >
              <Plus className={styles.icon} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Manipulation group: Select, Undo, Redo */}
      <div className={styles.group}>
        <Tooltip content={interactionMode === 'select' ? 'Hand mode (H)' : 'Select mode (V)'}>
          <button
            type="button"
            className={interactionMode === 'select' ? styles.iconButtonActive : styles.iconButton}
            aria-label={interactionMode === 'select' ? 'Switch to Hand mode' : 'Switch to Select mode'}
            aria-pressed={interactionMode === 'select'}
            onClick={onSelectClick}
          >
            {interactionMode === 'select' ? (
              <MousePointer2 className={styles.icon} aria-hidden="true" />
            ) : (
              <Hand className={styles.icon} aria-hidden="true" />
            )}
          </button>
        </Tooltip>

        {/* ⚠ NO KEYBOARD SHORTCUT IS NAMED HERE, AND THAT IS THE POINT.
            These tooltips once read "Undo (⌘Z)" / "Redo (⌘⇧Z)" while both
            shortcuts were dead: `useKeyboardShortcuts` gates its undo and redo
            branches on `hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY
            .canvasSemanticMutations)`, an authority fixed at `'disabled'`. The
            tooltip is reachable even on a disabled button, because `Tooltip`
            attaches its hover reference to a WRAPPER div, so that was a live
            promise of a key that does nothing.
            Do not re-add a shortcut here until the shortcut works.

            ⭐ WHAT CHANGED, AND WHY THE BUTTONS ARE NO LONGER GREY.
            The tooltip repair left the second half of the same false promise
            standing: `ReactFlowGraph` passes `canUndo={
            CANVAS_SEMANTIC_MUTATIONS_CONNECTED && canUndo()}`, which folds to
            `false`, so the owner saw a permanently greyed control and read it
            — correctly — as "there is nothing to undo yet". There is no undo
            at all, which is a different sentence, and the button was the last
            surface still declining to say it.

            The keyboard already answers this gesture rather than swallowing
            it (`useKeyboardShortcuts`, the `!canMutateSharedModel` branch), so
            these buttons now answer it the SAME way, through the SAME
            function — no new copy, no second branch to keep in step.

            ⚠ TWO IN-TREE PRECEDENTS POINT OPPOSITE WAYS AND THE CHOICE IS
            DELIBERATE — do not "tidy" this back to a disabled button. The
            context menu DELETES its undo/redo entries outright; the keyboard
            ANSWERS the gesture. The distinction is discoverability: a menu
            entry is only ever seen by someone who opened the menu, so
            removing it removes the promise with it. A sidebar button is
            standing chrome — it has already been seen, and has already set
            the expectation that undo exists here. Deleting it would answer
            the owner's question by hiding it; greying it answers by implying
            an emptiness that is not the reason. Answering is right here.

            ⚠ `undoUnavailable`, NOT `!canUndo`, DECIDES THIS. An empty
            history keeps the ordinary greyed button — see the props above.
            And the day `canvasSemanticMutations` becomes `'server_graph'`,
            the call site's flag folds the other way, this branch stops firing
            on its own and real undo takes over. There is no second place to
            remember to update. */}
        <Tooltip content="Undo">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Undo"
            onClick={undoUnavailable ? showCanvasUndoUnavailableNotice : onUndoClick}
            /* Reachable, so the sentence can be got at by click AND by
               keyboard — but never advertised as operable. `aria-disabled`
               carries that to assistive tech while leaving the control in the
               tab order, the same idiom `ApplyAndRerunButton` uses in
               `TornadoChart` for a control that is present and not operable.
               Native `disabled` cannot be used: it removes the button from
               the tab order and `pointer-events: none` would swallow the very
               click that explains the limitation. */
            aria-disabled={undoUnavailable ? true : undefined}
            disabled={undoUnavailable ? false : !canUndo}
          >
            <Undo2 className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        {/* Same reasoning as the Undo tooltip above — including the notice.
            ⚠ THIS IS NOT NEW COPY, IT IS THE SAME SENTENCE, and that is a
            derived result rather than a convenience: `isUndoRedoGesture`
            returns true for ⌘Y and ⌘⇧Z as well as ⌘Z, so the keyboard already
            answers BOTH halves of this gesture with
            `canvasUndoUnavailableNotice()`. There is no separate redo notice
            because the product has never needed one — the sentence names the
            capability that is absent and points at Version history, and both
            buttons are absent for exactly the same reason. Inventing a redo
            variant would be writing copy to fill a symmetry nothing asked
            for. */}
        <Tooltip content="Redo">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Redo"
            onClick={redoUnavailable ? showCanvasUndoUnavailableNotice : onRedoClick}
            aria-disabled={redoUnavailable ? true : undefined}
            disabled={redoUnavailable ? false : !canRedo}
          >
            <Redo2 className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* View group: Lens, Standard/Detailed */}
      <div className={styles.group}>
        {lensEnabled && (
          <Tooltip content="View (L)">
            <button
              ref={viewBtnRef}
              type="button"
              className={lensOpen ? styles.iconButtonActive : styles.iconButton}
              aria-label="Graph lens"
              aria-pressed={lensOpen}
              onClick={handleLensToggle}
            >
              <Layers className={styles.icon} aria-hidden="true" />
            </button>
          </Tooltip>
        )}

        <Tooltip content={isDetailed ? 'Detailed view' : 'Standard view'}>
          <button
            type="button"
            className={isDetailed ? styles.iconButtonActive : styles.iconButton}
            aria-label={isDetailed ? 'Detailed view' : 'Standard view'}
            aria-pressed={isDetailed}
            onClick={() => setViewMode(isDetailed ? 'standard' : 'expert')}
          >
            <Eye className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Lens dropdown — portaled, anchored to View button */}
      {lensEnabled && (
        <LensDropdown
          isOpen={lensOpen}
          onClose={() => setLensOpen(false)}
          onToggle={handleLensToggle}
          anchorRef={viewBtnRef}
          hideChip
        />
      )}
    </nav>
  )
}
