/**
 * ⭐ A REASONING METHOD PRESS RUNS THE METHOD (Paul, 7 Oct 2026: "The reasoning
 * tab already has a complete set of icons and a dropdown with what we call
 * reasoning methods. They don't seem to be working properly, so we actually
 * need to make them genuinely work.").
 *
 * THE SPEC: one press on a method — its icon on the strip, or its row in the
 * "All methods and actions" menu — sends ONE chip turn to Olumi and opens no
 * drawer. Before this, the press only swapped the Challenge card's heading
 * further down the panel and sent nothing; reaching Olumi took two more
 * presses (the card's ✦, then the drawer's Send).
 *
 * Bound by IDENTITY: catalogue ids read from `METHOD_CATALOGUE`, the strip's
 * own test ids, and the exact chip id each method sends. A method is an action
 * in `ACTION_REGISTRY` (S-B slice 0), which owns that id: the two methods CEE
 * has a typed handler for send its press id on a current Run; the other five
 * are PROSE rows (interim) and send `ask:<intent>`.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision } from './analysisNewFixtures'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import { ACTION_REGISTRY, actionOfMethod } from '../../../../canvas/conversation/actionRegistry'
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
  review_bias: 'ask:method-bias',
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
    pressMethod('outside_view')
    expect(screen.getByTestId(`${STRIP}-method-outside_view`)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId(`${STRIP}-method-reframe_problem`)).toHaveAttribute('aria-pressed', 'false')
  })

  it('⛔ CONTRAST — before a Run the two routed methods send their plain ask, never a CEE press id', () => {
    seedModel(false)
    vi.mocked(selectRunAffirmedCurrent).mockReturnValue(false)
    mount({ isPreRun: true })
    pressMethod('pre_mortem')
    vi.setSystemTime(new Date('2026-10-07T10:00:05Z'))
    pressMethod('different_option')
    expect(dispatch.mock.calls.map((c) => (c[0] as { id: string }).id)).toEqual(['ask:pre-mortem', 'ask:widen'])
  })

  it('the Challenge card’s ✦ on the picked method sends the same turn again, in one press', () => {
    mount()
    pressMethod('outside_view')
    vi.setSystemTime(new Date('2026-10-07T10:00:05Z'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-work-through'))
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch.mock.calls[1][0]).toEqual(dispatch.mock.calls[0][0])
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })

  it('a method picked from the Challenge card’s own menu runs too (the two menus cannot drift)', () => {
    mount()
    pressMethod('outside_view')
    vi.setSystemTime(new Date('2026-10-07T10:00:05Z'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-menu-method-review_bias'))
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect((dispatch.mock.calls[1][0] as { id: string }).id).toBe('ask:method-bias')
  })
})

describe('a method press is never dead and never doubles', () => {
  it('with no conversation mounted, the press opens the drawer with the method’s own draft', () => {
    useGuidanceStore.setState({ _dispatchAction: null } as never)
    mount()
    pressMethod('outside_view')
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.label).toBe(METHOD_CATALOGUE.find((m) => m.id === 'outside_view')!.title)
    expect(drawer.draft.trim()).not.toBe('')
  })

  it('while Olumi is still answering, the press sends nothing, opens no drawer and says so', () => {
    useGuidanceStore.setState({ _isConversationBusy: () => true } as never)
    const toasts: string[] = []
    const onToast = (e: Event) => toasts.push((e as CustomEvent<{ message: string }>).detail.message)
    window.addEventListener('topbar:show-toast', onToast)
    mount()
    pressMethod('outside_view')
    window.removeEventListener('topbar:show-toast', onToast)
    expect(dispatch).not.toHaveBeenCalled()
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
    expect(toasts).toHaveLength(1)
  })

  it('a double press inside the refire window sends once', () => {
    mount()
    pressMethod('outside_view')
    fireEvent.click(screen.getByTestId(`${STRIP}-method-outside_view`))
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
