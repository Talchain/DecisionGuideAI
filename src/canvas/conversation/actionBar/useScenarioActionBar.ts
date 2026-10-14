import { useCanvasStore } from '../../store'
import type { ActionBarV1 } from './actionBarContract'
import { useActionBarStore } from './actionBarStore'

/** The latest answer's action bar for the OPEN scenario, or null (a bar is never drawn over another scenario). */
export function useScenarioActionBar(): ActionBarV1 | null {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  const bar = useActionBarStore((s) => s.bar)
  const owner = useActionBarStore((s) => s.scenarioId)
  return bar !== null && scenarioId !== null && owner === scenarioId ? bar : null
}
