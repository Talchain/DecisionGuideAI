/**
 * INVENTED INTERVENTION PROVENANCE — both directions, one seam.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CLASS (CLAUDE.md §9 class 6 — "user value overwritten or misattributed")
 * ─────────────────────────────────────────────────────────────────────────────
 * `interventions[factorId].source` answers HOW THIS TARGET WAS DETERMINED. It
 * is a three-literal closed vocabulary (`brief_extraction | user_specified |
 * cee_hypothesis`) and there is NO literal meaning "the record does not say".
 *
 * CEE's `analysis_ready` snapshot carries interventions in EITHER shape — the
 * nested V3 object `{value, source, …}` OR a bare flattened number. Every
 * adapter in this repo handled the bare-number case by INVENTING a source, and
 * they did not agree on which one to invent:
 *
 *   · `ceeOptionToUIOption`          (adapter.ts)     → `'brief_extraction'`
 *   · `normaliseOptionFromCEE`       (types/options)  → `'brief_extraction'`
 *   · `normaliseOptionFromLegacyNode`(types/options)  → `'user_specified'`
 *
 * All three read a number that arrived with NO provenance and then stated one
 * with confidence. The two directions of the resulting lie are different harms
 * and CANNOT share one test window (standing brief §3, THE OPPOSITE-DIRECTION
 * TWIN):
 *
 *   DIRECTION 1 — an OLUMI number attributed to the USER.
 *       `node.data.interventions` is written verbatim by
 *       `backfillInterventionsOntoOptionNodes` from CEE's own `analysis_ready`
 *       (applyDraftResult.ts:588 — `interventions: optEntry.interventions`).
 *       When CEE sends the flattened form those land as bare numbers, and
 *       `normaliseOptionFromLegacyNode` stamped them `'user_specified'`, which
 *       `InterventionDisplay.formatSource` renders as **"you set this"** in the
 *       node inspector (`NodeInspector.tsx:153` → `:787`/`:838`).
 *
 *   DIRECTION 2 — an OLUMI number attributed to the USER'S OWN BRIEF.
 *       `ceeOptionToUIOption` stamped the same shape `'brief_extraction'`,
 *       which `getExtractionLabel` renders as **"From your brief"**.
 *
 * ⚠ NOTE THE SYMMETRY, because it is what makes this one defect rather than
 * two: ONE upstream shape (a bare number in `analysis_ready`) reaches TWO
 * adapters and is given TWO DIFFERENT, OPPOSITE attributions. Neither adapter
 * has any evidence for the one it picked.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE INVARIANT — WRITTEN AGAINST THE SPEC, NOT AGAINST THE FAILURE MODE
 * ─────────────────────────────────────────────────────────────────────────────
 * From the standing invariants (CLAUDE.md, "NO UNIVERSAL SEMANTIC FALLBACK"):
 *
 *   explicit user fact → PRESERVE IT · defensible Olumi estimate → the estimate
 *   WITH its provenance · genuinely unknown → UNKNOWN.
 *
 * So the assertion is NOT "it must not say `brief_extraction`" (that is the
 * failure mode). It is: **when the input carried no source, the output carries
 * no source** — absent, in either direction, for every adapter. `undefined` is
 * the fourth state, and `classifyInterventionProvenance(undefined)` already
 * returns `null`, which every honest reader renders as silence
 * (`ModelDetailRegion.tsx:85`, `InterventionRow.tsx:179`).
 *
 * And the other half, which a one-directional corpus would miss: when the input
 * DOES carry a source, it must survive verbatim — an honest fix that closes the
 * invention by erasing everything is the same defect pointing the other way.
 */
import { describe, it, expect } from 'vitest'
import { ceeOptionToUIOption } from '../adapter'
import {
  normaliseOptionFromCEE,
  normaliseOptionFromLegacyNode,
  type CEEOptionV3,
  type LegacyOptionNode,
} from '../../../../types/options'
import { classifyInterventionProvenance } from '../../../../canvas/domain/valueProvenance'

