/**
 * HALF (b) — THE HAND-WRITTEN CORPUS OF REAL PAYLOADS.
 *
 * ⚠ WHY THIS FILE EXISTS AND THE DERIVATION SPEC DOES NOT REPLACE IT.
 * Derivation proves the pairs AGREE with the contract; it is structurally blind
 * to a pair the set OMITS, exactly as a guard derived from a canonical map
 * stays green when a key is deleted from the map. Only a corpus assembled from
 * OUTSIDE this lane's head can notice a short list. Every payload below was
 * recorded off the DEPLOYED product by a witness lane, and is copied here
 * BYTE-IDENTICAL — the sha256 of each copy against its source is in
 * `PROVENANCE.md`.
 *
 * ⚠ THE CORPUS IS APPEND-ONLY. A capture is a record of what the product ONCE
 * EMITTED. Editing one to keep a suite green falsifies evidence and leaves the
 * suite agreeing with a history that never happened. Add captures; never edit
 * them. If a capture must change, that is a finding to report, not an edit.
 *
 * ⚠ THE MANIFEST IS ASSERTED EXACTLY. It REDs if the violation set GROWS (a new
 * contradiction reached the corpus, or a detector widened) and if it SHRINKS (a
 * detector narrowed, or a pair was quietly weakened to make a capture pass).
 * A gap recorded in the suite is honest; a gap invisible to it is how a defect
 * ships four times.
 */

import { describe, it, expect } from 'vitest'

import { adaptCapture } from '../captureAdapter'
import {
  COHERENCE_PAIR_IDS,
  KNOWN_READINESS_STATUSES,
  evaluateCrossSurfaceCoherence,
  violatedPairs,
  type CoherencePairId,
} from '../crossSurfaceCoherence'

import j4t2 from './fixtures/captures/acceptance-2026-08-17-j4-t2.json'
import j4t4 from './fixtures/captures/acceptance-2026-08-17-j4-t4.json'
import j4t5 from './fixtures/captures/acceptance-2026-08-17-j4-t5.json'
import j1r1t1 from './fixtures/captures/acceptance-2026-08-17-j1r1-t1.json'
import w2d from './fixtures/captures/seeded-2026-08-17-w2d-analysis-turn.json'
import probeA from './fixtures/captures/conditional-winners-2026-08-17-probe-A.json'
import a1turn3 from './fixtures/captures/w998-2026-08-16-a1-turn3.json'
import a1turn2 from './fixtures/captures/w998-2026-08-16-a1-turn2.json'

interface CorpusEntry {
  readonly name: string
  readonly source: string
  readonly raw: unknown
  /** EXACT set of pairs this capture violates, in id order. */
  readonly violates: readonly CoherencePairId[]
}

/**
 * THE CORPUS. Eight real payloads spanning four witness batteries, chosen so
 * every pair with a real instance has one AND its opposite-direction twin is
 * also real wherever the product produced one.
 */
const CORPUS: readonly CorpusEntry[] = [
  {
    name: 'J4 turn 2 — the value-confirmation reply',
    source: 'olumi-docs/witness-acceptance-2026-08-17/captures/j4-t2-event-final.json',
    raw: j4t2,
    violates: ['CX1', 'CX6'],
  },
  {
    name: 'J4 turn 4 — the same factor described as UNSET (CX6 opposite-direction twin)',
    source: 'olumi-docs/witness-acceptance-2026-08-17/captures/j4-t4-event-final.json',
    raw: j4t4,
    violates: ['CX1'],
  },
  {
    name: 'J4 turn 5 — same blockers, run gone stale (CX1 opposite-direction twin)',
    source: 'olumi-docs/witness-acceptance-2026-08-17/captures/j4-t5-event-final.json',
    raw: j4t5,
    violates: [],
  },
  {
    name: 'J1R1 turn 1 — pre-run, never_run with nothing usable',
    source: 'olumi-docs/witness-acceptance-2026-08-17/captures/j1r1-t1-event3.json',
    raw: j1r1t1,
    violates: [],
  },
  {
    name: 'Seeded W2 run w2d — the conditional-winners analysis turn',
    source: 'olumi-docs/witness-seeded-2026-08-17/captures/W2-wire-analysis-turn-run-w2d.json',
    raw: w2d,
    violates: ['CX4', 'CX5'],
  },
  {
    name: 'Conditional-winners probe A — PLoT /v2/run, both blocks AGREE (CX5 twin)',
    source: 'olumi-docs/witness-conditional-winners-2026-08-17/captures/probe-A-response-2026-08-17T103146Z.json',
    raw: probeA,
    violates: [],
  },
  {
    name: 'witness-998 A1 turn 3 — a fully coherent completed analysis',
    source: 'olumi-docs/witness-998-2026-08-16/a1-turn3-response.json',
    raw: a1turn3,
    violates: [],
  },
  {
    name: 'witness-998 A1 turn 2 — a coherent never_run',
    source: 'olumi-docs/witness-998-2026-08-16/a1-turn2-response.json',
    raw: a1turn2,
    violates: [],
  },
]

