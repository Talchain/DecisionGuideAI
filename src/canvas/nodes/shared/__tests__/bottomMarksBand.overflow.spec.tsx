import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BottomCardMark, BottomMarksBand, BottomMarksProvider, useBottomBandHasMarks } from '../CardMark'
import { GoalNode } from '../../GoalNode'
import { DecisionNode } from '../../DecisionNode'
import { FactorNode } from '../../FactorNode'
import { useCanvasStore } from '../../../store'
import { TOOLTIP_SURFACE_CLASS } from '../../../../components/Tooltip'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))

// jsdom has no layout: these are untransformed, band-local dimensions, with
// the real flex gap included in each mark's offset. No bounding-rect guesses.
let bandWidth = 100
let moreWidth = 24
const resizeObservers: { callback: ResizeObserverCallback; targets: Set<Element> }[] = []
const mutationObservers: { callback: MutationCallback; targets: Set<Node> }[] = []

beforeEach(() => {
  bandWidth = 100
  moreWidth = 24
  resizeObservers.length = 0
  mutationObservers.length = 0
  vi.stubGlobal('ResizeObserver', class {
    targets = new Set<Element>()
    constructor(callback: ResizeObserverCallback) { resizeObservers.push({ callback, targets: this.targets }) }
    observe(target: Element) { this.targets.add(target) }
    unobserve(target: Element) { this.targets.delete(target) }
    disconnect() { this.targets.clear() }
  })
  vi.stubGlobal('MutationObserver', class {
    targets = new Set<Node>()
    constructor(callback: MutationCallback) { mutationObservers.push({ callback, targets: this.targets }) }
    observe(target: Node) { this.targets.add(target) }
    disconnect() { this.targets.clear() }
    takeRecords() { return [] }
  })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-card-bottom-band') ? bandWidth : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
    const index = this.getAttribute('data-band-test-index')
    return index === null ? 0 : Number(index) * 24
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('data-card-mark') === 'more') return moreWidth
    return this.hasAttribute('data-band-test-index') ? 20 : 0
  })
  useCanvasStore.setState({ nodes: [], edges: [], lodRung: 'full', viewMode: 'standard',
    lens: { active: 'full', _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set() },
    highlightedNodes: new Set(), dimmedNodeIds: new Set(), results: { status: 'idle', report: null },
    goalThreshold: null, goalConstraints: [], ceeAnalysisReady: null } as never)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function fireObserver(kind: 'resize' | 'mutation', band: HTMLElement) {
  act(() => {
    if (kind === 'resize') {
      for (const observer of [...resizeObservers]) {
        if (observer.targets.has(band)) observer.callback([], {} as ResizeObserver)
      }
    } else {
      for (const observer of [...mutationObservers]) {
        if (observer.targets.has(band)) observer.callback([], {} as MutationObserver)
      }
    }
  })
}

const words = ['From your brief', 'Working assumption', 'Medium confidence', 'Evidence priority', 'Key driver', 'Needs review']
function renderBand(count: number) {
  render(<BottomMarksProvider>
    <BottomMarksBand nodeId="overflow" nodeType="factor" />
    {words.slice(0, count).map((label, index) => <BottomCardMark key={label}>
      {/* Exercise both a child's own label and a nested mark's label. */}
      <span data-testid={`band-mark-${index}`} data-band-test-index={index} aria-label={index % 2 === 0 ? label : undefined}>
        <span aria-label={label} />
      </span>
    </BottomCardMark>)}
  </BottomMarksProvider>)
  const band = screen.getByTestId('factor-bottom-marks-overflow')
  fireObserver('mutation', band)
  // React's own +N child now has its measured width (rather than the fallback).
  fireObserver('resize', band)
  return band
}

function expectOverflow(firstHidden: number, count: number) {
  for (let index = 0; index < count; index++) {
    const mark = screen.getByTestId(`band-mark-${index}`)
    if (index < firstHidden) expect(mark).not.toHaveAttribute('data-band-overflow')
    else expect(mark).toHaveAttribute('data-band-overflow', 'true')
  }
}

