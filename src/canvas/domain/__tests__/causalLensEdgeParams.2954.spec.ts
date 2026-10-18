/**
 * ROADMAP 2.954 — `resolveCausalLensEdgeParams` MUST NOT SIGN OR SPEAK A STRENGTH NOBODY SET.
 *
 * Moved here from `StyledEdge.causalLens.2954.spec.tsx` when the causal lens itself was retired (18 Oct 2026, "Lenses
 * on the model": link figures are on the edge pills and in "Rests on"). The resolver stays: it is the one owner of
 * "may a strength, direction, spread or likelihood speak?", read by `domain/edges.ts` and `routeOnceHeld`. These rows
 * keep its refusals pinned, with the same real-capture fixtures through the real ingestion mapper.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import {
  resolveEdgeDirectionDisplay,
  resolveEdgeSignedStrengthDisplay,
  resolveEdgeValueDisplay,
  resolveCausalLensEdgeParams,
} from '../edgeValueProvenance'
import { DEFAULT_EDGE_DATA, USER_EDGE_DEFAULTS } from '../edges'
import { UNSET_EDGE_STROKE_WIDTH, weightMagnitudeToStrokeWidth, EDGE_STROKE_WIDTH_BANDS } from '../../utils/graphDisplayCalculations'

// ── Fixtures: real capture edges, through the real ingestion mapper ──────────

type WireEdge = Record<string, unknown>

function captureEdges(file: string): WireEdge[] {
  const p = resolve(__dirname, '../../starters/data', file)
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const edges = (j.edges ?? j.graph?.edges ?? []) as WireEdge[]
  expect(edges.length, `${file} carried no edges`).toBeGreaterThan(0)
  return edges
}

function findEdge(file: string, from: string, to: string): WireEdge {
  const hit = captureEdges(file).find(e => e.from === from && e.to === to)
  expect(hit, `${file} no longer carries ${from} → ${to}`).toBeDefined()
  return hit as WireEdge
}

/** The PRODUCER. Whatever ingestion writes is what the lens sees. */
function ingest(wire: WireEdge): Record<string, unknown> {
  return mapDraftEdgeToCanvas(wire, 0).data as Record<string, unknown>
}

/** Same real negative edge the #627/#629 templates pinned: mean −0.3504, stated negative. */
const SET_WIRE = findEdge('pricing-model.draft.json', 'fac_adoption_friction', 'out_bottom_up_growth')

/** A stated edge whose |mean| (0.5) sits in the MODERATE band — width discrimination. */
const STRONG_WIRE = findEdge('pricing-model.draft.json', 'fac_enterprise_revenue_risk', 'out_nrr')

/**
 * The producer EXPLICITLY declined a direction — `effect_direction: 'unknown'`
 * is a declared 0.30.0 contract member (#627's own fixture technique).
 * Ingestion strips the key and falls back to an UNSTAMPED `direction` derived
 * from the mean's sign, so the resolver refuses (`not_set`) while the raw
 * signed value (−0.3504) sits right there to be leaked. THE defect input.
 */
const UNKNOWN_DIR_WIRE: WireEdge = { ...SET_WIRE, effect_direction: 'unknown' }

/** STRENGTH UNSET, direction still stated: the one strength-bearing key deleted. */
const NO_STRENGTH_WIRE: WireEdge = (() => {
  const { strength: _s, ...rest } = SET_WIRE as Record<string, unknown> & { strength?: unknown }
  return rest
})()

/** NEITHER half stated: strength AND the stated direction both deleted. */
const NEITHER_WIRE: WireEdge = (() => {
  const { effect_direction: _d, ...rest } = NO_STRENGTH_WIRE as Record<string, unknown> & { effect_direction?: unknown }
  return rest
})()

const SET_DATA = ingest(SET_WIRE)
const STRONG_DATA = ingest(STRONG_WIRE)
const UNKNOWN_DIR_DATA = ingest(UNKNOWN_DIR_WIRE)
const NO_STRENGTH_DATA = ingest(NO_STRENGTH_WIRE)
const NEITHER_DATA = ingest(NEITHER_WIRE)

/**
 * A user-drawn edge, byte-identical to the store's own construction site
 * (`store.ts` onConnect: `data: { ...USER_EDGE_DEFAULTS }`). Every channel is
 * an unstamped default: weight 0.3, no direction, beliefExists 0.8,
 * strengthStd 0.15 — the lens previously printed ALL FOUR as measurements.
 */
