/**
 * DSK CLAIM PROVENANCE — the two UI carry hops (ROADMAP 2.962).
 *
 * WHAT THIS PINS. schemas 0.39.0 added `dsk_claim_provenance` to
 * `CoachingBlockSchema` and `ReviewCardBlockSchema` — the ATOMIC strict triple
 * `{claim_id, claim_title, evidence_strength}` + optional `protocol_id`. The
 * render half shipped in #633 (`InspectorGuidanceSection`'s
 * `guidance-dsk-badge`). Between the wire and that badge sit TWO hops that
 * silently dropped the family:
 *   1. `deriveGuidance`      (src/v5/extractPhase3FromV5Response.ts) — per-field
 *                             conditional spreads, no dsk reference;
 *   2. `toStoreGuidanceItem` (src/canvas/conversation/useConversation.ts) —
 *                             explicit field-by-field, no spread.
 * The #633 pre-merge review PROVED the drop by execution: injecting the full
 * dsk family into all 17 Phase-3 blocks of the committed capture left that
 * suite 12/12 GREEN, because the fields never survive to the store.
 *
 * ⚠ WIRE SHAPE — ATOMIC, AND THIS SUITE READS THE ATOMIC FORM ONLY.
 * Two DIFFERENT dsk field families exist in this estate and they must not be
 * conflated (both are present in the very capture used below):
 *   - FLAT siblings `dsk_claim_id` / `dsk_protocol_id` / `evidence_strength`
 *     — the `decision_quality_prompts` passthrough family (live today,
 *     rendered by KeyQuestionCard). NOT a schema-declared block field.
 *   - ATOMIC `dsk_claim_provenance` — the 0.39.0 CoachingBlock/ReviewCardBlock
 *     field this suite covers. The contract's own comment forbids flattening
 *     it ("ATOMIC STRICT TRIPLE, NEVER FLAT SIBLINGS", CEE #830: an id must
 *     never travel without the title and strength that make it verifiable
 *     against `data/dsk/v1.json`).
 * The guidance path is fed by coaching/review_card blocks, so the ATOMIC form
 * is the only shape a producer may legitimately send it. The store's
 * `GuidanceItem` keeps its existing FLAT view fields (merged in #633 with a
 * tested rule home, `deriveGuidanceDskProvenance`): the atomic object is
 * gated AS A UNIT at hop 1 and projected onto those view fields. `claim_title`
 * is consumed BY the gate as the verifiability anchor and deliberately not
 * stored — no surface renders it, and an unconsumed store field is dark work.
 *
 * EVIDENCE BASIS. Every wire value below is REAL: the fixture is the committed
 * verbatim staging capture `live-analysis-turn-T3-20260808T155759Z.json`, and
 * the injected claim/protocol/strength values are taken from that SAME
 * capture's attested `decision_quality_prompts` entries (DSK-T-002 /
 * DSK-P-002 / "strong"; DSK-T-003 / DSK-P-003 / "medium"). The injection is
 * exactly the delta CEE's attach (ROADMAP 2.964) will emit.
 *
 * ⚠ WHAT THIS SUITE DOES NOT PROVE. No live wire carries
 * `dsk_claim_provenance` today: 0 of 1,410 coaching + review_card blocks
 * across 357 golden-journey capture files (measured 2026-08-08). These carries
 * make the badge REACHABLE; they do not light it. That awaits the CEE attach.
 */
import { describe, it, expect } from 'vitest'
import { DskClaimProvenanceSchema } from '@talchain/schemas/boundary'
import { parseV5Response } from '../responseParser'
import { extractPhase3FromV5Response } from '../extractPhase3FromV5Response'
import { toStoreGuidanceItem } from '../../canvas/conversation/useConversation'
import {
  deriveGuidanceDskProvenance,
  type GuidanceItem,
} from '../../canvas/stores/guidanceStore'
import liveTurnBody from './fixtures/live-analysis-turn-T3-20260808T155759Z.json'

// ---------------------------------------------------------------------------
// Identity anchors — REAL block_ids from the committed capture.
// Assertions bind to THESE ids, never to a value predicate another block
// could satisfy (the extractor-deletion / wrong-object trap).
// ---------------------------------------------------------------------------

/** coaching — "Consider-the-opposite as a debiasing strategy" */
const TARGET_COACHING_ID = '8117f6f0-f2a7-5bae-91e8-d9341e585a5f'
/** coaching — "Outside view and reference class forecasting" (the OTHER item) */
const OTHER_COACHING_ID = '12a99bb7-c1d2-5bf5-beed-c18dc4a3f819'
/** review_card — "Highest-leverage evidence gap: User Adoption" */
const TARGET_REVIEW_CARD_ID = 'c371530d-5842-5447-aa7f-9fa204b6a910'

