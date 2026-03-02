/**
 * InlineBlocks — Renders conversation blocks inside assistant messages
 *
 * Supports CommentaryBlock, ReviewCardBlock, and FactBlock.
 * Max 4 visible per turn with "Show more" toggle.
 */

import { useState, memo } from 'react'
import { Lightbulb, AlertTriangle } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { ConversationBlock } from './types'
import { MAX_VISIBLE_BLOCKS_PER_TURN } from './types'
import styles from './Conversation.module.css'

interface InlineBlocksProps {
  blocks: ConversationBlock[]
}

export const InlineBlocks = memo(function InlineBlocks({ blocks }: InlineBlocksProps) {
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? blocks : blocks.slice(0, MAX_VISIBLE_BLOCKS_PER_TURN)
  const hasOverflow = blocks.length > MAX_VISIBLE_BLOCKS_PER_TURN

  return (
    <div className={styles.blockContainer}>
      {visible.map((block, i) => (
        <BlockRenderer key={i} block={block} />
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

function BlockRenderer({ block }: { block: ConversationBlock }) {
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

    default:
      return null
  }
}
