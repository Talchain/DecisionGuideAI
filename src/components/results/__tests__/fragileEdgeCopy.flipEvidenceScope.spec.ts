/**
 * THE FRAGILE-EDGE CARD MUST NOT IMPERSONATE THE FLIP AUTHORITY.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT, AS WITNESSED ON STAGING (UI 2b6ec553 / CEE 19a60fd)
 * ─────────────────────────────────────────────────────────────────────────
 * One DOM, one moment, one screenful:
 *
 *   "3 factors could flip the result to {alt}"          ← this card
 *   "{alt} could overtake (57%)"                        ← this card
 *   "none of the factors we could test changed which
 *    option leads on its own, but this result scored
 *    low on our other robustness checks"                ← robustness footer
 *
 * ⚠⚠ NEITHER SIDE IS WRONG, AND THAT IS THE POINT. They answer DIFFERENT
 * QUESTIONS and the surface presented two scopes as one:
 *
 *   · the card counts EDGES (`robustness.fragile_edges`, `edge_id =
 *     "{from}->{to}"`), selected by `max|elasticity| > 0.1`, and its
 *     `switch_probability` is observed in the samples where that edge sat in
 *     the BOTTOM QUARTILE of its strength — with every other edge ALSO
 *     varying. A JOINT-manipulation statistic.
 *   · `display_verdict_reason` speaks for the FACTOR-FLIP probe: eligible ROOT
 *     factors, swept ONE AT A TIME, asking whether the argmax crosses. A SOLO
 *     sweep, and `structurally_invariant` is ISL's mathematical attestation
 *     that no value of that factor can move it.
 *
 * Different objects, different scopes, different manipulations — so both are
 * routinely TRUE of the same run. PLoT had already written this down and
 * nothing downstream ever read it (`robustness-display-verdict.ts:85-89`:
 * fragile edges are "a different measurement from factor flips and is not
 * contradicted by them"). The producer knew; the sibling surface never got
 * the memo.
 *
 * ⚠ AND THE COLLISION MECHANIC, which is why it survived every guard: the two
 * gates are ANTI-CORRELATED. `designationsWithheld` is leader-claim
 * PERMISSION; `flips_absent` is flip EVIDENCE. A run where nothing can flip
 * the leader is precisely a run where the leader IS confidently designated —
 * so the neutral copy ALREADY IN THIS MODULE was gated OFF on exactly the runs
 * that needed it. Two questions under one gate, failing in the worst
 * direction.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE FIX CONSUMES AN EXISTING AUTHORITY — IT ADDS NO DERIVATION
 * ─────────────────────────────────────────────────────────────────────────
 * `selectFlipRisk.ts` already classifies this run's flip evidence and already
 * states the rule, in its own words: on `flips_absent` the producer "has
 * affirmatively said there is no flip. NO SURFACE MAY NAME A FLIP RISK OR
 * PRINT A FLIP PERCENTAGE." This card named one and printed one, and was the
 * one surface that never asked. Not a missing rule — an UNCONSULTED one.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PROVENANCE — REAL CAPTURES, NOT SELF-AUTHORED FIXTURES
 * ─────────────────────────────────────────────────────────────────────────
 * A fixture written here would encode THIS AUTHOR'S model of the producer,
 * and two producers' semantics are the very thing in question. Both payloads
 * below are captures taken off the wire and already in the corpus:
 *
 *   · CONTRADICTION arm — `live-analysis-turn-walkA-2026-08-04.json`:
 *     20 fragile edges, 7 flip-threshold rows ALL `structurally_invariant`,
 *     `display_verdict: fragile` + the attested-no-flip reason. Note
 *     `fac_sales_headcount` is BOTH an attested no-flip factor AND the source
 *     of a fragile edge naming "Hire Two Sales Reps" — the same factor, in one
 *     screenful.
 *   · OPPOSITE-DIRECTION arm — `conditional-winners-2026-08-17-probe-A.json`:
 *     2 fragile edges and 2 flip rows carrying REAL `flip_value`s
 *     (`flip_reason: 'found'`). A genuinely flip-bearing run, which MUST keep
 *     the strong verb in full force.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as fragileEdgeCopy from '../utils/fragileEdgeCopy'
import {
  attestsNoFactorFlip,
  fragileEdgeGroupHeader,
  fragileEdgeConsequence,
  fragileEValueNote,
  fragileDiscussDraft,
} from '../utils/fragileEdgeCopy'
import { classifyFlipEvidence } from '../utils/selectFlipRisk'

const read = (p: string) => JSON.parse(readFileSync(resolve(__dirname, p), 'utf-8'))

const WALK_A = read('../../../v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json')
const PROBE_A = read(
  '../../../lib/coherence/__tests__/fixtures/captures/conditional-winners-2026-08-17-probe-A.json',
)

/** The presupposing claims — each asserts the LEADER could change. */
const FLIP_CLAIM_RE = /could flip the result to|which option is most likely to hit your goal/

