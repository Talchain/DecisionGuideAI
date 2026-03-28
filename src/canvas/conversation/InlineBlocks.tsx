/**
 * InlineBlocks — Renders conversation blocks inside assistant messages
 *
 * Supports all ConversationBlock types. Unknown block_type values render
 * a neutral fallback card — never crash.
 * Max 4 visible per turn with "Show more" toggle (graph_patch proposed blocks
 * always stay visible — budget is enforced upstream in useConversation).
 */

import { useState, useCallback, useEffect, useRef, memo, useMemo } from 'react'
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
import { isPreAnalysisEnrichedEnabled, isDeterministicCeeEnabled } from '../../flags'
import { trackEvent } from '../../lib/posthog'
import type {
  ComparisonBlock as ComparisonBlockType,
  PremortemBlock as PremortemBlockType,
  FlipAnalysisBlock as FlipAnalysisBlockType,
  ProposalBlock as ProposalBlockType,
  ExerciseBlock as ExerciseBlockType,
} from './types'
import { ModelReceiptBlock } from './ModelReceiptBlock'
import { ArtefactBlock as ArtefactBlockComponent } from '../../components/chat/ArtefactBlock'
import type { PatchBlockState, PatchRejectionInfo } from './useConversation'
import { MAX_VISIBLE_BLOCKS_PER_TURN } from './types'
import { extractTargetIdsFromPatch } from './utils/extractTargetIds'
import { generateGraphHash } from '../utils/graphHash'
import { resolvePatchBlockState } from './selectors'
import { safeRichText, plainTextPreview } from '../utils/safeRichText'
import { isOrchestratorRenderingV2Enabled } from '../../flags'
import styles from './Conversation.module.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const artefactNoop = () => { /* intentionally empty */ }

/** Dedup guard: fire unknown-block telemetry once per block_type per session */
const _trackedUnknownBlockTypes = new Set<string>()

/**
 * DS v5 §21.2: resolve block type badge dot CSS class. Returns null for types with no dot.
 * Only the five block types explicitly listed in Brief A Task 6 get dots.
 */
function resolveBlockBadgeDotClass(block: ConversationBlock): string | null {
  switch (block.type) {
    case 'review_card': {
      const rc = block as ReviewCardBlockType
      return rc.variant === 'alert' ? styles.blockBadgeDotDanger : styles.blockBadgeDotInfo
    }
    case 'graph_patch': return styles.blockBadgeDotGoal
    case 'fact': return styles.blockBadgeDotSuccess
    case 'framing': return styles.blockBadgeDotInfo
    case 'commentary': return null // no dot per DS v5 §21.2
    case 'comparison': return styles.blockBadgeDotInfo
    case 'premortem': return styles.blockBadgeDotDanger
    case 'flip_analysis': return styles.blockBadgeDotDanger
    case 'proposal': return styles.blockBadgeDotGoal
    case 'exercise': return styles.blockBadgeDotInfo
    default: return null
  }
}

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
  onArtefactMessage?: (message: string) => void
  onProposalConfirm?: (proposalId: string) => void
  /** Word count of the turn's assistant_text — used by commentary collapse default logic */
  assistantTextWordCount?: number
}

