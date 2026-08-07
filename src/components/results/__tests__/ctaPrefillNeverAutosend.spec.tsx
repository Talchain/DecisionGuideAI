/**
 * Codex review finding 6 — exploratory "ask Olumi" CTAs in the analysis panel
 * must NOT auto-send into a possibly-hidden conversation. They route through the
 * Ask-Olumi drawer (openAskOlumi): a PREFILLED, EDITABLE draft that the user
 * sends by pressing Send — the openAskOlumi/prefill doctrine.
 *
 * These are the RED tests for the fix. Before the fix each CTA called the
 * threaded onSendMessage directly (auto-send); after the fix it opens the drawer
 * with the prompt prefilled and the composer focused, dispatching nothing until
 * the user presses Send.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import { OptionCards } from '../OptionCards'
import { StressTestSection } from '../StressTestSection'
import { AskOlumiDrawer } from '../coaching/AskOlumiDrawer'
import { useAskOlumiStore } from '../coaching/askOlumiStore'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import type { OptionResult, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

const mockOptions: OptionResult[] = [
  {
    id: 'option-1',
    label: 'Option A',
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: true,
    winProbability: 0.65,
    goalProbability: 0.75,
    rank: 1,
  },
  {
    id: 'option-2',
    label: 'Option B',
    expected: 90,
    outcome: { mean: 90, p10: 50, p50: 90, p90: 130 },
    p10: 50,
    p50: 90,
    p90: 130,
    isRecommended: false,
    winProbability: 0.35,
    goalProbability: 0.55,
    rank: 2,
  },
]

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac_top',
    factorLabel: 'Customer churn rate',
    rawElasticity: 0.5,
    normalisedInfluence: 0.5,
    influenceScore: 0.5,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_default',
    confidence: 0.8,
    rankFlipRate: 0.32,
    ...overrides,
  }
}

beforeEach(() => {
  // Reset the singleton stores between tests.
  useAskOlumiStore.getState().close()
  useAskOlumiStore.setState({ draft: '', context: '', label: '' })
  useGuidanceStore.setState({ _sendMessage: null, _dispatchAction: null })
})

describe('OptionCards winner chip — prefill, never auto-send', () => {
  it('clicking "What makes this lead?" opens the drawer prefilled and dispatches nothing', () => {
    const onSendMessage = vi.fn()
    render(
      <>
        <OptionCards options={mockOptions} winnerId="option-1" onSendMessage={onSendMessage} />
        <AskOlumiDrawer />
      </>,
    )

    // The winner chip on Option A.
    fireEvent.click(screen.getByText('What makes this lead?'))

    // No auto-send: the threaded send path is never touched.
    expect(onSendMessage).not.toHaveBeenCalled()

    // The drawer is open with the prompt prefilled into the editable composer.
    const draft = screen.getByTestId('ask-olumi-draft') as HTMLTextAreaElement
    expect(draft).toBeInTheDocument()
    expect(draft.value).toMatch(/Option A/)
    expect(draft.value).toMatch(/leading option|key advantages/i)

    // Composer is focused for immediate editing.
    expect(document.activeElement).toBe(draft)
  })

  it('positive control: pressing Send after prefill dispatches exactly once', () => {
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send, _dispatchAction: null })

    render(
      <>
        <OptionCards options={mockOptions} winnerId="option-1" onSendMessage={vi.fn()} />
        <AskOlumiDrawer />
      </>,
    )

    fireEvent.click(screen.getByText('What makes this lead?'))
    expect(send).not.toHaveBeenCalled() // nothing sent on prefill

    const drawer = screen.getByTestId('ask-olumi-drawer')
    fireEvent.click(within(drawer).getByText('Send'))
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatch(/Option A/)
  })
})

describe('OptionCards "different approach" link — prefill, never auto-send', () => {
  it('clicking the link opens the drawer prefilled and dispatches nothing', () => {
    const onSendMessage = vi.fn()
    render(
      <>
        <OptionCards options={mockOptions} winnerId="option-1" onSendMessage={onSendMessage} />
        <AskOlumiDrawer />
      </>,
    )

    fireEvent.click(screen.getByTestId('option-cards-different-approach'))

    expect(onSendMessage).not.toHaveBeenCalled()
    const draft = screen.getByTestId('ask-olumi-draft') as HTMLTextAreaElement
    expect(draft.value).toMatch(/different approach/i)
  })
})

describe('StressTestSection "What if this changes?" — prefill, never auto-send', () => {
  it('clicking the chip opens the drawer prefilled and dispatches nothing', () => {
    const onSendMessage = vi.fn()
    render(
      <>
        <StressTestSection
          drivers={[makeDriver()]}
          fragileEdges={[]}
          winnerLabel="Option A"
          alternativeLabel="Option B"
          designationsWithheld={false}
          onSendMessage={onSendMessage}
        />
        <AskOlumiDrawer />
      </>,
    )

    fireEvent.click(screen.getByText('What if this changes?'))

    expect(onSendMessage).not.toHaveBeenCalled()
    const draft = screen.getByTestId('ask-olumi-draft') as HTMLTextAreaElement
    expect(draft.value).toMatch(/Customer churn rate/)
  })
})
