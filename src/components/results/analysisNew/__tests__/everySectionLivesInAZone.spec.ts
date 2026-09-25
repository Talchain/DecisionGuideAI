/**
 * EVERY SECTION LIVES IN A ZONE — the invariant the zone grammar never had.
 *
 * ## Why this is missing, and why that matters
 *
 * ⛔⛔ THE CLAIM THIS FILE SHIPPED WITH WAS FALSE, AND IS WITHDRAWN HERE.
 *
 * Its first version said *"no rule of the form 'every section lives in a zone'
 * exists anywhere"*. **One does.** `everySectionBelongsToAZone.spec.tsx` is a
 * DOM-derived rule with the SAME headline, and on the axis it covers it is
 * STRICTLY STRONGER than this file: it asks, of every child that actually
 * rendered, whether it is in a zone, and so it carries no list of sections at
 * all.
 *
 * ⚠ HOW THE MISS HAPPENED, because it is the estate's most expensive shape.
 * The recon grepped the invariant's wording and read `theZonesAreNamed`. The
 * existing rule is spelled **BelongsTo** where this one is spelled **LivesIn** —
 * differently-named twins for one concept (CLAUDE.md trap 21), and this file
 * CREATED the twin. Grepping for a name cannot find a file whose NAME is the
 * answer.
 *
 * ## So what does each one answer? (named apart, not reconciled)
 *
 * - **`everySectionBelongsToAZone`** — *of the sections that RENDERED on this
 *   fixture, is each one inside a zone?* DOM-derived, no section list, and the
 *   authority on zone membership. Bound by what its fixtures mount.
 * - **this file** — *of the components written at the top level of the body's
 *   SOURCE, does any sit ABOVE the first zone without being named as furniture?*
 *   State-independent, because it never renders: it sees a section whose data is
 *   absent on every fixture, which is exactly the state where a misplacement is
 *   easiest to miss.
 *
 * Neither supersedes the other and the overlap is real. Keeping both is a
 * decision, recorded here rather than argued again next time.
 *
 * ## The rest of the original rationale, which stands
 *
 * The four zones are **lexical `<div>` wrappers**. There is no dispatcher and no
 * registry — a section is in a zone only because its JSX happens to sit between
 * that zone's braces. `theZonesAreNamed` iterates a hardcoded four-zone list and
 * says nothing about their contents.
 *
 * ⛔ IT HAS ALREADY DRIFTED ONCE. The sensitivity section mounted OUTSIDE the
 * answer group while its own 36-line explaining comment sat INSIDE it — the
 * comment and the component on opposite sides of a `</div>`. It has since been
 * moved back in. **Nothing noticed either time**, because nothing was watching.
 *
 * ## What is asserted, and what is deliberately not
 *
 * This reads the BODY'S SOURCE, not a render. A render test would need every
 * section's data to be present at once to see them all, and the states where a
 * section is absent are exactly the states where a misplacement is easiest to
 * miss. The source is where the grammar actually lives.
 *
 * ⚠ THREE THINGS ARE LEGITIMATELY OUTSIDE THE ZONES, and they are named rather
 * than pattern-matched: the two warning strips and the model strip. They are
 * status FURNITURE that qualifies the whole panel, so they sit above the first
 * zone by design. Naming them means a FOURTH escapee REDs this spec instead of
 * quietly joining them.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const BODY = path.resolve(__dirname, '../AnalysisNewTabBody.tsx')

/**
 * Deliberately outside the zone grammar — status furniture about the WHOLE
 * panel, which is why it sits above the first zone rather than inside one.
 *
 * ⭐ V2 (Reasoning V2 recomposition, 24 Sep 2026) adds TWO, each named:
 * · `MethodStrip` — the panel's one method + global-action strip (edit brief,
 *   review inputs, re-run). It replaced BOTH the "Methods you can run" shelf and
 *   the tab's `ActionsMenu`; it acts on the whole model, not on a zone.
 * · `ModelReviewTool` — the model-wide review queue, mounted directly under
 *   `ModelStrip` as that strip's own "N to review" affordance. It reviews the
 *   model the strip describes, so it sits with the strip, above the zones.
 */
// ⚠ V2 first screen (24 Sep 2026): `CritiqueWarningStrip` and
// `InferenceWarningStrip` LEFT this list — they no longer mount above the zones.
// The tab carries one qualifier under the chart and About › Limitations lists
// the entries (`theAnswerIsOnTheFirstScreen.spec.tsx`).
const ABOVE_THE_ZONES = [
  'ModelStrip',
  'MethodStrip',
  'ModelReviewTool',
] as const