/** Verbatim from the capture's decision_quality_prompts[1]. */
const ATTESTED = {
  claim_id: 'DSK-T-002',
  claim_title: 'Consider the opposite',
  evidence_strength: 'strong',
  protocol_id: 'DSK-P-002',
} as const

/** Verbatim from the capture's decision_quality_prompts[0]; no protocol_id. */
const ATTESTED_NO_PROTOCOL = {
  claim_id: 'DSK-T-003',
  claim_title: 'Reference class forecasting',
  evidence_strength: 'medium',
} as const

type Json = Record<string, unknown>

function clone(): Json {
  return JSON.parse(JSON.stringify(liveTurnBody)) as Json
}

/**
 * Inject an atomic `dsk_claim_provenance` onto the block with `blockId`.
 *
 * ANTI-VACUITY: throws if the block is not found or if the write did not
 * land. An earlier lane tonight had a set-up silently no-op while its check
 * printed "PROVEN" — a fixture that did not actually change makes every
 * downstream assertion vacuous.
 */
function inject(body: Json, blockId: string, provenance: unknown): Json {
  const blocks = body.blocks as Json[] | undefined
  if (!Array.isArray(blocks)) throw new Error('fixture has no blocks[] array')
  const block = blocks.find((b) => b && (b as Json).block_id === blockId)
  if (!block) throw new Error(`fixture has no block with block_id ${blockId}`)
  block.dsk_claim_provenance = provenance
  const readBack = (blocks.find((b) => (b as Json).block_id === blockId) as Json)
    .dsk_claim_provenance
  if (readBack === undefined) {
    throw new Error(`injection did not land on ${blockId}`)
  }
  return body
}

/** Drive a body through the REAL exported ingestion chain (useConversation:4655). */
async function ingest(body: Json): Promise<GuidanceItem[]> {
  const res = new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  const parsed = await parseV5Response(res)
  if (parsed.kind !== 'response') {
    throw new Error(`capture failed to parse: ${parsed.kind}`)
  }
  const phase3 = extractPhase3FromV5Response(parsed.response)
  return phase3.guidanceItems.map(toStoreGuidanceItem)
}

function itemById(items: GuidanceItem[], id: string): GuidanceItem {
  const found = items.find((i) => i.item_id === id)
  if (!found) {
    throw new Error(
      `no guidance item with item_id ${id} (got: ${items.map((i) => i.item_id).join(', ')})`,
    )
  }
  return found
}

// ---------------------------------------------------------------------------
// Suite 0 — the fixture and the contract are what this suite thinks they are
// ---------------------------------------------------------------------------

describe('DSK claim provenance carry — preconditions', () => {
  it('the injected values satisfy the 0.39.0 atomic contract (the oracle is the producer schema, not this test)', () => {
    expect(DskClaimProvenanceSchema.safeParse(ATTESTED).success).toBe(true)
    expect(DskClaimProvenanceSchema.safeParse(ATTESTED_NO_PROTOCOL).success).toBe(true)
  })

  it('the UNMODIFIED capture carries no dsk_claim_provenance on any block (the injection is a real delta, not a no-op)', () => {
    expect(JSON.stringify(liveTurnBody)).not.toContain('dsk_claim_provenance')
  })

  it('injection lands on the named block and is byte-identical to what was written', () => {
    const body = inject(clone(), TARGET_COACHING_ID, ATTESTED)
    const blocks = body.blocks as Json[]
    const block = blocks.find((b) => (b as Json).block_id === TARGET_COACHING_ID) as Json
    expect(block.dsk_claim_provenance).toEqual(ATTESTED)
  })
})

// ---------------------------------------------------------------------------
// Suite 1 — the carry, identity-bound, through BOTH hops
// ---------------------------------------------------------------------------

