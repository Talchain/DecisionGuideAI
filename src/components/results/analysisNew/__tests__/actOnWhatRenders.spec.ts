/**
 * The act belongs on the rows that actually render.
 *
 * ⛔ WHY THIS EXISTS. "One assumption worth pinning down" and "What would change
 * your mind" read the SAME producer array (`robustness.fragile_edges`). The card
 * additionally needs a canvas edge it can NAME and is therefore rare — measured
 * 3/3 non-render on the served build, so the act shipped in #1542 has never been
 * seen by a user. The sensitivity rows survive without that join, which is why
 * they render on ordinary runs. This pins the act onto them WITHOUT loosening
 * the gate that decides whether the destination can serve it.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData } from './analysisNewFixtures'

const FROM = 'fac_demand'
const TO = 'out_margin'
const EDGE = 'e-7'

const sensitiveRow = (from: string, to: string) => ({
  code: 'SENSITIVE_ASSUMPTION',
  message: `If "${from} → ${to}" changes significantly, the comparison could land differently.`,
  displayText: `If "${from} → ${to}" changes significantly, the comparison could land differently.`,
  suggestion: 'Review this assumption',
  affectedNodes: [from, to],
  edgeFromId: from,
  edgeToId: to,
  severity: 'warning' as const,
  eValue: 1.4,
})

const build = (opts: Parameters<typeof makeData>[0]) =>
  buildAnalysisNewViewModel({ data: makeData(opts), recommendations: [], isStale: false } as never)

const sensitivityFindings = (vm: ReturnType<typeof build>) =>
  (vm as unknown as { sensitivity: { findings: Array<Record<string, unknown>> } }).sensitivity.findings

describe('the act reaches the rows an ordinary run renders', () => {
  it('⭐ offers the act on a sensitivity row whose edge the Model tab can serve', () => {
    const vm = build({
      confidence: { uncertainties: [sensitiveRow(FROM, TO)] } as never,
      sensitivityReviewTargets: new Map([[`${FROM}->${TO}`, EDGE]]),
    })
    const row = sensitivityFindings(vm)[0]
    expect(row).toBeDefined()
    expect(row.reviewTargetId).toBe(EDGE)
    // ⭐ AND THE CAMERA TARGET MOVES TO THE EDGE. It was `affectedNodes[0]` —
    // the FROM node — so "Show on canvas" framed one end of a sentence about a
    // relationship. Both controls now point at the same object.
    expect(row.targetId).toBe(EDGE)
  })

  it('⭐ DISCRIMINATING: the SAME row carries no act when the destination cannot serve it', () => {
    // The first test alone would pass against a constant. This is the arm that
    // proves the gate is read: identical input, empty target map.
    const vm = build({
      confidence: { uncertainties: [sensitiveRow(FROM, TO)] } as never,
      sensitivityReviewTargets: new Map(),
    })
    const row = sensitivityFindings(vm)[0]
    expect(row.reviewTargetId).toBeUndefined()
    // ⚠ The row SURVIVES and keeps its old camera target. Its value is the
    // sentence; losing the reasoning to hide a missing control would be worse
    // than the missing control.
    expect(row).toBeDefined()
    expect(row.targetId).toBe(FROM)
  })

  it('⛔ DEDUP: where the assumed-strength card claims the edge, the row carries no act', () => {
    // Two doors to one place is the same defect this panel already shipped as
    // "a reader meeting one sentence in two sections". Bound by edge IDENTITY.
    const vm = build({
      confidence: { uncertainties: [sensitiveRow(FROM, TO)] } as never,
      sensitivityReviewTargets: new Map([[`${FROM}->${TO}`, EDGE]]),
      assumedStrength: {
        selected: {
          edgeId: EDGE,
          fromLabel: 'Demand',
          toLabel: 'Margin',
          switchProbability: 0.4,
          alternativeWinnerLabel: null,
          strengthProvenance: 'ai_inferred',
          strengthEditReachable: true,
        },
        refusalReason: null,
        assumedFragileCount: 1,
      } as never,
    })
    expect(sensitivityFindings(vm)[0].reviewTargetId).toBeUndefined()
  })

  it('⛔ a DIFFERENT edge claimed by the card does NOT suppress this row', () => {
    // The dedup must bind by identity, not by "a card exists". Without this,
    // any assumed-strength selection would silently disarm every act.
    const vm = build({
      confidence: { uncertainties: [sensitiveRow(FROM, TO)] } as never,
      sensitivityReviewTargets: new Map([[`${FROM}->${TO}`, EDGE]]),
      assumedStrength: {
        selected: {
          edgeId: 'e-OTHER',
          fromLabel: 'A', toLabel: 'B',
          switchProbability: 0.4, alternativeWinnerLabel: null,
          strengthProvenance: 'ai_inferred', strengthEditReachable: true,
        },
        refusalReason: null, assumedFragileCount: 2,
      } as never,
    })
    expect(sensitivityFindings(vm)[0].reviewTargetId).toBe(EDGE)
  })

  it('fails CLOSED when the producer named no endpoints', () => {
    const { edgeFromId: _f, edgeToId: _t, ...noEndpoints } = sensitiveRow(FROM, TO)
    const vm = build({
      confidence: { uncertainties: [noEndpoints] } as never,
      sensitivityReviewTargets: new Map([[`${FROM}->${TO}`, EDGE]]),
    })
    expect(sensitivityFindings(vm)[0].reviewTargetId).toBeUndefined()
  })
})
