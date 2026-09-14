/**
 * The sidebar's Undo/Redo buttons must ANSWER the gesture, not grey it out.
 *
 * ── WHY THIS PIN EXISTS ─────────────────────────────────────────────────────
 * `canvasSemanticMutations` is fixed at `'disabled'`, so `ReactFlowGraph`
 * passed `canUndo={CANVAS_SEMANTIC_MUTATIONS_CONNECTED && canUndo()}` — always
 * `false` — and both buttons were `disabled` in every session. The product
 * owner read that, correctly, as "there is nothing to undo yet". The truth is
 * that this canvas has no undo at all, which is a different sentence, and the
 * greyed button was the last surface on this gesture still declining to say
 * it. The keyboard has answered ⌘Z honestly since the `!canMutateSharedModel`
 * branch landed in `useKeyboardShortcuts`; these buttons now answer the same
 * way, through the same function.
 *
 * ⚠ BINDING BY IDENTITY, NOT BY VALUE. The expected message is obtained by
 * CALLING `canvasUndoUnavailableNotice()` — the sanctioned source — never by
 * copying its text into this file. A literal here would pass against a
 * byte-identical fabrication and would silently stop tracking the real
 * sentence the day its branch changes. The assertions additionally require the
 * message to be one of the two exported constants, so the identity check
 * cannot pass by both sides being empty (a value assertion that agrees with
 * itself proves nothing).
 *
 * ⚠ EVERY CASE HAS ITS OPPOSITE-DIRECTION TWIN. The two harms here cannot
 * share one predicate:
 *   · too NARROW — the button stays silent, the defect being fixed;
 *   · too WIDE  — the button answers when undo is genuinely AVAILABLE and
 *     merely has an empty history, which would replace a correct greyed
 *     control with a false claim that the capability is missing; or it
 *     performs a real `undo` while claiming to explain one.
 * A corpus pointing only in the first direction would go green on a fix that
 * opened the second.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeftSidebar } from '../LeftSidebar'
import {
  canvasUndoUnavailableNotice,
  CANVAS_UNDO_LOCAL_ONLY_NOTICE,
  CANVAS_UNDO_SHARED_VERSIONS_NOTICE,
} from '../../../canvas/useKeyboardShortcuts'

vi.mock('../../../flags', () => ({
  isGraphLensEnabled: () => false,
}))

/**
 * The authority this pin must prove is NOT consulted on the click path.
 * Spread the original rather than hand-listing exports: a `vi.mock` factory
 * REPLACES the module, and a hand-written allowlist goes stale in silence.
 */
// `vi.hoisted` because the mock factory below is hoisted above ordinary
// declarations, and `useCanvasKeyboardShortcuts` reads the authority at MODULE
// INIT — a plain `const` here fails at collect with "cannot access before
// initialization", which reports as zero tests rather than as a red.
const authorityValue = vi.hoisted(() => ({ current: 'disabled' as string }))
vi.mock('../../../canvas/mutations/mutationAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../canvas/mutations/mutationAuthority')>()
  return {
    ...actual,
    get CANONICAL_EDIT_AUTHORITY() {
      return { ...actual.CANONICAL_EDIT_AUTHORITY, canvasSemanticMutations: authorityValue.current }
    },
  }
})

const mockSetViewMode = vi.fn()
const storeState: Record<string, unknown> = {
  viewMode: 'standard',
  setViewMode: mockSetViewMode,
  comparisonMode: { active: false },
  currentScenarioId: null,
}
vi.mock('../../../canvas/store', () => {
  const useCanvasStore = (selector: (s: Record<string, unknown>) => unknown) => selector(storeState)
  // `canvasUndoUnavailableNotice` reads the scenario id through `getState`,
  // so a selector-only mock would throw inside the code under test.
  useCanvasStore.getState = () => storeState
  return { useCanvasStore }
})

/** Messages seen on the canvas's canonical toast bridge during one test. */
let toasts: string[] = []
function captureToast(event: Event) {
  const detail = (event as CustomEvent<{ message?: string }>).detail
  if (typeof detail?.message === 'string') toasts.push(detail.message)
}

beforeEach(() => {
  toasts = []
  authorityValue.current = 'disabled'
  window.addEventListener('topbar:show-toast', captureToast)
})

afterEach(() => {
  window.removeEventListener('topbar:show-toast', captureToast)
  vi.clearAllMocks()
})

/** The sanctioned sentence, resolved live rather than transcribed. */
function expectedNotice(): string {
  const notice = canvasUndoUnavailableNotice()
  // Guard the guard: an identity assertion against an empty or undefined
  // value would agree with anything.
  expect([CANVAS_UNDO_LOCAL_ONLY_NOTICE, CANVAS_UNDO_SHARED_VERSIONS_NOTICE]).toContain(notice)
  expect(notice.length).toBeGreaterThan(0)
  return notice
}

