/**
 * InspectorGuidanceSection — DSK provenance badge (CAPABILITY-AGENDA §2 Lane 1,
 * UI half; P1 "surface the science").
 *
 * WHAT THIS PINS. `GuidanceItem` has carried `dsk_claim_id` /
 * `evidence_strength` since Brief A.2 (9913fde6) and no surface ever rendered
 * them — scientifically-grounded coaching was indistinguishable from generic
 * chat. This suite pins the badge on the ONE live GuidanceItem card surface
 * (`InspectorGuidanceSection`, mounted unconditionally by NodeInspector:607
 * and EdgeInspector:323 — no flag gate in the chain, derived at tip 2e992a9f).
 *
 * WIRE HONESTY (derived 2026-08-08 from the golden-journey captures,
 * PHASE0-EVIDENCE-2026-07-28/golden-journey-runs/20260808T*):
 *   - 185 coaching blocks across 12 staging runs carry ZERO dsk/grounding
 *     keys (0/185). The live dsk carriers are decision_quality_prompts[]
 *     (rendered by KeyQuestionCard) and exercise dsk_provenance (rendered by
 *     V5ExerciseBlock) — NOT guidance-bearing blocks.
 *   - The committed fixture `live-analysis-turn-T3-20260808T155759Z.json` is
 *     one such REAL capture body, verbatim: 19 blocks, 6 coaching, 0 dsk keys
 *     on any Phase 3 block. Suite 1 drives it through the REAL ingestion
 *     chain (parseV5Response → extractPhase3FromV5Response →
 *     toStoreGuidanceItem) and pins the emit-honesty fact: TODAY'S wire
 *     cannot light the badge. When CEE (item iv / ROADMAP 2.456) starts
 *     emitting, that pin flips RED — which is the desired alarm, because the
 *     V5 derivation chain must then carry the fields (deriveGuidance and
 *     toStoreGuidanceItem both drop them at this tip; out of this lane's
 *     territory, reported).
 *   - The PRESENT-case items in Suites 2-5 are therefore REAL-capture-derived
 *     items AUGMENTED with the dsk field family, using only REAL wire values
 *     observed in the same capture's decision_quality_prompts (DSK-T-002 /
 *     DSK-P-002 / "strong"). The augmentation is exactly the delta CEE (iv)
 *     will emit. A fixture we authored is not evidence about the wire (trap
 *     16) — Suite 1 is the wire evidence; these suites are the display
 *     contract.
 *
 * HONESTY CONTRACT (vocabulary derived from the two existing grounding
 * badges — KeyQuestionCard's dsk-grounding line and V5ExerciseBlock's
 * dsk-provenance line):
 *   - No `dsk_claim_id` ⇒ NO badge, whatever else the item carries — never a
 *     default id, never an inferred strength (id-gated as a unit, the
 *     decisionQualityPrompts rule verbatim).
 *   - Ids ride as data-* attributes ONLY, never as user copy (both existing
 *     badges; CEE #830's lesson).
 *   - The static label names the channel; no model prose is ever
 *     interpolated under it.
 *   - `evidence_strength` renders only when it is a member of the store's
 *     own closed vocabulary (weak/medium/strong/mixed) — the store holds
 *     verbatim-passthrough objects TypeScript never runtime-checked, so the
 *     gate is enforced at derivation, not assumed from the type.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { InspectorGuidanceSection } from '../inspector/InspectorGuidanceSection'
import { NodeInspector } from '../NodeInspector'
import * as guidanceStoreModule from '../../stores/guidanceStore'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'
import { parseV5Response } from '../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../v5/extractPhase3FromV5Response'
import { toStoreGuidanceItem } from '../../conversation/useConversation'
import liveTurnBody from '../../../v5/__tests__/fixtures/live-analysis-turn-T3-20260808T155759Z.json'

// ---------------------------------------------------------------------------
// Real-capture ingestion — the EXPORTED chain, not a re-implementation
// ---------------------------------------------------------------------------

/**
 * Drive the committed REAL capture body through the exported ingestion path
 * and return the store-shaped guidance items exactly as the live turn handler
 * would produce them (useConversation.ts:4655).
 */
