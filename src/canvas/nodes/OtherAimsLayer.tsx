/**
 * ⭐ THE OTHER AIMS, ON THE CANVAS BESIDE THE GOAL (Paul, 21 Oct 2026: "never hide what Olumi has"). Each aim the saved
 * living model holds but the analysis does not include yet is its own labelled card: its words, who it came from, what
 * the model links into it, and "Not in this analysis yet".
 * ⛔ Render-only, through `ViewportPortal` like `ProposalGhostLayer`: it never enters `nodes`/`edges`, so nothing can
 * save, send or Run it, and it sits right of every card, so it never covers one. Core lane only: legacy graphs carry no
 * living model. One graph-route read per saved-graph change (the turn payload carries no living model).
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
import { OTHER_AIM_COPY, otherAimLinkWords, otherAimSourceWords, otherAimStatusWords, otherAimsOf, type OtherAim } from './shared/otherAims'

const CARD_WIDTH = 200
const GAP_X = 24
const GAP_Y = 8
const MODEL_CARD_TYPES: ReadonlySet<string> = new Set(['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action'])

/** The saved model's other aims, re-read whenever the saved graph moves (a new hash) on the core lane. */
export function useOtherAims(): OtherAim[] {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const graphHash = useCanvasStore((s) => s.lastServerGraphHash)
  const key = `${scenarioId ?? ''}:${graphHash ?? ''}`
  // Bound to the scenario and saved graph they were read for: after a switch or a save, nothing shows until that read answers.
  const [read, setRead] = useState<{ key: string; aims: OtherAim[] } | null>(null)
  useEffect(() => {
    if (resolveAiComparisonMode() !== 'core' || !isCeeAddressableScenarioId(scenarioId) || graphHash === null) return
    const controller = new AbortController()
    void (async () => {
      const identity = await getSessionIdentity().catch(() => ({ userId: null, accessToken: null }))
      const result = await fetchScenarioGraph(scenarioId, { userId: identity.userId, accessToken: identity.accessToken, signal: controller.signal })
      if (!controller.signal.aborted) setRead({ key, aims: result.status === 'graph' ? otherAimsOf(result.graph) : [] })
    })().catch(() => { if (!controller.signal.aborted) setRead({ key, aims: [] }) })
    return () => controller.abort()
  }, [scenarioId, graphHash, key])
  return read?.key === key ? read.aims : []
}

const SOURCE_ICON = { user: VALUE_PROVENANCE_ICON.human, party: VALUE_PROVENANCE_ICON.panel, olumi: VALUE_PROVENANCE_ICON.ai, unverified: VALUE_PROVENANCE_ICON.unverified_brief } as const

export function OtherAimCard({ aim }: { aim: OtherAim }) {
  const SourceIcon = SOURCE_ICON[aim.source]
  const source = otherAimSourceWords(aim)
  const status = otherAimStatusWords(aim)
  const links = otherAimLinkWords(aim)
  return (
    <div data-testid={`other-aim-${aim.id}`} data-aim-id={aim.id} data-aim-status={aim.status} role="group"
      aria-label={`${aim.text}. ${status}. ${source}.`}
      className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-panel-border bg-panel px-2.5 py-2 shadow-1">
      <span className={`${typography.nodeTitle} text-text-header`}>{aim.text}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusPill testId={`other-aim-${aim.id}-status`} label={status} title={aim.status === 'withdrawn' ? 'Withdrawn: kept in your model, not analysed.' : `${OTHER_AIM_COPY.notInAnalysis}: the analysis covers one goal; this aim is kept in your model.`} />
        <span data-testid={`other-aim-${aim.id}-source`} className={`${typography.edgeLabel} inline-flex items-center gap-1 text-text-light`}>
          <SourceIcon aria-hidden="true" className={SOURCE_MARK_GLYPH_CLASSES} />{source}
        </span>
      </span>
      {links !== null && (
        <span data-testid={`other-aim-${aim.id}-links`} className={`${typography.edgeLabel} text-text-light`}>{links}</span>
      )}
    </div>
  )
}

/** Stacked right of every card, bottom-aligned with the goal (growing up, clear of the viewport's bottom edge), in canvas
 * coordinates, so they pan and zoom with the model. The layer passes pointer events through; only the cards take them. */
export function OtherAimsLayer() {
  const aims = useOtherAims()
  const anchor = useStore((s) => {
    // Right of the rightmost card on the board, so a tall stack never overlaps a node; bottom-aligned with the goal.
    let right = -Infinity
    let goalBottom: number | null = null
    for (const n of s.nodeLookup.values()) {
      // Model cards only: the ghost "add" tiles are not items, and the stack may sit beside them.
      if (MODEL_CARD_TYPES.has(String(n.type))) right = Math.max(right, n.internals.positionAbsolute.x + (n.measured.width ?? 0))
      if (n.type === 'goal') goalBottom = n.internals.positionAbsolute.y + (n.measured.height ?? 0)
    }
    return goalBottom === null ? null : { x: right + GAP_X, y: goalBottom }
  }, (a, b) => a?.x === b?.x && a?.y === b?.y)
  if (aims.length === 0 || anchor === null) return null
  return (
    <ViewportPortal>
      <div data-testid="other-aims-layer" className="absolute flex flex-col pointer-events-none"
        style={{ transform: `translate(${anchor.x}px, ${anchor.y}px) translateY(-100%)`, width: CARD_WIDTH, gap: GAP_Y }}>
        {aims.map((aim) => <OtherAimCard key={aim.id} aim={aim} />)}
      </div>
    </ViewportPortal>
  )
}
