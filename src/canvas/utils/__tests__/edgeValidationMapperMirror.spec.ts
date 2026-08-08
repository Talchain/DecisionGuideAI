/**
 * ROADMAP 2.146 — `edge.validation` survives ALL THREE canvas ingestion hops.
 *
 * The contested-edge render surface in `StyledEdge` has existed and been tested
 * since Brief 5.7, reading `edge.data.validation`. Nothing on the DRAFT path ever
 * populated that key: `mapDraftEdgeToCanvas` extracts wire edge fields by a
 * hand-maintained list ("no blind spread") and `validation` was not on it. So the
 * styling was real, its tests were real, and the field they styled never arrived.
 *
 * There are three hops, and they fail differently — a test covering one says
 * nothing about the others:
 *
 *   1. `mapDraftEdgeToCanvas`  (applyDraftResult.ts) — full draft ingestion.
 *   2. `buildEdge`             (conversation/utils/applyPatch.ts) — a HAND-MIRRORED
 *      COPY of hop 1, used on `edit_graph` receipts. A field added only to hop 1
 *      is present after a draft and VANISHES on the next patch touching the edge.
 *      That is the drift this suite exists to catch, and it is the failure mode
 *      nobody notices, because it needs two turns to appear.
 *   3. `overlayEdge`           (mergeAppliedGraph.ts) — DERIVED from hop 1, so it
 *      follows automatically. But its baseline filter deliberately UNDER-applies:
 *      a mapped value equal to the mapper default counts as "the wire did not send
 *      this". That makes "`validation` has NO entry in DEFAULT_EDGE_DATA" a
 *      load-bearing property rather than an omission, and it is pinned here.
 *
 * Every absence assertion below is paired with the presence it denies (trap 13).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import { resolveEdgeDirectionDisplay } from '../../domain/edgeValueProvenance'

// ── The wire shape CEE's validation pipeline emits (abridged to the fields the
//    UI's render surface and card actually read). Not a re-declaration of the
//    contract: this suite asserts the object arrives INTACT, by identity of
//    content, so it never needs to know the full field list.
const WIRE_VALIDATION = {
  status: 'contested',
  contested_reasons: ['strength_band_change'],
  pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.8 },
  pass2: {
    strength_mean: 0.7,
    strength_std: 0.15,
    exists_probability: 0.9,
    reasoning: 'The brief implies a weaker link than the draft assumed.',
    basis: 'brief_explicit',
    needs_user_input: false,
  },
  max_divergence: 0.4,
  distance_to_goal: 1,
  evoi_rank: null,
  evoi_impact: null,
  was_shown: false,
  user_action: 'pending',
  resolved_value: null,
  resolved_by: 'default',
} as const

/** A V3 causal edge as CEE puts it on the wire, with validation attached. */
const WIRE_EDGE = {
  from: 'factor-1',
  to: 'goal-1',
  strength: { mean: 0.3, std: 0.1 },
  exists_probability: 0.8,
  effect_direction: 'positive',
  edge_type: 'directed',
  validation: WIRE_VALIDATION,
}

describe('edge.validation — hop 1: mapDraftEdgeToCanvas (draft ingestion)', () => {
  it('carries validation through to edge data, intact', () => {
    const mapped = mapDraftEdgeToCanvas({ ...WIRE_EDGE }, 0)
    expect(mapped.data.validation).toEqual(WIRE_VALIDATION)
  })

  it('omits the key entirely when the wire carries no validation', () => {
    // POSITIVE CONTROL for the assertion below: the same mapper DOES produce the
    // key when the wire supplies it (previous test), so `not.toHaveProperty`
    // here is measuring absence rather than measuring nothing.
    const mapped = mapDraftEdgeToCanvas({ from: 'a', to: 'b', weight: 0.5 }, 0)
    expect(mapped.data).not.toHaveProperty('validation')
  })

  it('omits the key for an explicit null (a cleared field is not a value)', () => {
    const mapped = mapDraftEdgeToCanvas({ from: 'a', to: 'b', validation: null }, 0)
    expect(mapped.data).not.toHaveProperty('validation')
  })

  it('DEFAULT_EDGE_DATA carries no validation default — hop 3 depends on this', () => {
    // Not cosmetic. `overlayEdge` treats a mapped value equal to the mapper
    // baseline as unsupplied; a non-undefined default here would silently stop
    // validation metadata from ever overlaying onto an existing edge.
    expect(DEFAULT_EDGE_DATA).not.toHaveProperty('validation')
    const baseline = mapDraftEdgeToCanvas({ from: 'x', to: 'y' }, 0)
    expect(baseline.data).not.toHaveProperty('validation')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Hop 2 — the hand-mirrored patch builder. Needs the canvas store, so it is
// driven through the public `applyAutoApplyPatch` entry point.
// ─────────────────────────────────────────────────────────────────────────────

let storeNodes: any[] = []
let storeEdges: any[] = []

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn(), {
    getState: () => ({
      nodes: storeNodes,
      edges: storeEdges,
      outcomeNodeId: null,
      ceeAnalysisReady: null,
      applyLayout: vi.fn(() => Promise.resolve()),
      setPendingLayout: vi.fn(),
      setOutcomeNode: vi.fn(),
      currentScenarioId: null,
    }),
    setState: vi.fn((update: any) => {
      if (update.nodes) storeNodes = update.nodes
      if (update.edges) storeEdges = update.edges
    }),
  }),
}))

