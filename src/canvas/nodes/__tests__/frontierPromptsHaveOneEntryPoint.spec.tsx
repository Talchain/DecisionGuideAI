/**
 * ⭐ U9 — EACH "WHAT ELSE…" QUESTION HAS ONE ENTRY POINT, AND NONE SITS ON A
 * CARD AT REST (contract v3.1 pt 6; ED 11:52Z pt 5, #63 5794306145).
 *
 * Served `24e06704`, Paul's screenshot B: the rightmost option carried an
 * in-card "What else could you do?" link while the dashed ghost card beside the
 * Options row asked the SAME question; the rightmost factor carried "What else
 * drives this?"; the consequence row's last card stacked "What else could go
 * wrong?" and "Where else could this lead?".
 *
 * Contract v3.1 pt 6: coaching is ONE discreet icon per card — "Only meaningful
 * signals appear. The coaching action remains available without adding a panel
 * inside the card." ED 11:52Z pt 5 names "What else could go wrong?" as stacked
 * coaching to move behind the one coaching affordance.
 *
 * What stays reachable, bound here by identity (testid / exact label):
 *   · option  → the ghost card `__ghost-option__` ONLY (its send-vs-prefill
 *     behaviour is unchanged in this slice — see the DEFERRED note: it SENDS;
 *     v3.1's editable draft, "does not send or mutate silently", lands with #1931);
 *   · factor / risk / outcome → the ROW-END PROMPT after the family's final
 *     sub-row (S4, ED #63 5806207128 / 5806266691; Paul, 24 Sep: "bring back
 *     the per-row prompts"), and never a link on a card. It sends too until
 *     #1931 (50cfc25b).
 *
 * CLAUDE.md trap 3: jsdom proves presence/absence of elements, not visibility.
 */
import type { ComponentType } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { GhostTierNode } from '../GhostTierNode'
import {
  GHOST_TIERS,
  tierInvitations,
  withGhostTiers,
} from '../../utils/ghostTiers'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/** A drafted board: two options on one row, two factors on the next. */
const at = (id: string, type: string, label: string, x: number, y: number): Node =>
  ({ id, type, position: { x, y }, data: { label, type } }) as Node

const MODEL: Node[] = [
  at('d1', 'decision', 'Raise the Pro price?', 0, 0),
  at('o1', 'option', 'Keep £49', 0, 300),
  at('o2', 'option', 'Move to £59', 300, 300),
  at('f1', 'factor', 'Trial conversion', 0, 600),
  at('f2', 'factor', 'Monthly price', 300, 600),
]

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: MODEL,
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  viewMode: 'standard',
  lodRung: 'full',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

const setView = (viewMode: 'standard' | 'expert') => {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(makeStoreState({ viewMode }) as never),
  )
}

const cardProps = (id: string, type: string): Record<string, unknown> =>
  ({
    id,
    type,
    position: { x: 0, y: 0 },
    selected: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    zIndex: 0,
    deletable: true,
    selectable: true,
    draggable: true,
    width: 240,
    height: 100,
  })

function mountCard(kind: 'factor' | 'option', id: string, label: string) {
  // NodeProps carries a dozen fields no assertion reads; the sibling node specs
  // cast the same way.
  const Comp = (kind === 'factor' ? FactorNode : OptionNode) as unknown as ComponentType<Record<string, unknown>>
  const data = kind === 'factor'
    ? { label, type: 'factor', category: 'external', observedState: { raw_value: 0.3, unit: null } }
    : { label, type: 'option' }
  render(
    <ReactFlowProvider>
      <Comp {...cardProps(id, kind)} data={data} />
    </ReactFlowProvider>,
  )
  // Positive control before any absence is read: the card mounted.
  expect(screen.getAllByTestId('node-title').length, 'the card did not mount').toBeGreaterThan(0)
}

const OPTION_LABEL = GHOST_TIERS.find((t) => t.siblingType === 'option')!.label
const FACTOR_LABEL = GHOST_TIERS.find((t) => t.siblingType === 'factor')!.label

let prefills: string[]
let sends: string[]

beforeEach(() => {
  cleanup()
  prefills = []
  sends = []
  // A composer is registered, so every ask-gated affordance CAN render — an
  // absence below is then the gate under test, not a missing surface.
  useGuidanceStore.setState({
    _prefillChat: (t: string) => { prefills.push(t) },
    _sendMessage: (t: string) => { sends.push(t) },
  } as never)
  setView('standard')
})

