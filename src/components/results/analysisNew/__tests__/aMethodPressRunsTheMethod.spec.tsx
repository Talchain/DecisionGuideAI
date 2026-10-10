/**
 * Reasoning-tab method interaction contract. SYS9 changes the old interim prose
 * expectation: supported methods send existing typed presses; unsupported ones
 * stay visible but disabled. Selection/lifecycle checks use available methods.
 * The real route/payload/parser/render witness is reasoningMethods.actionSpine.spec.tsx.
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision } from './analysisNewFixtures'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import { ACTION_REGISTRY, actionOfMethod, methodIsAvailable } from '../../../../canvas/conversation/actionRegistry'
import { parseActionBar, type ActionBarV1 } from '../../../../canvas/conversation/actionBar/actionBarContract'
import { useActionBarStore } from '../../../../canvas/conversation/actionBar/actionBarStore'
import { resetPressOfferClocks } from '../../../../canvas/conversation/actionBar/pressOffer'
import { QUESTIONS } from '../../../../canvas/conversation/askAiQuestions'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useUIStore } from '../../../../stores/uiStore'
import { selectRunAffirmedCurrent } from '../../../../canvas/state/analysisStateSelector'
import { selectRunWithholdsFigures } from '../../../../canvas/ui/inspector-v2/useAnalysisResults'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false }))
vi.mock('../../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))
vi.mock('../../../../canvas/state/analysisStateSelector', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  selectRunAffirmedCurrent: vi.fn(() => true),
}))
vi.mock('../../../../canvas/ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  selectRunWithholdsFigures: vi.fn(() => false),
}))

const STRIP = 'analysis-new-method-strip'
const DECISION = 'Pricing for next year'

/** The chip id each method sends on a CURRENT Run (the spec, by catalogue id). */
const SENT_ID_ON_A_CURRENT_RUN: Readonly<Record<string, string>> = {
  reframe_problem: 'ask:method-reframe',
  different_option: 'agent-next-widen',
  consider_opposite: 'ask:method-opposite',
  outside_view: 'ask:method-outside-view',
  pre_mortem: 'agent-next-pre-mortem',
  explore_tradeoffs: 'ask:compare-options',
  review_bias: 'act:bias_check',
}

/** The question each PROSE method asks (DL-approved register, Q15). */
const METHOD_QUESTION: Readonly<Record<string, string>> = {
  reframe_problem: `Is ‘${DECISION}’ the right question, or too narrow? What other framings should we consider?`,
  consider_opposite: 'What is the strongest honest case against how this model reads now, and what would change my mind?',
  outside_view: `How do decisions like ‘${DECISION}’ usually turn out, and how is ours different?`,
  explore_tradeoffs: 'How do the options compare in what they gain, give up and depend on?',
  review_bias: 'Which reasoning biases could be shaping this model, and how would we test for them?',
}

const initialCanvas = useCanvasStore.getState()
const initialGuidance = useGuidanceStore.getState()
const initialUI = useUIStore.getState()
let dispatch: ReturnType<typeof vi.fn>

const seedModel = (ran: boolean) =>
  useCanvasStore.setState({
    nodes: [
      { id: 'd', type: 'decision', position: { x: 0, y: 0 }, data: { label: DECISION } },
      { id: 'g', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Grow revenue' } },
      { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Raise price' } },
      { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold price' } },
    ],
    edges: [],
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>() },
    hasCompletedFirstRun: ran,
    v5AnalysisFact: null,
    results: ran ? { status: 'complete', report: {} } : { status: 'idle' },
  } as never)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-07T10:00:00Z'))
  vi.mocked(selectRunAffirmedCurrent).mockReturnValue(true)
  vi.mocked(selectRunWithholdsFigures).mockReturnValue(false)
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
  dispatch = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _sendChip: vi.fn(), _isConversationBusy: () => false } as never)
  useAskOlumiStore.getState().close()
  seedModel(true)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  useCanvasStore.setState(initialCanvas, true)
  useGuidanceStore.setState(initialGuidance, true)
  useUIStore.setState(initialUI, true)
})

const mount = (overrides: Partial<React.ComponentProps<typeof AnalysisNewTabBody>> = {}) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={genuineDecision()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run-methods"
      {...overrides}
    />,
  )