export const InlineBlocks = memo(function InlineBlocks({
  blocks,
  turnId,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onArtefactMessage,
  onProposalConfirm,
  assistantTextWordCount = 0,
}: InlineBlocksProps) {
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? blocks : blocks.slice(0, MAX_VISIBLE_BLOCKS_PER_TURN)
  const hasOverflow = blocks.length > MAX_VISIBLE_BLOCKS_PER_TURN
  const hiddenCount = blocks.length - MAX_VISIBLE_BLOCKS_PER_TURN
  const showBadgeDots = isOrchestratorRenderingV2Enabled()

  return (
    <div className={styles.blockContainer}>
      {visible.map((block, i) => {
        const badgeDotClass = showBadgeDots ? resolveBlockBadgeDotClass(block) : null
        return (
          // data-citation-target is 1-based; CitationRef.index matches this
          // data-patch-id enables scroll-to-patch from GuidanceStrip approve_patch action
          <div
            key={i}
            data-citation-target={i + 1}
            className={badgeDotClass ? styles.blockWithBadge : undefined}
            {...(block.type === 'graph_patch' ? { 'data-patch-id': block.patch_id } : {})}
          >
            {badgeDotClass && <span className={badgeDotClass} data-testid="block-badge-dot" aria-hidden="true" />}
            <BlockRenderer
              block={block}
              turnId={turnId}
              patchBlockStates={patchBlockStates}
              patchRejections={patchRejections}
              onPatchAccept={onPatchAccept}
              onPatchDismiss={onPatchDismiss}
              onArtefactMessage={onArtefactMessage}
              onProposalConfirm={onProposalConfirm}
              assistantTextWordCount={assistantTextWordCount}
            />
          </div>
        )
      })}
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
  onArtefactMessage?: (message: string) => void
  onProposalConfirm?: (proposalId: string) => void
  assistantTextWordCount?: number
}

function BlockRenderer({
  block,
  turnId,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onArtefactMessage,
  onProposalConfirm,
  assistantTextWordCount = 0,
}: BlockRendererProps) {
  switch (block.type) {
    case 'commentary':
      return <CommentaryBlockRenderer block={block} assistantTextWordCount={assistantTextWordCount} />

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

    case 'artefact':
      return (
        <ArtefactBlockComponent
          block={block}
          onSendMessage={onArtefactMessage ?? artefactNoop}
        />
      )

    // Deterministic CEE block types — gated behind deterministicCee flag
    case 'comparison':
      if (!isDeterministicCeeEnabled()) return null
      return <ComparisonBlockRenderer block={block as ComparisonBlockType} />

    case 'premortem':
      if (!isDeterministicCeeEnabled()) return null
      return <PremortemBlockRenderer block={block as PremortemBlockType} />

    case 'flip_analysis':
      if (!isDeterministicCeeEnabled()) return null
      return <FlipAnalysisBlockRenderer block={block as FlipAnalysisBlockType} />

    case 'proposal':
      if (!isDeterministicCeeEnabled()) return null
      return <ProposalBlockRenderer block={block as ProposalBlockType} onProposalConfirm={onProposalConfirm} />

    case 'exercise':
      if (!isDeterministicCeeEnabled()) return null
      return <ExerciseBlockRenderer block={block as ExerciseBlockType} />

    default: {
      // Unknown block type — suppress from user view, log for diagnostics
      const rawType = (block as { type: string }).type
      if (import.meta.env.DEV) {
        console.warn('[InlineBlocks] Suppressed unknown block type:', rawType, block)
      }
      if (!_trackedUnknownBlockTypes.has(rawType)) {
        _trackedUnknownBlockTypes.add(rawType)
        trackEvent('unknown_block_type_suppressed', { block_type: rawType })
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
  assistantTextWordCount = 0,
}: {
  block: CommentaryBlockType
  /** Word count of the assistant_text in the same turn — used for default expand logic */
  assistantTextWordCount?: number
}) {
  const renderingV2 = isOrchestratorRenderingV2Enabled()

  const handleCitationClick = useCallback((index: number) => {
    // Scroll to the referenced block element by citation index
    const target = document.querySelector(`[data-citation-target="${index}"]`)
    if (!target) return
    if ('scrollIntoView' in target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    target.classList.add(styles.citationHighlightPulse)
    setTimeout(() => {
      target.classList.remove(styles.citationHighlightPulse)
    }, 1000)
  }, [])

  const toneClass =
    block.tone === 'warning'
      ? styles.commentaryBlockWarning
      : block.tone === 'positive'
        ? styles.commentaryBlockPositive
        : styles.commentaryBlock

  // ---------------------------------------------------------------------------
  // Collapsible logic (v2 only)
  // Default collapsed UNLESS assistant_text is thin (< 20 words), meaning the
  // commentary IS the essential finding and must default to expanded.
  // ---------------------------------------------------------------------------
  const defaultExpanded = assistantTextWordCount < 20
  const [expanded, setExpanded] = useState(defaultExpanded)

  // title is already a plain string; fallback uses plainTextPreview to decode entities
  // and strip markdown markers so the toggle reads naturally (e.g. "Lead phrase" not "**Lead phrase**")
  const previewLabel = block.title ?? plainTextPreview(block.text)

  const contentHtml = safeRichText(block.text)

  const hasSections = block.sections && block.sections.length > 0

  if (!renderingV2) {
    // Flag OFF — current behaviour unchanged
    return (
      <div>
        <div
          className={`${typography.bodySmall} ${toneClass} ${styles.markdownContent}`}
          // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText (allowlist: strong, br, ul, li)
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
        {hasSections && <CommentarySections sections={block.sections!} />}
        {block.citations && block.citations.length > 0 && (
          <CitationLegend citations={block.citations} onCitationClick={handleCitationClick} />
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Collapsible toggle — DS v5 §19: "More" / "Less" with ChevronDown/Up */}
      <button
        type="button"
        className={styles.commentaryToggle}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse commentary' : 'Expand commentary'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <span className={`${typography.bodySmall} ${toneClass} ${styles.commentaryPreviewText}`}>
          {previewLabel}
        </span>
        <span className={styles.commentaryToggleControl} aria-hidden="true">
          {expanded
            ? <><ChevronUp size={14} aria-hidden="true" /> Less</>
            : <><ChevronDown size={14} aria-hidden="true" /> More</>}
        </span>
      </button>

      {expanded && (
        <div className={styles.commentaryExpandedContent}>
          <div
            className={`${typography.bodySmall} ${toneClass} ${styles.markdownContent}`}
            // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText (allowlist: strong, br, ul, li)
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
          {hasSections && <CommentarySections sections={block.sections!} />}
          {block.citations && block.citations.length > 0 && (
            <CitationLegend citations={block.citations} onCitationClick={handleCitationClick} />
          )}
        </div>
      )}
    </div>
  )
})

/** Citation legend — shared between expanded and non-v2 paths */
function CitationLegend({
  citations,
  onCitationClick,
}: {
  citations: CommentaryBlockType['citations'] & {}
  onCitationClick: (index: number) => void
}) {
  return (
    <div className={styles.citationLegend} aria-label="Citations">
      {citations!.map((c) => (
        <span
          key={c.index}
          className={styles.citationEntry}
          role="button"
          tabIndex={0}
          onClick={() => onCitationClick(c.index)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onCitationClick(c.index)
            }
          }}
          aria-label={`Citation ${c.index}: ${c.source}`}
        >
          <span className={styles.citationIndex}>[{c.index}]</span>
          <span>{c.source}</span>
        </span>
      ))}
    </div>
  )
}

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
  const renderingV2 = isOrchestratorRenderingV2Enabled()

  // block.variant is already resolved by adaptCEEBlock (tone→variant mapping
  // applied flag-gated). Renderer just uses it directly.
  const effectiveVariant = block.variant

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
      className={effectiveVariant === 'info' ? styles.reviewCardInfo : styles.reviewCardAlert}
      data-testid={rest['data-testid']}
    >
      {effectiveVariant === 'info' ? (
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
        {renderingV2 ? (
          <div
            className={`${typography.bodySmall} ${styles.markdownContent}`}
            // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText (allowlist: strong, br, ul, li)
            dangerouslySetInnerHTML={{ __html: safeRichText(block.body) }}
          />
        ) : (
          <p className={typography.bodySmall}>{block.body}</p>
        )}
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

/** CEE findings may include fallback text fields beyond the typed EvidenceFinding interface */
interface RawFinding {
  text?: string
  summary?: string
  content?: string
  description?: string
  source_url?: string
  confidence?: number
  [key: string]: unknown
}

/** Task 5: Normalise a raw finding object — CEE may use text, summary, content, or description */
function normaliseFindingText(f: RawFinding): string | null {
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
          const text = normaliseFindingText(f as RawFinding)
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
        const raw = f as RawFinding
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
        <p className={typography.bodySmall}>Research findings available</p>
      )}
      {normalisedFindings.map((f, i) => (
        <div key={i} className={styles.evidenceFinding}>
          <p className={typography.bodySmall}>{f.text}</p>
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
      {sendChip && (
        <div className="mt-2 flex">
          <button
            type="button"
            onClick={hasGraph ? handleApplyToModel : undefined}
            disabled={!hasGraph}
            title={!hasGraph ? 'Generate a model first' : undefined}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} font-medium bg-transparent border rounded-full transition-colors ${
              hasGraph
                ? 'border-info/40 text-info hover:border-info hover:bg-info-light cursor-pointer'
                : 'border-border text-text-muted cursor-not-allowed opacity-60'
            }`}
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

  const canvasNodes = useCanvasStore(s => s.nodes)
  const canvasNodeIds = useMemo(() => new Set(canvasNodes.map((n: { id: string }) => n.id)), [canvasNodes])
  const opSummary = summarisePatchOps(block.operations)
  const rawProposalItems = getProposalItems(block)
  const proposalItemsSource = getProposalItemsSource(block)
  const opTargets = extractTargetIdsFromPatch(block.operations)
  const relatedTargets = extractGroundedTargets(block.related_elements)
  const nodeIds = relatedTargets.nodeIds.length > 0 ? relatedTargets.nodeIds : opTargets.nodeIds
  const edgeIds = relatedTargets.edgeIds.length > 0 ? relatedTargets.edgeIds : opTargets.edgeIds
  // Deduplicate and validate: only count target IDs that exist on the current canvas
  const uniqueTargetNodeIds = [...new Set(nodeIds)].filter(id => canvasNodeIds.has(id))
  const totalNodeCount = canvasNodeIds.size
  // Hide "Show on graph" when target set covers ≥80% of the graph (whole-graph highlight is useless)
  const isWholeGraphTarget = totalNodeCount > 0 && uniqueTargetNodeIds.length / totalNodeCount >= 0.8
  // Classify as generative draft: prefer explicit patch_type from CEE, fall back to heuristic
  const addNodeOpCount = block.operations.filter(op => op.op === 'add_node').length
  const isGenerativeDraft = block.patch_type === 'full_draft'
    || (block.patch_type == null && isAutoApplied && addNodeOpCount >= 3 && addNodeOpCount > block.operations.length / 2)
  const hasRevealTargets = !isWholeGraphTarget && !isGenerativeDraft && (uniqueTargetNodeIds.length > 0 || edgeIds.length > 0)
  const isApplied = isAutoApplied || resolvedState === 'accepted'
  const statusLabel = 'Applied'
  // For generative drafts with no backend proposal items, synthesize from operations
  // so the "Show details" toggle still works
  const proposalItems = rawProposalItems.length > 0
    ? rawProposalItems
    : isGenerativeDraft
      ? block.operations
          .filter(op => op.op === 'add_node')
          .map(op => ({
            description: (op.data?.label as string) ?? op.op,
            elementLabel: (op.data?.kind as string) ?? '',
            changeLabel: 'Add',
          }))
      : []
  const shouldCollapseProposalItems =
    proposalItems.length > 2
    || proposalItemsSource === 'derived_ops'
    || isApplied
  const v2Rendering = isOrchestratorRenderingV2Enabled()
  const showProposalItemsInline = proposalItems.length > 0 && !shouldCollapseProposalItems && !v2Rendering
  const showProposalDisclosure = proposalItems.length > 0 && (shouldCollapseProposalItems || v2Rendering)
  // Action labels: only use proposal-aware labels when items are inline-visible to the user
  const primaryActionLabel = showProposalItemsInline ? 'Apply' : 'Accept'
  const secondaryActionLabel = showProposalItemsInline ? 'Not what I meant' : 'Dismiss'

  // Determine which action buttons to render — filter to only actionable types
  const customActions = block.actions?.filter(
    (a: any) => a.action_type === 'accept' || a.action_type === 'dismiss'
  ) ?? []
  const hasCustomActions = customActions.length > 0

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
                <span className={`${typography.bodySmall} ${styles.graphPatchProposalDescription}`}>
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
            {showProposalDetails
              ? <><ChevronUp size={12} aria-hidden="true" /> Hide details</>
              : <><ChevronDown size={12} aria-hidden="true" /> Show details</>}
          </button>
          {showProposalDetails && (
            <div className={styles.graphPatchProposalList} data-testid="patch-proposal-list">
              {proposalItems.map((item, index) => (
                <div key={`${item.description}-${index}`} className={styles.graphPatchProposalItem}>
                  <div className={styles.graphPatchProposalCopy}>
                    <span className={`${typography.bodySmall} ${styles.graphPatchProposalDescription}`}>
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
            // Render CEE-provided action buttons (filtered to actionable types only)
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

// ---------------------------------------------------------------------------
// Deterministic CEE block renderers
// ---------------------------------------------------------------------------

function ComparisonBlockRenderer({ block }: { block: ComparisonBlockType }) {
  return (
    <div className={styles.comparisonBlock} data-testid="block-comparison">
      {block.narrative && (
        <p className={typography.panelBody} style={{ color: 'var(--text-body)' }}>{block.narrative}</p>
      )}
      {block.options.map((opt, i) => (
        <div key={opt.id || `${opt.label}-${i}`} className={styles.comparisonItem}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className={typography.panelHeader}>{opt.label}</span>
            {opt.probability != null && (
              <span className={typography.panelMeta} style={{ color: 'var(--text-light)' }}>
                {Math.round(opt.probability * 100)}% probability
                {opt.rank != null && ` · Rank ${opt.rank}`}
              </span>
            )}
            {opt.strengths && opt.strengths.length > 0 && (
              <div className={typography.panelBody} style={{ color: 'var(--success)' }}>
                {opt.strengths.map((s) => <div key={s}>+ {s}</div>)}
              </div>
            )}
            {opt.weaknesses && opt.weaknesses.length > 0 && (
              <div className={typography.panelBody} style={{ color: 'var(--danger)' }}>
                {opt.weaknesses.map((w) => <div key={w}>- {w}</div>)}
              </div>
            )}
            {opt.key_differentiators && opt.key_differentiators.length > 0 && (
              <div className={typography.panelMeta} style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>
                {opt.key_differentiators.join('; ')}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function PremortemBlockRenderer({ block }: { block: PremortemBlockType }) {
  return (
    <div className={styles.premortemBlock} data-testid="block-premortem">
      {block.target_option && (
        <span className={typography.panelHeader}>Pre-mortem: {block.target_option.label}</span>
      )}
      {block.narrative && (
        <p className={typography.panelBody} style={{ color: 'var(--text-body)' }}>{block.narrative}</p>
      )}
      {block.risk_paths.map((rp, i) => (
        <div key={`${rp.description}-${i}`} className={styles.failureMode}>
          <span className={typography.panelBody}>{rp.description}</span>
          {rp.path && rp.path.length > 0 && (
            <span className={typography.panelMeta} style={{ color: 'var(--text-light)' }}>
              {rp.path.join(' → ')}
            </span>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {rp.influence != null && (
              <span className={`${typography.panelMeta} ${styles.outlinedPill}`}>Influence: {Math.round(rp.influence * 100)}%</span>
            )}
            {rp.likelihood && (
              <span className={`${typography.panelMeta} ${styles.outlinedPill}`}>{rp.likelihood}</span>
            )}
            {rp.mitigation && (
              <span className={typography.panelMeta} style={{ color: 'var(--text-light)' }}>
                Mitigation: {rp.mitigation}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function FlipAnalysisBlockRenderer({ block }: { block: FlipAnalysisBlockType }) {
  return (
    <div className={styles.flipAnalysisBlock} data-testid="block-flip-analysis">
      {block.current_winner && (
        <span className={typography.panelHeader}>
          What could flip the result from {block.current_winner.label}
        </span>
      )}
      {block.narrative && (
        <p className={typography.panelBody} style={{ color: 'var(--text-body)' }}>{block.narrative}</p>
      )}
      {block.flip_conditions.map((fc, i) => (
        <div key={`${fc.assumption}-${i}`} style={{ padding: '6px 0', borderBottom: i < block.flip_conditions.length - 1 ? '1px solid var(--border-default)' : 'none' }}>
          <span className={typography.panelBody} style={{ fontWeight: 600 }}>{fc.assumption}</span>
          <div className={typography.panelMeta} style={{ color: 'var(--text-light)', marginTop: 2 }}>
            {fc.current_value && `Currently ${fc.current_value} · `}{fc.direction} past {fc.flip_threshold}
            {fc.alternative_winner && ` → ${fc.alternative_winner}`}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProposalBlockRenderer({ block, onProposalConfirm }: { block: ProposalBlockType; onProposalConfirm?: (proposalId: string) => void }) {
  const [state, setState] = useState<'pending' | 'accepted' | 'cancelled'>(
    // Auto-apply when confirmation is not required (false or absent)
    block.confirmation_required === true ? 'pending' : 'accepted',
  )
  const needsButtons = block.confirmation_required === true && state === 'pending'

  const handleApply = useCallback(() => {
    setState('accepted')
    onProposalConfirm?.(block.proposal_id)
  }, [block.proposal_id, onProposalConfirm])

  return (
    <div className={styles.proposalBlock} data-testid="block-proposal">
      <span className={`${typography.panelMeta} ${styles.graphPatchProposalEyebrow}`}>
        {state === 'accepted' ? 'Applied' : state === 'cancelled' ? 'Cancelled' : 'Proposed change'}
      </span>
      <p className={typography.panelBody} style={{ color: 'var(--text-body)' }}>{block.description}</p>
      {block.changes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {block.changes.map((c, i) => (
            <div key={`${c.target}-${i}`} className={styles.graphPatchProposalItem}>
              <span className={typography.panelBody}>{c.detail}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {c.operation && (
                  <span className={`${typography.panelMeta} ${styles.outlinedPill}`}>{c.operation}</span>
                )}
                {c.target && (
                  <span className={`${typography.panelMeta} ${styles.graphPatchProposalBadge}`}>{c.target}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {block.consequences && block.consequences.length > 0 && (
        <div className={typography.panelMeta} style={{ color: 'var(--text-light)' }}>
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
        <span className={`${typography.panelBody} ${state === 'accepted' ? styles.graphPatchStatusApplied : styles.graphPatchStatusDismissed}`} style={{ fontWeight: 500 }}>
          {state === 'accepted' ? 'Applied' : 'Cancelled'}
        </span>
      )}
    </div>
  )
}

/** CSP meta tag injected into exercise srcDoc to restrict script/resource capabilities */
const EXERCISE_CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src data:;">'

function ExerciseBlockRenderer({ block }: { block: ExerciseBlockType }) {
  const secureSrcDoc = block.content ? `${EXERCISE_CSP}${block.content}` : undefined

  return (
    <div className={styles.exerciseBlock} data-testid="block-exercise">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={typography.panelHeader}>{block.title}</span>
        <span className={`${typography.panelMeta} ${styles.outlinedPill}`}>{block.exercise_type}</span>
      </div>
      <p className={typography.panelBody} style={{ color: 'var(--text-body)' }}>{block.instructions}</p>
      {secureSrcDoc && (
        <div style={{ marginTop: 4, maxHeight: 400, overflow: 'auto', borderRadius: 6, border: '1px solid var(--border-default)' }}>
          <iframe
            srcDoc={secureSrcDoc}
            sandbox=""
            title={block.title}
            style={{ width: '100%', height: 300, border: 'none' }}
            data-testid="exercise-content-iframe"
          />
        </div>
      )}
    </div>
  )
}

/** Render structured sections from deterministic CEE commentary blocks */
function CommentarySections({ sections }: { sections: import('./types').CommentarySection[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {sections.map((section, i) => (
        <div key={i}>
          {section.heading && (
            <strong className={typography.panelHeader} style={{ display: 'block', marginBottom: 4 }}>
              {section.heading}
            </strong>
          )}
          {section.content && (
            <p className={typography.panelBody} style={{ color: 'var(--text-body)', margin: 0 }}>
              {section.content}
            </p>
          )}
          {section.items && section.items.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
              {section.items.map((item, j) => (
                <li key={j} className={typography.panelBody} style={{ color: 'var(--text-body)', marginBottom: 2 }}>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
