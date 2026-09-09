/**
 * ModelTabV2Panel — the Model Editor v2's mount host (16 Aug 2026 mount train).
 *
 * THE ONE FILE IN THIS DIRECTORY THAT IS ALLOWED TO TOUCH THE LIVE APP. The
 * render components (`ModelOutline` / `ModelRowView` / `ModelDetailRegion` /
 * `RepairQueueList`) stay pure projections; this container:
 *
 *   · takes the model AS PROPS from `ModelTabBody` (no store subscription of
 *     its own — the tab already holds nodes/edges/fragility, and a second
 *     subscription would be a second render authority);
 *   · builds the row/detail projections through `adapters.ts`;
 *   · owns the ONE active edit's state machine
 *     (idle → editing → proposed → dispatched-and-idle);
 *   · dispatches every write through `useModelEditAuthority` — the canonical
 *     factor-value transaction (event build → optimistic undo → sanctioned
 *     setter → `sendSystemEvent` with the undo riding the send). NOTHING here
 *     writes the store or the wire directly; the boundary guard enforces it.
 *
 * WHY THERE IS NO `inflight`/`applied` RENDER THIS TRAIN, stated so nobody
 * "fixes" it into a lie: the canonical dispatcher resolves refusal/acceptance
 * CENTRALLY (revert on refusal, stamp on acceptance) and hands back no receipt
 * — so after Confirm the row returns to rendering the STORE, which is
 * optimistic-then-authoritative, exactly as the v1 factor chip behaves. A row
 * that showed "applied" from its own echo would be an optimistic write wearing
 * a confirmation (contracts.ts §1 C11). When the receipt-bearing transaction
 * API lands, the three-beat's tail states plug in at `useModelEditAuthority`.
 *
 * EDIT COVERAGE AT THIS TIP (widened 18 Aug 2026, the REHOME → DELETE lane):
 *   · FACTOR VALUES — the reference canonical transaction, server-backed.
 *   · OPTION INTERVENTION TARGETS — in the detail region of the selected option.
 *   · FACTOR CONFIRMATION — the row's Confirm chip, stamping `user_confirmed`.
 * The last two are LOCAL COMMITS with no wire carrier, dispatched through the
 * same authority; see `useModelEditAuthority`'s header for why that does not
 * re-open design §2 F6 and for the outcome type that makes an over-claim
 * unrepresentable.
 *
 *   · RELATIONSHIP STRENGTH — added 2026-09-08, server-backed, AND GATED PER
 *     EDGE. See below.
 *
 * ⚠⚠ THE PARAGRAPH BELOW WAS TRUE UNTIL 2026-09-08 AND IS NARROWED, NOT DELETED,
 * because its reasoning still governs the three that remain:
 *
 *   ~~STILL DISABLED, HONESTLY: edge strength / likelihood / direction and the
 *   goal target. They have no authority entry point, so `editConnectedIds` keeps
 *   their affordances disabled with a label saying so. Wiring them through a
 *   local-only write instead would recreate F6 on the surface built to kill
 *   it.~~
 *
 * Goal minimum-target editing now uses the existing typed add_constraint
 * authority: explicit absolute level/unit → review → confirm → server receipt.
 * Other disabled controls remain unchanged. No goal value is written locally
 * before acknowledgement.
 *
 * ⭐ EDGE STRENGTH GRADUATED BECAUSE IT GAINED A CARRIER, not because the rule
 * was relaxed. `edge_strength_edit` has had a CEE writer since Train C and, since
 * #1287/#1295, a UI emitter at `useEdgeMutations.setStrength` with an `expected`
 * tuple that is recorded at INGESTION rather than read off a locally-mutated
 * field. `proposeEdgeStrength` is its entry point here.
 *
 * ⚠⚠ AND THE GATE IS PER EDGE, WHICH IS THE ONE THING TO GET RIGHT ON THIS
 * SURFACE. `expected` is an assertion about what the SERVER holds, so an edge the
 * server never stated a strength for has no assertable `expected`: the builder
 * returns null, the edit would land LOCAL-ONLY, and enabling the affordance there
 * would recreate precisely the F6 the paragraph above refuses. Those rows keep
 * their existing disabled affordance and their label. Two relationship rows in
 * one list may therefore differ, and that is the design rather than an
 * inconsistency — the surface offers an editor exactly where the write lands.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { typography } from '../../styles/typography'
import type { EdgeData } from '../domain/edges'
import { focusEdgeById, focusNodeById } from '../utils/focusHelpers'
import { resolveValueInputSeed } from '../conversation/factorValueEdit'
import { edgeStrengthEditIsAssertable } from '../conversation/edgeStrengthEdit'
import { useCanvasStore } from '../store'
import { useModelEditAuthority } from '../hooks/useModelEditAuthority'
import { resolveGoalTarget } from '../domain/goalTarget'
import { resolveNodeTypeLiteral } from '../domain/nodes'
import { buildManualGoalTarget } from '../conversation/manualGoalTarget'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '../mutations/mutationAuthority'
import { ValueProvenanceKey } from './ValueProvenanceKey'
import { ModelOutline } from './ModelOutline'
import { ModelDetailRegion } from './ModelDetailRegion'
import { RepairQueueList } from './RepairQueueList'
import { REPAIR_QUEUE } from './rowPresentation'
import type { GroupAction, GroupActionContext } from './groupActions'
import {
  toModelRows,
  toRepairQueueItems,
  toRowDetail,
  nodeKind,
  resolveEdgeStrengthEditSeed,
  type ModelProjectionInput,
} from './adapters'
import { MODEL_GROUP_IDS, type ModelGroupId } from './types'
import type { DetailTier, EditCommitState, RepairQueue } from './types'

export interface ModelTabV2PanelProps {
  nodes: Node[]
  edges: Edge[]
  /** RAW user units — the store scalar, never converted here. */
  goalThreshold: number | null
  /**
   * Fragile edge ids from the robustness report. Pass `undefined` when no
   * analysis has run: nothing is then KNOWN to be fragile, and no row claims
   * otherwise.
   */
  fragileEdgeIds?: ReadonlySet<string>
  /** A group a deep link wants open; forwarded straight to `ModelOutline`. */
  openGroupRequest?: ModelGroupId | null
  /**
   * Hand a turn to Olumi, having FRONTED the conversation first.
   *
   * ⚠ ABSENT MEANS THE GROUP AFFORDANCES DO NOT RENDER. `ModelTabBody` builds
   * this with `createOlumiHandOff`, which returns `null` when no sender exists —
   * so "no conversation" propagates as "no button", never as a button that
   * swallows the turn. This panel does NOT import the fronting primitive itself:
   * the mount host owns every live-app seam, which is what keeps this directory's
   * boundary guard meaningful.
   */
  onHandOffToOlumi?: (message: string, reason: string) => void
}

