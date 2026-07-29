/**
 * persistedRunSnapshotFactory — the field mapping, and the two honest
 * degradations. ROADMAP 2.113a slice 1.
 *
 * Fixtures are byte-shaped from the live staging table (773 non-noop
 * `run_analysis` facts, probed read-only 2026-07-29) — see the fixture
 * module's header for the placement evidence.
 */
import { describe, it, expect } from 'vitest'
import {
  buildSnapshotFromPersistedRun,
  buildSnapshotsFromPersistedRuns,
} from '../persistedRunSnapshotFactory'
import { makePersistedRunFactRow } from '../../compare-tab/__tests__/__fixtures__/persistedRunFact'
import type { ScenarioEvent } from '../../../types/scenario'

const build = (row = makePersistedRunFactRow(), events: ScenarioEvent[] = []) =>
  buildSnapshotFromPersistedRun({ row, runNumber: 1, events, previousSnapshotTimestamp: null })

describe('persistedRunSnapshotFactory — field mapping', () => {
  it('maps the winner and runner-up from enrichment.option_comparison, sorted by win_probability', () => {
    const s = build(
      makePersistedRunFactRow({
        winner: { option_id: 'opt-low', option_label: 'Low', win_probability: 0.3 },
        runnerUp: { option_id: 'opt-high', option_label: 'High', win_probability: 0.7 },
      }),
    )!
    expect(s.winnerId).toBe('opt-high')
    expect(s.winnerLabel).toBe('High')
    expect(s.winnerProbability).toBe(70)
    expect(s.runnerUpId).toBe('opt-low')
    expect(s.runnerUpProbability).toBe(30)
  })

  it('takes runId from the fact row id and timestamp from result.computed_at', () => {
    const s = build(
      makePersistedRunFactRow({
        id: 'fact-abc',
        createdAt: '2026-07-20T10:00:05.000Z',
        computedAt: '2026-07-20T10:00:00.000Z',
      }),
    )!
    expect(s.runId).toBe('fact-abc')
    // computed_at (when the analysis ran), not created_at (when it was written)
    expect(s.timestamp).toBe('2026-07-20T10:00:00.000Z')
  })

  it('falls back to the row created_at when computed_at is absent', () => {
    const s = build(makePersistedRunFactRow({ createdAt: '2026-07-20T09:00:00.000Z', computedAt: null }))!
    expect(s.timestamp).toBe('2026-07-20T09:00:00.000Z')
  })

  it('carries graph_hash_at_run as the graphHash, tagged source "persisted" (aag_v1 regime)', () => {
    const s = build(makePersistedRunFactRow({ graphHashAtRun: 'aag_v1_deadbeef' }))!
    expect(s.graphHash).toBe('aag_v1_deadbeef')
    expect(s.source).toBe('persisted')
  })

  it('reads seed and responseHash from the persisted envelope', () => {
    const s = build(makePersistedRunFactRow({ seedUsed: 777, responseHash: 'rh-9' }))!
    expect(s.seedUsed).toBe(777)
    expect(s.responseHash).toBe('rh-9')
  })

  it('maps factor sensitivity into topFactors', () => {
    const s = build()!
    expect(s.topFactors.map(f => f.id)).toEqual(['factor-1', 'factor-2'])
    expect(s.topCalibrationFactor).toBe('Factor One')
    expect(s.topElasticity).toBe(42)
  })

  // -------------------------------------------------------------------------
  // DECLARED DEVIATION FROM THE DESIGN DOC — the three root-level fields
  // -------------------------------------------------------------------------

  it('reads inference_warnings / conditional_winners / edge_e_values from the ENRICHMENT ROOT', () => {
    // The design doc's §2 table maps these to `enrichment.robustness.*`.
    // Live bytes: 773/773 at the root, 0/773 under robustness. Implementing
    // the doc verbatim would leave all three permanently empty, silently.
    const s = build(
      makePersistedRunFactRow({
        inferenceWarnings: [{ message: 'Low sample coverage' }],
        conditionalWinners: [
          {
            factor_id: 'factor-1',
            factor_label: 'Factor One',
            split_value: 12,
            high_bucket: { winner_label: 'Option B' },
          },
        ],
        edgeEValues: [{ edge_id: 'factor-1->goal', e_value: 1.8 }],
      }),
    )!
    expect(s.inferenceWarnings).toEqual(['Low sample coverage'])
    expect(s.conditionalWinners).toHaveLength(1)
    expect(s.conditionalWinners[0].factorId).toBe('factor-1')
    expect(s.edgeEValues).toEqual([
      { edgeId: 'factor-1->goal', edgeLabel: 'factor-1 → goal', eValue: 1.8 },
    ])
  })

  it('MUTATION GUARD for that deviation: values nested under robustness are still read (forward-compat)', () => {
    const row = makePersistedRunFactRow()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichment = (row.payload as any).result.enrichment
    delete enrichment.inference_warnings
    enrichment.robustness.inference_warnings = ['nested warning']
    expect(build(row)!.inferenceWarnings).toEqual(['nested warning'])
  })

  // -------------------------------------------------------------------------
  // The two named gaps — degradations, never fabrications
  // -------------------------------------------------------------------------

  it('GAP 1 — node/edge counts are null, not 0 (the fact stores the analysis, not the model)', () => {
    const s = build()!
    expect(s.nodeCount).toBeNull()
    expect(s.edgeCount).toBeNull()
  })

  it('GAP 2 — evidenceCoverage is null, not "0/0"', () => {
    expect(build()!.evidenceCoverage).toBeNull()
  })

  it('absent graph_hash_at_run degrades to null, never to an empty string', () => {
    // 55 of 773 live rows carry no hash. '' would make two such runs compare
    // EQUAL and assert "structure unchanged" about runs nobody measured.
    expect(build(makePersistedRunFactRow({ graphHashAtRun: null }))!.graphHash).toBeNull()
  })

  it('absent recommendation_stability stays null → "Not assessed", never "fragile"', () => {
    // Present in only 347/773 live runs. deriveStabilityLabel(0) === 'fragile',
    // so a fabricated 0 would make the tab ASSERT a verdict about 55% of runs.
    const s = build()!
    expect(s.recommendationStability).toBeNull()
    expect(s.stabilityLabel).toBeNull()
  })

  it('present recommendation_stability is carried through', () => {
    const s = build(makePersistedRunFactRow({ recommendationStability: 0.82 }))!
    expect(s.recommendationStability).toBe(0.82)
    expect(s.stabilityLabel).toBe('stable')
  })

  it('absent fragile_edges stays null; an honest empty array reports 0', () => {
    expect(build(makePersistedRunFactRow({ fragileEdges: null }))!.fragileEdgeCount).toBeNull()
    expect(build(makePersistedRunFactRow({ fragileEdges: [] }))!.fragileEdgeCount).toBe(0)
  })

  it('a malformed seed does not become NaN or a fabricated 0', () => {
    expect(build(makePersistedRunFactRow({ seedUsed: 'not-a-seed' }))!.seedUsed).toBeNull()
    expect(build(makePersistedRunFactRow({ seedUsed: null }))!.seedUsed).toBeNull()
  })

  it('no goal probability on the wire ⇒ null, never 0 (live: 0/2784 items carry one)', () => {
    expect(build()!.goalProbability).toBeNull()
  })
})

