/**
 * GraphPatchBlockRenderer — Renders a single graph_patch block inside
 * assistant messages. Extracted from InlineBlocks.tsx for maintainability.
 *
 * This component handles DISPLAY ONLY: state derivation, card labels, proposal
 * items, reveal-on-graph highlighting, and action button rendering.
 * Acceptance, dismissal, store mutation, and system event wiring remain in
 * ConversationPanel.tsx (the parent that provides onAccept/onDismiss).
 *
 * Typography (DS v5 §21.2): card header uses panelHeader (14px semibold) per
 * the panel token table — body (16px) would be oversized in the 360px card.
 * Summary/fallback text uses bodySmall (14px); the graphPatchSummary CSS
 * class applies text-body colour (not text-light) for readable contrast.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import { isAiPanelV2Enabled } from '../../../flags'
import { EntityLink } from '../components/EntityLink'
import { TargetRefPill } from '../components/TargetRefPill'
import type {
  GraphPatchBlock as GraphPatchBlockType,
  ProposalBlock as ProposalBlockType,
  BlockAction,
  ProposalReviewItem,
  RelatedElementRef,
} from '../types'
import type { PatchBlockState, PatchRejectionInfo } from '../useConversation'
import { extractTargetIdsFromPatch } from '../utils/extractTargetIds'
import { generateGraphHash } from '../../utils/graphHash'
import { resolvePatchBlockState } from '../selectors'
import { resolveCardState, getPatchCardLabels } from '../utils/getPatchCardLabels'
import { safeRichText, normaliseDashes } from '../../utils/safeRichText'
import { isOrchestratorRenderingV2Enabled } from '../../../flags'
import { describeOperation, RAW_ID_PATTERN } from '../friendlyOperation'
import type { DescribeOpDeps } from '../friendlyOperation'
import { BadgeIcon } from './BadgeIcon'
import styles from '../Conversation.module.css'

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Contextual fallback when CEE's block.summary is empty/absent. */
function getContextualFallback(block: GraphPatchBlockType): string {
  if (block.patch_type === 'full_draft') return 'Review the proposed model.'
  if (block.auto_apply === true) return 'Review the update below.'
  return 'Review the suggested change.'
}

const PROPOSAL_PREFIX_RE = /^Proposing to /i

/**
 * Defensive tense cleanup: once a card is accepted/auto-applied, CEE should
 * emit past-tense copy, but if a stale "Proposing to …" string slips through
 * we strip the prefix rather than show mismatched tense. Remove when CEE
 * reliably emits state-appropriate strings.
 */
function stripProposalPrefix(text: string, isApplied: boolean): string {
  if (!isApplied || !text || !PROPOSAL_PREFIX_RE.test(text)) return text
  console.warn('[UI-TENSE] Stripped proposal prefix on accepted card')
  return text.replace(PROPOSAL_PREFIX_RE, '')
}

function getProposalItems(block: GraphPatchBlockType): ProposalReviewItem[] {
  return Array.isArray(block.proposal_items) ? block.proposal_items.filter((item) => !!item?.description) : []
}

function getProposalItemsSource(block: GraphPatchBlockType): 'backend' | 'derived_ops' | null {
  return block.proposal_items_source === 'backend' || block.proposal_items_source === 'derived_ops'
    ? block.proposal_items_source
    : null
}

function extractGroundedTargets(relatedElements: RelatedElementRef[] | undefined): { nodeIds: string[]; edgeIds: string[] } {
  if (!Array.isArray(relatedElements) || relatedElements.length === 0) {
    return { nodeIds: [], edgeIds: [] }
  }
  const nodeIds = relatedElements
    .map((item) => item.node_id)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const edgeIds = relatedElements
    .map((item) => item.edge_id)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  return { nodeIds: [...new Set(nodeIds)], edgeIds: [...new Set(edgeIds)] }
}

