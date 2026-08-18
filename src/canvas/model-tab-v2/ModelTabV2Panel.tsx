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
 * EDIT COVERAGE AT THIS TIP: factor values (the reference canonical
 * transaction). Rows whose edit class has NO canonical carrier — edge
 * strength / likelihood / direction, option interventions, the goal target —
 * render the honest disabled affordance (`editConnectedIds`). Wiring them
 * through a local-only write instead would recreate design §2 F6 on the
 * surface built to kill it.
 */

import { useCallback, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { typography } from '../../styles/typography'
import type { EdgeData } from '../domain/edges'
import { focusEdgeById, focusNodeById } from '../utils/focusHelpers'
import { resolveValueInputSeed } from '../conversation/factorValueEdit'
import { useModelEditAuthority } from '../hooks/useModelEditAuthority'
import { ModelOutline } from './ModelOutline'
import { ModelDetailRegion } from './ModelDetailRegion'
import type { GroupAction, GroupActionContext } from './groupActions'
import { toModelRows, toRowDetail, nodeKind, type ModelProjectionInput } from './adapters'
import type { DetailTier, EditCommitState } from './types'

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
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [edit, setEdit] = useState<ActiveEdit | null>(null)

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

  const authority = useModelEditAuthority(edit?.rowId ?? null)

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

  return (
    <section
      data-testid="model-tab-v2-panel"
      aria-label="Model outline"
      className="flex flex-col gap-2 border border-panel-border rounded-lg p-2"
    >
      <header className="flex items-center gap-2 flex-wrap">
        <h3 className={`${typography.h5} text-text-header`}>Model outline</h3>
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

      <ModelOutline
        rows={rows}
        tier={tier}
        filter={filter}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onFocusOnCanvas={focusOnCanvas}
        commitByRowId={commitByRowId}
        editConnectedIds={editConnectedIds}
        onBeginEdit={beginEdit}
        onDraftChange={changeDraft}
        onProposeEdit={proposeEdit}
        onDiscardEdit={discardEdit}
        onConfirmEdit={confirmEdit}
        onGroupAction={onHandOffToOlumi ? handleGroupAction : undefined}
        groupActionContext={groupActionContext}
      />

      {selectedRow !== null && selectedDetail !== null && (
        <ModelDetailRegion
          row={selectedRow}
          detail={selectedDetail}
          tier={tier}
          onFocusOnCanvas={focusOnCanvas}
        />
      )}
    </section>
  )
}