describe('persistedRunSnapshotFactory — unreadable rows are DROPPED, never defaulted', () => {
  it('drops a row whose payload is not an object', () => {
    expect(build(makePersistedRunFactRow({ payloadOverride: 'nonsense' }))).toBeNull()
    expect(build(makePersistedRunFactRow({ payloadOverride: null }))).toBeNull()
  })

  it('drops a row with the wrong fact_type', () => {
    expect(
      build(makePersistedRunFactRow({ payloadOverride: { fact_type: 'edit_graph', result: {} } })),
    ).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Adversarial review of PR #523, finding 1 (MODERATE, fabrication-class).
  //
  // `parseRunFact` accepted any row with {object, fact_type, result,
  // enrichment}, and `toV2ResponseShape` then DEFAULTED an empty/absent
  // `option_comparison` to []. The factory's pre-existing
  // `winner?.win_probability ?? 0` turned that into a renderable snapshot.
  // The reviewer's probe output, verbatim:
  //
  //   RESULT: {"winnerId":"","winnerLabel":"","winnerProbability":0,
  //            "goalProbability":null,"runnerUpProbability":null}
  //
  // A run plotted at 0% with an empty winner label — absent rendered as zero,
  // on the exact path this module claims is "dropped, never defaulted". The
  // three original drop tests covered {non-object payload, wrong fact_type, no
  // enrichment} and could not see this shape.
  //
  // Live incidence 0/773 (both arrays non-empty in every live fact, twice
  // confirmed), so this is producer-drift class, not an exploit. The write
  // surface is service-role-only. The guard makes drift LOUD-by-omission
  // instead of silently fabricating a 0% run.
  // -------------------------------------------------------------------------

  it('drops a fact whose enrichment carries an EMPTY option_comparison (no 0% phantom run)', () => {
    const row = makePersistedRunFactRow({ optionComparison: [] })
    expect(build(row)).toBeNull()
  })

  it('drops a fact whose enrichment has NO option_comparison key at all', () => {
    const row = makePersistedRunFactRow()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (row.payload as any).result.enrichment.option_comparison
    expect(build(row)).toBeNull()
  })

  it('drops a fact whose option_comparison is present but not an array', () => {
    const row = makePersistedRunFactRow()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(row.payload as any).result.enrichment.option_comparison = { opt: 1 }
    expect(build(row)).toBeNull()
  })

  it('drops a fact whose enrichment carries an EMPTY factor_sensitivity (no measured-looking 0s)', () => {
    // Same hole, second array: empty factors yield topElasticity 0,
    // rankFlipRate 0, influenceConcentration 0 and topCalibrationFactor '',
    // which the hero prints as "Calibrate " / "0% influence" — three
    // fabricated measurements in one sentence.
    expect(build(makePersistedRunFactRow({ factorSensitivity: [] }))).toBeNull()
  })

  it('drops a fact whose factor_sensitivity is absent or not an array', () => {
    const noKey = makePersistedRunFactRow()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (noKey.payload as any).result.enrichment.factor_sensitivity
    expect(build(noKey)).toBeNull()

    const notArray = makePersistedRunFactRow()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(notArray.payload as any).result.enrichment.factor_sensitivity = 'nope'
    expect(build(notArray)).toBeNull()
  })

  it('POSITIVE CONTROL: the guard drops ONLY the degenerate shapes — a one-option, one-factor run still builds', () => {
    // Without this, tightening the guard until everything is dropped would
    // "pass" every test above. 773/773 live facts carry both arrays non-empty,
    // so the guard must cost nothing on real data.
    const s = build(
      makePersistedRunFactRow({
        runnerUp: null,
        factorSensitivity: [{ factor_id: 'f1', factor_label: 'F1', elasticity: 0.5 }],
      }),
    )
    expect(s).not.toBeNull()
    expect(s!.winnerId).toBe('opt-a')
    expect(s!.runnerUpId).toBeNull()
    expect(s!.topFactors).toHaveLength(1)
  })

  it('drops a row with no result.enrichment', () => {
    expect(
      build(
        makePersistedRunFactRow({
          payloadOverride: { fact_type: 'run_analysis', fact_version: 1, result: { summary: 'x' } },
        }),
      ),
    ).toBeNull()
  })
})

describe('buildSnapshotsFromPersistedRuns — journey assembly', () => {
  it('numbers the SURVIVORS contiguously when a row in the middle is unreadable', () => {
    const snapshots = buildSnapshotsFromPersistedRuns(
      [
        makePersistedRunFactRow({ id: 'a', responseHash: 'h-a', createdAt: '2026-07-20T10:00:00.000Z' }),
        makePersistedRunFactRow({ id: 'bad', payloadOverride: { fact_type: 'run_analysis' } }),
        makePersistedRunFactRow({ id: 'c', responseHash: 'h-c', createdAt: '2026-07-20T12:00:00.000Z' }),
      ],
      [],
    )
    expect(snapshots.map(s => s.runId)).toEqual(['a', 'c'])
    expect(snapshots.map(s => s.runNumber)).toEqual([1, 2])
  })

  it('the first run is "Initial analysis" and a later rerun with no edits says so', () => {
    const snapshots = buildSnapshotsFromPersistedRuns(
      [
        makePersistedRunFactRow({ id: 'a', responseHash: 'h-a', createdAt: '2026-07-20T10:00:00.000Z' }),
        makePersistedRunFactRow({ id: 'b', responseHash: 'h-b', createdAt: '2026-07-20T11:00:00.000Z' }),
      ],
      [],
    )
    expect(snapshots[0].editSummary).toBe('Initial analysis')
    expect(snapshots[1].editSummary).toBe('Rerun (no edits)')
  })

  it('derives the between-runs edit summary from scenario events', () => {
    const events = [
      { event_type: 'direct_edit', timestamp: '2026-07-20T10:30:00.000Z', details: {} },
    ] as unknown as ScenarioEvent[]
    const snapshots = buildSnapshotsFromPersistedRuns(
      [
        makePersistedRunFactRow({ id: 'a', responseHash: 'h-a', createdAt: '2026-07-20T10:00:00.000Z' }),
        makePersistedRunFactRow({ id: 'b', responseHash: 'h-b', createdAt: '2026-07-20T11:00:00.000Z' }),
      ],
      events,
    )
    expect(snapshots[1].editSummary).toBe('Edited model')
  })
})
