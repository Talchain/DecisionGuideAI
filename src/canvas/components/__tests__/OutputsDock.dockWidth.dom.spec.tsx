/**
 * THE REGRESSION PIN WHOSE ABSENCE LET A −35% CONTENT BUDGET SHIP.
 *
 * Two surgical changes, a day apart, narrowed the right-hand dock and nothing
 * went red:
 *   - #719 (16 Aug) moved the default from a fixed 416px to `viewport * 0.26`,
 *     putting a 1280px laptop at 333px.
 *   - #741 (17 Aug) added a pre-analysis clamp that pinned the dock to
 *     `dockWidthBounds().min` — an unconditional 280 — until an analysis
 *     result existed. Because that floor is a CONSTANT, the clamp applied at
 *     EVERY viewport up to 4K: screen size was irrelevant.
 *
 * The width was traded for graph legibility and the legibility was never
 * delivered: the post-draft fit clamps at the 0.5 floor at 416px, at 333px AND
 * at 280px alike (see `computeFitPadding.spec.ts` — fit box 760 / 843 / 896
 * against a 1008px requirement). So the trade cost content budget and bought
 * nothing.
 *
 * Both changes were invisible to the unit suites because no test asserted
 * (a) what the MOUNTED dock actually sets `--dock-right-expanded` to, or
 * (b) that the answer is INDEPENDENT of whether an analysis has run.
 *
 * This spec pins both, through the real component rather than through the pure
 * helpers — the helpers were correct in isolation on both days.
 *
 * ⚠ WHY INDEPENDENCE, AND NOT "PERSIST hasCompletedFirstRun": the clamp keyed
 * on a store field with NO `persist()` middleware (`store.ts:424`), so every
 * page reload returned a heavy user's dock to 280px. Persisting the flag would
 * have made the symptom rarer and left the rule wrong. The dock's width is not
 * a function of analysis state at all, and THAT is what is asserted here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'
import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { DOCK_MIN_WIDTH, DOCK_RESPONSIVE_MAX_WIDTH } from '../dockWidth'
import { useCanvasStore } from '../../store'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { ToastProvider } from '../../ToastContext'

// useScenario calls useNavigate; the dock mounts it.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

// `importOriginal`-spread, never a hand-listed allowlist: a `vi.mock` factory
// REPLACES the module, so an enumerated flag list goes silently short the next
// time a flag is added and the whole file dies at collection (trap 12).
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isJourneyTabEnabled: vi.fn(() => false),
    isPreAnalysisV3Enabled: vi.fn(() => false),
  }
})

const DOCK_WIDTH_VAR = '--dock-right-expanded'
const STORED_WIDTH_KEY = 'panel.results.width'

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

/** jsdom reports a fixed 1024; the effect reads `innerWidth || clientWidth`. */
function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
}

/**
 * Mount the dock and return the width it wrote, in px.
 *
 * Binds by IDENTITY to the CSS custom property the dock actually drives and
 * that `computeFitPadding`/`measureDockInset` read back — not to a pure helper
 * that a future call site could stop calling.
 */
function mountAndReadDockWidth(opts: { viewportWidth: number; hasCompletedFirstRun: boolean }): number {
  setViewportWidth(opts.viewportWidth)
  useCanvasStore.setState({
    // A model on the canvas, so the dock is past its 40px first-use rail and
    // the width question is the one on screen.
    nodes: [
      { id: 'w-goal', type: 'goal', data: { label: 'Goal' }, position: { x: 0, y: 0 } },
      { id: 'w-decision', type: 'decision', data: { label: 'Decision' }, position: { x: 100, y: 100 } },
    ],
    edges: [{ id: 'w-e1', source: 'w-decision', target: 'w-goal' }],
    hasCompletedFirstRun: opts.hasCompletedFirstRun,
  } as never)

  render(
    <ToastProvider>
      <ConversationProvider>
        <OutputsDock />
      </ConversationProvider>
    </ToastProvider>,
  )

  const raw = document.documentElement.style.getPropertyValue(DOCK_WIDTH_VAR)
  // PIN THE PRECONDITION (trap 13b): a spec that silently read '' would agree
  // with itself for ever. If the effect stops writing the variable, this fails
  // here by name rather than passing on a parsed NaN or a stale value.
  expect(raw, `${DOCK_WIDTH_VAR} must be written by the mounted dock`).toMatch(/^\d+px$/)
  return parseInt(raw, 10)
}

