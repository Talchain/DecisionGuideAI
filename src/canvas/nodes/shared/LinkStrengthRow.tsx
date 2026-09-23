/**
 * ⭐ THE OUTCOME/RISK CARD'S RELATIONSHIP ROW — the strength of the LINK from
 * this node to the goal, named as a link and never as the node's own quantity
 * (ED 11:52Z point 5: "Distinguish the node's own likelihood/impact/value from
 * relationship strength. If strength is shown on-node, call it **link
 * strength**").
 *
 * ⭐⭐ MT-15b (manual test on served `4c6ec07b`): the outcome card read
 * "Strength Not set yet" while its own edge read "Very strong boost est." — the
 * SAME predicate (`strengthIsHumanSettled`) answered twice in two wordings. One
 * wording for an unconfirmed estimate now: "Link strength · Olumi's estimate"
 * (the number stays in the tooltip, from `unconfirmedStrengthDisclosure`), and
 * "not set" only when there is genuinely no value.
 */
import { NodeMetricRow } from './NodeMetricRow'
import { unconfirmedStrengthDisclosure } from './EstimateMarker'
import { LINK_STRENGTH_COPY } from './metricVocabulary'
import type { EdgeValueSource } from '../../domain/edgeValueProvenance'

export interface BridgeStrength {
  strengthIsSettled: boolean
  bridgeStrengthPct: number | null
  assumedPct: number | null
  assumedSource: EdgeValueSource | null
}

/** The visible wording of an unsettled link: whose estimate, or not set. */
export function unsettledLinkText(bridge: Pick<BridgeStrength, 'assumedPct' | 'assumedSource'>): string {
  if (bridge.assumedPct === null) return LINK_STRENGTH_COPY.notSet
  return bridge.assumedSource === 'cee' ? LINK_STRENGTH_COPY.olumiEstimate : LINK_STRENGTH_COPY.unconfirmedEstimate
}

/** The reduced (far-zoom) line for the same row — one wording on every rung. */
export function linkStrengthLodLine(bridge: BridgeStrength): string {
  if (bridge.strengthIsSettled && bridge.bridgeStrengthPct !== null) {
    return `${LINK_STRENGTH_COPY.noun} ${bridge.bridgeStrengthPct}%`
  }
  return `${LINK_STRENGTH_COPY.noun} · ${unsettledLinkText(bridge)}`
}

export function LinkStrengthRow({
  bridge,
  fillClass,
  testId,
}: {
  bridge: BridgeStrength
  fillClass: string
  testId: string
}) {
  if (bridge.strengthIsSettled && bridge.bridgeStrengthPct !== null) {
    return (
      <NodeMetricRow
        label={LINK_STRENGTH_COPY.noun}
        value={bridge.bridgeStrengthPct / 100}
        formatted={`${bridge.bridgeStrengthPct}%`}
        fillClass={fillClass}
        testId={testId}
      />
    )
  }
  const disclosure = unconfirmedStrengthDisclosure(bridge.assumedPct, bridge.assumedSource)
  return (
    <NodeMetricRow
      label={LINK_STRENGTH_COPY.noun}
      value={null}
      unsetText={unsettledLinkText(bridge)}
      testId={testId}
      title={disclosure}
      phrase={disclosure}
    />
  )
}
