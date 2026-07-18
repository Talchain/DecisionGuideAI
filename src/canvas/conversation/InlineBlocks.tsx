/**
 * InlineBlocks — Renders conversation blocks inside assistant messages
 *
 * Supports all ConversationBlock types. Unknown block_type values render
 * a neutral fallback card — never crash.
 * Max 4 visible per turn with "Show more" toggle (graph_patch proposed blocks
 * always stay visible — budget is enforced upstream in useConversation).
 */

import { useState, useCallback, useMemo, memo, useRef } from 'react'
import type { RefObject } from 'react'
import { flushSync } from 'react-dom'
import { Lightbulb, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Wand2 } from 'lucide-react'
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
import { GraphPatchBlockRenderer, ProposalBlockRenderer } from './blocks/GraphPatchBlockRenderer'
import { computePhase3Pacing, isPhase3CardBlock, isBiasSignalCoachingBlock } from './phase3Pacing'
import { GraphVocabularyLegend } from './GraphVocabularyLegend'
import { V5AnalysisResultBlock } from '../../v5/blocks/V5AnalysisResultBlock'
import { V5GraphPatchBlock } from '../../v5/blocks/V5GraphPatchBlock'
import { V5ExplanationBlock } from '../../v5/blocks/V5ExplanationBlock'
import { V5ComparisonBlock } from '../../v5/blocks/V5ComparisonBlock'
import { V5FlipAnalysisBlock } from '../../v5/blocks/V5FlipAnalysisBlock'
import { V5ReviewCardBlock } from '../../v5/blocks/V5ReviewCardBlock'
import { V5CoachingBlock } from '../../v5/blocks/V5CoachingBlock'
import { V5EvidenceBlock } from '../../v5/blocks/V5EvidenceBlock'
import { V5ExerciseBlock } from '../../v5/blocks/V5ExerciseBlock'
import { V5UnsupportedBlock } from '../../v5/blocks/V5UnsupportedBlock'
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
 * DS v5 §21.2: resolve block type badge dot CSS class. Returns null for:
 *   - commentary (renders inline, no card, no dot)
 *   - artefact / model_receipt (specialised renderers outside the §21.2 table)
 *   - unknown block types
 * Every other declared block type gets a dot in the colour prescribed by §21.2.
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
    case 'brief': return styles.blockBadgeDotSuccess
    case 'evidence': return styles.blockBadgeDotInfo
    case 'commentary': return null // DS v5 §21.2: CommentaryBlock renders inline, no dot, no border
    case 'comparison': return styles.blockBadgeDotInfo
    case 'premortem': return styles.blockBadgeDotDanger
    case 'flip_analysis': return styles.blockBadgeDotDanger
    case 'proposal': return styles.blockBadgeDotGoal
    case 'exercise': return styles.blockBadgeDotInfo
    // Track C slice 1: typed Phase 3 blocks — severity drives the dot colour
    // for review cards (visual channel only); coaching is always info.
    case 'v5_review_card':
      return block.severity === 'info' ? styles.blockBadgeDotInfo : styles.blockBadgeDotDanger
    case 'v5_coaching': return styles.blockBadgeDotInfo
    // Track C slice 2 (Lane UI-W4 C): evidence follows the review-card
    // severity rule; exercise carries no severity → always info (matching
    // the legacy 'exercise' dot above).
    case 'v5_evidence':
      return block.severity === 'info' ? styles.blockBadgeDotInfo : styles.blockBadgeDotDanger
    case 'v5_exercise': return styles.blockBadgeDotInfo
    default: return null
  }
}

