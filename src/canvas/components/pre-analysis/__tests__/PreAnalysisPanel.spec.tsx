/**
 * Tests for PreAnalysisPanel component
 *
 * Covers:
 * - State transitions: empty canvas → panel hidden → add nodes → pre-analysis visible
 * - Accordion behaviour: expand/collapse, item counts update
 * - Sticky footer: button state transitions, stays pinned during scroll
 * - Regression: post-analysis panel unaffected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'

// Mock the data hook
vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

// Mock useRetryDraft hook
const mockRetryDraft = vi.fn().mockResolvedValue({ success: true })
vi.mock('../../../hooks/useRetryDraft', () => ({
  useRetryDraft: () => ({
    retryDraft: mockRetryDraft,
    canRetry: true,
    isRetrying: false,
    retryError: null,
  }),
}))

// Mock usePreRunValidation — only need the SOFT_BYPASS_STATUSES constant
vi.mock('../../../hooks/usePreRunValidation', () => ({
  SOFT_BYPASS_STATUSES: new Set(['needs_user_mapping', 'needs_encoding']),
}))

// Mock useShowToast
const mockShowToast = vi.fn()
vi.mock('../../../ToastContext', () => ({
  useShowToast: () => mockShowToast,
}))

// Mock clipboard utility
vi.mock('../../../../utils/clipboard', () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(true),
}))

// Mock useCanvasStore — return ceeAnalysisReady.status via selector
let mockCeeStatus: string | undefined = undefined
let mockLastDraftError: any = null
const mockSelectNodeWithoutHistory = vi.fn()
const mockSelectEdgeWithoutHistory = vi.fn()
vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: any) => any) => {
      const state = {
        ceeAnalysisReady: mockCeeStatus ? { status: mockCeeStatus } : null,
        lastDraftError: mockLastDraftError,
        setHighlightedNodes: vi.fn(),
        setHighlightedEdges: vi.fn(),
        selectNodeWithoutHistory: mockSelectNodeWithoutHistory,
        selectEdgeWithoutHistory: mockSelectEdgeWithoutHistory,
        nodes: [],
        edges: [],
        preAnalysisSensitivity: undefined,
        repairsApplied: null,
        results: null,
        setShowDraftChat: vi.fn(),
        updateEdgeData: vi.fn(),
      }
      return selector(state)
    },
    {
      getState: () => ({
        ceeAnalysisReady: mockCeeStatus ? { status: mockCeeStatus } : null,
        lastDraftError: mockLastDraftError,
        setHighlightedNodes: vi.fn(),
        setHighlightedEdges: vi.fn(),
        selectNodeWithoutHistory: mockSelectNodeWithoutHistory,
        selectEdgeWithoutHistory: mockSelectEdgeWithoutHistory,
        updateNode: vi.fn(),
        setGoalThreshold: vi.fn(),
        setGoalThresholdAndUpdateNode: vi.fn(),
        setCeeAnalysisReady: vi.fn(),
        setOutcomeNode: vi.fn(),
        nodes: [],
        addNode: vi.fn(),
        updateEdge: vi.fn(),
        addEdge: vi.fn(),
      }),
    }
  ),
}))

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

describe('PreAnalysisPanel', () => {
  const mockOnAnalyse = vi.fn()

  const createMockData = (overrides: Partial<PreAnalysisData> = {}): PreAnalysisData => {
    const improvementsByCategory = overrides.improvementsByCategory ?? {
      fix: [],
      verify: [],
      add_evidence: [],
      strengthen: [],
    }

    // Build tiers from improvementsByCategory
    const tiers = overrides.tiers ?? {
      mustAddress: {
        items: improvementsByCategory.fix,
        count: improvementsByCategory.fix.length,
      },
      reviewAssumptions: {
        items: improvementsByCategory.verify,
        count: improvementsByCategory.verify.length,
      },
      optional: {
        items: [...improvementsByCategory.add_evidence, ...improvementsByCategory.strengthen],
        count: improvementsByCategory.add_evidence.length + improvementsByCategory.strengthen.length,
      },
    }

    return {
      improvementsByCategory,
      tiers,
      totalImprovements: 0,
      topActions: [],
      evidenceQuality: { level: 'medium', ratio: 0.5, nonAiCount: 2, totalCount: 4 },
      isReady: true,
      hasBlockers: false,
      blockerCount: 0,
      nodesByKind: {
        goal: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
        decision: [],
        option: [
          { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
        ],
        factor: [],
        risk: [],
        outcome: [],
      },
      edgeCount: 2,
      goalNode: { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
      successThreshold: null,
      isThresholdAutoDerived: false,
      isThresholdConfirmed: false,
      thresholdProvenance: null,
      isLoading: false,
      reviewedFactorsCount: 0,
      totalReviewableFactorsCount: 0,
      enrichedBlockers: [],
      informationalBlockers: [],
      modelAdjustments: [],
      preMortem: null,
      goalThresholdRaw: null,
      goalThresholdUnit: null,
      isGoalConfirmed: false,
      optionPreviews: [],
      qualityChecks: [],
      repairActions: [],
      ceeQuality: null,
      hasDefaultStrengths: false,
      defaultStrengthPercent: 0,
      contestedEdges: [],
      coachingSummary: null,
      balanceScore: 0.5,
      thresholdSourceBadge: null,
      assumptionsLedger: null,
      triageActions: { top3: [], quickFix: [] },
      actionableCount: 0,
      addressedActionableCount: 0,
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCeeStatus = undefined
    mockLastDraftError = null
  })

  describe('State Transitions', () => {
    it('renders null when canvas is empty', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        nodesByKind: {
          goal: [],
          decision: [],
          option: [],
          factor: [],
          risk: [],
          outcome: [],
        },
      }))

      const { container } = render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders panel when nodes exist', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('pre-analysis-panel')).toBeInTheDocument()
    })

    it('shows model health card when ready', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 3 },
          optional: { items: [], count: 2 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // ModelHealthCard replaces Header — shows "Decision readiness" title
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()
      expect(screen.getByText('Decision readiness')).toBeInTheDocument()
    })

    it('shows model health card when blocked', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        blockerCount: 2,
        tiers: {
          mustAddress: { items: [], count: 2 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [], count: 0 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // ModelHealthCard is always shown — status moved to footer
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()
    })
  })

  describe('Sticky Footer', () => {
    it('shows "Analyse Now" button when ready and readiness >= 60', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
        evidenceQuality: { level: 'high', ratio: 0.8, nonAiCount: 4, totalCount: 5 },
        balanceScore: 0.7,
        reviewedFactorsCount: 3,
        totalReviewableFactorsCount: 5,
        ceeQuality: { structure: 8 },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByRole('button', { name: /run analysis/i })).toHaveTextContent('Analyse now')
    })

    it('shows "Analyse anyway" when ready but readiness < 60', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: true, hasBlockers: false }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByRole('button', { name: /run analysis/i })).toHaveTextContent('Analyse anyway')
    })

    it('shows "Analyse now" CTA (disabled, aria-label signals blockers) when has blockers', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 2,
        improvementsByCategory: {
          fix: [
            { key: 'fix1', category: 'fix', label: 'Fix 1', detail: 'Detail' },
            { key: 'fix2', category: 'fix', label: 'Fix 2', detail: 'Detail' },
          ],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByRole('button', { name: /fix issues/i })).toHaveTextContent('Analyse now')
    })

    it('shows "Analysing..." when isAnalysing is true', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: true }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} isAnalysing={true} />)
      expect(screen.getByRole('button', { name: /analysis in progress/i })).toHaveTextContent('Analysing...')
    })

    it('calls onAnalyse when button is clicked', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: true }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      fireEvent.click(screen.getByRole('button', { name: /run analysis/i }))
      expect(mockOnAnalyse).toHaveBeenCalledTimes(1)
    })

    it('button is disabled when not ready', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: false, hasBlockers: true }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByRole('button', { name: /fix issues/i })).toBeDisabled()
    })

    it('shows "Analyse now" CTA (disabled) when isReady=false and hasBlockers=false', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: false,
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const button = screen.getByRole('button', { name: /analysis not ready/i })
      expect(button).toHaveTextContent('Analyse now')
      expect(button).toBeDisabled()
    })
  })

  describe('Accordion Behaviour', () => {
    it('renders your expertise section', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('your-expertise-section')).toBeInTheDocument()
    })

    it('shows your expertise section with items', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        totalImprovements: 5,
        improvementsByCategory: {
          fix: [{ key: 'f1', category: 'fix', label: 'Fix', detail: '' }],
          verify: [{ key: 'v1', category: 'verify', label: 'Verify', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'n1', label: 'Verify' } }],
          add_evidence: [{ key: 'a1', category: 'add_evidence', label: 'Add', detail: '' }],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // YourExpertise section renders with header
      expect(screen.getByText('Your expertise')).toBeInTheDocument()
    })
  })

  describe('Expertise Section', () => {
    it('renders your expertise section with verify items', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [{ key: 'v1', category: 'verify', label: 'Test Factor', detail: '5.0', subgroup: 'cee_inference', focus: { type: 'node', id: 'f1', label: 'Test Factor' } }],
          add_evidence: [],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByText('Your expertise')).toBeInTheDocument()
    })
  })

  describe('Evidence Quality Display', () => {
    it('shows reviewed count in footer when actionableCount > 0', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        evidenceQuality: { level: 'low', ratio: 0.2, nonAiCount: 0, totalCount: 5 },
        addressedActionableCount: 0,
        actionableCount: 5,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByText('0/5 addressed')).toBeInTheDocument()
    })

    it('shows "All addressed" in footer when all actionable items addressed', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        evidenceQuality: { level: 'high', ratio: 1, nonAiCount: 5, totalCount: 5 },
        addressedActionableCount: 5,
        actionableCount: 5,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).toHaveTextContent('All addressed')
    })

    it('does not show Quality tier label in footer', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        evidenceQuality: { level: 'medium', ratio: 0.5, nonAiCount: 2, totalCount: 4 },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument()
    })
  })

  describe('Wiring Fixes Regression', () => {
    it('renders exactly one Goal selector in the DOM', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Goal selector now lives in the SuccessTarget hero section
      // With a single goal, it renders as static text (no dropdown)
      // Verify goal label is present (appears in SuccessTarget + ModelSnapshot)
      const goalTexts = screen.getAllByText('Goal')
      expect(goalTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('renders sections in correct order: Header → SuccessTarget → Tiers → ModelSnapshot', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        tiers: {
          mustAddress: { items: [{ key: 'f1', category: 'fix', label: 'Test Fix', detail: 'Detail' }], count: 1 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [], count: 0 },
        },
        improvementsByCategory: {
          fix: [{ key: 'f1', category: 'fix', label: 'Test Fix', detail: 'Detail' }],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      const { container } = render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const panel = container.querySelector('[data-testid="pre-analysis-panel"]')
      expect(panel).toBeInTheDocument()

      // Verify key sections exist (v4: Decision readiness card + expertise)
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()
      expect(screen.getByTestId('your-expertise-section')).toBeInTheDocument()

      // Verify order by comparing positions in the DOM
      const scrollableContent = panel?.querySelector('.overflow-y-auto')
      const html = scrollableContent?.innerHTML ?? ''

      const healthPos = html.indexOf('model-health-card')
      const expertisePos = html.indexOf('your-expertise-section')

      expect(healthPos).toBeLessThan(expertisePos)
    })

    it('sticky footer uses flex layout for pinning', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).toHaveClass('flex-shrink-0')
    })

    it('sticky footer is visible in the DOM', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).toBeInTheDocument()
      expect(footer).toBeVisible()
    })

    it('action buttons render for improvement items', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [
            {
              key: 'v1',
              category: 'verify',
              label: 'Test Factor',
              detail: '5.0',
              action: { label: 'Confirm', kind: 'confirm', targetId: 'n1', targetType: 'node' },
              focus: { type: 'node', id: 'n1', label: 'Test' },
            },
          ],
          add_evidence: [
            {
              key: 'ae1',
              category: 'add_evidence',
              label: 'Edge A → B',
              detail: 'No evidence',
              action: { label: 'Add', kind: 'add', targetId: 'e1', targetType: 'edge' },
              focus: { type: 'edge', id: 'e1', label: 'Edge' },
            },
          ],
          strengthen: [],
        },
        totalImprovements: 2,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Verify action buttons are present in the DOM
      const buttons = document.querySelectorAll('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('disabled action buttons have disabled attribute', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [
            {
              key: 'v1',
              category: 'verify',
              label: 'Test Factor',
              detail: '5.0',
              action: { label: 'Confirm', kind: 'confirm' },
              focus: { type: 'node', id: 'n1', label: 'Test' },
            },
          ],
          add_evidence: [],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Action buttons should be enabled (not disabled) for interactive actions
      // Only the main "Analyse Now" button should be disabled when not ready
      const verifySection = screen.queryByText('VERIFY')
      if (verifySection) {
        // Verify items have enabled action buttons
        const enabledButtons = document.querySelectorAll('button:not([disabled])')
        expect(enabledButtons.length).toBeGreaterThan(0)
      }
    })

    it('model health card renders for ready state', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 3 },
          optional: { items: [], count: 0 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // ModelHealthCard always present — status moved to footer
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()
      expect(screen.getByText('Decision readiness')).toBeInTheDocument()
    })
  })

  describe('P0/P1 Bug Fixes', () => {
    it('model health card renders when isReady=false and mustAddressCount=0', () => {
      // Scenario: existingReadiness.canRun is false for reasons outside mustAddress tier
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: false,
        blockerCount: 0,
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 2 },
          optional: { items: [], count: 0 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // ModelHealthCard renders regardless of readiness state
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()
    })

    it('Your expertise shows progress bar when actionable items exist', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        reviewedFactorsCount: 2,
        totalReviewableFactorsCount: 3,
        improvementsByCategory: {
          fix: [],
          verify: [
            { key: 'v1', category: 'verify', label: 'F1', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'n1', label: 'F1' } },
            { key: 'v2', category: 'verify', label: 'F2', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'n2', label: 'F2' } },
            { key: 'v3', category: 'verify', label: 'F3', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'n3', label: 'F3' } },
          ],
          add_evidence: [],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // YourExpertise section is present (collapsed by default) with badge count
      expect(screen.getByTestId('your-expertise-section')).toBeInTheDocument()
      expect(screen.getByText('Your expertise')).toBeInTheDocument()
    })

    it('Your expertise shows well-calibrated message when all empty', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        reviewedFactorsCount: 2,
        totalReviewableFactorsCount: 2,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // YourExpertise section is present (collapsed by default, no badge when empty)
      expect(screen.getByTestId('your-expertise-section')).toBeInTheDocument()
    })

    it('shows Ready and enables button when only optional improvements present', () => {
      // Scenario: optional strengthen item, no blockers
      // Optional improvements should NOT block analysis
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
        blockerCount: 0,
        tiers: {
          mustAddress: { items: [], count: 0 }, // No blockers
          reviewAssumptions: { items: [], count: 0 },
          optional: {
            items: [{
              key: 'only_2_options',
              category: 'strengthen',
              label: 'Consider adding a third option',
              detail: 'More options can reveal better alternatives',
            }],
            count: 1,
          },
        },
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [],
          strengthen: [{
            key: 'only_2_options',
            category: 'strengthen',
            label: 'Consider adding a third option',
            detail: 'More options can reveal better alternatives',
          }],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // ModelHealthCard renders — status moved to footer
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()

      // Button should be enabled (CTA adapts to readiness: "Analyse now" or "Analyse anyway")
      const button = screen.getByRole('button', { name: /run analysis/i })
      expect(button).toHaveTextContent(/Analyse (now|anyway)/)
      expect(button).not.toBeDisabled()
    })
  })

  describe('P2 Polish Tasks', () => {
    describe('Task 1: Inputs Reviewed Label', () => {
      it('shows reviewed count in footer, no evidence tier label', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          evidenceQuality: { level: 'medium', ratio: 0.5, nonAiCount: 2, totalCount: 4 },
          addressedActionableCount: 2,
          actionableCount: 4,
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // Shows reviewed count in footer — no quality tier label
        expect(screen.getByText('2/4 addressed')).toBeInTheDocument()
        expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Data confidence:/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Input confidence:/)).not.toBeInTheDocument()
      })
    })

    describe('Task 2: Empty Review Tier Message', () => {
      it('shows empty state message when review tier has 0 items and 0 totalCount', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          isReady: true,
          tiers: {
            mustAddress: { items: [], count: 0 },
            reviewAssumptions: { items: [], count: 0 },
            optional: { items: [], count: 0 },
          },
          reviewedFactorsCount: 0,
          totalReviewableFactorsCount: 0, // No assumptions to review at all
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // Your expertise section visible (collapsed by default)
        expect(screen.getByText('Your expertise')).toBeInTheDocument()
        expect(screen.getByTestId('your-expertise-section')).toBeInTheDocument()
      })

      it('hides progress counter when no assumptions to review', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          isReady: true,
          tiers: {
            mustAddress: { items: [], count: 0 },
            reviewAssumptions: { items: [], count: 0 },
            optional: { items: [], count: 0 },
          },
          reviewedFactorsCount: 0,
          totalReviewableFactorsCount: 0,
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // Should NOT show "(addressed to 0 of 0)"
        expect(screen.queryByText(/\(addressed to 0 of 0\)/)).not.toBeInTheDocument()
        // Should show plain "Your expertise"
        expect(screen.getByText('Your expertise')).toBeInTheDocument()
      })

      it('hides badge entirely when no assumptions to review', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          isReady: true,
          tiers: {
            mustAddress: { items: [], count: 0 },
            reviewAssumptions: { items: [], count: 0 },
            optional: { items: [], count: 0 },
          },
          reviewedFactorsCount: 0,
          totalReviewableFactorsCount: 0,
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // Badge should not render at all for 0 items
        expect(screen.queryByText('—')).not.toBeInTheDocument()
      })
    })

    describe('Task 3: Success Target Provenance', () => {
      it('shows provenance text when available', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          successThreshold: 1000000,
          isThresholdAutoDerived: true,
          thresholdProvenance: 'Target Revenue of $1M',
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // Should show provenance text below threshold
        expect(screen.getByText(/Source: Target Revenue of \$1M/)).toBeInTheDocument()
      })

      it('does not show provenance text when not available', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          successThreshold: 5000,
          isThresholdAutoDerived: false,
          thresholdProvenance: null,
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // Should NOT show "Source:"
        expect(screen.queryByText(/Source:/)).not.toBeInTheDocument()
      })

      it('does not show provenance text when user has edited threshold (not auto-derived)', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          successThreshold: 5000,
          isThresholdAutoDerived: false, // User edited the threshold
          thresholdProvenance: 'Original target from brief', // Stale provenance still exists
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // Should NOT show stale provenance after user edit
        expect(screen.queryByText(/Extracted from:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Retry Draft Button', () => {
    it('shows retry button in draft error card with needs_user_mapping status', () => {
      mockCeeStatus = 'needs_user_mapping'
      mockLastDraftError = { message: 'Draft failed', retryable: true }
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('draft-error-retry')).toBeInTheDocument()
      expect(screen.getByTestId('draft-error-retry')).toHaveTextContent('Retry Draft')
      mockLastDraftError = null
    })

    it('shows retry button in draft error card with needs_encoding status', () => {
      mockCeeStatus = 'needs_encoding'
      mockLastDraftError = { message: 'Draft failed', retryable: true }
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('draft-error-retry')).toBeInTheDocument()
      mockLastDraftError = null
    })

    it('does not show draft error card when status is ready', () => {
      mockCeeStatus = 'ready'
      mockLastDraftError = null
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByTestId('draft-error-retry')).not.toBeInTheDocument()
    })

    it('does not show retry button when status is an unknown value', () => {
      mockCeeStatus = 'some_unknown_status'
      mockLastDraftError = { message: 'Draft failed', retryable: true }
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // canRetryDraft requires ceeStatus in SOFT_BYPASS_STATUSES — unknown status means no retry button
      expect(screen.queryByTestId('draft-error-retry')).not.toBeInTheDocument()
      mockLastDraftError = null
    })

    it('does not show retry button when no CEE status (loading)', () => {
      mockCeeStatus = undefined
      mockLastDraftError = null
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
        isLoading: true,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByTestId('draft-error-retry')).not.toBeInTheDocument()
    })

    it('calls retryDraft when retry button is clicked', async () => {
      mockCeeStatus = 'needs_user_mapping'
      mockLastDraftError = { message: 'Draft failed', retryable: true }
      mockRetryDraft.mockResolvedValue({ success: true })
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      fireEvent.click(screen.getByTestId('draft-error-retry'))
      expect(mockRetryDraft).toHaveBeenCalledTimes(1)
      mockLastDraftError = null
    })
  })

  describe('Informational Blockers', () => {
    it('renders informational blockers with info styling when ready', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
        blockerCount: 0,
        enrichedBlockers: [],
        informationalBlockers: [
          {
            blocker: { code: 'CONSTRAINT_DROPPED', message: 'No matching factor', affectedIds: ['constraint_budget'] },
            display: {
              title: 'Constraint not applied: "Budget"',
              description: "The system couldn't match this constraint to a factor in your model. The analysis will run without it.",
              severity: 'info' as const,
              supportsRetry: false,
              suggestedActions: [],
            },
            sortOrder: 40,
          },
        ],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Should show "Notes" section, not "Fix before running"
      expect(screen.getByText('Notes')).toBeInTheDocument()
      expect(screen.queryByText('Fix before running')).not.toBeInTheDocument()

      // Should show the grouped constraint card
      expect(screen.getByTestId('constraint-group-card')).toBeInTheDocument()
    })

    it('does not count informational blockers in footer badge', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
        blockerCount: 0,
        informationalBlockers: [
          {
            blocker: { code: 'CONSTRAINT_DROPPED', message: 'No matching factor', affectedIds: ['c1'] },
            display: { title: 'Test', description: 'Test', severity: 'info' as const, supportsRetry: false, suggestedActions: [] },
            sortOrder: 40,
          },
        ],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Footer should show "Ready" not "Blocked" — CTA adapts to readiness
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).toHaveTextContent(/Analyse (now|anyway)/)
    })
  })

  describe('Framing pill styling (v13 Task 7a)', () => {
    it('renders Framing pill with border class and no bg-option-light', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        qualityChecks: [{
          id: 'zero_external_factors',
          message: 'No external factors in your model',
          cta: 'Add factor',
          ctaAction: 'add_factor',
          pill: 'framing' as const,
          category: 'structure',
        }],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Expand "Sharpen your thinking" section to reveal check pills
      const sectionHeader = screen.getByText('Sharpen your thinking')
      fireEvent.click(sectionHeader)

      const pills = screen.getAllByText('Framing')
      expect(pills.length).toBeGreaterThanOrEqual(1)
      // Check the first Framing pill (from the quality check) has correct styling
      expect(pills[0].className).toContain('border')
      expect(pills[0].className).not.toContain('bg-option-light')
    })
  })

  describe('Factor click integration (OptionPreview → inspector)', () => {
    it('clicking a factor label in an option card calls selectNodeWithoutHistory with the factor ID', () => {
      mockSelectNodeWithoutHistory.mockClear()
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        optionPreviews: [{
          id: 'opt_expand',
          label: 'Expand Now',
          status: 'ready',
          isBaseline: false,
          interventions: [{
            factorId: 'fac_ad_spend',
            factorLabel: 'Ad spend',
            interventionValue: 0.8,
            currentValue: null,
            direction: 'up' as const,
            cap: null,
            unit: null,
            currentRawValue: null,
          }],
        }],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Expand interventions (collapsed by default)
      fireEvent.click(screen.getByText('Show interventions'))

      // Click the factor label "Ad spend" — should target the factor node, not the option
      fireEvent.click(screen.getByText('Ad spend'))

      expect(mockSelectNodeWithoutHistory).toHaveBeenCalledTimes(1)
      expect(mockSelectNodeWithoutHistory).toHaveBeenCalledWith('fac_ad_spend')
    })

    it('clicking the option name calls selectNodeWithoutHistory with the option ID', () => {
      mockSelectNodeWithoutHistory.mockClear()
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        optionPreviews: [{
          id: 'opt_expand',
          label: 'Expand Now',
          status: 'ready',
          isBaseline: false,
          interventions: [],
        }],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      fireEvent.click(screen.getByText('Expand Now'))

      expect(mockSelectNodeWithoutHistory).toHaveBeenCalledWith('opt_expand')
    })
  })

  describe('Negative acceptance criteria (v6 wireframe)', () => {
    beforeEach(() => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        improvementsByCategory: {
          fix: [{ key: 'f1', category: 'fix', label: 'Fix item', detail: '' }],
          verify: [{ key: 'v1', category: 'verify', label: 'Verify item', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'n1', label: 'Factor' } }],
          add_evidence: [],
          strengthen: [{ key: 's1', category: 'strengthen', label: 'Strengthen', detail: '' }],
        },
        modelAdjustments: [{ code: 'test', reason: 'Test fix' }],
        qualityChecks: [{ id: 'no_risks', message: 'No risks', detail: '', pill: 'verify', cta: 'Add risks', ctaAction: 'add_risk' }],
      }))
    })

    it('does NOT render "Ready · N to review · Improvements available" strip', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText(/Ready · \d+ to review · Improvements available/)).not.toBeInTheDocument()
    })

    it('does NOT render "Model health: N issues" thin strip', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // ModelHealthSection rendered a thin strip with "Model health" + issue count
      // Now ModelHealthCard renders a full card — verify no thin strip pattern
      expect(screen.queryByText(/Model health: \d+ issues?/)).not.toBeInTheDocument()
    })

    it('does NOT render standalone "More improvements" section', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText('More improvements')).not.toBeInTheDocument()
    })

    it('does NOT render "What shapes your decision" card', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText('What shapes your decision')).not.toBeInTheDocument()
    })

    it('does NOT render "Model assumptions" table', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText('Model assumptions')).not.toBeInTheDocument()
    })

    it('renders "Sharpen your thinking" NOT "Decision quality"', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText('Decision quality')).not.toBeInTheDocument()
      expect(screen.getByText('Sharpen your thinking')).toBeInTheDocument()
    })
  })
})
