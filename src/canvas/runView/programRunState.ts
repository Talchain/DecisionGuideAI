/**
 * ⭐ ONE RUN-STATE READER FOR A PROGRAM BOARD (W3b; ALPHA-CODE-INVENTORY §0 item 2: two analysis authorities on one board).
 * A program board's Run is its own, in `canonical_analysis_view`; every surface that says whether a Run exists reads it
 * here, through the existing `runViewOf(null, view)`, and on a program board the legacy fields (`analysisStateV1`,
 * `results.report`) are not consulted. `none`: no program reading, so a surface says nothing about a Run, never "not run".
 * The full migration of every reader comes after W8; this is its smallest form.
 */
import { useCanvasStore } from '../store'
import { useCanonicalAnalysisViewStore } from '../stores/canonicalAnalysisViewStore'
import { useSavedModelProgramState } from '../nodes/shared/savedModelProgram'
import { runViewOf } from './runView'
import type { CanonicalAnalysisView } from './canonicalAnalysisView'

export type ProgramRunState = 'current' | 'not_current' | 'none'

/** The program's own Run, from its view: bound to the saved graph and current, bound but not current, or none to read. */
export function programRunStateOf(view: CanonicalAnalysisView | null): ProgramRunState {
  if (view === null || view.run === null) return 'none'
  return runViewOf(null, view).boundToCurrentCanonical() ? 'current' : 'not_current'
}

/**
 * On a program board, its Run's state from its own view; null on a board known not to be one, where the legacy record
 * decides. While the saved read has not answered (or failed) the board may be a program, so nothing is said (`none`).
 */
export function useProgramRunState(): ProgramRunState | null {
  const program = useSavedModelProgramState()
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const view = useCanonicalAnalysisViewStore((s) => (s.scenarioId === scenarioId ? s.view : null))
  return program === 'not_program' ? null : program === 'program' ? programRunStateOf(view) : 'none'
}
