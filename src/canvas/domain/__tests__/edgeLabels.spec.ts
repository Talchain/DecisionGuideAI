/**
 * Edge Labels Tests
 * Tests for meaningful human-readable edge labels (v1.2)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  describeEdge,
  formatNumericLabel,
  getEdgeLabel,
  getEdgeLabelMode,
  LABEL_HEDGE_CUT,
  type EdgeLabelMode
} from '../edgeLabels'
import { EDGE_VALUE_BAND_CUTS, edgeValueBand } from '../edgeValueProvenance'
// ⚠ IMPORTED, NOT RE-TYPED. The cross-surface pin below has to read the SAME
// table the product reads, or it is a second mirror asserting agreement with
// itself (CLAUDE.md trap 12).
import { getStrengthLabel } from '../vocabulary'
import type { EdgeDirectionDisplay, EdgeValueDisplay } from '../edgeValueProvenance'

/**
 * ROADMAP 2.935 — the direction is now an ARGUMENT, not an inference from the
 * sign of `weight`.
 *
 * ⚠ WHY EVERY ASSERTION BELOW USED TO PASS WHILE THE PRODUCT WAS WRONG. This
 * file called `describeEdge(-0.5, 0.8)` and got "Moderate drag" — with a
 * NEGATIVE weight the producer cannot emit. Both ingestion paths store
 * `Math.abs(rawWeight)` (UI-SEM-023), so the only argument the product ever
 * passed was non-negative and the "drag" branch was unreachable in the live
 * product while being fully covered here. CLAUDE.md trap 16-inverse: the code
 * path was live and the DATA could never reach it — a fixture you wrote
 * yourself is not evidence about the wire.
 *
 * The signed weights are KEPT below deliberately, and now prove something
 * stronger: `describeEdge` uses `weight` for its MAGNITUDE ONLY, so a signed
 * argument cannot smuggle a direction claim past the gate. The integration-level
 * proof against real capture data lives in
 * `edges/__tests__/StyledEdge.edgeLabelDirectionWords.2935.spec.tsx`.
 *
 * ROADMAP 2.950 — and the STRENGTH is now a resolved `EdgeValueDisplay`, not a
 * raw number, closing the same fabrication in the other clause: `weight`
 * defaults on every edge (`DEFAULT_EDGE_DATA` 0.5 / `USER_EDGE_DEFAULTS` 0.3),
 * so a raw first argument rendered "Moderate" for strengths nobody set. `SET`
 * below wraps the historical numeric fixtures — their values and expectations
 * are unchanged — and the unset states have their own block at the bottom.
 * Integration-level proof against real capture bytes:
 * `edges/__tests__/StyledEdge.edgeLabelStrengthWords.2950.spec.tsx`.
 */
const STATED_POSITIVE: EdgeDirectionDisplay = { show: true, direction: 'positive', source: 'user' }
const STATED_NEGATIVE: EdgeDirectionDisplay = { show: true, direction: 'negative', source: 'user' }
const NOT_STATED: EdgeDirectionDisplay = { show: false, reason: 'not_set' }
const SET = (value: number): EdgeValueDisplay => ({ show: true, value, source: 'user' })
const LIKELIHOOD_NOT_SET: EdgeValueDisplay = { show: false, reason: 'not_set' }
const STRENGTH_NOT_SET: EdgeValueDisplay = { show: false, reason: 'not_set' }
const STRENGTH_ABSENT: EdgeValueDisplay = { show: false, reason: 'absent' }

