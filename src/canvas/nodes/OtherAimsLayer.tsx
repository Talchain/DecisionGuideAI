/**
 * ⭐ THE OTHER AIMS, ON THE CANVAS BESIDE THE GOAL (Paul, 21 Oct 2026: "never hide what Olumi has"). Each aim the saved
 * living model holds but the analysis does not include yet is its own labelled card: its words, who it came from, what
 * the model links into it, and "Not in this analysis yet".
 * ⛔ Render-only, through `ViewportPortal` like `ProposalGhostLayer`: it never enters `nodes`/`edges`, so nothing can
 * save, send or Run it. Core lane only: legacy graphs carry no living model.
 */
import { useEffect, useState } from 'react'
import { ViewportPortal, useStore } from '@xyflow/react'

import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { getSessionIdentity } from '../../lib/supabase'
import { resolveAiComparisonMode } from '../../v5/aiComparisonMode'
import { typography } from '../../styles/typography'
import { isCeeAddressableScenarioId } from '../hydrate/bootGraphRead'
import { StatusPill } from './shared/StatusPill'
import { VALUE_PROVENANCE_ICON } from '../domain/valueProvenanceIcon'
import { SOURCE_MARK_GLYPH_CLASSES } from './shared/EstimateMarker'
import { useCanvasStore } from '../store'
import { OTHER_AIM_COPY, otherAimSourceWords, otherAimsOf, type OtherAim } from './shared/otherAims'

const CARD_WIDTH = 260
const GAP_X = 40
const GAP_Y = 12

/** The saved model's other aims, re-read whenever the saved graph moves (a new hash) on the core lane. */
export function useOtherAims(): OtherAim[] {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const graphHash = useCanvasStore((s) => s.lastServerGraphHash)
  const [aims, setAims] = useState<OtherAim[]>([])
  useEffect(() => {
    if (resolveAiComparisonMode() !== 'core' || !isCeeAddressableScenarioId(scenarioId) || graphHash === null) {
      setAims([])
      return
    }
    const controller = new AbortController()
    void (async () => {
      const identity = await getSessionIdentity().catch(() => ({ userId: null, accessToken: null }))
      const result = await fetchScenarioGraph(scenarioId, { userId: identity.userId, accessToken: identity.accessToken, signal: controller.signal })
      if (!controller.signal.aborted) setAims(result.status === 'graph' ? otherAimsOf(result.graph) : [])
    })().catch(() => { if (!controller.signal.aborted) setAims([]) })
    return () => controller.abort()
  }, [scenarioId, graphHash])
  return aims
}

const SOURCE_ICON = { user: VALUE_PROVENANCE_ICON.human, party: VALUE_PROVENANCE_ICON.panel, olumi: VALUE_PROVENANCE_ICON.ai, unverified: VALUE_PROVENANCE_ICON.unverified_brief } as const

export function OtherAimCard({ aim }: { aim: OtherAim }) {
  const SourceIcon = SOURCE_ICON[aim.source]
  const source = otherAimSourceWords(aim)
  return (
    <div data-testid={`other-aim-${aim.id}`} data-aim-id={aim.id} role="group" aria-label={`${aim.text}. ${OTHER_AIM_COPY.notInAnalysis}. ${source}.`}
      className="flex flex-col gap-1.5 rounded-xl border border-panel-border bg-panel px-3 py-2.5 shadow-1">
      <span className={`${typography.nodeTitle} text-text-header`}>{aim.text}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusPill testId={`other-aim-${aim.id}-status`} label={OTHER_AIM_COPY.notInAnalysis} title={`${OTHER_AIM_COPY.notInAnalysis}: the analysis covers one goal; this aim is kept in your model.`} />
        <span data-testid={`other-aim-${aim.id}-source`} className={`${typography.edgeLabel} inline-flex items-center gap-1 text-text-light`}>
          <SourceIcon aria-hidden="true" className={SOURCE_MARK_GLYPH_CLASSES} />{source}
        </span>
      </span>
      {aim.linkedFrom.length > 0 && (
        <span data-testid={`other-aim-${aim.id}-links`} className={`${typography.edgeLabel} text-text-light`}>
          {OTHER_AIM_COPY.linkedFrom} {aim.linkedFrom.join(', ')}
        </span>
      )}
    </div>
  )
}

/** Stacked to the right of the goal card, in canvas coordinates, so they pan and zoom with the model. */
export function OtherAimsLayer() {
  const aims = useOtherAims()
  const anchor = useStore((s) => {
    for (const n of s.nodeLookup.values()) {
      if (n.type === 'goal') return { x: n.internals.positionAbsolute.x + (n.measured.width ?? 0) + GAP_X, y: n.internals.positionAbsolute.y }
    }
    return null
  }, (a, b) => a?.x === b?.x && a?.y === b?.y)
  if (aims.length === 0 || anchor === null) return null
  return (
    <ViewportPortal>
      <div data-testid="other-aims-layer" className="absolute flex flex-col pointer-events-auto"
        style={{ transform: `translate(${anchor.x}px, ${anchor.y}px)`, width: CARD_WIDTH, gap: GAP_Y }}>
        {aims.map((aim) => <OtherAimCard key={aim.id} aim={aim} />)}
      </div>
    </ViewportPortal>
  )
}
