/**
 * The act belongs on the rows that actually render.
 *
 * ⛔ WHY THIS EXISTS. "One assumption worth pinning down" and "What would change
 * your mind" read the SAME producer array (`robustness.fragile_edges`). The card
 * additionally needs a canvas edge it can NAME; these rows do not. That is a
 * STRUCTURAL difference and it is the whole argument — attaching the act here
 * reaches the rows an ordinary run renders, WITHOUT loosening the gate that
 * decides whether the destination can serve it.
 *
 * ⚠ NO FREQUENCY CLAIM IS MADE. An earlier version of this header said the card
 * was "rare — 3/3 non-render" and that #1542's act "has never been seen by a
 * user". That was a SAMPLE PRESENTED AS A POPULATION, with no artefact cited,
 * and it was retracted. `selectAssumedStrengthToResolve` returns a named
 * `refusalReason` for every null; nobody has read one. The argument above does
 * not need the frequency and does not rest on it.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildNodeInsights } from '../nodeInsights'
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
    // ⭐ THE CAMERA FRAMES THE EDGE. It was `affectedNodes[0]` — the FROM node —
    // so "Show on canvas" framed one end of a sentence about a relationship.
    expect(row.focusTargetId).toBe(EDGE)
    // ⛔ AND `targetId` STAYS THE NODE. It is a node-identity join read by
    // `buildNodeInsights` into a node-keyed map; an edge id there is a key no
    // node lookup can hit and the row's mention leaves the strip. The first
    // draft of this change pointed it at the edge and a reviewer MEASURED the
    // regression: keys ["fac_demand"] → ["e-7"].
    expect(row.targetId).toBe(FROM)
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
    // ⚠ The row SURVIVES, and with no edge resolved the camera falls back to
    // the node. Its value is the sentence; losing the reasoning to hide a
    // missing control would be worse than the missing control.
    expect(row).toBeDefined()
    expect(row.focusTargetId).toBeUndefined()
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
    const row = sensitivityFindings(vm)[0]
    expect(row.reviewTargetId).toBeUndefined()
    // ⛔⛔ THE DEDUP SUPPRESSES THE ACT AND NOTHING ELSE — asserted because the
    // first version of this test checked ONLY `reviewTargetId` and therefore
    // PASSED WHETHER OR NOT the camera and the join survived. A test that
    // cannot see the fields it was written to protect is the defect one level
    // up, and a reviewer caught it here.
    expect(row.focusTargetId).toBe(EDGE)   // the reader is still shown WHERE it is
    expect(row.targetId).toBe(FROM)        // and the strip's node join is intact
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
    const row = sensitivityFindings(vm)[0]
    expect(row.reviewTargetId).toBe(EDGE)
    expect(row.focusTargetId).toBe(EDGE)
    expect(row.targetId).toBe(FROM)
  })

  it('fails CLOSED when the producer named no endpoints', () => {
    const { edgeFromId: _f, edgeToId: _t, ...noEndpoints } = sensitiveRow(FROM, TO)
    const vm = build({
      confidence: { uncertainties: [noEndpoints] } as never,
      sensitivityReviewTargets: new Map([[`${FROM}->${TO}`, EDGE]]),
    })
    const row = sensitivityFindings(vm)[0]
    expect(row.reviewTargetId).toBeUndefined()
    expect(row.focusTargetId).toBeUndefined()
    expect(row.targetId).toBe(FROM)
  })

  /**
   * ⭐⭐ THE INTERLOCK — AND IT IS THE ONLY TEST HERE BOUND TO THE REAL READER.
   *
   * Every assertion above reads a FIELD off the view model. The regression a
   * reviewer measured was not a field value, it was a CONSEQUENCE: the mention
   * left the strip, because `buildNodeInsights` keys by `targetId` into a
   * node-keyed map that `ModelStrip` reads as `insights.get(active.id)`.
   *
   * A field assertion cannot see that. This drives the actual indexer and
   * asserts the KEY, so if anyone repoints `targetId` at an edge again, the
   * consequence — not the intention — goes red.
   */
  it('⭐ INTERLOCK: the row still indexes under its NODE in buildNodeInsights', () => {
    const vm = build({
      confidence: { uncertainties: [sensitiveRow(FROM, TO)] } as never,
      sensitivityReviewTargets: new Map([[`${FROM}->${TO}`, EDGE]]),
    })
    const findings = sensitivityFindings(vm)
    // ⚠ BUILT EXPLICITLY, NOT CAST. `MentionCandidate` is `{id, headline,
    // targetId?}` and this test's whole subject is WHICH KEY `targetId`
    // produces — so it is read off the real row and passed as itself. A cast
    // here would be the same defect the fixture already taught me: a cast
    // cannot fail when the shape underneath it moves.
    const candidates = findings.map(f => ({
      id: String(f.id),
      headline: String(f.headline ?? ''),
      ...(typeof f.targetId === 'string' ? { targetId: f.targetId } : {}),
    }))
    const index = buildNodeInsights({
      interventions: [],
      drivers: [],
      mentionSections: [{ section: 'uncertainty', findings: candidates }],
    })

    // PRECONDITION, so this cannot pass on an empty index (the vacuity trap the
    // sibling parity spec already pins for its own collections).
    expect(findings.length).toBeGreaterThan(0)

    expect([...index.keys()]).toContain(FROM)
    expect([...index.keys()]).not.toContain(EDGE)
    expect(index.get(FROM)?.mentions.map(m => m.id)).toContain(findings[0].id)
  })
})
