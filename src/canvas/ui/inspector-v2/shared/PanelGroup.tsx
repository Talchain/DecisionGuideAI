/**
 * PanelGroup — v6.2 three-group layout container.
 *
 * Groups inspector content into Context / Your input / Connections (etc.).
 * Adds consistent vertical spacing and a quiet header. Unlabelled groups
 * render just spacing so panels can still use this primitive for structural
 * consistency even where a header would be redundant.
 */

import type { ReactNode } from 'react'
import { inspectorGroupLabel } from '../inspectorStyle'

export type PanelGroupKind =
  | 'context'
  | 'input'
  | 'connections'
  | 'evidence'
  | 'impact'
  | 'comparison'
  | 'whatThisChanges'
  /** v3.1: the Question inspector's options (not "Your input"). */
  | 'alternatives'

interface PanelGroupProps {
  kind: PanelGroupKind
  /** Optional header. Omit to render an unlabelled spacing container. */
  label?: string
  children: ReactNode
}

/**
 * ⭐ v3.1 (DESIGN-GAP-v31 row 32): the group label is the contract's
 * `.inspector-body h4` — 12px, semibold, body ink — so every pane's sections
 * read as one document rather than 11px grey captions over boxes.
 */
export function PanelGroup({ kind, label, children }: PanelGroupProps) {
  return (
    <section data-panel-group={kind} className="mt-3 first:mt-2">
      {label && (
        <div className={inspectorGroupLabel}>
          {label}
        </div>
      )}
      {children}
    </section>
  )
}
