/**
 * The canvas edge DOMAIN RESOLVERS, run over the REAL 3 Sep 2026 capture.
 *
 * ⚠ SCOPE FIRST, because the name invites the wrong reading: this spec runs the
 * resolvers and `getEdgeLabel`, NOT `StyledEdge`. It is blind to a change in the
 * component's wiring — demonstrated, see `resolveEdgeChannels`'s header below.
 *
 * WHY THIS CORPUS AND NOT A WRITTEN ONE
 * -------------------------------------
 * A founder drove staging by hand and asked why every edge showed the same
 * confidence. The capture is the answer, and it is the only corpus that can
 * contain the class nobody imagined: a fixture written here would encode this
 * author's model of CEE, which is exactly the model that produced the defect.
 * The fixture is a HISTORIC RECORD — append to it, never edit it to keep a test
 * green (CLAUDE.md trap 14b).
 *
 * WHAT THIS PINS
 * --------------
 * 1. The strength channel TRACKS `strength_mean` (it was already correct — the
 *    hypothesis that the canvas painted the dead `beliefStrength` constant is
 *    refuted here, by execution, and this spec is what keeps it refuted).
 * 2. The likelihood channel tracks `beliefExists`, the field CEE actually
 *    stamps — not the legacy `belief` scalar, which has no live writer and
 *    which made the label say "(uncertain)" on 24 edges out of 24 while the
 *    hover popover on the same edges said "80% confident".
 * 3. No rendered channel is flatter than its source (`renderedDistributionGuard`).
 */
import { describe, it, expect } from 'vitest'
import capture from './__fixtures__/manual-test-2026-09-03.edges.json'
import capture0906 from './__fixtures__/manual-test-2026-09-06.edges.json'
import { getEdgeLabel } from '../edgeLabels'
import {
  resolveEdgeSignedStrengthDisplay,
  resolveEdgeValueDisplay,
  resolveEdgeDirectionDisplay,
} from '../edgeValueProvenance'
import {
  findDegenerateRenderedChannels,
  assertRenderedDistributionsTrackSource,
  type RenderedChannelSample,
} from '../renderedDistributionGuard'

type CapturedEdge = Record<string, unknown> & { id: string }
const EDGES = capture.edges as unknown as CapturedEdge[]
const EDGES_0906 = capture0906.edges as unknown as CapturedEdge[]

/**
 * The DOMAIN RESOLVERS the canvas label and hover popover read, run per edge.
 *
 * ⚠ THIS IS NOT StyledEdge, AND THE HEADER THAT SAID "exactly StyledEdge's
 * wiring" WAS AN OVER-CLAIM — measured, not argued. Under two mutants that
 * fully reverted the production wiring in `StyledEdge.tsx` (the label reading
 * the legacy `belief` again; the label's likelihood channel switched to
 * `weight`), THIS SPEC STAYED GREEN while `StyledEdge.labelRecoverable` and
 * `StyledEdge.edgeLabelStrengthWords.2950` went red. A spec that cannot fail
 * when the code it claims to mirror is deleted is documentation, not a guard,
 * and a header promising otherwise is the kind of already-audited-looking
 * sentence nobody re-checks (CLAUDE.md trap 14).
 *
 * WHAT THIS SPEC IS FOR, stated at its true scope: the CORPUS. It is the only
 * place the real 3 Sep capture meets the resolvers, and its job is to answer
 * "over 24 real edges, does what the user sees track what CEE sent?" — a
 * question no hand-authored fixture can ask honestly.
 *
 * WHAT PINS THE COMPONENT: `edges/__tests__/StyledEdge.labelRecoverable.spec.tsx`
 * and `StyledEdge.edgeLabelStrengthWords.2950.spec.tsx` render the real
 * component and are what RED when the wiring moves. Do not read a green run
 * here as evidence about `StyledEdge.tsx`.
 */
function resolveEdgeChannels(data: CapturedEdge) {
  const strength = resolveEdgeSignedStrengthDisplay(data)
  const direction = resolveEdgeDirectionDisplay(data)
  const likelihood = resolveEdgeValueDisplay(data, 'beliefExists')
  return {
    humanLabel: getEdgeLabel(strength, likelihood, direction, 'human').label,
    numericLabel: getEdgeLabel(strength, likelihood, direction, 'numeric').label,
    popoverStrengthPct: strength.show ? Math.round(Math.abs(strength.value) * 100) : null,
    popoverConfidencePct: likelihood.show ? Math.round(likelihood.value * 100) : null,
  }
}

