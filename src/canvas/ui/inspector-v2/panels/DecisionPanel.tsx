/**
 * DecisionPanel — Inspector for decision nodes (spec §5, v6.2 three-group layout)
 * Organisational node — no mathematical parameters.
 * Groups: Context → Options (input) → Connections
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { typography } from '../../../../styles/typography'
import { controls } from '../../../../styles/controls'
import { inspectorButton, inspectorDetailRow, INSPECTOR_RULE } from '../inspectorStyle'
import { useNodeMutations } from '../useInspectorMutations'
import { detectBaseline } from '../../../utils/baselineDetection'
import { formatWinProbability } from '../../../utils/labelUtils'
import {
  GROUP_LABELS,
  DESCRIPTION_PLACEHOLDERS,
  DECISION_STRINGS,
  EMPTY_STATES,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { ConnectionRow } from '../shared/ConnectionRow'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'
import { DecisionAdvancedEditor } from '../editors/DecisionAdvancedEditor'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import type { EdgeValueDisplay } from '../../../domain/edgeValueProvenance'
import { resolveElementLabel } from '../../../domain/elementLabel'

/**
 * ⭐⭐ "+ Add option" — THE ONE DECISION CONTROL THAT SAVES, RENDERED WHERE A
 * USER CAN REACH IT.
 *
 * It lived inside `DecisionPanel`'s options card, and `'decision'` is not in
 * `InspectorRouter`'s `AUTHORITY_OWNING_PANELS`, so the Router wrapped it in
 * `<fieldset disabled>` with the rest of the pane. A disabled fieldset natively
 * inerts every descendant `<button>`: coded, tested in isolation
 * (`DecisionPanel.addOption.spec.tsx` renders the panel directly, past the
 * fence), and dead for every user.
 *
 * ⭐ WHY IT MAY LEAVE THE FENCE — A CARRIER, NOT A PREFERENCE. The gesture is
 * `addNodeWithEdge(pos, 'option', decisionId, 'from-target')`, the same store
 * action as the canvas context menu's "Add option", and that action captures a
 * durable `structural_add` intent for the new option (`store.addNodeWithEdge`,
 * "CAPTURED, AS OF 18 Sep 2026"), which `useStructuralAddEvents` puts on the
 * wire and CEE classifies `'mutating'`. That is the same admission test the
 * header rename passed to sit outside the boundary.
 *
 * ⚠ THE LINK HALF IS NOT CLAIMED. `addNodeWithEdge` gives the new link no
 * stated strength, so its `structural_add_edge` capture stands down at
 * `strength_not_stated` and records that on the edge, exactly as for every other
 * "Add connected …" gesture (`structuralAdd.connectedAddIsDurable.spec.ts`).
 * Nothing here says otherwise.
 *
 * ⛔ IT IS EXPORTED FOR THE ROUTER'S `quickActions` SLOT AND RENDERED NOWHERE
 * ELSE. That slot sits above the fenced body, beside the rename. Moving only
 * this control is what keeps every other decision control fenced — adding
 * `'decision'` to `AUTHORITY_OWNING_PANELS` would have released the whole pane
 * to close one gap.
 */
export function DecisionAddOption({ decisionId }: { decisionId: string }) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === decisionId))
  const addNodeWithEdge = useCanvasStore(s => s.addNodeWithEdge)
  const focusNode = useCanvasStore(s => s.selectNodeWithoutHistory)

  // Create a new option node linked to this decision, then focus it in the
  // inspector. Same store action the canvas context-menu "Add option" uses
  // (addNodeWithEdge(pos, 'option', decisionId, 'from-target') → edge
  // decision → option). addNodeWithEdge enforces the node/edge limits and
  // no-ops at the cap (returns a LimitExceeded object rather than a string).
  const handleAddOption = useCallback(() => {
    if (!node) return
    const pos = { x: node.position.x + 80, y: node.position.y + 120 }
    const result = addNodeWithEdge(pos, 'option', node.id, 'from-target')
    if (typeof result === 'string') focusNode(result)
  }, [node, addNodeWithEdge, focusNode])

  if (!node) return null

  // v3.1: drawn as the contract's `.button.small`, in the SAME row as the
  // inspector's conversation buttons (one button style across the inspector).
  return (
    <button
      type="button"
      onClick={handleAddOption}
      data-testid="decision-add-option"
      className={inspectorButton}
    >
      + Add option
    </button>
  )
}

