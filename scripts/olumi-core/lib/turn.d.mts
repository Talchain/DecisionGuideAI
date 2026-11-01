// The shape of turn.mjs for the specs that import it from TypeScript (the .mjs itself stays plain JavaScript, outside the gate).
import type { CoreTurnError } from './core.mjs'
export interface ShimContext { token: string | null; aliases: [string, string][] }
export interface ShimTurn {
  turn_id: string | null; assistant_text: string; error: CoreTurnError | null; notes: unknown[]
  model: { graph: { nodes: { id: string }[]; goal_constraints?: any[] } & Record<string, unknown>; revision: string; scenario_revision: string } | null
  [key: string]: unknown
}
export function makeShim(options: { core: (method: string, path: string, options?: { token?: string | null; body?: unknown }) => Promise<any>; log?: (...a: unknown[]) => void }): {
  turn(ctx: ShimContext, body: Record<string, unknown>): Promise<{ out: ShimTurn; alias?: [string, string] }>
  graphRead(ctx: ShimContext, uuid: string): Promise<{ status: number; body: Record<string, any> }>
  [key: string]: unknown
}