describe('DSK claim provenance carry — both hops', () => {
  it('carries the attested triple from a COACHING block to the store item of THAT id', async () => {
    const items = await ingest(inject(clone(), TARGET_COACHING_ID, ATTESTED))
    const item = itemById(items, TARGET_COACHING_ID)
    expect(item.dsk_claim_id).toBe(ATTESTED.claim_id)
    expect(item.dsk_protocol_id).toBe(ATTESTED.protocol_id)
    expect(item.evidence_strength).toBe(ATTESTED.evidence_strength)
  })

  it('carries the attested triple from a REVIEW_CARD block (the contract\'s other carrying block)', async () => {
    const items = await ingest(inject(clone(), TARGET_REVIEW_CARD_ID, ATTESTED))
    const item = itemById(items, TARGET_REVIEW_CARD_ID)
    expect(item.dsk_claim_id).toBe(ATTESTED.claim_id)
    expect(item.evidence_strength).toBe(ATTESTED.evidence_strength)
  })

  it('carries ONLY to the attested item — siblings in the same turn stay absent', async () => {
    const items = await ingest(inject(clone(), TARGET_COACHING_ID, ATTESTED))
    const other = itemById(items, OTHER_COACHING_ID)
    expect(other.dsk_claim_id).toBeUndefined()
    expect(other.dsk_protocol_id).toBeUndefined()
    expect(other.evidence_strength).toBeUndefined()
  })

  it('omits protocol_id when the producer sent none — absent stays absent, never defaulted', async () => {
    const items = await ingest(inject(clone(), TARGET_COACHING_ID, ATTESTED_NO_PROTOCOL))
    const item = itemById(items, TARGET_COACHING_ID)
    expect(item.dsk_claim_id).toBe(ATTESTED_NO_PROTOCOL.claim_id)
    expect(item.evidence_strength).toBe(ATTESTED_NO_PROTOCOL.evidence_strength)
    expect(item.dsk_protocol_id).toBeUndefined()
    expect('dsk_protocol_id' in item).toBe(false)
  })

  it('reaches the badge view model through the store\'s own rule home', async () => {
    const items = await ingest(inject(clone(), TARGET_COACHING_ID, ATTESTED))
    const provenance = deriveGuidanceDskProvenance(itemById(items, TARGET_COACHING_ID))
    expect(provenance).toEqual({
      claimId: ATTESTED.claim_id,
      protocolId: ATTESTED.protocol_id,
      strength: ATTESTED.evidence_strength,
    })
    // The sibling must remain badge-less: absence is the honest default.
    expect(deriveGuidanceDskProvenance(itemById(items, OTHER_COACHING_ID))).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Suite 2 — fail closed. The gate is the CONTRACT, applied as a UNIT.
// ---------------------------------------------------------------------------

describe('DSK claim provenance carry — fails closed on anything the contract rejects', () => {
  const rejected: Array<[string, unknown]> = [
    ['claim id alone (the exact shape the atomic doctrine exists to forbid)', { claim_id: 'DSK-T-002' }],
    ['missing claim_title (no verifiability anchor)', { claim_id: 'DSK-T-002', evidence_strength: 'strong' }],
    ['missing evidence_strength', { claim_id: 'DSK-T-002', claim_title: 'Consider the opposite' }],
    ['evidence_strength outside the closed vocabulary', { ...ATTESTED, evidence_strength: 'very strong' }],
    ['a PROTOCOL id masquerading as a claim id', { ...ATTESTED, claim_id: 'DSK-P-002' }],
    ['a TRIGGER id masquerading as a claim id', { ...ATTESTED, claim_id: 'DSK-TR-002' }],
    ['empty claim_id', { ...ATTESTED, claim_id: '' }],
    ['non-object provenance', 'DSK-T-002'],
    ['null provenance', null],
    ['FLAT siblings instead of the atomic object', {
      dsk_claim_id: 'DSK-T-002',
      dsk_protocol_id: 'DSK-P-002',
      evidence_strength: 'strong',
    }],
  ]

  for (const [label, provenance] of rejected) {
    it(`carries NOTHING when the producer sends ${label}`, async () => {
      const items = await ingest(inject(clone(), TARGET_COACHING_ID, provenance))
      const item = itemById(items, TARGET_COACHING_ID)
      expect(item.dsk_claim_id).toBeUndefined()
      expect(item.dsk_protocol_id).toBeUndefined()
      expect(item.evidence_strength).toBeUndefined()
      expect(deriveGuidanceDskProvenance(item)).toBeUndefined()
    })
  }

  it('the flat-sibling case is rejected BY THE CONTRACT, not merely unread (pins why the atomic read is correct)', () => {
    expect(
      DskClaimProvenanceSchema.safeParse({
        dsk_claim_id: 'DSK-T-002',
        dsk_protocol_id: 'DSK-P-002',
        evidence_strength: 'strong',
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Suite 3 — emit honesty. MUST-NOT-CHANGE: today's real wire lights nothing.
// ---------------------------------------------------------------------------

describe('DSK claim provenance carry — emit honesty (real capture, unmodified)', () => {
  it('the untouched capture yields guidance items and NONE carries provenance', async () => {
    const items = await ingest(clone())
    // Guard against a silently-empty ingestion: a vacuous loop proves nothing.
    expect(items.length).toBeGreaterThanOrEqual(6)
    for (const item of items) {
      expect(
        item.dsk_claim_id,
        `item ${item.item_id} unexpectedly carries dsk_claim_id`,
      ).toBeUndefined()
      expect(deriveGuidanceDskProvenance(item)).toBeUndefined()
    }
  })
})
