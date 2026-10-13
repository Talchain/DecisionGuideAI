/**
 * InlineBlocks — Renders conversation blocks inside assistant messages
 *
 * Supports all ConversationBlock types. Unknown block_type values render
 * a neutral fallback card — never crash.
 *
 * AI-first: render all composed blocks in producer order without prose deduplication.
 */

import { useState, useCallback, useMemo, memo, useRef } from 'react'
import type { RefObject, ReactNode } from 'react'
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
} from './types'
import { isPreAnalysisEnrichedEnabled, isDeterministicCeeEnabled, isCompactCoachingLinesEnabled } from '../../flags'
import { trackEvent } from '../../lib/posthog'
import type {
  ComparisonBlock as ComparisonBlockType,
  PremortemBlock as PremortemBlockType,
  FlipAnalysisBlock as FlipAnalysisBlockType,
  ProposalBlock as ProposalBlockType,
  ExerciseBlock as ExerciseBlockType,
} from './types'
import { scrollWithinThread } from './hooks/threadScroll'
import { ModelReceiptBlock } from './ModelReceiptBlock'
import { ArtefactBlock as ArtefactBlockComponent } from '../../components/chat/ArtefactBlock'
import type { PatchBlockState, PatchRejectionInfo } from './useConversation'
import { GraphPatchBlockRenderer, ProposalBlockRenderer } from './blocks/GraphPatchBlockRenderer'
import { isPhase3CardBlock, isBiasSignalCoachingBlock } from './phase3Pacing'
import { CoachingLine, isCollapsibleCardBlock, planCoachingLines } from './CoachingLine'
import {
  composeMessage,
  firstPromotableActionIndex,
  shouldPromoteRunTurnCard,
  turnDeliversNarrativeAsTypedCard,
} from './messageComposition'
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
import { V5HeldProposalBlock } from '../../v5/blocks/V5HeldProposalBlock'
import type { HeldProposalSettlement } from '../../v5/blocks/V5HeldProposalBlock'
import { resolveHeldProposalState } from './selectors'
import { V5UnsupportedBlock } from '../../v5/blocks/V5UnsupportedBlock'
import { safeRichText, plainTextPreview } from '../utils/safeRichText'
import { isOrchestratorRenderingV2Enabled } from '../../flags'
import styles from './Conversation.module.css'
import { PANEL_LIST_BULLET } from './panelLists'
import { ICON_DENSE } from './panelIcons'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const artefactNoop = () => { /* intentionally empty */ }

/**
 * Wrap a block's renderer in a compact line, or pass it through untouched.
 *
 * A tiny component rather than a branch inside `renderEntry` so there is still
 * exactly ONE render path for a block: the same `<BlockRenderer/>` element is
 * constructed either way and only its wrapper differs. Two branches each
 * building their own renderer is how the top-level and demoted paths would
 * drift, which is the hazard `renderEntry`'s own comment names.
 */