async function ingestLiveCapture(): Promise<GuidanceItem[]> {
  const res = new Response(JSON.stringify(liveTurnBody), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  const parsed = await parseV5Response(res)
  if (parsed.kind !== 'response') {
    throw new Error(`real capture failed to parse: ${parsed.kind}`)
  }
  const phase3 = extractPhase3FromV5Response(parsed.response)
  return phase3.guidanceItems.map(toStoreGuidanceItem)
}

/**
 * The attested item for the PRESENT-case suites: a REAL-capture-derived item
 * augmented with the dsk family, values taken VERBATIM from the same
 * capture's attested decision_quality_prompts entries (dsk_claim_id
 * "DSK-T-002", dsk_protocol_id "DSK-P-002", evidence_strength "strong").
 * See the header: the augmentation is the anticipated CEE (iv) delta, and
 * Suite 1 is what keeps us honest about the wire meanwhile.
 */
function attest(item: GuidanceItem, overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    ...item,
    dsk_claim_id: 'DSK-T-002',
    dsk_protocol_id: 'DSK-P-002',
    evidence_strength: 'strong',
    ...overrides,
  }
}

const BADGE_TESTID = 'guidance-dsk-badge'
const CARD_TESTID = 'inspector-guidance-card'

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Suite 1 — wire honesty: REAL capture bytes, emit-vs-omit pinned
// ---------------------------------------------------------------------------

