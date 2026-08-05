/**
 * ROADMAP 2.590 — export → import must not silently destroy node.data fields.
 *
 * DEFECT: `V2SnapshotSchema` (migrations.ts) parses each node's `data` with a
 * z.discriminatedUnion of eight per-type object schemas. Zod object schemas
 * default to `unknownKeys: 'strip'`, so EVERY field outside the ~8-13 keys each
 * per-type schema declares is discarded on import — silently, with no error.
 * `exportCanvas` writes them; `importCanvas` eats them.
 *
 * The parser discards what the renderers read. `src/canvas/nodes/GoalNode.tsx`
 * reads `props.data?.goal_threshold_raw` / `goal_threshold_unit` /
 * `success_threshold` / `threshold_source` — not one of which is declared by any
 * schema in that union.
 *
 * ── Why THREE guards, and what each one alone cannot prove ────────────────────
 * Trap 12d: a guard derived from a list proves the copies agree, never that the
 * list is right. Trap 13b: a guard derived from the schema agrees with the
 * schema and sees nothing. So:
 *
 *   GUARD 1 (structural, INPUT-derived) — enumerates the keys actually present
 *     on a real export fixture and asserts every one survives, per node, BY ID.
 *     It cannot go short, because it is derived from the data rather than from
 *     any hand-maintained list. What it CANNOT do: notice a field the fixture
 *     does not happen to carry (the repo's export fixtures are all PRE-analysis,
 *     so none carries the goal threshold quad at all — which is exactly how this
 *     defect survived `roundtrip-2463.spec.ts`).
 *
 *   GUARD 2 (READER-derived corpus) — the hand-written completeness check that
 *     notices Guard 1's fixture is short. Every entry cites the reader that
 *     depends on the field. Values are producer-shaped (trap 13c: expectations
 *     derived from the producer, not from my reading of what a field ought to
 *     mean) — see `backfillGoalThresholdOntoGoalNode` (applyDraftResult.ts:592)
 *     and CEEAnalysisReady (adapters/cee/types.ts:392-397) for the goal quad.
 *
 *   GUARD 3 (union assertion) — `NODE_FIELD_REGISTRY` (analyticalNodeFields.ts)
 *     is an INDEPENDENT, reader-derived register of analysis/persist-relevant
 *     `data.*` fields. Asserting registry ⊆ round-trip-covered means a field
 *     added there can never sit un-round-tripped: the registry growing fails
 *     THIS test until the corpus covers it. Mirror-free — it is derived from an
 *     importable list, not hand-copied.
 */

import { describe, it, expect } from 'vitest'
import { exportCanvas, importCanvas } from '../../persist'
import { importSnapshot } from '../migrations'
import { deepEqual } from '../analyticalChange'
import { NODE_FIELD_REGISTRY } from '../analyticalNodeFields'
import { EDITOR_WRITTEN_FIELDS } from '../../ui/inspector-v2/useInspectorMutations'
import pristineExport from '../../__tests__/fixtures/walk582-t2b-export-pristine.json'

type AnyRec = Record<string, unknown>

function cloneFixture(): { nodes: any[]; edges: any[] } {
  const f = JSON.parse(JSON.stringify(pristineExport)) as { nodes: any[]; edges: any[] }
  return { nodes: f.nodes, edges: f.edges }
}

/** The real parse path: persist.exportCanvas → persist.importCanvas. */
function roundTrip(state: { nodes: any[]; edges: any[] }) {
  const json = exportCanvas(state as any)
  const back = importCanvas(json)
  expect(back, 'importCanvas returned null — the snapshot failed to parse at all').not.toBeNull()
  return back!
}

function dataById(result: { nodes: any[] }, id: string): AnyRec {
  const node = result.nodes.find((n) => n.id === id)
  expect(node, `node ${id} missing from import result`).toBeDefined()
  return (node!.data ?? {}) as AnyRec
}

// ---------------------------------------------------------------------------
// GUARD 2's corpus — READER-derived. Each row cites the consumer that breaks
// when the field does not survive. Node ids bind to walk582-t2b-export-pristine.
// ---------------------------------------------------------------------------
interface CorpusEntry {
  nodeId: string
  field: string
  value: unknown
  /** The reader that depends on this field surviving. */
  reader: string
}

