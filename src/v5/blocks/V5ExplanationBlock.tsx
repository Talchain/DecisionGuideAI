/**
 * V5ExplanationBlock — renders V5 explanation block (narrative about why
 * an option wins, optionally referencing option IDs).
 */
import { type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import type { V5ExplanationBlock as V5ExplanationBlockType } from '../../canvas/conversation/types'

export interface V5ExplanationBlockProps {
  block: V5ExplanationBlockType
}

export function V5ExplanationBlock({ block }: V5ExplanationBlockProps): ReactElement {
  return (
    <div
      data-testid="v5-explanation"
      className="rounded-xl border border-panel-border bg-panel p-4 space-y-2"
    >
      <h3 className={typography.panelHeader}>Explanation</h3>
      <p className={typography.panelBody} data-testid="v5-explanation-narrative">
        {block.narrative}
      </p>
      {block.referenced_option_ids.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Referenced options"
          data-testid="v5-explanation-options"
        >
          {block.referenced_option_ids.map((id) => (
            <span
              key={id}
              role="listitem"
              className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5',
                'bg-transparent border border-option/30 text-text-body',
                typography.panelMeta,
              ].join(' ')}
            >
              {id}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default V5ExplanationBlock
