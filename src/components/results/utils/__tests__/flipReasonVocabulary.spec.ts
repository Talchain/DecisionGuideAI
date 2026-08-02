/**
 * flipReasonVocabulary + classifyFlipEvidence — the union alignment and the
 * fail-loud drift pin (ROADMAP 2.280).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT, AND WHY IT WAS NOT THE ONE IN THE BRIEF
 * ─────────────────────────────────────────────────────────────────────────
 * The brief described `useResultsSectionData:1797`'s reason filter as dead
 * code that "can never match live data", accidentally load-bearing only for
 * hypothetical legacy rows. Deriving the vocabulary from the producer showed
 * that is half wrong in the dangerous direction:
 *
 *   · `isl_error` — never emitted as a flip reason (it is a transport-error
 *     envelope field in PLoT). That arm of the filter really was inert.
 *   · `timeout`   — a REAL producer token (`flip-threshold-status.ts:86`). That
 *     arm fires on the LIVE VOCABULARY — a claim about what the producer can
 *     emit, established at the bytes in PLoT, NOT a witnessed capture. No
 *     capture in `PHASE0-EVIDENCE-2026-07-28/` carries a `timeout` row (every
 *     witnessed zero-flip row is `structurally_invariant`). The corruption
 *     below is REACHABLE, not observed; do not restate it as witnessed.
 *
 * And when it fired it destroyed evidence: it deleted probe-failure rows
 * BEFORE `classifyFlipEvidence` counted them, so a run of one `timeout` plus
 * two `no_effect_within_bounds` lost the timeout row, and the remainder — all
 * null-valued, all attesting — classified as `flips_absent`. The panel then
 * asserted the producer had PROVED no flip exists, on a run where a factor was
 * never measured. That is the exact inversion `selectFlipRisk`'s own header
 * forbids: absence of evidence rendered as evidence of absence.
 *
 * The filter is deleted and the classifier now reads the reason. Both halves
 * are pinned below.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIXTURE / VOCABULARY PROVENANCE
 * ─────────────────────────────────────────────────────────────────────────
 * Tokens are derived from `Talchain/plot-lite-service` at `c0e4dc73`, live
 * path `src/routes/v2/run.ts:129-131`, with per-token citations in
 * `flipReasonVocabulary.ts`. The pinned contract
 * (`talchain-schemas-0.31.0.tgz`) types the field as an OPEN string and warns
 * against matching it, so PLoT is the authority and the vocabulary must stay
 * open — which is what the drift pin below exists to enforce.
 */

import { describe, it, expect } from 'vitest'
import { classifyFlipEvidence, selectFlipRisk } from '../selectFlipRisk'
import {
  ATTESTED_NO_FLIP_REASONS,
  KNOWN_PROBE_FAILURE_REASONS,
  LEGACY_PROBE_FAILURE_REASONS,
  FLIP_REASON_FOUND,
  isAttestedNoFlipReason,
  isProbeFailureFlipReason,
  isKnownFlipReason,
} from '../flipReasonVocabulary'

describe('flipReasonVocabulary — the derived token set', () => {
  it('control: the vocabulary is non-empty and the three substantive tokens are distinct', () => {
    // Anti-vacuity (trap 13). An allow-list test proves nothing if the
    // allow-list is empty — every "is not attested" assertion would pass.
    expect(ATTESTED_NO_FLIP_REASONS.length).toBe(2)
    expect(KNOWN_PROBE_FAILURE_REASONS.length).toBeGreaterThan(5)
    expect(ATTESTED_NO_FLIP_REASONS).toContain('no_effect_within_bounds')
    expect(ATTESTED_NO_FLIP_REASONS).toContain('structurally_invariant')
    expect(FLIP_REASON_FOUND).toBe('found')
  })

  it('the two ATTESTED tokens attest; `found` does not (it is the positive, not an absence)', () => {
    for (const r of ATTESTED_NO_FLIP_REASONS) {
      expect(isAttestedNoFlipReason(r)).toBe(true)
      expect(isProbeFailureFlipReason(r)).toBe(false)
    }
    expect(isAttestedNoFlipReason(FLIP_REASON_FOUND)).toBe(false)
    expect(isProbeFailureFlipReason(FLIP_REASON_FOUND)).toBe(false)
  })

  it('every KNOWN probe-failure token is a probe failure and attests nothing', () => {
    for (const r of [...KNOWN_PROBE_FAILURE_REASONS, ...LEGACY_PROBE_FAILURE_REASONS]) {
      expect(isProbeFailureFlipReason(r)).toBe(true)
      expect(isAttestedNoFlipReason(r)).toBe(false)
    }
  })

  it('the two fictional legacy tokens are typed but classified as establishing nothing', () => {
    // `no_bracket` has zero occurrences in the producer; `isl_error` occurs
    // only as a transport field. Neither can ever attest an absence.
    expect(LEGACY_PROBE_FAILURE_REASONS).toEqual(['no_bracket', 'isl_error'])
    expect(isAttestedNoFlipReason('no_bracket')).toBe(false)
    expect(isAttestedNoFlipReason('isl_error')).toBe(false)
  })

  it('DRIFT PIN: an UNRECOGNISED token is a probe failure by construction', () => {
    // The vocabulary is OPEN — PLoT forwards ISL tokens this build has never
    // seen, verbatim (`factor-flip-values.ts:317-324`). The predicates are
    // therefore written as allow-lists, so a new token needs no code change to
    // be handled SAFELY. If this ever fails, someone has inverted a predicate
    // into a deny-list and unknown tokens are being promoted to attestations.
    for (const unknown of ['a_token_from_the_future', 'NO_EFFECT', 'timeout ', '']) {
      expect(isKnownFlipReason(unknown)).toBe(false)
      expect(isAttestedNoFlipReason(unknown)).toBe(false)
      expect(isProbeFailureFlipReason(unknown)).toBe(true)
    }
    // Absence of a reason is also not an attestation.
    expect(isAttestedNoFlipReason(undefined)).toBe(false)
    expect(isAttestedNoFlipReason(null)).toBe(false)
  })
})

