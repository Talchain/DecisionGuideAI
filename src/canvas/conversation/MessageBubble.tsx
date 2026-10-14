/**
 * MessageBubble — Single conversation message
 *
 * Renders user messages (right-aligned, info bg) and assistant messages
 * (left-aligned, panel bg) with optional inline blocks and action chips.
 *
 * The AI reply renders in full, without UI prose filtering or folding.
 *
 * Streaming: when `message.isStreaming` is true, text renders incrementally
 * with a blinking cursor. Provisional tool-backed turns render at reduced
 * opacity until `turn_complete`.
 */

import { memo, useState, useMemo } from 'react'
import { typography } from '../../styles/typography'
import { ICON_DENSE, ICON_STROKE } from './panelIcons'
import { safeRichText, safeRichTextWithListMarkers, normaliseDashes } from '../utils/safeRichText'
import { GroundedOnNotice } from './GroundedOnNotice'
import { InlineBlocks } from './InlineBlocks'
import type { HeldProposalSettlement } from '../../v5/blocks/V5HeldProposalBlock'
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { FeedbackRow } from './FeedbackRow'
import { StalenessPill, type StalenessFreshness } from './StalenessPill'
import { isOrchestratorRenderingV2Enabled, isDeterministicCeeEnabled, isReasoningDisclosureEnabled } from '../../flags'
import { useCanvasStore } from '../store'
import { isSelfContradictoryStale } from '../store/analysisFreshness'
import { useGuidanceStore } from '../stores/guidanceStore'
import { OLUMI_TEXT_CHIP_IDS, type OlumiTextSend } from './chipMeta'
import { FALLBACK_TEXT } from './validateResponse'
import { turnOfferedConsent } from './utils/transcriptStore'
import { PROVISIONAL_VIEW_LABEL, provisionalBecauseLine, provisionalHeading } from './provisionalView'
import { SYSTEM_MESSAGE_SENTINEL } from './useConversation'
import type { ConversationMessage, ActionChip, GraphPatchBlock, Insight } from './types'
import type { PatchBlockState, PatchRejectionInfo } from './useConversation'
import styles from './Conversation.module.css'
import { AiChangeUndoButton } from '../undo/AiChangeUndoButton'

/** Replace internal factor IDs (fac_xxx) with human-readable labels. */
function sanitiseFactorIds(text: string, labelMap: Map<string, string>): string {
  return text.replace(/\bfac_[a-z_]+\b/g, (match) => {
    const label = labelMap.get(match)
    if (label) return label
    // Strip prefix, convert underscores to spaces, title-case
    return match.slice(4).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  })
}

/**
 * Character threshold for applying progressive disclosure. Round-3 UX pass
 * raised this from 600 → 3000 because the prior threshold cut typical
 * assistant responses too aggressively, hiding genuinely useful core
 * content behind a Show more click. The toggle remains as a safety net
 * for outlier responses (multi-thousand-character explanations); for
 * everyday turns the message renders in full.
 */
const CLAMP_CHAR_THRESHOLD = 3000
/** Minimum characters that must be hidden for truncation to be worthwhile. */
const MIN_HIDDEN_CHARS = 150
/**
 * Maximum distance a paragraph break can sit before CLAMP_CHAR_THRESHOLD and
 * still be used as the cut point. If the nearest \n\n is more than 100 chars
 * before the threshold we skip it (too aggressive) and fall through to the
 * sentence-end path instead.
 */
const MAX_PARA_BREAK_DISTANCE = 100

/**
 * Find the best truncation point in raw text at natural boundaries.
 * Returns the truncated text or null if truncation isn't worthwhile.
 * Only truncates when at least MIN_HIDDEN_CHARS (150) characters would be hidden.
 */
