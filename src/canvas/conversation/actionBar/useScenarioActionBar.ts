import { useCanvasStore } from '../../store'
import type { ActionBarV1 } from './actionBarContract'
import { useActionBarStore } from './actionBarStore'
import { useSavedModelProgramState } from '../../nodes/shared/savedModelProgram'

/**
 * The latest answer's action bar for the OPEN scenario, or null (a bar is never drawn over another scenario).
 * Spec §3 (C13): none on a program board, whose bar CEE ranks from the legacy analysis a program never fills.
 */
export function useScenarioActionBar(): ActionBarV1 | null {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  const bar = useActionBarStore((s) => s.bar)
  const owner = useActionBarStore((s) => s.scenarioId)
  const program = useSavedModelProgramState() !== 'not_program'
  return bar !== null && scenarioId !== null && owner === scenarioId && !program ? bar : null
}
