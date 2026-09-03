/**
 * renderedDistributionGuard — "the user is looking at 24 edges and every one of
 * them says the same thing. Is that the graph, or is it a broken instrument?"
 *
 * WHY THIS EXISTS
 * ---------------
 * On 3 Sep 2026 a founder drove staging by hand and asked why every edge showed
 * the same confidence. The debug bundle answered him: `beliefStrength` was
 * `0.5` on all 24 edges — `DEFAULT_EDGE_DATA.beliefStrength`, a UI constant —
 * while `strength_mean` beside it carried ten distinct values and
 * `exists_probability` carried two. A renderer bound to the constant would have
 * painted one number 24 times and looked, to every test in the suite, exactly
 * like a graph whose edges genuinely agree.
 *
 * THE PREDICATE, AND WHY IT IS A COMPARISON AND NOT A COUNT
 * --------------------------------------------------------
 * "The rendered values are all identical" is NOT a defect on its own: a graph
 * whose edges really do share a strength must be allowed to say so, and a
 * two-edge graph will collapse constantly and innocently. A count-based rule
 * would fire on those and be switched off within a week.
 *
 * The defect is the DISAGREEMENT between the two:
 *
 *     the source field VARIES, and the thing the user sees DOES NOT.
 *
 * That is only ever an instrument failure — a renderer reading a different
 * field from the one carrying the signal, or reading a default. It cannot be
 * produced by honest data, because a rendering that tracks its source cannot be
 * flatter than its source.
 *
 * ⚠ THE GUARD IS SCOPED TO WHAT IT IS POINTED AT. It certifies the channels a
 * caller hands it, over the corpus a caller hands it, and says nothing about a
 * channel nobody sampled. Its value comes from the corpus being a REAL CAPTURE
 * rather than a fixture written from the author's head — an intuited corpus
 * reproduces the author's model of the producer, which is how a constant hides
 * in the first place. See `__fixtures__/manual-test-2026-09-03.edges.json`.
 */

/** One rendered channel, sampled across a corpus of edges. */
export interface RenderedChannelSample {
  /** Human name for the channel, used in the failure message. */
  channel: string
  /**
   * The underlying values the channel is SUPPOSED to track, one per edge, in
   * corpus order. `undefined` is a legitimate member (an absent field is a
   * distinct state from a present one).
   */
  source: readonly unknown[]
  /**
   * What the user actually sees for the same edges, in the same order —
   * the rendered string or number, or `null` where the surface renders nothing.
   */
  rendered: readonly unknown[]
}

export interface DegenerateChannel {
  channel: string
  /** How many distinct values the source carried across the corpus. */
  sourceDistinct: number
  /** The single value every edge rendered. */
  renderedValue: unknown
  reason: string
}

/* ────────────────────────────────────────────────────────────────────────────
 * TWO DISTINCT-COUNTS, BECAUSE THE TWO SIDES ASK DIFFERENT QUESTIONS
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠ There was ONE `distinctCount` here, keyed `JSON.stringify(v ?? null)`. That
 * key maps `undefined`, `null` AND `NaN` all to the string `"null"`, so the
 * three collapsed into one bucket on BOTH sides — while the `source` field's
 * own doc above promised that "an absent field is a distinct state from a
 * present one", and a test named `treats an absent source value as a distinct
 * state, not as equal to null` passed on a corpus that contained no `null` at
 * all. Measured on the predecessor: `distinctCount([undefined, null]) === 1`
 * and `distinctCount([NaN, null]) === 1`. The comment and the test name were
 * both claims, and both were false.
 *
 * The two sides are NOT one question (CLAUDE.md trap 21 — one name, two
 * questions; the fix is to name them apart, not to align them):
 *
 *   · SOURCE — "how many different facts did the producer supply?" An absent
 *     field, a field explicitly `null`, and a `NaN` are three different
 *     producer states. Collapsing them lets "this field is MISSING on half the
 *     corpus" masquerade as "this field is CONSTANT", which is exactly the
 *     disagreement this guard exists to detect.
 *
 *   · RENDERED — "how many different things did the USER see?" A cell that
 *     rendered `undefined` and a cell that rendered `null` both painted
 *     NOTHING: one user-visible fact, not two. Separating them here would make
 *     the guard fall SILENT on a genuinely flat surface — the failure direction
 *     that costs a defect rather than a false alarm. A rendered `NaN` is NOT in
 *     that bucket: "b NaN%" is a number painted on screen, not an empty cell.
 *
 * The asymmetry is deliberate, and `edgeRenderedDistribution.capture.spec.ts`
 * pins it in BOTH directions — the source side must separate, the rendered side
 * must not. One test alone would leave the other direction free to drift.
 */

