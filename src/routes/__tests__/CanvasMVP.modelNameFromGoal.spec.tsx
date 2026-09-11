/**
 * ⭐⭐ THE WIRING PIN — the guard this PR was missing, and an independent
 * reviewer found it by running the one mutation that mattered.
 *
 * github-a4 [2314f4] measured it and blocked on it: **revert
 * `CanvasMVP.tsx:180` to `framing?.title?.trim() || 'Untitled model'` and every
 * test stays green.** `modelDisplayName.spec.ts` imports the module directly and
 * renders nothing; `TopBar.singleModelName.spec.tsx` renders `<TopBar
 * scenarioTitle={MODEL_NAME}>` with the title passed IN AS A PROP, so it pins
 * TopBar's rendering of a name it is handed and is silent about where that name
 * comes from.
 *
 * The defect this PR fixes is a CALL-SITE property — *"a guest's model is called
 * Untitled model forever"* — so the guard has to live at the call site. A module
 * that is correct and unreachable fixes nothing.
 *
 * ⭐ THE SHAPE IS NOT NEW HERE. `CanvasMVP.serverGraphHydration.spec.tsx` exists
 * for the identical reason, in its own words: *"deleting the one
 * `useServerGraphHydration(...)` call in CanvasMVP left every other spec GREEN …
 * the line that makes the feature exist at all was pinned by nothing."* This
 * file follows it deliberately rather than inventing a second pattern — the real
 * route rendered, heavy children stubbed only to make it mountable, and exactly
 * one thing under observation.
 *
 * ⚠ IT OBSERVES THE PROP TopBar IS HANDED, not the module's return value. That
 * is the whole point: `resolveModelDisplayName` is already pinned by its own
 * spec, so re-asserting it here would be a second test of the same thing and
 * would stay green under precisely the mutation that matters. What is unpinned
 * is the wire between the module and the surface, and the prop IS that wire.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

/** Captures the title CanvasMVP actually hands to the top bar. */
const topBarProps: Array<{ scenarioTitle?: unknown }> = []

vi.mock('../../components/layout/TopBar', () => ({
  TopBar: (props: { scenarioTitle?: unknown }) => {
    topBarProps.push(props)
    return <div data-testid="topbar-stub" />
  },
}))

// ── Heavy children, stubbed only to keep the route mountable in jsdom ───────
vi.mock('../../canvas/ReactFlowGraph', () => ({ default: () => <div data-testid="rfg-stub" /> }))
vi.mock('../../components/DebugTray', () => ({ DebugTray: () => <div /> }))
vi.mock('../../canvas/hooks/useDebugShortcut', () => ({ useDebugShortcut: () => ({ showDebug: false }) }))
vi.mock('../../canvas/utils/sandboxTelemetry', () => ({ trackCanvasOpened: vi.fn() }))
vi.mock('../../canvas/hooks/useServerGraphHydration', () => ({ useServerGraphHydration: vi.fn() }))
vi.mock('../../hooks/useScenario', () => ({
  useScenario: () => ({
    loadScenario: vi.fn(),
    saveStatus: 'saved',
    lastSavedAt: null,
    saveError: null,
    isPersistenceActive: false,
    createSharedBrief: vi.fn(),
  }),
}))
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: undefined }) }))

import CanvasMVP from '../CanvasMVP'
import { useCanvasStore } from '../../canvas/store'
import { UNNAMED_MODEL_FALLBACK, deriveModelNameFromGoal } from '../../canvas/domain/modelDisplayName'

/**
 * ⭐ PAUL'S OWN GOAL SENTENCE, off the deployed build, and its LENGTH is doing
 * work. At 71 characters it is past `DERIVED_NAME_MAX`, so the derivation
 * visibly TRANSFORMS it. A short goal comes back verbatim, and against one of
 * those a call site that passed `framing.goal` straight through — deriving
 * nothing — would satisfy every assertion below. This one tells the two apart.
 */
const GOAL = 'NRR back above 115% within four quarters without burning more than £600k'

const lastTitle = () => topBarProps[topBarProps.length - 1]?.scenarioTitle

beforeEach(() => {
  topBarProps.length = 0
  useCanvasStore.setState({ currentScenarioId: null, currentScenarioFraming: null })
})

describe('CanvasMVP names a model after what it is about — at the CALL SITE', () => {
  it('PRECONDITION PIN: the fixture goal is not already the answer', () => {
    /**
     * ⭐ Without this the main case could pass on a goal that happens to equal
     * its own derived name, and the assertion would hold whether or not the
     * derivation was wired in at all (CLAUDE.md trap 13b).
     */
    const derived = deriveModelNameFromGoal(GOAL)
    expect(derived, 'the goal must yield a derived name at all').toBeTruthy()
    expect(derived, 'the derivation must TRANSFORM this goal, or a raw passthrough would pass').not.toBe(GOAL)
    expect(derived).not.toBe(UNNAMED_MODEL_FALLBACK)
  })

  it('⛔ a stored model with no title is named after its goal, NOT "Untitled model"', () => {
    useCanvasStore.setState({
      currentScenarioId: null,
      currentScenarioFraming: { title: undefined, goal: GOAL } as never,
    })
    render(<CanvasMVP />)

    /**
     * ⚠ THE `not.toBe` IS THE HALF THAT BITES. Reverting the call site to
     * `framing?.title?.trim() || 'Untitled model'` hands TopBar exactly the
     * fallback, and this line is what notices.
     */
    expect(lastTitle()).not.toBe(UNNAMED_MODEL_FALLBACK)
    expect(lastTitle()).toBe(deriveModelNameFromGoal(GOAL))
  })

  it('a framing TITLE still wins over the goal — the derivation never overrides an author', () => {
    useCanvasStore.setState({
      currentScenarioId: null,
      currentScenarioFraming: { title: 'Support response times', goal: GOAL } as never,
    })
    render(<CanvasMVP />)

    expect(lastTitle()).toBe('Support response times')
  })

  it('and with neither, the fallback is still what reaches the surface', () => {
    /**
     * ⚠ THE CONTRAST CONTROL FOR THE WHOLE FILE. Without it, a wire that handed
     * TopBar `undefined` in every state would satisfy the `not.toBe` above for
     * the wrong reason — an absent title is not the fallback, and the two must
     * be told apart.
     */
    useCanvasStore.setState({
      currentScenarioId: null,
      currentScenarioFraming: { title: undefined, goal: undefined } as never,
    })
    render(<CanvasMVP />)

    expect(lastTitle()).toBe(UNNAMED_MODEL_FALLBACK)
  })
})
