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
      data-block-type={block.blockType}
      className="rounded-xl border border-text-light/30 bg-panel p-4 space-y-1"
    >
      <span
        className={[
          'inline-flex items-center rounded-full px-2.5 py-0.5',
          'bg-transparent border border-text-light/30 text-text-body',
          typography.panelMeta,
        ].join(' ')}
      >
        {block.blockType}
      </span>
      <p className={typography.panelBody}>
        This app version can&apos;t display this part of the response yet.
        The rest of the message is unaffected.
      </p>
    </div>
  )
}

export default V5UnsupportedBlock
