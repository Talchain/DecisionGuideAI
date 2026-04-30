/**
 * WhatOlumiAddedSection — pre-analysis surface for CEE coaching.widening_log.
 *
 * Reads `draftCoaching.wideningLog` from the canvas store and renders one row
 * per entry showing label + reason. Provenance pill is derived by looking up
 * the entry's nodeId against canvas nodes — never invented.
 *
 * Renders nothing when wideningLog is null or empty (no empty container).
 *
 * Path C scope: this surface only consumes the existing wire shape
 * `Array<{ nodeId, label, reason }>`. The richer shape (`elements_considered_but_excluded`,
 * `brief_completeness`) is tracked as a follow-up brief that extends CEE +
 * adapter — not part of this change.
 *
 * Plain `<div>` rows (not `TriageCard`) because `TriageCardCategory` has no
 * neutral / informational variant; all categories carry semantic colour
 * treatment that would conflate this transparency surface with action cards.
 */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCanvasStore } from '../../store'
import { typography } from '@/styles/typography'
import { SectionErrorBoundary } from '../SectionErrorBoundary'
import { provenanceToPill } from './provenanceUtils'
import type { CEEProvenance } from '../../../adapters/cee/types'

export function WhatOlumiAddedSection() {
  const items = useCanvasStore((s) => s.draftCoaching?.wideningLog ?? null)
  const nodes = useCanvasStore((s) => s.nodes)
  const [isExpanded, setIsExpanded] = useState(false)

  const provenanceById = useMemo(() => {
    const map = new Map<string, CEEProvenance>()
    for (const n of nodes) {
      const data = n.data as { provenance?: CEEProvenance } | undefined
      if (data?.provenance) map.set(n.id, data.provenance)
    }
    return map
  }, [nodes])

  if (!items || items.length === 0) return null

  const count = items.length

  return (
    <SectionErrorBoundary section="WhatOlumiAdded">
      <section
        className="flex flex-col gap-2"
        data-testid="what-olumi-added-section"
        aria-labelledby="what-olumi-added-section-heading"
      >
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          aria-controls="what-olumi-added-section-body"
          className="flex items-center gap-1.5 text-left"
          data-testid="what-olumi-added-toggle"
        >
          {isExpanded ? (
            <ChevronDown size={12} aria-hidden="true" />
          ) : (
            <ChevronRight size={12} aria-hidden="true" />
          )}
          <h3
            id="what-olumi-added-section-heading"
            className={`${typography.panelHeader} text-text-header`}
          >
            What Olumi added
          </h3>
          <span
            data-testid="what-olumi-added-count"
            className={`px-1.5 py-0.5 rounded-full border border-panel-border ${typography.panelMeta} text-text-body bg-transparent`}
          >
            {count}
          </span>
        </button>

        {isExpanded && (
          <div
            id="what-olumi-added-section-body"
            className="flex flex-col gap-2"
            data-testid="what-olumi-added-body"
          >
            {items.map((item) => {
              const pill = provenanceToPill(provenanceById.get(item.nodeId))
              return (
                <div
                  key={item.nodeId}
                  className="relative flex flex-col p-2.5 rounded-[10px] border border-panel-border bg-panel"
                  data-testid="what-olumi-added-row"
                >
                  <div className="flex items-start gap-2">
                    <p className={`${typography.panelBody} text-text-header flex-1 min-w-0`}>
                      {item.label}
                    </p>
                    {pill && (
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded-full border ${pill.borderClass} ${typography.panelMeta} text-text-body bg-transparent`}
                      >
                        {pill.label}
                      </span>
                    )}
                  </div>
                  <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
                    {item.reason}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </SectionErrorBoundary>
  )
}