function MaybeCoachingLine({
  block,
  asLine,
  disambiguator,
  children,
}: {
  block: ConversationBlock
  asLine: boolean
  disambiguator: string | null
  children: ReactNode
}) {
  if (!asLine) return <>{children}</>
  return (
    <CoachingLine block={block} disambiguator={disambiguator}>
      {children}
    </CoachingLine>
  )
}

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
    // R8: held proposal is an info-channel proposal card (matches its border).
    case 'v5_held_proposal': return styles.blockBadgeDotInfo
    // DS v5 §21.2: GraphPatchBlock = goal, ScenarioBlock (comparison) = option.
    // Each matches its card's border.
    case 'v5_graph_patch': return styles.blockBadgeDotGoal
    case 'v5_comparison': return styles.blockBadgeDotOption
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
  /**
   * Record a held proposal's settlement in the conversation's SHARED registry
   * (`patchBlockStates`), keyed by the MOUNT key (turn + handle) for every
   * copy on screen when the user acts. Absent ⇒ the card still
   * sends its confirm/decline turn but cannot retire — see the state-ownership
   * note in `V5HeldProposalBlock`. Every product host wires this.
   */
  onHeldProposalSettle?: (
    proposalId: string,
    settlement: HeldProposalSettlement,
    turnId?: string,
  ) => void
  /** Word count of the turn's assistant_text — used by commentary collapse default logic */
  assistantTextWordCount?: number
  /**
   * ONE RENDER AUTHORITY (L-16, item 7). Text the turn has ALREADY rendered
   * above these blocks — the consent-card surfaces (tier 0) and the prose body
   * (tier 2). A `commentary` block whose paragraphs repeat one of those, or
   * repeat an earlier commentary block in this same turn, renders the surviving
   * remainder instead of the same sentences a second time.
   *
   * Absent ⇒ nothing is withheld anywhere, i.e. byte-identical to the previous
   * behaviour for every caller that does not opt in.
   */
  alreadyRendered?: readonly string[]
  /** L-42: only the newest assistant turn's applied-edit card may claim the staleness voice. */
  isLatestAssistantTurn?: boolean
  /**
   * This turn asks the user to consent to a proposal (`offersPendingConsent`
   * over the message's own chips). The run card then keeps its line — the
   * consent is the turn's one next action (`shouldPromoteRunTurnCard`).
   */
  consentPending?: boolean
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
  onHeldProposalSettle,
  assistantTextWordCount = 0,
  isLatestAssistantTurn = false,
  consentPending = false,
}: InlineBlocksProps) {
  // AI-first: retain structural composition and consent ownership, with every tier visible.
  const composition = useMemo(() => composeMessage(blocks, null, { consentPending }), [blocks, consentPending])
  const visibleTopLevel = useMemo(
    () => [...composition.pinned, ...composition.points, ...composition.detail].sort((a, b) => a.index - b.index),
    [composition],
  )
  const showBadgeDots = true
  const narrativeDeliveredByTypedCard = useMemo(
    () => turnDeliversNarrativeAsTypedCard(visibleTopLevel.map(e => blocks[e.index])),
    [visibleTopLevel, blocks],
  )
  const phase3Rendered = visibleTopLevel.some(e => isPhase3CardBlock(blocks[e.index]))

  // Citation targets are numbered 1-based PER TURN, so in a thread with
  // several assistant turns on screen every turn carries its own
  // data-citation-target="1", "2", … A document-wide lookup would resolve to
  // the FIRST match in document order — the oldest turn's block — and scroll
  // the user away from the turn they clicked in. The handler resolves inside
  // this container only, so a citation lands in its own turn or nowhere.
  const blockContainerRef = useRef<HTMLDivElement>(null)

  const linePlan = useMemo(() => planCoachingLines(blocks, { consentPending }), [blocks, consentPending])

  const promotedActionIndex = shouldPromoteRunTurnCard({ consentPending }) ? firstPromotableActionIndex(blocks) : -1

  const renderEntry = (index: number) => {
    const block = blocks[index]
    const badgeDotClass = showBadgeDots ? resolveBlockBadgeDotClass(block) : null
    /**
     * COMPACT LINE. The block's own renderer is unchanged and simply moves
     * inside a native disclosure whose summary is the producer's own title —
     * so a turn's coaching reads as a scannable list rather than a stack of
     * bordered panels. See CoachingLine.tsx for what may and may not collapse:
     * pinned consent affordances never do, and a block with no usable producer
     * title falls through to its full card.
     *
     * ⚠ APPLIED HERE, IN THE ONE SHARED RENDER PATH, SO IT REACHES THE DEMOTED
     * TIER TOO. That is the point rather than a side effect: `MAX_POINTS` keeps
     * 3 cards top-level and demotes 5-11 on a real analysis turn, so collapsing
     * only the top-level entries would leave "Show N more" opening onto the
     * same wall it opens onto today.
     */
    /*
     * ⚠ THE PLAN IS COMPUTED OVER THE WHOLE LIST, NOT PER BLOCK, because the
     * thing it guards against is invisible from inside one block: two producer
     * blocks can carry the SAME title, and as title-only lines they become one
     * affordance the user cannot aim. See `planCoachingLines`.
     */
    const plan = linePlan.get(block)
    // U7 expands prose, but must not promote an unproven coaching action or
    // compete with this turn's consent. The existing plan still owns promotion.
    const actionDisclosure = block.type === 'v5_coaching' && Boolean(block.action_label && block.action_prompt)
      && index !== promotedActionIndex
    const asLine =
      (isCompactCoachingLinesEnabled() || actionDisclosure) && isCollapsibleCardBlock(block) && plan?.collapsible !== false
    /*
     * ⭐ THE BADGE DOT IS A CARD'S, SO A LINE DOES NOT GET ONE. DS v5 §21.2
     * defines it as one limb of the BLOCK treatment — "Base block: `bg-panel`,
     * `rounded-[20px]`, 24px padding, `shadow-1`. Type-specific top borders
     * (3px). Block type badges are small coloured dots (8px diameter, main
     * colour fill) top-left." A collapsed line has none of the others; the dot
     * survived only because it is painted HERE, by the parent, where the card's
     * own `suppressHeader` could not reach it.
     *
     * ⛔ AND IT WAS COLLIDING, NOT MERELY DUPLICATING. `.blockBadgeDot` is
     * `position:absolute; top:8px; left:8px`, and its clearance comes from
     * `.blockWithBadge > div { padding-left: 24px }` — a CHILD selector that
     * matches a `div` only. As a line the child is `<details>`, so the selector
     * silently stopped matching, nothing reserved the gutter, and the dot
     * landed on the summary's own first item at the same 8px. Photographed on
     * deployed staging b7c8c74e: a blue dot sitting on the glyph. A CSS
     * selector that stops matching raises nothing and fails no test, which is
     * why this is gated in TS where a spec can bind to it.
     *
     * The wrapper class goes with it: `position:relative` exists only to
     * position the dot, and leaving it would keep a containing block for no
     * descendant.
     */
    const showBadgeDot = badgeDotClass !== null && !asLine
    return (
      // data-citation-target is 1-based on the ORIGINAL index; CitationRef.index
      // matches this, so a citation still resolves after demotion.
      // data-patch-id enables scroll-to-patch from GuidanceStrip approve_patch.
      <div
        key={index}
        data-citation-target={index + 1}
        className={showBadgeDot ? styles.blockWithBadge : undefined}
        {...(block.type === 'graph_patch' ? { 'data-patch-id': block.patch_id } : {})}
      >
        {showBadgeDot && <span className={badgeDotClass} data-testid="block-badge-dot" aria-hidden="true" />}
        <MaybeCoachingLine block={block} asLine={asLine} disambiguator={plan?.disambiguator ?? null}>
        <BlockRenderer
          block={block}
          suppressHeader={asLine}
          discloseAction={actionDisclosure && !asLine}
          turnId={turnId}
          patchBlockStates={patchBlockStates}
          patchRejections={patchRejections}
          onPatchAccept={onPatchAccept}
          onPatchDismiss={onPatchDismiss}
          onArtefactMessage={onArtefactMessage}
          onProposalConfirm={onProposalConfirm}
          onHeldProposalSettle={onHeldProposalSettle}
          assistantTextWordCount={assistantTextWordCount}
          narrativeDeliveredByTypedCard={narrativeDeliveredByTypedCard}
          isLatestAssistantTurn={isLatestAssistantTurn}
          blockContainerRef={blockContainerRef}
        />
        </MaybeCoachingLine>
      </div>
    )
  }

  return (
    <div className={styles.blockContainer} ref={blockContainerRef} data-testid="block-container">
      {visibleTopLevel.map(e => renderEntry(e.index))}

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
  /**
   * True when this block is rendered INSIDE a `CoachingLine`, whose summary
   * already carries the block's category chip and title. The card omits its own
   * copy of them so an open line does not show the title twice.
   */
  suppressHeader?: boolean
  /** Keep unpromoted actions behind a disclosure when the prose stays expanded. */
  discloseAction?: boolean
  turnId?: string
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onPatchAccept?: (patchId: string, block: GraphPatchBlockType) => void
  onPatchDismiss?: (patchId: string) => void
  onArtefactMessage?: (message: string) => void
  onProposalConfirm?: (proposalId: string) => void
  /**
   * Record a held proposal's settlement in the conversation's SHARED registry
   * (`patchBlockStates`), keyed by the MOUNT key (turn + handle) for every
   * copy on screen when the user acts. Absent ⇒ the card still
   * sends its confirm/decline turn but cannot retire — see the state-ownership
   * note in `V5HeldProposalBlock`. Every product host wires this.
   */
  onHeldProposalSettle?: (
    proposalId: string,
    settlement: HeldProposalSettlement,
    turnId?: string,
  ) => void
  assistantTextWordCount?: number
  /**
   * ONE RENDER AUTHORITY: the surviving text for a `commentary` block whose
   * paragraphs repeated a surface rendered earlier in this turn. Present ONLY
   * when something was withheld, so the ordinary path is untouched.
   */
  commentaryTextOverride?: string
  /**
   * UX gate 2026-08-18 point 4b — does this turn deliver the analysis
   * narrative as its own titled card? Only `v5_analysis_result` reads it.
   */
  narrativeDeliveredByTypedCard?: boolean
  /** L-42: only the newest assistant turn's applied-edit card may claim the staleness voice. */
  isLatestAssistantTurn?: boolean
  /** C11: reveal collapsed pacing/budget content (present only while something is collapsed). */
  onRevealHiddenBlocks?: () => void
  /** Scope for citation-target lookups — the emitting turn's own block container. */
  blockContainerRef: RefObject<HTMLDivElement | null>
}

function BlockRenderer({
  block,
  suppressHeader = false,
  discloseAction = false,
  turnId,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onArtefactMessage,
  onProposalConfirm,
  onHeldProposalSettle,
  assistantTextWordCount = 0,
  commentaryTextOverride,
  narrativeDeliveredByTypedCard = false,
  isLatestAssistantTurn = false,
  onRevealHiddenBlocks,
  blockContainerRef,
}: BlockRendererProps) {
  switch (block.type) {
    case 'commentary':
      return (
        <CommentaryBlockRenderer
          block={block}
          assistantTextWordCount={assistantTextWordCount}
          textOverride={commentaryTextOverride}
          onRevealHiddenBlocks={onRevealHiddenBlocks}
          blockContainerRef={blockContainerRef}
        />
      )

    case 'review_card':
      return (
        <ReviewCardBlockRenderer
          block={block}
          suppressHeader={suppressHeader}
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
      return (
        <V5AnalysisResultBlock
          block={block}
          narrativeDeliveredByTypedCard={narrativeDeliveredByTypedCard}
          summaryBehindDisclosure={false}
        />
      )

    case 'v5_graph_patch':
      return (
        <V5GraphPatchBlock block={block} isLatestAssistantTurn={isLatestAssistantTurn} />
      )

    case 'v5_explanation':
      return <V5ExplanationBlock block={block} />

    case 'v5_comparison':
      return <V5ComparisonBlock block={block} />

    case 'v5_flip_analysis':
      return <V5FlipAnalysisBlock block={block} />

    // Track C slice 1 (D-5): 0.13.x-typed Phase 3 blocks. All copy is
    // producer-owned and rendered verbatim (provisional_doctrine_v0).
    case 'v5_review_card':
      return <V5ReviewCardBlock block={block} suppressHeader={suppressHeader} />

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
          discloseAction={discloseAction}
          suppressHeader={suppressHeader}
          turnId={turnId}
        />
      )

    // Track C slice 2 (Lane UI-W4 C): 0.13.1-typed evidence + exercise.
    // Same doctrine — producer copy verbatim, enum tokens data-* only.
    case 'v5_evidence':
      return <V5EvidenceBlock block={block} suppressHeader={suppressHeader} />

    case 'v5_exercise':
      return <V5ExerciseBlock block={block} />

    // R8 (roadmap 2.27): held CEE mutation → honest confirm/dismiss card.
    case 'v5_held_proposal':
      // SENDABLE failure 5: settlement is read from and written to the ONE
      // shared registry. The key is the MOUNT key — this turn plus this
      // proposal — because a CEE hold handle names a target SLOT, not an offer
      // instance, and is deliberately re-minted for a later offer against the
      // same target (`selectors.ts` :: the two questions). Both surfaces render
      // the same `message.id`, so they still share a key and still retire
      // together; a LATER turn re-issuing the handle gets its own key and stays
      // offerable, which is the half the handle-only key destroyed.
      return (
        <V5HeldProposalBlock
          block={block}
          turnId={turnId}
          settledState={resolveHeldProposalState(turnId, block.proposal_id, patchBlockStates)}
          onSettle={onHeldProposalSettle}
        />
      )

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
  // Within the thread only (`threadScroll.ts`): `scrollIntoView` also moves the dock's overflow-hidden `aside`.
  // A target outside any thread keeps the old call.
  if (!scrollWithinThread(target, { behavior: 'smooth', block: 'nearest' })
    && 'scrollIntoView' in target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  target.classList.add(styles.citationHighlightPulse)
  setTimeout(() => {
    target.classList.remove(styles.citationHighlightPulse)
  }, 1000)
}

const CommentaryBlockRenderer = memo(function CommentaryBlockRenderer({
  block,
  textOverride,
  onRevealHiddenBlocks,
  blockContainerRef,
}: {
  block: CommentaryBlockType
  /** Word count of the assistant_text in the same turn — used for default expand logic */
  assistantTextWordCount?: number
  /**
   * ONE RENDER AUTHORITY: surviving text after whole segments already rendered
   * earlier in this turn were withheld. Undefined ⇒ render `block.text` as-is.
   */
  textOverride?: string
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
  // U7: commentary starts expanded, regardless of the reply length.
  // ---------------------------------------------------------------------------
  const defaultExpanded = true
  const [expanded, setExpanded] = useState(defaultExpanded)

  // title is already a plain string; fallback uses plainTextPreview to decode entities
  // and strip markdown markers so the toggle reads naturally (e.g. "Lead phrase" not "**Lead phrase**")
  const bodyText = textOverride ?? block.text
  const previewLabel = block.title ?? plainTextPreview(bodyText)

  const contentHtml = safeRichText(bodyText)

  const hasSections = block.sections && block.sections.length > 0

  if (!renderingV2) {
    // Flag OFF — current behaviour unchanged
    return (
      <div>
        <div
          className={`${typography.chatBody} ${toneClass} ${styles.markdownContent}`}
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
        <span className={`${typography.chatBody} ${toneClass} ${styles.commentaryPreviewText}`}>
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
            className={`${typography.chatBody} ${toneClass} ${styles.markdownContent}`}
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
  suppressHeader = false,
  ...rest
}: {
  block: ReviewCardBlockType
  /** See `V5CoachingBlockProps.suppressHeader`. */
  suppressHeader?: boolean
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
          {/* The TITLE only. The priority badge below is NOT suppressed: the
              line's summary carries the title but not the priority, so hiding
              the badge here would lose a producer fact rather than de-duplicate
              one. */}
          {!suppressHeader && (
            <div className={`${typography.panelHeader} ${styles.reviewCardTitle}`}>{block.title}</div>
          )}
          {priorityClass && priorityLabel && (
            <span className={priorityClass} data-testid={`priority-badge-${block.priority}`}>
              {priorityLabel}
            </span>
          )}
        </div>
        {renderingV2 ? (
          <div
            className={`${typography.chatBody} ${styles.markdownContent}`}
            // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText (allowlist: strong, br, ul, li)
            dangerouslySetInnerHTML={{ __html: safeRichText(block.body) }}
          />
        ) : (
          <p className={typography.chatBody}>{block.body}</p>
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
          <span className={`${typography.chatMeta} ${styles.factLabel}`}>{block.label}</span>
          {block.source && <span className={styles.factSource}>{block.source}</span>}
        </>
      )}

      {(factType === 'option_comparison' || factType === 'sensitivity') && (
        <>
          <span className={`${typography.chatMeta} ${styles.factLabel}`}>{block.label}</span>
          <BarTemplateRows facts={block.facts ?? []} />
        </>
      )}

      {factType === 'robustness' && (
        <>
          <span className={`${typography.chatMeta} ${styles.factLabel}`}>{block.label}</span>
          <RobustnessIndicator value={block.value} />
        </>
      )}

      {factType === 'constraint' && (
        <>
          <span className={`${typography.chatMeta} ${styles.factLabel}`}>{block.label}</span>
          <ConstraintRow value={block.value} />
        </>
      )}

      {/* Unknown fact_type: fall back to simple */}
      {factType !== 'simple' && factType !== 'option_comparison' && factType !== 'sensitivity' && factType !== 'robustness' && factType !== 'constraint' && (
        <>
          <span className={styles.factValue}>{block.value}</span>
          <span className={`${typography.chatMeta} ${styles.factLabel}`}>{block.label}</span>
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
      <span className={`${typography.chatMeta} ${styles.factLabel}`}>{label}</span>
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
        <p className={typography.chatBody}>Research findings available</p>
      )}
      {normalisedFindings.map((f, i) => (
        <div key={i} className={styles.evidenceFinding}>
          <p className={typography.chatBody}>{f.text}</p>
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
            <span className={`${typography.chatMeta} ${styles.evidenceConfidence}`}>
              {Math.round(f.confidence * 100)}% confidence
            </span>
          )}
        </div>
      ))}
      {block.query && (
        <div className={`${typography.chatMeta} ${styles.evidenceQuery}`}>
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
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.chatBody} bg-panel border border-panel-border rounded-full transition-colors ${
              hasGraph
                ? 'text-text-body hover:bg-panel-hover cursor-pointer'
                : 'text-text-light cursor-not-allowed opacity-60'
            }`}
            data-testid="apply-to-model-chip"
          >
            <Wand2 size={ICON_DENSE} aria-hidden="true" />
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
        <p className={typography.chatBody} style={{ color: 'var(--text-body)' }}>{block.narrative}</p>
      )}
      {block.options.map((opt, i) => (
        <div key={opt.id || `${opt.label}-${i}`} className={styles.comparisonItem}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className={typography.panelHeader}>{opt.label}</span>
            {/* #2747 r2: the option's unlabelled "N% probability" is not shown: no canonical cell licenses it (a chance
                outside the authority gate). Its rank stays. */}
            {opt.rank != null && (
              <span className={typography.chatMeta} style={{ color: 'var(--text-light)' }}>
                {`Rank ${opt.rank}`}
              </span>
            )}
            {opt.strengths && opt.strengths.length > 0 && (
              <div className={typography.chatBody} style={{ color: 'var(--success)' }}>
                {opt.strengths.map((s) => <div key={s}>+ {s}</div>)}
              </div>
            )}
            {opt.weaknesses && opt.weaknesses.length > 0 && (
              <div className={typography.chatBody} style={{ color: 'var(--danger)' }}>
                {opt.weaknesses.map((w) => <div key={w}>- {w}</div>)}
              </div>
            )}
            {opt.key_differentiators && opt.key_differentiators.length > 0 && (
              <div className={typography.chatMeta} style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>
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
        <p className={typography.chatBody} style={{ color: 'var(--text-body)' }}>{block.narrative}</p>
      )}
      {block.risk_paths.map((rp, i) => (
        <div key={`${rp.description}-${i}`} className={styles.failureMode}>
          <span className={typography.chatBody}>{rp.description}</span>
          {rp.path && rp.path.length > 0 && (
            <span className={typography.chatMeta} style={{ color: 'var(--text-light)' }}>
              {rp.path.join(' → ')}
            </span>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {rp.influence != null && (
              <span className={`${typography.chatMeta} ${styles.outlinedPill}`}>Influence: {Math.round(rp.influence * 100)}%</span>
            )}
            {rp.likelihood && (
              <span className={`${typography.chatMeta} ${styles.outlinedPill}`}>{rp.likelihood}</span>
            )}
            {rp.mitigation && (
              <span className={typography.chatMeta} style={{ color: 'var(--text-light)' }}>
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
        <p className={typography.chatBody} style={{ color: 'var(--text-body)' }}>{block.narrative}</p>
      )}
      {block.flip_conditions.map((fc, i) => (
        <div key={`${fc.assumption}-${i}`} style={{ padding: '6px 0', borderBottom: i < block.flip_conditions.length - 1 ? '1px solid var(--border-default)' : 'none' }}>
          <span className={`${typography.chatBody} font-semibold`}>{fc.assumption}</span>
          <div className={typography.chatMeta} style={{ color: 'var(--text-light)', marginTop: 2 }}>
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
        <span className={`${typography.chatMeta} ${styles.outlinedPill}`}>{block.exercise_type}</span>
      </div>
      <p className={typography.chatBody} style={{ color: 'var(--text-body)' }}>{block.instructions}</p>
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
            <p className={typography.chatBody} style={{ color: 'var(--text-body)', margin: 0 }}>
              {section.content}
            </p>
          )}
          {section.items && section.items.length > 0 && (
            <ul className={`mt-1 ${PANEL_LIST_BULLET}`}>
              {section.items.map((item, j) => (
                <li key={j} className={typography.chatBody} style={{ color: 'var(--text-body)' }}>
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
