/**
 * #2747 r2: the scenario's held canonical view, for readers outside a React subscription (store actions, receipts).
 * The view is used only when it belongs to the CURRENT scenario; any other scenario's view is no authority (null).
 */
import { useCanonicalAnalysisViewStore } from '../stores/canonicalAnalysisViewStore'
import type { CanonicalAnalysisView } from './canonicalAnalysisView'
import type { RunView } from './runView'
import type { GoalChanceDriver } from '../../components/results/utils/goalChanceLicence'

export function heldCanonicalFor(scenarioId: string | null | undefined): CanonicalAnalysisView | null {
  const held = useCanonicalAnalysisViewStore.getState()
  return scenarioId != null && held.scenarioId === scenarioId ? held.view : null
}

/** Each licensed option's GATED main driver (`RunView.mainDriverOf`), by option id; an option with none is absent. */
export function gatedDriversOf(view: RunView): Readonly<Record<string, GoalChanceDriver>> {
  const drivers: Record<string, GoalChanceDriver> = {}
  for (const id of view.goalChance?.optionIds ?? []) {
    const driver = view.mainDriverOf(id)
    if (driver !== null) drivers[id] = driver
  }
  return drivers
}