/**
 * A CEE option whose interventions arrived in the FLATTENED form — bare
 * numbers, no metadata of any kind. This is the shape `analysis_ready` uses and
 * the shape `backfillInterventionsOntoOptionNodes` writes onto canvas option
 * nodes verbatim.
 *
 * The cast is deliberate and is the point of the fixture: the declared type
 * says `Record<string, CEEInterventionV3>`, the wire sends numbers, and every
 * adapter under test has runtime code for exactly that divergence.
 */
function flattenedCeeOption(): CEEOptionV3 {
  return {
    id: 'opt_raise_price',
    label: 'Raise price',
    status: 'ready',
    interventions: { fac_price: 15 } as unknown as CEEOptionV3['interventions'],
  }
}

/** The same option in the NESTED form, carrying a real producer stamp. */
function nestedCeeOption(
  source: 'brief_extraction' | 'user_specified' | 'cee_hypothesis',
  valueConfidence?: 'high' | 'medium' | 'low',
): CEEOptionV3 {
  return {
    id: 'opt_raise_price',
    label: 'Raise price',
    status: 'ready',
    interventions: {
      fac_price: {
        value: 15,
        source,
        ...(valueConfidence ? { value_confidence: valueConfidence } : {}),
        reasoning: 'fixture',
      },
    },
  }
}

/**
 * A canvas option node holding interventions that CEE backfilled as bare
 * numbers. `node.data.interventions` is `Record<string, number>` by declared
 * type and the backfill writes CEE's map into it verbatim, so this IS the
 * production shape for a drafted option nobody has touched.
 */
function backfilledOptionNode(): LegacyOptionNode {
  return {
    id: 'opt_raise_price',
    type: 'option',
    data: {
      kind: 'option',
      label: 'Raise price',
      interventions: { fac_price: 15 },
    },
  }
}