describe('edgeLabels', () => {
  // Clean up localStorage between tests
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  /**
   * ⭐⭐ THE STRENGTH ADJECTIVES BELOW CHANGED, AND THE OLD ONES WERE WRONG —
   * not stale, WRONG, because a second surface was saying something else about
   * the same number at the same moment.
   *
   * `describeEdge` restated its own band table (`>= 0.7 'Strong' : >= 0.3
   * 'Moderate' : 'Weak'`). The canonical one is `getStrengthLabel`
   * (`domain/vocabulary.ts`, moved there from `inspector-v2/inspectorStrings.ts`
   * in this change): **Very strong ≥ 0.70, Strong ≥ 0.40, Moderate ≥ 0.20,
   * Slight < 0.20**, from `validation_ui_data_contract_v1.1`. It is what
   * `ConnectionRow` and the `StrengthBandButtons` pills
   * have always read — and `StrengthBandButtons` WRITES a band's midpoint back
   * into the model, so the canonical table is the one a user's own click means.
   *
   * The two agree on exactly ONE band, |w| ∈ [0.30, 0.40) — 10% of [0, 1]. So
   * an 0.5 edge read "Moderate boost" on the canvas chip while the inspector
   * panel an inch away read "Strong"; 0.85 read "Strong boost" against "Very
   * strong"; 0.25 read "Weak boost" against "Moderate".
   *
   * ⚠ EVERY EXPECTATION HERE IS RE-DERIVED FROM THAT TABLE, NOT PATCHED UNTIL
   * GREEN, and none is weakened: each remains an exact `toBe` on a full string.
   * Where the number was chosen to sit on a cut, the number moved WITH the cut
   * so the test still pins a boundary rather than a comfortable interior point.
   */
  describe('describeEdge', () => {
    describe('Positive weights (boost)', () => {
      it('returns "Very strong boost" for high positive weight with high belief', () => {
        const result = describeEdge(SET(0.9), SET(0.9), STATED_POSITIVE)
        // 0.9 ≥ 0.70 → "Very strong". The panel has always called an 0.9 edge
        // "Very strong"; the chip called it "Strong".
        expect(result.label).toBe('Very strong boost')
        expect(result.tooltip).toContain('Weight: 0.90')
        expect(result.tooltip).toContain('Belief: 90%')
      })

      it('returns "Strong boost" for medium positive weight', () => {
        const result = describeEdge(SET(0.5), SET(0.8), STATED_POSITIVE)
        // 0.40 ≤ 0.5 < 0.70 → "Strong". This is the single most common
        // disagreement in the product: `DEFAULT_EDGE_DATA.weight` is 0.5.
        expect(result.label).toBe('Strong boost')
      })

      it('returns "Moderate boost" for low positive weight', () => {
        const result = describeEdge(SET(0.2), SET(0.8), STATED_POSITIVE)
        // 0.20 ≤ 0.2 < 0.40 → "Moderate", and 0.2 is the Moderate cut exactly.
        expect(result.label).toBe('Moderate boost')
      })

      it('returns "Slight boost" below the Moderate cut', () => {
        // The fourth band has no old-vocabulary counterpart — "Weak" spanned
        // everything under 0.3 — so this case is NEW, not a rewritten one, and
        // it is the only one that pins the bottom word at all.
        expect(describeEdge(SET(0.19), SET(0.8), STATED_POSITIVE).label).toBe('Slight boost')
      })

      it('adds "(uncertain)" qualifier for low belief', () => {
        // Qualifier logic untouched; only the adjectives are re-derived.
        expect(describeEdge(SET(0.9), SET(0.5), STATED_POSITIVE).label).toBe('Very strong boost (uncertain)')
        expect(describeEdge(SET(0.5), SET(0.4), STATED_POSITIVE).label).toBe('Strong boost (uncertain)')
        expect(describeEdge(SET(0.2), SET(0.3), STATED_POSITIVE).label).toBe('Moderate boost (uncertain)')
      })

      it('handles edge case at the 0.70 Very-strong threshold', () => {
        // 0.70 is inclusive, 0.69 falls to the band below. The NUMBERS are
        // unchanged from the old "0.7 threshold" test — this cut is the one the
        // two tables happened to share — but the WORDS either side of it were
        // both wrong before.
        expect(describeEdge(SET(0.7), SET(0.8), STATED_POSITIVE).label).toBe('Very strong boost')
        expect(describeEdge(SET(0.69), SET(0.8), STATED_POSITIVE).label).toBe('Strong boost')
      })

      it('handles edge case at the 0.40 Strong threshold', () => {
        // Replaces the old "0.3 threshold" pair. 0.3 is no longer a cut in the
        // canonical table, so pinning it would pin a band interior and stop
        // discriminating; the number moves with the cut it exists to guard.
        expect(describeEdge(SET(0.4), SET(0.8), STATED_POSITIVE).label).toBe('Strong boost')
        expect(describeEdge(SET(0.39), SET(0.8), STATED_POSITIVE).label).toBe('Moderate boost')
      })

      it('handles edge case at the 0.20 Moderate threshold', () => {
        // The other new cut. 0.20 inclusive → Moderate; below it → Slight.
        expect(describeEdge(SET(0.2), SET(0.8), STATED_POSITIVE).label).toBe('Moderate boost')
        expect(describeEdge(SET(0.19), SET(0.8), STATED_POSITIVE).label).toBe('Slight boost')
      })
    })

    describe('Negative weights (drag)', () => {
      it('returns "Very strong drag" for high negative weight', () => {
        // Magnitude only: |−0.9| = 0.9 ≥ 0.70.
        expect(describeEdge(SET(-0.9), SET(0.9), STATED_NEGATIVE).label).toBe('Very strong drag')
      })

      it('returns "Strong drag" for medium negative weight', () => {
        // |−0.5| = 0.5, in [0.40, 0.70).
        expect(describeEdge(SET(-0.5), SET(0.8), STATED_NEGATIVE).label).toBe('Strong drag')
      })

      it('returns "Moderate drag" for low negative weight', () => {
        // |−0.2| = 0.2, the Moderate cut exactly.
        expect(describeEdge(SET(-0.2), SET(0.8), STATED_NEGATIVE).label).toBe('Moderate drag')
      })

      it('adds "(uncertain)" qualifier for low belief', () => {
        expect(describeEdge(SET(-0.9), SET(0.5), STATED_NEGATIVE).label).toBe('Very strong drag (uncertain)')
        expect(describeEdge(SET(-0.5), SET(0.4), STATED_NEGATIVE).label).toBe('Strong drag (uncertain)')
        expect(describeEdge(SET(-0.2), SET(0.3), STATED_NEGATIVE).label).toBe('Moderate drag (uncertain)')
      })
    })

    /**
     * ⭐ THE PIN THE REST OF THIS FILE CANNOT PROVIDE: the chip and the panel
     * name the SAME EDGE with the SAME ADJECTIVE.
     *
     * Every other assertion here is a literal string, so all of them would stay
     * green if `describeEdge` went back to restating a table that happened to
     * be re-typed correctly today. This one binds the two surfaces to ONE
     * function: it reads the adjective `getStrengthLabel` returns and requires
     * `describeEdge`'s label to start with it. Re-introduce ANY second table and
     * this REDs on the first value the two disagree about — which the old code
     * did on 90% of [0, 1].
     *
     * ⚠ IT PINS ITS OWN PRECONDITION. A sweep that asserted only "the words
     * agree" would also pass if `getStrengthLabel` collapsed to a constant, or
     * if the sample never crossed a cut. So the sweep first asserts it saw all
     * FOUR words — i.e. that it is discriminating at all — before the agreement
     * claim means anything (CLAUDE.md trap 13b).
     */
    describe('one table, two surfaces', () => {
      it('the canvas chip opens with exactly the adjective the panel shows, across [0, 1]', () => {
        const seen = new Set<string>()
        for (let w = 0; w <= 1.0001; w += 0.01) {
          const magnitude = Math.round(w * 100) / 100
          const canonical = getStrengthLabel(magnitude)
          seen.add(canonical)
          expect(
            describeEdge(SET(magnitude), SET(0.9), STATED_POSITIVE).label,
            `chip and panel disagree at |w| = ${magnitude}`,
          ).toBe(`${canonical} boost`)
          expect(
            describeEdge(SET(-magnitude), SET(0.9), STATED_NEGATIVE).label,
            `chip and panel disagree at |w| = ${magnitude} (negative)`,
          ).toBe(`${canonical} drag`)
          expect(
            describeEdge(SET(magnitude), SET(0.9), NOT_STATED).label,
            `chip and panel disagree at |w| = ${magnitude} (direction unstated)`,
          ).toBe(`${canonical} effect, direction not stated`)
        }
        // PRECONDITION, not decoration: without this the agreement above is
        // satisfiable by a constant on both sides.
        expect([...seen].sort()).toEqual(['Moderate', 'Slight', 'Strong', 'Very strong'])
      })

      it('all four adjectives compose grammatically into all three clause shapes', () => {
        // Constraint checked by reading, then pinned: "Slight boost", "Very
        // strong drag" and "Very strong effect, direction not stated" are the
        // new compositions, and none needs an article or a plural change.
        const byBand: Array<[number, string]> = [
          [0.85, 'Very strong'],
          [0.55, 'Strong'],
          [0.30, 'Moderate'],
          [0.10, 'Slight'],
        ]
        for (const [magnitude, word] of byBand) {
          expect(describeEdge(SET(magnitude), SET(0.9), STATED_POSITIVE).label).toBe(`${word} boost`)
          expect(describeEdge(SET(magnitude), SET(0.9), STATED_NEGATIVE).label).toBe(`${word} drag`)
          expect(describeEdge(SET(magnitude), SET(0.9), NOT_STATED).label).toBe(
            `${word} effect, direction not stated`,
          )
        }
      })
    })

    /**
     * ⚠ THESE THREE TESTS WERE NAMED AFTER A FOUR-BAND VOCABULARY THE FUNCTION
     * HAS NEVER EMITTED. They said "treats >= 80% as HIGH confidence" and
     * "treats 60-80% as MEDIUM confidence" — but both produce the SAME output,
     * no qualifier, so the 80% cut they named discriminates nothing. The names
     * mirrored `describeEdge`'s old header block, which claimed the same four
     * bands and was corrected in the same change as this.
     *
     * There is ONE cut here, `LABEL_HEDGE_CUT`, with two outcomes. The
     * assertions are unchanged — they were always right; only the names claimed
     * more structure than the code has.
     */
    describe('the hedge cut — one threshold, two outcomes', () => {
      /*
       * ⚠ THE STRENGTH FIXTURE IS UNCHANGED AT 0.5 AND ONLY ITS ADJECTIVE MOVED
       * (Moderate → Strong): 0.5 sits in [0.40, 0.70). These tests are about the
       * LIKELIHOOD cut and hold the strength constant on purpose, so re-picking
       * the number to preserve the old word would have changed what they vary.
       */
      it('is silent at and above the cut, across the whole range above it', () => {
        expect(describeEdge(SET(0.5), SET(LABEL_HEDGE_CUT), STATED_POSITIVE).label).toBe('Strong boost')
        expect(describeEdge(SET(0.5), SET(0.7), STATED_POSITIVE).label).toBe('Strong boost')
        expect(describeEdge(SET(0.5), SET(0.79), STATED_POSITIVE).label).toBe('Strong boost')
        expect(describeEdge(SET(0.5), SET(0.8), STATED_POSITIVE).label).toBe('Strong boost')
        expect(describeEdge(SET(0.5), SET(0.85), STATED_POSITIVE).label).toBe('Strong boost')
        expect(describeEdge(SET(0.5), SET(1.0), STATED_POSITIVE).label).toBe('Strong boost')
      })

      it('hedges below the cut, across the whole range below it', () => {
        expect(describeEdge(SET(0.5), SET(0.59), STATED_POSITIVE).label).toBe('Strong boost (uncertain)')
        expect(describeEdge(SET(0.5), SET(0.4), STATED_POSITIVE).label).toBe('Strong boost (uncertain)')
        expect(describeEdge(SET(0.5), SET(0.1), STATED_POSITIVE).label).toBe('Strong boost (uncertain)')
        expect(describeEdge(SET(0.5), SET(0), STATED_POSITIVE).label).toBe('Strong boost (uncertain)')
      })

      it('there is no THIRD outcome anywhere in [0, 1] — the vocabulary really is binary', () => {
        // The claim the old names made and never checked. Enumerated at a step
        // fine enough to cross both retired cuts (0.6 and 0.8): every label is
        // one of exactly two strings, so no band adjective survives anywhere.
        const seen = new Set<string>()
        for (let v = 0; v <= 1.0001; v += 0.01) {
          seen.add(describeEdge(SET(0.5), SET(Math.min(v, 1)), STATED_POSITIVE).label)
        }
        expect([...seen].sort()).toEqual(['Strong boost', 'Strong boost (uncertain)'])
      })
    })

    describe('Missing likelihood', () => {
      /**
       * ⭐ AN UNSET LIKELIHOOD IS NOT A LOW ONE, AND THIS BLOCK USED TO ASSERT
       * THAT IT WAS. "(uncertain)" is a verdict about a number we hold; saying
       * it about a number nobody supplied is a claim we are not entitled to.
       * On the 3 Sep 2026 capture that distinction was the whole defect: the
       * label read `edgeData.belief`, which no live writer sets, so all 24
       * edges said "(uncertain)" while the popover beside them said
       * "80% confident" off `beliefExists`.
       */
      it('names an unset likelihood as unset, never as uncertain', () => {
        // Strength fixtures and the "(likelihood not set)" qualifier are
        // unchanged; only the adjective is re-derived (0.9 → Very strong,
        // 0.5 → Strong, 0.2 → Moderate).
        expect(describeEdge(SET(0.9), LIKELIHOOD_NOT_SET, STATED_POSITIVE).label).toBe('Very strong boost (likelihood not set)')
        expect(describeEdge(SET(0.5), LIKELIHOOD_NOT_SET, STATED_POSITIVE).label).toBe('Strong boost (likelihood not set)')
        expect(describeEdge(SET(0.2), LIKELIHOOD_NOT_SET, STATED_POSITIVE).label).toBe('Moderate boost (likelihood not set)')
        expect(describeEdge(SET(-0.9), LIKELIHOOD_NOT_SET, STATED_NEGATIVE).label).toBe('Very strong drag (likelihood not set)')
      })

      it('reserves "(uncertain)" for a likelihood that was SET and is low', () => {
        // The discriminating pair: same strength, same direction, two
        // likelihood states, two different sentences. Still discriminating —
        // the two expectations differ in the SAME clause they always did.
        expect(describeEdge(SET(0.9), SET(0.4), STATED_POSITIVE).label).toBe('Very strong boost (uncertain)')
        expect(describeEdge(SET(0.9), LIKELIHOOD_NOT_SET, STATED_POSITIVE).label).toBe('Very strong boost (likelihood not set)')
      })

      it('provides tooltip even when belief is missing', () => {
        const result = describeEdge(SET(0.6), LIKELIHOOD_NOT_SET, STATED_POSITIVE)
        expect(result.tooltip).toContain('Weight: 0.60')
        expect(result.tooltip).toContain('not set')
      })
    })

    describe('Zero weight', () => {
      it('treats zero weight as slight boost', () => {
        // 0 < 0.20 → "Slight", the canonical table's bottom band. The old
        // vocabulary's bottom band was "Weak"; the behaviour (a stated zero is
        // still a stated strength, so it gets a band word) is unchanged.
        expect(describeEdge(SET(0), SET(0.8), STATED_POSITIVE).label).toBe('Slight boost')
      })
    })
  })

  describe('formatNumericLabel', () => {
    it('formats positive weight with belief', () => {
      expect(formatNumericLabel(SET(0.6), SET(0.85), STATED_POSITIVE)).toBe('w 0.60 • b 85%')
    })

    it('formats negative weight with belief using proper minus sign', () => {
      expect(formatNumericLabel(SET(-0.6), SET(0.85), STATED_NEGATIVE)).toBe('w −0.60 • b 85%')
    })

    it('formats weight without belief', () => {
      expect(formatNumericLabel(SET(0.6), LIKELIHOOD_NOT_SET, STATED_POSITIVE)).toBe('w 0.60')
    })

    it('rounds belief to nearest integer percentage', () => {
      expect(formatNumericLabel(SET(0.5), SET(0.856), STATED_POSITIVE)).toBe('w 0.50 • b 86%')
      expect(formatNumericLabel(SET(0.5), SET(0.854), STATED_POSITIVE)).toBe('w 0.50 • b 85%')
    })

    it('formats weight to 2 decimal places', () => {
      expect(formatNumericLabel(SET(0.123456), SET(0.8), STATED_POSITIVE)).toBe('w 0.12 • b 80%')
    })
  })

  describe('getEdgeLabelMode', () => {
    it('returns "human" by default when localStorage is empty', () => {
      expect(getEdgeLabelMode()).toBe('human')
    })

    it('returns "numeric" when stored in localStorage', () => {
      localStorage.setItem('canvas.edge-labels-mode', 'numeric')
      expect(getEdgeLabelMode()).toBe('numeric')
    })

    it('returns "human" for invalid stored values', () => {
      localStorage.setItem('canvas.edge-labels-mode', 'invalid')
      expect(getEdgeLabelMode()).toBe('human')
    })

    it('returns "human" when localStorage is unavailable', () => {
      // This would require mocking localStorage, but the function handles it gracefully
      expect(getEdgeLabelMode()).toBe('human')
    })
  })

  describe('getEdgeLabel', () => {
    it('returns human label when mode is "human"', () => {
      const result = getEdgeLabel(SET(0.9), SET(0.9), STATED_POSITIVE, 'human')
      // 0.9 ≥ 0.70 → "Very strong". This test discriminates HUMAN from NUMERIC
      // mode; the adjective is incidental to it and simply follows the table.
      expect(result.label).toBe('Very strong boost')
      expect(result.tooltip).toContain('Weight: 0.90')
    })

    it('returns numeric label when mode is "numeric"', () => {
      const result = getEdgeLabel(SET(0.6), SET(0.85), STATED_POSITIVE, 'numeric')
      expect(result.label).toBe('w 0.60 • b 85%')
    })

    it('uses localStorage mode when mode parameter is not provided', () => {
      localStorage.setItem('canvas.edge-labels-mode', 'numeric')
      expect(getEdgeLabel(SET(0.6), SET(0.85), STATED_POSITIVE).label).toBe('w 0.60 • b 85%')

      localStorage.setItem('canvas.edge-labels-mode', 'human')
      // 0.9 ≥ 0.70 → "Very strong". These tests assert WHICH MODE is used, not
      // which band; the fixture is untouched and only the adjective follows the
      // canonical table.
      expect(getEdgeLabel(SET(0.9), SET(0.9), STATED_POSITIVE).label).toBe('Very strong boost')
    })

    it('defaults to human mode when localStorage is empty', () => {
      localStorage.clear()
      expect(getEdgeLabel(SET(0.9), SET(0.9), STATED_POSITIVE).label).toBe('Very strong boost')
    })
  })

  describe('Integration: Full workflow', () => {
    it('allows switching between human and numeric modes', () => {
      const weight = 0.6
      const belief = 0.85

      // Start in human mode (default). 0.6 ∈ [0.40, 0.70) → "Strong".
      expect(getEdgeLabel(SET(weight), SET(belief), STATED_POSITIVE).label).toBe('Strong boost')

      // Switch to numeric
      localStorage.setItem('canvas.edge-labels-mode', 'numeric')
      expect(getEdgeLabel(SET(weight), SET(belief), STATED_POSITIVE).label).toBe('w 0.60 • b 85%')

      // Switch back to human
      localStorage.setItem('canvas.edge-labels-mode', 'human')
      expect(getEdgeLabel(SET(weight), SET(belief), STATED_POSITIVE).label).toBe('Strong boost')
    })

    it('persists mode across function calls', () => {
      localStorage.setItem('canvas.edge-labels-mode', 'numeric')

      expect(getEdgeLabelMode()).toBe('numeric')
      expect(getEdgeLabel(SET(0.5), SET(0.8), STATED_POSITIVE).label).toBe('w 0.50 • b 80%')

      localStorage.setItem('canvas.edge-labels-mode', 'human')

      expect(getEdgeLabelMode()).toBe('human')
      // 0.5 ∈ [0.40, 0.70) → "Strong".
      expect(getEdgeLabel(SET(0.5), SET(0.8), STATED_POSITIVE).label).toBe('Strong boost')
    })
  })

  describe('V3 strength.mean → weight → label consistency', () => {
    it('strength.mean = 0.65 produces weight = 0.65 and "Strong boost" label', () => {
      // V3 edges: weight = abs(strength.mean), so 0.65 → 0.65
      // Strength band: 0.40 ≤ 0.65 < 0.70 → "Strong" (canonical table).
      // Direction: positive → "boost"
      const weight = 0.65 // as derived from abs(strength.mean)
      const result = describeEdge(SET(weight), SET(0.85), STATED_POSITIVE)
      expect(result.label).toBe('Strong boost')
    })

    it('strength.mean = 0.70 crosses into the "Very strong" band', () => {
      // 0.70 is the top cut, inclusive. This pair (0.65 / 0.70) is what makes
      // the two tests above a BOUNDARY pin rather than two interior points.
      const result = describeEdge(SET(0.70), SET(0.85), STATED_POSITIVE)
      expect(result.label).toBe('Very strong boost')
    })

    it('negative strength.mean = -0.65 produces "Strong drag"', () => {
      // ⚠ CORRECTED (ROADMAP 2.935). This comment used to read "describeEdge
      // receives the signed weight for label purposes". THAT WAS FALSE, and it
      // is the sentence that let the defect live for as long as it did: in the
      // canvas store `weight = abs(-0.65) = 0.65` and the sign lives in a
      // SEPARATE `direction` field, so `describeEdge` never received a signed
      // weight from the product at all. The magnitude and the direction are
      // passed separately below, exactly as the store holds them.
      const result = describeEdge(SET(0.65), SET(0.85), STATED_NEGATIVE)
      expect(result.label).toBe('Strong drag')
    })

    it('the same magnitude with the direction UNSTATED asserts no direction', () => {
      // The case the product actually hits on every edge whose producer sent
      // `effect_direction: 'unknown'` or omitted it — and the case this file
      // had no coverage for at all before 2.935.
      const result = describeEdge(SET(0.65), SET(0.85), NOT_STATED)
      expect(result.label).toBe('Strong effect, direction not stated')
      expect(result.label).not.toContain('boost')
      expect(result.label).not.toContain('drag')
    })

    it('the magnitude alone cannot produce a direction word', () => {
      // The gate's whole point: a caller passing a signed number does not get a
      // signed word. Same |w|, opposite signs, direction unstated → identical.
      expect(describeEdge(SET(-0.65), SET(0.85), NOT_STATED).label)
        .toBe(describeEdge(SET(0.65), SET(0.85), NOT_STATED).label)
    })

    it('an unstated direction prints no minus in the numeric channel either', () => {
      expect(formatNumericLabel(SET(-0.65), SET(0.85), NOT_STATED)).toBe('w 0.65 • b 85%')
      expect(formatNumericLabel(SET(0.65), SET(0.85), STATED_NEGATIVE)).toBe('w −0.65 • b 85%')
    })

    it('the tooltip sign tracks the STATED direction, not the argument sign', () => {
      expect(describeEdge(SET(0.65), SET(0.85), STATED_NEGATIVE).tooltip).toContain('Weight: −0.65')
      expect(describeEdge(SET(-0.65), SET(0.85), STATED_POSITIVE).tooltip).toContain('Weight: 0.65')
      expect(describeEdge(SET(-0.65), SET(0.85), NOT_STATED).tooltip).toContain('Weight: 0.65')
    })
  })

  /*
   * ⚠ THE FIXTURE VALUES IN THIS BLOCK ARE UNCHANGED — they are meant to be
   * plausible product numbers, so re-picking them to keep the old adjectives
   * would have destroyed the only thing the block is for. The comments beside
   * them named the OLD bands, and each one is now re-derived from the canonical
   * table rather than left describing a word the line no longer produces (an
   * honest label overwritten by a false one is CLAUDE.md trap 14).
   */
  describe('Real-world examples', () => {
    it('handles typical template edge weights', () => {
      // 0.8 ≥ 0.70 → Very strong.
      expect(describeEdge(SET(0.8), SET(0.9), STATED_POSITIVE).label).toBe('Very strong boost')

      // 0.5 ∈ [0.40, 0.70) → Strong.
      expect(describeEdge(SET(0.5), SET(0.8), STATED_POSITIVE).label).toBe('Strong boost')

      // |−0.2| = 0.20, the Moderate cut exactly → Moderate.
      expect(describeEdge(SET(-0.2), SET(0.7), STATED_NEGATIVE).label).toBe('Moderate drag')

      // |−0.9| ≥ 0.70 → Very strong, with the likelihood hedge unchanged.
      expect(describeEdge(SET(-0.9), SET(0.5), STATED_NEGATIVE).label).toBe('Very strong drag (uncertain)')
    })

    it('provides meaningful labels for user-edited weights', () => {
      // A user who clicks the "Very strong" pill writes 0.85 and reads "Very
      // strong" back on the panel. Before this change the chip said "Strong",
      // i.e. the canvas contradicted the button the user had just pressed.
      expect(describeEdge(SET(0.95), SET(0.95), STATED_POSITIVE).label).toBe('Very strong boost')

      // 0.45 ∈ [0.40, 0.70) → Strong.
      expect(describeEdge(SET(0.45), SET(0.4), STATED_POSITIVE).label).toBe('Strong boost (uncertain)')

      // |−0.15| < 0.20 → Slight, the band the old vocabulary had no word for.
      expect(describeEdge(SET(-0.15), SET(0.75), STATED_NEGATIVE).label).toBe('Slight drag')
    })
  })

  describe('ROADMAP 2.950 — an unset strength produces no band adjective', () => {
    it('direction stated, strength unset: the stated half speaks, the unset half says so', () => {
      expect(describeEdge(STRENGTH_NOT_SET, SET(0.85), STATED_POSITIVE).label).toBe('Boost, strength not set')
      expect(describeEdge(STRENGTH_NOT_SET, SET(0.85), STATED_NEGATIVE).label).toBe('Drag, strength not set')
    })

    it('the uncertainty qualifier still rides the direction claim', () => {
      expect(describeEdge(STRENGTH_NOT_SET, SET(0.4), STATED_NEGATIVE).label).toBe('Drag, strength not set (uncertain)')
      expect(describeEdge(STRENGTH_NOT_SET, LIKELIHOOD_NOT_SET, STATED_POSITIVE).label).toBe('Boost, strength not set (likelihood not set)')
    })

    it('NEITHER set: the ratified popover copy, byte-identical, with no qualifier', () => {
      // The exact `edge-hover-popover-unset` sentence — one phrase for one
      // concept across the label and the popover, per the row's brief. No
      // "(uncertain)" suffix: there is no claim for the likelihood channel to
      // qualify.
      expect(describeEdge(STRENGTH_NOT_SET, LIKELIHOOD_NOT_SET, NOT_STATED).label).toBe('Strength and likelihood not set')
    })

    /**
     * ⭐ THE SENTENCE NOW MATCHES ITS GATE. This copy names LIKELIHOOD, and the
     * predicate used to fire it on (strength unset AND direction unset) without
     * ever consulting one — because the label's only likelihood channel was the
     * dead legacy `belief`. With `beliefExists` resolved here, an edge carrying
     * a known 85% likelihood must not be told its likelihood is "not set": that
     * is the same class of false absence the strength gate was built to stop,
     * and the popover would at that moment be rendering "85% confident".
     */
    it('a KNOWN likelihood is not denied just because the strength is unset', () => {
      expect(describeEdge(STRENGTH_NOT_SET, SET(0.85), NOT_STATED).label).toBe('Strength not set')
      // Discriminating twin: drop the likelihood and the fuller sentence returns.
      expect(describeEdge(STRENGTH_NOT_SET, LIKELIHOOD_NOT_SET, NOT_STATED).label).toBe('Strength and likelihood not set')
    })

    it('…and a known LOW likelihood on that same arm is hedged, not dropped', () => {
      // ⚠ THIS ARM WAS REACHABLE AND PINNED NOWHERE. `rg` returned zero hits for
      // 'Strength not set (uncertain)' across the whole repo: the `>= cut` twin
      // above was covered, the `< cut` one was not, so the qualifier could have
      // been dropped from this arm — or the arm deleted — with the suite green.
      //
      // Reached whenever the strength and direction are unset but the producer
      // stamped a likelihood below the hedge cut. It is not hypothetical: CEE
      // stamps `exists_probability` on edges whose `strength_mean` never
      // arrives, and the EdgePanel slider writes any value in [0, 1].
      expect(describeEdge(STRENGTH_NOT_SET, SET(0.4), NOT_STATED).label).toBe(
        'Strength not set (uncertain)',
      )
      // Discriminating twin, bound to the CUT rather than to the arm: the same
      // fixture one step above the cut must lose the qualifier. Without this a
      // mutant that appended "(uncertain)" unconditionally would survive.
      expect(describeEdge(STRENGTH_NOT_SET, SET(LABEL_HEDGE_CUT), NOT_STATED).label).toBe(
        'Strength not set',
      )
    })

    it("the display's REASON does not change the sentence — absent and not_set read alike", () => {
      expect(describeEdge(STRENGTH_ABSENT, LIKELIHOOD_NOT_SET, NOT_STATED).label)
        .toBe(describeEdge(STRENGTH_NOT_SET, LIKELIHOOD_NOT_SET, NOT_STATED).label)
      expect(describeEdge(STRENGTH_ABSENT, SET(0.85), STATED_NEGATIVE).label)
        .toBe(describeEdge(STRENGTH_NOT_SET, SET(0.85), STATED_NEGATIVE).label)
    })

    it('the tooltip prints "not set" and NEVER a number or a sign for an unset strength', () => {
      // No minus even for a stated negative: the sign decorates a number, and
      // there is no number we are entitled to print.
      expect(describeEdge(STRENGTH_NOT_SET, SET(0.85), STATED_NEGATIVE).tooltip).toBe('Weight: not set, Belief: 85%')
      expect(describeEdge(STRENGTH_NOT_SET, LIKELIHOOD_NOT_SET, NOT_STATED).tooltip).toBe('Weight: not set, Belief: not set')
    })

    it('the numeric channel says "w not set" and never prints the fabricated constant', () => {
      expect(formatNumericLabel(STRENGTH_NOT_SET, SET(0.85), STATED_NEGATIVE)).toBe('w not set • b 85%')
      expect(formatNumericLabel(STRENGTH_NOT_SET, LIKELIHOOD_NOT_SET, NOT_STATED)).toBe('w not set')
    })

    it('getEdgeLabel routes the gate through both modes', () => {
      expect(getEdgeLabel(STRENGTH_NOT_SET, LIKELIHOOD_NOT_SET, NOT_STATED, 'human').label).toBe('Strength and likelihood not set')
      expect(getEdgeLabel(STRENGTH_NOT_SET, LIKELIHOOD_NOT_SET, NOT_STATED, 'numeric').label).toBe('w not set')
    })
  })

  /**
   * ⭐⭐ THE LONGEST SENTENCE THIS VOCABULARY CAN PRODUCE — ENUMERATED, BECAUSE
   * SOMETHING DOWNSTREAM HAS TO PAINT IT IN A FIXED-WIDTH BOX.
   *
   * ⚠ THIS BLOCK EXISTS BECAUSE ANOTHER FILE ALREADY CITED IT AND IT WAS NOT
   * HERE. `edges/__tests__/StyledEdge.labelRecoverable.spec.tsx` says of its own
   * 58-character pin: *"That the vocabulary can produce nothing longer is
   * asserted by exhaustive enumeration in `domain/__tests__/edgeLabels.spec.ts`,
   * which is where the vocabulary lives"*. No such enumeration existed. A
   * cross-reference to a guard that is not there reads exactly like a guard that
   * is (CLAUDE.md trap 12), and it is how that file's "longest" claim survived
   * being made false by a band word getting longer.
   *
   * ⚠ AND IT IS NOW FALSE BY 3 CHARACTERS. Widening the top band's word from
   * "Strong" to "Very strong" moved the longest sentence from 58 to 61. That is
   * a REPORTED consequence of this change, not a fixed one: the canvas chip's
   * width is `StyledEdge.tsx`'s, which this lane does not touch.
   *
   * ⚠ ENUMERATED, NOT REASONED. The maximum is taken by running `describeEdge`
   * over the product of every band, every direction state and every likelihood
   * state, so a new clause or a longer word cannot be argued past it.
   */
  describe('the vocabulary\'s longest sentence', () => {
    it('is "Very strong effect, direction not stated (likelihood not set)", 61 characters', () => {
      const magnitudes = [0, 0.19, 0.2, 0.39, 0.4, 0.69, 0.7, 1]
      const strengths: EdgeValueDisplay[] = [...magnitudes.map(SET), STRENGTH_NOT_SET, STRENGTH_ABSENT]
      const likelihoods: EdgeValueDisplay[] = [SET(0), SET(0.4), SET(LABEL_HEDGE_CUT), SET(1), LIKELIHOOD_NOT_SET]
      const directions = [STATED_POSITIVE, STATED_NEGATIVE, NOT_STATED]

      let longest = ''
      for (const strength of strengths) {
        for (const likelihood of likelihoods) {
          for (const direction of directions) {
            const { label } = describeEdge(strength, likelihood, direction)
            if (label.length > longest.length) longest = label
          }
        }
      }

      expect(longest).toBe('Very strong effect, direction not stated (likelihood not set)')
      expect(longest.length).toBe(61)
      // The figure `labelRecoverable.spec.tsx` pins, kept here so the 3-character
      // growth is visible in the file that owns the vocabulary rather than
      // inferred from two numbers in two places.
      expect('Moderate effect, direction not stated (likelihood not set)'.length).toBe(58)
    })

    it('the top band is the longest WORD, which is what made the sentence grow', () => {
      // Bound to the table, not to a re-typed list: the longest label comes from
      // the longest band word, so a future band word that is longer still fails
      // the assertion above and lands here as the explanation.
      const words = [0, 0.25, 0.5, 0.85].map(getStrengthLabel)
      expect(words).toEqual(['Slight', 'Moderate', 'Strong', 'Very strong'])
      expect(words.reduce((a, b) => (b.length > a.length ? b : a))).toBe('Very strong')
    })
  })
})

