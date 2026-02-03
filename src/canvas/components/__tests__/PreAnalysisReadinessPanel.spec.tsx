/**
 * PreAnalysisReadinessPanel Tests
 *
 * Tests for the pre-analysis readiness panel that displays
 * quality scores, blocking issues, decision structure, and readiness checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreAnalysisReadinessPanel } from '../PreAnalysisReadinessPanel.legacy'

// Mock the hooks
vi.mock('../../../canvas/store', () => ({
  useCanvasStore: vi.fn((selector) => {
    const mockState = {
      nodes: [
        { id: 'goal1', type: 'goal', data: { label: 'Increase Revenue' } },
        { id: 'node1', type: 'factor', data: { label: 'Cost Factor' } },
        { id: 'node2', type: 'option', data: { label: 'Option A' } },
        { id: 'node3', type: 'option', data: { label: 'Option B' } },
      ],
      edges: [
        { source: 'node1', target: 'node2' },
        { source: 'node1', target: 'node3' },
      ],
      ceeAnalysisReady: {
        status: 'ready',
        goal_node_id: 'goal1',
        options: [
          { id: 'node2', label: 'Option A', status: 'ready', interventions: {} },
          { id: 'node3', label: 'Option B', status: 'ready', interventions: {} },
        ],
      },
      ceeQuality: {
        overall: 8,
        structure: 9,
        coverage: 8,
        causality: 7,
        safety: 8,
      },
      setHighlightedNodes: vi.fn(),
      addNode: vi.fn(),
      setSelectedNodeId: vi.fn(),
      setInspectorOpen: vi.fn(),
    }
    return selector(mockState)
  }),
}))

vi.mock('../../../canvas/hooks/usePreRunValidation', () => ({
  usePreRunValidation: vi.fn(() => ({
    canRun: true,
    blockers: [],
    warnings: [],
  })),
}))

vi.mock('../../../canvas/hooks/useGraphReadiness', () => ({
  useGraphReadiness: vi.fn(() => ({
    readiness: {
      readiness_score: 85,
      readiness_level: 'strong',
      can_run_analysis: true,
      confidence_explanation: 'Your model has good structure and connections',
      improvements: [
        {
          category: 'completeness',
          action: 'Add risk factors',
          current_gap: '86% of connections use default weights',
          quality_impact: 5,
          target_quality: 90,
          priority: 'medium',
          effort_minutes: 10,
          affected_nodes: ['node1'],
        },
      ],
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

// v2.1: Mock the usePreAnalysisData hook
vi.mock('../../../canvas/hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(() => ({
    allIssues: [],
    fixFirstIssues: [],
    remainingCount: 0,
    limitingFactor: { label: 'Model quality unknown', hasActiveIssues: false },
    quality: { structure: 8, coverage: 8, safety: 8 },
    canRun: true,
    hasBlockers: false,
    readyOptionsCount: 2,
    totalOptionsCount: 2,
    edgeProvenance: { attributedCount: 2, totalCount: 2 },
    isLoading: false,
  })),
  CTA_LABELS: {
    focus: 'Focus →',
    markBaseline: 'Mark baseline →',
    addOption: 'Add option →',
    reviewRelationship: 'Review →',
    strengthenConnection: 'Connect →',
    view: 'View →',
  },
}))

describe('PreAnalysisReadinessPanel', () => {
  const mockOnAnalyse = vi.fn()
  const mockOnBlockersChange = vi.fn()
  const mockOnCanRunChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders two-line header with Can analyse and Model quality', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    // Line 1: Can analyse status
    expect(screen.getByText('Can analyse:')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()

    // Line 2: Model quality
    expect(screen.getByText('Model quality:')).toBeInTheDocument()
  })

  it('shows "Analyse Now" button when ready', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    const button = screen.getByRole('button', { name: /run analysis/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
    expect(screen.getByText('Analyse Now')).toBeInTheDocument()
  })

  it('shows "Analysing..." button when isAnalysing is true', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        isAnalysing={true}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    expect(screen.getByText('Analysing...')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /analysis in progress/i })
    expect(button).toBeDisabled()
  })

  it('shows Model Snapshot accordion with node and edge counts', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    // v2.2: Model Snapshot is now a collapsed accordion
    expect(screen.getByText('Model Snapshot')).toBeInTheDocument()
    // Shows node and edge counts in collapsed header
    expect(screen.getByText(/\d+ node/)).toBeInTheDocument()
    expect(screen.getByText(/\d+ edge/)).toBeInTheDocument()

    // Expand the Model Snapshot accordion
    const snapshotButton = screen.getByRole('button', { name: /Model Snapshot/i })
    fireEvent.click(snapshotButton)

    // v2.2: After expanding, shows category labels with inline items
    expect(screen.getByText('Target')).toBeInTheDocument()
    expect(screen.getByText('Options')).toBeInTheDocument()
    expect(screen.getByText('Factors')).toBeInTheDocument()

    // Option labels appear in multiple places (Model Snapshot + Ready State chips)
    expect(screen.getAllByText('Option A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Option B').length).toBeGreaterThanOrEqual(1)
  })

  it('renders Model Snapshot accordion collapsed by default', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    // v2.2: Model Snapshot starts collapsed
    const snapshotButton = screen.getByRole('button', { name: /Model Snapshot/i })
    expect(snapshotButton).toHaveAttribute('aria-expanded', 'false')

    // Content is not visible when collapsed
    expect(screen.queryByText('Target')).not.toBeInTheDocument()
    expect(screen.queryByText('Structure tab →')).not.toBeInTheDocument()
  })

  it('toggles readiness checks when clicked', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    const toggle = screen.getByText('Readiness Checks')
    fireEvent.click(toggle)

    // Should show dimension rows
    expect(screen.getByText('Structure')).toBeInTheDocument()
    expect(screen.getByText('Coverage')).toBeInTheDocument()
    expect(screen.getByText('Validation')).toBeInTheDocument()
  })

  it('shows dimension scores in readiness checks', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    // Expand readiness checks
    const toggle = screen.getByText('Readiness Checks')
    fireEvent.click(toggle)

    // Should show actual dimension scores
    expect(screen.getByText('9/10')).toBeInTheDocument() // Structure
    expect(screen.getByText('8/10')).toBeInTheDocument() // Coverage
    expect(screen.getByText('8/8')).toBeInTheDocument() // Validation
  })

  it('calls onAnalyse when button is clicked', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    const button = screen.getByRole('button', { name: /run analysis/i })
    fireEvent.click(button)

    expect(mockOnAnalyse).toHaveBeenCalledTimes(1)
  })

  it('calls onCanRunChange with readiness state', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    expect(mockOnCanRunChange).toHaveBeenCalledWith(true)
  })

  it('calls onBlockersChange with blocker state', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    // No blockers, should be called with false
    expect(mockOnBlockersChange).toHaveBeenCalledWith(false)
  })
})

describe('PreAnalysisReadinessPanel with blockers', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Override hook to return blockers
    const { usePreRunValidation } = await import('../../../canvas/hooks/usePreRunValidation')
    vi.mocked(usePreRunValidation).mockReturnValue({
      canRun: false,
      blockers: [
        {
          code: 'INTERVENTION_TARGET_NOT_FOUND',
          message: 'Option targets missing factor',
          affectedIds: ['node2'],
          action: { type: 'focus', label: 'Focus', nodeId: 'node1' },
        },
        {
          code: 'OPTIONS_NEED_MAPPING',
          message: '2 options need intervention values',
          affectedIds: ['node2', 'node3'],
        },
      ],
      warnings: [],
    })

    // v2.1: Also override usePreAnalysisData to report blockers
    const { usePreAnalysisData } = await import('../../../canvas/hooks/usePreAnalysisData')
    vi.mocked(usePreAnalysisData).mockReturnValue({
      allIssues: [
        {
          key: 'blocker-1',
          severity: 'blocker' as const,
          category: 'validation' as const,
          title: 'Options reference missing factor',
          why: 'Option targets missing factor',
          actions: [],
          source: 'validation_warning' as const,
        },
      ],
      fixFirstIssues: [
        {
          key: 'blocker-1',
          severity: 'blocker' as const,
          category: 'validation' as const,
          title: 'Options reference missing factor',
          why: 'Option targets missing factor',
          actions: [],
          source: 'validation_warning' as const,
        },
      ],
      remainingCount: 0,
      limitingFactor: { label: 'Validation', hasActiveIssues: true },
      quality: { structure: 8, coverage: 8, safety: 4 },
      canRun: false,
      hasBlockers: true,
      readyOptionsCount: 0,
      totalOptionsCount: 2,
      edgeProvenance: { attributedCount: 0, totalCount: 0 },
      isLoading: false,
    })
  })

  it('shows blocked status when blockers exist', async () => {
    const mockOnAnalyse = vi.fn()

    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Should show blocked status
    expect(screen.getByText(/Blocked:/)).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /fix issues/i })
    expect(button).toBeDisabled()
  })

  it('shows blocking issue cards', async () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Should show human-readable title in Fix First section
    expect(screen.getByText('Options reference missing factor')).toBeInTheDocument()
  })
})

describe('PreAnalysisReadinessPanel empty state', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Override store to return empty nodes
    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        ceeQuality: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })
  })

  it('returns null when canvas is empty', () => {
    const { container } = render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    expect(container.firstChild).toBeNull()
  })
})

describe('PreAnalysisReadinessPanel dimension thresholds', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Override store with specific quality values for threshold testing
    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
          { id: 'node1', type: 'factor', data: { label: 'Factor' } },
        ],
        edges: [],
        ceeAnalysisReady: { status: 'ready', goal_node_id: 'goal1', options: [] },
        ceeQuality: {
          overall: 7,
          structure: 9, // green (≥8)
          coverage: 6, // warning (5-7)
          causality: 5,
          safety: 4, // error (<5)
        },
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })
  })

  it('applies correct severity icons based on score thresholds', async () => {
    const { container } = render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Expand readiness checks
    const toggle = screen.getByText('Readiness Checks')
    fireEvent.click(toggle)

    // Check for dimension labels
    expect(screen.getByText('Structure')).toBeInTheDocument()
    expect(screen.getByText('Coverage')).toBeInTheDocument()
    expect(screen.getByText('Validation')).toBeInTheDocument()

    // Check scores
    expect(screen.getByText('9/10')).toBeInTheDocument() // Structure
    expect(screen.getByText('6/10')).toBeInTheDocument() // Coverage
    expect(screen.getByText('4/8')).toBeInTheDocument() // Validation (safety)
  })
})

describe('PreAnalysisReadinessPanel Review button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has Review button that scrolls to readiness checks', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Find Review button
    const reviewButton = screen.getByRole('button', { name: /review/i })
    expect(reviewButton).toBeInTheDocument()
  })

  it('has proper ARIA attributes on readiness checks toggle', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    const toggle = screen.getByText('Readiness Checks').closest('button')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'quality-breakdown-content')

    // Click to expand
    fireEvent.click(toggle!)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

// ============================================================================
// Phase 1b Critical Path Tests
// ============================================================================

describe('PreAnalysisReadinessPanel Phase 1b - Connectivity blocker', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Increase Revenue' } },
          { id: 'opt1', type: 'option', data: { label: 'Option A' } },
          { id: 'opt2', type: 'option', data: { label: 'Option B' } },
        ],
        edges: [],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          options: [
            { id: 'opt1', label: 'Option A', status: 'ready', interventions: {} },
            { id: 'opt2', label: 'Option B', status: 'ready', interventions: {} },
          ],
        },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        // Phase 1b: Goal connectivity with status 'none' (blocker)
        ceeGoalConnectivity: {
          status: 'none',
          disconnected_options: ['opt1'],
          weak_paths: [],
        },
        ceeExtendedWarnings: null,
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })

    // v2.1: Also override usePreAnalysisData to report connectivity blocker
    const { usePreAnalysisData } = await import('../../../canvas/hooks/usePreAnalysisData')
    vi.mocked(usePreAnalysisData).mockReturnValue({
      allIssues: [
        {
          key: 'connectivity-blocker',
          severity: 'blocker' as const,
          category: 'connectivity' as const,
          title: 'Option disconnected from goal',
          why: 'Option A has no path to the goal',
          focus: { type: 'node' as const, id: 'opt1', label: 'Option A' },
          actions: [],
          source: 'connectivity' as const,
        },
      ],
      fixFirstIssues: [
        {
          key: 'connectivity-blocker',
          severity: 'blocker' as const,
          category: 'connectivity' as const,
          title: 'Option disconnected from goal',
          why: 'Option A has no path to the goal',
          focus: { type: 'node' as const, id: 'opt1', label: 'Option A' },
          actions: [],
          source: 'connectivity' as const,
        },
      ],
      remainingCount: 0,
      limitingFactor: { label: 'Connectivity', hasActiveIssues: true },
      quality: { structure: 8, coverage: 8, safety: 8 },
      canRun: false,
      hasBlockers: true,
      readyOptionsCount: 2,
      totalOptionsCount: 2,
      edgeProvenance: { attributedCount: 0, totalCount: 0 },
      isLoading: false,
    })
  })

  it('disables Analyse button when goal_connectivity.status is none', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Button should be disabled due to CEE blocker
    const button = screen.getByRole('button', { name: /fix issues/i })
    expect(button).toBeDisabled()

    // Should show blocked status
    expect(screen.getByText(/Blocked:/)).toBeInTheDocument()
  })

  it('shows disconnected option label in connectivity badge', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // v2.2: Goal Connectivity is now inside Readiness Checks accordion - expand it first
    const readinessButton = screen.getByText('Readiness Checks')
    fireEvent.click(readinessButton)

    // Should show Goal Connectivity section with blocked status
    expect(screen.getByText('Goal Connectivity')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByText(/Disconnected:/)).toBeInTheDocument()
    // Option A appears in multiple places - just verify it's in the DOM
    expect(screen.getAllByText(/Option A/).length).toBeGreaterThanOrEqual(1)
  })
})

describe('PreAnalysisReadinessPanel Phase 1b - Connectivity warning with focus', () => {
  const mockFocusEdgeById = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()

    // Mock focusHelpers
    const focusHelpers = await import('../../../canvas/utils/focusHelpers')
    vi.mocked(focusHelpers.focusEdgeById).mockImplementation(mockFocusEdgeById)

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Increase Revenue' } },
          { id: 'opt1', type: 'option', data: { label: 'Option A' } },
          { id: 'factor1', type: 'factor', data: { label: 'Price Factor' } },
        ],
        edges: [
          { id: 'edge1', source: 'opt1', target: 'factor1', data: { label: 'weak link' } },
        ],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          options: [{ id: 'opt1', label: 'Option A', status: 'ready', interventions: {} }],
        },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        // Phase 1b: Goal connectivity with partial status and weak paths
        ceeGoalConnectivity: {
          status: 'partial',
          disconnected_options: [],
          weak_paths: [
            {
              option_id: 'opt1',
              reason: 'low_strength',
              weak_edge_ids: ['edge1'],
            },
          ],
        },
        ceeExtendedWarnings: null,
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })
  })

  it('shows weak paths status and Focus button targets edge', async () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // v2.2: Goal Connectivity is now inside Readiness Checks accordion - expand it first
    const readinessButton = screen.getByText('Readiness Checks')
    fireEvent.click(readinessButton)

    // Should show partial connectivity status
    expect(screen.getByText('Goal Connectivity')).toBeInTheDocument()
    expect(screen.getByText('Weak paths')).toBeInTheDocument()

    // Should show weak influence reason
    expect(screen.getByText(/weak influence/)).toBeInTheDocument()

    // Click Focus button for the weak edge
    const focusButtons = screen.getAllByRole('button', { name: /focus/i })
    const weakPathFocusButton = focusButtons.find(btn =>
      btn.closest('[class*="pl-4"]') // Inside the weak paths section
    )

    if (weakPathFocusButton) {
      fireEvent.click(weakPathFocusButton)
      expect(mockFocusEdgeById).toHaveBeenCalledWith('edge1')
    }
  })
})

describe('PreAnalysisReadinessPanel Phase 1b - Warning severity ordering', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
          { id: 'node1', type: 'factor', data: { label: 'Factor 1' } },
          { id: 'node2', type: 'factor', data: { label: 'Factor 2' } },
          { id: 'node3', type: 'factor', data: { label: 'Factor 3' } },
          { id: 'node4', type: 'factor', data: { label: 'Factor 4' } },
        ],
        edges: [],
        ceeAnalysisReady: { status: 'ready', goal_node_id: 'goal1', options: [] },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        ceeGoalConnectivity: null,
        // Warnings with mixed severities (intentionally out of order)
        ceeExtendedWarnings: [
          { id: 'w1', code: 'LOW_WARNING', severity: 'low', message: 'Low severity warning', affected_node_ids: ['node1'], affected_edge_ids: [] },
          { id: 'w2', code: 'HIGH_WARNING', severity: 'high', message: 'High severity warning', affected_node_ids: ['node2'], affected_edge_ids: [] },
          { id: 'w3', code: 'MEDIUM_WARNING', severity: 'medium', message: 'Medium severity warning', affected_node_ids: ['node3'], affected_edge_ids: [] },
        ],
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })
  })

  it('displays warnings sorted by severity: high → medium → low', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Get all warning messages in order
    const highWarning = screen.getByText('High severity warning')
    const mediumWarning = screen.getByText('Medium severity warning')
    const lowWarning = screen.getByText('Low severity warning')

    // Verify they exist and check DOM order
    expect(highWarning).toBeInTheDocument()
    expect(mediumWarning).toBeInTheDocument()
    expect(lowWarning).toBeInTheDocument()

    // High should appear before medium, medium before low in the DOM
    const allWarnings = screen.getAllByText(/severity warning/)
    expect(allWarnings[0]).toHaveTextContent('High severity warning')
    expect(allWarnings[1]).toHaveTextContent('Medium severity warning')
    expect(allWarnings[2]).toHaveTextContent('Low severity warning')
  })
})

describe('PreAnalysisReadinessPanel Phase 1b - Focus target precedence', () => {
  const mockFocusNodeById = vi.fn()
  const mockFocusEdgeById = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()

    // Mock focusHelpers
    const focusHelpers = await import('../../../canvas/utils/focusHelpers')
    vi.mocked(focusHelpers.focusNodeById).mockImplementation(mockFocusNodeById)
    vi.mocked(focusHelpers.focusEdgeById).mockImplementation(mockFocusEdgeById)

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
          { id: 'n1', type: 'factor', data: { label: 'Factor 1' } },
          { id: 'n2', type: 'factor', data: { label: 'Factor 2' } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
        ],
        ceeAnalysisReady: { status: 'ready', goal_node_id: 'goal1', options: [] },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        ceeGoalConnectivity: null,
        // Warning with both node and edge IDs - node should take precedence
        ceeExtendedWarnings: [
          {
            id: 'w1',
            code: 'TEST_WARNING',
            severity: 'medium',
            message: 'Warning with both node and edge',
            affected_node_ids: ['n1'],
            affected_edge_ids: ['e1'],
          },
        ],
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })
  })

  it('focuses node when warning has both affected_node_ids and affected_edge_ids', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Find the warning card's Focus button (in the warning section)
    // The warning message helps identify the right section
    const warningText = screen.getByText('Warning with both node and edge')
    const warningCard = warningText.closest('div[class*="rounded-lg border"]')
    const focusButton = warningCard?.querySelector('button')

    expect(focusButton).toBeTruthy()
    fireEvent.click(focusButton!)

    // Node should be focused, not edge (node takes precedence)
    expect(mockFocusNodeById).toHaveBeenCalledWith('n1')
    expect(mockFocusEdgeById).not.toHaveBeenCalled()
  })
})

describe('PreAnalysisReadinessPanel Phase 1b - Focus target edge fallback', () => {
  const mockFocusNodeById = vi.fn()
  const mockFocusEdgeById = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()

    // Mock focusHelpers
    const focusHelpers = await import('../../../canvas/utils/focusHelpers')
    vi.mocked(focusHelpers.focusNodeById).mockImplementation(mockFocusNodeById)
    vi.mocked(focusHelpers.focusEdgeById).mockImplementation(mockFocusEdgeById)

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
          { id: 'n1', type: 'factor', data: { label: 'Factor 1' } },
          { id: 'n2', type: 'factor', data: { label: 'Factor 2' } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
        ],
        ceeAnalysisReady: { status: 'ready', goal_node_id: 'goal1', options: [] },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        ceeGoalConnectivity: null,
        // Warning with only edge IDs - should focus edge
        ceeExtendedWarnings: [
          {
            id: 'w1',
            code: 'EDGE_ONLY_WARNING',
            severity: 'medium',
            message: 'Warning with only edge',
            affected_node_ids: [],
            affected_edge_ids: ['e1'],
          },
        ],
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })
  })

  it('focuses edge when warning has only affected_edge_ids', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Find the warning card's Focus button (in the warning section)
    const warningText = screen.getByText('Warning with only edge')
    const warningCard = warningText.closest('div[class*="rounded-lg border"]')
    const focusButton = warningCard?.querySelector('button')

    expect(focusButton).toBeTruthy()
    fireEvent.click(focusButton!)

    // Edge should be focused (node array is empty)
    expect(mockFocusEdgeById).toHaveBeenCalledWith('e1')
    expect(mockFocusNodeById).not.toHaveBeenCalled()
  })
})

describe('PreAnalysisReadinessPanel Phase 1b - Edge label fallback', () => {
  it('displays edge label when present', async () => {
    vi.clearAllMocks()

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
          { id: 'price', type: 'factor', data: { label: 'Price' } },
          { id: 'revenue', type: 'factor', data: { label: 'Revenue' } },
        ],
        edges: [
          { id: 'e1', source: 'price', target: 'revenue', label: 'Custom Label' },
        ],
        ceeAnalysisReady: { status: 'ready', goal_node_id: 'goal1', options: [] },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        ceeGoalConnectivity: {
          status: 'partial',
          disconnected_options: [],
          weak_paths: [
            { option_id: 'price', reason: 'low_strength', weak_edge_ids: ['e1'] },
          ],
        },
        ceeExtendedWarnings: null,
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })

    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // v2.2: Goal Connectivity is now inside Readiness Checks accordion - expand it first
    const readinessButton = screen.getByText('Readiness Checks')
    fireEvent.click(readinessButton)

    // Should show the custom label in the weak path description
    expect(screen.getByText(/Custom Label/)).toBeInTheDocument()
  })

  it('falls back to source→target when edge has no label', async () => {
    vi.clearAllMocks()

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
          { id: 'price', type: 'factor', data: { label: 'Price' } },
          { id: 'revenue', type: 'factor', data: { label: 'Revenue' } },
        ],
        edges: [
          // Edge without label - should show "Price → Revenue"
          { id: 'e2', source: 'price', target: 'revenue' },
        ],
        ceeAnalysisReady: { status: 'ready', goal_node_id: 'goal1', options: [] },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        ceeGoalConnectivity: {
          status: 'partial',
          disconnected_options: [],
          weak_paths: [
            { option_id: 'price', reason: 'low_strength', weak_edge_ids: ['e2'] },
          ],
        },
        ceeExtendedWarnings: null,
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })

    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // v2.2: Goal Connectivity is now inside Readiness Checks accordion - expand it first
    const readinessButton = screen.getByText('Readiness Checks')
    fireEvent.click(readinessButton)

    // Should show source→target format
    expect(screen.getByText(/Price → Revenue/)).toBeInTheDocument()
  })

  it('shows "Unnamed relationship" when source/target nodes not found', async () => {
    vi.clearAllMocks()

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
          // Missing: nodes for 'missing1' and 'missing2'
        ],
        edges: [
          // Edge with missing source/target nodes
          { id: 'e3', source: 'missing1', target: 'missing2' },
        ],
        ceeAnalysisReady: { status: 'ready', goal_node_id: 'goal1', options: [] },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        ceeGoalConnectivity: {
          status: 'partial',
          disconnected_options: [],
          weak_paths: [
            { option_id: 'missing1', reason: 'low_strength', weak_edge_ids: ['e3'] },
          ],
        },
        ceeExtendedWarnings: null,
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })

    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // v2.2: Goal Connectivity is now inside Readiness Checks accordion - expand it first
    const readinessButton = screen.getByText('Readiness Checks')
    fireEvent.click(readinessButton)

    // Should show "Unnamed relationship" fallback
    expect(screen.getByText(/Unnamed relationship/)).toBeInTheDocument()
  })
})

describe('PreAnalysisReadinessPanel Phase 1b - Blocker via severity', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
          { id: 'opt1', type: 'option', data: { label: 'Option A' } },
        ],
        edges: [],
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          options: [{ id: 'opt1', label: 'Option A', status: 'ready', interventions: {} }],
        },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        ceeGoalConnectivity: { status: 'full', disconnected_options: [], weak_paths: [] },
        // Warning with severity: 'blocker' should disable Analyse
        ceeExtendedWarnings: [
          {
            id: 'w1',
            code: 'GOAL_CONNECTIVITY_NONE',
            severity: 'blocker',
            message: 'Goal is not connected to any options',
            affected_node_ids: ['goal1'],
            affected_edge_ids: [],
          },
        ],
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })

    // v2.1: Also override usePreAnalysisData to report blocker
    const { usePreAnalysisData } = await import('../../../canvas/hooks/usePreAnalysisData')
    vi.mocked(usePreAnalysisData).mockReturnValue({
      allIssues: [
        {
          key: 'severity-blocker',
          severity: 'blocker' as const,
          category: 'connectivity' as const,
          title: 'Goal disconnected',
          why: 'Goal is not connected to any options',
          focus: { type: 'node' as const, id: 'goal1', label: 'Goal' },
          actions: [],
          source: 'draft_warning' as const,
        },
      ],
      fixFirstIssues: [
        {
          key: 'severity-blocker',
          severity: 'blocker' as const,
          category: 'connectivity' as const,
          title: 'Goal disconnected',
          why: 'Goal is not connected to any options',
          focus: { type: 'node' as const, id: 'goal1', label: 'Goal' },
          actions: [],
          source: 'draft_warning' as const,
        },
      ],
      remainingCount: 0,
      limitingFactor: { label: 'Connectivity', hasActiveIssues: true },
      quality: { structure: 8, coverage: 8, safety: 8 },
      canRun: false,
      hasBlockers: true,
      readyOptionsCount: 1,
      totalOptionsCount: 1,
      edgeProvenance: { attributedCount: 0, totalCount: 0 },
      isLoading: false,
    })
  })

  it('disables Analyse button when draft_warnings includes severity blocker', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Button should be disabled due to blocker severity warning
    const button = screen.getByRole('button', { name: /fix issues/i })
    expect(button).toBeDisabled()

    // Should show blocked status
    expect(screen.getByText(/Blocked:/)).toBeInTheDocument()
  })
})

describe('PreAnalysisReadinessPanel Phase 1b - Same lever detection', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
          { id: 'optA', type: 'option', data: { label: 'Option A' } },
          { id: 'optB', type: 'option', data: { label: 'Option B' } },
          { id: 'price', type: 'factor', data: { label: 'Price' } },
          { id: 'packaging', type: 'factor', data: { label: 'Packaging' } },
        ],
        edges: [],
        // Option A targets price only, Option B targets price AND packaging
        // Should warn about shared 'Price' factor
        ceeAnalysisReady: {
          status: 'ready',
          goal_node_id: 'goal1',
          options: [
            { id: 'optA', label: 'Option A', status: 'ready', interventions: { price: { value: 10 } } },
            { id: 'optB', label: 'Option B', status: 'ready', interventions: { price: { value: 20 }, packaging: { value: 5 } } },
          ],
        },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        ceeGoalConnectivity: null,
        ceeExtendedWarnings: null,
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })
  })

  it('warns when ≥2 options share ≥1 factor (not just when ALL options share)', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Should show same lever warning section
    expect(screen.getByText('Framing (same lever)')).toBeInTheDocument()
    // Should show the shared factor with option labels
    const sameLeverSection = screen.getByText('Framing (same lever)').closest('div[class*="space-y-2"]')
    expect(sameLeverSection?.textContent).toContain('Price')
    // Should show which options share the factor
    expect(sameLeverSection?.textContent).toContain('Option A')
    expect(sameLeverSection?.textContent).toContain('Option B')
  })
})

describe('PreAnalysisReadinessPanel Phase 1b - Edge provenance unknown', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
          { id: 'factor1', type: 'factor', data: { label: 'Factor 1' } },
          { id: 'factor2', type: 'factor', data: { label: 'Factor 2' } },
        ],
        edges: [
          // Edge with explicit 'default' provenance
          { id: 'e1', source: 'goal1', target: 'factor1', data: { provenance: 'default' } },
          // Edge with no provenance (should be counted as 'unknown')
          { id: 'e2', source: 'factor1', target: 'factor2', data: {} },
          // Edge with undefined data
          { id: 'e3', source: 'factor2', target: 'goal1' },
        ],
        ceeAnalysisReady: { status: 'ready', goal_node_id: 'goal1', options: [] },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        ceeGoalConnectivity: null,
        ceeExtendedWarnings: null,
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })

    // v2.1: Override usePreAnalysisData mock to show edge provenance
    const { usePreAnalysisData } = await import('../../../canvas/hooks/usePreAnalysisData')
    vi.mocked(usePreAnalysisData).mockReturnValue({
      allIssues: [],
      fixFirstIssues: [],
      remainingCount: 0,
      limitingFactor: { label: 'Model quality unknown', hasActiveIssues: false },
      quality: { structure: 8, coverage: 8, safety: 8 },
      canRun: true,
      hasBlockers: false,
      readyOptionsCount: 0,
      totalOptionsCount: 0,
      // 3 edges total, 1 has attribution (1 out of 3)
      edgeProvenance: { attributedCount: 1, totalCount: 3 },
      isLoading: false,
    })
  })

  it('shows provenance info in natural language inside Readiness Checks accordion', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // v2.1: First expand the Readiness Checks accordion
    const readinessToggle = screen.getByText('Readiness Checks')
    fireEvent.click(readinessToggle)

    // v2.1: Should show Provenance section with natural language phrasing
    expect(screen.getByText('Provenance')).toBeInTheDocument()
    // Should show "Recorded for 1 of 3 relationships" (based on mock data)
    expect(screen.getByText(/Recorded for 1 of 3 relationships/)).toBeInTheDocument()
  })
})

describe('PreAnalysisReadinessPanel Phase 1b - EDGE_ORIGIN_DEFAULTED filter', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [
          { id: 'goal1', type: 'goal', data: { label: 'Goal' } },
        ],
        edges: [],
        ceeAnalysisReady: { status: 'ready', goal_node_id: 'goal1', options: [] },
        ceeQuality: { overall: 8, structure: 9, coverage: 8, causality: 7, safety: 8 },
        ceeGoalConnectivity: null,
        // EDGE_ORIGIN_DEFAULTED should be filtered from user display
        ceeExtendedWarnings: [
          {
            id: 'w1',
            code: 'EDGE_ORIGIN_DEFAULTED',
            severity: 'info',
            message: 'Edge uses default values',
            affected_node_ids: [],
            affected_edge_ids: ['e1'],
          },
          {
            id: 'w2',
            code: 'SOME_OTHER_WARNING',
            severity: 'medium',
            message: 'Some other warning message',
            affected_node_ids: ['goal1'],
            affected_edge_ids: [],
          },
        ],
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
        setHighlightedNodes: vi.fn(),
        addNode: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setInspectorOpen: vi.fn(),
      }
      return selector(mockState)
    })
  })

  it('does not show EDGE_ORIGIN_DEFAULTED warning to users', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Should NOT show EDGE_ORIGIN_DEFAULTED message
    expect(screen.queryByText('Edge uses default values')).not.toBeInTheDocument()

    // Should show the other warning
    expect(screen.getByText('Some other warning message')).toBeInTheDocument()
  })
})