/** Presses the method where a person finds it: its icon, else its row in the ⋯ menu. */
const pressMethod = (id: string) => {
  const iconButton = screen.queryByTestId(`${STRIP}-method-${id}`)
  if (iconButton) {
    fireEvent.click(iconButton)
    return 'icon'
  }
  fireEvent.click(screen.getByTestId(`${STRIP}-more`))
  fireEvent.click(screen.getByTestId(`${STRIP}-menu-method-${id}`))
  return 'menu'
}

const METHOD_IDS = METHOD_CATALOGUE.map((m) => m.id)

describe('PRECONDITIONS — the subjects of these rules exist', () => {
  it('the spec table names every catalogue method, and only catalogue methods', () => {
    expect(Object.keys(SENT_ID_ON_A_CURRENT_RUN).sort()).toEqual([...METHOD_IDS].sort())
  })

  it('both doors are exercised: some methods are icons and some are only in the menu', () => {
    mount()
    const doors = METHOD_IDS.map((id) => (screen.queryByTestId(`${STRIP}-method-${id}`) ? 'icon' : 'menu'))
    expect(doors).toContain('icon')
    expect(doors).toContain('menu')
  })
})

describe('a method press on the Reasoning tab runs the method', () => {
  it.each(METHOD_IDS)('%s: one press sends ONE chip turn under its own id and opens no drawer', (id) => {
    mount()
    pressMethod(id)
    if (!methodIsAvailable(id)) {
      expect(dispatch).not.toHaveBeenCalled()
      expect(useAskOlumiStore.getState().isOpen).toBe(false)
      return
    }
    expect(dispatch).toHaveBeenCalledTimes(1)
    const sent = dispatch.mock.calls[0][0] as { id: string; label: string; message: string; source: string }
    expect(sent.id).toBe(SENT_ID_ON_A_CURRENT_RUN[id])
    expect(sent.source).toBe('chip')
    expect(sent.message.trim()).not.toBe('')
    expect(sent.label).toBe(sent.message)
    expect(Object.keys(sent).sort()).toEqual(['id', 'label', 'message', 'source'])
    if (id in METHOD_QUESTION) expect(sent.message).toBe(METHOD_QUESTION[id])
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })

  it('the pressed method is marked active on the strip, and a CONTRAST sibling is not', () => {
    mount()
    pressMethod('pre_mortem')
    expect(screen.getByTestId(`${STRIP}-method-pre_mortem`)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId(`${STRIP}-method-reframe_problem`)).toHaveAttribute('aria-pressed', 'false')
  })

  it('⛔ CONTRAST — before a Run the pre-mortem keeps its typed handler; a different option reaches CEE’s own handler at every stage', () => {
    seedModel(false)
    vi.mocked(selectRunAffirmedCurrent).mockReturnValue(false)
    mount({ isPreRun: true })
    pressMethod('pre_mortem')
    vi.setSystemTime(new Date('2026-10-07T10:00:05Z'))
    pressMethod('different_option')
    expect(dispatch.mock.calls.map((c) => (c[0] as { id: string }).id)).toEqual(['agent-next-pre-mortem', 'agent-next-widen'])
  })

  it('the Challenge card’s ✦ on the picked method sends the same turn again, in one press', () => {
    mount()
    pressMethod('pre_mortem')
    vi.setSystemTime(new Date('2026-10-07T10:00:05Z'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-work-through'))
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch.mock.calls[1][0]).toEqual(dispatch.mock.calls[0][0])
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })

  it('a method picked from the Challenge card’s own menu runs too (the two menus cannot drift)', () => {
    mount()
    pressMethod('pre_mortem')
    vi.setSystemTime(new Date('2026-10-07T10:00:05Z'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-menu-method-review_bias'))
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect((dispatch.mock.calls[1][0] as { id: string }).id).toBe('act:bias_check')
  })
})

describe('a method press is never dead and never doubles', () => {
  it('with no conversation mounted, the press opens the drawer with the method’s own draft', () => {
    useGuidanceStore.setState({ _dispatchAction: null } as never)
    mount()
    pressMethod('pre_mortem')
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.label).toBe(METHOD_CATALOGUE.find((m) => m.id === 'pre_mortem')!.title)
    expect(drawer.draft.trim()).not.toBe('')
  })

  it('while Olumi is still answering, the press sends nothing, opens no drawer and says so', () => {
    useGuidanceStore.setState({ _isConversationBusy: () => true } as never)
    const toasts: string[] = []
    const onToast = (e: Event) => toasts.push((e as CustomEvent<{ message: string }>).detail.message)
    window.addEventListener('topbar:show-toast', onToast)
    mount()
    pressMethod('pre_mortem')
    window.removeEventListener('topbar:show-toast', onToast)
    expect(dispatch).not.toHaveBeenCalled()
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
    expect(toasts).toHaveLength(1)
  })

  it('a double press inside the refire window sends once', () => {
    mount()
    pressMethod('pre_mortem')
    fireEvent.click(screen.getByTestId(`${STRIP}-method-pre_mortem`))
    expect(dispatch).toHaveBeenCalledTimes(1)
  })
})

describe('every catalogue method is one registry action', () => {
  it('no catalogue method is left without an action (DERIVED from the catalogue)', () => {
    for (const id of METHOD_IDS) {
      const action = actionOfMethod(id)
      expect(action, `${id} is no action: its press would fall back to the drawer`).toBeDefined()
      expect(typeof QUESTIONS[ACTION_REGISTRY[action!].ask]).toBe('function')
    }
  })

  it('the questions carry no figure and no contest word, with or without a decision label', () => {
    const banned = /\b(best|winner|winning|recommend\w*|leader|leading|leads|ahead|beats?)\b/i
    for (const id of Object.keys(METHOD_QUESTION)) {
      for (const decisionLabel of [DECISION, undefined]) {
        const text = QUESTIONS[ACTION_REGISTRY[actionOfMethod(id)!].ask]({ stage: 'ran-current', decisionLabel })
        expect(text, id).not.toMatch(/\d/)
        expect(text, id).not.toMatch(banned)
        expect(text, id).not.toContain('this decision usually')
      }
    }
  })
})

/**
 * ⭐ S-B slice 1 (Paul approved the action system, 7 Oct 2026): when the latest answer carries CEE's action bar, it heads
 * this tab INSTEAD of the method strip and the four text presses; chat shows the same bar. The bar is one CEE captured
 * from its routes. While CEE sends none, the tab is exactly as the rows above describe it.
 */
describe('CEE’s action bar heads the Reasoning tab when the latest answer carries one', () => {
  const SCENARIO = 'scn-reasoning-bar'
  const BAR = 'reasoning-action-bar'
  const FOUR_PRESSES = ['analysis-review-decision', 'analysis-what-would-change-result', 'analysis-strengthen-model', 'analysis-run-pre-mortem']
  const captured = (name: string): ActionBarV1 => parseActionBar(JSON.parse(readFileSync(
    join(__dirname, '../../../../canvas/conversation/actionBar/__tests__/fixtures', `action-bar-v1-${name}.json`), 'utf8')))!

  beforeEach(() => {
    resetPressOfferClocks()
    useCanvasStore.setState({ currentScenarioId: SCENARIO } as never)
    useActionBarStore.setState({ bar: null, scenarioId: null, dismissed: [] })
  })
  afterEach(() => useActionBarStore.setState({ bar: null, scenarioId: null, dismissed: [] }))

  it('⛔ CONTRAST (no bar on the answer): the strip and the four presses are drawn, and no bar', () => {
    mount()
    expect(screen.getByTestId(STRIP)).toBeInTheDocument()
    for (const id of FOUR_PRESSES) expect(screen.getByTestId(id), id).toBeInTheDocument()
    expect(screen.queryByTestId(BAR)).toBeNull()
  })

  it('with a bar: it is drawn INSTEAD of the strip and the four presses', () => {
    useActionBarStore.getState().setBar(SCENARIO, captured('withheld-run'))
    mount()
    expect(screen.getByTestId(BAR)).toHaveAttribute('data-surface', 'reasoning')
    expect(screen.queryByTestId(STRIP)).toBeNull()
    for (const id of FOUR_PRESSES) expect(screen.queryByTestId(id), id).toBeNull()
  })

  it('a press on the bar sends CEE’s own press id and the identity it was offered for: one press, one turn', () => {
    const bar = captured('withheld-run')
    useActionBarStore.getState().setBar(SCENARIO, bar)
    mount()
    fireEvent.click(screen.getByTestId(`${BAR}-icon-review`))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      id: 'agent-next-review-decision', label: bar.standard[0]!.label, message: bar.standard[0]!.user_line,
      parameters: { offer_key: bar.standard[0]!.offer_key, revision: bar.revision }, source: 'chip',
    })
    expect(useAskOlumiStore.getState().isOpen, 'no drawer').toBe(false)
  })

  it('before a Run the bar says what each Run-dependent action needs, and sends nothing for it', () => {
    useActionBarStore.getState().setBar(SCENARIO, captured('pre-run'))
    mount({ isPreRun: true })
    fireEvent.click(screen.getByTestId(`${BAR}-icon-review`))
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByTestId(`${BAR}-notice`)).toHaveTextContent('Review: Needs a current analysis.')
  })

  it('the tab’s own model-and-workflow controls stay reachable, last in the bar’s menu', () => {
    useActionBarStore.getState().setBar(SCENARIO, captured('withheld-run'))
    mount()
    fireEvent.click(screen.getByTestId(`${BAR}-more`))
    const rows = screen.getAllByRole('menuitem').map((el) => el.getAttribute('data-testid'))
    expect(rows).toContain(`${BAR}-menu-host-edit_brief`)
    expect(rows).toContain(`${BAR}-menu-host-review_inputs`)
    expect(rows.indexOf(`${BAR}-menu-more_options`)).toBeLessThan(rows.indexOf(`${BAR}-menu-host-edit_brief`))
  })

  it('a bar that belongs to another scenario is not drawn: the strip stays', () => {
    useActionBarStore.getState().setBar('another-scenario', captured('withheld-run'))
    mount()
    expect(screen.queryByTestId(BAR)).toBeNull()
    expect(screen.getByTestId(STRIP)).toBeInTheDocument()
  })
})

