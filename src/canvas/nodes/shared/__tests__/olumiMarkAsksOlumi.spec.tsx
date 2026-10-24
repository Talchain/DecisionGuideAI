/**
 * THE BAND'S OLUMI GLYPH IS A DOOR TO OLUMI (Paul, 24 Oct 2026): on a card, clicking it PREFILLS the chat with a
 * question about that card — never a send — and it neither selects nor drags the card. The title authorship mark and an
 * inline figure mark keep their own behaviour, and off a card the mark stays a static image. Source detail stays
 * reachable through the card's "Open details" route for every kind whose mark changed.
 */
import type { ReactNode } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { ReactFlow, ReactFlowProvider, type Node, type NodeProps } from '@xyflow/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useMenuItems } from '../../../contextMenu/useMenuItems'
import { isMenuItem } from '../../../contextMenu/types'
import { NodeProvenanceMark } from '../NodeProvenanceMark'
import { ValueSourceMark } from '../valueSourceMark'
import { OlumiMergedMark } from '../olumiMarkGroup'
import { EstimateMarker } from '../EstimateMarker'

const NAME = 'Hire a contractor'
const PREFILL = `What have you added or estimated on ‘${NAME}’, and how sure are you?`
const option = { id: 'opt-1', type: 'option', position: { x: 0, y: 0 }, data: { label: NAME } }
const FACTOR_DATA = { label: NAME, provenance: 'ai_inferred', observed_state: { value: 0.4 } }

let prefill: ReturnType<typeof vi.fn>
let send: ReturnType<typeof vi.fn>
let onNodeClick: ReturnType<typeof vi.fn>

// The real production path: React Flow renders the card, so `useNodeId` answers from React Flow itself.
let cardBody: ReactNode = null
function MarkCard(_props: NodeProps) { return <div style={{ width: 160, height: 60 }}>{cardBody}</div> }
const TYPES = { markCard: MarkCard }

function mountOnCard({ children }: { children: ReactNode }) {
  cardBody = children
  const nodes: Node[] = [{ ...option, type: 'markCard' }]
  const { container } = render(<ReactFlowProvider><ReactFlow nodes={nodes} edges={[]} nodeTypes={TYPES} onNodeClick={onNodeClick} /></ReactFlowProvider>)
  const wrapper = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${option.id}"]`)
  expect(wrapper, 'PRECONDITION: React Flow rendered the card').not.toBeNull()
  return null
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 })
})

beforeEach(() => {
  prefill = vi.fn(); send = vi.fn(); onNodeClick = vi.fn()
  useCanvasStore.setState({ nodes: [option], selection: { nodeIds: new Set(), edgeIds: new Set() } } as never)
  useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: vi.fn(), _isConversationBusy: () => false } as never)
})

function pressAndCheck(mark: HTMLElement) {
  expect(mark.tagName).toBe('BUTTON')
  expect(mark).toHaveAttribute('aria-label', PREFILL)
  fireEvent.pointerDown(mark)
  fireEvent.mouseDown(mark)
  fireEvent.click(mark)
  expect(prefill.mock.calls).toEqual([[PREFILL]])
  expect(send).not.toHaveBeenCalled()
  // Never selects the card: React Flow's click seam (which the inspector reads) is not reached.
  expect(onNodeClick).not.toHaveBeenCalled()
  // Never drags it: React Flow skips a drag that starts on a `nodrag` element (its noDragClassName), as every card control.
  expect(mark).toHaveClass('nodrag', 'nopan')
}

describe('on a card, the band Olumi glyph prefills the chat about that card', () => {
  it('single Olumi provenance mark in the band (a factor Olumi valued)', () => {
    // The off-card render names the claim; on the card the same words move to the description.
    const { unmount } = render(<NodeProvenanceMark nodeType="factor" data={FACTOR_DATA} place="band" />)
    const claim = screen.getByTestId('node-provenance-mark').getAttribute('aria-label')
    expect(claim).toBeTruthy()
    unmount()
    mountOnCard({ children: <NodeProvenanceMark nodeType="factor" data={FACTOR_DATA} place="band" /> })
    const mark = screen.getByTestId('node-provenance-mark')
    expect(mark).toHaveAttribute('aria-description', claim!)
    pressAndCheck(mark)
  })

  it('merged mark', () => {
    mountOnCard({ children: <OlumiMergedMark label="Olumi suggested this option · 2 values are Olumi's estimates" estimateCount={2} /> })
    const mark = screen.getByTestId('node-olumi-mark')
    expect(mark).toHaveAttribute('aria-description', "Olumi suggested this option · 2 values are Olumi's estimates")
    pressAndCheck(mark)
  })

  it('single Olumi value mark in the band: asks, and does not open source detail', () => {
    const openSource = vi.fn()
    mountOnCard({ children: <ValueSourceMark mark={{ kind: 'olumi', label: 'Olumi’s estimate' }} testId="value-mark" onOpenSource={openSource} /> })
    pressAndCheck(screen.getByTestId('value-mark'))
    expect(openSource).not.toHaveBeenCalled()
  })
})

