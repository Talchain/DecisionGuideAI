/**
 * Copy hygiene for the Reasoning tab's UI-AUTHORED copy.
 *
 * ⭐ WHY THIS EXISTS, AND WHY IT IS DERIVED RATHER THAN ENUMERATED.
 *
 * `ANALYSIS_HERO_BANNED_TERMS` has existed for months and two sibling
 * surfaces already scan against it (`analysis-hero/copyHygiene.spec.tsx`,
 * `focus-now/copyHygiene.spec.tsx`). Nothing scanned THIS module, and on
 * 16 Sep 2026 the empty state for "Strengthen the reasoning" was witnessed
 * rendering `No high-priority reasoning intervention identified yet.` on
 * deployed `7573bb0e` — `intervention` being an INTERNAL term on that very
 * list. One instance survived a guard that already existed, because the
 * guard was pointed elsewhere.
 *
 * ⚠ THE SIBLING SPECS ENUMERATE EVERY MEMBER BY HAND. That is the
 * hand-maintained mirror this estate keeps paying for (trap 12): a copy
 * member added tomorrow is silently unscanned, and the mirror's drift reads
 * exactly like a pass. So this spec WALKS the exported object instead. A new
 * string member is covered with no edit here.
 *
 * SCOPE, STATED RATHER THAN IMPLIED (trap 20 — an absence claim must name
 * what it searched): this walks STRING leaves. Function members build their
 * sentences from arguments and are NOT invoked, so their templates are not
 * covered. Rather than leave that gap unobserved, the function-valued paths
 * are pinned as an exact set below: adding one REDs this spec and forces a
 * deliberate decision, which is a recorded gap rather than a silent one.
 */
import { describe, expect, it } from 'vitest'
import { findBannedTerm } from '@/test/glossaryBannedTerms'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'

type Leaf = { path: string; value: string }

function walkStrings(node: unknown, path: string, out: Leaf[], fns: string[]): void {
  if (typeof node === 'string') {
    out.push({ path, value: node })
    return
  }
  if (typeof node === 'function') {
    fns.push(path)
    return
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkStrings(v, `${path}[${i}]`, out, fns))
    return
  }
  if (node !== null && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      walkStrings(v, path ? `${path}.${k}` : k, out, fns)
    }
  }
}

function collect(): { strings: Leaf[]; functionPaths: string[] } {
  const strings: Leaf[] = []
  const functionPaths: string[] = []
  walkStrings(ANALYSIS_NEW_COPY, '', strings, functionPaths)
  return { strings, functionPaths: functionPaths.sort() }
}

describe('the Reasoning tab authors no banned term', () => {
  it('inspects a non-trivial number of strings (non-vacuity floor)', () => {
    const { strings } = collect()
    // A walker that silently stopped would pass every assertion below by
    // examining nothing. Floor set well under the count at authoring time so
    // ordinary copy edits do not trip it; it exists to catch a DEAD walk.
    expect(strings.length).toBeGreaterThan(40)
  })

  it('finds no banned term in any string the copy object can emit', () => {
    const { strings } = collect()
    const offenders = strings
      .map(l => ({ ...l, term: findBannedTerm(l.value) }))
      .filter(l => l.term !== null)
    expect(
      offenders.map(o => `${o.path}: "${o.term}" in ${JSON.stringify(o.value)}`),
    ).toEqual([])
  })

  it('the walker actually bites — positive control on a seeded fixture', () => {
    // Proves the absence above is a measurement, not blindness (trap 13).
    const seeded = { a: { b: 'this names an intervention' }, c: ['fine'] }
    const out: Leaf[] = []
    const fns: string[] = []
    walkStrings(seeded, '', out, fns)
    const hits = out.map(l => findBannedTerm(l.value)).filter(Boolean)
    expect(hits).toEqual(['intervention'])
  })

  it('pins the function-valued paths, which this scan does NOT cover', () => {
    // ⚠ Not a claim that these are clean — a claim about what WAS SEARCHED.
    // Pinned EXACTLY, and deliberately not a snapshot: a snapshot re-writes
    // itself under `-u`, which is the same auto-healing mirror this spec was
    // written to avoid. Growth OR shrinkage REDs, so a new template is a
    // deliberate decision rather than a silent gap.
    const { functionPaths } = collect()
    expect(functionPaths).toEqual([
      'argueTheOpposite.groundedDraft',
      'argueTheOpposite.groundedLead',
      'canvas.focusOption',
      'coverage.guaranteedHundredClause',
      'coverage.notRanked',
      'disclosure.convergence',
      'disclosure.moreDrivers',
      'disclosure.moreExcluded',
      'disclosure.moreStrengthen',
      'disclosure.moreUncertainty',
      'disclosure.tippingPoint',
      'disclosure.unnamedExcluded',
      'disclosure.unnamedOptions',
      'empty.noneRanked',
      'glance.withheldParametersMore',
      'implications.alignedLead',
      'implications.goalClaim',
      'implications.outcomeClaim',
      'modelStrip.mention',
      'modelStrip.moreFindings',
      'modelStrip.narrowedCount',
      'modelStrip.noValueCount',
      'modelStrip.noValueToggleName',
      'modelStrip.onlyKind',
      'modelStrip.toVerify',
      'modelStrip.toVerifyToggleName',
      'modelStrip.valueInputLabel',
      // ⚠ NEW, AND THE GAP IT OPENS IS COVERED ELSEWHERE ON PURPOSE.
      // `rangeLegend` became a function when the outcome lens made the dot
      // movable: a constant would have named the mid-point while the drawing
      // moved to p10 or p90. This scan cannot read it, so
      // `theLensMovesOneDotAndClaimsNothingElse.spec.tsx` asserts its output
      // per arm — including that each arm names the percentile it draws.
      'optionFigures.rangeLegend',
      'status.provisionalNaming',
      'trustLine.counts',
      // NEW (blocker repair ask). Its fixed text, "Help me fix this so the
      // analysis can run: ", carries no banned term; the interpolated part is
      // the blocker sentence already shown above it, quoted into the draft.
      'whyNoAnalysis.askFixDraft',
    ])
  })
})
