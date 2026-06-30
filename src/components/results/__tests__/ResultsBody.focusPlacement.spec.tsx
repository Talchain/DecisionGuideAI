/**
 * ResultsBody — Focus / "Strengthen your model" panel placement.
 *
 * Proves the static Focus panel is mounted as the SECOND Analysis-tab panel:
 * immediately after the hero (DecisionConfidencePanel / AnalysisHeroV17) and
 * before the Options Comparison section. Render-only, fail-closed: the panel
 * shows the generic static hygiene rows with no server/dynamic content (default
 * store state → no summary, no freshness banner).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isAnalysisHeroV17Enabled: vi.fn(() => false),
    isAnalysisHeroCompareEnabled: vi.fn(() => false),
    isFocusNowPanelEnabled: vi.fn(() => true),
    isAiPanelV2Enabled: vi.fn(() => true),
  }
})

// ResultsBody is not wrapped in a ConversationProvider here, so stub the live chat
// with a stateful fake: setDraft updates a holder we can assert against. This is
// the surface the visible AIInputBar reads — the real effect of a Focus action.
const convo = vi.hoisted(() => {
  const box = { draft: '' }
  return {
    box,
    setDraft: vi.fn((text: string) => {
      box.draft = text
    }),
  }
})
vi.mock('@/canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => ({ draft: convo.box.draft, setDraft: convo.setDraft }),
}))

import {
  isAnalysisHeroV17Enabled,
  isAnalysisHeroCompareEnabled,
  isFocusNowPanelEnabled,
  isAiPanelV2Enabled,
} from '@/flags'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'

function makeData(): ResultsSectionDataReturn {
  const winner = { id: 'opt_a', label: 'Option A', expectedValue: 0.8, p10: 0.6, p90: 0.95, winProbability: 0.7, goalProbability: 0.7 } as unknown as OptionResult
  const runnerUp = { id: 'opt_b', label: 'Option B', expectedValue: 0.4, p10: 0.2, p90: 0.6, winProbability: 0.3, goalProbability: 0.3 } as unknown as OptionResult
  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData
  const drivers: DriversSectionData = { drivers: [], topDrivers: [], driversStatus: 'computed', totalCount: 0, hasMagnitudeData: false }
  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [], topUncertainties: [], improvements: [], topImprovements: [],
    evidenceGaps: [], topEvidenceGaps: [], nextActions: [], topNextActions: [],
  } as ConfidenceSectionData
  const improvements: ImprovementsSectionData = { improvements: [], count: 0, hasHighPriority: false }
  return {
    recommendation, drivers, confidence, improvements,
    isLoading: false, isError: false, goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

function renderBody() {
  return render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
    />,
  )
}

const before = (a: HTMLElement, b: HTMLElement) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('ResultsBody — Focus panel placement (second Analysis-tab panel)', () => {
  beforeEach(() => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(false)
    vi.mocked(isAnalysisHeroCompareEnabled).mockReturnValue(false)
    vi.mocked(isFocusNowPanelEnabled).mockReturnValue(true)
    vi.mocked(isAiPanelV2Enabled).mockReturnValue(true)
    convo.box.draft = ''
    convo.setDraft.mockClear()
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('mounts the Focus panel (flag default-ON)', () => {
    renderBody()
    expect(screen.getByTestId('focus-now-panel')).toBeInTheDocument()
  })

  it('flag OFF: Focus panel absent, hero + options unchanged and still ordered', () => {
    vi.mocked(isFocusNowPanelEnabled).mockReturnValue(false)
    renderBody()
    expect(screen.queryByTestId('focus-now-panel')).toBeNull()
    const hero = screen.getByTestId('decision-confidence-panel')
    const options = screen.getByTestId('section-header-options')
    expect(hero).toBeInTheDocument()
    expect(before(hero, options), 'hero still precedes options when Focus is off').toBe(true)
  })

  it('STALE verdict: the mounted panel shows NO second stale banner (no duplicate)', () => {
    // Drive the freshness source stale; AnalysisFreshnessNotice owns the notice,
    // and the mounted Focus panel must NOT add its own (showFreshnessBanner=false).
    useCanvasStore.setState({ analysisFreshness: { freshness: 'stale' }, analysisFreshnessDirty: false })
    renderBody()
    expect(screen.getByTestId('focus-now-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('focus-banner')).toBeNull()
  })

  it('renders the Focus panel AFTER the hero and BEFORE the options section', () => {
    renderBody()
    const hero = screen.getByTestId('decision-confidence-panel')
    const focus = screen.getByTestId('focus-now-panel')
    const options = screen.getByTestId('section-header-options')
    expect(before(hero, focus), 'hero must precede the Focus panel').toBe(true)
    expect(before(focus, options), 'Focus panel must precede the options section').toBe(true)
  })

  it('is fail-closed: shows static hygiene rows, no server summary', () => {
    renderBody()
    // generic static prompt present…
    expect(screen.getByText('Define what success looks like')).toBeInTheDocument()
    // …and no verbatim server summary line (coaching_summary gated off)
    expect(screen.queryByTestId('focus-summary')).toBeNull()
  })

  // Regression for the staging blocker: the visible aiPanelV2 composer (AIInputBar)
  // is bound to ConversationContext `draft`, so a working action must write THAT
  // draft (not the legacy canvas-store draftComposerText) AND reveal the Olumi tab.
  // End-to-end through the real FocusNowContainer → useFocusNow → onPrefill (no hook
  // mock); only the live chat is stubbed. Both row controls must behave the same.
  const PROMPT = 'Help me think through a risk worth adding to this decision.'

  it.each([
    ['the row CTA', 'focus-action'],
    ['the Ask Olumi icon', 'focus-ask-olumi'],
  ])('clicking %s writes the prompt to the live chat draft and reveals the Olumi tab', (_label, testid) => {
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    renderBody()
    const nodesBefore = useCanvasStore.getState().nodes
    const edgesBefore = useCanvasStore.getState().edges
    // expand the "Add a risk" static row, then click the control under test
    fireEvent.click(screen.getByRole('button', { name: /add a risk worth watching/i }))
    fireEvent.click(screen.getByTestId(testid))
    // the prompt lands in the live conversation draft (what AIInputBar renders)…
    expect(convo.box.draft).toBe(PROMPT)
    // …and the chat surface is revealed (Olumi tab activated)…
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    // …with NO graph mutation (node/edge collections untouched by reference).
    expect(useCanvasStore.getState().nodes).toBe(nodesBefore)
    expect(useCanvasStore.getState().edges).toBe(edgesBefore)
  })

  it('APPENDS to an existing unsent draft — never clobbers it', () => {
    // A message the user is still writing lives in the conversation draft; a Focus
    // action must append below it, not overwrite it.
    convo.box.draft = 'I am leaning towards option A'
    renderBody()
    fireEvent.click(screen.getByRole('button', { name: /add a risk worth watching/i }))
    fireEvent.click(screen.getByTestId('focus-action'))
    expect(convo.box.draft).toBe(`I am leaning towards option A\n\n${PROMPT}`)
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  })

  it('aiPanelV2 OFF: the panel shows but renders NO action controls (no dead buttons)', () => {
    // The reveal needs the Olumi tab, which the dock redirects to 'results' when
    // aiPanelV2 is off. So the controls would be dead — they must not render.
    vi.mocked(isAiPanelV2Enabled).mockReturnValue(false)
    renderBody()
    expect(screen.getByTestId('focus-now-panel')).toBeInTheDocument()
    // the row still expands and shows its guidance…
    fireEvent.click(screen.getByRole('button', { name: /add a risk worth watching/i }))
    expect(screen.getByTestId('focus-card-body')).toBeInTheDocument()
    // …but neither action control is present, and the tab is not switched
    expect(screen.queryByTestId('focus-action')).toBeNull()
    expect(screen.queryByTestId('focus-ask-olumi')).toBeNull()
    expect(useUIStore.getState().activeOutputTab).toBe('results')
  })
})