/** A top-level child of the content column is at exactly eight spaces. */
const TOP_LEVEL_COMPONENT = /^ {8}<([A-Z][A-Za-z]*)/
const ZONE_OPEN = /data-testid="analysis-new-zone-(\w+)-group"/
/**
 * ⚠ WHERE THE CONTENT COLUMN'S JSX STARTS. V2's `answerBlock` const (defined
 * above the render, placed later via `{answerBlock}` INSIDE the answer zone)
 * holds `<OptionsComparison` at eight spaces, so the indentation rule alone
 * read it as an escapee above the zones. A const is not a child of the content
 * column by its position in the file — only the render's JSX is — so the scan
 * starts at the render root. Every line the old rule could legitimately flag
 * is still inside the scanned range.
 */
const RENDER_ROOT = 'data-testid="analysis-new-tab-body"'

describe('the zone grammar has contents, not just names', () => {
  const lines = fs.readFileSync(BODY, 'utf8').split('\n')

  const zoneOpens = lines
    .map((l, i) => ({ i: i + 1, m: ZONE_OPEN.exec(l) }))
    .filter((r): r is { i: number; m: RegExpExecArray } => r.m !== null)

  const renderRoot = lines.findIndex((l) => l.includes(RENDER_ROOT)) + 1

  it('PRECONDITION: the three zones are found in the source — otherwise this spec reads nothing', () => {
    // V2: "Challenge the thinking" (the `also` group) now sits ABOVE the answer.
    // V2 first screen (24 Sep 2026): "Focus now" follows the answer — the
    // prototype goes model → challenge → commitment with nothing between.
    // V2 fidelity gap 24 (24 Sep 2026): the 'further' zone is deleted; its
    // blocks fold into About, which mounts after the last zone.
    expect(zoneOpens.map((z) => z.m[1])).toEqual(['also', 'answer', 'focus'])
  })

  it('PRECONDITION: the render root is found, and it precedes the first zone', () => {
    expect(renderRoot, 'the render root anchor was not found').toBeGreaterThan(0)
    expect(renderRoot).toBeLessThan(zoneOpens[0].i)
  })

  it('⛔ every top-level section sits inside a zone, or is NAMED as furniture above them', () => {
    const firstZone = zoneOpens[0].i

    const escapees = lines
      .map((l, i) => ({ line: i + 1, m: TOP_LEVEL_COMPONENT.exec(l) }))
      .filter((r): r is { line: number; m: RegExpExecArray } => r.m !== null)
      .filter((r) => r.line > renderRoot && r.line < firstZone)
      .map((r) => r.m[1])
      .filter((name) => !ABOVE_THE_ZONES.includes(name as (typeof ABOVE_THE_ZONES)[number]))

    expect(
      [...new Set(escapees)],
      'a section above the first zone is outside the grammar. If it is genuinely ' +
        'panel-wide furniture, add it to ABOVE_THE_ZONES with a reason; otherwise move it in.',
    ).toEqual([])
  })

  /**
   * ⭐ THE ARM THAT PROVES THE SWEEP CAN SEE ANYTHING AT ALL. Without it, a
   * regex that matched nothing would satisfy the case above by examining an
   * empty set — the vacuity this panel has shipped more than once.
   */
  it('PRECONDITION: the component detector finds the sections it should', () => {
    const found = lines
      .map((l) => TOP_LEVEL_COMPONENT.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => m[1])

    expect(found.length, 'the detector found no top-level components at all').toBeGreaterThan(8)
    // V2 (fidelity gap 1): `AtAGlance` is built once in `renderGlance` and
    // mounted by call, so the known answer-zone section here is the chart.
    expect(found, 'a section known to be inside the answer zone').toContain('OptionsComparison')
    expect(found, 'and one known to be above the zones').toContain('ModelStrip')
  })

  /**
   * ⚠ THE FURNITURE LIST IS A MIRROR, so it gets the check every mirror needs:
   * an entry that no longer appears in the body is a stale exemption, and a
   * stale exemption silently widens what may escape.
   */
  it('⛔ every named exemption is still really in the body', () => {
    const src = lines.join('\n')
    const stale = ABOVE_THE_ZONES.filter((name) => !src.includes(`<${name}`))
    expect(stale, 'a stale exemption widens the rule without anyone deciding to').toEqual([])
  })
})
