/**
 * ⭐⭐ ONE NUMBER, ONE VERDICT — AND AN EXPLICIT, PINNED LIST OF WHERE THAT IS
 * STILL NOT TRUE.
 *
 * ── WHAT WAS MEASURED (9 Sep 2026, at `origin/staging`) ──────────────────────
 * `valueOfInformation` — "how much would better evidence on this factor help?" —
 * was classified by FIVE unrelated hand-written ladders:
 *
 *   src/canvas/ui/inspector-v2/panels/Factor{External,Observable,Controllable}Panel.tsx
 *        >= 0.7 High · >= 0.4 Medium · else Low        (SIX copies, two per file)
 *   src/canvas/nodes/FactorNode.tsx:386-387
 *        > 0.20 AND voiRank <= 3 -> 'critical' · > 0.05 -> 'warning' · else none
 *   src/components/results/analysis-hero/actOnIt/rankActOnItRows.ts:189-190
 *        >= 0.5 'High' · >= 0.2 'Medium'
 *   src/components/results/DriversSection.tsx:398
 *        > 0.05 -> show a quality hint
 *
 * The consequences are not stylistic. A factor at **voi = 0.25** is badged
 * **critical** on the canvas, called **Medium** on the analysis hero, and called
 * **Low** in the inspector — which adds *"Further investigation here is unlikely
 * to change the outcome."* One number, three surfaces, and two of the three
 * verdicts tell the user opposite things about what to do next. At **voi = 0.55**
 * the hero says **High** and the inspector says **Medium**: the same word, the
 * same concept, different cut points.
 *
 * ── WHAT THIS CHANGE DOES, AND DELIBERATELY DOES NOT DO ──────────────────────
 * It collapses the six copies in the three inspector panels into one authority
 * and pins the boundary here. It does NOT retune the boundary, and it does NOT
 * align the other ladders:
 *
 *  · `FactorNode`'s flag is RELATIVE — it consumes `voiRank <= 3`, "among the
 *    top few to look at". This module's ladder is ABSOLUTE, a level on 0-1. Those
 *    are different questions, and forcing one set of thresholds onto both would
 *    be reconciling two authorities that answer different things, which is how
 *    this estate produces its worst defects. What they may not do is CONTRADICT
 *    each other in front of a user, and that is a copy decision belonging to the
 *    option-node/spec owner. Reported on programme #38, not decided here.
 *  · `rankActOnItRows` and `DriversSection` live in `src/components/results/`,
 *    which is another lane's file ownership. Named here so they cannot go quiet;
 *    not edited.
 *
 * ── WHY A CENSUS AND NOT JUST BOUNDARY TESTS ─────────────────────────────────
 * Deriving a guard from a list moves the risk, it does not remove it (trap 12d).
 * Boundary tests prove this module is self-consistent; only a census proves a
 * SEVENTH copy has not appeared somewhere else in the canvas. It asserts the
 * divergent set EXACTLY, so it REDs if the set grows (a new hand-written ladder)
 * AND if it shrinks (someone changed `FactorNode` without revisiting the reason
 * recorded here). A gap recorded in the suite is honest; a gap invisible to it is
 * how six copies happened.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'
import {
  investigationValueTier,
  INVESTIGATION_VALUE_LABEL,
  INVESTIGATION_VALUE_BOUNDS,
  INVESTIGATION_VALUE_COMPARISON,
  INVESTIGATION_VALUE_STEM,
  INVESTIGATION_VALUE_TOP_RANK_NOTE,
} from '../investigationValue'

const ROOT = path.resolve(__dirname, '../../../..')
const CANVAS = path.join(ROOT, 'src/canvas')

describe('the tier is decided in one place', () => {
  it('places each value in the band the table declares', () => {
    // Written against the TABLE, not against the failure mode: every boundary
    // gets its own value, its neighbour just below, and one clearly inside.
    expect(investigationValueTier(1)).toBe('high')
    expect(investigationValueTier(0.7)).toBe('high')
    expect(investigationValueTier(0.69)).toBe('medium')
    expect(investigationValueTier(0.4)).toBe('medium')
    expect(investigationValueTier(0.39)).toBe('low')
    expect(investigationValueTier(0)).toBe('low')
  })

  it('refuses a non-finite score instead of scoring it as the bottom band', () => {
    // ⭐ THE DIRECTION MATTERS. Falling to 'low' would tell the user "further
    // investigation here is unlikely to change the outcome" — a confident
    // instruction derived from a malformed payload. `null` renders nothing.
    expect(investigationValueTier(Number.NaN)).toBeNull()
    expect(investigationValueTier(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('spells every band, so a new tier cannot render undefined', () => {
    for (const [tier] of INVESTIGATION_VALUE_BOUNDS) {
      expect(INVESTIGATION_VALUE_LABEL[tier], `no label for tier '${tier}'`).toBeTruthy()
    }
  })

  it('keeps "Medium" spelled out — `sensitivityTierLabel` says "Med"', () => {
    // Same 0.7/0.4 boundaries, different word, on cards a user reads side by
    // side. Unifying those two is a separate change (they describe different
    // quantities); this pins the spelling so it cannot drift while we wait.
    expect(INVESTIGATION_VALUE_LABEL.medium).toBe('Medium')
  })
})

describe('the tier may be spoken comparatively, never as a consequence', () => {
  /**
   * ⚠ A CORPUS, AND IT IS NAMED AS ONE. Deriving this list is not possible — the
   * property is "does this sentence assert a consequence in the world?", which no
   * derivation answers. So it is a hand-written corpus of the shapes that
   * over-claim, and its failure mode is a FALSE RED (someone writes "unlikely"
   * legitimately and has to justify it), which is the safe direction for a guard
   * over copy. `significantly improve` and `unlikely to change` are here because
   * both shipped; the rest are the neighbouring shapes an author reaches for next.
   */
  const ABSOLUTE_CONSEQUENCE = [
    /unlikely to change/i,
    /won'?t change/i,
    /not worth/i,
    /no point/i,
    /\bcritical\b/i,
    /significantly improve/i,
    /will improve/i,
  ]

  /**
   * ⚠ SCOPE, STATED. This guards the words the three panels now RENDER, because
   * after this change they render only these constants. It cannot see a new
   * hand-written sentence added beside them — that is what a reviewer is for.
   */
  const EVERY_RENDERED_STRING = [
    ...Object.values(INVESTIGATION_VALUE_COMPARISON),
    ...Object.values(INVESTIGATION_VALUE_STEM),
    INVESTIGATION_VALUE_TOP_RANK_NOTE,
    ...Object.values(INVESTIGATION_VALUE_LABEL),
  ]

  it('asserts no consequence in the world from an uncalibrated score', () => {
    for (const text of EVERY_RENDERED_STRING) {
      for (const banned of ABSOLUTE_CONSEQUENCE) {
        expect(
          banned.test(text),
          `"${text}" asserts a consequence (${banned}). The 0-1 score has no producer ` +
            'contract establishing it as calibrated absolute benefit, so a tier may ' +
            'COMPARE and attribute, and may not tell the reader what will happen.',
        ).toBe(false)
      }
    }
  })

  it('CONTRAST — the corpus can see an overclaim when one is there', () => {
    // The exact sentence this change removed. Without this the guard above would
    // pass just as well on a corpus of patterns that match nothing.
    const removed = 'Further investigation here is unlikely to change the outcome.'
    expect(ABSOLUTE_CONSEQUENCE.some(p => p.test(removed))).toBe(true)
  })

  it('attributes every claim to the model rather than to the world', () => {
    // Both stems open by naming whose estimate this is. A sentence that drops the
    // attribution reads as a fact about the factor.
    for (const stem of Object.values(INVESTIGATION_VALUE_STEM)) {
      expect(stem, `"${stem}" does not attribute the estimate`).toContain("this model's own estimate")
    }
    expect(INVESTIGATION_VALUE_TOP_RANK_NOTE).toContain('This model')
  })

  it('finishes the sentence — a stem ends open and a comparison closes it', () => {
    for (const stem of Object.values(INVESTIGATION_VALUE_STEM)) {
      expect(stem.endsWith(' '), `"${stem}" must end with a space to join its comparison`).toBe(true)
      expect(stem.trimEnd().endsWith('.'), `"${stem}" must not end the sentence itself`).toBe(false)
    }
    for (const tail of Object.values(INVESTIGATION_VALUE_COMPARISON)) {
      expect(tail.endsWith('.'), `"${tail}" must close the sentence`).toBe(true)
    }
  })
})

