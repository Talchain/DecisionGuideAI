/**
 * v10 (#/canvas2): the "What would change" lens on the cards. Three marks, all read from what the lens already holds
 * and nothing computed afresh:
 *
 *   - a driver badge on each option card, saying CEE's own words on what that option's chance rests on most
 *     (`RunView.mainDriverDetailOf`, the gated canonical `main_driver.detail`, verbatim). An option CEE served no
 *     sentence for draws no badge: its figure is never worded here;
 *   - "can change the comparison" on a figure card the Run's robustness check flagged: one of the links leaving it is in
 *     the lens's own fragile set (`lens._fragileEdgeIds`, the same set the key card lists);
 *   - "worth finding out" on the ONE figure nobody has checked that the Run moves most with: the highest of the lens's
 *     own factor sensitivities (`readFactorSensitivity`) among the figures "Rests on" files as Olumi's, unchecked.
 *
 * Not drawn, because the canvas is not served the data: the v10 board's driver chart (the chance in the lowest and
 * highest third of each option's driver: CEE serves only the side where the chance falls), the "works above about 6%"
 * threshold (no switch point is served), and its "can flip the leader" wording (a fragile link says the comparison could
 * change; it names no leader). Marks hang below the card, out of flow, so no card changes height; nothing dims.
 */
import { useMemo } from 'react'
import { Activity, Search, Shuffle } from 'lucide-react'
import Tooltip from '../components/Tooltip'
import { isGraphLensEnabled } from '../flags'
import { assumptionMapOf } from '../canvas/artefacts/assumptionMapModel'
import { resolveActiveGoalNodeId } from '../canvas/hooks/goalThresholdResolvers'
import { readFactorSensitivity } from '../canvas/hooks/useLensFilter'
import { runViewOf } from '../canvas/runView/runView'
import { useCanonicalAnalysisViewStore } from '../canvas/stores/canonicalAnalysisViewStore'
import { NODE_TOOLTIP_DELAY_MS } from '../canvas/nodes/shared/nodeTooltip'
import { LAST_RUN_PREFIX } from '../canvas/nodes/shared/metricVocabulary'
import { useModelChangedSinceRun } from '../canvas/hooks/useModelChangedSinceRun'
import { useCanvasStore } from '../canvas/store'
import { typography } from '../styles/typography'
import { usePresentation } from './v10'

export const V10_CHANGE_COPY = {
  flip: 'can change the comparison',
  flipTip: 'If this figure is off, how the options compare could change. From this Run’s robustness check, in this model.',
  worth: 'worth finding out',
  worthTip: 'Of the figures nobody has checked, this one moves the result most. In this model.',
  driverAria: 'Its main driver',
} as const

interface MarksState {
  readonly nodes: ReturnType<typeof useCanvasStore.getState>['nodes']
  readonly edges: ReturnType<typeof useCanvasStore.getState>['edges']
  readonly results: { readonly report: unknown }
  readonly lens: { readonly _fragileEdgeIds: ReadonlySet<string> }
  readonly ceeAnalysisReady: ReturnType<typeof useCanvasStore.getState>['ceeAnalysisReady']
  readonly outcomeNodeId: string | null
}

export interface V10ChangeMarkIds {
  /** Figure cards with a link in the lens's fragile set. */
  readonly canChange: ReadonlySet<string>
  /** The one unchecked figure the Run moves with most, or null (none unchecked, or none measured). */
  readonly worth: string | null
}
const NONE: V10ChangeMarkIds = { canChange: new Set(), worth: null }

/** Pure: which figure cards carry which mark, from the lens's own sets. */
export function v10ChangeMarkIds(s: MarksState): V10ChangeMarkIds {
  const report = s.results.report
  if (report === null || typeof report !== 'object') return NONE
  const canChange = new Set<string>()
  for (const edge of s.edges) if (s.lens._fragileEdgeIds.has(edge.id)) canChange.add(edge.source)
  const sensitivity = readFactorSensitivity(report as Record<string, unknown>)
  const goalId = resolveActiveGoalNodeId({ ceeAnalysisReady: s.ceeAnalysisReady, outcomeNodeId: s.outcomeNodeId, nodes: s.nodes })
  let worth: string | null = null
  let most = 0
  for (const item of assumptionMapOf(s.nodes, s.edges, goalId).items) {
    if (item.target.kind !== 'node' || item.column !== 'unchecked') continue
    const value = sensitivity.get(item.target.id) ?? 0
    if (value > most) { most = value; worth = item.target.id }
  }
  return { canChange, worth }
}