describe('classifyFlipEvidence — a probe failure is never an attested absence (ROADMAP 2.280)', () => {
  const attested = (id: string) => ({
    node_id: id,
    flip_value: null,
    flip_reason: 'no_effect_within_bounds',
  })

  it('positive control: EVERY row attesting still yields flips_absent', () => {
    // The 2.276 behaviour, preserved exactly. This must keep passing — it is
    // the arm that lets the panel honestly say nothing flips.
    expect(classifyFlipEvidence([attested('f1'), attested('f2')])).toBe('flips_absent')
  })

  it('positive control: a real flip_value still yields flips_present', () => {
    expect(
      classifyFlipEvidence([attested('f1'), { node_id: 'f2', flip_value: 0.5, flip_reason: 'found' }]),
    ).toBe('flips_present')
  })

  it('THE DEFECT: one timeout among attesting rows must NOT read as an attested absence', () => {
    // The live shape the deleted filter created. `timeout` is a real producer
    // token, so this run genuinely occurs; before 2.280 the timeout row was
    // filtered out upstream and the remainder classified as `flips_absent`.
    const mixed = [
      { node_id: 'f1', flip_value: null, flip_reason: 'timeout' },
      attested('f2'),
      attested('f3'),
    ]
    expect(classifyFlipEvidence(mixed)).toBe('no_producer_flip_data')
    expect(classifyFlipEvidence(mixed)).not.toBe('flips_absent')
  })

  it('THE DRIFT PIN: an unrecognised producer token fails toward no_producer_flip_data', () => {
    // The whole point of failing loud. A token this build has never seen must
    // never be silently promoted into "the producer proved nothing flips".
    const withUnknown = [attested('f1'), { node_id: 'f2', flip_value: null, flip_reason: 'brand_new_isl_reason' }]
    expect(classifyFlipEvidence(withUnknown)).toBe('no_producer_flip_data')
  })

  it('a null-valued row carrying NO reason at all attests nothing', () => {
    expect(classifyFlipEvidence([{ node_id: 'f1', flip_value: null }])).toBe('no_producer_flip_data')
  })

  it('every KNOWN probe-failure token blocks the attested-absence arm', () => {
    // Derived from the vocabulary, not a hand-listed repeat of it (trap 12):
    // add a token to the module and it is covered here automatically.
    for (const reason of [...KNOWN_PROBE_FAILURE_REASONS, ...LEGACY_PROBE_FAILURE_REASONS]) {
      expect(classifyFlipEvidence([attested('f1'), { node_id: 'f2', flip_value: null, flip_reason: reason }]))
        .toBe('no_producer_flip_data')
    }
  })

  it('and the gate STAYS OPEN on that degraded run — it is not silently blinded', () => {
    // `no_producer_flip_data` keeps `mayNameFlipRisk` true, so a run with an
    // unmeasured factor still surfaces its fragile-edge candidate rather than
    // rendering a false all-clear.
    const sel = selectFlipRisk(
      [{ node_id: 'f1', flip_value: null, flip_reason: 'timeout' }, attested('f2')],
      [{ label: 'Factor One', switchProbability: 0.4, joinId: 'f1', targetId: 'f1' }],
    )
    expect(sel.evidence).toBe('no_producer_flip_data')
    expect(sel.mayNameFlipRisk).toBe(true)
  })
})
