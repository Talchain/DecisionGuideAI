/**
 * Audit SI-1 / SI-2 / SI-3 — the MOUNTED inspector feeds the placement the
 * card's rect, the band, the left rails and the focused path.
 *
 * `InspectorModal.placement.si123.spec.ts` pins the rule. This file pins the
 * wiring: a rule that is right but never handed the card's rect is SI-1 all
 * over again (the served build passed only the anchor point, which is how 81%
 * cover survived a green placement suite).
 *
 * The page is the measured one (pricing-model, 1280x800): Net Revenue
 * Retention selected at 597..723 × 497..573, dock from 920, app bar 51, the
 * overlay band from 724, the left rails to 54, and the Goal (623..672) the one
 * card its focus leaves undimmed. The panel measures 330x537, as served.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('../../ui/inspector-v2', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  // The panels are not under test; the placement is.
  return { ...actual, InspectorRouter: () => <div data-testid="inspector-body" /> }
})

import { InspectorModal } from '../InspectorModal'
import { useCanvasStore } from '../../store'

const WINDOW = { width: 1280, height: 800 }
const PANEL = { width: 330, height: 537 }
const PAD = 16

type R = { left: number; top: number; right: number; bottom: number }
const CARD: R = { left: 597, top: 497, right: 723, bottom: 573 } // out_nrr, selected
const GOAL: R = { left: 298, top: 623, right: 664, bottom: 672 } // on the focused path
const DIMMED: R = { left: 70, top: 372, right: 196, bottom: 460 } // off the path
const DOCK: R = { left: 920, top: 51, right: 1280, bottom: 800 }
const BAND: R = { left: 0, top: 724, right: 1280, bottom: 788 }
const TOOLS: R = { left: 13, top: 72, right: 54, bottom: 214 }

const dom = (r: R) => ({ ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top, toJSON: () => ({}) }) as DOMRect
const overlap = (a: R, b: R) => {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

describe('SI-1/2/3 — the mounted inspector places itself against the page it opens on', () => {
  const made: HTMLElement[] = []
  const rafOriginal = window.requestAnimationFrame
  function el(tag: string, attrs: Record<string, string>, r: R): HTMLElement {
    const e = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
    ;(e as HTMLElement & { __rect: R }).__rect = r
    document.body.appendChild(e)
    made.push(e)
    return e
  }

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: WINDOW.width })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: WINDOW.height })
    document.documentElement.style.setProperty('--topbar-h', '51px')
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number) as typeof window.requestAnimationFrame
    el('aside', { 'data-testid': 'outputs-dock' }, DOCK)
    el('div', { 'data-canvas-overlay-band': '' }, BAND)
    el('nav', { 'aria-label': 'Canvas tools' }, TOOLS)
    el('div', { class: 'react-flow__node', 'data-id': 'out_nrr' }, CARD)
    el('div', { class: 'react-flow__node', 'data-id': 'goal_pricing_transition' }, GOAL)
    el('div', { class: 'react-flow__node', 'data-id': 'fac_adoption_friction' }, DIMMED)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const own = (this as HTMLElement & { __rect?: R }).__rect
      return dom(own ?? { left: 0, top: 0, right: PANEL.width, bottom: PANEL.height })
    })
    useCanvasStore.setState({
      // The anchor `computeAnchorPosition` writes: the card's right edge, at its
      // middle (the viewport is identity here, so canvas = screen).
      selection: { nodeIds: new Set(['out_nrr']), edgeIds: new Set<string>(), anchorPosition: { x: CARD.right, y: (CARD.top + CARD.bottom) / 2 } },
      dimmedNodeIds: new Set(['fac_adoption_friction']),
    } as never)
  })

  afterEach(() => {
    cleanup()
    made.splice(0).forEach(e => e.remove())
    document.documentElement.style.removeProperty('--topbar-h')
    vi.restoreAllMocks()
    window.requestAnimationFrame = rafOriginal
    useCanvasStore.setState({ dimmedNodeIds: new Set<string>() } as never)
  })

  async function openPanel(): Promise<{ box: HTMLElement; placed: R }> {
    render(
      <ReactFlowProvider>
        <InspectorModal nodeId="out_nrr" edgeId={null} onClose={() => {}} />
      </ReactFlowProvider>,
    )
    await act(async () => { await new Promise(r => setTimeout(r, 5)) }) // the placement frame
    const box = screen.getByRole('dialog', { name: 'Node inspector' })
    expect(box.style.opacity, 'PRECONDITION: the placement ran').toBe('1')
    const left = parseFloat(box.style.left)
    const top = parseFloat(box.style.top)
    return { box, placed: { left, top, right: left + PANEL.width, bottom: top + PANEL.height } }
  }

  it('⭐ SI-1: it opens clear of the card it inspects (the card\'s rect reaches the rule)', async () => {
    const { placed } = await openPanel()
    expect(overlap(placed, CARD), `panel ${placed.left}..${placed.right} over card ${CARD.left}..${CARD.right}`).toBe(0)
  })

  it('⭐ SI-2: it ends above the overlay band, and writes the room it has to the shell', async () => {
    const { box, placed } = await openPanel()
    expect(placed.bottom).toBeLessThanOrEqual(BAND.top - PAD)
    // 724 - 51 - 2 × 16 — what `--inspector-room` caps the shell's height to.
    expect(box.style.getPropertyValue('--inspector-room')).toBe('641px')
  })

  it('⭐ SI-3: it keeps off the card the focus highlights (the Goal), read from the live dim', async () => {
    const { placed } = await openPanel()
    expect(overlap(placed, GOAL)).toBe(0)
  })

  it('never starts over the left rails', async () => {
    const { placed } = await openPanel()
    expect(placed.left).toBeGreaterThanOrEqual(TOOLS.right + PAD)
  })
})
