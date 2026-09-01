/**
 * "What would change your mind" is its own section, and the rows MOVE there.
 *
 * ⭐ THE DEFECT, WITNESSED ON STAGING `e685dafa` (fresh guest, full run). The
 * single most decision-relevant sentence this product emits —
 *
 *   If "Bottom-Up Adoption Friction → Bottom-Up Adoption Rate" changes
 *   significantly, "A Full Switch at Renewal" could become the better choice
 *
 * — rendered as row 3 of 5 inside a COLLAPSED section headed "Uncertainty and
 * gaps", twelfth of fourteen elements on the panel. It names the option that
 * would WIN INSTEAD: it is the answer to "what would change my mind", filed
 * under a heading that reads as caveats. Meanwhile "How the options compare",
 * which restates the headline, had a section of its own higher up.
 *
 * ⚠⚠ THE SPLIT IS ON THE PRODUCER'S `code`, NEVER ON THE SENTENCE. That prose
 * is the producer's and it may reword it; `SENSITIVE_ASSUMPTION` is the
 * contract. The pair below fails on different assertions if either half rots:
 * one if a sensitive row stops moving, the other if a NON-sensitive row starts.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { makeData, manyFragileEdges } from './analysisNewFixtures'

const build = (data: ReturnType<typeof makeData>, recommendations: Recommendation[] = []) =>
  buildAnalysisNewViewModel({
    data,
    recommendations,
    isStale: false,
    isPreRun: false,
    nodeValueSources: new Map(),
  })

/** One of each class, in ONE build, so the assertion is about the split. */
const MIXED = () =>
  makeData({
    confidence: {
      evidenceGapsAssessed: true,
      evidenceGaps: [],
      uncertainties: [
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'If "Adoption friction → Adoption rate" changes significantly, "Full switch" could become the better choice',
          displayText: 'If "Adoption friction → Adoption rate" changes significantly, "Full switch" could become the better choice',
          suggestion: 'Review this assumption',
          affectedNodes: ['e1'],
        },
        {
          code: 'LOW_EVIDENCE',
          message: 'Two inputs are supported by no cited source.',
          displayText: 'Two inputs are supported by no cited source.',
          suggestion: 'Add a source',
          affectedNodes: ['f2'],
        },
      ],
    },
  } as Parameters<typeof makeData>[0])

const ids = (rows: ReadonlyArray<{ id: string }>) => rows.map((r) => r.id)

describe('the producer class decides which section a finding lands in', () => {
  it('a SENSITIVE_ASSUMPTION row is in sensitivity and NOT in uncertainty', () => {
    const vm = build(MIXED())
    expect(vm.sensitivity.findings.length, 'the fixture produced no sensitivity row').toBe(1)
    expect(ids(vm.sensitivity.findings)[0]).toContain('SENSITIVE_ASSUMPTION')
    expect(
      ids(vm.uncertainty.findings).some((i) => i.includes('SENSITIVE_ASSUMPTION')),
      'the row was COPIED rather than moved — a reader meets it twice',
    ).toBe(false)
  })

  /**
   * ⭐ THE TWIN. Without it, a change that routed EVERY uncertainty into the new
   * section would pass the case above and quietly empty "Uncertainty and gaps".
   */
  it('a non-sensitive row stays in uncertainty and NEVER moves', () => {
    const vm = build(MIXED())
    expect(
      ids(vm.uncertainty.findings).some((i) => i.includes('LOW_EVIDENCE')),
      'the non-sensitive row left the section it belongs to',
    ).toBe(true)
    expect(ids(vm.sensitivity.findings).some((i) => i.includes('LOW_EVIDENCE'))).toBe(false)
  })

  it('the sentence exists exactly once across both sections', () => {
    const vm = build(MIXED())
    const all = [...vm.sensitivity.findings, ...vm.uncertainty.findings]
      .map((f) => `${f.headline} ${f.implication}`)
      .join(' | ')
    const hits = all.split('could become the better choice').length - 1
    expect(hits, 'the flip sentence is rendered more than once').toBe(1)
  })

  /** The real producer fixture, not a hand-shaped one — trap 16's rule. */
  it('the estate’s own fragile-edge fixture routes to the new section', () => {
    const vm = build(manyFragileEdges())
    expect(vm.sensitivity.findings.length).toBeGreaterThan(0)
    for (const f of vm.sensitivity.findings) {
      expect(f.id).toContain('SENSITIVE_ASSUMPTION')
    }
  })

  it('pre-run the section is empty rather than describing a run that has not happened', () => {
    const vm = buildAnalysisNewViewModel({
      data: manyFragileEdges(),
      recommendations: [],
      isStale: false,
      isPreRun: true,
      nodeValueSources: new Map(),
    })
    expect(vm.sensitivity.findings).toEqual([])
  })
})