vi.mock('../../store/scenarios', () => ({
  saveAutosave: vi.fn(),
}))

const { applyAutoApplyPatch } = await import('../../conversation/utils/applyPatch')

function seedPatchStore() {
  storeNodes = [
    { id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Spend' } },
    { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
  ]
  storeEdges = []
}

function addEdgePatch(data: Record<string, unknown>) {
  return {
    block_type: 'graph_patch' as const,
    auto_apply: true,
    operations: [{ op: 'add_edge' as const, target_id: 'e1', data }],
  }
}

describe('edge.validation — hop 2: applyPatch buildEdge (edit_graph receipt)', () => {
  beforeEach(() => {
    seedPatchStore()
  })

  it('carries validation through an add_edge receipt, intact', () => {
    applyAutoApplyPatch(addEdgePatch({ ...WIRE_EDGE }) as any)
    expect(storeEdges).toHaveLength(1)
    expect(storeEdges[0].data.validation).toEqual(WIRE_VALIDATION)
  })

  it('omits the key when the receipt carries no validation', () => {
    applyAutoApplyPatch(addEdgePatch({ from: 'factor-1', to: 'goal-1', weight: 0.5 }) as any)
    expect(storeEdges[0].data).not.toHaveProperty('validation')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE MIRROR-DRIFT CATCHER
// ─────────────────────────────────────────────────────────────────────────────

describe('edge.validation — the two hand-mirrored mappers stay in lockstep', () => {
  beforeEach(() => {
    seedPatchStore()
  })

  it('a full draft and a patch receipt of the SAME wire edge agree on validation', () => {
    // THE PIN. Adding `validation` to one extraction list and not the other is
    // invisible in every single-hop test, in typecheck, and in review — the field
    // simply disappears one turn later. This is the assertion that notices.
    //
    // Deliberately compared through the two PUBLIC entry points rather than by
    // reading the source: a comparison of two hand-written field lists would
    // itself be a third mirror.
    const drafted = mapDraftEdgeToCanvas({ ...WIRE_EDGE }, 0)
    applyAutoApplyPatch(addEdgePatch({ ...WIRE_EDGE }) as any)
    const patched = storeEdges[0]

    expect(drafted.data.validation).toEqual(WIRE_VALIDATION)
    expect(patched.data.validation).toEqual(WIRE_VALIDATION)
    expect(patched.data.validation).toEqual(drafted.data.validation)
  })

  it('both hops agree on ABSENCE too (neither invents a default)', () => {
    const bare = { from: 'factor-1', to: 'goal-1', weight: 0.5 }
    const drafted = mapDraftEdgeToCanvas({ ...bare }, 0)
    applyAutoApplyPatch(addEdgePatch({ ...bare }) as any)

    expect('validation' in drafted.data).toBe(false)
    expect('validation' in storeEdges[0].data).toBe(false)
    // Same answer from both hops — a default appearing in one and not the other
    // would be the same drift in the opposite direction.
    expect('validation' in drafted.data).toBe('validation' in storeEdges[0].data)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A-3b — WHOLE-`data` PARITY, NOT ONE FIELD'S PARITY
//
// Everything above pins `validation`, because `validation` was the field that
// went missing. That is one field of a bag the two mappers claim to build
// identically, so the suite would have been just as green if the NEXT field had
// been added to one hop only — which is the same defect, one field along, and the
// reason this section exists.
//
// ⚠ THIS ASSERTION FOUND TWO REAL DIVERGENCES ON ITS FIRST RUN, AND BOTH WERE
// DEFECTS. `strengthStdSource` (hop 2 omitted `strengthStd` from
// `edgeValueSourcePatch`, so a receipt wrote a provenanced VALUE with no stamp)
// and `provenanceDisplay` (hop 2 never applied `edgeProvenanceDisplayPatch`, so
// the field was dropped outright). Both were adjudicated at the bytes and FIXED in
// the same change — see the two describes at the bottom of this file for the
// evidence, the RED-first pins, and why the receipt is not structurally incapable
// of carrying `provenance_display`.
//
// The two hops now build a BYTE-IDENTICAL `data` bag for the full wire edge, so
// the difference set below is EMPTY, and that is the assertion — not a
// disclosure of tolerated gaps.
//
// ⚠ IT FAILS LOUD IN BOTH DIRECTIONS (CLAUDE.md trap 12): a NEW divergence reds
// because it is not in the set, and a STALE entry reds because the set would then
// over-state. Do NOT add an entry to make a red go away — a new entry means a
// mapper drifted, and the honest move is to fix the hop or to record, in the
// entry's reason string, the derived evidence that the difference is structural.
// (That second arm has already earned its keep: it caught this very file's first
// draft recording `provenanceDisplay` as differing while its fixture used a
// provenance value outside the closed vocabulary, so neither hop emitted the key
// and the "divergence" was an artefact of the fixture.)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Keys the two hops are KNOWN to disagree on, with the reason each is here.
 *
 * EMPTY, and meant to stay empty. An entry is a defect awaiting its own change or
 * a structural difference with derived evidence in its reason string — never a
 * sanctioned exception, and never a way to quiet this test.
 */
const KNOWN_HOP_DIVERGENCES: ReadonlyArray<readonly [string, string]> = []

/** The full wire edge, with every field either mapper reads. */
const WIRE_EDGE_FULL = {
  from: 'factor-1',
  to: 'goal-1',
  strength: { mean: 0.42, std: 0.11 },
  exists_probability: 0.77,
  belief: 0.66,
  belief_exists: 0.55,
  effect_direction: 'negative',
  edge_type: 'directed',
  provenance_source: 'cee_draft',
  // Must be one of `PROVENANCE_VALUES` (`from_brief` / `ai_inferred` /
  // `user_set`) or `edgeProvenanceDisplayPatch` emits nothing and hop 1 agrees
  // with hop 2 by both producing no key — a fixture that would make divergence
  // #2 look already-fixed. The stale-disclosure arm below caught exactly that on
  // this test's first run, which is the arm earning its place.
  provenance_display: 'ai_inferred',
  validation: WIRE_VALIDATION,
}

describe('edge data — the two hand-mirrored mappers build the SAME bag', () => {
  beforeEach(() => {
    seedPatchStore()
  })

  it('every key of the rebuilt data bag agrees, except the recorded divergences', () => {
    const drafted = mapDraftEdgeToCanvas({ ...WIRE_EDGE_FULL }, 0)
    applyAutoApplyPatch(addEdgePatch({ ...WIRE_EDGE_FULL }) as any)
    const patched = storeEdges[0]

    // POSITIVE CONTROL for the comparison itself (trap 13): a bag with nothing in
    // it, or a comparison over an empty key set, would make every assertion below
    // vacuous. The live payload above must actually populate the bag.
    const keys = new Set([...Object.keys(drafted.data), ...Object.keys(patched.data)])
    expect(keys.size).toBeGreaterThan(10)
    expect(keys.has('validation')).toBe(true)

    const known = new Set(KNOWN_HOP_DIVERGENCES.map(([k]) => k))
    const differing = [...keys]
      .filter((k) => JSON.stringify(drafted.data[k]) !== JSON.stringify(patched.data[k]))
      .sort()

    // No UNDISCLOSED divergence.
    expect(differing.filter((k) => !known.has(k))).toEqual([])

    // …and no STALE disclosure: every recorded divergence must still be real. A
    // fix that closes one has to shrink this list in the same change, so the
    // record can never outlive the defect it describes.
    const stale = KNOWN_HOP_DIVERGENCES.filter(([k]) => !differing.includes(k)).map(
      ([k, why]) => `${k} (recorded as: ${why}) no longer differs — delete this entry`,
    )
    expect(stale).toEqual([])
  })

  it('the recorded divergences are exactly the ones listed', () => {
    // Pinned separately so the SIZE of the exception set is itself visible in a
    // diff. Growing it is a decision someone has to make on purpose. It is EMPTY:
    // both divergences this assertion originally recorded were adjudicated as
    // defects and fixed in the same change — see the two describes below.
    expect(KNOWN_HOP_DIVERGENCES.map(([k]) => k)).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// `effect_direction: 'unknown'` — THE SHARED-DROP SEMANTICS, PINNED (ROADMAP
// 2.950 ride-along; the corpus above carried only `'negative'`).
//
// `'unknown'` is a DECLARED @talchain/schemas 0.30.0 contract member — the
// producer explicitly declining to state a direction. Both mappers treat it
// identically to an OMITTED direction, by construction: their extraction
// accepts only `'positive' | 'negative'`, neither blind-spreads the wire, so
// the raw `effect_direction` key does not survive into `data` at all, the
// stored `direction` is the sign-of-mean fallback, and NO `directionSource` is
// stamped — which is what routes `resolveEdgeDirectionDisplay` to `not_set`.
// (`reason: 'unknown'` is reachable only where the raw spelling survives:
// `v5/applyV5State.ts:660`'s verbatim merge and persisted graphs — see the
// scope note in domain/edgeValueProvenance.ts.)
//
// Pinning this here matters because the two hops could drift APART on it in
// either direction — one starting to stamp `'unknown'` as a stated direction
// (a fabrication), or one starting to preserve the raw key while the other
// drops it (a divergence invisible to every single-hop test).
// ═══════════════════════════════════════════════════════════════════════════

describe("edge data — the two mappers agree on effect_direction: 'unknown' (shared drop)", () => {
  const WIRE_EDGE_UNKNOWN_DIR = { ...WIRE_EDGE_FULL, effect_direction: 'unknown' }

  beforeEach(() => {
    seedPatchStore()
  })

  it('both hops build the SAME bag for an unknown-direction edge', () => {
    const drafted = mapDraftEdgeToCanvas({ ...WIRE_EDGE_UNKNOWN_DIR }, 0)
    applyAutoApplyPatch(addEdgePatch({ ...WIRE_EDGE_UNKNOWN_DIR }) as any)
    const patched = storeEdges[0]

    const keys = new Set([...Object.keys(drafted.data), ...Object.keys(patched.data)])
    expect(keys.size).toBeGreaterThan(10)

    const differing = [...keys]
      .filter((k) => JSON.stringify(drafted.data[k]) !== JSON.stringify(patched.data[k]))
      .sort()
    expect(differing).toEqual([])
  })

  it("neither hop stores the raw 'unknown', stamps a source, or fabricates a STATED direction", () => {
    // POSITIVE CONTROL (trap 13) for every absence below: the SAME wire edge
    // with a stated direction produces the key's stamped counterpart, so these
    // assertions measure a real drop rather than measuring nothing.
    const statedControl = mapDraftEdgeToCanvas({ ...WIRE_EDGE_FULL }, 0)
    expect(statedControl.data.directionSource).toBe('cee')
    expect(WIRE_EDGE_UNKNOWN_DIR.effect_direction).toBe('unknown')

    const drafted = mapDraftEdgeToCanvas({ ...WIRE_EDGE_UNKNOWN_DIR }, 0)
    applyAutoApplyPatch(addEdgePatch({ ...WIRE_EDGE_UNKNOWN_DIR }) as any)
    const patched = storeEdges[0]

    for (const [hop, data] of [['draft', drafted.data], ['patch', patched.data]] as const) {
      // The raw spelling is dropped — the explicit-refusal arm of the resolver
      // is unreachable on these paths, by construction.
      expect(data, `${hop}: effect_direction`).not.toHaveProperty('effect_direction')
      // The stored direction is the sign-of-mean FALLBACK (mean 0.42 → positive),
      // unstamped…
      expect(data.direction, `${hop}: direction`).toBe('positive')
      expect(data, `${hop}: directionSource`).not.toHaveProperty('directionSource')
      // …so the one owner refuses to state it, with the shared-drop verdict.
      expect(
        resolveEdgeDirectionDisplay(data as Record<string, unknown>),
        `${hop}: resolver verdict`,
      ).toEqual({ show: false, reason: 'not_set' })
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE TWO DIVERGENCES THE PARITY ASSERTION FOUND, ADJUDICATED AND FIXED
//
// Both were real field loss on the `edit_graph` receipt path, and both are the
// 2.154 class: a producer value the UI paid for and then dropped at an ingestion
// boundary, silently, with the whole suite green.
//
// ⚠ ADJUDICATION EVIDENCE FOR `provenanceDisplay` — the question was whether the
// receipt can even CARRY the field, because if it structurally could not, hop 2
// omitting the patch would be correct rather than a defect. Derived at the bytes,
// not assumed:
//   · `provenance_display` appears NOWHERE in `@talchain/schemas` 0.30.0 (the
//     pinned vendored tarball) — zero matches across the whole package. So the
//     contract neither declares nor forbids it.
//   · `DraftGraphBlockSchema.edges` is `z.array(z.unknown())` (boundary/blocks
//     :209) — the DRAFT edge hop 1 reads it from is itself untyped by the
//     contract, so the field's only declaration is the UI's own
//     `adapters/cee/types.ts:74` / `:135`.
//   · the receipt's carrier, `PatchOperation.data`, is
//     `Record<string, unknown>` (`canvas/conversation/types.ts:464`) — fully OPEN.
// So the receipt is NOT structurally incapable of carrying it. Both hops read an
// open bag; only one of them looked. → DEFECT, fixed.
// ═══════════════════════════════════════════════════════════════════════════

describe('divergence 1 — strengthStdSource is stamped on a receipt, not just a draft', () => {
  beforeEach(() => {
    seedPatchStore()
  })

  it('an add_edge receipt carrying strength.std stamps strengthStdSource', () => {
    // `strengthStd` is one of the three `EDGE_PROVENANCED_FIELDS`
    // (domain/edgeValueProvenance.ts:75). Hop 2 wrote the VALUE while omitting the
    // stamp, so every display surface that reads the stamp treated a real CEE
    // estimate as never set — the exact inverse of the laundering
    // `edgeProvenanceLaundering.sourceScan.spec.ts` guards.
    applyAutoApplyPatch(
      addEdgePatch({ from: 'factor-1', to: 'goal-1', strength: { mean: 0.42, std: 0.11 } }) as any,
    )
    const data = storeEdges[0].data
    expect(data.strengthStd).toBeCloseTo(0.11)
    expect(data.strengthStdSource).toBe('cee')
  })

  it('a receipt WITHOUT strength.std stamps nothing (the absence arm)', () => {
    // POSITIVE CONTROL for this absence is the test above: the same path DOES
    // stamp when the receipt supplies the value, so this measures a real absence
    // rather than measuring nothing. An unconditional stamp would be the opposite
    // defect — claiming a producer estimate that was never sent.
    applyAutoApplyPatch(addEdgePatch({ from: 'factor-1', to: 'goal-1', weight: 0.5 }) as any)
    const data = storeEdges[0].data
    expect(data).not.toHaveProperty('strengthStd')
    expect(data).not.toHaveProperty('strengthStdSource')
  })

  it('the draft hop already did this — the two now agree', () => {
    const drafted = mapDraftEdgeToCanvas(
      { from: 'factor-1', to: 'goal-1', strength: { mean: 0.42, std: 0.11 } },
      0,
    )
    applyAutoApplyPatch(
      addEdgePatch({ from: 'factor-1', to: 'goal-1', strength: { mean: 0.42, std: 0.11 } }) as any,
    )
    expect(drafted.data.strengthStdSource).toBe('cee')
    expect(storeEdges[0].data.strengthStdSource).toBe(drafted.data.strengthStdSource)
  })
})

describe('divergence 2 — provenanceDisplay survives a receipt, not just a draft', () => {
  beforeEach(() => {
    seedPatchStore()
  })

  it('an add_edge receipt carrying provenance_display maps it to provenanceDisplay', () => {
    applyAutoApplyPatch(
      addEdgePatch({ from: 'factor-1', to: 'goal-1', provenance_display: 'ai_inferred' }) as any,
    )
    expect(storeEdges[0].data.provenanceDisplay).toBe('ai_inferred')
  })

  it('an UNRECOGNISED provenance value is not mapped (the closed vocabulary holds)', () => {
    // `edgeProvenanceDisplayPatch` admits only `from_brief` / `ai_inferred` /
    // `user_set`. Sharing hop 1's helper means sharing that gate, which is the
    // point of reusing it rather than writing a second read.
    applyAutoApplyPatch(
      addEdgePatch({ from: 'factor-1', to: 'goal-1', provenance_display: 'made_up' }) as any,
    )
    expect(storeEdges[0].data).not.toHaveProperty('provenanceDisplay')
  })

  it('a receipt carrying no provenance_display gains no key (the absence arm)', () => {
    applyAutoApplyPatch(addEdgePatch({ from: 'factor-1', to: 'goal-1', weight: 0.5 }) as any)
    expect(storeEdges[0].data).not.toHaveProperty('provenanceDisplay')
  })

  it('the draft hop already did this — the two now agree', () => {
    const drafted = mapDraftEdgeToCanvas(
      { from: 'factor-1', to: 'goal-1', provenance_display: 'ai_inferred' },
      0,
    )
    applyAutoApplyPatch(
      addEdgePatch({ from: 'factor-1', to: 'goal-1', provenance_display: 'ai_inferred' }) as any,
    )
    expect(drafted.data.provenanceDisplay).toBe('ai_inferred')
    expect(storeEdges[0].data.provenanceDisplay).toBe(drafted.data.provenanceDisplay)
  })
})
