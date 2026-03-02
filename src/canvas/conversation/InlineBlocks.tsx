/**
 * InlineBlocks — Renders conversation blocks inside assistant messages
 *
 * Supports CommentaryBlock, ReviewCardBlock, FactBlock, and GraphPatchBlock.
 * Max 4 visible per turn with "Show more" toggle.
 */

import { useState, memo } from 'react'
import { Lightbulb, AlertTriangle, Check, X as XIcon } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { ConversationBlock, GraphPatchBlock as GraphPatchBlockType } from './types'
import type { PatchBlockState, PatchRejectionInfo } from './useConversation'
import { MAX_VISIBLE_BLOCKS_PER_TURN } from './types'
import styles from './Conversation.module.css'

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

  return (
    <div className={styles.blockContainer}>
      {visible.map((block, i) => (
        <BlockRenderer
          key={i}
          block={block}
          turnId={turnId}
          patchBlockStates={patchBlockStates}
          patchRejections={patchRejections}
          onPatchAccept={onPatchAccept}
          onPatchDismiss={onPatchDismiss}
        />
      ))}
      {hasOverflow && (
        <button
          type="button"
          className={styles.showMoreToggle}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show less' : `Show ${blocks.length - MAX_VISIBLE_BLOCKS_PER_TURN} more`}
        </button>
      )}
    </div>
  )
})

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
      return (
        <p
          className={`${typography.body} ${
            block.tone === 'warning'
              ? styles.commentaryBlockWarning
              : block.tone === 'positive'
                ? styles.commentaryBlockPositive
                : styles.commentaryBlock
          }`}
        >
          {block.text}
        </p>
      )

    case 'review_card':
      return (
        <div
          className={block.variant === 'info' ? styles.reviewCardInfo : styles.reviewCardAlert}
          data-testid={`block-review-${block.variant}`}
        >
          {block.variant === 'info' ? (
            <Lightbulb className={styles.reviewCardIcon} />
          ) : (
            <AlertTriangle className={styles.reviewCardIcon} />
          )}
          <div className={styles.reviewCardContent}>
            <div className={`${typography.label} ${styles.reviewCardTitle}`}>{block.title}</div>
            <p className={typography.body}>{block.body}</p>
          </div>
        </div>
      )

    case 'fact':
      return (
        <div className={styles.factBlock} data-testid="block-fact">
          <span className={styles.factValue}>{block.value}</span>
          <span className={`${typography.panelMeta} ${styles.factLabel}`}>{block.label}</span>
          {block.source && (
            <span className={styles.factSource}>{block.source}</span>
          )}
        </div>
      )

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

    default:
      return null
  }
}

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

  // Use patch_id directly — IDs are unique per conversation (orchestrator-generated)
  const stateKey = block.patch_id
  const blockState = patchBlockStates?.get(stateKey) ?? 'proposed'
  const rejectionInfo = patchRejections?.get(stateKey) ?? null
  const isSettled = blockState !== 'proposed'

  const opCount = block.operations.length
  const opSummary = `${opCount} operation${opCount !== 1 ? 's' : ''}`

  return (
    <div className={styles.graphPatchBlock} data-testid={`block-graph-patch-${block.patch_id}`}>
      <div className={styles.graphPatchSummary}>{block.summary}</div>
      <div className={styles.graphPatchMeta}>{opSummary}</div>

      {/* Status indicators for settled states */}
      {blockState === 'accepted' && (
        <div className={styles.graphPatchStatusApplied} data-testid="patch-status-applied">
          <Check size={14} /> Applied
        </div>
      )}
      {blockState === 'rejected' && (
        <div className={styles.graphPatchStatusRejected} data-testid="patch-status-rejected">
          <XIcon size={14} /> Rejected
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
      {blockState === 'dismissed' && (
        <div className={styles.graphPatchStatusDismissed} data-testid="patch-status-dismissed">
          Dismissed
        </div>
      )}

      {/* Network failure — retry button (block stays in 'proposed' state) */}
      {blockState === 'proposed' && rejectionInfo?.code === 'NETWORK_ERROR' && (
        <div className={styles.graphPatchError} data-testid="patch-retry-error">
          {rejectionInfo.message}
          <button
            type="button"
            className={styles.graphPatchRetry}
            onClick={() => onAccept?.(block.patch_id, block)}
          >
            Try again
          </button>
        </div>
      )}

      {/* Action buttons (visible only when proposed and no network error) */}
      {!isSettled && rejectionInfo?.code !== 'NETWORK_ERROR' && (
        <div className={styles.graphPatchActions}>
          <button
            type="button"
            className={styles.graphPatchAccept}
            disabled={isSettled}
            onClick={() => onAccept?.(block.patch_id, block)}
            data-testid="patch-accept"
          >
            Accept
          </button>
          <button
            type="button"
            className={styles.graphPatchDismiss}
            disabled={isSettled}
            onClick={() => onDismiss?.(block.patch_id)}
            data-testid="patch-dismiss"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

