import type { CEEGoalConstraint } from '../../../src/adapters/cee/types'
// The shape of model.mjs for the specs that import it from TypeScript (the .mjs itself stays plain JavaScript, outside the gate).
/** The saved version's Run as `canonical_analysis_view.v1` (null before there is a saved version with facts). */
export function analysisViewOf(view: unknown): Record<string, unknown> | null
/** The model a turn or a read carries: the graph (with `goal_constraints` when a limit states one figure), and its revisions (null before there is anything to show). */
export function modelOf(view: unknown): { graph: { nodes: { id: string }[]; goal_constraints?: CEEGoalConstraint[] } & Record<string, unknown>; revision: string; scenario_revision: string } | null