/** DS §19 progressive disclosure: "More" / "Less" with border-left indent for operation rationale. */
function OperationRationale({ rationale }: { rationale: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className={styles.inlineDisclosureToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Show less rationale' : 'Show more rationale'}
      >
        {expanded
          ? <><ChevronUp size={12} aria-hidden="true" /> Less</>
          : <><ChevronDown size={12} aria-hidden="true" /> More</>}
      </button>
      {expanded && (
        <div className="mt-2 pl-3 border-l-2 border-panel-border">
          <p className={`${typography.panelMeta} text-text-light`}>{rationale}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GraphPatchBlockRendererProps {
  block: GraphPatchBlockType
  turnId?: string
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onAccept?: (patchId: string, block: GraphPatchBlockType) => void
  onDismiss?: (patchId: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphPatchBlockRenderer({
  block,
  turnId,
  patchBlockStates,
  patchRejections,
  onAccept,
  onDismiss,
}: GraphPatchBlockRendererProps) {
  const [showViolations, setShowViolations] = useState(false)
  const [showStalenessWarning, setShowStalenessWarning] = useState(false)
  const [showProposalDetails, setShowProposalDetails] = useState(false)
  const highlightTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearHighlightTimeouts = useCallback(() => {
    highlightTimeoutsRef.current.forEach(clearTimeout)
    highlightTimeoutsRef.current = []
  }, [])

  useEffect(() => {
    return () => {
      clearHighlightTimeouts()
    }
  }, [clearHighlightTimeouts])

  const stateKey = turnId ? `${turnId}:${block.patch_id}` : block.patch_id
  const blockState = resolvePatchBlockState(block, patchBlockStates, stateKey)
  const rejectionInfo = patchRejections?.get(stateKey) ?? null
  const isAutoApplied = block.auto_apply === true
  const resolvedState: PatchBlockState = blockState
  const isSettled = resolvedState !== 'proposed'

  const canvasNodes = useCanvasStore(s => s.nodes)
  const canvasEdges = useCanvasStore(s => s.edges)
  const canvasNodeIds = useMemo(() => new Set(canvasNodes.map((n: { id: string }) => n.id)), [canvasNodes])
  const nodeLabels = useMemo<Map<string, string>>(() => {
    const map = new Map((canvasNodes ?? []).map((n) => [n.id, (n.data?.label as string) ?? '']))
    // Pre-index add_node operations so edges in the same patch can resolve labels
    // for nodes that don't exist in the canvas store yet (e.g. full_draft patches).
    for (const op of block.operations) {
      if (op.op === 'add_node' && !map.has(op.target_id)) {
        const label = typeof op.data?.label === 'string' ? op.data.label : ''
        if (label) map.set(op.target_id, label)
      }
    }
    return map
  }, [canvasNodes, block.operations])
  const edgeEndpoints = useMemo<Map<string, { from: string; to: string }>>(
    () => new Map((canvasEdges ?? []).map((e) => [e.id, { from: e.source, to: e.target }])),
    [canvasEdges],
  )

  // Prefer CEE's semantic block.summary; fall back to contextual text by patch type.
  const ceeSummaryText = normaliseDashes(block.summary || '')
  const ceeAppliedSummaryText = normaliseDashes(block.applied_summary || '')
  const rawSummaryText = ceeSummaryText || getContextualFallback(block)
  const rawProposalItems = getProposalItems(block)
  const proposalItemsSource = getProposalItemsSource(block)
  const operationMeta = Array.isArray(block.operation_meta) ? block.operation_meta : []
  const opTargets = extractTargetIdsFromPatch(block.operations)
  const relatedTargets = extractGroundedTargets(block.related_elements)
  const nodeIds = relatedTargets.nodeIds.length > 0 ? relatedTargets.nodeIds : opTargets.nodeIds
  const edgeIds = relatedTargets.edgeIds.length > 0 ? relatedTargets.edgeIds : opTargets.edgeIds
  const uniqueTargetNodeIds = [...new Set(nodeIds)].filter(id => canvasNodeIds.has(id))
  const totalNodeCount = canvasNodeIds.size
  const isWholeGraphTarget = totalNodeCount > 0 && uniqueTargetNodeIds.length / totalNodeCount >= 0.8
  const addNodeOpCount = block.operations.filter(op => op.op === 'add_node').length
  const isGenerativeDraft = block.patch_type === 'full_draft'
    || (block.patch_type == null && isAutoApplied && addNodeOpCount >= 3 && addNodeOpCount > block.operations.length / 2)
  const hasRevealTargets = !isWholeGraphTarget && !isGenerativeDraft && (uniqueTargetNodeIds.length > 0 || edgeIds.length > 0)
  const isApplied = isAutoApplied || resolvedState === 'accepted'
  const summaryText = useMemo(
    () => (isApplied && ceeAppliedSummaryText
      ? ceeAppliedSummaryText
      : stripProposalPrefix(rawSummaryText, isApplied)),
    [rawSummaryText, ceeAppliedSummaryText, isApplied],
  )
  const cardState = resolveCardState(resolvedState, isAutoApplied, rejectionInfo?.code === 'NETWORK_ERROR')
  const { header: cardHeader, badge: cardBadge } = getPatchCardLabels(cardState)
  const relatedElements = block.related_elements

  const proposalItems = useMemo<ProposalReviewItem[]>(() => {
    const base: ProposalReviewItem[] = rawProposalItems.length > 0
      ? rawProposalItems.map((item, idx) => {
          const op = block.operations[idx]
          const deps: DescribeOpDeps = { proposalItem: item, relatedElements, nodeLabels, edgeEndpoints }
          const descNeedsClean = RAW_ID_PATTERN.test(item.description)
          const labelNeedsClean = item.elementLabel ? RAW_ID_PATTERN.test(item.elementLabel) : false
          if (!descNeedsClean && !labelNeedsClean) return item
          return {
            ...item,
            description: op
              ? describeOperation(op, deps)
              : item.description.replace(new RegExp(RAW_ID_PATTERN.source, 'gi'), '[item]'),
            elementLabel: labelNeedsClean ? undefined : item.elementLabel,
          }
        })
      : block.operations.map((op) => {
          const deps: DescribeOpDeps = { relatedElements, nodeLabels, edgeEndpoints }
          return {
            description: describeOperation(op, deps),
            elementLabel: typeof op.data?.kind === 'string' ? op.data.kind : undefined,
            changeLabel: undefined,
          }
        })
    if (!isApplied) return base
    return base.map((item) => {
      const cleaned = stripProposalPrefix(item.description, true)
      return cleaned === item.description ? item : { ...item, description: cleaned }
    })
  }, [rawProposalItems, block.operations, relatedElements, nodeLabels, edgeEndpoints, isApplied])

  const shouldCollapseProposalItems =
    proposalItems.length > 2
    || proposalItemsSource === 'derived_ops'
    || isApplied
  const v2Rendering = isOrchestratorRenderingV2Enabled()
  const showProposalItemsInline = proposalItems.length > 0 && !shouldCollapseProposalItems && !v2Rendering
  const showProposalDisclosure = proposalItems.length > 0 && (shouldCollapseProposalItems || v2Rendering)
  const primaryActionLabel = showProposalItemsInline ? 'Apply' : 'Accept'
  const secondaryActionLabel = showProposalItemsInline ? 'Not what I meant' : 'Dismiss'

  const customActions = block.actions?.filter(
    (a: any) => a.action_type === 'accept' || a.action_type === 'dismiss'
  ) ?? []
  const hasCustomActions = customActions.length > 0

  const getActionClass = (action: BlockAction): string => {
    if (action.variant === 'danger') return styles.graphPatchDanger
    if (action.variant === 'secondary') return styles.graphPatchDismiss
    return styles.graphPatchAccept
  }

  const getActionLabel = (action: BlockAction): string => {
    if (action.label?.trim()) return action.label
    if (action.action_type === 'accept') return primaryActionLabel
    if (action.action_type === 'dismiss') return secondaryActionLabel
    return action.label
  }

  const handleAcceptWithStalenessCheck = useCallback(() => {
    if (block.graph_hash_at_proposal) {
      const { nodes, edges } = useCanvasStore.getState()
      const currentHash = generateGraphHash(nodes, edges)
      if (currentHash !== block.graph_hash_at_proposal) {
        setShowStalenessWarning(true)
        return
      }
    }
    onAccept?.(stateKey, block)
  }, [block, onAccept, stateKey])

  const handleApplyAnyway = useCallback(() => {
    setShowStalenessWarning(false)
    onAccept?.(stateKey, block)
  }, [block, onAccept, stateKey])

  const handleDismissStale = useCallback(() => {
    setShowStalenessWarning(false)
    onDismiss?.(stateKey)
  }, [onDismiss, stateKey])

  const handleActionClick = useCallback((action: BlockAction) => {
    if (action.action_type === 'accept') {
      handleAcceptWithStalenessCheck()
    } else if (action.action_type === 'dismiss') {
      onDismiss?.(stateKey)
    }
  }, [handleAcceptWithStalenessCheck, onDismiss, stateKey])

  const handleRevealChanges = useCallback(() => {
    const store = useCanvasStore.getState()
    clearHighlightTimeouts()

    if (uniqueTargetNodeIds.length === 1) {
      store.selectNodeWithoutHistory(uniqueTargetNodeIds[0])
      store.setShowInspectorPanel(true)
    } else if (uniqueTargetNodeIds.length > 1) {
      store.selectNodes(uniqueTargetNodeIds)
    }

    if (uniqueTargetNodeIds.length > 0) {
      store.setHighlightedNodes(uniqueTargetNodeIds)
      highlightTimeoutsRef.current.push(setTimeout(() => {
        useCanvasStore.getState().setHighlightedNodes([])
      }, 2000))
    }

    if (edgeIds.length > 0) {
      store.setHighlightedEdges(edgeIds)
      highlightTimeoutsRef.current.push(setTimeout(() => {
        useCanvasStore.getState().setHighlightedEdges([])
      }, 2000))
    }
  }, [clearHighlightTimeouts, edgeIds, nodeIds])

  return (
    <div
      className={`${styles.graphPatchBlock} ${isApplied ? styles.graphPatchBlockApplied : ''}`}
      data-testid={`block-graph-patch-${block.patch_id}`}
      aria-label={`${cardHeader}${summaryText ? ': ' + summaryText : ''}`}
    >
      <div className={styles.graphPatchHeader}>
        <div className={styles.graphPatchTitleRow}>
          <span className={`${typography.panelHeader} text-text-header`}>
            {cardHeader}
          </span>
        </div>
        {summaryText && (
          <div
            className={`${typography.bodySmall} ${styles.graphPatchSummary}`}
            // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText (allowlist: strong, br, ul, li)
            dangerouslySetInnerHTML={{ __html: safeRichText(summaryText) }}
          />
        )}
      </div>

      {showProposalItemsInline && (
        <div className={styles.graphPatchProposalList} data-testid="patch-proposal-list">
          {proposalItems.map((item, index) => (
            <div key={`${item.description}-${index}`} className={styles.graphPatchProposalItem}>
              <div className={styles.graphPatchProposalCopy}>
                <span
                  className={`${typography.bodySmall} ${styles.graphPatchProposalDescription}`}
                  // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText
                  dangerouslySetInnerHTML={{ __html: safeRichText(item.description) }}
                />
                {item.elementLabel && (
                  <span className={`${typography.panelMeta} ${styles.graphPatchProposalLabel}`}>
                    {item.elementLabel}
                  </span>
                )}
              </div>
              {item.changeLabel && (
                <span className={`${typography.panelMeta} ${styles.graphPatchProposalBadge}`}>
                  {item.changeLabel}
                </span>
              )}
              {operationMeta[index]?.rationale && (
                <OperationRationale rationale={operationMeta[index].rationale} />
              )}
            </div>
          ))}
        </div>
      )}

      {showProposalDisclosure && (
        <div>
          <button
            type="button"
            className={styles.inlineDisclosureToggle}
            onClick={() => setShowProposalDetails((value) => !value)}
            aria-expanded={showProposalDetails}
            aria-label={showProposalDetails ? 'Hide change details' : 'Show change details'}
            data-testid="patch-proposal-details-toggle"
          >
            {showProposalDetails
              ? <><ChevronUp size={12} aria-hidden="true" /> Hide details</>
              : <><ChevronDown size={12} aria-hidden="true" /> Show details</>}
          </button>
          {showProposalDetails && (
            <div className={styles.graphPatchProposalList} data-testid="patch-proposal-list">
              {proposalItems.map((item, index) => (
                <div key={`${item.description}-${index}`} className={styles.graphPatchProposalItem}>
                  <div className={styles.graphPatchProposalCopy}>
                    <span
                      className={`${typography.bodySmall} ${styles.graphPatchProposalDescription}`}
                      // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText
                      dangerouslySetInnerHTML={{ __html: safeRichText(item.description) }}
                    />
                    {item.elementLabel && (
                      <span className={`${typography.panelMeta} ${styles.graphPatchProposalLabel}`}>
                        {item.elementLabel}
                      </span>
                    )}
                  </div>
                  {item.changeLabel && (
                    <span className={`${typography.panelMeta} ${styles.graphPatchProposalBadge}`}>
                      {item.changeLabel}
                    </span>
                  )}
                  {operationMeta[index]?.rationale && (
                    <OperationRationale rationale={operationMeta[index].rationale} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* auto_apply: render as applied immediately (no actions, no event) */}
      {isAutoApplied && (
        <>
          <div className={styles.graphPatchStatusApplied} data-testid="patch-status-auto-applied">
            {cardBadge && <BadgeIcon badge={cardBadge} />} {cardHeader}
          </div>
          {hasRevealTargets && (
            <div className={styles.graphPatchActions}>
              <button
                type="button"
                className={styles.graphPatchDismiss}
                onClick={handleRevealChanges}
                data-testid="patch-show-changes"
                aria-label="Show on graph"
              >
                Show on graph
              </button>
            </div>
          )}
        </>
      )}

      {/* Status indicators for settled states (non-auto_apply) */}
      {!isAutoApplied && resolvedState === 'accepted' && (
        <>
          <div className={styles.graphPatchStatusApplied} data-testid="patch-status-applied">
            {cardBadge && <BadgeIcon badge={cardBadge} />} {cardHeader}
          </div>
          {hasRevealTargets && (
            <div className={styles.graphPatchActions}>
              <button
                type="button"
                className={styles.graphPatchDismiss}
                onClick={handleRevealChanges}
                data-testid="patch-show-changes"
                aria-label="Show on graph"
              >
                Show on graph
              </button>
            </div>
          )}
        </>
      )}
      {!isAutoApplied && resolvedState === 'rejected' && (
        <div className={styles.graphPatchStatusRejected} data-testid="patch-status-rejected">
          {cardBadge && <BadgeIcon badge={cardBadge} />} {cardHeader}
          {rejectionInfo && (
            <div className={styles.graphPatchError}>
              {rejectionInfo.code}: {rejectionInfo.message}
              {rejectionInfo.violations && rejectionInfo.violations.length > 0 && (
                <>
                  <div className={styles.graphPatchViolations}>
                    {rejectionInfo.violations[0]}
                  </div>
                  {rejectionInfo.violations.length > 1 && !showViolations && (
                    <button
                      type="button"
                      className={styles.inlineDisclosureToggle}
                      onClick={() => setShowViolations(true)}
                      aria-expanded={false}
                      aria-label={`Show ${rejectionInfo.violations.length - 1} more violation details`}
                    >
                      Show {rejectionInfo.violations.length - 1} more
                    </button>
                  )}
                  {showViolations && rejectionInfo.violations.slice(1).map((v, i) => (
                    <div key={i} className={styles.graphPatchViolations}>{v}</div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {!isAutoApplied && resolvedState === 'dismissed' && (
        <div className={styles.graphPatchStatusDismissed} data-testid="patch-status-dismissed">
          {cardHeader}
        </div>
      )}

      {/* Network failure — retry button (block stays in 'proposed' state) */}
      {!isAutoApplied && resolvedState === 'proposed' && rejectionInfo?.code === 'NETWORK_ERROR' && (
        <div className={styles.graphPatchError} data-testid="patch-retry-error">
          {cardBadge && <BadgeIcon badge={cardBadge} />} {cardHeader}
          <div>{rejectionInfo.message}</div>
          <button
            type="button"
            className={styles.graphPatchRetry}
            onClick={() => onAccept?.(stateKey, block)}
          >
            Try again
          </button>
        </div>
      )}

      {/* Staleness warning — shown when graph changed since proposal */}
      {!isAutoApplied && !isSettled && showStalenessWarning && (
        <>
          <div className={styles.patchStalenessWarning} data-testid="patch-staleness-warning">
            This was proposed before your last edit — still want to apply it?
          </div>
          <div className={styles.graphPatchActions}>
            <button
              type="button"
              className={styles.graphPatchAccept}
              onClick={handleApplyAnyway}
              data-testid="patch-apply-anyway"
              aria-label="Apply anyway"
            >
              Apply anyway
            </button>
            <button
              type="button"
              className={styles.graphPatchDismiss}
              onClick={handleDismissStale}
              data-testid="patch-dismiss-stale"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        </>
      )}

      {!isAutoApplied && !isSettled && !showStalenessWarning && rejectionInfo?.code !== 'NETWORK_ERROR' && (
        <div className={styles.graphPatchActions}>
          {hasCustomActions ? (
            (customActions as BlockAction[]).map((action, i) => (
              <button
                key={i}
                type="button"
                className={getActionClass(action)}
                disabled={isSettled}
                onClick={() => handleActionClick(action)}
                data-testid={`patch-action-${action.action_type}`}
                aria-label={getActionLabel(action)}
              >
                {getActionLabel(action)}
              </button>
            ))
          ) : (
            <>
              <button
                type="button"
                className={styles.graphPatchAccept}
                disabled={isSettled}
                onClick={handleAcceptWithStalenessCheck}
                data-testid="patch-accept"
                aria-label="Accept this graph change"
              >
                {primaryActionLabel}
              </button>
              <button
                type="button"
                className={styles.graphPatchDismiss}
                disabled={isSettled}
                onClick={() => onDismiss?.(stateKey)}
                data-testid="patch-dismiss"
                aria-label="Dismiss this graph change"
              >
                {secondaryActionLabel}
              </button>
            </>
          )}
        </div>
      )}
      {/* AI panel v2 — click-to-highlight footer (brief §9.2). Renders
          related_elements as EntityLinks below the patch body. Strictly
          FF-gated: when FF_AI_PANEL_V2 is off, this block is skipped and
          the legacy patch card renders unchanged. */}
      {isAiPanelV2Enabled() && Array.isArray(relatedElements) && relatedElements.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-1 mt-2 pt-2 border-t border-panel-border ${typography.panelMeta} text-text-light`}
          data-testid="patch-related-elements"
        >
          <span aria-hidden="true">Related:</span>
          {relatedElements.map((rel, i) => {
            const id = rel.node_id ?? rel.edge_id
            if (!id) return null
            const label = rel.label ?? id
            const kind = rel.edge_id ? 'edge' : 'node'
            return (
              <span key={`${id}-${i}`} className="inline-flex items-center">
                <EntityLink id={id} label={label} kind={kind} />
                {i < relatedElements.length - 1 && <span className="text-text-light/60" aria-hidden="true">,</span>}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProposalBlockRenderer — simpler variant using the same label/badge system.
// Shares getPatchCardLabels + BadgeIcon with GraphPatchBlockRenderer above.
// ---------------------------------------------------------------------------

interface ProposalBlockRendererProps {
  block: ProposalBlockType
  onProposalConfirm?: (proposalId: string) => void
}

export function ProposalBlockRenderer({
  block,
  onProposalConfirm,
}: ProposalBlockRendererProps) {
  const [state, setState] = useState<'pending' | 'accepted' | 'cancelled'>(
    block.confirmation_required === true ? 'pending' : 'accepted',
  )
  const needsButtons = block.confirmation_required === true && state === 'pending'

  // Seamlessness R3: proposal change targets arrive as bare strings (no id,
  // no kind), so they resolve against the canvas via the ratified
  // string-target rule — exact node/edge id match, else UNIQUE exact
  // node-label match (trimmed, case-sensitive), else the badge stays inert.
  // Subscribing to nodes/edges makes resolution render-time: labels drift
  // while a proposal sits on screen, and a badge must never point at a
  // guess. TargetRefPill re-checks existence on click, so a resolved badge
  // is safe even if the element vanishes between render and click.
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const resolveTarget = useCallback(
    (target: string): { id: string; kind: 'node' | 'edge' } | null => {
      const t = target.trim()
      if (!t) return null
      if (nodes.some((n) => n.id === t)) return { id: t, kind: 'node' }
      if (edges.some((e) => e.id === t)) return { id: t, kind: 'edge' }
      const byLabel = nodes.filter(
        (n) => typeof n.data?.label === 'string' && n.data.label.trim() === t,
      )
      return byLabel.length === 1 ? { id: byLabel[0].id, kind: 'node' } : null
    },
    [nodes, edges],
  )

  const cardState = state === 'accepted' ? 'accepted' as const
    : state === 'cancelled' ? 'dismissed' as const
    : 'proposed' as const
  const { header: cardHeader, badge: cardBadge } = getPatchCardLabels(cardState)

  const handleApply = useCallback(() => {
    setState('accepted')
    onProposalConfirm?.(block.proposal_id)
  }, [block.proposal_id, onProposalConfirm])

  return (
    <div className={styles.proposalBlock} data-testid="block-proposal">
      <span className={`${typography.panelMeta} ${styles.graphPatchProposalEyebrow}`}>
        {cardHeader}
      </span>
      <p className={`${typography.panelBody} ${styles.graphPatchProposalDescription}`}>{block.description}</p>
      {block.changes.length > 0 && (
        <div className={styles.graphPatchProposalList}>
          {block.changes.map((c, i) => {
            const resolved = c.target ? resolveTarget(c.target) : null
            return (
              <div key={`${c.target}-${i}`} className={styles.graphPatchProposalItem}>
                <span className={typography.panelBody}>{c.detail}</span>
                <div className="flex gap-1">
                  {c.operation && (
                    <span className={`${typography.panelMeta} ${styles.outlinedPill}`}>{c.operation}</span>
                  )}
                  {c.target && resolved && (
                    <TargetRefPill
                      id={resolved.id}
                      kind={resolved.kind}
                      label={c.target}
                      className={`${typography.panelMeta} ${styles.graphPatchProposalBadge}`}
                    />
                  )}
                  {c.target && !resolved && (
                    <span className={`${typography.panelMeta} ${styles.graphPatchProposalBadge}`}>{c.target}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {block.consequences && block.consequences.length > 0 && (
        <div className={`${typography.panelMeta} ${styles.graphPatchProposalLabel}`}>
          {block.consequences.map((c) => <div key={c}>· {c}</div>)}
        </div>
      )}
      {needsButtons && (
        <div className={styles.graphPatchActions}>
          <button
            type="button"
            className={styles.graphPatchAccept}
            onClick={handleApply}
            aria-label="Apply proposed changes"
            data-testid="proposal-apply"
          >
            Apply
          </button>
          <button
            type="button"
            className={styles.graphPatchDismiss}
            onClick={() => setState('cancelled')}
            aria-label="Dismiss proposed changes"
            data-testid="proposal-cancel"
          >
            Cancel
          </button>
        </div>
      )}
      {state !== 'pending' && (
        <span className={`${typography.panelBody} ${state === 'accepted' ? styles.graphPatchStatusApplied : styles.graphPatchStatusDismissed}`}>
          {cardBadge && <BadgeIcon badge={cardBadge} />} {cardHeader}
        </span>
      )}
    </div>
  )
}