/**
 * ⛔ REGRESSION (served on staging 87d58524, 7 Oct 2026): once CEE's bar arrived it replaced the method strip, and CEE
 * offers only actions with a typed contract, so reframe, opposite case, outside view, trade-offs and bias check had NO
 * door in the Reasoning tab. DL: "do not drop the 5 prose methods until P12/P25 give them typed handlers". They are in
 * the bar's ⋯ under "Reasoning methods", and a press runs the method exactly as the strip did: one chip turn.
 */
describe('every reasoning method the bar does not carry is in the bar’s ⋯, and one press runs it', () => {
  const SCENARIO = 'scn-reasoning-methods'
  const BAR = 'reasoning-action-bar'
  const PROSE_METHODS = ['reframe_problem', 'consider_opposite', 'outside_view', 'explore_tradeoffs']
  const withheldRun = (): ActionBarV1 => parseActionBar(JSON.parse(readFileSync(
    join(__dirname, '../../../../canvas/conversation/actionBar/__tests__/fixtures/action-bar-v1-withheld-run.json'), 'utf8')))!
  const menuRows = () => {
    fireEvent.click(screen.getByTestId(`${BAR}-more`))
    return screen.getAllByRole('menuitem').map((el) => el.getAttribute('data-testid'))
  }

  beforeEach(() => {
    resetPressOfferClocks()
    useCanvasStore.setState({ currentScenarioId: SCENARIO } as never)
    useActionBarStore.getState().setBar(SCENARIO, withheldRun())
  })
  afterEach(() => useActionBarStore.setState({ bar: null, scenarioId: null, dismissed: [] }))

  it('PRECONDITION: the four are exactly the catalogue methods whose action has no typed handler', () => {
    const prose = METHOD_CATALOGUE.filter((m) => ACTION_REGISTRY[actionOfMethod(m.id)!].handler.kind === 'prose').map((m) => m.id)
    expect(prose).toEqual(PROSE_METHODS)
  })

  it('RED (served): with a bar, the four are listed under "Reasoning methods"; the typed ones are not listed twice', () => {
    mount()
    expect(screen.queryByTestId(STRIP), 'the strip is gone').toBeNull()
    const rows = menuRows()
    for (const id of PROSE_METHODS) expect(rows, id).toContain(`${BAR}-menu-host-${id}`)
    expect(rows).not.toContain(`${BAR}-menu-host-pre_mortem`)
    expect(rows).not.toContain(`${BAR}-menu-host-different_option`)
    expect(screen.getByTestId(`${BAR}-menu-group-host-methods`)).toHaveTextContent('Reasoning methods')
    // Methods before the tab's own workflow controls.
    expect(rows.indexOf(`${BAR}-menu-host-explore_tradeoffs`)).toBeLessThan(rows.indexOf(`${BAR}-menu-host-edit_brief`))
  })

  it.each(PROSE_METHODS)('%s: unsupported method is disabled and spends no turn', (id) => {
    mount()
    menuRows()
    fireEvent.click(screen.getByTestId(`${BAR}-menu-host-${id}`))
    expect(screen.getByTestId(`${BAR}-menu-host-${id}`)).toHaveAttribute('aria-disabled', 'true')
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByTestId(`${BAR}-notice`)).toHaveTextContent('Coming soon')
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })
})