// ── the two captures, read exactly as the wire delivered them ──────────────
const walkAEnrichment = WALK_A.blocks[0].enrichment
const walkAFlipThresholds = walkAEnrichment.flip_thresholds
const walkAReason: string = walkAEnrichment.robustness.display_verdict_reason
/** The alt-winner group the card would render, taken from the capture. */
const walkAGroup = walkAEnrichment.robustness.fragile_edges.filter(
  (e: { alternative_winner_label?: string }) =>
    e.alternative_winner_label === 'Hire Two Sales Reps',
)
const ALT = 'Hire Two Sales Reps'

const probeAFlipThresholds = PROBE_A.flip_thresholds
const probeAGroup = PROBE_A.robustness.fragile_edges
const PROBE_ALT = 'Lock in demand now'

describe('PRECONDITION PINS — without these every assertion below is vacuous', () => {
  // ⚠ Obligation 3. A "no contradiction" pass proves NOTHING unless the payload
  // would actually have rendered BOTH strings. These fail loud if the corpus
  // drifts underneath the spec.
  it('the contradiction capture WOULD render a non-zero flip count', () => {
    expect(walkAGroup.length).toBeGreaterThan(1)
    expect(walkAGroup.every((e: { alternative_winner_label: string }) =>
      e.alternative_winner_label === ALT)).toBe(true)
  })

  it('the contradiction capture WOULD render a non-empty attested-no-flip reason', () => {
    expect(walkAReason).toContain('none of the factors we could test changed which option leads')
    expect(walkAFlipThresholds.length).toBeGreaterThan(0)
  })

  it('the contradiction capture classifies as flips_absent AT THE EXISTING AUTHORITY', () => {
    expect(classifyFlipEvidence(walkAFlipThresholds)).toBe('flips_absent')
    expect(attestsNoFactorFlip(walkAFlipThresholds)).toBe(true)
  })

  it('the opposite-direction capture is GENUINELY flip-bearing, not merely different', () => {
    expect(probeAGroup.length).toBeGreaterThan(1)
    expect(probeAFlipThresholds.some((r: { flip_value: unknown }) =>
      typeof r.flip_value === 'number')).toBe(true)
    expect(classifyFlipEvidence(probeAFlipThresholds)).toBe('flips_present')
    expect(attestsNoFactorFlip(probeAFlipThresholds)).toBe(false)
  })

  it('the same factor is BOTH attested-no-flip AND a fragile-edge source (the sharpest form)', () => {
    const attestedIds = new Set(
      walkAFlipThresholds.map((r: { factor_id: string }) => r.factor_id),
    )
    const collide = walkAEnrichment.robustness.fragile_edges.filter(
      (e: { from_id?: string }) => e.from_id != null && attestedIds.has(e.from_id),
    )
    expect(collide.length).toBeGreaterThan(0)
    expect(attestedIds.has('fac_sales_headcount')).toBe(true)
  })
})