describe('LeftSidebar — the undo gesture is answered, not greyed out', () => {
  describe('when the canvas has no undo capability', () => {
    it('the Undo button is REACHABLE — not natively disabled', () => {
      render(<LeftSidebar canUndo={false} undoUnavailable />)

      const button = screen.getByRole('button', { name: /^undo$/i })
      expect(button).not.toBeDisabled()
    })

    it('the Undo button is marked aria-disabled, so it is not advertised as operable', () => {
      render(<LeftSidebar canUndo={false} undoUnavailable />)

      expect(screen.getByRole('button', { name: /^undo$/i })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    })

    it('clicking Undo surfaces the sanctioned notice', () => {
      render(<LeftSidebar canUndo={false} undoUnavailable />)

      fireEvent.click(screen.getByRole('button', { name: /^undo$/i }))

      expect(toasts).toEqual([expectedNotice()])
    })

    it('clicking Redo surfaces the SAME sanctioned notice — no invented redo copy', () => {
      render(<LeftSidebar canRedo={false} redoUnavailable />)

      fireEvent.click(screen.getByRole('button', { name: /^redo$/i }))

      expect(toasts).toEqual([expectedNotice()])
    })

    /**
     * The other half of the discriminating pair. Without it, a change that
     * made EVERY control in the sidebar shout the notice would pass the
     * assertions above — sensitivity to "something" is not sensitivity to
     * "this button".
     */
    it('an unrelated control in the same sidebar does NOT surface it', () => {
      render(<LeftSidebar canUndo={false} undoUnavailable />)

      fireEvent.click(screen.getByRole('button', { name: /switch to (hand|select) mode/i }))

      expect(toasts).toEqual([])
    })

    /**
     * The lie this must never become. `onUndoClick` carries the REAL `undo`
     * at the call site; explaining a limitation must not also perform the
     * mutation it says is unavailable.
     */
    it('clicking Undo does NOT perform a real undo', () => {
      const onUndoClick = vi.fn()
      render(<LeftSidebar canUndo={false} undoUnavailable onUndoClick={onUndoClick} />)

      fireEvent.click(screen.getByRole('button', { name: /^undo$/i }))

      expect(onUndoClick).not.toHaveBeenCalled()
      expect(toasts).toEqual([expectedNotice()])
    })
  })

  /**
   * ⭐ THE FLAG-MOVE PIN. The click path is decided by the `undoUnavailable`
   * PROP, which the call site derives once; `LeftSidebar` never reads the
   * authority itself. If someone later flips `canvasSemanticMutations` and
   * this component consulted it directly, the button would silently become a
   * live undo while still wearing the "explains a limitation" treatment —
   * a control whose appearance and behaviour disagree. Driving the authority
   * to `'server_graph'` and asserting NOTHING here changes is what makes that
   * impossible to do by accident.
   */
  describe('a flag move cannot silently turn the notice into a live undo', () => {
    it.each(['disabled', 'server_graph'])(
      'behaviour is identical with canvasSemanticMutations=%s',
      (authority) => {
        authorityValue.current = authority
        const onUndoClick = vi.fn()
        render(<LeftSidebar canUndo={false} undoUnavailable onUndoClick={onUndoClick} />)

        const button = screen.getByRole('button', { name: /^undo$/i })
        expect(button).not.toBeDisabled()
        fireEvent.click(button)

        expect(onUndoClick).not.toHaveBeenCalled()
        expect(toasts).toEqual([expectedNotice()])
      },
    )
  })

  /**
   * ⚠ THE OPPOSITE DIRECTION, and the reason `undoUnavailable` exists as a
   * separate prop rather than being folded into `!canUndo`. An empty history
   * is an ordinary, temporary state on a canvas that DOES have undo; a greyed
   * button describes it perfectly well. Claiming the capability is missing
   * would be a fresh false statement pointing the other way.
   */
  describe('when undo exists but the history is empty', () => {
    it('keeps the ordinary disabled button and says nothing', () => {
      render(<LeftSidebar canUndo={false} canRedo={false} />)

      const undo = screen.getByRole('button', { name: /^undo$/i })
      const redo = screen.getByRole('button', { name: /^redo$/i })
      expect(undo).toBeDisabled()
      expect(redo).toBeDisabled()
      expect(undo).not.toHaveAttribute('aria-disabled', 'true')

      fireEvent.click(undo)
      expect(toasts).toEqual([])
    })

    it('an available undo still performs the real action', () => {
      const onUndoClick = vi.fn()
      render(<LeftSidebar canUndo onUndoClick={onUndoClick} />)

      fireEvent.click(screen.getByRole('button', { name: /^undo$/i }))

      expect(onUndoClick).toHaveBeenCalledTimes(1)
      expect(toasts).toEqual([])
    })
  })
})
