import { useCanvasStore } from '../../../store'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { useFactorRunCues } from '../../../nodes/shared/useFactorRunCues'
import { FactorTurningPointSlot } from '../../../nodes/shared/FactorTurningPointTrack'
import { cleanFactorLabel } from '../../../utils/labelUtils'

/**
 * ⭐ THE FACTOR'S TURNING-POINT LINE, IN ITS INSPECTOR — moved, not added.
 *
 * DL ruling #70 5849644637 (26 Sep 2026): "Move 'No turning point in this run'
 * off the card, into the inspector" ("the inspector still shows the
 * turning-point line"). The card said it under a RANKED factor's driver line
 * and it grew the card by a row after every Run (served 03f60be0: the rank-1
 * factor 124.3 → 185.6px). Nothing is removed from the user: the same line,
 * from the SAME data and the SAME gate, is here.
 *
 *   · the data — `useFactorRunCues`, the one derivation the card reads, so
 *     `turningPointState` (never-run / cannot-confirm → null, no past run
 *     invented) and the rank licence cannot disagree with the card;
 *   · the gate — the Detailed card's (`turningPointShown`): a FOUND row on any
 *     factor, the "none" fallback only under a RANKED factor's driver line
 *     (ED 5810951997: no generic "no turning point" on unranked factors);
 *   · the render — the card's own `FactorTurningPointSlot`, full form, so the
 *     wording (`TURNING_POINT_TRACK_COPY`: "No turning point in this run" only
 *     where the run ATTESTED it) and the `Last run · ` label are one owner's.
 *
 * Pinned in `__tests__/FactorPanels.turningPointInInspector.spec.tsx`.
 */
export function FactorTurningPointInspectorLine({ nodeId }: { nodeId: string }) {
  const node = useCanvasStore(state => state.nodes.find(n => n.id === nodeId))
  const displayMetadata = useNodeDisplayMetadata(nodeId, 'factor')
  const { driverLine, turningPointState, resultsFromLastRun } = useFactorRunCues(nodeId, displayMetadata)
  if (!node || turningPointState === null) return null
  if (turningPointState.kind !== 'found' && driverLine === null) return null
  const observed = node.data?.observedState as { value?: unknown; unit?: string | null } | undefined
  // The card's compatible-units gate input, one expression (FactorNode `turningPointFactorUnit`).
  const factorUnit = typeof observed?.value === 'number' ? (observed.unit ?? null) : undefined
  return (
    <div data-testid={`inspector-factor-turning-point-${nodeId}`} className="mt-2">
      <FactorTurningPointSlot
        nodeId={nodeId}
        factorLabel={cleanFactorLabel(String(node.data?.label ?? ''))}
        state={turningPointState}
        fromLastRun={resultsFromLastRun}
        factorUnit={factorUnit}
      />
    </div>
  )
}