describe('canvas edge rendering over the 3 Sep 2026 capture', () => {
  it('collects the whole captured corpus', () => {
    // Trap 2b: assert THIS spec's own corpus size by name. A fixture that
    // silently shrank would make every assertion below vacuous.
    expect(EDGES).toHaveLength(24)
  })

  it('renders no channel flatter than its source', () => {
    const rendered = EDGES.map(resolveEdgeChannels)

    const samples: RenderedChannelSample[] = [
      {
        channel: 'canvas edge label (human mode)',
        source: EDGES.map((e) => e.strength_mean),
        rendered: rendered.map((r) => r.humanLabel),
      },
      {
        channel: 'canvas edge label (numeric mode)',
        source: EDGES.map((e) => e.strength_mean),
        rendered: rendered.map((r) => r.numericLabel),
      },
      {
        channel: 'hover popover — strength %',
        source: EDGES.map((e) => e.strength_mean),
        rendered: rendered.map((r) => r.popoverStrengthPct),
      },
      {
        channel: 'hover popover — confidence %',
        source: EDGES.map((e) => e.exists_probability),
        rendered: rendered.map((r) => r.popoverConfidencePct),
      },
    ]

    assertRenderedDistributionsTrackSource(samples)
  })

  it('the strength the user sees tracks strength_mean, not a constant', () => {
    const pcts = EDGES.map((e) => resolveEdgeChannels(e).popoverStrengthPct)
    // The capture carries ten distinct strength_mean values; the rendering must
    // not collapse them. Bound by IDENTITY on the source, not by a bare count.
    expect(new Set(EDGES.map((e) => e.strength_mean)).size).toBe(10)
    expect(new Set(pcts).size).toBeGreaterThan(1)
    // Spot-bind three edges by id, so a renderer that varies for the WRONG
    // reason (reading some other varying field) still fails.
    const byId = new Map(EDGES.map((e, i) => [e.id, pcts[i]]))
    expect(byId.get('e-11')).toBe(21) // strength_mean 0.2111…
    expect(byId.get('e-12')).toBe(65) // strength_mean 0.65
    expect(byId.get('e-4')).toBe(35) // strength_mean 0.35
  })

  it('the label does not call every edge uncertain while the popover calls it 80% confident', () => {
    // The defect this spec was written for. `beliefExists` is 0.8 on every
    // causal edge in the capture and stamped `beliefExistsSource: 'cee'`, so
    // the label has a live likelihood to read and must not report "uncertain".
    const causal = EDGES.filter((e) => e.exists_probability === 0.8)
    expect(causal).toHaveLength(15)

    for (const e of causal) {
      const r = resolveEdgeChannels(e)
      expect(r.popoverConfidencePct).toBe(80)
      expect(r.humanLabel).not.toMatch(/uncertain/i)
      expect(r.humanLabel).not.toMatch(/not set/i)
    }
  })

  it('the numeric label reports the likelihood CEE stamped', () => {
    const causal = EDGES.filter((e) => e.exists_probability === 0.8)
    for (const e of causal) {
      expect(resolveEdgeChannels(e).numericLabel).toMatch(/• b 80%$/)
    }
  })
})