export const DecisionPanel = memo(function DecisionPanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'
  const optionComparison = useCanvasStore(s => s.results?.report?.option_comparison)

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')

  const [description, setDescription] = useState(String(node?.data?.description ?? ''))
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  // Connected options — stored with raw winProb for formatWinProbability().
  //
  // ⚠ BOTH DIRECTIONS, and it was outbound-only (review D3). The canvas's
  // `isValidConnection` lets a user draw `option → decision`, and such an edge
  // fell through BOTH lists: excluded here by `source === nodeId`, and
  // excluded from `otherConnections` below by its option kind. The panel then
  // reported "No connections yet." while the canvas plainly drew the edges —
  // the very L-40 contradiction this file was changed to close, surviving in
  // the direction the first corpus never drew.
  const connectedOptions = useMemo(() => {
    const seen = new Set<string>()
    return edges
      .filter(e => e.source === nodeId || e.target === nodeId)
      .map(e => {
        const otherId = e.source === nodeId ? e.target : e.source
        const optNode = nodes.find(n => n.id === otherId)
        if (!optNode) return null
        const kind = (optNode.type || optNode.data?.kind) as string
        if (kind !== 'option') return null
        // An option joined in BOTH directions is ONE connection to the user,
        // not two. Dedupe by the option's node id, not by edge id.
        if (seen.has(otherId)) return null
        seen.add(otherId)
        // Cast to `unknown` (not `number`) — interventions may be V3 objects
        // ({ value, source, ... }) or plain numbers. Only the key count is read
        // here, but the type should not lie about the value shape.
        const ivs = (optNode.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
        const ivCount = ivs ? Object.keys(ivs).length : 0
        const label = resolveElementLabel(optNode.data)
        // Explicit `is_baseline` wins; regex fallback only fires when the flag is
        // absent — mirrors OptionNode.tsx / OptionPanel.tsx.
        const explicitIsBaseline = (optNode.data as { is_baseline?: boolean | null })?.is_baseline
        const isBaseline = explicitIsBaseline ?? detectBaseline(label).isBaseline
        // Raw win probability — formatted via formatWinProbability() at render.
        const rawWinProb = optionComparison && Array.isArray(optionComparison)
          ? (optionComparison as Array<{ option_id: string; win_probability?: number }>).find(o => o.option_id === otherId)?.win_probability
          : undefined
        return {
          nodeId: otherId,
          label,
          ivCount,
          isBaseline,
          winProb: typeof rawWinProb === 'number' ? rawWinProb : undefined,
        }
      })
      .filter(Boolean) as Array<{ nodeId: string; label: string; ivCount: number; isBaseline: boolean; winProb?: number }>
  }, [edges, nodes, nodeId, optionComparison])

  // Non-option connections (edges where decision is source/target and other end is not an option).
  // Options belong in the Input group; other connections (if any) go here.
  const otherConnections = useMemo(() => {
    return edges
      .filter(e => e.source === nodeId || e.target === nodeId)
      .map(e => {
        const otherId = e.source === nodeId ? e.target : e.source
        const otherNode = nodes.find(n => n.id === otherId)
        if (!otherNode) return null
        const kind = (otherNode.type || otherNode.data?.kind) as NodeType
        if (kind === 'option') return null
        return {
          edgeId: e.id,
          nodeId: otherId,
          nodeKind: kind,
          label: resolveElementLabel(otherNode.data),
          strength: resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined),
        }
      })
      .filter(Boolean) as Array<{
        edgeId: string
        nodeId: string
        nodeKind: NodeType
        label: string
        strength: EdgeValueDisplay
      }>
  }, [edges, nodes, nodeId])

  // Decision framing from brief data
  const briefData = (node?.data as Record<string, unknown>)?.brief as Record<string, string> | undefined

  if (!nodeId || !node) return null

  return (
    <div>
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {description || isEditingDescription ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => {
              mutations.setDescription(description)
              if (!description.trim()) setIsEditingDescription(false)
            }}
            autoFocus={isEditingDescription && !description}
            placeholder={DESCRIPTION_PLACEHOLDERS.decision}
            rows={2}
            maxLength={500}
            className={`${typography.panelBody} ${controls.editableTextarea}`}
          />
        ) : (
          <EmptyDescriptionPrompt
            placeholder={DESCRIPTION_PLACEHOLDERS.decision}
            onStartEditing={() => setIsEditingDescription(true)}
          />
        )}

        {/* v3.1: the brief's framing as detail rows, not a box. */}
        {briefData && (briefData.who || briefData.timeframe || briefData.constraint) && (
          <div className="mt-2">
            {briefData.who && <div className={inspectorDetailRow}><span className="text-text-light">Who decides</span><span className="text-right text-text-body">{briefData.who}</span></div>}
            {briefData.timeframe && <div className={inspectorDetailRow}><span className="text-text-light">Timeframe</span><span className="text-right text-text-body">{briefData.timeframe}</span></div>}
            {briefData.constraint && <div className={inspectorDetailRow}><span className="text-text-light">Key constraint</span><span className="text-right text-text-body">{briefData.constraint}</span></div>}
          </div>
        )}
      </PanelGroup>

      {/* ── Alternatives (options list) ───────────────────────── */}
      {/* ⭐ v3.1 (DESIGN-GAP-v31 row 32): "the Question inspector must not list
          all options under 'Your input'". The options are not the user's
          input to the question; they are its ALTERNATIVES, and that is what the
          group now says. The rows stay navigable (each opens its option) and
          are flat detail rows — the bordered card around them is gone. */}
      <PanelGroup kind="alternatives" label={GROUP_LABELS.alternatives}>
        {/* ⚠ RENDERED ONLY WHEN THERE ARE OPTIONS TO LIST. The card used to end
            with the "+ Add option" row, which kept it non-empty on a decision
            with no options; that control now lives in the Router's
            `quickActions` slot (see `DecisionAddOption`), where a user can
            reach it. An empty bordered card would be a box with nothing in it. */}
        {connectedOptions.length > 0 && (
        <PrimaryControlCard>
          {/* Flat option rows — the contract's hairline rule between rows. */}
          {connectedOptions.map((opt) => (
            <div
              key={opt.nodeId}
              role="button"
              tabIndex={0}
              onClick={() => onNavigate(opt.nodeId)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(opt.nodeId) } }}
              className={`py-2 cursor-pointer hover:bg-panel-hover transition-colors border-b ${INSPECTOR_RULE.row} last:border-b-0`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <NodeShapeIndicator nodeKind="option" size={14} />
                  <span className={`${typography.panelBody}`}>{opt.label}</span>
                  {opt.isBaseline && (
                    <span className={`${typography.panelMeta} px-2 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
                      Baseline
                    </span>
                  )}
                </div>
                {isResultsMode && opt.winProb != null && (
                  <span className={`${typography.panelMeta} text-text-body tabular-nums`}>
                    {formatWinProbability(opt.winProb)}
                  </span>
                )}
              </div>
              {isResultsMode && opt.winProb != null && (
                <div className="mt-1.5">
                  <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round(opt.winProb * 100)}%`, background: 'var(--option)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </PrimaryControlCard>
        )}

        <InspectorCoaching
          elementId={nodeId}
          panelType="decision"
          fallbackText={COACHING.decisionOptions}
          labelContext={{ label: String(node.data?.label ?? '') }}
        />
      </PanelGroup>

      {/* ── Connections group (non-option edges) ──────────────── */}
      <PanelGroup kind="connections" label={GROUP_LABELS.connections}>
        {otherConnections.map(conn => (
          <ConnectionRow
            key={conn.edgeId}
            nodeKind={conn.nodeKind}
            label={conn.label}
            strength={conn.strength}
            fullLabel
            techMode={techMode}
            onClick={() => onNavigate(conn.nodeId)}
          />
        ))}
        {/* L-40 — `otherConnections` EXCLUDES option edges by design (options
            live in the Input group above), so a decision whose only edges are
            its options used to render a flat "No connections yet." while the
            canvas drew every one of them. The empty state is now derived from
            the SAME edge data the options list reads, and names where those
            connections went instead of denying them. */}
        {otherConnections.length === 0 && (
          connectedOptions.length > 0 ? (
            <p
              data-testid="decision-connections-are-options"
              className={`${typography.panelMeta} text-text-light`}
            >
              {DECISION_STRINGS.connectionsAreOptions
                .replace('{count}', String(connectedOptions.length))
                .replace('{s}', connectedOptions.length === 1 ? '' : 's')}
            </p>
          ) : (
            <p className={`${typography.panelMeta} text-text-light`}>{EMPTY_STATES.noConnectionsFlat}</p>
          )
        )}
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <DecisionAdvancedEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})