describe('the corpus is a corpus, not a shape this lane imagined', () => {
  it('collects the expected number of real captures BY NAME', () => {
    expect(CORPUS).toHaveLength(8)
    expect(CORPUS.map(c => c.source).every(s => s.startsWith('olumi-docs/witness-'))).toBe(true)
  })

  it('every capture that carries analysis_state PARSES under the vendored contract — invalid is a different fact from absent', () => {
    const invalid = CORPUS
      .map(c => ({ name: c.name, ...adaptCapture(c.raw) }))
      .filter(a => a.analysisStateStatus === 'invalid')
    expect(invalid.map(i => `${i.name}: ${i.analysisStateError}`)).toEqual([])
  })

  it('POSITIVE CONTROL — the corpus is not silently empty of analysis_state', () => {
    const present = CORPUS.filter(c => adaptCapture(c.raw).analysisStateStatus === 'present')
    // Seven of eight; the PLoT probe is the one payload with no turn envelope.
    expect(present).toHaveLength(7)
  })

  it('POSITIVE CONTROL — the corpus is not silently empty of enrichment either', () => {
    const withEnrichment = CORPUS.filter(c => {
      const e = adaptCapture(c.raw).input.enrichment
      return (e?.flip_thresholds?.length ?? 0) > 0 || (e?.conditional_winners?.length ?? 0) > 0
    })
    expect(withEnrichment.map(c => c.name).sort()).toEqual([
      'Conditional-winners probe A — PLoT /v2/run, both blocks AGREE (CX5 twin)',
      'Seeded W2 run w2d — the conditional-winners analysis turn',
      'witness-998 A1 turn 3 — a fully coherent completed analysis',
    ])
  })

  it('every readiness status in the corpus is a member of the recorded producer vocabulary — drift fails loud here', () => {
    const seen = new Set<string>()
    for (const c of CORPUS) {
      const s = adaptCapture(c.raw).input.analysisState?.readiness?.status
      if (typeof s === 'string') seen.add(s)
    }
    expect([...seen].filter(s => !KNOWN_READINESS_STATUSES.includes(s))).toEqual([])
    // Contrast control: the sweep is not reading an empty set.
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('⭐ THE MANIFEST — which pairs real captures VIOLATE today', () => {
  it.each(CORPUS.map(c => [c.name, c] as const))('%s', (_name, entry) => {
    const { input } = adaptCapture(entry.raw)
    expect(violatedPairs(evaluateCrossSurfaceCoherence(input))).toEqual([...entry.violates])
  })

  it('the manifest ROLLS UP to exactly this set — it REDs if it grows OR shrinks', () => {
    const rollup: Record<CoherencePairId, string[]> = {
      CX1: [], CX2: [], CX3: [], CX4: [], CX5: [], CX6: [],
    }
    for (const entry of CORPUS) {
      for (const pair of violatedPairs(evaluateCrossSurfaceCoherence(adaptCapture(entry.raw).input))) {
        rollup[pair].push(entry.source)
      }
    }
    expect(rollup).toEqual({
      CX1: [
        'olumi-docs/witness-acceptance-2026-08-17/captures/j4-t2-event-final.json',
        'olumi-docs/witness-acceptance-2026-08-17/captures/j4-t4-event-final.json',
      ],
      // ⚠ NOT "does not happen". No `refused` run state appears anywhere in
      // this corpus — see the absence control below — so this pair is
      // UNEXERCISED by real payloads, not disproven by them.
      CX2: [],
      // Same: no capture pairs `never_run` with usability, a failed store read
      // or a visible body. The degraded-read limb CANNOT appear, because the
      // fact it needs is not on the wire at all.
      CX3: [],
      CX4: ['olumi-docs/witness-seeded-2026-08-17/captures/W2-wire-analysis-turn-run-w2d.json'],
      CX5: ['olumi-docs/witness-seeded-2026-08-17/captures/W2-wire-analysis-turn-run-w2d.json'],
      CX6: ['olumi-docs/witness-acceptance-2026-08-17/captures/j4-t2-event-final.json'],
    })
  })

  it('every pair is accounted for in the roll-up — a pair with no row would be invisible', () => {
    const rollupKeys = ['CX1', 'CX2', 'CX3', 'CX4', 'CX5', 'CX6']
    expect(rollupKeys).toEqual([...COHERENCE_PAIR_IDS])
  })
})

describe('absence claims carry a POSITIVE and a CONTRAST control', () => {
  it('CX2 is unexercised because no capture carries a `refused` run state — and the same sweep DOES find other kinds', () => {
    const kinds = CORPUS
      .map(c => adaptCapture(c.raw).input.analysisState?.run_state?.kind)
      .filter((k): k is string => typeof k === 'string')
    // TARGET reads zero…
    expect(kinds.filter(k => k === 'refused')).toEqual([])
    // …while the CONTRAST in the SAME sweep reads non-zero. Absence is proven
    // only by that pair; a sweep that sees nothing sees nothing about anything.
    expect(kinds.filter(k => k === 'complete_current').length).toBeGreaterThan(0)
    expect(kinds.filter(k => k === 'never_run').length).toBeGreaterThan(0)
    expect(new Set(kinds).size).toBeGreaterThanOrEqual(3)
  })

  it('CX3\'s degraded-read limb CANNOT be exercised by any capture — the fact it needs is not transmitted', () => {
    for (const c of CORPUS) {
      expect(adaptCapture(c.raw).input.provenance.priorTurnStoreReadOk).toBeNull()
    }
  })

  it('CX3\'s visible-body limb is only PARTLY exercisable from payloads, and the proxy is stated rather than assumed', () => {
    // The adapter's proxy is "an analysis_result block is present". It is sound
    // one way only and cannot witness a RETAINED prior body, so a green here is
    // not a coverage claim about the DOM.
    const withBody = CORPUS.filter(c => adaptCapture(c.raw).input.surfaces.resultBodyVisible === true)
    expect(withBody.length).toBeGreaterThan(0)
    // None of them is a never_run turn, which is why the limb never fires.
    for (const c of withBody) {
      expect(adaptCapture(c.raw).input.analysisState?.run_state?.kind).not.toBe('never_run')
    }
  })
})