export function findNaturalTruncation(text: string): string | null {
  if (text.length <= CLAMP_CHAR_THRESHOLD) return null

  /** Check whether enough content would be hidden to justify truncation. */
  const isWorthHiding = (cutPoint: number) => text.slice(cutPoint).length >= MIN_HIDDEN_CHARS

  // 1. Try last paragraph break (\n\n) before limit, but only when it sits
  //    within MAX_PARA_BREAK_DISTANCE chars of the threshold. A break that is
  //    far before the threshold would truncate too aggressively; in that case
  //    fall through to the sentence-end path for a more accurate cut.
  const paraIdx = text.lastIndexOf('\n\n', CLAMP_CHAR_THRESHOLD)
  if (
    paraIdx > 0 &&
    CLAMP_CHAR_THRESHOLD - paraIdx <= MAX_PARA_BREAK_DISTANCE &&
    isWorthHiding(paraIdx)
  ) {
    return text.slice(0, paraIdx)
  }

  // 2. Try last sentence-ending punctuation followed by space
  const sentenceRe = /[.!?]\s/g
  let lastSentenceEnd = -1
  let m: RegExpExecArray | null
  while ((m = sentenceRe.exec(text)) !== null) {
    if (m.index + 1 > CLAMP_CHAR_THRESHOLD) break
    lastSentenceEnd = m.index + 1 // include the punctuation
  }
  if (lastSentenceEnd > 0 && isWorthHiding(lastSentenceEnd)) {
    return text.slice(0, lastSentenceEnd)
  }

  // 3. Not enough hidden content — show full text
  return null
}

interface MessageBubbleProps {
  message: ConversationMessage
  /**
   * ⚠ CURRENTLY UNUSED BY THIS COMPONENT — declared, never destructured. Said
   * plainly because the neighbouring `hideChips` prop was dead in exactly the
   * same way and its comment did not say so, which is how ROADMAP 2.668's
   * second defect came to be diagnosed against a chain that does nothing.
   * `SuggestedChips` (via ChatThread) is the sole render surface for
   * `message.actionChips`. Left in place rather than removed: it is a REQUIRED
   * prop threaded from ~19 call sites and specs, so withdrawing it is a
   * separate tidy-up, not part of a consent fix.
   */
  onChipClick: (chip: ActionChip) => Promise<void>
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onPatchAccept?: (patchId: string, block: GraphPatchBlock) => void
  onPatchDismiss?: (patchId: string) => void
  onFeedback?: (turnId: string, rating: 'up' | 'down') => void
  onArtefactMessage?: (message: string) => void
  onProposalConfirm?: (proposalId: string) => void
  /** SENDABLE failure 5 — record a held proposal's settlement in the shared
   *  `patchBlockStates` registry, for every copy on screen when the user acts:
   *  both surfaces, and every earlier turn re-issuing the same handle. */
  onHeldProposalSettle?: (
    proposalId: string,
    settlement: HeldProposalSettlement,
    turnId?: string,
  ) => void
  /**
   * When true, render message body text with DS v5 panelBody (12px /
   * leading-relaxed) instead of the legacy body (16px / leading-relaxed).
   * AI panel v2 sets this via the ChatThread → ChatMessage prop chain;
   * the legacy DraftChat surface leaves it false. Default false to
   * preserve FF-off behaviour.
   */
  compact?: boolean
  /**
   * Transcript honesty (trust item #3): retry handler for a FAILED user
   * message (deliveryState 'failed'). Wired by ChatThread only for the
   * message retryLast would actually resend (the last user message) —
   * older failed attempts show the "Not delivered" marker without the
   * affordance. Ignored for non-failed or assistant messages.
   */
  onRetryFailedSend?: () => void
  /** L-42: only the newest assistant turn's card may claim the staleness voice. */
  isLatestAssistantTurn?: boolean

}

