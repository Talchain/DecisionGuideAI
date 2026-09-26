/**
 * ⭐ A SAVED EXAMPLE IS CALLED BY ITS OWN NAME, NOT BY ITS GOAL
 * (Canvas v3.1 DESIGN-GAP #5, 26 Sep 2026).
 *
 * MEASURED on staging `eec722ab` and again at this lane's base: every one of the
 * five starters rendered its GOAL sentence in the top bar as the model's name —
 * "Achieve NRR Above 110% While Enabling Bottom-Up Adoption" on the pricing
 * example. The contract's bar shows the model's name ("Explore Pro pricing").
 *
 * THE NAME IS NOT INVENTED. A starter carries its own title in the generated
 * manifest (`StarterSummary.title`, "the graph's own `decision` node label,
 * verbatim"), and it is the name the product already shows for this example on
 * the starter card the user clicked (`StarterDecisions`). The ladder simply
 * never consulted it: with no stored title, it fell through to the goal.
 *
 * Same shape as `CanvasMVP.modelNameFromGoal.spec.tsx`, for the same reason: the
 * defect is a CALL-SITE property, so the observation is the prop TopBar is
 * handed, with the real route rendered and heavy children stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const topBarProps: Array<{ scenarioTitle?: unknown }> = []

vi.mock('../../components/layout/TopBar', () => ({
  TopBar: (props: { scenarioTitle?: unknown }) => {
    topBarProps.push(props)
    return <div data-testid="topbar-stub" />
  },
}))

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
import { getStarter } from '../../canvas/starters/loadStarter'
import { deriveModelNameFromGoal } from '../../canvas/domain/modelDisplayName'

const PRICING = getStarter('pricing-model')!

const lastTitle = () => topBarProps[topBarProps.length - 1]?.scenarioTitle

/** The starter's own graph shape: its decision and goal labels, stamped as `applyStarter` stamps them. */
function starterNodes(stamped: boolean) {
  const stamp = stamped ? { starterId: PRICING.id, starterTitle: PRICING.title } : {}
  return [
    { id: 'dec', type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: PRICING.title, ...stamp } },
    { id: 'goal', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: PRICING.summary, ...stamp } },
  ]
}

beforeEach(() => {
  topBarProps.length = 0
  useCanvasStore.setState({ currentScenarioId: null, currentScenarioFraming: null, nodes: [] as never })
})

describe('the top bar names a saved example by its own title (v3.1 DESIGN-GAP #5)', () => {
  it('PRECONDITION PIN: the example title and its goal are different strings', () => {
    // With equal strings every assertion below would pass whichever source won.
    expect(PRICING.title).toBeTruthy()
    expect(PRICING.summary).toBeTruthy()
    expect(PRICING.title).not.toBe(PRICING.summary)
    expect(PRICING.title).not.toBe(deriveModelNameFromGoal(PRICING.summary))
  })

  it('⛔ a starter canvas with no stored title shows the STARTER TITLE, not the goal', () => {
    useCanvasStore.setState({ nodes: starterNodes(true) as never })
    render(<CanvasMVP />)

    // The half that bites: at the base this is exactly the goal-derived name.
    expect(lastTitle()).not.toBe(deriveModelNameFromGoal(PRICING.summary))
    expect(lastTitle()).toBe(PRICING.title)
  })

  it('a framing goal does not outrank the example title either', () => {
    useCanvasStore.setState({
      currentScenarioFraming: { title: undefined, goal: PRICING.summary } as never,
      nodes: starterNodes(true) as never,
    })
    render(<CanvasMVP />)

    expect(lastTitle()).toBe(PRICING.title)
  })

  it('a title someone stored still wins over the example title', () => {
    useCanvasStore.setState({
      currentScenarioFraming: { title: 'Our pricing question', goal: PRICING.summary } as never,
      nodes: starterNodes(true) as never,
    })
    render(<CanvasMVP />)

    expect(lastTitle()).toBe('Our pricing question')
  })

  it('CONTRAST: the same graph WITHOUT the starter stamp is still named after its goal (#1502 unchanged)', () => {
    useCanvasStore.setState({ nodes: starterNodes(false) as never })
    render(<CanvasMVP />)

    expect(lastTitle()).toBe(deriveModelNameFromGoal(PRICING.summary))
  })
})