// GraphPatchBlock display helpers moved to blocks/GraphPatchBlockRenderer.tsx

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
  // F16: phase-3 card pacing — flood turns default to the top 3 phase-3
  // cards expanded, the remainder behind ONE count affordance.
  const [showAllPhase3, setShowAllPhase3] = useState(false)

  const pacing = useMemo(() => computePhase3Pacing(blocks), [blocks])

  // Legacy per-turn budget. When phase-3 pacing is active, the phase-3
  // cards carry their own budget (the pacing group), so the legacy cap
  // counts only the non-phase-3 blocks; otherwise behaviour is unchanged
  // (cap across all blocks, as before F16). Bias-signal cards are exempt
  // (review-folds C1) — but only the FIRST DRAFT_BIAS_SIGNAL_CARD_CAP of
  // them (/simplify item 5), from the ONE exempt set computePhase3Pacing
  // already derived, so this budget and the pacing budget cannot disagree.
  // Bias cards beyond the cap fall through to the normal budget path.
  const { hiddenByBudget, hasOverflow, hiddenCount } = useMemo(() => {
    const budgetIndices: number[] = []
    for (let i = 0; i < blocks.length; i++) {
      if (pacing.biasSignalExemptIndices.has(i)) continue
      if (pacing.pacingActive && isPhase3CardBlock(blocks[i])) continue
      budgetIndices.push(i)
    }
    return {
      hiddenByBudget: new Set(
        showAll ? [] : budgetIndices.slice(MAX_VISIBLE_BLOCKS_PER_TURN),
      ),
      hasOverflow: budgetIndices.length > MAX_VISIBLE_BLOCKS_PER_TURN,
      hiddenCount: budgetIndices.length - MAX_VISIBLE_BLOCKS_PER_TURN,
    }
  }, [blocks, pacing, showAll])
  // DS v5 §21.2: block type badge dots are always on (no v2 flag gate).
  const showBadgeDots = true

  const phase3Collapsed = pacing.pacingActive && !showAllPhase3

  // THE visibility rule — one predicate, both consumers (/simplify item 4).
  // The render guard below and the legend gate were De Morgan duals of this
  // and could drift apart.
  const isBlockHidden = useCallback(
    (i: number) => hiddenByBudget.has(i) || (phase3Collapsed && pacing.collapsedIndices.has(i)),
    [hiddenByBudget, phase3Collapsed, pacing],
  )

  // C13: the graph-vocabulary legend gates on a phase-3 card being
  // CURRENTLY RENDERED — never on mere presence in the turn (a legend for
  // cards hidden behind the pacing collapse or the legacy budget explained
  // vocabulary the user could not see).
  const phase3Rendered = blocks.some((b, i) => isPhase3CardBlock(b) && !isBlockHidden(i))

  // C11: citations can point at collapsed content. Handed to the
  // commentary renderer only while something is actually collapsed, so a
  // genuinely dangling citation stays a no-op.
  const revealHiddenBlocks = useCallback(() => {
    setShowAllPhase3(true)
    setShowAll(true)
  }, [])
  const hasCollapsedContent = phase3Collapsed || hiddenByBudget.size > 0

  // Citation targets are numbered 1-based PER TURN, so in a thread with
  // several assistant turns on screen every turn carries its own
  // data-citation-target="1", "2", … A document-wide lookup would resolve to
  // the FIRST match in document order — the oldest turn's block — and scroll
  // the user away from the turn they clicked in. The handler resolves inside
  // this container only, so a citation lands in its own turn or nowhere.
  const blockContainerRef = useRef<HTMLDivElement>(null)

  return (
    <div className={styles.blockContainer} ref={blockContainerRef}>
      {pacing.pacingActive && (
        // Static sr-only summary of the collapsed count. Deliberately NOT
        // a live region (C4): the toggle's accessible name already carries
        // the count, and revealed cards entering ChatThread's role=log
        // announce their own addition — a nested role=status here replayed
        // the text on unhide and double-announced every toggle.
        <span className="sr-only">
          {phase3Collapsed
            ? `${pacing.collapsedCount} more coaching and review cards collapsed`
            : `Showing all ${pacing.phase3Count} coaching and review cards`}
        </span>
      )}
      {blocks.map((block, i) => {
        // The single phase-3 count affordance sits at the position of the
        // first collapsed card, so reading order is preserved exactly.
        const affordance =
          pacing.pacingActive && i === pacing.affordanceIndex ? (
            <button
              type="button"
              className={styles.phase3PacingToggle}
              onClick={() => setShowAllPhase3((v) => !v)}
              aria-expanded={showAllPhase3}
              aria-label={
                showAllPhase3
                  ? 'Show fewer coaching and review cards'
                  : `Show ${pacing.collapsedCount} more coaching and review card${pacing.collapsedCount !== 1 ? 's' : ''}`
              }
            >
              {showAllPhase3 ? (
                <><ChevronUp size={12} aria-hidden="true" /> Show less</>
              ) : (
                <><ChevronDown size={12} aria-hidden="true" /> Show {pacing.collapsedCount} more</>
              )}
            </button>
          ) : null

        if (isBlockHidden(i)) {
          return affordance ? <div key={i}>{affordance}</div> : null
        }

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
            {affordance}
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
              onRevealHiddenBlocks={hasCollapsedContent ? revealHiddenBlocks : undefined}
              blockContainerRef={blockContainerRef}
            />
          </div>
        )
      })}
      {hasOverflow && (
        <button
          type="button"
          className={styles.showMoreToggle}
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          aria-label={showAll ? 'Show fewer blocks' : `Show ${hiddenCount} more block${hiddenCount !== 1 ? 's' : ''}`}
        >
          {showAll ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
      {/* F16: graph-vocabulary legend affordance near the phase-3 cards —
          only when at least one is currently rendered (C13). */}
      {phase3Rendered && <GraphVocabularyLegend />}
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
  /** C11: reveal collapsed pacing/budget content (present only while something is collapsed). */
  onRevealHiddenBlocks?: () => void
  /** Scope for citation-target lookups — the emitting turn's own block container. */
  blockContainerRef: RefObject<HTMLDivElement | null>
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
  onRevealHiddenBlocks,
  blockContainerRef,
}: BlockRendererProps) {
  switch (block.type) {
    case 'commentary':
      return (
        <CommentaryBlockRenderer
          block={block}
          assistantTextWordCount={assistantTextWordCount}
          onRevealHiddenBlocks={onRevealHiddenBlocks}
          blockContainerRef={blockContainerRef}
        />
      )

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
      // No coaching summary = no card (brief invariant). The construction gate
      // (maybeBuildModelReceiptBlock) already enforces this on the live path;
      // guard the render path too so a coaching-less block (e.g. a hydrated or
      // legacy one) can never show a headline/nudge shell.
      if (!block.coachingSummary?.trim()) return null
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

    // V5 block kinds — no flag gate; whole V5 path is behind
    // VITE_ENABLE_V5_ORCHESTRATOR at the dispatcher level.
    case 'v5_analysis_result':
      return <V5AnalysisResultBlock block={block} />

    case 'v5_graph_patch':
      return <V5GraphPatchBlock block={block} />

    case 'v5_explanation':
      return <V5ExplanationBlock block={block} />

    case 'v5_comparison':
      return <V5ComparisonBlock block={block} />

    case 'v5_flip_analysis':
      return <V5FlipAnalysisBlock block={block} />

    // Track C slice 1 (D-5): 0.13.x-typed Phase 3 blocks. All copy is
    // producer-owned and rendered verbatim (provisional_doctrine_v0).
    case 'v5_review_card':
      return <V5ReviewCardBlock block={block} />

    case 'v5_coaching':
      // Leg 3 (bias coaching): bias-signal coaching renders through the
      // SAME V5CoachingBlock with the DS-recipe variant (neutral bg +
      // coloured left border, bias-signal-card testids) — one structure,
      // so producer fields (action_label pill included) can never drop on
      // one fork (review-folds C10+R1).
      return (
        <V5CoachingBlock
          block={block}
          variant={isBiasSignalCoachingBlock(block) ? 'bias_signal' : 'default'}
        />
      )

    // Track C slice 2 (Lane UI-W4 C): 0.13.1-typed evidence + exercise.
    // Same doctrine — producer copy verbatim, enum tokens data-* only.
    case 'v5_evidence':
      return <V5EvidenceBlock block={block} />

    case 'v5_exercise':
      return <V5ExerciseBlock block={block} />

    case 'v5_unsupported':
      return <V5UnsupportedBlock block={block} />

    default: {
      // Unknown block type (seamlessness R7): schema-version skew is the
      // platform's #1 hazard, and a silent drop reads as the AI saying less
      // than it said. Render the honest fallback card instead of null.
      // Telemetry event name kept — it now means "fallback card shown".
      const rawType = (block as { type: string }).type
      if (import.meta.env.DEV) {
        console.warn('[InlineBlocks] Unknown block type (fallback card shown):', rawType, block)
      }
      if (!_trackedUnknownBlockTypes.has(rawType)) {
        _trackedUnknownBlockTypes.add(rawType)
        trackEvent('unknown_block_type_suppressed', { block_type: rawType })
      }
      return (
        <V5UnsupportedBlock
          block={{ type: 'v5_unsupported', blockType: rawType, raw: block }}
        />
      )
    }
  }
}

// ---------------------------------------------------------------------------
// CommentaryBlock
// ---------------------------------------------------------------------------


/** Scroll to and pulse-highlight a citation target element. */
function scrollToCitationTarget(target: Element): void {
  if ('scrollIntoView' in target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  target.classList.add(styles.citationHighlightPulse)
  setTimeout(() => {
    target.classList.remove(styles.citationHighlightPulse)
  }, 1000)
}

const CommentaryBlockRenderer = memo(function CommentaryBlockRenderer({
  block,
  assistantTextWordCount = 0,
  onRevealHiddenBlocks,
  blockContainerRef,
}: {
  block: CommentaryBlockType
  /** Word count of the assistant_text in the same turn — used for default expand logic */
  assistantTextWordCount?: number
  /** C11: reveal collapsed pacing/budget content (present only while something is collapsed). */
  onRevealHiddenBlocks?: () => void
  /** Scope for citation-target lookups — the emitting turn's own block container. */
  blockContainerRef: RefObject<HTMLDivElement | null>
}) {
  const renderingV2 = isOrchestratorRenderingV2Enabled()

  const handleCitationClick = useCallback((index: number) => {
    // CitationRef.index is 1-based WITHIN THE TURN, and every rendered turn
    // emits its own data-citation-target="1", "2", … A document-wide lookup
    // resolves to the first match in document order — the OLDEST turn's
    // block — so a citation clicked in turn 5 scrolled the user to turn 1.
    // Scoped to the emitting turn's container: a citation lands in its own
    // turn or nowhere. Fails CLOSED when the container is not mounted — a
    // document-wide fallback here would silently reinstate the cross-turn bug.
    const scope = blockContainerRef.current
    if (!scope) return
    const target = scope.querySelector(`[data-citation-target="${index}"]`)
    if (target) {
      scrollToCitationTarget(target)
      return
    }
    // C11: the target may sit behind the phase-3 pacing collapse or the
    // legacy per-turn budget (collapsed blocks render no
    // data-citation-target node). When collapsed content exists, reveal it
    // and flush the commit synchronously, so the retried lookup sees the
    // revealed node in this same click handler. Fail silent only when the
    // target is STILL missing (a genuinely dangling citation).
    if (!onRevealHiddenBlocks) return
    flushSync(onRevealHiddenBlocks)
    const revealed = scope.querySelector(`[data-citation-target="${index}"]`)
    if (revealed) scrollToCitationTarget(revealed)
  }, [onRevealHiddenBlocks, blockContainerRef])

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
  const label = level === 3 ? 'Robust' : level === 2 ? 'Moderate' : 'Sensitive'

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
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelBody} bg-panel border border-panel-border rounded-full transition-colors ${
              hasGraph
                ? 'text-text-body hover:bg-panel-hover cursor-pointer'
                : 'text-text-light cursor-not-allowed opacity-60'
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

// GraphPatchBlockRenderer extracted to blocks/GraphPatchBlockRenderer.tsx

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
          <span className={`${typography.panelBody} font-semibold`}>{fc.assumption}</span>
          <div className={typography.panelMeta} style={{ color: 'var(--text-light)', marginTop: 2 }}>
            {fc.current_value && `Currently ${fc.current_value} · `}{fc.direction} past {fc.flip_threshold}
            {fc.alternative_winner && ` → ${fc.alternative_winner}`}
          </div>
        </div>
      ))}
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
