/**
 * InlineBlocks — Renders conversation blocks inside assistant messages
 *
 * Supports all ConversationBlock types. Unknown block_type values render
 * a neutral fallback card — never crash.
 * Max 4 visible per turn with "Show more" toggle (graph_patch proposed blocks
 * always stay visible — budget is enforced upstream in useConversation).
 */

import { useState, useCallback, useEffect, useRef, memo } from 'react'
import { Lightbulb, AlertTriangle, Check, X as XIcon, ChevronDown, ChevronUp, ExternalLink, Wand2 } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useGuidanceStore } from '../stores/guidanceStore'
import { useCanvasStore } from '../store'
import type {
  ConversationBlock,
  GraphPatchBlock as GraphPatchBlockType,
  FramingBlock as FramingBlockType,
  BriefBlock as BriefBlockType,
  FactBlock as FactBlockType,
  CommentaryBlock as CommentaryBlockType,
  ReviewCardBlock as ReviewCardBlockType,
  EvidenceBlock as EvidenceBlockType,
  FactEntry,
  BlockAction,
  ProposalReviewItem,
  RelatedElementRef,
} from './types'
import { isPreAnalysisEnrichedEnabled } from '../../flags'
import { ModelReceiptBlock } from './ModelReceiptBlock'
import type { PatchBlockState, PatchRejectionInfo } from './useConversation'
import { MAX_VISIBLE_BLOCKS_PER_TURN } from './types'
import { extractTargetIdsFromPatch } from './utils/extractTargetIds'
import { generateGraphHash } from '../utils/graphHash'
import { resolvePatchBlockState } from './selectors'
import styles from './Conversation.module.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable one-line summary of patch operations (e.g. "3 factors, 2 options, 1 goal"). */
function summarisePatchOps(operations: { op: string; data?: Record<string, unknown> }[]): string {
  const counts: Record<string, number> = {}
  for (const op of operations) {
    // Prefer domain labels: data.kind (canvas convention) or data.type (CEE convention)
    const kind = (op.data?.kind as string) ?? (op.data?.type as string) ?? op.op.replace(/^(add|remove|update)_/, '')
    counts[kind] = (counts[kind] || 0) + 1
  }
  const parts = Object.entries(counts).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`)
  return parts.length > 0 ? parts.join(', ') : `${operations.length} operation${operations.length !== 1 ? 's' : ''}`
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

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

interface InlineBlocksProps {
  blocks: ConversationBlock[]
  turnId?: string
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onPatchAccept?: (patchId: string, block: GraphPatchBlockType) => void
  onPatchDismiss?: (patchId: string) => void
}

export const InlineBlocks = memo(function InlineBlocks({
  blocks,
  turnId,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
}: InlineBlocksProps) {
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? blocks : blocks.slice(0, MAX_VISIBLE_BLOCKS_PER_TURN)
  const hasOverflow = blocks.length > MAX_VISIBLE_BLOCKS_PER_TURN
  const hiddenCount = blocks.length - MAX_VISIBLE_BLOCKS_PER_TURN

  return (
    <div className={styles.blockContainer}>
      {visible.map((block, i) => (
        // data-citation-target is 1-based; CitationRef.index matches this
        // data-patch-id enables scroll-to-patch from GuidanceStrip approve_patch action
        <div
          key={i}
          data-citation-target={i + 1}
          {...(block.type === 'graph_patch' ? { 'data-patch-id': block.patch_id } : {})}
        >
          <BlockRenderer
            block={block}
            turnId={turnId}
            patchBlockStates={patchBlockStates}
            patchRejections={patchRejections}
            onPatchAccept={onPatchAccept}
            onPatchDismiss={onPatchDismiss}
          />
        </div>
      ))}
      {hasOverflow && (
        <button
          type="button"
          className={styles.showMoreToggle}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Block dispatcher
// ---------------------------------------------------------------------------

interface BlockRendererProps {
  block: ConversationBlock
  turnId?: string
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onPatchAccept?: (patchId: string, block: GraphPatchBlockType) => void
  onPatchDismiss?: (patchId: string) => void
}

function BlockRenderer({
  block,
  turnId,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
}: BlockRendererProps) {
  switch (block.type) {
    case 'commentary':
      return <CommentaryBlockRenderer block={block} />

    case 'review_card':
      return (
        <ReviewCardBlockRenderer
          block={block}
          data-testid={`block-review-${block.variant}`}
        />
      )

    case 'fact':
      return <FactBlockRenderer block={block} />

    case 'graph_patch':
      return (
        <GraphPatchBlockRenderer
          block={block}
          turnId={turnId}
          patchBlockStates={patchBlockStates}
          patchRejections={patchRejections}
          onAccept={onPatchAccept}
          onDismiss={onPatchDismiss}
        />
      )

    case 'framing':
      return <FramingBlockRenderer block={block} />

    case 'brief':
      return <BriefBlockRenderer block={block} />

    case 'model_receipt':
      if (!isPreAnalysisEnrichedEnabled()) return null
      return <ModelReceiptBlock data={block} />

    case 'evidence':
      return <EvidenceBlockRenderer block={block} />

    default: {
      // Unknown block type — suppress from user view, log for dev diagnostics
      const rawType = (block as { type: string }).type
      if (import.meta.env.DEV) {
        console.warn('[InlineBlocks] Suppressed unknown block type:', rawType, block)
      }
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// CommentaryBlock
// ---------------------------------------------------------------------------

const CommentaryBlockRenderer = memo(function CommentaryBlockRenderer({
  block,
}: {
  block: CommentaryBlockType
}) {
  const handleCitationClick = useCallback((index: number) => {
    // Scroll to the referenced block element by citation index
    const target = document.querySelector(`[data-citation-target="${index}"]`)
    if (!target) return
    if ('scrollIntoView' in target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    target.classList.add(styles.citationHighlightPulse)
    const timer = setTimeout(() => {
      target.classList.remove(styles.citationHighlightPulse)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const toneClass =
    block.tone === 'warning'
      ? styles.commentaryBlockWarning
      : block.tone === 'positive'
        ? styles.commentaryBlockPositive
        : styles.commentaryBlock

  return (
    <div>
      <p className={`${typography.panelBody} ${toneClass}`}>{block.text}</p>
      {block.citations && block.citations.length > 0 && (
        <div className={styles.citationLegend} aria-label="Citations">
          {block.citations.map((c) => (
            <span
              key={c.index}
              className={styles.citationEntry}
              role="button"
              tabIndex={0}
              onClick={() => handleCitationClick(c.index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleCitationClick(c.index)
                }
              }}
              aria-label={`Citation ${c.index}: ${c.source}`}
            >
              <span className={styles.citationIndex}>[{c.index}]</span>
              <span>{c.source}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// ReviewCardBlock
// ---------------------------------------------------------------------------

const ReviewCardBlockRenderer = memo(function ReviewCardBlockRenderer({
  block,
  ...rest
}: {
  block: ReviewCardBlockType
  'data-testid'?: string
}) {
  const priorityClass =
    block.priority === 'critical' ? styles.priorityBadgeCritical
    : block.priority === 'high' ? styles.priorityBadgeHigh
    : block.priority === 'medium' ? styles.priorityBadgeMedium
    : block.priority === 'low' ? styles.priorityBadgeLow
    : null

  const priorityLabel =
    block.priority === 'critical' ? 'Critical'
    : block.priority === 'high' ? 'High'
    : block.priority === 'medium' ? 'Medium'
    : block.priority === 'low' ? 'Low'
    : null

  return (
    <div
      className={block.variant === 'info' ? styles.reviewCardInfo : styles.reviewCardAlert}
      data-testid={rest['data-testid']}
    >
      {block.variant === 'info' ? (
        <Lightbulb className={styles.reviewCardIcon} />
      ) : (
        <AlertTriangle className={styles.reviewCardIcon} />
      )}
      <div className={styles.reviewCardContent}>
        <div className={styles.reviewCardBadgeRow}>
          <div className={`${typography.panelHeader} ${styles.reviewCardTitle}`}>{block.title}</div>
          {priorityClass && priorityLabel && (
            <span className={priorityClass} data-testid={`priority-badge-${block.priority}`}>
              {priorityLabel}
            </span>
          )}
        </div>
        <p className={typography.panelBody}>{block.body}</p>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// FactBlock (template-driven)
// ---------------------------------------------------------------------------

const FactBlockRenderer = memo(function FactBlockRenderer({
  block,
}: {
  block: FactBlockType
}) {
  const factType = block.fact_type ?? 'simple'

  return (
    <div className={styles.factBlock} data-testid="block-fact">
      {factType === 'simple' && (
        <>
          <span className={styles.factValue}>{block.value}</span>
          <span className={`${typography.panelMeta} ${styles.factLabel}`}>{block.label}</span>
          {block.source && <span className={styles.factSource}>{block.source}</span>}
        </>
      )}

      {(factType === 'option_comparison' || factType === 'sensitivity') && (
        <>
          <span className={`${typography.panelMeta} ${styles.factLabel}`}>{block.label}</span>
          <BarTemplateRows facts={block.facts ?? []} />
        </>
      )}

      {factType === 'robustness' && (
        <>
          <span className={`${typography.panelMeta} ${styles.factLabel}`}>{block.label}</span>
          <RobustnessIndicator value={block.value} />
        </>
      )}

      {factType === 'constraint' && (
        <>
          <span className={`${typography.panelMeta} ${styles.factLabel}`}>{block.label}</span>
          <ConstraintRow value={block.value} />
        </>
      )}

      {/* Unknown fact_type: fall back to simple */}
      {factType !== 'simple' && factType !== 'option_comparison' && factType !== 'sensitivity' && factType !== 'robustness' && factType !== 'constraint' && (
        <>
          <span className={styles.factValue}>{block.value}</span>
          <span className={`${typography.panelMeta} ${styles.factLabel}`}>{block.label}</span>
        </>
      )}

      {block.lineage?.n_samples != null && (
        <span className={styles.factLineage} data-testid="fact-lineage">
          Based on {block.lineage.n_samples.toLocaleString()} simulations
        </span>
      )}
    </div>
  )
})

function BarTemplateRows({ facts }: { facts: FactEntry[] }) {
  if (facts.length === 0) return null

  // Normalise: find max numeric value — guard against non-numeric values
  const numericValues = facts.map((f) => {
    const n = parseFloat(String(f.value))
    return Number.isFinite(n) ? n : 0
  })
  const maxVal = Math.max(...numericValues, 1) // floor at 1 to avoid div/0

  return (
    <div data-testid="fact-bars">
      {facts.map((f, i) => {
        const numericVal = parseFloat(String(f.value))
        const isNumeric = Number.isFinite(numericVal)
        const pct = isNumeric ? Math.min((numericVal / maxVal) * 100, 100) : 0

        return (
          <div key={i} className={styles.factBarRow} data-testid={`fact-bar-row-${i}`}>
            <span className={styles.factBarLabel}>{f.label}</span>
            {isNumeric ? (
              <div className={styles.factBarTrack} role="meter" aria-valuenow={numericVal} aria-valuemax={maxVal} aria-label={f.label}>
                <div className={styles.factBarFill} style={{ width: `${pct}%` }} />
              </div>
            ) : (
              <span className={styles.factBarTrack}>{f.value}</span>
            )}
            <span className={styles.factBarValue}>{isNumeric ? `${numericVal}%` : String(f.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

function RobustnessIndicator({ value }: { value: string }) {
  // Normalise: 'fragile'/'low' → 1, 'moderate'/'medium' → 2, 'robust'/'high' → 3
  const v = value.toLowerCase()
  const level = v === 'robust' || v === 'high' ? 3 : v === 'moderate' || v === 'medium' ? 2 : 1
  const label = level === 3 ? 'Robust' : level === 2 ? 'Moderate' : 'Fragile'

  return (
    <div data-testid="fact-robustness">
      <div className={styles.factRobustnessRow} aria-label={`Robustness: ${label}`}>
        {[1, 2, 3].map((seg) => (
          <div
            key={seg}
            className={seg <= level ? styles.factRobustnessSegmentActive : styles.factRobustnessSegment}
            data-testid={`robustness-seg-${seg}`}
          />
        ))}
      </div>
      <span className={`${typography.panelMeta} ${styles.factLabel}`}>{label}</span>
    </div>
  )
}

function ConstraintRow({ value }: { value: string }) {
  const numericVal = parseFloat(String(value))
  const isNumeric = Number.isFinite(numericVal)
  // Probability >= 0.5 is a pass; non-numeric values treated as pass when value is 'pass'/'true'
  const isPassing = isNumeric
    ? numericVal >= 0.5
    : value.toLowerCase() === 'pass' || value.toLowerCase() === 'true'

  return (
    <div className={styles.factBarRow} data-testid="fact-constraint">
      <span className={styles.factValue}>{isNumeric ? `${Math.round(numericVal * 100)}%` : value}</span>
      <span
        className={isPassing ? styles.factConstraintBadgePass : styles.factConstraintBadgeFail}
        data-testid={isPassing ? 'constraint-pass' : 'constraint-fail'}
      >
        {isPassing ? 'Pass' : 'Fail'}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FramingBlock
// ---------------------------------------------------------------------------

const FramingBlockRenderer = memo(function FramingBlockRenderer({
  block,
}: {
  block: FramingBlockType
}) {
  return (
    <div className={styles.framingBlock} data-testid="block-framing" aria-label="Decision framing">
      <div className={styles.framingGoal}>{block.goal}</div>
      {block.options.length > 0 && (
        <div className={styles.framingOptions} aria-label="Options">
          {block.options.map((opt, i) => (
            <span key={i} className={styles.framingOptionPill}>{opt}</span>
          ))}
        </div>
      )}
      {block.constraints && block.constraints.length > 0 && (
        <div className={styles.framingSection}>
          <div className={styles.framingSectionLabel}>Constraints</div>
          {block.constraints.map((c, i) => (
            <div key={i} className={styles.framingItem}>{c}</div>
          ))}
        </div>
      )}
      {block.key_risks && block.key_risks.length > 0 && (
        <div className={styles.framingSection}>
          <div className={styles.framingSectionLabel}>Key risks</div>
          {block.key_risks.map((r, i) => (
            <div key={i} className={styles.framingItem}>{r}</div>
          ))}
        </div>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// BriefBlock
// ---------------------------------------------------------------------------

const BriefBlockRenderer = memo(function BriefBlockRenderer({
  block,
}: {
  block: BriefBlockType
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={styles.briefBlock} data-testid="block-brief" aria-label="Brief">
      <div className={`${typography.panelHeader} ${styles.briefTitle}`}>{block.title}</div>
      <p
        className={expanded ? styles.briefSummaryExpanded : styles.briefSummaryCollapsed}
        data-testid="brief-summary"
      >
        {block.summary}
      </p>
      <button
        type="button"
        className={styles.briefExpandToggle}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        data-testid="brief-expand-toggle"
      >
        {expanded ? (
          <><ChevronUp size={12} aria-hidden="true" /> Show less</>
        ) : (
          <><ChevronDown size={12} aria-hidden="true" /> Show more</>
        )}
      </button>
      {block.brief_url && (
        <a
          href={block.brief_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.briefViewLink}
          data-testid="brief-view-link"
          aria-label="View full brief (opens in new tab)"
        >
          <ExternalLink size={12} aria-hidden="true" /> View full brief
        </a>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// EvidenceBlock
// ---------------------------------------------------------------------------

/** Task 5: Normalise a raw finding object — CEE may use text, summary, content, or description */
function normaliseFindingText(f: Record<string, unknown>): string | null {
  const raw = f.text ?? f.summary ?? f.content ?? f.description
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim()
  return null
}

const EvidenceBlockRenderer = memo(function EvidenceBlockRenderer({
  block,
}: {
  block: EvidenceBlockType
}) {
  // Task 3: Hooks must come before any conditional returns (Rules of Hooks)
  const nodeCount = useCanvasStore(s => s.nodes.length)
  // Use _sendChip for display/submitted separation: bubble shows "Apply to model",
  // orchestrator receives the full findings payload.
  const sendChip = useGuidanceStore(s => s._sendChip)

  // Task 5: Normalise findings — skip entries with no displayable text
  const normalisedFindings = Array.isArray(block.findings)
    ? block.findings
        .map((f) => {
          const text = normaliseFindingText(f as unknown as Record<string, unknown>)
          return text ? { ...f, text } : null
        })
        .filter(Boolean) as Array<EvidenceBlockType['findings'][number]>
    : []

  const handleApplyToModel = useCallback(() => {
    if (!sendChip) return
    // Recompute summary at call time — avoids stale normalisedFindings in deps
    const findings = Array.isArray(block.findings) ? block.findings : []
    const summary = findings
      .slice(0, 3)
      .map(f => {
        const raw = (f as unknown as Record<string, unknown>)
        const text = raw.text ?? raw.summary ?? raw.content ?? raw.description
        return typeof text === 'string' && text.trim() ? `- ${text.trim()}` : null
      })
      .filter(Boolean)
      .join('\n')
    const title = block.title ? ` (${block.title})` : ''
    sendChip('Apply to model', `Apply these research findings to the model${title}:\n${summary}`)
  }, [sendChip, block.findings, block.title])

  const hasFindings = normalisedFindings.length > 0

  const hasGraph = nodeCount > 0

  return (
    <div className={styles.evidenceBlock} data-testid="block-evidence" aria-label="Evidence">
      <div className={`${typography.panelHeader} ${styles.evidenceTitle}`}>
        {block.title || 'Research findings'}
      </div>
      {!hasFindings && (
        <p className={typography.panelBody}>Research findings available</p>
      )}
      {normalisedFindings.map((f, i) => (
        <div key={i} className={styles.evidenceFinding}>
          <p className={typography.panelBody}>{f.text}</p>
          {f.source_url && (
            <a
              href={f.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.evidenceSource}
            >
              <ExternalLink size={12} aria-hidden="true" /> Source
            </a>
          )}
          {f.confidence != null && (
            <span className={`${typography.panelMeta} ${styles.evidenceConfidence}`}>
              {Math.round(f.confidence * 100)}% confidence
            </span>
          )}
        </div>
      ))}
      {block.query && (
        <div className={`${typography.panelMeta} ${styles.evidenceQuery}`}>
          Query: {block.query}
        </div>
      )}
      {hasGraph && sendChip && (
        <div className="mt-2 flex">
          <button
            type="button"
            onClick={handleApplyToModel}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} font-medium bg-transparent border border-info/40 text-info rounded-full hover:border-info hover:bg-info-light transition-colors`}
            data-testid="apply-to-model-chip"
          >
            <Wand2 size={11} aria-hidden="true" />
            Apply to model
          </button>
        </div>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// GraphPatchBlock renderer