describe('DSK badge — wire honesty (real 2026-08-08 staging capture)', () => {
  it('the capture derives guidance items and NONE carries any dsk field (emit-honesty pin — flips RED the day CEE starts emitting)', async () => {
    const items = await ingestLiveCapture()
    // The capture carries 6 coaching + 7 review_card + 3 evidence + 1
    // exercise Phase 3 blocks; deriveGuidance maps the titled ones. Guard the
    // suite against a silently-empty ingestion (a vacuous loop proves
    // nothing — trap 13).
    expect(items.length).toBeGreaterThanOrEqual(6)
    for (const item of items) {
      expect(item.dsk_claim_id, `item ${item.item_id} unexpectedly carries dsk_claim_id`).toBeUndefined()
      expect(item.dsk_protocol_id, `item ${item.item_id} unexpectedly carries dsk_protocol_id`).toBeUndefined()
      expect(item.evidence_strength, `item ${item.item_id} unexpectedly carries evidence_strength`).toBeUndefined()
    }
  })

  it('real-wire items render guidance cards with NO badge — proven by a positive control that the badge query can see a presence', async () => {
    const items = await ingestLiveCapture()
    // The first coaching block in the capture targets fac_adoption_risk.
    const target = 'fac_adoption_risk'
    const matching = items.filter((i) => i.target_object?.id === target)
    expect(matching.length).toBeGreaterThanOrEqual(1)

    useGuidanceStore.getState().setGuidanceItems(items)
    const { unmount } = render(<InspectorGuidanceSection elementId={target} />)
    // Cards render (the absence assertion is about the badge, not the section)
    expect(screen.getAllByTestId(CARD_TESTID).length).toBeGreaterThanOrEqual(1)
    // No badge anywhere on today's real wire
    expect(screen.queryAllByTestId(BADGE_TESTID)).toHaveLength(0)
    unmount()

    // POSITIVE CONTROL (trap 13): the same query MUST find the badge when the
    // fields are present, or the absence above proved nothing.
    const control = attest({ ...matching[0], item_id: 'positive-control' })
    useGuidanceStore.getState().setGuidanceItems([control])
    render(<InspectorGuidanceSection elementId={target} />)
    expect(screen.getAllByTestId(BADGE_TESTID)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Suite 2 — presence + identity binding
// ---------------------------------------------------------------------------

describe('DSK badge — presence, bound by identity to THE attested item', () => {
  it('renders EXACTLY ONE badge, inside THE attested item card, carrying THE claim id', async () => {
    const items = await ingestLiveCapture()
    const target = 'fac_adoption_risk'
    const base = items.find((i) => i.target_object?.id === target)
    expect(base).toBeDefined()

    const attested = attest({ ...base!, item_id: 'guid-attested', title: 'Attested coaching item' })
    const unattested: GuidanceItem = { ...base!, item_id: 'guid-unattested', title: 'Unattested coaching item' }
    useGuidanceStore.getState().setGuidanceItems([attested, unattested])

    render(<InspectorGuidanceSection elementId={target} />)
    expect(screen.getAllByTestId(CARD_TESTID)).toHaveLength(2)

    const badges = screen.getAllByTestId(BADGE_TESTID)
    expect(badges).toHaveLength(1)

    // Identity binding: THE badge sits inside THE attested item's card —
    // asserted via the card's data-item-id, not a value predicate another
    // card could satisfy (trap 19).
    const hostCard = badges[0].closest(`[data-testid="${CARD_TESTID}"]`)
    expect(hostCard).not.toBeNull()
    expect(hostCard!.getAttribute('data-item-id')).toBe('guid-attested')

    // THE claim id, as data-* attributes
    expect(badges[0].getAttribute('data-dsk-claim-id')).toBe('DSK-T-002')
    expect(badges[0].getAttribute('data-dsk-protocol-id')).toBe('DSK-P-002')
    expect(badges[0].getAttribute('data-dsk-evidence-strength')).toBe('strong')

    // Copy: channel label + closed-vocabulary strength, nothing else
    expect(badges[0].textContent).toBe('Grounded in decision science · strong evidence')
  })

  it('claim/protocol ids NEVER appear as user copy (both existing badges rule; CEE #830)', async () => {
    const items = await ingestLiveCapture()
    const target = 'fac_adoption_risk'
    const base = items.find((i) => i.target_object?.id === target)
    useGuidanceStore.getState().setGuidanceItems([attest({ ...base!, item_id: 'guid-attested' })])

    render(<InspectorGuidanceSection elementId={target} />)
    const card = screen.getByTestId(CARD_TESTID)
    expect(card.textContent).not.toContain('DSK-T-002')
    expect(card.textContent).not.toContain('DSK-P-002')
  })
})

// ---------------------------------------------------------------------------
// Suite 3 — honesty gates
// ---------------------------------------------------------------------------

describe('DSK badge — honesty gates', () => {
  const baseItem = (): GuidanceItem => ({
    item_id: 'guid-gate',
    source: 'analysis',
    title: 'Gate test item',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Discuss.' },
    target_object: { type: 'node', id: 'node-gate' },
  })

  it('no claim id ⇒ NO badge, even when a strength is present (id-gated as a unit)', () => {
    useGuidanceStore.getState().setGuidanceItems([
      { ...baseItem(), evidence_strength: 'strong' },
    ])
    render(<InspectorGuidanceSection elementId="node-gate" />)
    expect(screen.getAllByTestId(CARD_TESTID)).toHaveLength(1)
    expect(screen.queryAllByTestId(BADGE_TESTID)).toHaveLength(0)
  })

  it('empty-string claim id ⇒ NO badge (runtime gate, not a type assumption)', () => {
    useGuidanceStore.getState().setGuidanceItems([
      { ...baseItem(), dsk_claim_id: '', evidence_strength: 'strong' },
    ])
    render(<InspectorGuidanceSection elementId="node-gate" />)
    expect(screen.queryAllByTestId(BADGE_TESTID)).toHaveLength(0)
  })

  it('a strength outside the closed vocabulary renders NO strength copy and NO strength attribute — the id badge still renders', () => {
    useGuidanceStore.getState().setGuidanceItems([
      {
        ...baseItem(),
        dsk_claim_id: 'DSK-T-002',
        // The store holds verbatim passthrough objects the compiler never
        // runtime-checked — an unattested word must not render as science.
        evidence_strength: 'overwhelming' as GuidanceItem['evidence_strength'],
      },
    ])
    render(<InspectorGuidanceSection elementId="node-gate" />)
    const badge = screen.getByTestId(BADGE_TESTID)
    expect(badge.textContent).toBe('Grounded in decision science')
    expect(badge.hasAttribute('data-dsk-evidence-strength')).toBe(false)
  })

  it("'mixed' is a member of the store's own vocabulary and renders as copy (vocabulary breadth — this path is NOT the dqp path's 3-word set)", () => {
    useGuidanceStore.getState().setGuidanceItems([
      { ...baseItem(), dsk_claim_id: 'DSK-T-002', evidence_strength: 'mixed' },
    ])
    render(<InspectorGuidanceSection elementId="node-gate" />)
    expect(screen.getByTestId(BADGE_TESTID).textContent).toBe('Grounded in decision science · mixed evidence')
  })

  it('protocol id attribute appears only when supplied — never defaulted', () => {
    useGuidanceStore.getState().setGuidanceItems([
      { ...baseItem(), dsk_claim_id: 'DSK-T-002' },
    ])
    render(<InspectorGuidanceSection elementId="node-gate" />)
    const badge = screen.getByTestId(BADGE_TESTID)
    expect(badge.getAttribute('data-dsk-claim-id')).toBe('DSK-T-002')
    expect(badge.hasAttribute('data-dsk-protocol-id')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Suite 4 — the derivation is the single source of truth in the store module
// ---------------------------------------------------------------------------

describe('deriveGuidanceDskProvenance — the one home of the rule', () => {
  it('is exported from guidanceStore (surfaces must derive, never re-implement)', () => {
    expect(typeof (guidanceStoreModule as Record<string, unknown>).deriveGuidanceDskProvenance).toBe('function')
  })

  it('id-gates as a unit and carries protocol/strength only alongside the id', () => {
    const derive = (guidanceStoreModule as unknown as {
      deriveGuidanceDskProvenance: (i: GuidanceItem) => { claimId: string; protocolId?: string; strength?: string } | undefined
    }).deriveGuidanceDskProvenance
    const base: GuidanceItem = {
      item_id: 'g',
      source: 'analysis',
      title: 'T',
      priority: 50,
      primary_action: { type: 'discuss', prompt: 'p' },
    }
    expect(derive(base)).toBeUndefined()
    expect(derive({ ...base, evidence_strength: 'strong' })).toBeUndefined()
    expect(derive({ ...base, dsk_claim_id: 'DSK-B-003' })).toEqual({ claimId: 'DSK-B-003' })
    expect(derive({ ...base, dsk_claim_id: 'DSK-B-003', dsk_protocol_id: 'DSK-P-002', evidence_strength: 'medium' }))
      .toEqual({ claimId: 'DSK-B-003', protocolId: 'DSK-P-002', strength: 'medium' })
    // Non-string smuggle (verbatim passthrough store): fail closed
    expect(derive({ ...base, dsk_claim_id: 42 as unknown as string })).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Suite 5 — mount path (trap 3b: bind to the surface the deployment mounts)
// ---------------------------------------------------------------------------

describe('DSK badge — real mount chain (NodeInspector)', () => {
  it('reaches the DOM through NodeInspector → InspectorGuidanceSection with no flag in the chain', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'fac_adoption_risk', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'User Adoption Uncertainty' } },
      ],
      edges: [],
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      results: { status: 'idle', progress: 0, report: null },
    })
    useGuidanceStore.getState().setGuidanceItems([
      {
        item_id: 'guid-mount',
        source: 'analysis',
        title: 'Mounted attested item',
        priority: 50,
        primary_action: { type: 'discuss', prompt: 'Discuss.' },
        target_object: { type: 'node', id: 'fac_adoption_risk' },
        dsk_claim_id: 'DSK-T-002',
        dsk_protocol_id: 'DSK-P-002',
        evidence_strength: 'strong',
      },
    ])

    render(<NodeInspector nodeId="fac_adoption_risk" onClose={() => {}} />)

    // The section mounts inside the inspector (the surface testers use) …
    expect(screen.getByTestId('inspector-guidance-section')).toBeDefined()
    // … and THE badge for THE item is in its DOM.
    const badge = screen.getByTestId(BADGE_TESTID)
    expect(badge.getAttribute('data-dsk-claim-id')).toBe('DSK-T-002')
    expect(badge.closest(`[data-testid="${CARD_TESTID}"]`)!.getAttribute('data-item-id')).toBe('guid-mount')
  })
})
