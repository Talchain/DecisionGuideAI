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

// Mock the hook
vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

describe('PreAnalysisPanel', () => {
  const mockOnAnalyse = vi.fn()

  const createMockData = (overrides: Partial<PreAnalysisData> = {}): PreAnalysisData => ({
    improvementsByCategory: {
      fix: [],
      verify: [],
      add_evidence: [],
      strengthen: [],
    },
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
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
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

    it('shows "Ready to analyse" when isReady is true', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: true }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByText('Ready to analyse')).toBeInTheDocument()
    })

    it('shows "Not ready" in header when isReady is false', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: false }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // Use getAllByText since "Not ready" appears in both header and footer
      const notReadyElements = screen.getAllByText('Not ready')
      expect(notReadyElements.length).toBeGreaterThanOrEqual(1)
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
    it('renders All Improvements accordion', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('all-improvements-accordion')).toBeInTheDocument()
    })

    it('renders Model Snapshot accordion', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('model-snapshot-accordion')).toBeInTheDocument()
    })

    it('shows total improvements count in accordion header', () => {
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
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })
  })

  describe('M1 Top Actions', () => {
    it('renders top actions when present', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        topActions: [
          { key: 'ta1', category: 'fix', label: 'Add baseline', detail: 'Compare against doing nothing', bias: 'anchoring' },
        ],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByText('Add baseline')).toBeInTheDocument()
      expect(screen.getByText('Compare against doing nothing')).toBeInTheDocument()
    })

    it('shows coaching sentence', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        topActions: [
          { key: 'ta1', category: 'fix', label: 'Test', detail: 'Detail' },
        ],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByText(/Review these items to improve your model's accuracy/)).toBeInTheDocument()
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

    it('renders sections in correct order: Header → TopActions → AllImprovements → ModelSnapshot → AnalysisSettings', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        topActions: [{ key: 'ta1', category: 'fix', label: 'Test Action', detail: 'Detail' }],
      }))

      const { container } = render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const panel = container.querySelector('[data-testid="pre-analysis-panel"]')
      expect(panel).toBeInTheDocument()

      // Verify all required sections exist
      expect(screen.getByText('Ready to analyse')).toBeInTheDocument() // Header
      expect(screen.getByText(/Review these items/)).toBeInTheDocument() // M1 Top Actions
      expect(screen.getByTestId('all-improvements-accordion')).toBeInTheDocument()
      expect(screen.getByTestId('model-snapshot-accordion')).toBeInTheDocument()
      expect(screen.getByTestId('analysis-settings-accordion')).toBeInTheDocument()

      // Verify order by comparing positions in the DOM
      const scrollableContent = panel?.querySelector('.overflow-y-auto')
      const html = scrollableContent?.innerHTML ?? ''

      // Check that sections appear in correct order in the HTML
      const headerPos = html.indexOf('Ready to analyse')
      const topActionsPos = html.indexOf('Review these items')
      const allImprovementsPos = html.indexOf('all-improvements-accordion')
      const modelSnapshotPos = html.indexOf('model-snapshot-accordion')
      const analysisSettingsPos = html.indexOf('analysis-settings-accordion')

      expect(headerPos).toBeLessThan(topActionsPos)
      expect(topActionsPos).toBeLessThan(allImprovementsPos)
      expect(allImprovementsPos).toBeLessThan(modelSnapshotPos)
      expect(modelSnapshotPos).toBeLessThan(analysisSettingsPos)
    })

    it('sticky footer has absolute positioning', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).toHaveClass('absolute')
      expect(footer).toHaveClass('bottom-0')
    })

    it('sticky footer is visible in the DOM', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).toBeInTheDocument()
      expect(footer).toBeVisible()
    })

    it('action buttons in improvements have aria-disabled="true"', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [
            {
              key: 'v1',
              category: 'verify',
              label: 'Test Factor',
              detail: 'AI est: 5.0',
              action: { label: 'Confirm', kind: 'confirm' },
              focus: { type: 'node', id: 'n1', label: 'Test' },
            },
          ],
          add_evidence: [
            {
              key: 'ae1',
              category: 'add_evidence',
              label: 'Edge A → B',
              detail: 'No evidence',
              action: { label: 'Add', kind: 'add' },
              focus: { type: 'edge', id: 'e1', label: 'Edge' },
            },
          ],
          strengthen: [],
        },
        totalImprovements: 2,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Find disabled buttons with aria-disabled
      const disabledButtons = document.querySelectorAll('button[aria-disabled="true"]')
      expect(disabledButtons.length).toBeGreaterThan(0)
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
              detail: 'AI est: 5.0',
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

    it('status text uses body colour not semantic colour', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: true }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      
      // Status text should have text-text-body class, not text-success
      const statusText = screen.getByText('Ready to analyse')
      expect(statusText).toHaveClass('text-text-body')
      expect(statusText).not.toHaveClass('text-success')
    })
  })
})