describe('renderedDistributionGuard — positive controls', () => {
  // Trap 13: an absence assertion is vacuous until it is shown it can SEE a
  // presence. These prove the guard fires, and fires for the right reason.

  it('FIRES on the actual 3 Sep defect: a varying source rendered as one constant', () => {
    // `beliefStrength` was 0.5 on all 24 captured edges while `strength_mean`
    // carried ten values. This is that pairing, from the real capture.
    const found = findDegenerateRenderedChannels([
      {
        channel: 'beliefStrength-as-strength',
        source: EDGES.map((e) => e.strength_mean),
        rendered: EDGES.map((e) => e.beliefStrength),
      },
    ])
    expect(found).toHaveLength(1)
    expect(found[0].channel).toBe('beliefStrength-as-strength')
    expect(found[0].sourceDistinct).toBe(10)
    expect(found[0].renderedValue).toBe(0.5)
  })

  it('FIRES on the legacy-belief label defect: 24 edges, one word', () => {
    const found = findDegenerateRenderedChannels([
      {
        channel: 'label-confidence-qualifier',
        source: EDGES.map((e) => e.exists_probability),
        rendered: EDGES.map(() => 'uncertain'),
      },
    ])
    expect(found).toHaveLength(1)
    expect(found[0].sourceDistinct).toBe(2)
  })

  it('is SILENT when a constant rendering has a constant source (the honest case)', () => {
    // The guard must not fire on a graph whose edges genuinely agree, or it
    // would be switched off within a week.
    expect(
      findDegenerateRenderedChannels([
        { channel: 'honest-constant', source: [0.5, 0.5, 0.5], rendered: ['50%', '50%', '50%'] },
      ]),
    ).toEqual([])
  })

  it('is SILENT when the rendering tracks a varying source', () => {
    expect(
      findDegenerateRenderedChannels([
        { channel: 'tracking', source: [0.2, 0.4, 0.6], rendered: ['20%', '40%', '60%'] },
      ]),
    ).toEqual([])
  })

  it('cannot report a verdict on a misaligned sample', () => {
    expect(() =>
      findDegenerateRenderedChannels([
        { channel: 'misaligned', source: [1, 2, 3], rendered: ['a'] },
      ]),
    ).toThrow(/misaligned sample cannot support either verdict/)
  })

  it('says nothing about a corpus too small to distinguish constant from single', () => {
    expect(
      findDegenerateRenderedChannels([
        { channel: 'one-edge', source: [0.3], rendered: ['30%'] },
      ]),
    ).toEqual([])
  })

  it('treats an absent source value as a distinct state, not as equal to null', () => {
    // ⚠ THIS TEST'S NAME WAS FALSE FOR ONE ROUND, AND THE FIXTURE IS WHY. It
    // asserted on `source: [undefined, 0.4]` — which contains no `null` at all,
    // so it discriminated on the `0.4` and would have passed identically had
    // `undefined` and `null` been the same bucket. They WERE: the guard keyed
    // `JSON.stringify(v ?? null)`, so `distinctCount([undefined, null]) === 1`.
    // A test name is a claim; this is the claim, and the source below is now
    // the ONLY thing separating the two counts.
    expect(
      findDegenerateRenderedChannels([
        { channel: 'absent-vs-null', source: [undefined, null], rendered: ['—', '—'] },
      ]),
    ).toHaveLength(1)
  })

  it('treats a NaN source as distinct from both an absent and a null one', () => {
    // The third spelling the old key swallowed: `JSON.stringify(NaN)` is
    // `"null"`, so a corpus that was half NaN read as constant.
    expect(
      findDegenerateRenderedChannels([
        { channel: 'nan-vs-null', source: [NaN, null], rendered: ['—', '—'] },
      ]),
    ).toHaveLength(1)
    expect(
      findDegenerateRenderedChannels([
        { channel: 'nan-vs-absent', source: [NaN, undefined], rendered: ['—', '—'] },
      ]),
    ).toHaveLength(1)
  })

  it('is SILENT when the source really is uniformly absent (the twin of the above)', () => {
    // ⭐ THE OPPOSITE-DIRECTION TWIN (CLAUDE.md trap 22b). Separating absent
    // from null buys a way to fire falsely: a channel whose source is missing
    // on EVERY edge is genuinely constant, and a guard that shouted at it would
    // be switched off within a week. Without this case the three above could be
    // satisfied by a key that simply makes everything distinct.
    expect(
      findDegenerateRenderedChannels([
        { channel: 'uniformly-absent', source: [undefined, undefined, undefined], rendered: ['—', '—', '—'] },
      ]),
    ).toEqual([])
    expect(
      findDegenerateRenderedChannels([
        { channel: 'uniformly-null', source: [null, null], rendered: ['—', '—'] },
      ]),
    ).toEqual([])
  })

  it('counts the RENDERED side the other way: two spellings of "painted nothing" are ONE state', () => {
    // ⭐ THE ASYMMETRY, PINNED. The source side must SEPARATE absent from null
    // (above); the rendered side must COLLAPSE them, because a cell rendering
    // `undefined` and a cell rendering `null` both painted nothing and the user
    // saw one flat surface. A symmetric key would fall SILENT here — the
    // failure direction that costs a defect rather than a false alarm.
    const found = findDegenerateRenderedChannels([
      { channel: 'nothing-painted-two-ways', source: [0.2, 0.9], rendered: [undefined, null] },
    ])
    expect(found).toHaveLength(1)
    expect(found[0].sourceDistinct).toBe(2)
  })

  it('a rendered NaN is a painted number, not an empty cell', () => {
    // "b NaN%" is on screen. It must not join the nothing-painted bucket, or a
    // surface that painted NaN beside a blank would read as flat.
    expect(
      findDegenerateRenderedChannels([
        { channel: 'nan-vs-blank', source: [0.2, 0.9], rendered: [NaN, null] },
      ]),
    ).toEqual([])
  })
})

/**
 * ⭐ A SECOND CORPUS, THREE DAYS LATER — because one capture certifies one day.
 *
 * The 3 Sep block above is the reason this guard exists. It is also, on its
 * own, a claim about ONE build: a channel that flattened afterwards would not
 * appear in it, and the suite would stay green for the wrong reason. Paul drove
 * staging by hand again on 6 Sep 2026 (UI `acd3db4d`) and that capture is now
 * pinned here beside the first.
 *
 * ⚠ IT IS APPENDED, NEVER SUBSTITUTED. Both corpora are historic records of
 * what the product actually emitted on a dated build; keeping only the newest
 * would delete the evidence that caught the original defect (CLAUDE.md trap
 * 14b — a dated capture is evidence, not a fixture to keep current).
 *
 * WHAT THIS CORPUS ADDS, and it is not a repeat of the first: this run reached
 * a COMPLETED display state with `builds.cee/plot/isl` all null and no compute
 * leg, so its edge values are CEE-drafted rather than analysis-derived. That is
 * a different production path through the same renderers, and nothing pinned it.
 */