const READER_CORPUS: readonly CorpusEntry[] = [
  // --- goal: the analysis-bearing quad + the user-target pair ---------------
  {
    nodeId: 'goal_turnout',
    field: 'goal_threshold_raw',
    value: 250000,
    reader: 'canvas/nodes/GoalNode.tsx:88 · adapters/plot/httpV1Adapter.ts:385 · components/results/useResultsSectionData.ts:1355',
  },
  {
    nodeId: 'goal_turnout',
    field: 'goal_threshold_unit',
    value: '£',
    reader: 'canvas/nodes/GoalNode.tsx:90 · canvas/ui/inspector-v2/editors/GoalAdvancedEditor.tsx:22 · canvas/components/model-tab/GoalSection.tsx:79',
  },
  {
    nodeId: 'goal_turnout',
    field: 'goal_threshold_cap',
    value: 312500,
    reader: 'canvas/hooks/useV2Run.ts:191 · components/results/useResultsSectionData.ts:1332 · canvas/ui/inspector-v2/editors/GoalAdvancedEditor.tsx:23',
  },
  {
    nodeId: 'goal_turnout',
    field: 'goal_threshold',
    value: 0.8,
    reader: 'canvas/ui/inspector-v2/editors/GoalAdvancedEditor.tsx:24 · V2 adapter output',
  },
  {
    nodeId: 'goal_turnout',
    field: 'success_threshold',
    value: 250000,
    reader: 'canvas/nodes/GoalNode.tsx:86 · canvas/store.ts:1301 · canvas/components/pre-analysis-v3/selectors/computeSuccessState.ts:111',
  },
  {
    nodeId: 'goal_turnout',
    field: 'threshold_source',
    value: 'user',
    reader: 'canvas/nodes/GoalNode.tsx:85 · canvas/store.ts:1301 · canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:1292',
  },
  // --- every kind: BaseNode is the shared wrapper for all eight renderers ---
  {
    nodeId: 'dec_venue',
    field: 'flagged_as_assumption',
    value: true,
    reader: 'canvas/nodes/BaseNode.tsx:278 · canvas/contextMenu/actions.ts',
  },
  {
    nodeId: 'out_attendance',
    field: 'uncertainty',
    value: 0.7,
    reader: 'canvas/nodes/BaseNode.tsx:127 (isUncertain badge)',
  },
  {
    nodeId: 'risk_logistics',
    field: 'unknownKind',
    value: true,
    reader: 'canvas/nodes/BaseNode.tsx:417 → UnknownKindWarning',
  },
  {
    nodeId: 'risk_logistics',
    field: 'originalKind',
    value: 'lever',
    reader: 'canvas/nodes/BaseNode.tsx:417-418 · canvas/adapters/backendKinds.ts',
  },
  // --- factor: top-level unit outranks observedState.unit ------------------
  {
    nodeId: 'fac_capacity',
    field: 'unit',
    value: 'people',
    reader: 'canvas/nodes/OptionNode.tsx:282,519 (`factorNode?.data?.unit ?? obs?.unit`)',
  },
  {
    nodeId: 'fac_capacity',
    field: 'state_space',
    value: { '0': 'low', '1': 'high' },
    reader: 'canvas/contextMenu/useMenuItems.ts:67 · canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:49',
  },
  // --- ephemeral-but-read session state ------------------------------------
  {
    nodeId: 'fac_weather',
    field: '_baseline_snapshot',
    value: { value: 12 },
    reader: 'canvas/contextMenu/actions.ts:544 · canvas/store.ts:3878',
  },
  // --- added because GUARD 3 named them: NODE_FIELD_REGISTRY carries these
  //     and the corpus did not cover them. That is the union assertion doing
  //     its job on its first run, not a post-hoc addition.
  {
    nodeId: 'goal_turnout',
    field: 'goalThreshold',
    value: 0.8,
    // NOT canvas/store.ts:1303 — that WRITES a same-named *store* field from
    // data.success_threshold; it never reads node.data.goalThreshold. The real
    // reader is the staleness gate iterating STALE_NODE_FIELDS.
    reader: 'canvas/domain/analyticalChange.ts:56 hasAnalyticalNodeChange (iterates STALE_NODE_FIELDS, which includes goalThreshold)',
  },
  {
    nodeId: 'risk_logistics',
    field: 'probability',
    value: 0.4,
    reader: 'canvas/nodes/RiskNode.tsx (props.data?.probability) · RiskPanel setProbability · V2 adapter',
  },
  {
    nodeId: 'risk_logistics',
    field: 'impact',
    value: 'high',
    reader: 'canvas/nodes/RiskNode.tsx (props.data?.impact) · RiskPanel setImpact',
  },
  // --- goal cap-fallback spellings. useV2Run reads three in priority order;
  //     stripping the fallbacks silently swallows %-unit targets (see the
  //     comment at useV2Run.ts:243-244).
  {
    nodeId: 'goal_turnout',
    field: 'threshold_cap',
    value: 100,
    reader: 'canvas/hooks/useV2Run.ts:192 · components/results/useResultsSectionData.ts:1333',
  },
  {
    nodeId: 'goal_turnout',
    field: 'scale_max',
    value: 1000,
    reader: 'canvas/hooks/useV2Run.ts:193 · components/results/useResultsSectionData.ts:1334',
  },
  {
    nodeId: 'goal_turnout',
    field: 'threshold',
    value: 0.75,
    reader: 'canvas/utils/editedSinceRun.ts:31 · components/results/useResultsSectionData.ts:1360',
  },
  {
    nodeId: 'goal_turnout',
    field: 'goal_confirmed',
    value: true,
    reader: 'canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:1471',
  },
  {
    nodeId: 'goal_turnout',
    field: 'threshold_confirmed',
    value: true,
    reader: 'canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:1328',
  },
  // --- snake_case observed state is read at the TOP level alongside the
  //     camelCase one; only the camelCase spelling is declared.
  {
    nodeId: 'fac_capacity',
    field: 'observed_state',
    value: { value: 400, unit: 'people' },
    reader: 'canvas/utils/observedStateHelpers.ts:39,53 · components/results/useResultsSectionData.ts:1287',
  },
  {
    nodeId: 'fac_capacity',
    field: 'uncertainty_drivers',
    value: ['seasonality'],
    reader: 'canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:51 (top-level read)',
  },
  {
    nodeId: 'opt_alpha',
    field: 'intervention_unit',
    value: '%',
    reader: 'canvas/components/InterventionDisplay.tsx:156,198,282',
  },
  {
    nodeId: 'opt_beta',
    field: 'locked',
    value: true,
    reader: 'canvas/store.ts:2751',
  },
  // --- added because GUARD 3's union was EXTENDED to EDITOR_WRITTEN_FIELDS.node.
  //     Both are written at the TOP LEVEL of node.data by live inspector
  //     setters. The original manifest recorded both only as members of
  //     ObservedStateSchema (which is .passthrough(), so the NESTED copies
  //     always survived) and never checked the top level — so both were being
  //     destroyed, and nothing in this spec would have noticed a regression.
  {
    nodeId: 'fac_capacity',
    field: 'extractionType',
    value: 'explicit',
    reader:
      'WRITER canvas/ui/inspector-v2/useInspectorMutations.ts:279 setExtractionType · READERS canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:789-792 ("extractionType has two storage locations… node.data.extractionType — factors edited via the inspector"), FactorObservableEditor.tsx:96, FactorControllableEditor.tsx:149',
  },
  {
    nodeId: 'fac_capacity',
    field: 'factor_type',
    value: 'continuous',
    reader:
      'WRITER canvas/ui/inspector-v2/useInspectorMutations.ts:285 setFactorType · named in analyticalNodeFields.ts as a hash-by-default persisted field',
  },
  // Also named by the widened GUARD 3 union. Unlike the two above, `description`
  // IS declared (on NodeDataSchema) and always survived — it was simply never
  // round-tripped by this spec. Covering it is the guard demanding COVERAGE, not
  // merely survival: an undeclared regression here would otherwise go unseen.
  {
    nodeId: 'dec_venue',
    field: 'description',
    value: 'Which venue maximises turnout?',
    reader:
      'WRITER canvas/ui/inspector-v2/useInspectorMutations.ts setDescription · READERS canvas/nodes/BaseNode.tsx:~ (data?.description), RiskNode.tsx, ActionNode.tsx',
  },
] as const

