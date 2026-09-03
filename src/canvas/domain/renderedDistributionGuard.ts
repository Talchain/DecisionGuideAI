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

/** Stable distinct-count over mixed primitives, with `undefined` a real member. */
function distinctCount(values: readonly unknown[]): number {
  return new Set(values.map((v) => JSON.stringify(v ?? null))).size
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

    const sourceDistinct = distinctCount(sample.source)
    const renderedDistinct = distinctCount(sample.rendered)

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
