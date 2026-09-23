/**
 * "WHAT WOULD CHANGE YOUR MIND" — THE ROWS CARRY THE RELATIONSHIP'S NAME, OR
 * NONE OF THEM DO.
 *
 * ## The defect, measured — not imagined
 *
 * Paul's screenshot of the deployed panel: three rows in one section, no labels
 * on any of them, one ~150-character sentence each, differing only in the
 * middle. Nothing to scan. `uncertaintyNoStutter.spec.ts` established WHY the
 * labels are absent — a cut prefix of the body is not a label, so the row
 * correctly renders none — and that fix was right. It left the rows unscannable,
 * which is the half this file answers.
 *
 * ## The licence, and its limit
 *
 * `buildAnalysisNewViewModel` already sanctions exactly one label shape: a
 * PRODUCER-SUPPLIED name that is not a prefix of the body. That is why a
 * threshold row keeps both slots. `from_label` and `to_label` are two of the TEN
 * fields `EnrichmentRobustnessEdgeSchema` declares, so a name composed from them
 * is the same shape — not a truncation, not a constant, not a guess.
 *
 * ⛔ The threshold scale that was planned instead is WITHDRAWN and must not come
 * back on this evidence: `threshold`, `flip_value` and `direction` are NOT among
 * the ten declared fields and no capture shows one. The row's IDENTITY comes
 * from what is declared; any threshold CLAIM stays conditioned on data actually
 * present. (Codex CX-20260916-15: a missing declaration is not proof nothing
 * emits via passthrough, so no producer support is deleted — but nothing may be
 * DRAWN from a field we cannot show exists.)
 *
 * ## ⚠ THE ASSERTION THAT COST ME THE FIRST DRAFT
 *
 * Naming each row that could be named names ONE of the three on the measured
 * fixture, because one node label is itself a 95-character sentence. A section
 * with one titled row above two untitled ones is the *same* complaint — "one
 * section, two title conventions" — wearing a different coat. So the SET
 * decides, which is this estate's ratified idiom for the shape: the convergence
 * line is absent when any row names no option; the goal-probability bars stay
 * silent when one option is short.
 *
 * ## ⚠ THE DISCRIMINATING PAIR
 *
 * Every claim here is paired with its opposite. A guard that only proved "the
 * rows are named" would be satisfied by naming them unconditionally — including
 * from 'Unknown factor', and including at a length that forces the truncation
 * the sibling spec bans. A guard that only proved "the rows are silent" would be
 * satisfied by deleting the feature.
 */

import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, manyFragileEdges, uncertaintyDerivedFindings } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { UncertaintyItem } from '../../types'

const rowsOf = (data: ResultsSectionDataReturn) =>
  uncertaintyDerivedFindings(
    buildAnalysisNewViewModel({
      data,
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    }),
  )

const withUncertainties = (uncertainties: UncertaintyItem[]) =>
  makeData({ confidence: { evidenceGapsAssessed: true, uncertainties } })

/**
 * The producer's sentence, at the length that puts the row on the no-label
 * branch. Parameterised on the ends so a test can vary them without varying
 * anything else — the sentence and the name are then the only two things in
 * play, which is what every claim below is about.
 */
const sentence = (from: string, to: string, winner: string) =>
  `If "${from} → ${to}" changes significantly, "${winner}" could lead in this model`

/** The same sentence with its subject unnamed — what the hook offers a titled row. */
const shortSentence = (winner: string) =>
  `If this changes significantly, "${winner}" could lead in this model`

const edgeRow = (
  from: string,
  to: string,
  winner: string,
  over: Partial<UncertaintyItem> = {},
): UncertaintyItem => {
  const text = sentence(from, to, winner)
  return {
    code: 'SENSITIVE_ASSUMPTION',
    message: text,
    displayText: text,
    suggestion: 'Review this assumption',
    affectedNodes: ['n_from', 'n_to'],
    edgeFromLabel: from,
    edgeToLabel: to,
    edgeLabelsResolved: true,
    messageWithSubjectNamedAbove: shortSentence(winner),
    ...over,
  } as UncertaintyItem
}

/** The three ends are short and distinct — the ordinary shape of a real run. */
const NAMEABLE: Array<[string, string, string]> = [
  ['Peak Fulfilment Capacity', 'Peak Season Throughput', 'RudderStack'],
  ['Migration Cost', 'Budget Overrun Risk', 'Status Quo'],
  ['Integration Effort', 'Delivery Date Slip', 'RudderStack'],
]