/**
 * The queues that are actually MOUNTED AND WIRED at this tip.
 *
 * ⚠ NARROWER THAN `RepairQueue['id']` ON PURPOSE. `REPAIR_QUEUE` is total over
 * all four queues — correct for the definitions table — but only
 * `confirm-estimates` has a write carrier (`proposeFactorConfirmation`). Typing
 * the panel's state to the total union would make `'contested'` look sanctioned
 * when nothing renders it. Adding a queue here is a deliberate act, not a
 * discovery in a diff.
 */
type MountedQueueId = Extract<RepairQueue['id'], 'confirm-estimates'>

// B3 emergency policy: only receipt-bearing GraphV3 edits may mount as model
// controls. These two paths are deliberate local-only writes at this tip, so
// their existing code remains available for a future carrier but no affordance
// can invoke it now.
const FACTOR_CONFIRMATION_CONNECTED = hasServerGraphAuthority(
  CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation,
)
const OPTION_INTERVENTION_CONNECTED = hasServerGraphAuthority(
  CANONICAL_EDIT_AUTHORITY.modelOptionIntervention,
)

/** One active edit at a time — the row the user is currently changing. */
interface ActiveEdit {
  rowId: string
  phase: 'editing' | 'proposed'
  draft: string
  unit?: string
  scenarioId?: string | null
  notice?: string
  /** What the row displayed when the edit began — the `from` of the proposal. */
  from: string
}

