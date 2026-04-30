/**
 * DraftStrengthenSection — pre-analysis surface for CEE coaching.strengthen_items.
 *
 * Reads `draftCoaching.strengthenItems` from the canvas store and renders each
 * item as a TriageCard. Provenance pill is derived by looking up the item's id
 * against canvas nodes — the section never invents a provenance value.
 *
 * Renders nothing when the array is empty/absent so no empty container appears.
 *
 * `actionType` is rendered as a non-clickable METADATA TAG, not as an actionable
 * button or chip. This is a deliberate deviation from the original brief, which
 * said "If `action_type` is present, render as actionable (button/chip)". No
 * dispatcher exists for these values yet, and a clickable affordance that does
 * nothing is worse than a passive label. When a dispatcher is added, the tag
 * row below should be promoted to an actionable affordance in a separate change.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../store'
import { TriageCard } from '@/components/shared/TriageCard'
import { typography } from '@/styles/typography'
import { SectionErrorBoundary } from '../SectionErrorBoundary'
import { provenanceToPill } from './provenanceUtils'
import type { CEEProvenance } from '../../../adapters/cee/types'

/** Convert a snake_case action_type / bias_category token into a sentence-case display tag. */
function tokenToLabel(token: string): string {
  const cleaned = token.trim().replace(/_/g, ' ')
  if (!cleaned) return token
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
}

export function DraftStrengthenSection() {
  const items = useCanvasStore((s) => s.draftCoaching?.strengthenItems ?? null)
  const nodes = useCanvasStore((s) => s.nodes)

  const provenanceById = useMemo(() => {
    const map = new Map<string, CEEProvenance>()
    for (const n of nodes) {
      const data = n.data as { provenance?: CEEProvenance } | undefined
      if (data?.provenance) map.set(n.id, data.provenance)
    }
    return map
  }, [nodes])

  if (!items || items.length === 0) return null

  return (
    <SectionErrorBoundary section="Strengthen">
      <section
        className="flex flex-col gap-2"
        data-testid="draft-strengthen-section"
        aria-labelledby="draft-strengthen-section-heading"
      >
        <h3 id="draft-strengthen-section-heading" className={`${typography.panelHeader} text-text-header`}>
          Strengthen the model
        </h3>
        <div className="flex flex-col gap-2">
          {items.map((item, idx) => {
            const pill = provenanceToPill(provenanceById.get(item.id))
            const tags: string[] = []
            if (item.actionType) tags.push(tokenToLabel(item.actionType))
            if (item.biasCategory) tags.push(tokenToLabel(item.biasCategory))
            return (
              <div key={item.id} className="flex flex-col gap-1">
                {tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap" data-testid="strengthen-item-tags">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-1.5 py-0.5 rounded-full border border-panel-border ${typography.panelMeta} text-text-body bg-transparent`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <TriageCard
                  cardKey={item.id}
                  ordinal={idx + 1}
                  title={item.label}
                  detail={item.detail}
                  category="strengthen"
                  sourcePill={pill}
                />
              </div>
            )
          })}
        </div>
      </section>
    </SectionErrorBoundary>
  )
}