// ---------------------------------------------------------------------------

interface GraphPatchBlockRendererProps {
  block: GraphPatchBlockType
  turnId?: string
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onAccept?: (patchId: string, block: GraphPatchBlockType) => void
  onDismiss?: (patchId: string) => void
}

function GraphPatchBlockRenderer({
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

  const opSummary = summarisePatchOps(block.operations)
  const proposalItems = getProposalItems(block)
  const proposalItemsSource = getProposalItemsSource(block)
  const opTargets = extractTargetIdsFromPatch(block.operations)
  const relatedTargets = extractGroundedTargets(block.related_elements)
  const nodeIds = relatedTargets.nodeIds.length > 0 ? relatedTargets.nodeIds : opTargets.nodeIds
  const edgeIds = relatedTargets.edgeIds.length > 0 ? relatedTargets.edgeIds : opTargets.edgeIds
  const hasRevealTargets = nodeIds.length > 0 || edgeIds.length > 0
  const isApplied = isAutoApplied || resolvedState === 'accepted'
  const statusLabel = 'Applied'
  const shouldCollapseProposalItems =
    proposalItems.length > 2
    || proposalItemsSource === 'derived_ops'
    || isApplied
  const showProposalItemsInline = proposalItems.length > 0 && !shouldCollapseProposalItems
  const showProposalDisclosure = proposalItems.length > 0 && shouldCollapseProposalItems
  // Action labels: only use proposal-aware labels when items are inline-visible to the user
  const primaryActionLabel = showProposalItemsInline ? 'Apply' : 'Accept'
  const secondaryActionLabel = showProposalItemsInline ? 'Not what I meant' : 'Dismiss'

  // Determine which action buttons to render
  const hasCustomActions = block.actions && block.actions.length > 0

  const getActionClass = (action: BlockAction): string => {
    if (action.variant === 'danger') return styles.graphPatchDanger
    if (action.variant === 'secondary') return styles.graphPatchDismiss
    return styles.graphPatchAccept
  }

  // For custom CEE action arrays, prefer the CEE-provided label.
  // Only fall back to generic labels if the label is absent.
  const getActionLabel = (action: BlockAction): string => {
    if (action.label?.trim()) return action.label
    if (action.action_type === 'accept') return primaryActionLabel
    if (action.action_type === 'dismiss') return secondaryActionLabel
    return action.label
  }

  // Staleness-aware accept: compare current graph hash against proposal hash
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
    // 'view_details' and unknown action_types are no-ops for now
  }, [handleAcceptWithStalenessCheck, onDismiss, stateKey])

  const handleRevealChanges = useCallback(() => {
    const store = useCanvasStore.getState()
    clearHighlightTimeouts()

    if (nodeIds.length === 1) {
      store.selectNodeWithoutHistory(nodeIds[0])
      store.setShowInspectorPanel(true)
    } else if (nodeIds.length > 1) {
      store.selectNodes(nodeIds)
    }

    if (nodeIds.length > 0) {
      store.setHighlightedNodes(nodeIds)
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
      aria-label={`${isApplied ? 'Applied changes' : 'Proposed changes'}: ${block.summary}`}
    >
      <div className={styles.graphPatchHeader}>
        <div className={styles.graphPatchTitleRow}>
          <span className={`${typography.panelMeta} ${isApplied ? styles.graphPatchReceiptEyebrow : styles.graphPatchProposalEyebrow}`}>
            {isApplied ? 'Changes applied' : 'Review suggested changes'}
          </span>
        </div>
        <div className={styles.graphPatchSummary}>{block.summary || opSummary}</div>
        {block.summary && block.operations.length > 0 && <div className={styles.graphPatchMeta}>{opSummary}</div>}
      </div>

      {showProposalItemsInline && (
        <div className={styles.graphPatchProposalList} data-testid="patch-proposal-list">
          {proposalItems.map((item, index) => (
            <div key={`${item.description}-${index}`} className={styles.graphPatchProposalItem}>
              <div className={styles.graphPatchProposalCopy}>
                <span className={`${typography.panelBody} ${styles.graphPatchProposalDescription}`}>
                  {item.description}
                </span>
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
            </div>
          ))}
        </div>
      )}

      {showProposalDisclosure && (
        <div>
          <button
            type="button"
            className={styles.graphPatchShowDetails}
            onClick={() => setShowProposalDetails((value) => !value)}
            aria-expanded={showProposalDetails}
            data-testid="patch-proposal-details-toggle"
          >
            {showProposalDetails ? 'Hide details' : 'Show details'}
          </button>
          {showProposalDetails && (
            <div className={styles.graphPatchProposalList} data-testid="patch-proposal-list">
              {proposalItems.map((item, index) => (
                <div key={`${item.description}-${index}`} className={styles.graphPatchProposalItem}>
                  <div className={styles.graphPatchProposalCopy}>
                    <span className={`${typography.panelBody} ${styles.graphPatchProposalDescription}`}>
                      {item.description}
                    </span>
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
            <Check size={14} aria-hidden="true" /> {statusLabel}
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
            <Check size={14} aria-hidden="true" /> {statusLabel}
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
          <XIcon size={14} aria-hidden="true" /> Rejected
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
                      className={styles.graphPatchShowDetails}
                      onClick={() => setShowViolations(true)}
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
          Dismissed
        </div>
      )}

      {/* Network failure — retry button (block stays in 'proposed' state) */}
      {!isAutoApplied && resolvedState === 'proposed' && rejectionInfo?.code === 'NETWORK_ERROR' && (
        <div className={styles.graphPatchError} data-testid="patch-retry-error">
          {rejectionInfo.message}
          <button
            type="button"
            className={styles.graphPatchRetry}
            onClick={() => onAccept?.(stateKey, block)}
          >
            Try again
          </button>
        </div>
      )}

      {/*
        Action buttons: CEE-provided actions[] OR default Accept/Dismiss.
        CEE actions[] are presentational (labels + availability). The local block
        state machine remains the authority for status transitions. Unknown
        action_types are rendered as secondary buttons but have no handler.
      */}
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
            // Render CEE-provided action buttons
            (block.actions as BlockAction[]).map((action, i) => (
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
            // Default Accept / Dismiss
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
    </div>
  )
}
