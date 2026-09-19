/**
 * EVERY SECTION LIVES IN A ZONE — the invariant the zone grammar never had.
 *
 * ## Why this is missing, and why that matters
 *
 * The four zones are **lexical `<div>` wrappers**. There is no dispatcher, no
 * registry, and no rule that a section belongs to one — a section is in a zone
 * only because its JSX happens to sit between that zone's braces. `theZonesAreNamed`
 * iterates a hardcoded four-zone list and says nothing about their contents.
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
 */
const ABOVE_THE_ZONES = ['CritiqueWarningStrip', 'InferenceWarningStrip', 'ModelStrip'] as const

/** A top-level child of the content column is at exactly eight spaces. */
const TOP_LEVEL_COMPONENT = /^ {8}<([A-Z][A-Za-z]*)/
const ZONE_OPEN = /data-testid="analysis-new-zone-(\w+)-group"/

describe('the zone grammar has contents, not just names', () => {
  const lines = fs.readFileSync(BODY, 'utf8').split('\n')

  const zoneOpens = lines
    .map((l, i) => ({ i: i + 1, m: ZONE_OPEN.exec(l) }))
    .filter((r): r is { i: number; m: RegExpExecArray } => r.m !== null)

  it('PRECONDITION: the four zones are found in the source — otherwise this spec reads nothing', () => {
    expect(zoneOpens.map((z) => z.m[1])).toEqual(['focus', 'answer', 'also', 'further'])
  })

  it('⛔ every top-level section sits inside a zone, or is NAMED as furniture above them', () => {
    const firstZone = zoneOpens[0].i

    const escapees = lines
      .map((l, i) => ({ line: i + 1, m: TOP_LEVEL_COMPONENT.exec(l) }))
      .filter((r): r is { line: number; m: RegExpExecArray } => r.m !== null)
      .filter((r) => r.line < firstZone)
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
    expect(found, 'a section known to be inside the answer zone').toContain('AtAGlance')
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
