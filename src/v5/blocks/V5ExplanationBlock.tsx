/**
 * V5ExplanationBlock — renders V5 explanation block (narrative about why
 * an option wins, optionally referencing option IDs).
 *
 * The referenced options are delivered as bare wire ids; the block schema
 * carries no labels. Each id is resolved against the canvas store and the
 * LABEL is rendered — never the id.
 *
 * UNRESOLVABLE IDS ARE OMITTED, not printed and not replaced with a generic
 * word. These chips are a pure cross-reference affordance: every option they
 * point at is already named in the narrative above, so a chip that cannot
 * name its option carries no information a reader can use. A generic
 * "option" chip would be worse than omission — it occupies the visual slot
 * of a specific named option while identifying nothing. Contrast
 * V5FlipAnalysisBlock, which keeps unlabelled rows because those rows carry
 * threshold NUMBERS that would be lost with them.
 */
import { useMemo, type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import type { V5ExplanationBlock as V5ExplanationBlockType } from '../../canvas/conversation/types'
import { useCanvasNodeLabels, resolveCanvasLabel } from './useCanvasLabels'

export interface V5ExplanationBlockProps {
  block: V5ExplanationBlockType
}

export function V5ExplanationBlock({ block }: V5ExplanationBlockProps): ReactElement {
  const nodeLabels = useCanvasNodeLabels()

  const referencedOptions = useMemo(
    () =>
      block.referenced_option_ids
        .map((id) => ({ id, label: resolveCanvasLabel(id, nodeLabels) }))
        .filter((o): o is { id: string; label: string } => o.label !== null),
    [block.referenced_option_ids, nodeLabels],
  )

  return (
    <div
      data-testid="v5-explanation"
      className="rounded-xl border border-panel-border bg-panel p-4 space-y-2"
    >
      <h3 className={typography.panelHeader}>Explanation</h3>
      <p className={typography.panelBody} data-testid="v5-explanation-narrative">
        {block.narrative}
      </p>
      {referencedOptions.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Referenced options"
          data-testid="v5-explanation-options"
        >
          {referencedOptions.map(({ id, label }) => (
            <span
              // The id remains the React key and the test id — a machine
              // reference, which is exactly the use CEE's field-coverage
              // allowlist permits. Only the TEXT changes.
              key={id}
              role="listitem"
              data-testid={`v5-explanation-option-${id}`}
              className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5',
                'bg-transparent border border-option/30 text-text-body',
                typography.panelMeta,
              ].join(' ')}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default V5ExplanationBlock
