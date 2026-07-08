// Option card render matrix — Simple/Detailed × pre/post/stale (UI-SEM-072/
// 073/076). At most one status pill; stale claims dim but the "From a
// previous run" marker never dims (amendment A7). Axe smoke included.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import type { NodeProps } from '@xyflow/react'
import { buildAnalysisContext } from '../../vm/analysisContext'
import { buildOptionCards } from '../../vm/buildOptionCard'
import { useViewLevelStore } from '../../state/viewLevelStore'
import { VNextSelectionProvider } from '../../mode/contexts'
import type { GraphExperienceVM } from '../../vm/types'

// Handles render nothing outside a real RF pane (render-matrix pattern).
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return { ...actual, Handle: () => null }
})

// The card consumes the VM via the adapter context — mocked per test so no
// store wiring is needed (one-adapter rule keeps this the only seam).
const useVMMock = vi.fn<[], GraphExperienceVM>()
vi.mock('../../vm/useGraphExperienceVM', () => ({
  useGraphExperienceVMContext: () => useVMMock(),
}))

import { OptionNodeVNext } from '../OptionNodeVNext'

configureAxe({ rules: { 'color-contrast': { enabled: false } } })

const nodes = [
  { id: 'o1', type: 'option', data: { label: 'Expand north' } },
  { id: 'o2', type: 'option', data: { label: 'Expand south' } },
  { id: 'o3', type: 'option', data: { label: 'Current plan', is_baseline: true } },
]

const report = {
  option_probabilities: {
    o1: { win_probability: 0.6, goal_probability: 0.7 },
    o2: { win_probability: 0.55, goal_probability: 0.4 },
    o3: { win_probability: 0.1, goal_probability: 0.15 },
  },
  robustness: { recommended_option_id: 'o1', fragile_edges: [] },
  factor_sensitivity: [],
}

function makeVM(opts: { displayState?: 'complete' | 'results_stale' | 'ready_to_analyse'; goalThreshold?: number | null } = {}): GraphExperienceVM {
  const { displayState = 'complete', goalThreshold = null } = opts
  const rpt = displayState === 'ready_to_analyse' ? null : report
  const analysis = buildAnalysisContext({ displayState, report: rpt, nodes, goalThreshold })
  return {
    provenance: 'live',
    analysis,
    optionCards: buildOptionCards({ nodes, report: rpt, ceeAnalysisReady: null, analysis }),
    edgeVisuals: {},
    relationshipCards: {},
  }
}

function renderOption(id: string) {
  const props = { id, type: 'option', data: { label: 'fallback' } } as unknown as NodeProps
  return render(
    <VNextSelectionProvider>
      <OptionNodeVNext {...props} />
    </VNextSelectionProvider>,
  )
}

beforeEach(() => {
  useViewLevelStore.setState({ level: 'simple' })
})

describe('pre-analysis', () => {
  it('renders the label only — no pill, no probability, no marker', () => {
    useVMMock.mockReturnValue(makeVM({ displayState: 'ready_to_analyse' }))
    renderOption('o1')
    expect(screen.getByText('Expand north')).toBeInTheDocument()
    expect(screen.queryByTestId('vnext-option-status-pill')).toBeNull()
    expect(screen.queryByTestId('vnext-option-win')).toBeNull()
    expect(screen.queryByTestId('vnext-option-stale-marker')).toBeNull()
  })
})

describe('post-analysis (fresh)', () => {
  it('leading option: one pill + one labelled probability, no stale marker', () => {
    useVMMock.mockReturnValue(makeVM())
    renderOption('o1')
    const pills = screen.getAllByTestId('vnext-option-status-pill')
    expect(pills).toHaveLength(1)
    expect(pills[0]).toHaveTextContent('Leading')
    expect(screen.getByTestId('vnext-option-win')).toHaveTextContent('Wins in 60% of scenarios')
    expect(screen.queryByTestId('vnext-option-stale-marker')).toBeNull()
  })

  it('close second gets its pill', () => {
    useVMMock.mockReturnValue(makeVM())
    renderOption('o2')
    expect(screen.getByTestId('vnext-option-status-pill')).toHaveTextContent('Close second')
  })

  it('Simple hides the Detailed slots; Detailed shows gap (goal fit stays gated without a user target)', () => {
    useVMMock.mockReturnValue(makeVM())
    const { unmount } = renderOption('o2')
    expect(screen.queryByTestId('vnext-option-gap')).toBeNull()
    unmount()

    useViewLevelStore.setState({ level: 'detailed' })
    renderOption('o2')
    expect(screen.getByTestId('vnext-option-gap')).toHaveTextContent('5pp behind the leader')
    expect(screen.queryByTestId('vnext-option-goalfit')).toBeNull() // no user target (UI-SEM-071)
  })

  it('Detailed shows goal fit when the user set a target', () => {
    useViewLevelStore.setState({ level: 'detailed' })
    useVMMock.mockReturnValue(makeVM({ goalThreshold: 100 }))
    renderOption('o1')
    expect(screen.getByTestId('vnext-option-goalfit')).toHaveTextContent('Reaches the target in 70% of scenarios')
  })
})

describe('stale results (UI-SEM-076 / amendment A7)', () => {
  it('claims are retained, dimmed, and the marker renders undimmed', () => {
    useVMMock.mockReturnValue(makeVM({ displayState: 'results_stale' }))
    renderOption('o1')
    // Claims retained
    expect(screen.getByTestId('vnext-option-status-pill')).toHaveTextContent('Leading')
    expect(screen.getByTestId('vnext-option-win')).toHaveTextContent('Wins in 60% of scenarios')
    // Result content is inside the dimmed wrapper…
    expect(screen.getByTestId('vnext-option-win').parentElement).toHaveClass('opacity-60')
    // …but the marker sits OUTSIDE it (never dimmed) and is visible.
    const marker = screen.getByTestId('vnext-option-stale-marker')
    expect(marker).toHaveTextContent('From a previous run')
    expect(marker.parentElement).not.toHaveClass('opacity-60')
  })
})

describe('accessibility', () => {
  it('has no axe violations fresh and stale', async () => {
    useVMMock.mockReturnValue(makeVM())
    const fresh = renderOption('o1')
    expect((await axe(fresh.container)).violations).toEqual([])
    fresh.unmount()

    useVMMock.mockReturnValue(makeVM({ displayState: 'results_stale' }))
    const stale = renderOption('o1')
    expect((await axe(stale.container)).violations).toEqual([])
  })
})