describe('a fragile-edge row names the relationship it is about', () => {
  it('⭐ every long row carries the relationship name, and the FULL sentence survives beneath it', () => {
    const rows = rowsOf(withUncertainties(NAMEABLE.map(([f, t, w]) => edgeRow(f, t, w))))

    expect(rows).toHaveLength(3)
    for (const [i, [from, to, winner]] of NAMEABLE.entries()) {
      // The name — the producer's two declared ends, and nothing invented.
      expect(rows[i].headline).toBe(`${from} → ${to}`)
      // ⛔ THE FINDING IS NOT TRADED FOR THE LABEL — it is the SAME sentence
      // with its subject standing above it instead of quoted inside it. The
      // consequence clause, which the old truncation cut away, is intact.
      expect(rows[i].implication).toBe(shortSentence(winner))
      expect(rows[i].implication).toContain('could lead in this model')
      // ⛔ AND THE LABEL IS NOT A PREFIX OF THE BODY — the property that makes
      // this branch legitimate where the cut one was not.
      expect(rows[i].implication.startsWith(rows[i].headline)).toBe(false)
    }
  })

  it('⭐ the label is a NAME, not the opening of the sentence under it', () => {
    const rows = rowsOf(withUncertainties(NAMEABLE.map(([f, t, w]) => edgeRow(f, t, w))))

    // Three rows, three different labels — the scanability the section lacked.
    expect(new Set(rows.map((r) => r.headline)).size).toBe(3)

    for (const row of rows) {
      // ⚠ CORRECTED FROM MY OWN FIRST DRAFT, WHICH ASSERTED THE BODIES WERE
      // INDISTINGUISHABLE IN THEIR FIRST TWELVE CHARACTERS. They are not: the
      // template is `If "` and the source name begins at character five, so the
      // bodies differ at character five. The claim that is actually true — and
      // the one the design rests on — is that the label does not open with the
      // sentence's furniture, and is a fraction of its length.
      expect(row.implication.startsWith('If ')).toBe(true)
      expect(row.headline.startsWith('If ')).toBe(false)
    }
  })

  it('⛔ ONE OVERLONG NAME DEGRADES THE WHOLE SET TO THE SOURCE \u2014 it does not silence it', () => {
    // A 95-character target label, the shape on the measured fixture. Its full
    // relationship name exceeds the label budget, and truncating it would be the
    // cut prefix the sibling spec bans. So the SECTION drops to rung 2 — the
    // source factor, a complete producer-supplied name — and EVERY row uses it.
    const longTarget =
      'getting through peak season without dropping below our 95 percent accuracy commitment, at lower cost'
    const rows = rowsOf(
      withUncertainties([
        edgeRow(NAMEABLE[0][0], NAMEABLE[0][1], NAMEABLE[0][2]),
        edgeRow('Peak Season Throughput', longTarget, 'RudderStack'),
      ]),
    )

    expect(rows).toHaveLength(2)
    // ⛔ NOT ['', ''] — that was draft two, and Codex refused it (CX-20260916-63):
    // all-or-none traded two good titles away to punish a third.
    expect(rows.map((r) => r.headline)).toEqual([
      NAMEABLE[0][0],
      'Peak Season Throughput',
    ])
    // ⛔⛔ AND THE BODIES KEEP THEIR SUBJECT AT THIS RUNG. The title is only the
    // FACTOR; the body's quoted subject is the whole relationship. Dropping it
    // would delete the target end, which nothing on screen would then name.
    expect(rows[0].implication).toBe(sentence(NAMEABLE[0][0], NAMEABLE[0][1], NAMEABLE[0][2]))
    expect(rows[1].implication).toBe(sentence('Peak Season Throughput', longTarget, 'RudderStack'))
  })

  it('⛔ TWO ROWS THAT WOULD SHARE A TITLE GET NONE \u2014 a repeated title is furniture', () => {
    // Both edges leave the same factor, and the targets are too long for rung 1.
    // Rung 2 would title both rows 'Peak Season Throughput', which does not
    // identify them, it confuses them. The honest blank is better.
    const longA =
      'getting through peak season without dropping below our 95 percent accuracy commitment, at lower cost'
    const longB =
      'holding unit economics steady while the fulfilment network absorbs the additional seasonal volume'
    const rows = rowsOf(
      withUncertainties([
        edgeRow('Peak Season Throughput', longA, 'RudderStack'),
        edgeRow('Peak Season Throughput', longB, 'RudderStack'),
      ]),
    )

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.headline)).toEqual(['', ''])
    expect(rows[0].implication).toBe(sentence('Peak Season Throughput', longA, 'RudderStack'))
  })

  it('⛔ THE GATE IS THE PRODUCER’S ANSWER, NOT THE LOOK OF THE STRING', () => {
    // `edgeLabelsResolved: false` with two entirely plausible-looking labels.
    // This is the `formatUnattributedId` rung: a string that names nothing while
    // looking exactly like a name. A consumer comparing against 'Unknown factor'
    // would name this row.
    const rows = rowsOf(
      withUncertainties(
        NAMEABLE.map(([f, t, w]) => edgeRow(f, t, w, { edgeLabelsResolved: false })),
      ),
    )
    expect(rows.map((r) => r.headline)).toEqual(['', '', ''])
  })

  it('⛔ AND A MISSING ANSWER IS NOT A YES', () => {
    // A row from a consumer or capture that predates the field entirely.
    const rows = rowsOf(
      withUncertainties(
        NAMEABLE.map(([f, t, w]) =>
          edgeRow(f, t, w, { edgeLabelsResolved: undefined }),
        ),
      ),
    )
    expect(rows.map((r) => r.headline)).toEqual(['', '', ''])
  })

  it('⭐ THE OTHER HALF OF THE PAIR: a threshold row and a short row are untouched', () => {
    const short = 'Demand may be seasonal.'
    const long = sentence('Peak Fulfilment Capacity', 'Peak Season Throughput', 'RudderStack')
    const rows = rowsOf(
      withUncertainties([
        // A producer threshold name still wins its slot — the branch above this
        // one, and the reason this guard cannot be satisfied by deleting labels.
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: long,
          displayText: long,
          affectedNodes: ['n_from'],
          edgeFromLabel: 'Peak Fulfilment Capacity',
          edgeToLabel: 'Peak Season Throughput',
          edgeLabelsResolved: true,
          threshold: { variable: 'Peak Fulfilment Capacity', direction: 'negative', value: 0.42 },
        } as UncertaintyItem,
        // A sentence short enough to be its own label keeps that behaviour, with
        // an empty body and nothing repeated.
        { code: 'GRAPH_DENSE', message: short, displayText: short } as UncertaintyItem,
      ]),
    )

    expect(rows).toHaveLength(2)
    const threshold = rows.find((r) => r.headline.endsWith('could change which option leads in this model'))
    expect(threshold?.headline).toBe('Peak Fulfilment Capacity could change which option leads in this model')
    expect(threshold?.implication).toBe(long)
    const shortRow = rows.find((r) => r.headline === short)
    expect(shortRow?.implication).toBe('')
  })

  it('⛔ FAIL-CLOSED: a titled row with NO short form keeps the whole sentence', () => {
    // A producer-authored `description` yields no short form, because
    // substituting into someone else's prose is a rewording, not a de-duplication.
    const rows = rowsOf(
      withUncertainties(
        NAMEABLE.map(([f, t, w]) =>
          edgeRow(f, t, w, { messageWithSubjectNamedAbove: undefined }),
        ),
      ),
    )
    for (const [i, [from, to, winner]] of NAMEABLE.entries()) {
      expect(rows[i].headline).toBe(`${from} \u2192 ${to}`)
      expect(rows[i].implication).toBe(sentence(from, to, winner))
    }
  })

  it('⛔ a THRESHOLD row keeps its subject, because its title is not the edge name', () => {
    // The threshold headline is the producer's `variable`, which is an id, not
    // the relationship's name — so the body's subject is NOT on screen above it
    // and must not be dropped.
    const long = sentence('Peak Fulfilment Capacity', 'Peak Season Throughput', 'RudderStack')
    const rows = rowsOf(
      withUncertainties([
        edgeRow('Peak Fulfilment Capacity', 'Peak Season Throughput', 'RudderStack', {
          threshold: { variable: 'fac_capacity', direction: 'negative', value: 0.42 },
        }),
      ]),
    )
    expect(rows[0].headline).toBe('fac_capacity could change which option leads in this model')
    expect(rows[0].implication).toBe(long)
  })

  it('⛔ the MEASURED fixture degrades to rung 2, and every row uses it', () => {
    // `manyFragileEdges` reproduces the deployed shape and models the fields the
    // hook really sets. Two of its three targets are 95-character labels, so
    // rung 1 is unreachable — and its three SOURCES are distinct, so rung 2 is.
    // ⚠ THIS TEST PREVIOUSLY ASSERTED THE ROWS STAY UNNAMED. That was draft
    // two's all-or-none rule, and it is withdrawn; the verdict moved, so the
    // claim moved with it rather than being left to read as still true.
    const rows = rowsOf(manyFragileEdges()).filter((r) => r.implication.startsWith('If "'))
    expect(rows.length).toBeGreaterThanOrEqual(3)

    const titles = rows.map((r) => r.headline)
    // Every row titled, by the SAME convention, and no two alike.
    expect(titles.every((t) => t !== '')).toBe(true)
    expect(new Set(titles).size).toBe(titles.length)
    expect(titles.every((t) => !t.includes('\u2192'))).toBe(true)
    // And no title is a cut — nothing carries the truncation marker.
    expect(titles.every((t) => !t.endsWith('\u2026'))).toBe(true)
  })

})
