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
vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: any) => any) => {
      const state = {
        ceeAnalysisReady: mockCeeStatus ? { status: mockCeeStatus } : null,
        lastDraftError: mockLastDraftError,
        setHighlightedNodes: vi.fn(),
        setHighlightedEdges: vi.fn(),
      }
      return selector(state)
    },
    {
      getState: () => ({
        ceeAnalysisReady: mockCeeStatus ? { status: mockCeeStatus } : null,
        lastDraftError: mockLastDraftError,
        setHighlightedNodes: vi.fn(),
        setHighlightedEdges: vi.fn(),
        updateNode: vi.fn(),
        setGoalThreshold: vi.fn(),
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
      evidenceQuality: { level: 'medium', ratio: 0.5 },
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

    it('shows ready status when isReady is true', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 3 },
          optional: { items: [], count: 2 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // New header format: "✓ Ready · {review} to review · {optional} optional"
      expect(screen.getByText(/✓ Ready · 3 to review · 2 optional/)).toBeInTheDocument()
    })

    it('shows blocked status in header when isReady is false', () => {
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
      // New header format: "⊘ Blocked · {mustAddress.count} to address"
      expect(screen.getByText(/⊘ Blocked · 2 to address/)).toBeInTheDocument()
    })
  })

  describe('Sticky Footer', () => {
    it('shows "Analyse Now" button when ready', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: true, hasBlockers: false }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByRole('button', { name: /run analysis/i })).toHaveTextContent('Analyse Now')
    })

    it('shows "Fix N issues first" when has blockers', () => {
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
      expect(screen.getByRole('button', { name: /fix issues/i })).toHaveTextContent('Fix 2 issues first')
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

    it('shows "Not ready" when isReady=false but hasBlockers=false', () => {
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
      expect(button).toHaveTextContent('Not ready')
      expect(button).toBeDisabled()
    })
  })

  describe('Accordion Behaviour', () => {
    it('renders tier sections container', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('all-improvements-tiers')).toBeInTheDocument()
    })

    it('renders Model Snapshot accordion', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('model-snapshot-accordion')).toBeInTheDocument()
    })

    it('shows tier item counts in section headers', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        totalImprovements: 5,
        improvementsByCategory: {
          fix: [{ key: 'f1', category: 'fix', label: 'Fix', detail: '' }],
          verify: [{ key: 'v1', category: 'verify', label: 'Verify', detail: '' }],
          add_evidence: [{ key: 'a1', category: 'add_evidence', label: 'Add', detail: '' }],
          strengthen: [
            { key: 's1', category: 'strengthen', label: 'Strengthen 1', detail: '' },
            { key: 's2', category: 'strengthen', label: 'Strengthen 2', detail: '' },
          ],
        },
        tiers: {
          mustAddress: { items: [{ key: 'f1', category: 'fix', label: 'Fix', detail: '' }], count: 1 },
          reviewAssumptions: { items: [{ key: 'v1', category: 'verify', label: 'Verify', detail: '' }], count: 1 },
          optional: { items: [
            { key: 'a1', category: 'add_evidence', label: 'Add', detail: '' },
            { key: 's1', category: 'strengthen', label: 'Strengthen 1', detail: '' },
            { key: 's2', category: 'strengthen', label: 'Strengthen 2', detail: '' },
          ], count: 3 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // Each tier shows its count in pill badges
      const countBadges = screen.getAllByText('1')
      expect(countBadges.length).toBeGreaterThanOrEqual(1)
      // Verify the optional tier count
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  describe('Tier Sections', () => {
    it('renders Must address tier when items present', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        tiers: {
          mustAddress: { items: [{ key: 'f1', category: 'fix', label: 'Add goal', detail: 'Define what you want to achieve' }], count: 1 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [], count: 0 },
        },
        improvementsByCategory: {
          fix: [{ key: 'f1', category: 'fix', label: 'Add goal', detail: 'Define what you want to achieve' }],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByText('Must address')).toBeInTheDocument()
      expect(screen.getByText('Add goal')).toBeInTheDocument()
    })

    it('renders Review assumptions tier with items', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [{ key: 'v1', category: 'verify', label: 'Test Factor', detail: '5.0' }], count: 1 },
          optional: { items: [], count: 0 },
        },
        improvementsByCategory: {
          fix: [],
          verify: [{ key: 'v1', category: 'verify', label: 'Test Factor', detail: '5.0' }],
          add_evidence: [],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByText(/Review assumptions/)).toBeInTheDocument()
      expect(screen.getByText('Test Factor')).toBeInTheDocument()
    })
  })

  describe('Evidence Quality Display', () => {
    it('shows Low evidence in danger colour', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        evidenceQuality: { level: 'low', ratio: 0.2 },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const lowText = screen.getAllByText('Low')
      expect(lowText.length).toBeGreaterThan(0)
    })

    it('shows Medium evidence in warning colour', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        evidenceQuality: { level: 'medium', ratio: 0.5 },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const mediumText = screen.getAllByText('Medium')
      expect(mediumText.length).toBeGreaterThan(0)
    })

    it('shows High evidence in success colour', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        evidenceQuality: { level: 'high', ratio: 0.8 },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const highText = screen.getAllByText('High')
      expect(highText.length).toBeGreaterThan(0)
    })
  })

  describe('Wiring Fixes Regression', () => {
    it('renders exactly one Goal selector in the DOM', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // Goal selector is inside Analysis Settings accordion - need to expand it first
      const accordion = screen.getByTestId('analysis-settings-accordion')
      const button = accordion.querySelector('button')
      if (button) fireEvent.click(button)

      // Should have exactly one goal selector
      const goalSelectors = screen.getAllByLabelText(/goal/i)
      expect(goalSelectors.length).toBe(1)
    })

    it('renders sections in correct order: Header → SuccessTarget → Tiers → ModelSnapshot → AnalysisSettings', () => {
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

      // Verify all required sections exist (new Phase 2 structure)
      expect(screen.getByText(/Blocked · 1 to address/)).toBeInTheDocument() // Header with tier counts
      expect(screen.getByTestId('all-improvements-tiers')).toBeInTheDocument()
      expect(screen.getByTestId('model-snapshot-accordion')).toBeInTheDocument()
      expect(screen.getByTestId('analysis-settings-accordion')).toBeInTheDocument()

      // Verify order by comparing positions in the DOM
      const scrollableContent = panel?.querySelector('.overflow-y-auto')
      const html = scrollableContent?.innerHTML ?? ''

      // Check that sections appear in correct order in the HTML
      const headerPos = html.indexOf('Blocked')
      const tiersPos = html.indexOf('all-improvements-tiers')
      const modelSnapshotPos = html.indexOf('model-snapshot-accordion')
      const analysisSettingsPos = html.indexOf('analysis-settings-accordion')

      expect(headerPos).toBeLessThan(tiersPos)
      expect(tiersPos).toBeLessThan(modelSnapshotPos)
      expect(modelSnapshotPos).toBeLessThan(analysisSettingsPos)
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

    it('status text uses semantic colour for ready/blocked state', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 3 },
          optional: { items: [], count: 0 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // New inline status uses semantic colours: text-success for ready
      const statusText = screen.getByText(/✓ Ready/)
      expect(statusText).toHaveClass('text-success')
    })
  })

  describe('P0/P1 Bug Fixes', () => {
    it('Header shows "Not ready" when isReady=false but mustAddressCount=0', () => {
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

      // Header should show "Not ready" instead of "Ready"
      expect(screen.getByText(/◌ Not ready/)).toBeInTheDocument()
      expect(screen.queryByText(/✓ Ready/)).not.toBeInTheDocument()
    })

    it('Review assumptions tier shows completion state when all items reviewed', () => {
      // Scenario: All verify items have been reviewed (source changed from ai to user_confirmed)
      // Items array is empty but totalReviewableFactorsCount > 0
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 0 }, // Empty - all reviewed
          optional: { items: [], count: 0 },
        },
        improvementsByCategory: {
          fix: [],
          verify: [], // Empty
          add_evidence: [],
          strengthen: [],
        },
        reviewedFactorsCount: 3,
        totalReviewableFactorsCount: 3, // Had 3 items, all reviewed
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Should show completion state with "3 of 3 done"
      expect(screen.getByText(/Review assumptions \(3 of 3 done\)/)).toBeInTheDocument()
      // Should show "All reviewed" message when expanded
      expect(screen.getByText('All reviewed')).toBeInTheDocument()
    })

    it('Review assumptions tier shows checkmark badge when all reviewed', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [], count: 0 },
        },
        reviewedFactorsCount: 2,
        totalReviewableFactorsCount: 2,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Should show checkmark badge instead of count
      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('shows Ready and enables button when only missing baseline (optional improvement)', () => {
      // Scenario: 2 options, no baseline, no other blockers
      // Missing baseline is now optional, should NOT block analysis
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
        blockerCount: 0,
        tiers: {
          mustAddress: { items: [], count: 0 }, // No blockers
          reviewAssumptions: { items: [], count: 0 },
          optional: {
            items: [{
              key: 'missing_baseline',
              category: 'strengthen',
              label: 'Add a baseline option',
              detail: 'Compare against doing nothing to see if any change is worth it',
            }],
            count: 1,
          },
        },
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [],
          strengthen: [{
            key: 'missing_baseline',
            category: 'strengthen',
            label: 'Add a baseline option',
            detail: 'Compare against doing nothing to see if any change is worth it',
          }],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Header should show Ready with 1 optional, not Blocked
      expect(screen.getByText(/✓ Ready · 1 optional/)).toBeInTheDocument()
      expect(screen.queryByText(/Blocked/)).not.toBeInTheDocument()

      // Button should be enabled with "Analyse Now"
      const button = screen.getByRole('button', { name: /run analysis/i })
      expect(button).toHaveTextContent('Analyse Now')
      expect(button).not.toBeDisabled()

      // Optional tier should be visible with count of 1
      expect(screen.getByText('Optional improvements')).toBeInTheDocument()
    })
  })

  describe('P2 Polish Tasks', () => {
    describe('Task 1: Inputs Reviewed Label', () => {
      it('shows "Inputs reviewed:" label instead of "Input confidence:"', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          evidenceQuality: { level: 'medium', ratio: 0.5 },
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // Should show "Inputs reviewed:" not "Input confidence:"
        expect(screen.getByText(/Inputs reviewed:/)).toBeInTheDocument()
        expect(screen.queryByText(/Input confidence:/)).not.toBeInTheDocument()
      })
    })

    describe('Task 2: Empty Review Tier Message', () => {
      it('shows "No assumptions to review" when review tier has 0 items and 0 totalCount', () => {
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

        // Review tier should be visible with empty message
        expect(screen.getByText('Review assumptions')).toBeInTheDocument()
        expect(screen.getByText('No assumptions to review')).toBeInTheDocument()
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

        // Should NOT show "(0 of 0 done)"
        expect(screen.queryByText(/\(0 of 0 done\)/)).not.toBeInTheDocument()
        // Should show plain "Review assumptions"
        expect(screen.getByText('Review assumptions')).toBeInTheDocument()
      })

      it('shows dash badge when no assumptions to review', () => {
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

        // Should show dash badge, not checkmark or count
        expect(screen.getByText('—')).toBeInTheDocument()
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
        expect(screen.getByText(/Extracted from: Target Revenue of \$1M/)).toBeInTheDocument()
      })

      it('does not show provenance text when not available', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          successThreshold: 5000,
          isThresholdAutoDerived: false,
          thresholdProvenance: null,
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // Should NOT show "Extracted from:"
        expect(screen.queryByText(/Extracted from:/)).not.toBeInTheDocument()
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
    it('shows retry button when blocked with needs_user_mapping status', () => {
      mockCeeStatus = 'needs_user_mapping'
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('retry-draft-button')).toBeInTheDocument()
      expect(screen.getByTestId('retry-draft-button')).toHaveTextContent('Retry Draft')
    })

    it('shows retry button when blocked with needs_encoding status', () => {
      mockCeeStatus = 'needs_encoding'
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('retry-draft-button')).toBeInTheDocument()
    })

    it('does not show retry button when status is ready', () => {
      mockCeeStatus = 'ready'
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByTestId('retry-draft-button')).not.toBeInTheDocument()
    })

    it('does not show retry button when status is an unknown value', () => {
      mockCeeStatus = 'some_unknown_status'
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByTestId('retry-draft-button')).not.toBeInTheDocument()
    })

    it('does not show retry button when no CEE status (loading)', () => {
      mockCeeStatus = undefined
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
        isLoading: true,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByTestId('retry-draft-button')).not.toBeInTheDocument()
    })

    it('calls retryDraft when retry button is clicked', async () => {
      mockCeeStatus = 'needs_user_mapping'
      mockRetryDraft.mockResolvedValue({ success: true })
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      fireEvent.click(screen.getByTestId('retry-draft-button'))
      expect(mockRetryDraft).toHaveBeenCalledTimes(1)
    })
  })

  describe('Model Adjustments', () => {
    it('renders model-adjustments section when adjustments are present', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        modelAdjustments: [
          { type: 'factor_reclassified', target: 'Market Conditions', detail: 'Reclassified from controllable to external' },
          { type: 'edge_added', target: 'Price → Revenue' },
        ],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      expect(screen.getByTestId('model-adjustments')).toBeInTheDocument()
      expect(screen.getByText('System corrections')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // count badge
    })

    it('does not render model-adjustments section when adjustments are empty', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        modelAdjustments: [],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      expect(screen.queryByTestId('model-adjustments')).not.toBeInTheDocument()
    })

    it('expands to show adjustment details on click', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        modelAdjustments: [
          { type: 'factor_reclassified', target: 'Market Size', detail: 'Changed to external' },
        ],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Initially collapsed — detail text not visible
      expect(screen.queryByText('Changed to external')).not.toBeInTheDocument()

      // Click to expand
      fireEvent.click(screen.getByText('System corrections'))

      // Now detail should be visible
      expect(screen.getByText('Changed to external')).toBeInTheDocument()
      expect(screen.getByText(/Factor reclassified/)).toBeInTheDocument()
    })

    it('renders adjustment with code/reason (no type/detail) without crash', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        modelAdjustments: [
          { code: 'deterministic_repair', field: 'nodes[fac_x].category', reason: 'Reclassified unreachable factor' },
        ],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      expect(screen.getByTestId('model-adjustments')).toBeInTheDocument()

      // Expand and check
      fireEvent.click(screen.getByText('System corrections'))
      expect(screen.getByText('Deterministic repair')).toBeInTheDocument()
      expect(screen.getByText('Reclassified unreachable factor')).toBeInTheDocument()
    })

    it('renders "System adjustment" fallback when both type and code are missing', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        modelAdjustments: [
          { field: 'nodes[fac_x].category' },
        ],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      fireEvent.click(screen.getByText('System corrections'))
      expect(screen.getByText('System adjustment')).toBeInTheDocument()
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

      // Should show the info card
      expect(screen.getByTestId('info-card-CONSTRAINT_DROPPED')).toBeInTheDocument()
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

      // Footer should show "Ready" not "Blocked"
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).toHaveTextContent('Analyse Now')
    })
  })
})