it('ROW 1: six 20px marks in 100px retain the fitting prefix and name EVERY hidden mark in +N', async () => {
  moreWidth = 32 // Measured +N is wider than the 24px fallback: only two marks fit.
  const band = renderBand(6)
  expect(band).toHaveClass('flex', 'items-center', 'gap-1', 'overflow-hidden')
  expect(band).not.toHaveClass('overflow-x-auto')
  expectOverflow(2, 6)
  const more = screen.getByTestId('factor-bottom-marks-more-overflow')
  expect(more.parentElement).toBe(band)
  expect(more).toHaveAttribute('data-card-mark', 'more')
  expect(more).toHaveAttribute('role', 'img')
  expect(more).toHaveAttribute('tabindex', '0')
  expect(more.style.order).toBe('9999')
  expect(more).toHaveTextContent('+4')
  expect(more).toHaveAttribute('aria-label', `4 more: ${words.slice(2).join('; ')}`)
  expect(more.getAttribute('title') ?? '').toBe('')
  act(() => more.focus())
  const tip = await screen.findByRole('tooltip')
  expect(tip).toHaveClass(TOOLTIP_SURFACE_CLASS)
  expect(Array.from(tip.children).map(line => line.textContent)).toEqual(words.slice(2))
})

it('ROW 2 CONTROL: three 20px marks in 100px have neither overflow attributes nor +N', () => {
  const band = renderBand(3)
  expect(band.querySelector('[data-band-overflow]')).toBeNull()
  expect(screen.queryByTestId('factor-bottom-marks-more-overflow')).toBeNull()
})

it('ROW 3 RESIZE: widening to 200px clears every overflow attribute and removes +N', () => {
  const band = renderBand(6)
  expectOverflow(3, 6) // Positive precondition: the resize starts with hidden marks.
  expect(screen.getByTestId('factor-bottom-marks-more-overflow')).toHaveTextContent('+3')
  bandWidth = 200
  fireObserver('resize', band)
  expect(band.querySelector('[data-band-overflow]')).toBeNull()
  expect(screen.queryByTestId('factor-bottom-marks-more-overflow')).toBeNull()
  expectOverflow(6, 6)
})

const components = { goal: GoalNode, decision: DecisionNode, factor: FactorNode }
function renderCard(kind: keyof typeof components, rung: 'full' | 'line') {
  const id = `padding-${kind}`
  const data = { type: kind, label: `A ${kind}` }
  useCanvasStore.setState({ nodes: [{ id, type: kind, position: { x: 0, y: 0 }, data }], edges: [], lodRung: rung } as never)
  const Component = components[kind] as ComponentType<NodeProps>
  const view = render(<ReactFlowProvider><Component id={id} type={kind} data={data}
    selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable /></ReactFlowProvider>)
  const root = view.container.querySelector<HTMLElement>('[role="group"]')!
  expect(root).not.toBeNull()
  return root
}

it('ROW 4 CONTROL (DL 8 Oct: only when it carries marks): the band-has-marks signal is false with no mark and true with one', () => {
  // The anchor branch reads `useBottomBandHasMarks()`. Every live card also draws BaseNode's own provenance mark group,
  // so a real anchor always carries one; the conditional is proved here on the signal itself, as a discriminating pair.
  const Probe = () => <span data-testid="has-marks">{String(useBottomBandHasMarks())}</span>
  const view = (withMark: boolean) => render(<BottomMarksProvider>
    <BottomMarksBand nodeId="probe" nodeType="goal" />
    {withMark ? <BottomCardMark><span data-testid="planted-mark" role="img" aria-label="A planted mark" /></BottomCardMark> : null}
    <Probe />
  </BottomMarksProvider>)
  view(false)
  expect(screen.getByTestId('has-marks').textContent).toBe('false')
  cleanup()
  view(true)
  expect(screen.getByTestId('planted-mark').closest('[data-card-bottom-band]')).not.toBeNull()
  expect(screen.getByTestId('has-marks').textContent).toBe('true')
})

it.each(['goal', 'decision'] as const)('ROW 4 ANCHOR RESERVATION: %s (carrying a mark) reserves the Normal factor band at Normal AND below-floor rungs', kind => {
  const reservation = renderCard('factor', 'full').style.paddingBottom
  expect(reservation).not.toBe('')
  cleanup()
  for (const rung of ['full', 'line'] as const) {
    // #2649 r3 band overlap: anchors keep one reserved band box at every rung.
    const root = renderCard(kind, rung)
    expect(root.querySelector('[data-card-bottom-band]')!.children.length, `${kind} at ${rung} carries a mark`).toBeGreaterThan(0)
    expect(root.style.paddingBottom, `${kind} at ${rung}`).toBe(reservation)
    expect(root.style.paddingTop).toBe('11px')
    expect(root.style.paddingLeft).toBe('13px')
    expect(root.style.paddingRight).toBe('13px')
    cleanup()
  }
})