describe('Q2 EVIDENCE — an attested no-flip run may not use flip vocabulary', () => {
  const header = () =>
    fragileEdgeGroupHeader({
      altWinnerLabel: ALT,
      edgeCount: walkAGroup.length,
      hasEValue: false,
      designationsWithheld: false, // ⚠ PERMITTED — Q1 is FALSE here on purpose
      flipEvidenceAttestsNoFlip: attestsNoFactorFlip(walkAFlipThresholds),
    })

  it('THE WITNESSED CONTRADICTION IS GONE: the header drops the flip claim', () => {
    const h = header()
    expect(h.kind).toBe('altWinner')
    const text = h.kind === 'altWinner' ? h.lead + h.altWinnerLabel : h.text
    expect(text).not.toMatch(FLIP_CLAIM_RE)
    expect(text).toContain('could shift the comparison towards')
  })

  it('DATA SURVIVES IN FULL — count and the alternative are not silenced', () => {
    const h = header()
    expect(h.kind).toBe('altWinner')
    if (h.kind !== 'altWinner') return
    // Bound by IDENTITY: the alt-winner element carries this exact label.
    expect(h.altWinnerLabel).toBe(ALT)
    expect(h.lead).toContain(String(walkAGroup.length))
  })

  it('Q2 ALONE suffices — it is not a fallback for Q1', () => {
    const text = (w: boolean, a: boolean) => {
      const h = fragileEdgeGroupHeader({
        altWinnerLabel: ALT, edgeCount: 3, hasEValue: false,
        designationsWithheld: w, flipEvidenceAttestsNoFlip: a,
      })
      return h.kind === 'altWinner' ? h.lead + h.altWinnerLabel : h.text
    }
    expect(text(false, true)).not.toMatch(FLIP_CLAIM_RE)   // evidence alone
    expect(text(true, false)).not.toMatch(FLIP_CLAIM_RE)   // permission alone
    expect(text(true, true)).not.toMatch(FLIP_CLAIM_RE)
    expect(text(false, false)).toMatch(FLIP_CLAIM_RE)      // neither ⇒ verb earned
  })
})

describe('OPPOSITE DIRECTION — a genuinely fragile result must still say so', () => {
  // ⚠ Trap 22b. A fix that silences one side is not a fix; it trades a visible
  // contradiction for a silent omission. Every case gets its twin.
  it('a real flip-bearing capture KEEPS the strong verb, in full force', () => {
    const h = fragileEdgeGroupHeader({
      altWinnerLabel: PROBE_ALT,
      edgeCount: probeAGroup.length,
      hasEValue: false,
      designationsWithheld: false,
      flipEvidenceAttestsNoFlip: attestsNoFactorFlip(probeAFlipThresholds),
    })
    expect(h.kind).toBe('altWinner')
    if (h.kind !== 'altWinner') return
    expect(h.lead).toContain('could flip the result to')
    expect(h.altWinnerLabel).toBe(PROBE_ALT)
  })

  it('the per-edge and E-value claims also survive on a flip-bearing run', () => {
    const v = { designationsWithheld: false, flipEvidenceAttestsNoFlip: false }
    expect(fragileEdgeConsequence(v)).toMatch(FLIP_CLAIM_RE)
    expect(fragileEValueNote({ eValue: 2.0, ...v })).toMatch(FLIP_CLAIM_RE)
  })

  it('UNRESOLVED evidence is not an attestation — the verb is kept, failing toward "we do not know"', () => {
    // An unfinished probe attests nothing (PLoT: "never add a reason that
    // merely means we did not finish"). Empty is not an attestation either —
    // `[].every()` is vacuously true and would have silently over-claimed.
    expect(attestsNoFactorFlip([{ flip_value: null, flip_reason: 'timeout' }])).toBe(false)
    expect(attestsNoFactorFlip([])).toBe(false)
    expect(attestsNoFactorFlip(null)).toBe(false)
    expect(attestsNoFactorFlip(undefined)).toBe(false)
  })
})