// One entry: every figure card asks, and the answer changes only with the model, the Run or the lens's fragile set.
let memo: { readonly key: readonly unknown[]; readonly out: V10ChangeMarkIds } | null = null
function marksOf(s: MarksState): V10ChangeMarkIds {
  const key = [s.nodes, s.edges, s.results.report, s.lens._fragileEdgeIds, s.ceeAnalysisReady, s.outcomeNodeId]
  if (memo !== null && memo.key.every((k, i) => k === key[i])) return memo.out
  const out = v10ChangeMarkIds(s)
  memo = { key, out }
  return out
}

const chipClass = `${typography.edgeLabel} inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border-emphasis bg-panel px-[7px] py-[2px] text-text-body`

function Chip({ testId, label, tip, icon }: { testId: string; label: string; tip: string; icon: JSX.Element }) {
  const stale = useModelChangedSinceRun()
  const words = stale ? `${LAST_RUN_PREFIX}${tip}` : tip
  return (
    <Tooltip asChild content={words} delay={NODE_TOOLTIP_DELAY_MS}>
      <span data-testid={testId} data-node-tooltip="true" tabIndex={0} aria-label={`${label}. ${words}`} className={chipClass}>
        {icon}
        {label}
      </span>
    </Tooltip>
  )
}

function FigureMarks({ nodeId }: { nodeId: string }) {
  const canChange = useCanvasStore((s) => marksOf(s as unknown as MarksState).canChange.has(nodeId))
  const worth = useCanvasStore((s) => marksOf(s as unknown as MarksState).worth === nodeId)
  if (!canChange && !worth) return null
  return (
    <div className="pointer-events-auto absolute left-3 top-full z-10 mt-1 flex flex-col items-start gap-1">
      {canChange && <Chip testId={`v10-change-flip-${nodeId}`} label={V10_CHANGE_COPY.flip} tip={V10_CHANGE_COPY.flipTip} icon={<Shuffle aria-hidden="true" className="h-3 w-3 text-text-light" />} />}
      {worth && <Chip testId={`v10-change-worth-${nodeId}`} label={V10_CHANGE_COPY.worth} tip={V10_CHANGE_COPY.worthTip} icon={<Search aria-hidden="true" className="h-3 w-3 text-text-light" />} />}
    </div>
  )
}

function OptionDriverBadge({ nodeId }: { nodeId: string }) {
  const report = useCanvasStore((s) => (s.results.status === 'complete' ? s.results.report : null))
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const heldView = useCanonicalAnalysisViewStore((s) => s.view)
  const heldScenarioId = useCanonicalAnalysisViewStore((s) => s.scenarioId)
  const detail = useMemo(
    () => runViewOf(report, heldScenarioId === scenarioId ? heldView : null).mainDriverDetailOf(nodeId),
    [report, heldView, heldScenarioId, scenarioId, nodeId],
  )
  if (detail === null) return null
  return (
    <Tooltip asChild content={detail} delay={NODE_TOOLTIP_DELAY_MS}>
      <span
        data-testid={`v10-change-driver-${nodeId}`}
        data-node-tooltip="true"
        role="img"
        tabIndex={0}
        aria-label={`${V10_CHANGE_COPY.driverAria}: ${detail}`}
        className="pointer-events-auto absolute -right-2 -top-2 z-10 inline-grid h-5 w-5 place-items-center rounded-full border border-panel-border bg-panel text-text-light shadow-1"
      >
        <Activity aria-hidden="true" className="h-3 w-3" />
      </span>
    </Tooltip>
  )
}

/** Mount once inside a card (`BaseNode`). Draws nothing outside #/canvas2, outside the lens, or on other card kinds. */
export function V10ChangeMarks({ nodeId, nodeType }: { nodeId: string; nodeType: string | undefined }) {
  const isV10 = usePresentation() === 'v10'
  const lensOn = useCanvasStore((s) => isV10 && isGraphLensEnabled() && s.lens.active === 'what_changes' && s.results.status === 'complete')
  if (!lensOn) return null
  if (nodeType === 'option') return <OptionDriverBadge nodeId={nodeId} />
  if (nodeType === 'factor') return <FigureMarks nodeId={nodeId} />
  return null
}