describe('2.590 — export → import must not silently destroy node.data fields', () => {
  // -------------------------------------------------------------------------
  // GUARD 1 — structural, derived from the INPUT. Cannot go short.
  // -------------------------------------------------------------------------
  describe('GUARD 1 (structural, input-derived): every key on every exported node survives, by id', () => {
    it('preserves every data key present on a real export fixture, per node id', () => {
      const state = cloneFixture()
      // MEASURED (review, M1 applied with the plant removed): this guard PASSES
      // on the bare fixture. Every key the fixture carries is declared, so the
      // fixture contributes ZERO undeclared-key discrimination — ALL of this
      // guard's teeth against 2.590 are the synthetic sentinel below. Guard 2's
      // corpus is therefore load-bearing, not a backstop. Do not delete the
      // plant on the theory that the real fixture already covers this.
      // NOT prefixed `__` — persist's deepSanitize drops `__`-prefixed keys.
      for (const n of state.nodes) {
        n.data = { ...(n.data ?? {}), rt_probe_2590: `probe:${n.id}` }
      }

      const before = new Map<string, AnyRec>(state.nodes.map((n) => [n.id, { ...(n.data as AnyRec) }]))
      const result = roundTrip(state)

      const losses: string[] = []
      for (const [id, beforeData] of before) {
        const afterData = dataById(result, id)
        for (const key of Object.keys(beforeData)) {
          if (!(key in afterData)) {
            losses.push(`${id}.data.${key} (destroyed)`)
          } else if (!deepEqual(afterData[key], beforeData[key])) {
            // deepEqual (domain/analyticalChange.ts) is the repo's own
            // key-ORDER-insensitive comparator. Order-sensitive comparison would
            // false-alarm here: a passthrough parse emits declared keys before
            // undeclared ones, so `observedState` comes back reordered with
            // identical values. Order carries no meaning on node data.
            losses.push(
              `${id}.data.${key} (mutated: ${JSON.stringify(beforeData[key])} → ${JSON.stringify(afterData[key])})`,
            )
          }
        }
      }
      expect(losses, `import destroyed or mutated node data:\n  ${losses.join('\n  ')}`).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // GUARD 2 — READER-derived corpus. This is what notices Guard 1's fixture is
  // short: the repo's export fixtures are all pre-analysis, so none of them
  // carries the goal threshold quad.
  // -------------------------------------------------------------------------
  describe('GUARD 2 (reader-derived corpus): fields real consumers read survive by exact key and value', () => {
    // Title form matters: vitest's `$`-matcher treats `$nodeId.data.$field` as a
    // PROPERTY PATH (`nodeId.data`), which is undefined, so every title rendered
    // "preserves undefined (…)" and the failure signature lost its identity.
    // `$nodeId data.$field` interpolates both.
    it.each(READER_CORPUS)(
      'preserves $nodeId data.$field (read by $reader)',
      ({ nodeId, field, value }) => {
        const state = cloneFixture()
        const target = state.nodes.find((n) => n.id === nodeId)
        expect(target, `corpus node id ${nodeId} not in fixture`).toBeDefined()
        target!.data = { ...(target!.data ?? {}), [field]: value }

        const after = dataById(roundTrip(state), nodeId)

        expect(field in after, `${nodeId}.data.${field} was destroyed by import`).toBe(true)
        expect(after[field]).toEqual(value)
      },
    )

    it('preserves the whole analysis-bearing goal quad together on goal_turnout, by exact key', () => {
      // The measured defect: a genuine export came back as exactly
      // {kind,label,provenance,type}. Producer shape per
      // backfillGoalThresholdOntoGoalNode (applyDraftResult.ts:592) +
      // CEEAnalysisReady (adapters/cee/types.ts:392-397).
      const state = cloneFixture()
      const goal = state.nodes.find((n) => n.id === 'goal_turnout')!
      goal.data = {
        ...(goal.data ?? {}),
        goal_threshold_raw: 250000,
        goal_threshold_unit: '£',
        goal_threshold_cap: 312500,
        threshold_source: 'user',
      }

      const after = dataById(roundTrip(state), 'goal_turnout')

      expect(after.goal_threshold_raw).toBe(250000)
      expect(after.goal_threshold_unit).toBe('£')
      expect(after.goal_threshold_cap).toBe(312500)
      expect(after.threshold_source).toBe('user')
    })
  })

  // -------------------------------------------------------------------------
  // OVER-WIDENING CONTROL — the fix must preserve unknown keys WITHOUT
  // weakening shape validation. Without these, "stop stripping" could silently
  // become "accept anything", which is a worse defect than the one being fixed.
  // -------------------------------------------------------------------------
  describe('over-widening control: shape validation is UNCHANGED', () => {
    it('still rejects a node whose discriminant is not a known node type', () => {
      const state = cloneFixture()
      // All THREE candidates must be invalid: normaliseSnapshotNodes (2.463)
      // canonicalises from [data.kind, data.type, node.type] and would otherwise
      // repair the discriminant from the untouched top-level ReactFlow type.
      // (Verified: leaving node.type='decision' makes this parse succeed — that
      // is pre-existing normaliser behaviour, unchanged by 2.590.)
      state.nodes[0].type = 'not_a_node_type'
      state.nodes[0].data = { ...(state.nodes[0].data as AnyRec), type: 'not_a_node_type', kind: 'not_a_node_type' }
      expect(importCanvas(exportCanvas(state as any))).toBeNull()
    })

    it('still rejects a node missing the required label', () => {
      const state = cloneFixture()
      const d = { ...(state.nodes[0].data as AnyRec) }
      delete d.label
      state.nodes[0].data = d
      // persist.sanitizeNodeData re-adds a label, so assert against the parser
      // directly — this control is about the SCHEMA, not the sanitiser.
      const raw = JSON.parse(exportCanvas(state as any))
      raw.nodes[0].data = d
      expect(importSnapshot(raw)).toBeNull()
    })

    it('still rejects an out-of-range typed field (utility outside -1..1)', () => {
      const state = cloneFixture()
      state.nodes[0].data = { ...(state.nodes[0].data as AnyRec), utility: 42 }
      expect(importCanvas(exportCanvas(state as any))).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // GUARD 3 — union assertion against an INDEPENDENT reader-derived register.
  // Mirror-free: derived from an importable list, never hand-copied.
  // -------------------------------------------------------------------------
  describe('GUARD 3 (union assertion): every externally-registered node field is round-trip covered', () => {
    it('registry ∪ editor-written node fields ⊆ fields this spec actually round-trips', () => {
      const covered = new Set<string>(READER_CORPUS.map((e) => e.field))
      // Guard 1 covers whatever the fixture carries, so count those too.
      for (const n of (pristineExport as { nodes: any[] }).nodes) {
        for (const k of Object.keys(n.data ?? {})) covered.add(k)
      }

      // TWO independent external registers, unioned. Neither is derived from
      // the Zod schemas, so neither can agree with the thing under test:
      //   • NODE_FIELD_REGISTRY   — analysis/persist relevance (staleness + autosave)
      //   • EDITOR_WRITTEN_FIELDS.node — what the live inspector setters WRITE,
      //     itself derived from NODE_SETTER_FIELDS and behaviourally guarded by
      //     useInspectorMutations.writtenFields.spec.tsx
      // The registry alone was SHORT: it carries neither `extractionType` nor
      // `factor_type`, both of which the inspector writes at the top level and
      // three consumers read. Union-ing the second register is what caught them
      // — a single derived list proves agreement, never completeness (12d).
      const required = [
        ...NODE_FIELD_REGISTRY.map((f) => f.field),
        ...EDITOR_WRITTEN_FIELDS.node,
      ]

      const uncovered = [...new Set(required)].filter((f) => !covered.has(f))
      expect(
        uncovered,
        `A field register grew but the 2.590 round-trip corpus did not: ` +
          `${uncovered.join(', ')}. Add each to READER_CORPUS with the reader that depends on it.`,
      ).toEqual([])
    })
  })
})
