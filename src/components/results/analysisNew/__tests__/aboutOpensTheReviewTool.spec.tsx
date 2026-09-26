/**
 * ⭐ ABOUT › SOURCES AND LIMITS ENDS WITH "Inspect beliefs and source notes",
 * AND IT OPENS THE REVIEW TOOL (V2 prototype `sourcesHTML()`:
 * `<button class="textbutton" data-action="reviews">🔍 Inspect beliefs and
 * source notes</button>`).
 *
 * About's header recorded it as not rendered because "the review tool has no
 * open request". #2075 gave the tool one (the census marks use it); this rides
 * the same channel as a `reveal`, through the mount `AnalysisNewTabBody` ships.
 *
 * ⚠ Never a control that does nothing: absent when the queue has nothing open.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { openStrategicChallenge } from './analysisNewFixtures'

const ABOUT = 'analysis-new-about'
const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Board wants NRR back above 110%' } },
  { id: 'o1', type: 'option', data: { label: 'Hold current strategy' } },
  { id: 'r1', type: 'risk', data: { label: 'Churn spike' } },
]

const scrolled = vi.fn()
const previousNodes = { value: [] as unknown }
const previousScroll = Element.prototype.scrollIntoView
beforeEach(() => {
  scrolled.mockReset()
  Element.prototype.scrollIntoView = scrolled
  previousNodes.value = useCanvasStore.getState().nodes
  useStrengthenStore.setState({ records: {} })
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
})
afterEach(() => {
  cleanup()
  Element.prototype.scrollIntoView = previousScroll
  useCanvasStore.setState({ nodes: previousNodes.value } as never)
})

const renderTab = () =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={openStrategicChallenge()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
    />,
  )
const openSources = () => {
  fireEvent.click(screen.getByTestId(`${ABOUT}-toggle`))
  fireEvent.click(screen.getByTestId(`${ABOUT}-detail-limitations-toggle`))
}

describe('About › Sources and limits → "Inspect beliefs and source notes"', () => {
  it('⭐ opens the review tool and brings it into view', () => {
    renderTab()
    // PRECONDITION: the queue has something open, and the tool is closed.
    expect(screen.getByTestId('analysis-new-review-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-review-item')).toBeNull()
    openSources()
    const act = screen.getByTestId(`${ABOUT}-inspect-beliefs`)
    expect(act).toHaveTextContent('Inspect beliefs and source notes')
    fireEvent.click(act)
    expect(screen.getByTestId('analysis-new-review-item'), 'the tool opened').toBeInTheDocument()
    expect(scrolled, 'the tool was brought into view').toHaveBeenCalled()
  })

  it('pressed again while the tool is open: it stays open and scrolls into view again', () => {
    renderTab()
    openSources()
    fireEvent.click(screen.getByTestId(`${ABOUT}-inspect-beliefs`))
    const calls = scrolled.mock.calls.length
    fireEvent.click(screen.getByTestId(`${ABOUT}-inspect-beliefs`))
    expect(screen.getByTestId('analysis-new-review-item')).toBeInTheDocument()
    expect(scrolled.mock.calls.length, 'an already-open tool is still revealed').toBeGreaterThan(calls)
  })

  it('⭐ keyboard focus moves with it, to the item picker, so the next Tab is in the tool', () => {
    renderTab()
    openSources()
    const act = screen.getByTestId(`${ABOUT}-inspect-beliefs`)
    act.focus()
    expect(act, 'PRECONDITION: the reader is on the act').toHaveFocus()
    fireEvent.click(act)
    const picker = screen.getByTestId('analysis-new-review-select')
    expect(picker, 'focus left About for the tool').toHaveFocus()
    expect(picker.closest('[data-testid="analysis-new-review-item"]')).not.toBeNull()
  })

  it('pressed again after the reader moved on: focus returns to the picker', () => {
    renderTab()
    openSources()
    const act = screen.getByTestId(`${ABOUT}-inspect-beliefs`)
    fireEvent.click(act)
    act.focus()
    expect(act, 'PRECONDITION: the reader went back to About').toHaveFocus()
    fireEvent.click(act)
    expect(screen.getByTestId('analysis-new-review-select')).toHaveFocus()
  })

  it('CONTRAST: a census mark opens the tool but keeps its own focus (the tool sits just below it)', () => {
    // A factor carrying a number nobody confirmed: the queue holds an item on it.
    useCanvasStore.setState({
      nodes: [...NODES, { id: 'f1', type: 'factor', data: { label: 'Vendor cost', observed_state: { value: 0.7, source: 'cee_inference' } } }],
    } as never)
    renderTab()
    const mark = screen.getAllByTestId('analysis-new-model-strip-mark').find((m) => m.getAttribute('data-node-id') === 'f1')
    expect(mark, 'PRECONDITION: the census has a mark for f1').toBeDefined()
    mark!.focus()
    fireEvent.click(mark!)
    expect(screen.getByTestId('analysis-new-review-item'), 'PRECONDITION: the mark opened the tool at f1').toHaveAttribute('data-target-id', 'f1')
    expect(mark).toHaveFocus()
  })

  it('CONTRAST: with nothing on the canvas to review, no act is drawn', () => {
    useCanvasStore.setState({ nodes: [] } as never)
    renderTab()
    expect(screen.queryByTestId('analysis-new-review-toggle'), 'PRECONDITION: nothing to review').toBeNull()
    openSources()
    expect(screen.getByTestId(`${ABOUT}-detail-limitations-body`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${ABOUT}-inspect-beliefs`)).toBeNull()
  })
})

describe('closing the review tool hands keyboard focus back (whole-tab witness D3, served 046f67ab)', () => {
  afterEach(cleanup)

  it('⭐ Close returns focus to the "N to review" toggle, never to <body>', () => {
    useCanvasStore.setState({
      nodes: [...NODES, { id: 'f1', type: 'factor', data: { label: 'Vendor cost', observed_state: { value: 0.7, source: 'cee_inference' } } }],
    } as never)
    renderTab()
    const toggle = screen.getByTestId('analysis-new-review-toggle')
    fireEvent.click(toggle)
    const close = screen.getByTestId('analysis-new-review-close')
    close.focus()
    expect(close, 'PRECONDITION: the reader is on Close').toHaveFocus()
    fireEvent.click(close)
    expect(screen.queryByTestId('analysis-new-review-item'), 'PRECONDITION: the tool closed').toBeNull()
    expect(toggle).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })
})

