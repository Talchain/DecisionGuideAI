import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InputsDock } from '../InputsDock'
import { useCanvasStore } from '../../store'
import * as useEngineLimitsModule from '../../hooks/useEngineLimits'
import type { UseEngineLimitsReturn } from '../../hooks/useEngineLimits'

vi.mock('../../hooks/useEngineLimits', () => ({
  useEngineLimits: vi.fn(),
}))

const mockUseEngineLimits = vi.mocked(useEngineLimitsModule.useEngineLimits)

const createMockLimitsReturn = (overrides?: Partial<UseEngineLimitsReturn>): UseEngineLimitsReturn => ({
  limits: {
    nodes: { max: 200 },
    edges: { max: 200 },
    engine_p95_ms_budget: 30000,
  },
  source: 'live',
  loading: false,
  error: null,
  fetchedAt: Date.now(),
  retry: vi.fn(),
  ...overrides,
})

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

describe('InputsDock DOM', () => {
  const STORAGE_KEY = 'canvas.inputsDock.v1'

  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn())
    // Reset canvas store to a clean baseline for each test
    if (typeof useCanvasStore.getState().reset === 'function') {
      useCanvasStore.getState().reset()
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
    try {
      localStorage.clear()
    } catch {}
  })

  it('renders with correct ARIA attributes and sections', () => {
    render(<InputsDock />)

    const aside = screen.getByLabelText('Inputs dock')
    expect(aside).toBeInTheDocument()

    const tabs = screen.getAllByRole('button', { name: /documents|scenarios|limits/i })
    expect(tabs.map(t => t.textContent)).toEqual([
      'Documents',
      'Scenarios',
      'Limits and health',
    ])
  })

  it('shows a collapsed icon strip when closed and reopens on icon click', () => {
    render(<InputsDock />)

    const toggle = screen.getByTestId('inputs-dock-toggle')
    fireEvent.click(toggle)

    expect(screen.queryByTestId('inputs-dock-body')).toBeNull()

    const documentsIcon = screen.getByRole('button', { name: 'Documents' })
    const scenariosIcon = screen.getByRole('button', { name: 'Scenarios' })
    const limitsIcon = screen.getByRole('button', { name: 'Limits and health' })

    expect(documentsIcon).toBeInTheDocument()
    expect(scenariosIcon).toBeInTheDocument()
    expect(limitsIcon).toBeInTheDocument()

    fireEvent.click(scenariosIcon)

    const headerLabel = screen.getByText('Scenarios', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('persists active tab and open state via useDockState', () => {
    const { unmount } = render(<InputsDock />)

    // Switch to Limits tab and leave dock open
    const limitsTab = screen.getByRole('button', { name: 'Limits and health' })
    fireEvent.click(limitsTab)

    // Unmount and remount to verify persisted state
    unmount()

    render(<InputsDock />)

    const aside = screen.getByLabelText('Inputs dock') as HTMLElement
    // Width style should reflect expanded state via CSS variable
    expect(aside.style.width).toContain('var(--dock-left-expanded')
    // Dock should reserve space for the bottom toolbar via CSS variable in height calculation
    expect(aside.style.height).toContain('var(--bottombar-h)')

    // Limits tab should be active (aria-live label shows current section)
    const headerLabel = screen.getByText('Limits and health', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('binds framing inputs to currentScenarioFraming and persists across renders', () => {
    // Start with no framing in the store
    useCanvasStore.setState({ currentScenarioFraming: null } as any)

    const { rerender } = render(<InputsDock />)

    const scenariosTab = screen.getByRole('button', { name: 'Scenarios' })
    fireEvent.click(scenariosTab)

    const title = screen.getByLabelText('Decision or question') as HTMLInputElement
    const goal = screen.getByLabelText('Primary goal') as HTMLTextAreaElement
    const timeline = screen.getByLabelText('Timeline or horizon') as HTMLInputElement

    // Copy should remain calm and descriptive
    expect(title.placeholder).toBe('What decision are you making?')
    expect(goal.placeholder).toBe('What does a good outcome look like?')
    expect(timeline.placeholder).toContain('next quarter')

    fireEvent.change(title, { target: { value: 'Choose launch strategy' } })
    fireEvent.change(goal, { target: { value: 'Maximise sustainable impact' } })
    fireEvent.change(timeline, { target: { value: 'Next 6 months' } })

    const stateAfterInput = useCanvasStore.getState()
    expect(stateAfterInput.currentScenarioFraming).toEqual(
      expect.objectContaining({
        title: 'Choose launch strategy',
        goal: 'Maximise sustainable impact',
        timeline: 'Next 6 months',
      })
    )

    // Re-render and ensure values are preserved
    rerender(<InputsDock />)
    fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

    expect((screen.getByLabelText('Decision or question') as HTMLInputElement).value).toBe(
      'Choose launch strategy',
    )
    expect((screen.getByLabelText('Primary goal') as HTMLTextAreaElement).value).toBe(
      'Maximise sustainable impact',
    )
    expect((screen.getByLabelText('Timeline or horizon') as HTMLInputElement).value).toBe(
      'Next 6 months',
    )
  })

  it('toggles advanced framing fields and binds them to currentScenarioFraming', () => {
    useCanvasStore.setState({ currentScenarioFraming: null } as any)

    render(<InputsDock />)
    fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

    // Advanced block should not be visible initially
    expect(screen.queryByTestId('framing-advanced')).toBeNull()

    const toggle = screen.getByTestId('framing-toggle-advanced')
    expect(toggle).toHaveTextContent('Add more structure')

    fireEvent.click(toggle)

    const advanced = screen.getByTestId('framing-advanced')
    expect(advanced).toBeInTheDocument()

    const constraints = screen.getByLabelText('Constraints') as HTMLTextAreaElement
    const risks = screen.getByLabelText('Risks') as HTMLTextAreaElement
    const uncertainties = screen.getByLabelText('Uncertainties') as HTMLTextAreaElement

    fireEvent.change(constraints, { target: { value: 'Budget capped at 50k.' } })
    fireEvent.change(risks, { target: { value: 'Launch delay could erode trust.' } })
    fireEvent.change(uncertainties, { target: { value: 'User adoption and churn unknown.' } })

    const stateAfter = useCanvasStore.getState().currentScenarioFraming
    expect(stateAfter).toEqual(
      expect.objectContaining({
        constraints: 'Budget capped at 50k.',
        risks: 'Launch delay could erode trust.',
        uncertainties: 'User adoption and churn unknown.',
      })
    )

    // Collapse and re-expand should not lose data
    fireEvent.click(toggle)
    expect(screen.queryByTestId('framing-advanced')).toBeNull()

    fireEvent.click(toggle)
    expect((screen.getByLabelText('Constraints') as HTMLTextAreaElement).value).toBe(
      'Budget capped at 50k.',
    )
    expect((screen.getByLabelText('Risks') as HTMLTextAreaElement).value).toBe(
      'Launch delay could erode trust.',
    )
    expect((screen.getByLabelText('Uncertainties') as HTMLTextAreaElement).value).toBe(
      'User adoption and churn unknown.',
    )
  })

  it('collapses core framing fields behind a Collapsible when framing already exists', () => {
    useCanvasStore.setState({
      currentScenarioFraming: {
        title: 'Existing decision',
        goal: 'Existing goal',
        timeline: 'Next 6 months',
      },
    } as any)

    render(<InputsDock />)
    fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

    const framingToggle = screen.getByRole('button', { name: /Framing/ })
    expect(framingToggle).toHaveAttribute('aria-expanded', 'false')

    // Core framing fields should be hidden until expanded
    expect(screen.queryByLabelText('Decision or question')).toBeNull()

    fireEvent.click(framingToggle)

    expect(screen.getByLabelText('Decision or question')).toBeInTheDocument()
    expect(screen.getByLabelText('Primary goal')).toBeInTheDocument()
    expect(screen.getByLabelText('Timeline or horizon')).toBeInTheDocument()
  })

  it('persists framing per scenario across save, load, and switching', () => {
    // Start from a clean store and storage
    useCanvasStore.setState({
      currentScenarioId: null,
      currentScenarioFraming: null,
    } as any)
    try {
      localStorage.clear()
    } catch {}

    const { rerender } = render(<InputsDock />)

    // Scenario A: set framing via UI and save
    fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

    fireEvent.change(screen.getByLabelText('Decision or question'), {
      target: { value: 'Scenario A decision' },
    })
    fireEvent.change(screen.getByLabelText('Primary goal'), {
      target: { value: 'Scenario A goal' },
    })

    const saveCurrentScenario = useCanvasStore.getState().saveCurrentScenario
    const idA = saveCurrentScenario('Scenario A')
    expect(idA).toBeTruthy()

    // Scenario B: clear scenario id, enter different framing, and save as new
    useCanvasStore.setState({
      currentScenarioId: null,
      currentScenarioFraming: null,
    } as any)
    rerender(<InputsDock />)
    fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

    fireEvent.change(screen.getByLabelText('Decision or question'), {
      target: { value: 'Scenario B decision' },
    })
    fireEvent.change(screen.getByLabelText('Primary goal'), {
      target: { value: 'Scenario B goal' },
    })

    const idB = saveCurrentScenario('Scenario B')
    expect(idB).toBeTruthy()

    const { loadScenario } = useCanvasStore.getState()

    // Load Scenario A and verify framing
    loadScenario(idA as string)
    rerender(<InputsDock />)
    fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

    expect((screen.getByLabelText('Decision or question') as HTMLInputElement).value).toBe(
      'Scenario A decision',
    )
    expect((screen.getByLabelText('Primary goal') as HTMLTextAreaElement).value).toBe('Scenario A goal')

    // Load Scenario B and verify framing
    loadScenario(idB as string)
    rerender(<InputsDock />)
    fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

    expect((screen.getByLabelText('Decision or question') as HTMLInputElement).value).toBe(
      'Scenario B decision',
    )
    expect((screen.getByLabelText('Primary goal') as HTMLTextAreaElement).value).toBe('Scenario B goal')

    // Switch back to Scenario A and ensure its framing is restored
    loadScenario(idA as string)
    rerender(<InputsDock />)
    fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

    expect((screen.getByLabelText('Decision or question') as HTMLInputElement).value).toBe(
      'Scenario A decision',
    )
    expect((screen.getByLabelText('Primary goal') as HTMLTextAreaElement).value).toBe('Scenario A goal')
  })

  describe('Scenario run summary', () => {
    it('shows a gentle no-runs hint when there is no last run metadata', () => {
      useCanvasStore.setState({
        currentScenarioLastResultHash: null,
        currentScenarioLastRunAt: null,
        currentScenarioLastRunSeed: null,
      } as any)

      render(<InputsDock />)
      fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

      const emptySummary = screen.getByTestId('scenario-run-summary-empty')
      expect(emptySummary).toBeInTheDocument()
      // Phase 3: Updated to actionable empty state text
      expect(emptySummary).toHaveTextContent('Ready to analyze')
    })

    it('renders last run metadata when present', () => {
      useCanvasStore.setState({
        currentScenarioLastResultHash: 'abcd1234efgh5678',
        currentScenarioLastRunAt: '2025-11-18T14:03:00.000Z',
        currentScenarioLastRunSeed: '1337',
      } as any)

      render(<InputsDock />)
      fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

      const summary = screen.getByTestId('scenario-run-summary')
      expect(summary).toBeInTheDocument()
      expect(screen.getByText('Last run for this decision')).toBeInTheDocument()

      // Hash snippet should show the first 8 chars plus ellipsis
      expect(screen.getByLabelText('Last run hash snippet')).toHaveTextContent('abcd1234…')

      // Time formatting should contain the date portion in a deterministic way
      expect(summary).toHaveTextContent('2025-11-18')
      expect(summary).toHaveTextContent('14:03')

      // Seed is shown but subtle
      expect(summary).toHaveTextContent('Seed:')
      expect(summary).toHaveTextContent('1337')
    })

    it('tracks last-run metadata per scenario when switching', () => {
      // Start from a clean store and storage
      useCanvasStore.setState({
        currentScenarioId: null,
        currentScenarioFraming: null,
        currentScenarioLastResultHash: null,
        currentScenarioLastRunAt: null,
        currentScenarioLastRunSeed: null,
      } as any)
      try {
        localStorage.clear()
      } catch {}

      const { rerender } = render(<InputsDock />)

      // Scenario A: save with last-run metadata
      fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

      useCanvasStore.setState({
        currentScenarioLastResultHash: 'aaaa1111',
        currentScenarioLastRunAt: '2025-11-18T10:00:00.000Z',
        currentScenarioLastRunSeed: '1000',
      } as any)

      const saveCurrentScenario = useCanvasStore.getState().saveCurrentScenario
      const idA = saveCurrentScenario('Scenario A with run')
      expect(idA).toBeTruthy()

      // Scenario B: different last-run metadata
      useCanvasStore.setState({
        currentScenarioId: null,
        currentScenarioFraming: null,
        currentScenarioLastResultHash: null,
        currentScenarioLastRunAt: null,
        currentScenarioLastRunSeed: null,
      } as any)
      rerender(<InputsDock />)
      fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

      useCanvasStore.setState({
        currentScenarioLastResultHash: 'bbbb2222',
        currentScenarioLastRunAt: '2025-11-18T11:00:00.000Z',
        currentScenarioLastRunSeed: '2000',
      } as any)

      const idB = saveCurrentScenario('Scenario B with run')
      expect(idB).toBeTruthy()

      const { loadScenario } = useCanvasStore.getState()

      // Load Scenario A and verify its summary
      loadScenario(idA as string)
      rerender(<InputsDock />)
      fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

      const summaryA = screen.getByTestId('scenario-run-summary')
      expect(summaryA).toHaveTextContent('aaaa1111')
      expect(summaryA).toHaveTextContent('10:00')

      // Load Scenario B and verify its summary
      loadScenario(idB as string)
      rerender(<InputsDock />)
      fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

      const summaryB = screen.getByTestId('scenario-run-summary')
      expect(summaryB).toHaveTextContent('bbbb2222')
      expect(summaryB).toHaveTextContent('11:00')
    })

    it('navigates to Results when clicking "Open latest results" without triggering a new run', () => {
      useCanvasStore.setState({
        currentScenarioLastResultHash: 'abcd1234efgh5678',
        currentScenarioLastRunAt: '2025-11-18T14:03:00.000Z',
        currentScenarioLastRunSeed: '1337',
      } as any)

      const setShowResultsPanelSpy = vi.spyOn(useCanvasStore.getState(), 'setShowResultsPanel')

      render(<InputsDock />)
      fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))

      const cta = screen.getByRole('button', { name: 'Open latest results' })
      fireEvent.click(cta)

      expect(setShowResultsPanelSpy).toHaveBeenCalledWith(true)
    })
  })
})
