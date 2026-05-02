/**
 * StressTestSection — Brief 5.8B D4 tests.
 *
 * Coverage:
 *   - render with full data (all 3 subsections populated)
 *   - render with no sensitive factors (subsection suppressed)
 *   - render with no fragile edges (subsection suppressed)
 *   - render empty state (only thinking patterns, with fallback copy)
 *   - Disconfirmation context line conditional on top-driver confidence
 *   - DOM leakage scan — no fac_/opt_/node_ prefixes
 *   - preview line uses top sensitive factor when threshold met
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StressTestSection } from '../StressTestSection'
import type { DriverItem } from '../types'
import type { ChallengeFragileEdge } from '../ChallengeSection'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac_default',
    factorLabel: 'Default factor',
    rawElasticity: 0.5,
    normalisedInfluence: 0.5,
    influenceScore: 0.5,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_default',
    confidence: 0.7,
    ...overrides,
  }
}

function makeFragile(overrides: Partial<ChallengeFragileEdge> = {}): ChallengeFragileEdge {
  return {
    edge_id: 'edge_x',
    from_id: 'node_x',
    from_label: 'Source factor',
    to_label: 'Target factor',
    switch_probability: 0.3,
    alternative_winner_label: 'Option B',
    ...overrides,
  }
}

const TOP_FACTOR: DriverItem = makeDriver({
  factorKey: 'fac_top',
  factorLabel: 'Customer churn rate',
  rankFlipRate: 0.32,
  confidence: 0.8,
})

const SECOND_FACTOR: DriverItem = makeDriver({
  factorKey: 'fac_second',
  factorLabel: 'Hiring throughput',
  rankFlipRate: 0.21,
  confidence: 0.6,
})

describe('StressTestSection — Brief 5.8B D4', () => {
  describe('Header + accordion', () => {
    it('renders the accordion with title "Stress-test your decision"', () => {
      render(
        <StressTestSection
          drivers={[TOP_FACTOR, SECOND_FACTOR]}
          fragileEdges={[makeFragile()]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      expect(screen.getByText('Stress-test your decision')).toBeInTheDocument()
      expect(screen.getByTestId('accordion-stress-test')).toBeInTheDocument()
    })

    it('preview line names the top sensitive factor when threshold met', () => {
      render(
        <StressTestSection
          drivers={[TOP_FACTOR]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      const preview = screen.getByTestId('stress-test-preview')
      expect(preview).toHaveTextContent('Customer churn rate')
      expect(preview).toHaveTextContent('Should its influence be revisited?')
    })

    it('preview line falls back to "Review your key assumptions" when no factor crosses threshold', () => {
      const lowFlipDriver = makeDriver({ rankFlipRate: 0.05, factorLabel: 'Low impact' })
      render(
        <StressTestSection
          drivers={[lowFlipDriver]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      const preview = screen.getByTestId('stress-test-preview')
      expect(preview).toHaveTextContent('Review your key assumptions')
      expect(preview).not.toHaveTextContent('Low impact')
    })
  })

  describe('Sensitive assumptions subsection', () => {
    it('renders sensitive factors above threshold (rank_flip_rate >= 0.15)', () => {
      render(
        <StressTestSection
          drivers={[TOP_FACTOR, SECOND_FACTOR]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      expect(screen.getByTestId('stress-test-sensitive-subsection')).toBeInTheDocument()
      expect(screen.getByText('Sensitive assumptions (2)')).toBeInTheDocument()
      // Index-based testids (`stress-test-sensitive-{index}`) — keys remain
      // factor-derived for React but the testid stays free of fac_ leakage.
      expect(screen.getByTestId('stress-test-sensitive-0')).toBeInTheDocument()
      expect(screen.getByTestId('stress-test-sensitive-1')).toBeInTheDocument()
    })

    it('caps sensitive assumptions at 3', () => {
      const drivers = Array.from({ length: 5 }, (_, i) => makeDriver({
        factorKey: `fac_${i}`,
        factorLabel: `Factor ${i}`,
        rankFlipRate: 0.5 - i * 0.01,
      }))
      render(
        <StressTestSection
          drivers={drivers}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      expect(screen.getByText('Sensitive assumptions (3)')).toBeInTheDocument()
    })

    it('omits sensitive subsection entirely when no factor crosses threshold', () => {
      const lowFlipDriver = makeDriver({ rankFlipRate: 0.05 })
      render(
        <StressTestSection
          drivers={[lowFlipDriver]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      expect(screen.queryByTestId('stress-test-sensitive-subsection')).not.toBeInTheDocument()
      expect(screen.queryByText(/Sensitive assumptions/)).not.toBeInTheDocument()
    })

    it('"What if this changes?" chip routes the prompt through onSendMessage', () => {
      const onSendMessage = vi.fn()
      render(
        <StressTestSection
          drivers={[TOP_FACTOR]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
          onSendMessage={onSendMessage}
        />,
      )
      fireEvent.click(screen.getByText('What if this changes?'))
      expect(onSendMessage).toHaveBeenCalledTimes(1)
      expect(onSendMessage.mock.calls[0][0]).toMatch(/Customer churn rate/)
    })
  })

  describe('Thinking patterns subsection', () => {
    it('renders both deterministic cards', () => {
      render(
        <StressTestSection
          drivers={[TOP_FACTOR]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      expect(screen.getByText('Thinking patterns (2)')).toBeInTheDocument()
      expect(screen.getByTestId('stress-test-disconfirmation')).toBeInTheDocument()
      expect(screen.getByTestId('stress-test-outside-view')).toBeInTheDocument()
    })

    it('Disconfirmation card uses approved copy with winner + alternative interpolated', () => {
      render(
        <StressTestSection
          drivers={[TOP_FACTOR]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      const card = screen.getByTestId('stress-test-disconfirmation')
      expect(card).toHaveTextContent(
        'What could make you switch your recommendation from Option A to Option B?',
      )
      expect(card).toHaveTextContent('Explore this challenge')
    })

    it('Disconfirmation context line appears when topDriverConfidence < 0.5', () => {
      const lowConfTop = makeDriver({
        factorKey: 'fac_low',
        factorLabel: 'Customer churn rate',
        confidence: 0.3,
        rankFlipRate: 0.4,
      })
      render(
        <StressTestSection
          drivers={[lowConfTop]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      const card = screen.getByTestId('stress-test-disconfirmation')
      expect(card).toHaveTextContent(
        'The analysis depends on Customer churn rate, which has limited evidence.',
      )
    })

    it('Disconfirmation context line is suppressed when topDriverConfidence >= 0.5', () => {
      render(
        <StressTestSection
          drivers={[TOP_FACTOR]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      const card = screen.getByTestId('stress-test-disconfirmation')
      expect(card).not.toHaveTextContent('limited evidence')
      expect(card).not.toHaveTextContent('analysis depends on')
    })

    it('Outside view card uses approved copy with winner + alternative interpolated', () => {
      render(
        <StressTestSection
          drivers={[TOP_FACTOR]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      const card = screen.getByTestId('stress-test-outside-view')
      expect(card).toHaveTextContent(
        'For decisions like this, does Option A usually outperform Option B?',
      )
      expect(card).toHaveTextContent(
        'Outside views often catch assumptions you have stopped questioning.',
      )
      expect(card).toHaveTextContent('Research this')
    })
  })

  describe('Fragile factors subsection', () => {
    it('renders the 5.7 D11 alt-winner grouping when fragile edges are present', () => {
      render(
        <StressTestSection
          drivers={[TOP_FACTOR]}
          fragileEdges={[
            makeFragile({ edge_id: 'e1', from_id: 'node_a', from_label: 'Hiring rate' }),
            makeFragile({ edge_id: 'e2', from_id: 'node_b', from_label: 'Funding cycle' }),
          ]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      expect(screen.getByTestId('stress-test-fragile-subsection')).toBeInTheDocument()
      expect(screen.getByText('Fragile factors (2)')).toBeInTheDocument()
      // Same alt-winner → one grouped card.
      expect(screen.getByTestId('fragile-alt-winner')).toHaveTextContent('Option B')
    })

    it('omits fragile subsection entirely when no fragile edges', () => {
      render(
        <StressTestSection
          drivers={[TOP_FACTOR]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      expect(screen.queryByTestId('stress-test-fragile-subsection')).not.toBeInTheDocument()
      expect(screen.queryByText(/Fragile factors/)).not.toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('renders the fallback copy when no sensitive + no fragile (only thinking patterns)', () => {
      const lowFlipDriver = makeDriver({ rankFlipRate: 0.05 })
      render(
        <StressTestSection
          drivers={[lowFlipDriver]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      expect(
        screen.getByText('No sensitivity or fragility signals fired. Your model is currently consistent.'),
      ).toBeInTheDocument()
    })

    it('does NOT render the fallback copy when sensitive or fragile fired', () => {
      render(
        <StressTestSection
          drivers={[TOP_FACTOR]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      expect(
        screen.queryByText('No sensitivity or fragility signals fired. Your model is currently consistent.'),
      ).not.toBeInTheDocument()
    })
  })

  describe('DOM leakage scan', () => {
    it('container.innerHTML contains no fac_/opt_/node_ prefixes', () => {
      const { container } = render(
        <StressTestSection
          drivers={[TOP_FACTOR, SECOND_FACTOR]}
          fragileEdges={[makeFragile({ edge_id: 'e1', from_id: 'node_a' })]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
        />,
      )
      const html = container.innerHTML
      expect(/\bfac_/.test(html)).toBe(false)
      expect(/\bopt_/.test(html)).toBe(false)
      expect(/\bnode_/.test(html)).toBe(false)
    })
  })
})