describe('canvas edge rendering over the 6 Sep 2026 capture', () => {
  it('collects the whole captured corpus', () => {
    // Trap 2b: assert THIS corpus by name and size. The two corpora differ (24
    // vs 23 edges), so a copy-paste that pointed both blocks at one fixture
    // REDs here instead of quietly testing the same edges twice.
    expect(EDGES_0906).toHaveLength(23)
    expect(EDGES_0906).not.toBe(EDGES)
  })

  it('renders no channel flatter than its source', () => {
    const rendered = EDGES_0906.map(resolveEdgeChannels)

    const samples: RenderedChannelSample[] = [
      {
        channel: '0906 canvas edge label (human mode)',
        source: EDGES_0906.map((e) => e.strength_mean),
        rendered: rendered.map((r) => r.humanLabel),
      },
      {
        channel: '0906 canvas edge label (numeric mode)',
        source: EDGES_0906.map((e) => e.strength_mean),
        rendered: rendered.map((r) => r.numericLabel),
      },
      {
        channel: '0906 hover popover — strength %',
        source: EDGES_0906.map((e) => e.strength_mean),
        rendered: rendered.map((r) => r.popoverStrengthPct),
      },
      {
        channel: '0906 hover popover — confidence %',
        source: EDGES_0906.map((e) => e.exists_probability),
        rendered: rendered.map((r) => r.popoverConfidencePct),
      },
    ]

    assertRenderedDistributionsTrackSource(samples)
  })

  /**
   * ⚠ THE PRECONDITION, PINNED IN-TEST. Every assertion above is vacuous if the
   * corpus stopped VARYING — a flat source can never be rendered flatter than
   * itself, so the guard would pass by agreeing with itself (trap 13b). These
   * bind to the source distributions the 6 Sep capture actually carries.
   */
  it('the corpus varies, or the guard above proves nothing', () => {
    expect(new Set(EDGES_0906.map((e) => e.strength_mean)).size).toBe(9)
    expect(new Set(EDGES_0906.map((e) => e.exists_probability)).size).toBe(4)
  })

  /**
   * ⭐ THE KNOWN CONSTANT, PINNED AS A KNOWN CONSTANT.
   *
   * `beliefStrength` is `0.5` on all 23 edges — `DEFAULT_EDGE_DATA.beliefStrength`,
   * a UI constant — while `beliefExists` beside it carries four distinct values
   * CEE sourced. This is the exact shape the guard exists to catch, and it is
   * recorded here rather than fixed because the reader manifest says it reaches
   * NO live surface: the only renderer of it, `GraphTextView`, has no product
   * call site (its module is imported once, for `SectionErrorBoundary`), and the
   * field's other consumer is staleness hashing. A write-mostly field with no
   * live reader cannot mislead a user.
   *
   * ⚠⚠ THIS TEST DOES NOT DETECT A NEW READER, AND AN EARLIER VERSION OF THIS
   * COMMENT CLAIMED IT DID. Its entire input is two frozen JSON fixtures and
   * three pure domain modules — it observes no call site and no product module,
   * so if someone mounted `GraphTextView` tomorrow every test in this file would
   * stay green. An independent seat named that: a comment manufacturing a
   * guarantee the code does not provide.
   *
   * The guarantee now exists, derived, in
   * `beliefStrengthHasNoProductRenderer.spec.ts` — it walks the product tree and
   * REDs when any non-test file imports the component, with a contrast control
   * proving the probe can see importers at all.
   *
   * ⚠ AND THE FIGURE THAT COMMENT CARRIED WAS FALSE. "Its module is imported
   * once, for SectionErrorBoundary" — measured with no truncation, the module
   * has NINE importers (seven product files, all for `SectionErrorBoundary`).
   * It is the COMPONENT that has none in product code, and only that supports
   * the conclusion. The "once" came from a grep piped through `head -5`.
   *
   * What THIS test does, honestly stated: it records the constant's value in a
   * dated capture, so a future reader can see what it was.
   */
  it('beliefStrength is the flat UI default in this capture, beside four real values', () => {
    const distinct = new Set(EDGES_0906.map((e) => e.beliefStrength))
    expect(distinct.size).toBe(1)
    expect([...distinct][0]).toBe(0.5)
    // The contrast that makes this a finding and not a fact about the graph:
    // the field it sits beside is NOT flat.
    expect(new Set(EDGES_0906.map((e) => e.beliefExists)).size).toBe(4)
  })
})