/** Every non-test source file under `src/canvas`, repo-relative. */
function canvasSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) canvasSources(full, out)
    else if (/\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry)) {
      out.push(path.relative(ROOT, full))
    }
  }
  return out
}

/**
 * A THRESHOLD, not a presence check. `f.voi > 0` asks "is there a value at all";
 * `voi > 0.05` draws a band. Only the second is a competing ladder, so the
 * numeric literal is captured and a zero is excluded — otherwise the census
 * would flag `useNodeDisplayMetadata`'s filter and the expected set would have
 * to carry an entry that is not a divergence at all.
 */
const THRESHOLD = /(?:valueOfInformation|\bvoi)\s*[><]=?\s*(\d*\.?\d+)/g

function hasOwnLadder(src: string, file = 'x.tsx'): boolean {
  // `stripComments` dispatches on EXTENSION — a `.tsx` file needs the JSX-aware
  // tokeniser so a `</` close is not read as a regex open. Passing the real
  // path is the difference between stripping comments and mangling the file.
  for (const m of stripComments(src, file).matchAll(THRESHOLD)) {
    if (Number(m[1]) !== 0) return true
  }
  return false
}

describe('census — where value-of-information is still classified locally', () => {
  /**
   * ⚠ EXACT, in both directions. Adding a file here is a decision that needs a
   * reason written beside it; removing one silently is how a divergence gets
   * forgotten rather than fixed.
   */
  const KNOWN_DIVERGENT = new Set([
    // RELATIVE, not absolute: this ladder consumes `voiRank <= 3` alongside the
    // magnitude, so it answers "is this among the top few to look at?" rather
    // than "what level is this?". It is a genuinely different question and is
    // NOT to be aligned by matching numbers — but at voi = 0.25 it badges
    // 'critical' while the inspector says 'Low'. The contradiction is real and
    // is the option-node/spec owner's copy decision (programme #38).
    'src/canvas/nodes/FactorNode.tsx',
  ])

  it('finds no ladder outside the reasoned exceptions', () => {
    const files = canvasSources(CANVAS)
    // PRECONDITION PINNED IN-TEST: a sweep that walked nothing agrees with every
    // other sweep that walked nothing (trap 13).
    expect(files.length, 'the census walked no files').toBeGreaterThan(100)

    const found = files
      .filter(f => hasOwnLadder(readFileSync(path.join(ROOT, f), 'utf8'), f))
      .sort()

    expect(found).toEqual([...KNOWN_DIVERGENT].sort())
  })

  it('CONTRAST — the census can see a ladder when one is there', () => {
    // Without this the assertion above passes just as well on a regex that
    // matches nothing, which is the shape of every false zero in this estate.
    expect(hasOwnLadder("if (voi > 0.05) return 'warning'", 'a.ts')).toBe(true)
    expect(hasOwnLadder('displayMetadata.valueOfInformation >= 0.7', 'a.tsx')).toBe(true)
    // …and does not mistake a presence check for one.
    expect(hasOwnLadder('f.voi > 0', 'a.ts')).toBe(false)
    // …and is not fooled by a threshold that only appears in prose.
    expect(hasOwnLadder('// the old ladder was voi > 0.20\nconst x = 1', 'a.ts')).toBe(false)
  })
})