export function ModelTabV2Panel({
  nodes,
  edges,
  goalThreshold,
  fragileEdgeIds,
  openGroupRequest,
  onHandOffToOlumi,
}: ModelTabV2PanelProps) {
  const [tier, setTier] = useState<DetailTier>('plain')
  /**
   * Which repair queue the user is standing in, if any.
   *
   * ⚠ A MODE, NOT A SECOND LIST. Design §5.3: a queue is *a filtered view of
   * the same outline* — "there is only ever one rendering of a row". Rendering
   * the queue BESIDE the outline would put the same factor on screen twice,
   * which is precisely the defect this whole consolidation exists to remove;
   * doing it inside the fix would be the defect class reproduced one layer up.
   * So the queue REPLACES the outline while it is open, and one control
   * returns.
   *
   * ⚠⚠ AND THE SCOPE OF THAT CLAIM, STATED BECAUSE THE COMMIT THAT INTRODUCED
   * THIS OVERSTATED IT. What is true HERE is that this panel renders a row once:
   * the branch above is structurally exclusive and the spec pins the outline rows
   * absent in queue mode, with a before-click contrast control.
   *
   * ⚠⚠ THE PARAGRAPH THAT USED TO SIT HERE IS FALSE AND IS CORRECTED BELOW
   * (26 Aug 2026). It read: *"`ModelTabBody.tsx` renders `FactorsSection`
   * unconditionally, outside this panel, in the same scroll — so a queued
   * factor appears in the queue AND in its v1 factor card."* **It does not.**
   *
   * `ModelTabBody.tsx:120` declares `const LEGACY_DETAILED_EDITOR_MOUNTED =
   * false`, and `:917` gates the ENTIRE v1 section stack behind it
   * (`{LEGACY_DETAILED_EDITOR_MOUNTED && (<section data-testid="model-tab-v1-stack">…)}`).
   * esbuild folds the constant, so Goal/Options/Factors/Relationships/Risks are
   * dead-code-eliminated — they are not merely hidden, they are not shipped.
   * Verified at the DEPLOYED bundle (staging `f287c012`, 81 chunks crawled):
   * `factor-card-`, `factors-add-cta`, `attribution-stability-pill` and
   * `range-derivation-badge` all read ZERO, while positive controls in the same
   * sweep fired (`option-card-` ×2 — both from live RESULTS components —
   * `model-scientific-transparency`, `model-tab-v2-panel`). So this panel IS
   * the sole rendering of a row, and the consolidation invariant HOLDS.
   *
   * ⚠ HOW THE FALSE VERSION SURVIVED, because that is the reusable part: the
   * JSX for those sections really does sit at `ModelTabBody.tsx:972`/`:981`
   * with no local condition. Reading the call site WITHOUT its enclosing guard
   * at `:917` produces exactly the sentence above — and a later reader who
   * greps for `<FactorsSection` reproduces the same mistake. A comment that
   * describes a mount MUST name the guard, not just the call site.
   *
   * A spec that renders THIS COMPONENT can never settle either version (trap 3b
   * — bound to a component, not to the surface the deployed tab mounts), which
   * is why the deployed-bundle sweep above, not a green suite, is the evidence
   * cited here. Re-derive it rather than inheriting this paragraph.
   */
  const [activeQueue, setActiveQueue] = useState<MountedQueueId | null>(null)
  /**
   * ⚠ ONE PREDICATE, DERIVED ONCE (F7). Two independent tests for "am I in a
   * queue" (`activeQueue === 'confirm-estimates'` for the body,
   * `activeQueue === null` for the detail region) were equivalent ONLY because
   * exactly one id was settable. `REPAIR_QUEUE` is total over four ids, which
   * makes the other three LOOK sanctioned — and setting one would have rendered
   * the outline AND suppressed the detail region. `MountedQueueId` narrows the
   * state to what is actually wired, so the two readings cannot diverge.
   */
  const inQueue = activeQueue !== null
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Subscribed, not read once: a pending effect edit must notice a scenario
  // switch beneath it rather than settle against a different model.
  const currentScenarioId = useCanvasStore(st => st.currentScenarioId)
  // Subscribed for the same reason as the scenario id: a refusal that names an
  // action has to notice when the action has happened.
  const lastServerGraphHash = useCanvasStore(st => st.lastServerGraphHash)
  const [edit, setEdit] = useState<ActiveEdit | null>(null)
  /**
   * The one intervention target being edited, if any.
   *
   * ⚠ IT CARRIES ITS OWN `optionId` AND IS CLEARED ON SELECTION CHANGE. Without
   * that, selecting a different option while an edit was open would leave a
   * draft addressed to the previous option's factor — the authority would still
   * refuse it (the factor is not the new option's), but the user would be
   * looking at their number in a box that no longer means what it says.
   */
  /**
   * ⭐ `phase` AND `notice` EXIST BECAUSE CLOSING THE ROW IS A CLAIM.
   *
   * This state was `{optionId, factorId, draft}` and the commit closed it
   * unconditionally. With no wire carrier that was harmless — the local write
   * always succeeded. Now the gesture is a turn, and closing the row on a
   * REFUSAL tells the user their edit went through when nothing was sent; while
   * closing it on a DISPATCH claims the model holds a number the server has not
   * acknowledged yet. Both are the same lie in opposite directions, and both are
   * the harm this surface's own notice exists to avoid.
   *
   * So the row stays open and says which of the three things happened:
   *   · `editing` — the user is typing.
   *   · `pending` — the turn is with the server. The value is NOT in the model
   *     yet and the row does not pretend otherwise.
   *   · a `notice` on `editing` — nothing was sent, and this is why.
   */
  const [interventionEdit, setInterventionEdit] = useState<
    {
      optionId: string
      factorId: string
      draft: string
      phase: 'editing' | 'pending' | 'queued'
      notice?: string
      /** The exact number sent, so the settlement below compares like with like. */
      sentValue?: number
      /** The scenario the send belongs to. A pending state must not outlive it. */
      sentScenarioId?: string | null
      /**
       * ⭐ SET ONLY BY THE `needs_fresh_base` REFUSAL, and it is what makes that
       * notice CURRENT rather than merely true-when-written.
       *
       * The notice names an action — a turn refreshes the base — so the moment
       * the base actually arrives it is stale, and a stale instruction is worse
       * than none: the user has already done the thing and the row still tells
       * them to do it. Flagged rather than matched on the copy, because
       * recognising a state by the sentence it renders is how a copy edit
       * silently unwires behaviour.
       */
      awaitingFreshBase?: boolean
    } | null
  >(null)

  const projection: ModelProjectionInput = useMemo(
    () => ({
      nodes,
      edges: edges as Edge<EdgeData>[],
      goalThreshold,
      fragileEdgeIds,
    }),
    [nodes, edges, goalThreshold, fragileEdgeIds],
  )

  const rows = useMemo(() => toModelRows(projection), [projection])

  /**
   * ⚠ THE CHIP AND THE QUEUE ARE THE SAME DERIVATION, so they cannot disagree.
   * The count on the chip IS `confirmItems.length` — not a second predicate
   * that happens to agree today. The current tab ships the opposite: a
   * "N to verify" badge whose N counts factors the user has no way to reach.
   * This is the first time that badge does anything (design §7.2).
   */
  const confirmItems = useMemo(
    () => toRepairQueueItems(projection, 'confirm-estimates'),
    [projection],
  )

  /**
   * The rows whose edit has a canonical transaction at this tip: factors, and
   * the relationships whose strength the server has actually stated.
   *
   * Derived from the NODES and EDGES themselves, never from the row's `editable`
   * flag — that flag states what the design intends to be editable; this set
   * states what the frozen transaction path can actually carry today. The
   * docstring is kept true by the two derivations below rather than by anybody
   * remembering to update it.
   *
   * ⚠⚠ THE EDGE ARM IS PER EDGE, AND THE ASYMMETRY WITH THE FACTOR ARM IS THE
   * POINT. A factor's value has a wire carrier for EVERY reachable value, so the
   * factor arm can key on KIND alone. An edge's does not: `edge_strength_edit`
   * carries an `expected` tuple asserting what the SERVER holds, and for an edge
   * the server never stated a strength for there is nothing truthful to put
   * there. `buildEdgeStrengthEditEvent` refuses those, the edit would land
   * LOCAL-ONLY, and offering the editor anyway is design §2 F6 — the harm this
   * whole surface exists to remove. So the gate asks PER EDGE, and a
   * non-qualifying relationship keeps the disabled affordance it has today.
   *
   * ⚠ THE PREDICATE IS THE EMITTER'S OWN, ASKED — NOT COPIED. `edgeStrengthEditIsAssertable`
   * puts the question to `buildEdgeStrengthEditEvent`, so this panel holds no
   * second copy of the endpoint-id rule, the magnitude domain or the
   * server-stated-`expected` requirement, and cannot drift out of agreement with
   * the thing that actually builds the event (CLAUDE.md trap 12).
   *
   * ⚠ EDGES THAT ARE NOT RELATIONSHIP ROWS ARE INERT HERE, not a leak. `toModelRows`
   * admits only `getCausalEdges`, so an id added for a non-causal edge matches no
   * row and reaches no affordance; ids are set membership, and this set is only
   * ever read BY ROW ID.
   */
  const selectedRow = useMemo(
    () => (selectedId === null ? null : rows.find(r => r.id === selectedId) ?? null),
    [rows, selectedId],
  )
  const selectedDetail = useMemo(
    () => (selectedId === null ? null : toRowDetail(projection, selectedId)),
    [projection, selectedId],
  )

  /**
   * What a group action may quote back to the user.
   *
   * ⚠ DERIVED FROM THE RENDERED GOAL ROW, not from `goalThreshold` or the store.
   * The v1 goal hand-off quoted `displayThreshold` — the value that section was
   * displaying. The equivalent here is the value THIS outline is displaying, so
   * the sentence and the screen cannot disagree (preamble P5: a claim about the
   * model is grounded in the state the user is actually shown).
   */
  const groupActionContext: GroupActionContext = useMemo(() => {
    const goalRow = rows.find(r => r.kind === 'goal') ?? null
    return {
      goalLabel: goalRow?.label ?? null,
      goalTarget: goalRow?.primaryValue ?? null,
    }
  }, [rows])

  const handleGroupAction = useCallback(
    (action: GroupAction, message: string) => {
      onHandOffToOlumi?.(message, `model-tab-v2:${action.id}`)
    },
    [onHandOffToOlumi],
  )

  /**
   * ⚠ ONE AUTHORITY, KEYED ON WHICHEVER NODE THE ACTIVE GESTURE BELONGS TO.
   *
   * The value three-beat addresses the row being typed into; an intervention
   * edit addresses the OPTION that owns it; a confirmation addresses the row
   * the user pressed Confirm on, which is resolved at the call site. A second
   * `useModelEditAuthority(...)` call for the second gesture would be a second
   * writer of the same kind — the defect this whole change removes, recreated
   * inside the fix. The precedence below is total and the two states are
   * mutually exclusive in practice: beginning either clears the other.
   */
  /*
   * ⚠ AN EDGE ROW'S id IS AN EDGE id, AND IT MUST NOT ARRIVE IN THE NODE SLOT.
   * `edit.rowId` is a node id for a factor row and an edge id for a relationship
   * row — one field, two identity spaces — so the row's KIND decides which
   * parameter it fills. Passing an edge id as `activeNodeId` would key
   * `useNodeMutations` to an element that does not exist: harmless today only by
   * luck, and exactly the kind of wrong-kind addressing the two-parameter
   * authority was widened to make unrepresentable.
   */
  const editingRelationshipId =
    edit !== null && rows.find(r => r.id === edit.rowId)?.kind === 'relationship'
      ? edit.rowId
      : null
  const activeAuthorityNodeId =
    editingRelationshipId !== null
      ? (interventionEdit?.optionId ?? null)
      : (edit?.rowId ?? interventionEdit?.optionId ?? null)
  const authority = useModelEditAuthority(activeAuthorityNodeId, editingRelationshipId)
  const editConnectedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const node of nodes) {
      if (nodeKind(node) === 'factor' || (resolveNodeTypeLiteral(node) === 'goal' &&
          hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.modelGoalMinimumTarget) && authority.goalTargetDispatchAvailable)) ids.add(node.id)
    }
    for (const edge of edges) if (edgeStrengthEditIsAssertable(edge)) ids.add(edge.id)
    return ids as ReadonlySet<string>
  }, [nodes, edges, authority.goalTargetDispatchAvailable])

  /**
   * The confirmation authority for ONE row.
   *
   * ⚠ IT IS A SEPARATE HOOK CALL BECAUSE IT ADDRESSES A DIFFERENT NODE, not
   * because it is a different kind of write. `useModelEditAuthority` is
   * node-parameterised exactly as `useNodeMutations` is, and Confirm fires on a
   * row the user has NOT entered an edit on — so there is no active edit whose
   * node it could borrow. Hooks cannot be called per row, so the host tracks the
   * row whose confirmation is pending and dispatches on the next render.
   */
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null)
  const confirmAuthority = useModelEditAuthority(pendingConfirmId)
  useEffect(() => {
    if (pendingConfirmId === null) return
    confirmAuthority.proposeFactorConfirmation()
    setPendingConfirmId(null)
  }, [pendingConfirmId, confirmAuthority])

  /**
   * ⚠ F8 — RESOLVING THE LAST ITEM RETURNS YOU TO THE OUTLINE.
   *
   * The chip only renders when the count is non-zero, so an empty queue cannot
   * be ENTERED; it can only be arrived at by clearing the last item. Leaving the
   * user there replaces the whole outline with "Nothing needs attention here."
   * and, because the chip is suppressed while a queue is open, the only way out
   * is a control they have no reason to look for. Finishing the job should not
   * look like a dead end.
   *
   * The count falls on the HOST's re-render — this panel holds no store
   * subscription by design — which is exactly when this fires.
   */
  useEffect(() => {
    if (activeQueue === 'confirm-estimates' && confirmItems.length === 0) setActiveQueue(null)
  }, [activeQueue, confirmItems.length])

  /** Rows are nodes OR edges — focus each with the helper that owns its kind. */
  const focusOnCanvas = useCallback(
    (id: string) => {
      if (nodes.some(n => n.id === id)) focusNodeById(id)
      else focusEdgeById(id)
    },
    [nodes],
  )

  const commitByRowId = useMemo(() => {
    if (edit === null) return undefined
    const state: EditCommitState =
      edit.phase === 'editing'
        ? { phase: 'editing', draft: edit.draft, ...(edit.unit !== undefined ? { unit: edit.unit } : {}) }
        : { phase: 'proposed', from: edit.from,
            ...(edit.notice ? { notice: edit.notice } : {}),
            to: edit.unit !== undefined ? `At least ${edit.draft} ${edit.unit} (absolute level)` : edit.draft }
    return new Map<string, EditCommitState>([[edit.rowId, state]])
  }, [edit])

  const beginEdit = useCallback(
    (rowId: string) => {
      const row = rows.find(r => r.id === rowId)
      if (!row) return

      /*
       * ⚠ A RELATIONSHIP ROW SEEDS FROM ITS EDGE, NOT FROM A NODE. `rowId` is an
       * EDGE id here, so the node lookup below would miss and the editor would
       * never open — which is exactly why relationship rows were inert before
       * they had a carrier, and why this branch has to exist rather than the
       * node path being loosened.
       *
       * ⭐ THE SEED IS THE NUMBER THE ROW IS ALREADY SHOWING, resolved by
       * `resolveEdgeStrengthEditSeed` — the same function `edgeValue` builds the
       * row's own label from. The user therefore opens the editor on the value
       * they were just reading, and the two cannot disagree, because they are one
       * derivation and not two that happen to agree today.
       *
       * ⚠ IT IS **NOT** SEEDED FROM `expected`. The server-stated tuple is what
       * the wire ASSERTS ABOUT THE PAST; the seed is what this canvas is showing
       * now, which may legitimately differ (a local edit already made). Seeding
       * from `expected` would put a number on screen that the row is not
       * displaying — and `expected` keeps its own, separate derivation at the
       * builder, where it belongs.
       */
      if (row.kind === 'relationship') {
        const edge = edges.find(e => e.id === rowId)
        const seeded = resolveEdgeStrengthEditSeed(edge?.data as Record<string, unknown> | undefined)
        // Fail CLOSED. `editConnectedIds` should have kept this row's affordance
        // shut, so arriving here with nothing to seed means the two derivations
        // disagree — open nothing rather than an editor over a blank.
        if (seeded === null) return
        setEdit({
          rowId,
          phase: 'editing',
          draft: String(seeded.seed),
          from: row.primaryValue ?? 'Not set',
        })
        return
      }

      const node = nodes.find(n => n.id === rowId)
      if (!node) return
      if (row.kind === 'goal') {
        const target = resolveGoalTarget(node.data)
        setEdit({ rowId, phase: 'editing', draft: target ? String(target.raw) : '',
          unit: target?.unit ?? '', scenarioId: authority.captureScenarioId(),
          from: target ? `${target.raw}${target.unit ? ` ${target.unit}` : ''}` : 'Not set' })
        return
      }
      // THE one seed rule (`resolveValueInputSeed`, default `raw_or_value`
      // basis): the input shows `raw_value ?? value`, exactly as the inspector
      // panel and the v1 Model-tab chips do. A second copy of that rule is how
      // the scale ambiguity re-opens, so it is imported, never re-derived.
      const { seed } = resolveValueInputSeed(node.data)
      setEdit({
        rowId,
        phase: 'editing',
        draft: seed === undefined ? '' : String(seed),
        from: row.primaryValue ?? 'Not set',
      })
    },
    [rows, nodes, edges, authority],
  )

  const changeDraft = useCallback((rowId: string, draft: string, unit?: string) => {
    setEdit(prev => (prev && prev.rowId === rowId ? { ...prev, draft, ...(unit !== undefined ? { unit } : {}) } : prev))
  }, [])

  const proposeEdit = useCallback((rowId: string) => {
    setEdit(prev => {
      if (!prev || prev.rowId !== rowId) return prev
      if (prev.unit !== undefined && !buildManualGoalTarget(rowId, prev.draft, prev.unit)) return prev
      // Intent must parse before it can be proposed. An unparseable draft
      // stays in `editing` — nothing to confirm, nothing to send.
      const num = parseFloat(prev.draft)
      if (!Number.isFinite(num)) return prev
      return { ...prev, phase: 'proposed' }
    })
  }, [])

  const discardEdit = useCallback((rowId: string) => {
    setEdit(prev => (prev && prev.rowId === rowId ? null : prev))
  }, [])

  const confirmEdit = useCallback(
    (rowId: string) => {
      if (!edit || edit.rowId !== rowId || edit.phase !== 'proposed') return
      if (edit.unit !== undefined) {
        if (authority.proposeGoalTarget(edit.draft, edit.unit, edit.scenarioId ?? null) === 'dispatched') setEdit(null)
        else setEdit({ ...edit, notice: 'Target not sent. Reopen the target in the current model; your proposed value is shown here.' })
        return
      }
      const num = parseFloat(edit.draft)
      if (!Number.isFinite(num)) return

      /*
       * ⭐ A RELATIONSHIP ROW COMMITS THROUGH `proposeEdgeStrength`, and it is a
       * DIFFERENT OPERATION rather than the factor one pointed at an edge: the
       * carrier is `edge_strength_edit`, the identity is the edge's `(from, to)`
       * pair, and the outcome vocabulary has a state the factor path does not.
       *
       * ⚠⚠ `directionStated` IS DERIVED FROM THE EDGE, NEVER FROM THE SIGN OF
       * WHAT THE USER TYPED. The contract's own words: *"a MAGNITUDE CANNOT
       * CARRY A SIGN"* — reading `num < 0` as a direction claim is precisely the
       * fabrication it forbids, and at zero it is not even ambiguous, it is
       * unrepresentable (`-0 >= 0` is `true`).
       *
       * The honest source is the one the ROW ITSELF speaks from:
       * `resolveEdgeStrengthEditSeed`, i.e. `resolveEdgeDirectionDisplay`. Where
       * a direction is stated the row reads "… positive effect", the seed is
       * SIGNED, and typing a signed number restates that direction. Where none
       * is, the row reads "… effect, direction not stated", the seed is a bare
       * MAGNITUDE, and the authority preserves the absent direction rather than
       * minting one — the edge goes on saying "direction not stated", which is
       * exactly the outcome the contract prescribes.
       *
       * ⚠ SO A MINUS TYPED INTO A MAGNITUDE-ONLY ROW SETS THE SIZE AND NOTHING
       * ELSE, disclosed here rather than left to be discovered: this surface
       * offers no direction control, so a sign typed into it states nothing the
       * product may act on. Giving relationships a direction affordance needs
       * `proposeEdgeDirection`, which has no carrier — see the file header.
       */
      if (editingRelationshipId === rowId) {
        const edge = edges.find(e => e.id === rowId)
        const seeded = resolveEdgeStrengthEditSeed(edge?.data as Record<string, unknown> | undefined)
        if (seeded === null) {
          setEdit(null)
          return
        }
        // Fail CLOSED on anything the wire cannot carry: `proposeEdgeStrength`
        // returns `refused_unassertable` and writes NOTHING, so the row keeps
        // showing the unchanged model rather than a local value dressed as saved.
        authority.proposeEdgeStrength(rowId, num, { directionStated: seeded.directionStated })
        setEdit(null)
        return
      }

      // The canonical transaction. Whatever the outcome, the edit state
      // clears: on `dispatched`/`local_only` the store now shows the
      // optimistic value (and the dispatcher owns refusal-revert); on
      // `not_encodable` nothing was written anywhere — fail closed, and the
      // row honestly shows the unchanged model.
      authority.proposeFactorValue(num)
      setEdit(null)
    },
    [edit, authority, editingRelationshipId, edges],
  )

  /**
   * Ratify an AI estimate as correct — the v1 Confirm ✓, rehomed.
   *
   * Beginning a confirmation CLEARS any open edit: they are two states of one
   * row and holding both would leave a draft the user can no longer see.
   */
  const confirmValueAsIs = useCallback((rowId: string) => {
    setEdit(null)
    setInterventionEdit(null)
    setPendingConfirmId(rowId)
  }, [])

  const beginInterventionEdit = useCallback(
    (factorId: string, seed: string) => {
      if (selectedId === null) return
      setEdit(null)
      setInterventionEdit({ optionId: selectedId, factorId, draft: seed, phase: 'editing' })
    },
    [selectedId],
  )

  const changeInterventionDraft = useCallback((factorId: string, draft: string) => {
    setInterventionEdit(prev => {
      if (!prev || prev.factorId !== factorId) return prev
      // Typing clears a stale refusal: a notice about the PREVIOUS number, left
      // beside a new one, is a sentence about something the user cannot see.
      const { notice: _cleared, ...rest } = prev
      return { ...rest, draft }
    })
  }, [])

  const discardInterventionEdit = useCallback(() => setInterventionEdit(null), [])

  const commitIntervention = useCallback(
    (factorId: string) => {
      if (!interventionEdit || interventionEdit.factorId !== factorId) return
      const num = parseFloat(interventionEdit.draft)
      // Fail CLOSED, exactly as the value three-beat does: an unparseable draft
      // stays open rather than committing something the user did not state.
      if (!Number.isFinite(num)) return

      /*
       * ⚠ A RE-TYPED IDENTICAL NUMBER IS NOT A CHANGE — and the comparison is
       * NUMERIC, not lexical.
       *
       * This is `InlineEdit.hasChanged` rehomed rather than reinvented. That
       * guard exists because of a specific adversarial finding: a bare string
       * compare made `3e4` for `30000`, or `0.40` for `0.4`, read as an edit on
       * the Model tab and as a no-op in the inspector — two surfaces disagreeing
       * about whether the user did anything. Here the cost of getting it wrong
       * is a store write and a `direct_graph_edit` notification for a change
       * that never happened: the product telling CEE the model moved when it
       * did not.
       *
       * The old editor's intervention rows had this guard because they went
       * through `InlineEdit`. This editor does not, so it carries the rule
       * explicitly — otherwise the removal of the old one would quietly delete
       * a correctness property nobody listed as a capability.
       */
      const current = selectedDetail?.interventions?.find(iv => iv.factorId === factorId)
      if (current?.numericValue !== null && current?.numericValue === num) {
        setInterventionEdit(null)
        return
      }

      // ⚠ THE OUTCOME IS READ, NOT DISCARDED. This line used to be
      // `authority.propose…(); setInterventionEdit(null)` — the row closed
      // whatever happened, so a refusal looked exactly like a success.
      // ⚠ THE PENDING STATE IS SET BEFORE THE SEND, NOT AFTER, AND THAT ORDER IS
      // A CORRECTNESS DETAIL RATHER THAN A STYLE ONE. The settlement callback
      // fences on the value we sent; if the state were written after the call,
      // a settlement resolving on the same microtask would find `sentValue`
      // still undefined and be dropped — the row would hang on "sent" forever
      // for exactly the fastest cases.
      const scenarioAtSend = useCanvasStore.getState().currentScenarioId
      setInterventionEdit(prev =>
        prev && prev.factorId === factorId
          ? { ...prev, phase: 'pending', sentValue: num, sentScenarioId: scenarioAtSend, notice: undefined }
          : prev,
      )

      const outcome = authority.proposeOptionIntervention(factorId, num, {
        // Two of the sender's three answers mean the turn has NOT happened.
        // Without reading them the row said "sent" over an edit that was queued
        // behind another turn, or one that was never queued at all.
        onSendSettled: settlement => {
          setInterventionEdit(prev => {
            // Fenced by factor AND by the value we sent: a settlement arriving
            // after the user has moved on must not relabel their new draft with
            // an old send's outcome.
            if (!prev || prev.factorId !== factorId || prev.sentValue !== num) return prev
            if (settlement === 'queued') return { ...prev, phase: 'queued' }
            if (settlement === 'blocked') {
              return {
                ...prev,
                phase: 'editing',
                notice: 'Not sent — another change is still in flight. Try again in a moment.',
              }
            }
            // ⭐ THE OTHER WAY PENDING ENDS. The canonical settlement below
            // covers the APPLIED half — the value lands in the store and the
            // row clears. These two are the refused half, and without them a
            // server answer of "no" left the row saying "sent, not saved yet"
            // for the rest of the session: a stuck label, the same class of
            // harm as the optimistic write this surface replaced.
            if (settlement === 'refused') {
              // Proven no-write. For this event the certified category is a
              // stale base — CEE refuses before any write and hands back the
              // current hash. The recovery is the one that actually refreshes
              // the base, and it is the SAME action `needs_fresh_base` names,
              // because it is the same problem arriving one moment later.
              const { sentValue: _v, sentScenarioId: _s, ...rest } = prev
              return {
                ...rest,
                phase: 'editing',
                notice:
                  'Not saved — the model moved on while this was in flight. ' +
                  'Ask me anything about this decision, then set this value again.',
              }
            }
            if (settlement === 'unverified') {
              // ⚠ NEITHER SAVED NOR REFUSED, AND THE COPY MAY NOT PICK ONE. The
              // server failed the turn and a write is not ruled out. Saying
              // "not saved" would invite the user to re-send a number the model
              // may already hold; saying "saved" is the lie the whole surface
              // exists to avoid. The row keeps the number visible, says what is
              // actually known, and names the action that SHOWS them the answer
              // rather than guessing it.
              const { sentValue: _v, sentScenarioId: _s, ...rest } = prev
              return {
                ...rest,
                phase: 'editing',
                notice:
                  "Sent, but I could not confirm what the model did with it. " +
                  'Ask me anything about this decision to see where it stands.',
              }
            }
            // `sent`: the turn was issued. The row stays pending until the
            // CANONICAL store carries the value — this hook does not echo its
            // own number back as a confirmation.
            return prev
          })
        },
      })

      if (outcome === 'dispatched') return

      setInterventionEdit(prev => {
        if (!prev || prev.factorId !== factorId) return prev
        const { sentValue: _v, sentScenarioId: _s, ...rest } = prev
        if (outcome === 'needs_fresh_base') {
          // The one refusal the user can clear. The action named is the ONE that
          // actually refreshes the base — a turn — inherited from the
          // delete/add/rename family rather than re-reasoned: "try again"
          // re-sends the same stale base forever, and a reload builds a fresh
          // store with no server hash at all.
          return {
            ...rest,
            phase: 'editing',
            awaitingFreshBase: true,
            notice:
              'Not sent yet — I need to re-sync with the saved model first. ' +
              'Ask me anything about this decision, then set this value again.',
          }
        }
        return {
          ...rest,
          phase: 'editing',
          notice: 'Not sent: an effect value has to be between 0 and 1 on the model scale.',
        }
      })
    },
    [interventionEdit, authority, selectedDetail],
  )

  /**
   * ⭐⭐ THE CANONICAL SETTLEMENT — what ENDS a pending state.
   *
   * `pending` had no way to finish. The row said "sent, not saved yet" and then
   * said it forever, whatever the server did, because nothing was watching for
   * the answer. A state that can only be entered is not a state, it is a stuck
   * label — and the harm is the same class as the optimistic write it replaced:
   * a row telling the user something about their model that stopped being true.
   *
   * ⚠ THE SETTLEMENT IS THE CANONICAL STORE, NEVER AN ECHO. It clears when the
   * projected value for THIS option and THIS factor equals the number that was
   * sent — i.e. when the applied response has actually carried it into the
   * model the rest of the surface reads. This hook never confirms its own send:
   * "an authority that echoed its own typed value back as an 'applied' receipt
   * would be an optimistic write wearing a confirmation".
   *
   * ⚠ AND IT IS FENCED THREE WAYS, because a pending state that survives the
   * wrong context is worse than none: by OPTION and FACTOR (identity, never
   * position), and by SCENARIO — switching scenario mid-flight must not let a
   * value arriving in a different model close a row about this one.
   */
  useEffect(() => {
    if (interventionEdit === null) return
    if (interventionEdit.phase !== 'pending' && interventionEdit.phase !== 'queued') return
    if (interventionEdit.sentValue === undefined) return
    if (interventionEdit.sentScenarioId !== currentScenarioId) {
      // The model changed underneath the send. Say so rather than guessing what
      // happened to it in a scenario this row is no longer about.
      setInterventionEdit(prev =>
        prev && prev.phase !== 'editing'
          ? {
              ...prev,
              phase: 'editing',
              notice: 'The scenario changed while that was sending, so I can’t confirm it landed here.',
            }
          : prev,
      )
      return
    }
    if (interventionEdit.optionId !== selectedId) return
    const landed = selectedDetail?.interventions?.find(
      iv => iv.factorId === interventionEdit.factorId,
    )
    if (landed?.numericValue === interventionEdit.sentValue) setInterventionEdit(null)
  }, [interventionEdit, selectedDetail, selectedId, currentScenarioId])

  /**
   * ⭐ THE RECOVERY ACTUALLY COMPLETING — the other end of `needs_fresh_base`.
   *
   * That refusal is an instruction: run a turn and this clears. Nothing was
   * watching for the turn, so the instruction stayed on screen after the user
   * had followed it — the row telling them to do something they had just done,
   * beside a number that would now send perfectly well. Truthful when written
   * and false a second later is the same defect class as a pending state with
   * no exit, and this surface has now had both.
   *
   * ⚠ IT CLEARS THE NOTICE, NOT THE DRAFT. The number the user typed stays in
   * the box, because it is still what they meant; only the reason it could not
   * go is gone. Re-sending it for them would be a decision the user did not
   * make — the base is fresh now, but the model it describes has moved, which
   * is exactly why the base was stale.
   */
  useEffect(() => {
    if (!interventionEdit?.awaitingFreshBase) return
    if (typeof lastServerGraphHash !== 'string' || lastServerGraphHash.length === 0) return
    setInterventionEdit(prev =>
      prev?.awaitingFreshBase
        ? { ...prev, awaitingFreshBase: false, notice: undefined }
        : prev,
    )
  }, [interventionEdit?.awaitingFreshBase, lastServerGraphHash])

  /**
   * ⚠ SELECTING A DIFFERENT ROW ABANDONS AN OPEN INTERVENTION DRAFT. See
   * `interventionEdit`'s declaration: a draft outliving its option is a number
   * shown in a box that no longer addresses it.
   */
  const selectRow = useCallback((id: string) => {
    setSelectedId(prev => {
      if (prev !== id) setInterventionEdit(null)
      return id
    })
  }, [])

  return (
    <section
      data-testid="model-tab-v2-panel"
      aria-label="Model outline"
      className="flex flex-col gap-2 border border-panel-border rounded-lg p-2"
    >
      <header className="flex items-center gap-2 flex-wrap">
        <h3 className={`${typography.panelHeader} text-text-header`}>Model outline</h3>
        <input
          data-testid="model-tab-v2-filter"
          type="search"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter the model…"
          aria-label="Filter the model"
          className={`${typography.bodySmall} flex-1 min-w-[10rem] bg-panel-hover border border-panel-border rounded px-2 py-1`}
        />
        {/*
          The tier control, IN the tab (design §4.3 rule 3). A content switch
          only: `ModelOutline`'s layout function takes no tier argument, so
          flipping this cannot reorder, open or close anything.
        */}
        {/* The key for the row marks, beside the tier control — the marks are
            useless as a code until something states what they mean. */}
        <ValueProvenanceKey />
        <div
          role="group"
          aria-label="Detail tier"
          data-testid="model-tab-v2-tier-toggle"
          className="inline-flex rounded border border-panel-border overflow-hidden"
        >
          <button
            type="button"
            data-testid="model-tab-v2-tier-plain"
            aria-pressed={tier === 'plain'}
            onClick={() => setTier('plain')}
            className={`${typography.buttonSmall} px-2 py-0.5 ${
              tier === 'plain' ? 'bg-panel-hover text-text-header' : 'text-text-light'
            }`}
          >
            Plain
          </button>
          <button
            type="button"
            data-testid="model-tab-v2-tier-advanced"
            aria-pressed={tier === 'advanced'}
            onClick={() => setTier('advanced')}
            className={`${typography.buttonSmall} px-2 py-0.5 ${
              tier === 'advanced' ? 'bg-panel-hover text-text-header' : 'text-text-light'
            }`}
          >
            Advanced
          </button>
        </div>
      </header>

      {/*
        THE ATTENTION CHIP — the first time "N to verify" is a control.
        Rendered only when the count is non-zero: a chip reading "0 to verify"
        is furniture, and the queue behind it would be empty.
      */}
      {FACTOR_CONFIRMATION_CONNECTED && confirmItems.length > 0 && !inQueue && (
        <button
          type="button"
          data-testid="model-tab-v2-chip-confirm-estimates"
          onClick={() => setActiveQueue('confirm-estimates')}
          className={`${typography.buttonSmall} self-start rounded border border-panel-border px-2 py-0.5 text-text-header hover:bg-panel-hover`}
        >
          {confirmItems.length === 1 ? '1 to verify' : `${confirmItems.length} to verify`}
        </button>
      )}

      {inQueue && FACTOR_CONFIRMATION_CONNECTED ? (
        <>
          <button
            type="button"
            data-testid="model-tab-v2-queue-back"
            onClick={() => setActiveQueue(null)}
            className={`${typography.buttonSmall} self-start rounded border border-panel-border px-2 py-0.5 text-text-header hover:bg-panel-hover`}
          >
            Back to the model outline
          </button>
          <RepairQueueList
            queue={REPAIR_QUEUE['confirm-estimates']}
            items={confirmItems}
            onFocusOnCanvas={focusOnCanvas}
            /*
              ⚠ THE SAME AUTHORITY CALL AS THE ROW'S CONFIRM CHIP, not a second
              implementation of confirming. `confirmValueAsIs` routes to
              `useModelEditAuthority.proposeFactorConfirmation`, so the queue and
              the row stamp `user_confirmed` through ONE path. Two entry points
              to one edit is the design; two implementations of one edit is the
              defect being removed.
            */
            onApply={confirmValueAsIs}
            applyLabel="Confirm"
          />
        </>
      ) : (
      <ModelOutline
        /* ⭐ THE OUTLINE OPENS AS AN OUTLINE.
           `initiallyClosedGroups` has existed since this component was written
           and NOTHING has ever passed it, so all seven groups rendered open:
           measured on deployed staging with a real analysis, 8 of 9 expanded
           regions and 1,817px of scroll before the reader has chosen anything.
           That is a dump, not disclosure.

           Closing them costs NO information, which is the only reason this is
           safe: the collapsed header already carries the group name, the row
           COUNT, and `unsetSummary` — "2 with no value yet" — all derived from
           the same fields the rows read. So the closed state IS the model at a
           glance, and one click opens the part the reader wants.

           ⚠ NOT the piecemeal pattern. Each of these seven hides a real list,
           not a sentence; the complaint being answered is twelve small doors
           each buying one line. Level 1 is the shape of the model, level 2 is
           the rows. */
        initiallyClosedGroups={MODEL_GROUP_IDS}
        openGroupRequest={openGroupRequest}
        rows={rows}
        tier={tier}
        filter={filter}
        selectedId={selectedId}
        onSelect={selectRow}
        onFocusOnCanvas={focusOnCanvas}
        commitByRowId={commitByRowId}
        editConnectedIds={editConnectedIds}
        onBeginEdit={beginEdit}
        onDraftChange={changeDraft}
        onProposeEdit={proposeEdit}
        onDiscardEdit={discardEdit}
        onConfirmEdit={confirmEdit}
        onConfirmValueAsIs={FACTOR_CONFIRMATION_CONNECTED ? confirmValueAsIs : undefined}
        onGroupAction={onHandOffToOlumi ? handleGroupAction : undefined}
        groupActionContext={groupActionContext}
      />
      )}

      {!inQueue && selectedRow !== null && selectedDetail !== null && (
        <ModelDetailRegion
          row={selectedRow}
          detail={selectedDetail}
          tier={tier}
          onFocusOnCanvas={focusOnCanvas}
          /*
           * ⚠⚠ FORWARD THE PHASE AND THE NOTICE. This projected exactly
           * `{factorId, draft}`, so the two fields that carry the honest
           * outcome were dropped on the way to the only component that renders
           * them: the row could NEVER show pending or a refusal, whatever the
           * commit decided.
           *
           * ⭐ AND THE TEST THAT SHOULD HAVE CAUGHT IT COULD NOT. Injecting
           * `interventionEdit` straight into the child asserts the child's
           * rendering and says nothing about what the parent sends — a whole
           * seam between two green halves. That is why the controls for this now
           * drive the REAL panel, not the child alone.
           */
          interventionEdit={
            OPTION_INTERVENTION_CONNECTED && interventionEdit && interventionEdit.optionId === selectedRow.id
              ? {
                  factorId: interventionEdit.factorId,
                  draft: interventionEdit.draft,
                  phase: interventionEdit.phase,
                  ...(interventionEdit.notice !== undefined
                    ? { notice: interventionEdit.notice }
                    : {}),
                }
              : null
          }
          onBeginInterventionEdit={OPTION_INTERVENTION_CONNECTED ? beginInterventionEdit : undefined}
          onInterventionDraftChange={OPTION_INTERVENTION_CONNECTED ? changeInterventionDraft : undefined}
          onCommitIntervention={OPTION_INTERVENTION_CONNECTED ? commitIntervention : undefined}
          onDiscardInterventionEdit={OPTION_INTERVENTION_CONNECTED ? discardInterventionEdit : undefined}
        />
      )}
    </section>
  )
}
