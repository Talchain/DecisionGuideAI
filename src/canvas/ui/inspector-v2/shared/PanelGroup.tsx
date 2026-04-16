/**
 * PanelGroup — v6.2 three-group layout container.
 *
 * Groups inspector content into Context / Your input / Connections (etc.).
 * Adds consistent vertical spacing and a quiet header. Unlabelled groups
 * render just spacing so panels can still use this primitive for structural
 * consistency even where a header would be redundant.
 */

import type { ReactNode } from 'react'
import { typography } from '../../../../styles/typography'

export type PanelGroupKind =
  | 'context'
  | 'input'
  | 'connections'
  | 'evidence'
  | 'impact'
  | 'comparison'
  | 'whatThisChanges'

interface PanelGroupProps {
  kind: PanelGroupKind
  /** Optional header. Omit to render an unlabelled spacing container. */
  label?: string
  children: ReactNode
}

export function PanelGroup({ kind, label, children }: PanelGroupProps) {
  return (
    <section data-panel-group={kind} className="mt-3.5 first:mt-2">
      {label && (
        <div className={`${typography.panelMeta} text-text-light mb-1.5`}>
          {label}
        </div>
      )}
      {children}
    </section>
  )
}