describe('OutputsDock width — mounted, and independent of analysis state', () => {
  beforeEach(() => {
    ensureMatchMedia()
    try {
      sessionStorage.removeItem(OUTPUTS_DOCK_STORAGE_KEY)
    } catch {}
    try {
      // No stored width: this suite is about the DEFAULT. A leaked explicit
      // width would make every case below pass for the wrong reason.
      localStorage.removeItem(STORED_WIDTH_KEY)
    } catch {}
    document.documentElement.style.removeProperty(DOCK_WIDTH_VAR)
  })

  afterEach(() => {
    cleanup()
    document.documentElement.style.removeProperty(DOCK_WIDTH_VAR)
  })

  it('opens at the restored 416px default on a 1280px laptop, with no analysis yet', () => {
    // The founder-facing case. #741 made this 280px; #719 made it 333px.
    expect(mountAndReadDockWidth({ viewportWidth: 1280, hasCompletedFirstRun: false })).toBe(
      DOCK_RESPONSIVE_MAX_WIDTH,
    )
  })

  it('is the SAME width before and after an analysis exists — the independence claim', () => {
    // DISCRIMINATING PAIR, not a restatement: identical viewport, identical
    // (absent) stored width, opposite analysis state. Under #741 these were
    // 280 and 333 — the equality is the assertion that has to be deleted to
    // reintroduce an analysis-state input to the width.
    const preAnalysis = mountAndReadDockWidth({ viewportWidth: 1280, hasCompletedFirstRun: false })
    cleanup()
    document.documentElement.style.removeProperty(DOCK_WIDTH_VAR)
    const postAnalysis = mountAndReadDockWidth({ viewportWidth: 1280, hasCompletedFirstRun: true })

    expect(preAnalysis).toBe(postAnalysis)
    expect(preAnalysis).toBe(DOCK_RESPONSIVE_MAX_WIDTH)
  })

  it('does not shrink to the drag FLOOR at any desktop viewport — the "min at every viewport" bug', () => {
    // 280 is `dockWidthBounds().min`, an unconditional constant. #741's
    // `Math.min(full, min)` therefore produced 280 at 1280, at 1920 and at
    // 3840 alike — a uniform answer across inputs that must differ is the tell
    // (trap 20), and no test looked. Swept so a future clamp cannot hide in
    // the viewports nobody tried.
    for (const viewportWidth of [1280, 1920, 3840]) {
      const width = mountAndReadDockWidth({ viewportWidth, hasCompletedFirstRun: false })
      expect(width, `viewport ${viewportWidth}`).toBe(DOCK_RESPONSIVE_MAX_WIDTH)
      expect(width, `viewport ${viewportWidth} must not be the drag floor`).toBeGreaterThan(
        DOCK_MIN_WIDTH,
      )
      cleanup()
      document.documentElement.style.removeProperty(DOCK_WIDTH_VAR)
    }
  })

  it('still honours a width the user dragged for themselves, analysis or not', () => {
    // Containment must not become "the product owns the width". An explicit
    // drag is a direct instruction and survives both analysis states.
    localStorage.setItem(STORED_WIDTH_KEY, '312')
    expect(mountAndReadDockWidth({ viewportWidth: 1280, hasCompletedFirstRun: false })).toBe(312)
    cleanup()
    document.documentElement.style.removeProperty(DOCK_WIDTH_VAR)
    expect(mountAndReadDockWidth({ viewportWidth: 1280, hasCompletedFirstRun: true })).toBe(312)
  })
})
