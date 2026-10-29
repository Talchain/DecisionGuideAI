/** The last answered read's verdict per scenario, as `answeredCore` keeps it (savedModelIsCore.ts). Import-free. */
export const answeredProgram = new Map<string, boolean>()

/** Whether this scenario's last answered read showed a program (`useSavedModelProgramState`), for a reader outside React. */
export function scenarioReadAsProgram(scenarioId: string | null | undefined): boolean {
  return typeof scenarioId === 'string' && answeredProgram.get(scenarioId) === true
}

/** The program path (`applyProgramGraph`) has just applied CEE's program graph for this scenario: it is a program. */
export function noteProgramScenario(scenarioId: string | null | undefined): void {
  if (typeof scenarioId === 'string') answeredProgram.set(scenarioId, true)
}

export function __resetProgramScenariosForTest(): void {
  answeredProgram.clear()
}