/**
 * ⭐ THE HEDGE CUT AND THE BAND CUTS ARE TWO ANSWERS TO TWO QUESTIONS, AND THE
 * DIVERGENCE IS PINNED HERE SO IT CANNOT DRIFT SILENTLY.
 *
 * Before this label read `beliefExists`, the `< 0.6` literal was applied to
 * `data.belief` — which no live writer sets — so it was unreachable dead
 * arithmetic and disagreeing with the band registry cost nothing. It is LIVE
 * now, on the same field `EDGE_VALUE_BAND_CUTS` bands, whose own header exists
 * because those cuts were once a hand-copied literal in three places.
 *
 * ⚠ ONE consumer, not three. An earlier draft of this block said "three other
 * surfaces band with `EDGE_VALUE_BAND_CUTS`". Swept `src/` excluding
 * `__tests__`: the registry's only non-test reader is `EdgePanel.tsx:230`, via
 * `edgeValueBand`. `RelationshipsSection` bands the same field with a
 * hand-copied `>= 70 / >= 40` on the ROUNDED percentage — a THIRD scale, not
 * pinned here and not this lane's to change (see `LABEL_HEDGE_CUT`'s header).
 *
 * These tests do NOT assert that the two agree — they must not, they answer
 * different questions (see `LABEL_HEDGE_CUT`'s header). They assert that the
 * disagreement is the one we decided on, so that moving either number REDs and
 * forces the copy decision to be taken deliberately.
 *
 * ⚠ AND THE DISAGREEMENT IS ASSERTED BY CALLING BOTH SIDES. An earlier draft
 * asserted only that the fixture values sat in the right numeric windows and
 * left "the inspector bands this moderate" in a COMMENT. That could not see a
 * change to `edgeValueBand` itself — proved by mutant M2 below, which makes it
 * band 0.45 as `high` while every numeric-relation assertion stays green. The
 * numeric-relation assertions are KEPT (they bind to the cut constants, which
 * the band call alone would not), and the band call is added beside them: the
 * two bind to different things and neither replaces the other.
 */