export const MessageBubble = memo(function MessageBubble({
  message,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onFeedback,
  onArtefactMessage,
  onProposalConfirm,
  onHeldProposalSettle,
  compact = false,
  onRetryFailedSend,
  isLatestAssistantTurn = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isStreaming = message.isStreaming === true

  const provisional = !isUser && !isStreaming && !message.stoppedByUser ? message.provisionalView : undefined
  const [provisionalWhyShown, setProvisionalWhyShown] = useState(false)
  // AI-first: assistant_text owns the reply. Only client-authored notices keep
  // their established dash styling; producer and user characters remain intact.
  const displayContent = message.synthetic ? normaliseDashes(message.content) : message.content
  // Transcript honesty (trust item #3): a user send whose turn failed must
  // LOOK failed — marker + optional retry affordance on the message itself.
  const sendFailed = isUser && message.deliveryState === 'failed'
  // ROADMAP 2.665: the third state. "Not delivered" is a claim, and after a
  // wait expiry or a proxy timeout this client cannot make it — CEE completes
  // and commits turns the browser stopped listening for, and nothing here can
  // check. This marker says what is true and offers no retry (retrying asks
  // twice; see deliveryUnknown.ts).
  const sendUnconfirmed = isUser && message.deliveryState === 'unconfirmed'
  const sendUnconfirmedMarker = sendUnconfirmed ? (
    <div
      className={`${styles.sendFailedRow} ${typography.chatMeta}`}
      data-testid="send-unconfirmed-indicator"
    >
      <AlertCircle size={12} aria-hidden="true" />
      <span>Sent — reply not received</span>
    </div>
  ) : null
  const sendFailedMarker = sendFailed ? (
    <div
      className={`${styles.sendFailedRow} ${typography.chatMeta}`}
      data-testid="send-failed-indicator"
    >
      <AlertCircle size={12} aria-hidden="true" />
      <span>Not delivered</span>
      {onRetryFailedSend && (
        <button
          type="button"
          className={`${styles.sendFailedRetryButton} ${typography.chatMeta}`}
          onClick={onRetryFailedSend}
          data-testid="send-failed-retry"
          aria-label="Retry sending this message"
        >
          <RefreshCw size={ICON_DENSE} strokeWidth={ICON_STROKE} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  ) : null

  // Defensive guard: never render the [system] sentinel as a user bubble
  if (isUser && message.content === SYSTEM_MESSAGE_SENTINEL) return null

  // Chip-initiated user messages render as a compact pill, not a full bubble
  if (isUser && message.chipInitiated) {
    return (
      <>
        <div className={styles.chipActionIndicator} data-testid="chip-action-indicator">
          <span className={typography.caption}>{message.displayContent ?? message.content}</span>
        </div>
        {sendFailedMarker}
        {sendUnconfirmedMarker}
      </>
    )
  }

  const isProvisional = message.isProvisional === true
  const hasToolLoading = Boolean(message.toolLoadingState)

  // ROADMAP 1.42: Show-reasoning progressive disclosure — collapsed by default.
  const [reasoningExpanded, setReasoningExpanded] = useState(false)

  // Freshness pill: stale narration first, otherwise the first graph_patch block whose
  // analysis_ready.freshness is 'stale' or 'unknown'. Fresh/none/absent → no pill.
  // User messages and the streaming-thinking placeholder bypass this branch.
  // Verdict semantics: a 'stale' verdict whose own payload carries IDENTICAL
  // at-run/current hashes is self-contradictory — it must never render the
  // factual "model changed" pill; it downgrades to the cannot-confirm
  // 'unknown' pill (same rule as the Results freshness strip).
  const stalenessFreshness = useMemo<StalenessFreshness | null>(() => {
    if (isUser) return null
    // Stale resends carry committed prose without result blocks. A stale status
    // alone cannot support the stronger "model changed" claim.
    // A stale narration carries no graph-hash evidence, so it can only say "cannot confirm": a new Run on an
    // unchanged model has a different key with identical hashes (PL #94 6135017311, 06:56Z).
    if (message.narration?.status === 'stale') return 'unknown'
    for (const block of message.blocks ?? []) {
      if (block.type !== 'graph_patch') continue
      const ar = (block as GraphPatchBlock).analysis_ready as
        | { freshness?: string; graph_hash_at_run?: unknown; current_graph_hash?: unknown }
        | undefined
      const f = ar?.freshness
      if (f === 'stale') {
        return isSelfContradictoryStale(f, ar?.graph_hash_at_run, ar?.current_graph_hash)
          ? 'unknown'
          : 'stale'
      }
      if (f === 'unknown') return f
    }
    return null
  }, [isUser, message.blocks, message.narration])

  // Streaming with no text yet — show thinking indicator placeholder
  if (isStreaming && !message.content && !hasToolLoading) {
    return (
      <>
        {stalenessFreshness && <StalenessPill freshness={stalenessFreshness} />}
        <div
          className={styles.messageBubbleAssistant}
          data-testid="message-assistant"
        >
          <div className={styles.streamingThinking} data-testid="streaming-thinking">
            <span className={styles.streamingDot} />
            <span className={styles.streamingDot} />
            <span className={styles.streamingDot} />
          </div>
        </div>
      </>
    )
  }

  // Body text className — identical in the structured-answer branch and the
  // free-text branch below. Hoisted to one const so the two render paths can
  // never drift; rebuilding it verbatim in both was pure duplication.
  const bodyClassName = `${compact ? typography.chatBody : typography.chatProse} ${styles.markdownContent} ${
    compact ? styles.markdownContentCompact : ''
  } ${isProvisional ? styles.provisionalText : ''} ${
    !isUser && isOrchestratorRenderingV2Enabled() ? styles.v2AssistantText : ''
  }`

  return (
    <>
    {stalenessFreshness && <StalenessPill freshness={stalenessFreshness} />}
    <div
      className={
        isUser
          ? `${styles.messageBubbleUser}${sendFailed ? ` ${styles.messageBubbleUserFailed}` : ''}`
          : styles.messageBubbleAssistant
      }
      data-testid={`message-${message.role}`}
      data-delivery-state={isUser ? message.deliveryState : undefined}
    >
      {!isUser && message.restoredTag && (
        <span className={`${typography.chatMeta} text-text-light block`} data-testid="message-restored-tag">
          {message.restoredTag}
        </span>
      )}
      {(displayContent.trim().length > 0 || isStreaming) && (
        <div
          className={bodyClassName}
          data-streaming={isStreaming || undefined}
          data-testid="message-body-text"
          // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText
          dangerouslySetInnerHTML={{
            __html: (isUser ? safeRichText(displayContent) : safeRichTextWithListMarkers(displayContent))
              + (isStreaming ? '<span class="streaming-cursor" aria-hidden="true">|</span>' : ''),
          }}
        />
      )}
      {hasToolLoading && (
        <div className={styles.toolLoadingState} data-testid="tool-loading-state">
          <span className={styles.toolLoadingDot} />
          {message.toolLoadingState}
        </div>
      )}
      {/* Transcript honesty (trust item #3): failed-send marker + retry
        * affordance on the message itself. Cleared when a retry delivers
        * (deliveryState flips back to 'sent'). */}
      {sendFailedMarker}
      {sendUnconfirmedMarker}
      {/* T6: persistent "Response stopped." indicator on user-cancelled turns.
        * Set by useConversation.cancelTurn(); never cleared by late chunks. */}
      {message.stoppedByUser && (
        <div
          className={typography.chatMeta}
          style={{ color: 'var(--text-light, #6E6B6B)', marginTop: 4 }}
          data-testid="response-stopped-indicator"
        >
          Response stopped.
        </div>
      )}
      {/* Slice C5: Olumi's PROVISIONAL view — its reading when the analysis cannot put an option forward, in the
        * reasoning panel's quieter register so it never reads as the analysis's result. The view and the one step
        * that would confirm it are always shown; the why is one press away. Plain text nodes only. */}
      {provisional && (
        <div
          className={styles.reasoningPanel}
          data-testid="message-provisional-view"
          role="note"
          aria-label={PROVISIONAL_VIEW_LABEL}
        >
          <p className={styles.reasoningPanelHeading} data-testid="message-provisional-view-heading">
            {provisionalHeading(provisional)}
          </p>
          <p className={styles.reasoningPanelBody} data-testid="message-provisional-view-text">
            {provisional.view}
          </p>
          {provisional.confirmStep && (
            <p className={styles.reasoningPanelBody} data-testid="message-provisional-view-step">
              <strong>To confirm it:</strong> {provisional.confirmStep}
            </p>
          )}
          {(provisional.reasoning || provisional.because) && (
            <>
              <button
                type="button"
                className={styles.inlineDisclosureToggle}
                onClick={() => setProvisionalWhyShown((v) => !v)}
                data-testid="message-provisional-view-why-toggle"
                aria-expanded={provisionalWhyShown}
              >
                {provisionalWhyShown ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Why Olumi thinks this
              </button>
              {provisionalWhyShown && provisionalBecauseLine(provisional) && (
                <p className={styles.reasoningPanelBody} data-testid="message-provisional-view-because">
                  {provisionalBecauseLine(provisional)}
                </p>
              )}
              {provisionalWhyShown && provisional.reasoning && (
                <p className={styles.reasoningPanelBody} data-testid="message-provisional-view-why">
                  {provisional.reasoning}
                </p>
              )}
            </>
          )}
        </div>
      )}
      {/* ROADMAP 1.42: Show-reasoning progressive disclosure — Paul ruled
        * VERBATIM-with-label. Collapsed by default; renders nothing when
        * reasoning is absent (sporadic CEE field) or the flag is off
        * (defense in depth — useConversation also gates attachment). Plain
        * text via a text node (no dangerouslySetInnerHTML, no markdown
        * pipeline) so the panel can never execute injected markup. */}
      {!isUser && message.reasoning && isReasoningDisclosureEnabled() && (
        <>
          <button
            type="button"
            className={styles.inlineDisclosureToggle}
            onClick={() => setReasoningExpanded(v => !v)}
            data-testid="message-show-reasoning"
            aria-expanded={reasoningExpanded}
            aria-label={reasoningExpanded ? 'Hide model reasoning' : 'Show model reasoning'}
          >
            {reasoningExpanded ? <><ChevronUp size={12} /> Hide reasoning</> : <><ChevronDown size={12} /> Show reasoning</>}
          </button>
          {reasoningExpanded && (
            <div className={styles.reasoningPanel} data-testid="message-reasoning-panel">
              <p className={styles.reasoningPanelHeading}>Model reasoning (verbatim)</p>
              <p className={styles.reasoningPanelBody}>{message.reasoning}</p>
            </div>
          )}
        </>
      )}
      {/* CEE hop 4b — which model elements this answer was grounded on.
        * NO FLAG (the producer emits unconditionally on the success path), and
        * the condition is the SIDECAR'S OWN PRESENCE: an ungrounded turn
        * carries no key, so `message.groundedSelection` is undefined and
        * nothing renders. Rendering this on a turn without the sidecar would
        * fabricate a grounding — pinned by the wire spec. Assistant-only: a
        * grounding is a fact about an ANSWER, and the user's own bubble is not
        * one. */}
      {!isUser && message.groundedSelection && (
        <GroundedOnNotice groundedSelection={message.groundedSelection} />
      )}
      {message.insights && message.insights.length > 0 && isDeterministicCeeEnabled() && (
        <InsightsStrip insights={message.insights} onSendMessage={onArtefactMessage} />
      )}
      {message.blocks && message.blocks.length > 0 && (
        <InlineBlocks
          blocks={message.blocks}
          turnId={message.id}
          patchBlockStates={patchBlockStates}
          patchRejections={patchRejections}
          onPatchAccept={onPatchAccept}
          onPatchDismiss={onPatchDismiss}
          onArtefactMessage={onArtefactMessage}
          onProposalConfirm={onProposalConfirm}
          onHeldProposalSettle={onHeldProposalSettle}
          assistantTextWordCount={displayContent.trim().split(/\s+/).filter(Boolean).length}
          consentPending={turnOfferedConsent(message)}
          alreadyRendered={[]}
          isLatestAssistantTurn={isLatestAssistantTurn}
        />
      )}
      {/* Explain more + Summarise are AI Panel v2 affordances only — MessageBubble
          is shared with the FF-off legacy DraftChat surface, and we must not
          change FF-off parity. The flag guard is the single source of truth. */}
      {/*
        ⛔ THE "Explain more · Summarise" ROW RENDERED HERE AND IS GONE. It was
        a persistent pair of icon+label buttons under EVERY qualifying assistant
        message — four of them visible in one reported viewport. Both actions
        survive, unchanged, in `MessageMenu` (zones/MessageMenu.tsx) alongside
        Copy and Retry: one discreet control per message instead of two
        always-on buttons plus a floating two-button bar.

        The gate that stood here is not lost, it MOVED UP: ChatMessage renders
        the menu and passes `onSendFollowUp={onArtefactMessage}`, and the menu
        omits both follow-up items when that handler is absent — so the
        affordance still cannot appear where nothing can send it.
      */}
      {/* P48 (audit #23): Undo for the change Olumi made in this reply — only while it is the next ⌘Z. */}
      {!isUser && !message.synthetic && <AiChangeUndoButton turnId={message.undoTurnId} />}
      {!isUser && !message.synthetic && displayContent !== FALLBACK_TEXT && onFeedback && (
        <FeedbackRow turnId={message.clientTurnId} onFeedback={onFeedback} />
      )}
    </div>
    </>
  )
})

/*
 * ⛔ `FollowUpActions` AND `FOLLOW_UP_BUTTON_CLASS` LIVED HERE AND ARE GONE.
 * They rendered a persistent "Explain more · Summarise" pair under every
 * qualifying assistant message. Both acts survive verbatim — same prompts,
 * same accessible names — inside `zones/MessageMenu.tsx`, which also absorbed
 * the floating Copy/Retry bar. One quiet control per message replaces two
 * always-on buttons and a two-button overlay; see that file's header for why
 * it is rendered at rest rather than on hover.
 */

/** Map insight type → action chip config with optional deterministic action routing. */
interface InsightAction {
  label: string
  message: string
  action_type?: string
}

function getInsightAction(type: string, entityLabel: string): InsightAction | null {
  switch (type) {
    case 'missing_perspective':
    case 'structural_gap':
      return { label: 'Explore more options', message: 'Suggest additional options for this decision', action_type: 'add_option' }
    case 'assumption_risk':
      return { label: `Investigate ${entityLabel}`, message: `Help me clarify ${entityLabel === 'this' ? 'this assumption' : `your ${entityLabel} estimate`}`, action_type: 'challenge_assumption' }
    case 'calibration_concern':
      return { label: `Calibrate ${entityLabel}`, message: `Help me calibrate ${entityLabel === 'this' ? 'this factor' : entityLabel}`, action_type: 'set_factor_value' }
    case 'bias_detected':
      return { label: `Challenge ${entityLabel}`, message: `Challenge my assumption about ${entityLabel === 'this' ? 'this' : entityLabel}`, action_type: 'challenge_assumption' }
    default:
      return null
  }
}

/** Deterministic CEE insights — rendered between assistant_text and blocks */
function InsightsStrip({ insights, onSendMessage }: { insights: Insight[]; onSendMessage?: OlumiTextSend }) {
  // Resolve target_id → node label from the graph
  const nodes = useCanvasStore(s => s.nodes)
  const labelMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of nodes) {
      if (n.data?.label) m.set(n.id, n.data.label)
    }
    return m
  }, [nodes])

  return (
    <div className={styles.insightStrip} data-testid="insights-strip">
      {insights.map((insight, i) => {
        const severityClass =
          insight.severity === 'important' ? styles.insightItemImportant
          : insight.severity === 'warning' ? styles.insightItemWarning
          : styles.insightItemInfo
        const entityLabel = (insight.target_id && labelMap.get(insight.target_id)) || 'this'
        // DS v5: no action chip for info-severity insights (opportunity/informational)
        const action = insight.severity === 'info' ? null : getInsightAction(insight.type, entityLabel)
        return (
          <div key={i} className={`${styles.insightItem} ${severityClass}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <span className={typography.chatBody} style={{ color: 'var(--text-body)' }}>
                {sanitiseFactorIds(insight.description, labelMap)}
              </span>
              {insight.science_concept && (
                <span className={styles.scienceConceptBadge}>{insight.science_concept}</span>
              )}
              {action && (onSendMessage || useGuidanceStore.getState()._dispatchAction) && (
                <button
                  type="button"
                  className={`${typography.caption} ${styles.insightActionChip}`}
                  onClick={() => {
                    const dispatch = useGuidanceStore.getState()._dispatchAction
                    if (dispatch) {
                      dispatch({
                        // T1H-2: a static chip identity, not only an action_type the guard cannot see is set.
                        id: OLUMI_TEXT_CHIP_IDS.insightAction,
                        action_type: action.action_type,
                        label: action.label,
                        message: action.message,
                        source: 'insight',
                        ...(insight.target_id ? { parameters: { target_id: insight.target_id } } : {}),
                      })
                    } else {
                      // Fallback is the panel's artefact handler (`onArtefactMessage`), itself a chip.
                      onSendMessage?.(action.message, { chipMeta: { id: OLUMI_TEXT_CHIP_IDS.aiPanelArtefactAction } })
                    }
                  }}
                  style={{ marginTop: 8 }}
                  data-testid={`insight-action-${i}`}
                >
                  {action.label}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
