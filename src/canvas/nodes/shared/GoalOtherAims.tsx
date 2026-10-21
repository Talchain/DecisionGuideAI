/**
 * ⭐ THE OTHER AIMS, ON THE GOAL CARD (Paul, 21 Oct 2026: "never hide what Olumi has"). Each aim the saved living model holds
 * but the analysis does not include yet is its own row on the goal card: its words, who it came from and what the model
 * links into it, under "Also in your model · not in this analysis yet".
 * ⭐ ON THE CARD, NOT BESIDE IT (served 70327aba, a three-factor board): a stack beside the goal had no place that was always
 * on screen. Right of the cards it ran under the dock; next to the goal it covered a factor. The goal card is in every fit,
 * so its rows always are, and the camera code is untouched.
 * ⛔ Display only: never a node or edge, never Run or the engine graph. Core lane only: legacy graphs carry no living model.
 * One graph-route read per saved-graph change (the turn payload carries no living model).
 */
import { useEffect, useState } from 'react'
import { CircleSlash } from 'lucide-react'

import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import { getSessionIdentity } from '../../../lib/supabase'
import { resolveAiComparisonMode } from '../../../v5/aiComparisonMode'
import { typography } from '../../../styles/typography'
import { isCeeAddressableScenarioId } from '../../hydrate/bootGraphRead'
import { VALUE_PROVENANCE_ICON } from '../../domain/valueProvenanceIcon'
import { SOURCE_MARK_GLYPH_CLASSES } from './EstimateMarker'
import { useCanvasStore } from '../../store'
import { OTHER_AIM_COPY, otherAimLinkWords, otherAimSourceWords, otherAimsOf, type OtherAim } from './otherAims'

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

export function OtherAimRow({ aim }: { aim: OtherAim }) {
  const SourceIcon = SOURCE_ICON[aim.source]
  const source = otherAimSourceWords(aim)
  const links = otherAimLinkWords(aim)
  return (
    <li data-testid={`other-aim-${aim.id}`} data-aim-id={aim.id} data-aim-status={aim.status} className={`${typography.edgeLabel} text-text-light`}>
      <span className="text-text-body">{aim.text}</span>
      {aim.status === 'withdrawn' && <span data-testid={`other-aim-${aim.id}-status`}> · {OTHER_AIM_COPY.withdrawn}</span>}
      {aim.risk && <span data-testid={`other-aim-${aim.id}-risk`}> · {OTHER_AIM_COPY.risk}{aim.risk.chanceNeeded ? ` · ${OTHER_AIM_COPY.chanceNeeded}` : ''}</span>}
      <span data-testid={`other-aim-${aim.id}-source`} className="whitespace-nowrap"> · <SourceIcon aria-hidden="true" className={`${SOURCE_MARK_GLYPH_CLASSES} inline align-[-2px]`} /> {source}</span>
      {links !== null && <span data-testid={`other-aim-${aim.id}-links`}> · {links}</span>}
    </li>
  )
}

export function OtherAimsList({ aims }: { aims: readonly OtherAim[] }) {
  if (aims.length === 0) return null
  return (
    <div data-testid="goal-other-aims" className="mt-1.5 flex flex-col gap-0.5">
      <span className={`${typography.edgeLabel} inline-flex items-center gap-1 text-text-light`}>
        <CircleSlash aria-hidden="true" className={SOURCE_MARK_GLYPH_CLASSES} />{OTHER_AIM_COPY.header}
      </span>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {aims.map((aim) => <OtherAimRow key={aim.id} aim={aim} />)}
      </ul>
    </div>
  )
}

/** The goal card's section: the saved model's other aims, or nothing. */
export function GoalOtherAims() {
  return <OtherAimsList aims={useOtherAims()} />
}