const USER_DATA: Record<string, unknown> = { ...USER_EDGE_DEFAULTS }

describe('resolveCausalLensEdgeParams — provenance-gated params (ROADMAP 2.954, #629 lineage)', () => {
  describe('fixture preconditions (derived from the producer, not assumed)', () => {
    it('SET: producer-stamped strength (negative, Moderate band), direction, std and likelihood', () => {
      expect((SET_WIRE as any).strength.mean).toBeCloseTo(-0.3504, 3)
      expect((SET_WIRE as any).exists_probability).toBe(0.88)
      expect(resolveEdgeSignedStrengthDisplay(SET_DATA)).toEqual(
        expect.objectContaining({ show: true, source: 'cee' }),
      )
      expect(resolveEdgeDirectionDisplay(SET_DATA)).toEqual(
        expect.objectContaining({ show: true, direction: 'negative', source: 'cee' }),
      )
      expect(resolveEdgeValueDisplay(SET_DATA, 'strengthStd')).toEqual(
        expect.objectContaining({ show: true, source: 'cee' }),
      )
      expect(resolveEdgeValueDisplay(SET_DATA, 'beliefExists')).toEqual(
        expect.objectContaining({ show: true, value: 0.88, source: 'cee' }),
      )
    })

    it('STRONG: |mean| = 0.5 sits in the STRONG width band — discriminating from the unset floor', () => {
      expect((STRONG_WIRE as any).strength.mean).toBe(-0.5)
      expect((STRONG_WIRE as any).exists_probability).toBe(0.92)
      // ⚠ WAS `.moderate` UNTIL 18 Sep 2026, and the change IS the fix: the
      // width ladder now takes its cuts from `CANVAS_STRENGTH_BANDS`, so |mean| 0.5 —
      // which every word surface on the canvas calls "Strong" — finally draws
      // at the band named `strong` instead of the one named `moderate`. The
      // old expectation was a correct reading of a picture that contradicted
      // the caption beside it.
      expect(weightMagnitudeToStrokeWidth(0.5)).toBe(EDGE_STROKE_WIDTH_BANDS.strong)
      // ⭐ WAS `expect(UNSET_EDGE_STROKE_WIDTH).toBe(1.5)` UNTIL 8 Sep 2026, when
      // the unset floor moved strictly below every measured band (it used to
      // EQUAL the weakest one, so "nobody has said" and "we set this to weak"
      // drew identically). Pinning the literal would re-pin that collision the
      // next time either number moves; the load-bearing property was always the
      // ORDERING, so assert that instead and let it survive the change.
      expect(
        UNSET_EDGE_STROKE_WIDTH,
        'the unset floor is not below the 0.5 measured band — an unset strength is being drawn as a measurement',
      ).toBeLessThan(weightMagnitudeToStrokeWidth(0.5))
      expect(resolveEdgeDirectionDisplay(STRONG_DATA)).toEqual(
        expect.objectContaining({ show: true, direction: 'negative' }),
      )
    })

    it('UNKNOWN-direction: strength stamped, direction UNSTAMPED — and the resolved signed value is negative', () => {
      // The trap input, asserted rather than described: the resolver's value
      // carries a MINUS the direction resolver refuses to endorse. An
      // implementation leaking that sign renders "−"/danger here and the
      // defect assertions below RED.
      const strength = resolveEdgeSignedStrengthDisplay(UNKNOWN_DIR_DATA)
      expect(strength).toEqual(expect.objectContaining({ show: true, source: 'cee' }))
      expect((strength as { value: number }).value).toBeLessThan(0)
      expect(resolveEdgeDirectionDisplay(UNKNOWN_DIR_DATA)).toEqual({ show: false, reason: 'not_set' })
      // Ingestion strips the raw key but writes a plausible fallback — the trap.
      expect(UNKNOWN_DIR_DATA.direction).toBe('negative')
      expect(UNKNOWN_DIR_DATA.directionSource).toBeUndefined()
    })

    it('NO-STRENGTH: weight is the DEFAULT constant, unstamped — direction still stated', () => {
      expect(NO_STRENGTH_DATA.weight).toBe(DEFAULT_EDGE_DATA.weight)
      expect(NO_STRENGTH_DATA.weightSource).toBeUndefined()
      expect(resolveEdgeSignedStrengthDisplay(NO_STRENGTH_DATA)).toEqual({ show: false, reason: 'not_set' })
      expect(resolveEdgeDirectionDisplay(NO_STRENGTH_DATA)).toEqual(
        expect.objectContaining({ show: true, direction: 'negative', source: 'cee' }),
      )
    })

    it('NEITHER: both halves unset while the raw fields still look plausible', () => {
      expect(NEITHER_DATA.weight).toBe(DEFAULT_EDGE_DATA.weight)
      expect(NEITHER_DATA.direction).toBe('positive')
      expect(NEITHER_DATA.directionSource).toBeUndefined()
      expect(resolveEdgeSignedStrengthDisplay(NEITHER_DATA)).toEqual({ show: false, reason: 'not_set' })
      expect(resolveEdgeDirectionDisplay(NEITHER_DATA)).toEqual({ show: false, reason: 'not_set' })
      // The likelihood IS the producer's here (exists_probability survived).
      expect(resolveEdgeValueDisplay(NEITHER_DATA, 'beliefExists')).toEqual(
        expect.objectContaining({ show: true, value: 0.88 }),
      )
    })

    it('USER edge: all four channels are unstamped defaults — nothing may speak', () => {
      expect(USER_DATA.weight).toBe(0.3)
      expect(USER_DATA.direction).toBeUndefined()
      expect(USER_DATA.beliefExists).toBe(0.8)
      expect(USER_DATA.strengthStd).toBe(0.15)
      expect(resolveEdgeSignedStrengthDisplay(USER_DATA)).toEqual({ show: false, reason: 'not_set' })
      expect(resolveEdgeDirectionDisplay(USER_DATA)).toEqual({ show: false, reason: 'absent' })
      expect(resolveEdgeValueDisplay(USER_DATA, 'beliefExists')).toEqual({ show: false, reason: 'not_set' })
      expect(resolveEdgeValueDisplay(USER_DATA, 'strengthStd')).toEqual({ show: false, reason: 'not_set' })
    })

    it('wire spelling guard: `strength` is the only strength key, so deleting it deletes the claim', () => {
      expect(SET_WIRE).not.toHaveProperty('strength_mean')
      expect(SET_WIRE).not.toHaveProperty('weight')
      expect(NO_STRENGTH_WIRE).not.toHaveProperty('strength')
      expect(NEITHER_WIRE).not.toHaveProperty('strength')
      expect(NEITHER_WIRE).not.toHaveProperty('effect_direction')
    })
  })

  // ── THE PRODUCER (resolveCausalLensEdgeParams) ────────────────────────────

  describe('resolveCausalLensEdgeParams — the one owner of "may the lens speak?"', () => {
    it('SET: all four channels speak the producer values', () => {
      const p = resolveCausalLensEdgeParams(SET_DATA)
      expect(p.magnitude).toBeCloseTo(0.3504, 3)
      expect(p.direction).toBe('negative')
      expect(p.std).toBeCloseTo(0.109, 3)
      expect(p.existsProb).toBe(0.88)
    })

    it('UNKNOWN direction: the magnitude speaks UNSIGNED and the direction refuses', () => {
      const p = resolveCausalLensEdgeParams(UNKNOWN_DIR_DATA)
      expect(p.magnitude).toBeCloseTo(0.3504, 3)
      expect(p.magnitude).toBeGreaterThan(0) // no raw-sign leak into the magnitude
      expect(p.direction).toBeNull()
    })

    it('NO strength: the magnitude refuses while the stated direction still speaks', () => {
      const p = resolveCausalLensEdgeParams(NO_STRENGTH_DATA)
      expect(p.magnitude).toBeNull()
      expect(p.direction).toBe('negative')
      expect(p.std).toBeNull()
      expect(p.existsProb).toBe(0.88)
    })

    it('NEITHER: magnitude and direction both refuse', () => {
      const p = resolveCausalLensEdgeParams(NEITHER_DATA)
      expect(p.magnitude).toBeNull()
      expect(p.direction).toBeNull()
    })

    it('USER edge: every channel refuses — no default reaches the lens', () => {
      const p = resolveCausalLensEdgeParams(USER_DATA)
      expect(p).toEqual({ magnitude: null, direction: null, std: null, existsProb: null })
    })
  })
})