describe('intervention provenance is never invented (class 6)', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // DIRECTION 1 — an Olumi number must never be attributed to the USER
  // ───────────────────────────────────────────────────────────────────────────
  describe("DIRECTION 1 — Olumi's number must not be labelled the user's", () => {
    it('normaliseOptionFromLegacyNode leaves a backfilled bare number UNATTRIBUTED, not "user_specified"', () => {
      const node = backfilledOptionNode()

      const option = normaliseOptionFromLegacyNode(node, new Set(['fac_price']))

      // Bind by IDENTITY — the target id, not "the one whose value is 15".
      const iv = option.interventions['fac_price']
      expect(iv, 'the fac_price intervention must survive normalisation').toBeDefined()
      expect(iv.value).toBe(15)

      // THE SPEC ASSERTION: no source in ⇒ no source out.
      expect(iv.source).toBeUndefined()

      // And the consequence a user actually sees: the shared classifier returns
      // null, so every honest surface renders silence rather than a claim.
      expect(classifyInterventionProvenance(iv.source)).toBeNull()
    })

    it('normaliseOptionFromLegacyNode leaves the node-value fallback UNATTRIBUTED too', () => {
      // Second write site in the same function — a distinct branch, and a fix
      // applied to one of them only would leave this one lying.
      const node: LegacyOptionNode = {
        id: 'opt_bare',
        type: 'option',
        data: { kind: 'option', label: 'Bare option', value: 0.4 },
      }

      const option = normaliseOptionFromLegacyNode(node, new Set(['opt_bare']))

      const iv = option.interventions['opt_bare']
      expect(iv, 'the self-targeted fallback intervention must survive').toBeDefined()
      expect(iv.value).toBe(0.4)
      expect(iv.source).toBeUndefined()
      expect(classifyInterventionProvenance(iv.source)).toBeNull()
    })

    it('a value the user genuinely specified is still attributed to the user', () => {
      // The opposite-direction guard on DIRECTION 1's own fix: stopping the
      // invention must not erase a real user claim. `user_specified` arriving
      // from CEE must survive both CEE adapters verbatim.
      for (const adapter of [ceeOptionToUIOption, normaliseOptionFromCEE]) {
        const option = adapter(nestedCeeOption('user_specified'))
        const iv = option.interventions['fac_price']
        expect(iv.source, `${adapter.name} must preserve user_specified`).toBe('user_specified')
        expect(classifyInterventionProvenance(iv.source)).toEqual({
          kind: 'edited',
          userOwned: true,
        })
      }
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // DIRECTION 2 — an Olumi number must never be attributed to the user's BRIEF
  // ───────────────────────────────────────────────────────────────────────────
  describe("DIRECTION 2 — Olumi's number must not be labelled the user's brief", () => {
    it('ceeOptionToUIOption leaves a flattened bare number UNATTRIBUTED, not "brief_extraction"', () => {
      const option = ceeOptionToUIOption(flattenedCeeOption())

      const iv = option.interventions['fac_price']
      expect(iv, 'the fac_price intervention must survive normalisation').toBeDefined()
      expect(iv.value).toBe(15)

      expect(iv.source).toBeUndefined()
      expect(classifyInterventionProvenance(iv.source)).toBeNull()
    })

    it('normaliseOptionFromCEE (the twin) leaves a flattened bare number UNATTRIBUTED too', () => {
      const option = normaliseOptionFromCEE(flattenedCeeOption())

      const iv = option.interventions['fac_price']
      expect(iv).toBeDefined()
      expect(iv.value).toBe(15)
      expect(iv.source).toBeUndefined()
      expect(classifyInterventionProvenance(iv.source)).toBeNull()
    })

    it("a value genuinely extracted from the user's brief keeps that attribution", () => {
      // The opposite-direction guard on DIRECTION 2's own fix.
      for (const adapter of [ceeOptionToUIOption, normaliseOptionFromCEE]) {
        const option = adapter(nestedCeeOption('brief_extraction'))
        const iv = option.interventions['fac_price']
        expect(iv.source, `${adapter.name} must preserve brief_extraction`).toBe('brief_extraction')
        expect(classifyInterventionProvenance(iv.source)).toEqual({
          kind: 'brief',
          userOwned: false,
        })
      }
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // The model's own estimate, and the confidence that qualifies it
  // ───────────────────────────────────────────────────────────────────────────
  describe("the model's own estimate keeps its provenance AND its uncertainty", () => {
    it('cee_hypothesis survives with its value_confidence — the qualifier is the point', () => {
      // Witnessed on the deployed build (valueProvenance.ts:232-239): every
      // `cee_hypothesis` entry on that draw carried `value_confidence: 'low'`.
      // A fix that preserved the source and dropped the confidence would leave
      // the model's weakest numbers looking as firm as its strongest.
      for (const adapter of [ceeOptionToUIOption, normaliseOptionFromCEE]) {
        const option = adapter(nestedCeeOption('cee_hypothesis', 'low'))
        const iv = option.interventions['fac_price']
        expect(iv.source, `${adapter.name} must preserve cee_hypothesis`).toBe('cee_hypothesis')
        expect(iv.value_confidence, `${adapter.name} must preserve value_confidence`).toBe('low')
        expect(classifyInterventionProvenance(iv.source)).toEqual({ kind: 'ai', userOwned: false })
      }
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // The seam-level statement: one input shape, one answer, across all adapters
  // ───────────────────────────────────────────────────────────────────────────
  it('all three adapters give the SAME answer to the same unattributed number', () => {
    // This is the assertion the estate did not have, and its absence is why the
    // three sites drifted to three different inventions. It is written over the
    // adapters as a SET so a fourth adapter cannot quietly disagree.
    const fromCeeAdapter = ceeOptionToUIOption(flattenedCeeOption()).interventions['fac_price']
    const fromCeeTwin = normaliseOptionFromCEE(flattenedCeeOption()).interventions['fac_price']
    const fromCanvas = normaliseOptionFromLegacyNode(
      backfilledOptionNode(),
      new Set(['fac_price']),
    ).interventions['fac_price']

    const answers = [fromCeeAdapter.source, fromCeeTwin.source, fromCanvas.source]
    expect(new Set(answers).size, `three adapters disagreed: ${JSON.stringify(answers)}`).toBe(1)
    expect(answers[0]).toBeUndefined()
  })
})
