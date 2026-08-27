/**
 * V5UnsupportedBlock — placeholder renderer for V5 block kinds the UI
 * hasn't surfaced yet. Emits a quiet card with the block kind so operators
 * see the gap during staging. Non-blocking: the chat keeps rendering.
 *
 * Logs a single DEV console.warn per block kind per session so the team
 * learns which blocks CEE starts emitting before the full renderer ships.
 */
import { type ReactElement, useEffect } from 'react'
import { typography } from '../../styles/typography'
import type { V5UnsupportedBlock as V5UnsupportedBlockType } from '../../canvas/conversation/types'

export interface V5UnsupportedBlockProps {
  block: V5UnsupportedBlockType
}

const _loggedKinds = new Set<string>()

export function V5UnsupportedBlock({ block }: V5UnsupportedBlockProps): ReactElement {
  useEffect(() => {
    if (import.meta.env.DEV && !_loggedKinds.has(block.blockType)) {
      _loggedKinds.add(block.blockType)
      console.warn(
        '[V5UnsupportedBlock] Encountered unsurfaced block kind:',
        block.blockType,
        block.raw,
      )
    }
  }, [block.blockType, block.raw])

  return (
    <div
      data-testid="v5-unsupported-block"
      /* THE operator channel for this card, and the reason the visible pill
         could go. Paired with the DEV console.warn above. */
      data-block-type={block.blockType}
      className="rounded-md border border-text-light/30 bg-panel p-4 space-y-1"
    >
      {/* ⚠ NO WIRE KIND ON SCREEN. This used to render `block.blockType` in a
          pill — `v5_flip_analysis` above a polite sentence, i.e. the product
          answering "what went wrong?" in log language. The kind means nothing
          to a user and everything to an operator, so it lives on
          `data-block-type` and in the DEV warn, not in the card face. */}
      <p className={typography.panelBody}>
        This app version can&apos;t display this part of the response yet.
        The rest of the message is unaffected.
      </p>
    </div>
  )
}

export default V5UnsupportedBlock