describe('LABEL_HEDGE_CUT vs EDGE_VALUE_BAND_CUTS — a named divergence, not a drifted mirror', () => {
  it('is the value the bare literal had, unchanged by being named', () => {
    expect(LABEL_HEDGE_CUT).toBe(0.6)
  })

  it('sits strictly between the two band cuts — so it can equal neither', () => {
    // Bound by RELATION, not by three bare numbers: this keeps biting if the
    // band registry moves, which is the drift the pin exists for.
    expect(LABEL_HEDGE_CUT).toBeGreaterThan(EDGE_VALUE_BAND_CUTS.moderate)
    expect(LABEL_HEDGE_CUT).toBeLessThan(EDGE_VALUE_BAND_CUTS.high)
  })

  it('names the two windows where the label and the inspector disagree', () => {
    // ⚠ THIS IS A REACHABLE COPY INCONSISTENCY, PINNED RATHER THAN HIDDEN —
    // and it IS ROWED, as S58 in `CANVAS-BACKLOG.md`
    // (`Talchain/olumi-programme-docs`, `origin/main`), which names the same
    // two windows this test walks. See `LABEL_HEDGE_CUT`'s header for how the
    // claim came to be wrong twice.
    //
    // ⚠ THIS COMMENT SAID "NOT rowed anywhere … the only record of it", and
    // it was the SECOND of three instances of one false claim from a single
    // sweep. Left uncorrected it would have pointed a reader at
    // `LABEL_HEDGE_CUT`'s header — i.e. at its own refutation.
    // The EdgePanel existence slider reaches every value below.

    // [moderate, hedge): the inspector bands it MODERATE and the label hedges.
    // Both halves asserted by EXECUTION — `edgeValueBand` is the function
    // EdgePanel actually calls, so this binds to the inspector's verdict rather
    // than to a comment about it.
    const hedgedButBandedModerate = 0.45
    expect(edgeValueBand(SET(hedgedButBandedModerate))).toBe('moderate')
    expect(hedgedButBandedModerate).toBeGreaterThanOrEqual(EDGE_VALUE_BAND_CUTS.moderate)
    expect(hedgedButBandedModerate).toBeLessThan(LABEL_HEDGE_CUT)
    expect(describeEdge(SET(0.5), SET(hedgedButBandedModerate), NOT_STATED).label)
      .toMatch(/\(uncertain\)$/)

    // [hedge, high): the label says nothing; the inspector still says moderate.
    const unhedgedButBandedModerate = 0.65
    expect(edgeValueBand(SET(unhedgedButBandedModerate))).toBe('moderate')
    expect(unhedgedButBandedModerate).toBeGreaterThanOrEqual(LABEL_HEDGE_CUT)
    expect(unhedgedButBandedModerate).toBeLessThan(EDGE_VALUE_BAND_CUTS.high)
    expect(describeEdge(SET(0.5), SET(unhedgedButBandedModerate), NOT_STATED).label)
      .not.toMatch(/\(uncertain\)$/)

    // The divergence is that ONE band is split by the hedge cut. Pinned as the
    // joint state it is, so a future lane that moves either number sees the
    // consequence rather than a bare inequality: same band, opposite sentence.
    expect(edgeValueBand(SET(hedgedButBandedModerate)))
      .toBe(edgeValueBand(SET(unhedgedButBandedModerate)))
  })
})