describe('the option question has ONE entry point: the ghost card', () => {
  it('⭐ the in-card list never offers the option tier — the ghost card owns it', () => {
    const tiers = [...tierInvitations(MODEL).values()].flat().map((i) => i.tier)
    expect(tiers).not.toContain('option')
    // CONTRAST: the factor tier is still offered, on the factor row's last card.
    expect(tierInvitations(MODEL).get('f2')?.map((i) => i.tier)).toEqual(['factor'])
  })

  it('⭐ Standard view: the last option card carries no "What else could you do?" link', () => {
    mountCard('option', 'o2', 'Move to £59')
    expect(screen.queryByTestId('tier-invitation-option')).toBeNull()
    expect(screen.queryByRole('button', { name: OPTION_LABEL })).toBeNull()
  })

  it('⭐ Detailed view too: never the ghost card AND an in-card link for the same question', () => {
    setView('expert')
    mountCard('option', 'o2', 'Move to £59')
    expect(screen.queryByTestId('tier-invitation-option')).toBeNull()
    expect(screen.queryByRole('button', { name: OPTION_LABEL })).toBeNull()
  })

  // ⚠ DEFERRED (24 Sep, #1926 S1): the ghost card's prefill-not-send change is
  // held back to a follow-up. Its requestAsk path, taken from a minimised Olumi
  // panel, left the conversation callbacks unregistered in CI (every coaching
  // icon vanished — Browser Gate nodeKeyboardBleed, NORMALZOOMDIAG canAsk=false).
  // Served behaviour (send) is restored here; the fix lands with its own proof.
})

/**
 * ⭐ S4 (24 Sep 2026): THE FACTOR / RISK / OUTCOME QUESTIONS ARE ROW-END PROMPTS
 * AGAIN, AND NO CARD CARRIES ONE. Experience Design (#63 5806207128 /
 * 5806266691): "one row-end prompt for Factors / Outcomes / Risks while keeping
 * the Option ghost as its sole entry point is correct. Do not also restore
 * in-card prompt links." From 24 Sep until S4 these questions sat on the row's
 * last card as a stopgap "until the row-end prompt cards return with the
 * laptop-fit slice" — this is that slice, so the stopgap goes.
 */
describe('the factor / risk / outcome questions have ONE entry point: the row-end prompt (S4)', () => {
  it('⭐ Standard view: the factor row’s last card carries NO in-card question', () => {
    mountCard('factor', 'f2', 'Monthly price')
    expect(screen.queryByTestId('tier-invitations')).toBeNull()
    expect(screen.queryByRole('button', { name: FACTOR_LABEL })).toBeNull()
  })

  it('⭐ Detailed view too — never a card link AND a row-end prompt for the same question', () => {
    setView('expert')
    mountCard('factor', 'f2', 'Monthly price')
    expect(screen.queryByTestId('tier-invitations')).toBeNull()
    expect(screen.queryByRole('button', { name: FACTOR_LABEL })).toBeNull()
  })

  // ⚠ RE-POINTED TO WHAT THIS BRANCH SERVES (50cfc25b; #1926 S1 Browser Gate
  // NORMALZOOMDIAG): the row-end prompts ask through the served `_sendMessage`,
  // exactly as the ghost option card does, because `requestAsk` taken from a
  // minimised Olumi panel left the conversation callbacks unregistered. PR #1931
  // fixes that and switches every frontier prompt to prefill-and-confirm
  // (`requestAsk`); THIS TEST FLIPS THERE — back to one prefill and zero sends.
  // What stays pinned here: one entry point, after the row's last card, and a
  // click that reaches the conversation with the row's own question, once.
  it('⭐ …and the question IS reachable: the row-end prompt stands after the row’s last card and a click asks it in the conversation (send until #1931)', () => {
    const prompt = withGhostTiers(MODEL).find((n) => n.id === '__ghost-factor__')
    expect(prompt, 'no factor prompt was placed for a model with factors').toBeDefined()
    // After the card that ends the factor row (f2), on that row.
    const f2 = MODEL.find((n) => n.id === 'f2')!
    expect(prompt!.position.y).toBe(f2.position.y)
    expect(prompt!.position.x).toBeGreaterThan(f2.position.x)
    const props = { id: prompt!.id, type: 'ghost-tier', data: prompt!.data, selected: false, zIndex: 0, isConnectable: false, dragging: false } as unknown as NodeProps
    render(
      <ReactFlowProvider>
        <GhostTierNode {...props} />
      </ReactFlowProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: FACTOR_LABEL }))
    expect(sends.length, 'one click asks the question exactly once').toBe(1)
    expect(sends[0]).toContain('Trial conversion')
    // One path, not two: no draft is ALSO left in the composer (#1931 flips
    // these two: prefills → 1, sends → []).
    expect(prefills).toEqual([])
  })

  it('⛔ CONTRAST: a factor that does not end its row carries none either', () => {
    setView('expert')
    mountCard('factor', 'f1', 'Trial conversion')
    expect(screen.queryByTestId('tier-invitations')).toBeNull()
  })
})
