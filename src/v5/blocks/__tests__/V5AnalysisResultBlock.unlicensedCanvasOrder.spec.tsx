/**
 * ⭐ UI-SEM-097, ORDER — a card with no LICENSED leader keeps every number, in
 * CANVAS order, never largest-first.
 *
 * RC ruling, #69 5829442152 §4 (on AI Conversation's 5829386262 §2): "Any card
 * that shows no permitted leader keeps every number, in CANVAS order, the same
 * order #2001's L2 uses, so every surface lists options alike. It never sorts
 * largest-first. A card whose leader IS permitted may keep largest-first."
 *
 * The cards this reaches still show the row: the producer did not refuse the
 * claim, but no leader is LICENSED, because the model's admission is
 * `exploratory` or `none`, or the producer called a near tie. The reviewed pins
 * "the CLAIM is withheld, never the numbers" (`admissionGatesLeader`) and
 * "every probability still renders" (`withheldProse`) keep holding; only the
 * order changes.
 *
 * THE FIXTURE separates three orders so each assertion names which one it saw:
 *   · largest-first: MacBook 43% → Dell 32% → Status quo 25%;
 *   · wire order (the `win_probabilities` keys): Dell → Status quo → MacBook;
 *   · canvas order (the option nodes): Status quo → MacBook → Dell, with a
 *     factor node in between that must not disturb it.
 *
 * CLAIM TYPE: jsdom, block-level, authored fixture (the admission spec's).
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'

import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { useCanvasStore } from '../../../canvas/store'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import type { AnalysisAdmissionV1 } from '../../../adapters/cee/types'

const MAC = 'Standardise on MacBook Pro'
const DELL = 'Standardise on Dell XPS'
const STATUS_QUO = 'Keep current machines'

/** Wire order is deliberately neither largest-first nor canvas order. */
const WIN_PROBABILITIES: Record<string, number> = {
  [DELL]: 0.3234,
  [STATUS_QUO]: 0.2489,
  [MAC]: 0.4277,
}
const LARGEST_FIRST = [MAC, DELL, STATUS_QUO]
const WIRE_ORDER = [DELL, STATUS_QUO, MAC]
const CANVAS_ORDER = [STATUS_QUO, MAC, DELL]

function block(nearTie: { is_tie: boolean } = { is_tie: false }): V5AnalysisResultBlockType {
  return {
    type: 'v5_analysis_result',
    summary: 'Ran analysis on your current scenario.',
    leading_option_id: 'opt_mac',
    win_probabilities: WIN_PROBABILITIES,
    enrichment: {
      option_comparison: [
        { option_id: 'opt_dell', label: DELL, win_probability: 0.3234 },
        { option_id: 'opt_sq', label: STATUS_QUO, win_probability: 0.2489 },
        { option_id: 'opt_mac', label: MAC, win_probability: 0.4277 },
      ],
      robustness: { near_tie: { ...nearTie, top_option_id: 'opt_mac', gap: 0.104, threshold: 0.1 } },
    },
  } as V5AnalysisResultBlockType
}

function setAdmission(mode: AnalysisAdmissionV1['permitted_analysis_mode'] | null): void {
  useCanvasStore.setState({
    ceeAnalysisReady: mode
      ? { status: 'ready', options: [], goal_node_id: 'goal_1', analysis_admission: { permitted_analysis_mode: mode, reasons: [] } }
      : null,
  } as never)
}

/** Canvas: Status quo, a factor, MacBook, Dell. */
function setCanvas(nodes: Array<{ id: string; type: string; label: string }>): void {
  useCanvasStore.setState({
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: { x: 0, y: 0 }, data: { label: n.label } })),
  } as never)
}
const CANVAS = [
  { id: 'opt_sq', type: 'option', label: STATUS_QUO },
  { id: 'fac_price', type: 'factor', label: 'Price per seat' },
  { id: 'opt_mac', type: 'option', label: MAC },
  { id: 'opt_dell', type: 'option', label: DELL },
]

const pills = (): HTMLElement[] =>
  within(screen.getByTestId('v5-analysis-result-probabilities')).getAllByRole('listitem')
const order = (): string[] =>
  pills().map((p) => [MAC, DELL, STATUS_QUO].find((label) => p.textContent?.includes(label)) ?? '?')
const crowned = (): HTMLElement[] => pills().filter((p) => p.getAttribute('data-leader') === 'true')

const initialNodes = useCanvasStore.getState().nodes
beforeEach(() => {
  setAdmission(null)
  setCanvas(CANVAS)
})
afterEach(() => {
  cleanup()
  setAdmission(null)
  useCanvasStore.setState({ nodes: initialNodes } as never)
})

describe('a LICENSED leader keeps largest-first (the control)', () => {
  it('comparative_leader admission, separated run: the leader first, then largest-first', () => {
    setAdmission('comparative_leader')
    render(<V5AnalysisResultBlock block={block()} />)
    expect(order()).toEqual(LARGEST_FIRST)
    expect(crowned().map((p) => p.textContent)).toEqual([expect.stringContaining(MAC)])
  })
})

describe('NO licensed leader: every number, in canvas order', () => {
  it.each([
    ['exploratory admission', () => setAdmission('exploratory'), block()],
    ['admission refused (`none`)', () => setAdmission('none'), block()],
    ['a near tie the producer calls', () => setAdmission('comparative_leader'), block({ is_tie: true })],
  ])('%s: canvas order, nothing crowned, every share shown', (_name, arrange, b) => {
    arrange()
    render(<V5AnalysisResultBlock block={b} />)
    expect(order(), 'canvas order, not largest-first').toEqual(CANVAS_ORDER)
    expect(order()).not.toEqual(LARGEST_FIRST)
    expect(crowned()).toEqual([])
    for (const [label] of Object.entries(WIN_PROBABILITIES)) {
      expect(pills().some((p) => p.textContent?.includes(label)), `${label}'s number still renders`).toBe(true)
    }
  })

  it('no option on the canvas: the wire order stands (nothing to reorder by)', () => {
    setAdmission('exploratory')
    setCanvas([])
    render(<V5AnalysisResultBlock block={block()} />)
    expect(order()).toEqual(WIRE_ORDER)
  })

  it('an option the canvas no longer has keeps its wire position, after the ones it does have', () => {
    setAdmission('exploratory')
    setCanvas(CANVAS.filter((n) => n.id !== 'opt_sq'))
    render(<V5AnalysisResultBlock block={block()} />)
    expect(order()).toEqual([MAC, DELL, STATUS_QUO])
  })

  it('only OPTION nodes set the order: a factor that shares an option label cannot pull it forward', () => {
    setAdmission('exploratory')
    setCanvas([{ id: 'fac_mac_echo', type: 'factor', label: MAC }, ...CANVAS])
    render(<V5AnalysisResultBlock block={block()} />)
    expect(order()).toEqual(CANVAS_ORDER)
  })

  it('id-keyed shares (some paths key by option id) follow canvas order too', () => {
    setAdmission('exploratory')
    const idKeyed = { ...block(), win_probabilities: { opt_dell: 0.3234, opt_sq: 0.2489, opt_mac: 0.4277 } }
    render(<V5AnalysisResultBlock block={idKeyed} />)
    const ids = pills().map((p) => ['opt_mac', 'opt_dell', 'opt_sq'].find((id) => p.textContent?.includes(id)) ?? '?')
    expect(ids).toEqual(['opt_sq', 'opt_mac', 'opt_dell'])
  })
})