describe('contrast: the harness sees a card click', () => {
  it('a click on the card body reaches React Flow\'s click seam', () => {
    mountOnCard({ children: <span data-testid="card-body">{NAME}</span> })
    fireEvent.click(screen.getByTestId('card-body'))
    expect(onNodeClick).toHaveBeenCalledTimes(1)
  })
})

describe('the factor band estimate glyph (EstimateMarker) asks too', () => {
  it('band: prefills, never opens source detail', () => {
    const openSource = vi.fn()
    mountOnCard({ children: <EstimateMarker onOpenSource={openSource} /> })
    pressAndCheck(screen.getByTestId('estimate-marker'))
    expect(openSource).not.toHaveBeenCalled()
  })
  it('inline: keeps its route to source detail', () => {
    const openSource = vi.fn()
    mountOnCard({ children: <EstimateMarker onOpenSource={openSource} inline /> })
    fireEvent.click(screen.getByTestId('estimate-marker'))
    expect(openSource).toHaveBeenCalledOnce()
    expect(prefill).not.toHaveBeenCalled()
  })
})

describe('unchanged: title mark, inline figure mark, other kinds, off a card', () => {
  it('the title authorship mark stays a static image', () => {
    mountOnCard({ children: <NodeProvenanceMark nodeType="option" data={{ ...option.data, provenance: 'ai_inferred' }} place="title" /> })
    const mark = screen.getByTestId('node-provenance-mark')
    expect(mark.tagName).toBe('SPAN')
    expect(mark).toHaveAttribute('role', 'img')
    fireEvent.click(mark)
    expect(prefill).not.toHaveBeenCalled()
  })

  it('an inline Olumi figure mark keeps its route to source detail', () => {
    const openSource = vi.fn()
    mountOnCard({ children: <ValueSourceMark mark={{ kind: 'olumi', label: 'Olumi’s estimate' }} testId="value-mark" onOpenSource={openSource} inline /> })
    fireEvent.click(screen.getByTestId('value-mark'))
    expect(openSource).toHaveBeenCalledOnce()
    expect(prefill).not.toHaveBeenCalled()
  })

  it('a "from your brief" mark in the band is not an ask', () => {
    mountOnCard({ children: <NodeProvenanceMark nodeType="option" data={{ ...option.data, provenance: 'from_brief' }} place="band" /> })
    const mark = screen.getByTestId('node-provenance-mark')
    expect(mark).toHaveAttribute('role', 'img')
    expect(mark).not.toHaveAttribute('aria-label', PREFILL)
  })

  it('with no chat composer to take the prompt, the band value mark keeps its route to source detail', () => {
    useGuidanceStore.setState({ _prefillChat: null } as never)
    const openSource = vi.fn()
    mountOnCard({ children: <ValueSourceMark mark={{ kind: 'olumi', label: 'Olumi’s estimate' }} testId="value-mark" onOpenSource={openSource} /> })
    const mark = screen.getByTestId('value-mark')
    expect(mark).not.toHaveAttribute('aria-label', PREFILL)
    fireEvent.click(mark)
    expect(openSource).toHaveBeenCalledOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it('off a card (no node) the band Olumi mark stays a static image', () => {
    render(<NodeProvenanceMark nodeType="factor" data={FACTOR_DATA} place="band" />)
    const mark = screen.getByTestId('node-provenance-mark')
    expect(mark).toHaveAttribute('role', 'img')
    expect(mark).not.toHaveAttribute('aria-label', PREFILL)
  })
})

describe('source detail stays reachable: "Open details" opens the inspector for every kind whose mark changed', () => {
  it.each(['option', 'factor', 'risk', 'outcome', 'goal'] as const)('%s', (nodeType) => {
    const node = { id: `${nodeType}-1`, type: nodeType, position: { x: 0, y: 0 }, data: { label: 'X' } }
    useCanvasStore.setState({ nodes: [node] } as never)
    const { result } = renderHook(() => useMenuItems({
      target: { kind: 'node', nodeId: node.id, nodeType, node, screenPos: { x: 0, y: 0 } },
      onClose: vi.fn(), showToast: vi.fn(), screenToFlowPosition: (p: { x: number; y: number }) => p,
    } as never))
    const details = result.current.filter(isMenuItem).find(item => item.id === 'open-details')!
    expect(details.enabled).toBe(true)
    const opened = vi.fn()
    window.addEventListener('olumi:open-full-inspector', opened)
    act(() => { details.action() })
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([node.id])
    expect(opened).toHaveBeenCalledOnce()
    window.removeEventListener('olumi:open-full-inspector', opened)
  })
})