/**
 * Bucket key for a SOURCE value. `tag:` and `json:` cannot collide: every
 * `JSON.stringify` result is prefixed, so no payload can spell a tag.
 */
function sourceKey(value: unknown): string {
  if (value === undefined) return 'tag:absent'
  if (value === null) return 'tag:null'
  if (typeof value === 'number' && Number.isNaN(value)) return 'tag:nan'
  return `json:${JSON.stringify(value)}`
}

/** Bucket key for a RENDERED value — both spellings of "painted nothing" are one. */
function renderedKey(value: unknown): string {
  if (value === undefined || value === null) return 'tag:nothing-painted'
  if (typeof value === 'number' && Number.isNaN(value)) return 'tag:nan'
  return `json:${JSON.stringify(value)}`
}

/** How many different facts the producer supplied across the corpus. */
function distinctSourceCount(values: readonly unknown[]): number {
  return new Set(values.map(sourceKey)).size
}

/** How many different things the user saw across the corpus. */
function distinctRenderedCount(values: readonly unknown[]): number {
  return new Set(values.map(renderedKey)).size
}

/**
 * Find every channel whose SOURCE varies while its RENDERING is constant.
 *
 * Returns `[]` when every channel tracks its source — including the honest
 * cases where both are constant, and where the corpus is too small to say
 * anything (fewer than two edges).
 */
export function findDegenerateRenderedChannels(
  samples: readonly RenderedChannelSample[],
): DegenerateChannel[] {
  const out: DegenerateChannel[] = []

  for (const sample of samples) {
    if (sample.source.length !== sample.rendered.length) {
      throw new Error(
        `renderedDistributionGuard: channel "${sample.channel}" sampled ` +
          `${sample.source.length} source values against ${sample.rendered.length} ` +
          `rendered values. A misaligned sample cannot support either verdict.`,
      )
    }
    // Fewer than two edges cannot distinguish "constant" from "one data point".
    if (sample.source.length < 2) continue

    const sourceDistinct = distinctSourceCount(sample.source)
    const renderedDistinct = distinctRenderedCount(sample.rendered)

    if (sourceDistinct > 1 && renderedDistinct === 1) {
      out.push({
        channel: sample.channel,
        sourceDistinct,
        renderedValue: sample.rendered[0],
        reason:
          `the source carried ${sourceDistinct} distinct values across ` +
          `${sample.source.length} edges, but every edge rendered ` +
          `${JSON.stringify(sample.rendered[0] ?? null)}. A rendering cannot be ` +
          `flatter than its source unless it is reading something else.`,
      })
    }
  }

  return out
}

/**
 * Throwing form, for a caller that wants the failure to be loud rather than
 * returned. The message names every offending channel, because a run that
 * reports one of three degenerate channels invites fixing one and moving on.
 */
export function assertRenderedDistributionsTrackSource(
  samples: readonly RenderedChannelSample[],
): void {
  const degenerate = findDegenerateRenderedChannels(samples)
  if (degenerate.length === 0) return

  const detail = degenerate
    .map((d) => `  · ${d.channel}: ${d.reason}`)
    .join('\n')
  throw new Error(
    `Rendered distribution does not track its source on ` +
      `${degenerate.length} channel(s):\n${detail}`,
  )
}
