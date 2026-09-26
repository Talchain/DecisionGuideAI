/**
 * ⭐⭐ S4 ROW-END PROMPTS — WHAT THEY DO, WHAT THEY ARE NOT.
 *
 * Experience Design, #63 5806207128 / 5806266691 (24 Sep 2026):
 *   · "They are reasoning-frontier affordances, not graph nodes/truth and carry
 *      no causal edges."
 *   · "clicking engages the appropriate ideation/coaching action. They do not
 *      silently mutate the model." — the brief: "click opens contextual AI with
 *      a pre-filled question (never auto-send/mutate)".
 *   · "hide/reduce these at the far/line rung."
 *   · "160px is approved as the target width."
 *
 * Bound by identity: the prompt a test clicks is found by its accessible name,
 * which is the tier table's own question.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ReactFlowProvider, type Node, type NodeProps } from '@xyflow/react'
import { GhostTierNode, GHOST_TIER_TESTID } from '../GhostTierNode'
import { GhostOptionNode } from '../GhostOptionNode'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'
import { GHOST_TIERS, GHOST_OPTION_DOOR_LABEL, withGhostTiers } from '../../utils/ghostTiers'
import { excludeNonModelNodes, fitFrameNodes, isGhostNode, GHOST_OPTION_NODE_ID } from '../../utils/fitTargets'
import { ROW_PROMPT_H, ROW_PROMPT_W } from '../../utils/nodeLayoutConstants'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const RISK = GHOST_TIERS.find((t) => t.siblingType === 'risk')!
const RISK_PROMPT = 'My model has 1 risk: Churn. What could go wrong that these do not already cover?'

function mountTier(data: Record<string, unknown>) {
  const props = { id: RISK.id, type: 'ghost-tier', data, selected: false, zIndex: 0, isConnectable: false, dragging: false } as unknown as NodeProps
  return render(<ReactFlowProvider><GhostTierNode {...props} /></ReactFlowProvider>)
}
function mountOption(data: Record<string, unknown>) {
  const props = { id: GHOST_OPTION_NODE_ID, type: 'ghost-option', data, selected: false, zIndex: 0, isConnectable: false, dragging: false } as unknown as NodeProps
  return render(<ReactFlowProvider><GhostOptionNode {...props} /></ReactFlowProvider>)
}

function captureAsks() {
  const prefilled: string[] = []
  const sent: string[] = []
  useGuidanceStore.setState({
    _prefillChat: (t: string) => { prefilled.push(t) },
    _sendMessage: (t: string) => { sent.push(t) },
  } as never)
  return { prefilled, sent }
}

beforeEach(() => {
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
  useCanvasStore.setState({ lodRung: 'quiet' } as never)
})
afterEach(cleanup)

describe('a click PRE-FILLS the question; it never sends and never mutates', () => {
  it('⭐ the risk prompt pre-fills exactly its composed question, and sends nothing', () => {
    const asks = captureAsks()
    mountTier({ label: RISK.label, prompt: RISK_PROMPT, tier: 'risk' })
    fireEvent.click(screen.getByRole('button', { name: RISK.label }))
    expect(asks.prefilled).toEqual([RISK_PROMPT])
    expect(asks.sent, 'the prompt sent a message on the user\'s behalf').toEqual([])
  })

  it('…and by keyboard, the same way', () => {
    const asks = captureAsks()
    mountTier({ label: RISK.label, prompt: RISK_PROMPT, tier: 'risk' })
    fireEvent.keyDown(screen.getByRole('button', { name: RISK.label }), { key: 'Enter' })
    expect(asks.prefilled).toEqual([RISK_PROMPT])
    expect(asks.sent).toEqual([])
  })

  it('⛔ a click leaves the model untouched — no node, no edge', () => {
    captureAsks()
    useCanvasStore.setState({ nodes: [], edges: [] } as never)
    mountTier({ label: RISK.label, prompt: RISK_PROMPT, tier: 'risk' })
    fireEvent.click(screen.getByRole('button', { name: RISK.label }))
    expect(useCanvasStore.getState().nodes).toEqual([])
    expect(useCanvasStore.getState().edges).toEqual([])
  })
})

describe('the far rung hides the prompts; the landing rungs show them', () => {
  it('⭐ at `line` the tier prompt is hidden, out of the tab order and out of the accessibility tree', () => {
    useCanvasStore.setState({ lodRung: 'line' } as never)
    mountTier({ label: RISK.label, prompt: RISK_PROMPT, tier: 'risk' })
    const door = screen.getByTestId(GHOST_TIER_TESTID)
    expect(door.style.visibility).toBe('hidden')
    expect(door.getAttribute('tabindex')).toBe('-1')
    expect(door.getAttribute('aria-hidden')).toBe('true')
  })

  it('⭐ …and so is the option prompt', () => {
    useCanvasStore.setState({ lodRung: 'line' } as never)
    mountOption({ prompt: 'x' })
    const door = screen.getByLabelText(GHOST_OPTION_DOOR_LABEL, { selector: '[role="button"]' })
    expect(door.style.visibility).toBe('hidden')
    expect(door.getAttribute('tabindex')).toBe('-1')
  })

  it.each(['quiet', 'full'] as const)('CONTRAST: at `%s` both prompts are visible and focusable', (rung) => {
    useCanvasStore.setState({ lodRung: rung } as never)
    mountTier({ label: RISK.label, prompt: RISK_PROMPT, tier: 'risk' })
    mountOption({ prompt: 'x' })
    const tier = screen.getByRole('button', { name: RISK.label })
    const option = screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL })
    for (const door of [tier, option]) {
      expect(door.style.visibility).not.toBe('hidden')
      expect(door.getAttribute('tabindex')).toBe('0')
    }
  })
})

describe('the prompt box is the row slot the layout reserved', () => {
  it('both prompt kinds are exactly ROW_PROMPT_W wide with a ROW_PROMPT_H floor (ED: 160px)', () => {
    expect(ROW_PROMPT_W).toBe(160)
    mountTier({ label: RISK.label, prompt: RISK_PROMPT, tier: 'risk' })
    mountOption({ prompt: 'x' })
    const tier = screen.getByRole('button', { name: RISK.label })
    const option = screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL })
    for (const door of [tier, option]) {
      expect(door.style.width).toBe(`${ROW_PROMPT_W}px`)
      expect(door.style.minHeight).toBe(`${ROW_PROMPT_H}px`)
      // A floor, never a fixed height — a fourth line costs height, not a word.
      expect(door.style.height).toBe('')
    }
  })
})

describe('they are not graph nodes', () => {
  const n = (id: string, type: string, x: number, y: number): Node =>
    ({ id, type, position: { x, y }, data: { label: id }, measured: { width: 260, height: 100 } }) as unknown as Node
  const MODEL: Node[] = [
    n('dec', 'decision', 0, 0), n('opt', 'option', 0, 200), n('fac', 'factor', 0, 400),
    n('out', 'outcome', 0, 600), n('risk', 'risk', 316, 600), n('goal', 'goal', 0, 800),
  ]

  it('⭐ one prompt per ROW, none per card; the input model is not mutated', () => {
    const before = JSON.stringify(MODEL)
    const out = withGhostTiers(MODEL)
    expect(JSON.stringify(MODEL)).toBe(before)
    // v3.1 WS1 #27 (ED 5810951997, "once per row"): outcomes and risks share a
    // row, so they share ONE door — never two stacked in one band.
    expect(out.filter((x) => isGhostNode(x.id)).map((x) => x.id).sort()).toEqual(
      ['__ghost-consequence__', '__ghost-factor__', '__ghost-option__'],
    )
  })

  it('⭐ excluded from every count, INCLUDED in the landing frame', () => {
    const out = withGhostTiers(MODEL)
    expect(excludeNonModelNodes(out).map((x) => x.id)).toEqual(MODEL.map((x) => x.id))
    // Every door on the board is in the frame — the shared consequence door too.
    expect(fitFrameNodes(out)).toHaveLength(MODEL.length + 3)
    // CONTRAST: a ghost that is not a row-end prompt stays out of the frame too.
    const stray = { id: '__ghost-something-else__' }
    expect(fitFrameNodes([stray])).toEqual([])
  })

  it('⛔ not selectable, draggable or connectable, and they carry no edges', () => {
    for (const g of withGhostTiers(MODEL).filter((x) => isGhostNode(x.id))) {
      expect(g.selectable, g.id).toBe(false)
      expect(g.draggable, g.id).toBe(false)
      expect(g.connectable, g.id).toBe(false)
    }
  })

  it('a family with no members gets no prompt — that would be a judgement about the model', () => {
    const noRisks = MODEL.filter((x) => x.type !== 'risk')
    expect(withGhostTiers(noRisks).map((x) => x.id)).not.toContain('__ghost-risk__')
  })
})