describe('THE NOUN — a plain falsehood, INDEPENDENT of the contradiction', () => {
  // ⚠ Pinned separately, with its own mutant, because it is wrong even on runs
  // where the flip evidence says nothing at all. `fragile_edges` are EDGES; the
  // estate had already measured that edges and source factors are not 1:1
  // (`StressTestSection.tsx:287-289` — two edges sharing a source factor render
  // the same "If X shifts" line), so "3 factors" could be a count of 3 edges
  // over FEWER distinct factors.
  it('counts RELATIONSHIPS, not factors — on a run with NO flip evidence either way', () => {
    const h = fragileEdgeGroupHeader({
      altWinnerLabel: ALT, edgeCount: 3, hasEValue: false,
      designationsWithheld: false,
      flipEvidenceAttestsNoFlip: attestsNoFactorFlip([]), // no_producer_flip_data
    })
    expect(h.kind).toBe('altWinner')
    if (h.kind !== 'altWinner') return
    expect(h.lead).toContain('3 relationships')
    expect(h.lead).not.toContain('3 factors')
    expect(h.lead).not.toMatch(/\bfactors?\b/)
  })

  it('the noun is right in BOTH verb states and singularises correctly', () => {
    for (const flipEvidenceAttestsNoFlip of [false, true]) {
      const h = fragileEdgeGroupHeader({
        altWinnerLabel: ALT, edgeCount: 2, hasEValue: false,
        designationsWithheld: false, flipEvidenceAttestsNoFlip,
      })
      if (h.kind !== 'altWinner') throw new Error('expected altWinner')
      expect(h.lead).toContain('2 relationships')
      expect(h.lead).not.toMatch(/\bfactors?\b/)
    }
  })

  it('the capture-derived count is rendered as relationships', () => {
    const h = fragileEdgeGroupHeader({
      altWinnerLabel: ALT, edgeCount: walkAGroup.length, hasEValue: false,
      designationsWithheld: false, flipEvidenceAttestsNoFlip: true,
    })
    if (h.kind !== 'altWinner') throw new Error('expected altWinner')
    expect(h.lead).toContain(`${walkAGroup.length} relationships`)
  })
})

describe('ANTI-RECURRENCE — no exported copy function may borrow the vocabulary', () => {
  // The next surface to reach for this vocabulary must fail loud here. The
  // covered set is asserted against the module's ACTUAL exports, so a function
  // added later cannot slip past by simply not being listed.
  const COVERED = [
    'attestsNoFactorFlip',
    'fragileEdgeGroupHeader',
    'fragileEdgeConsequence',
    'fragileEValueNote',
    'fragileDiscussDraft',
  ].sort()

  it('the covered set IS the module\'s exported function set (fails loud on a new export)', () => {
    const exported = Object.entries(fragileEdgeCopy)
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k)
      .sort()
    expect(exported).toEqual(COVERED)
  })

  it('on the attested-no-flip CAPTURE, no copy function emits a flip claim', () => {
    const a = attestsNoFactorFlip(walkAFlipThresholds)
    expect(a).toBe(true)
    const v = { designationsWithheld: false, flipEvidenceAttestsNoFlip: a }
    const h = fragileEdgeGroupHeader({
      altWinnerLabel: ALT, edgeCount: walkAGroup.length, hasEValue: true, ...v,
    })
    const strings = [
      h.kind === 'altWinner' ? h.lead + h.altWinnerLabel : h.text,
      fragileEdgeConsequence(v),
      fragileEValueNote({ eValue: 2.0, ...v }),
      fragileDiscussDraft({
        edgeCount: walkAGroup.length, altWinnerLabel: ALT,
        fromLabel: 'Sales Headcount Expansion', toLabel: 'Budget Overrun Risk', ...v,
      }),
    ]
    for (const s of strings) expect(s).not.toMatch(FLIP_CLAIM_RE)
    // …and the alternative is still named in the two sentences that carry it.
    expect(strings[0]).toContain(ALT)
    expect(strings[3]).toContain(ALT)
  })
})
