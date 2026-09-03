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
 * STILL DISABLED, HONESTLY: edge strength / likelihood / direction and the goal
 * target. They have no authority entry point, so `editConnectedIds` keeps their
 * affordances disabled with a label saying so. Wiring them through a local-only
 * write instead would recreate F6 on the surface built to kill it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { typography } from '../../styles/typography'
import type { EdgeData } from '../domain/edges'
import { focusEdgeById, focusNodeById } from '../utils/focusHelpers'
import { resolveValueInputSeed } from '../conversation/factorValueEdit'
import { useModelEditAuthority } from '../hooks/useModelEditAuthority'
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
  type ModelProjectionInput,
} from './adapters'
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
  /** What the row displayed when the edit began — the `from` of the proposal. */
  from: string
}

export function ModelTabV2Panel({
  nodes,
  edges,
  goalThreshold,
  fragileEdgeIds,
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
  const [interventionEdit, setInterventionEdit] = useState<
    { optionId: string; factorId: string; draft: string } | null
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
   * The rows whose edit has a canonical transaction at this tip: factors.
   * Derived from the NODES (kind), not from the row's `editable` flag — that
   * flag states what the design intends to be editable; this set states what
   * the frozen transaction path can actually carry today.
   */
  const editConnectedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const node of nodes) if (nodeKind(node) === 'factor') ids.add(node.id)
    return ids as ReadonlySet<string>
  }, [nodes])

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
  const activeAuthorityNodeId = edit?.rowId ?? interventionEdit?.optionId ?? null
  const authority = useModelEditAuthority(activeAuthorityNodeId)

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
        ? { phase: 'editing', draft: edit.draft }
        : { phase: 'proposed', from: edit.from, to: edit.draft }
    return new Map<string, EditCommitState>([[edit.rowId, state]])
  }, [edit])

  const beginEdit = useCallback(
    (rowId: string) => {
      const row = rows.find(r => r.id === rowId)
      if (!row) return
      const node = nodes.find(n => n.id === rowId)
      if (!node) return
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
    [rows, nodes],
  )

  const changeDraft = useCallback((rowId: string, draft: string) => {
    setEdit(prev => (prev && prev.rowId === rowId ? { ...prev, draft } : prev))
  }, [])

  const proposeEdit = useCallback((rowId: string) => {
    setEdit(prev => {
      if (!prev || prev.rowId !== rowId) return prev
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
      const num = parseFloat(edit.draft)
      if (!Number.isFinite(num)) return
      // The canonical transaction. Whatever the outcome, the edit state
      // clears: on `dispatched`/`local_only` the store now shows the
      // optimistic value (and the dispatcher owns refusal-revert); on
      // `not_encodable` nothing was written anywhere — fail closed, and the
      // row honestly shows the unchanged model.
      authority.proposeFactorValue(num)
      setEdit(null)
    },
    [edit, authority],
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
      setInterventionEdit({ optionId: selectedId, factorId, draft: seed })
    },
    [selectedId],
  )

  const changeInterventionDraft = useCallback((factorId: string, draft: string) => {
    setInterventionEdit(prev => (prev && prev.factorId === factorId ? { ...prev, draft } : prev))
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

      authority.proposeOptionIntervention(factorId, num)
      setInterventionEdit(null)
    },
    [interventionEdit, authority, selectedDetail],
  )

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
          interventionEdit={
            OPTION_INTERVENTION_CONNECTED && interventionEdit && interventionEdit.optionId === selectedRow.id
              ? { factorId: interventionEdit.factorId, draft: interventionEdit.draft }
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
