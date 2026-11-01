// The shape of core.mjs for the specs that import it from TypeScript (the .mjs itself stays plain JavaScript, outside the gate).
export class CoreError extends Error {
  status: number
  retryAfter: string | null
  op: string | null
  constructor(status: number, message: string, options?: { retryAfter?: string | null; op?: string | null })
}
/** A failure after core had already kept a write: the write stands (nothing_saved is false). */
export class WriteKept extends CoreError {
  constructor(cause: unknown, extra?: Record<string, unknown>)
}
export const IDENTITY_CHANGED_WORDS: string
export function identityChangedTurn(turnId: string | null | undefined): ReturnType<typeof errorTurn>
export interface CoreTurnError { code: string; message: string; retry_safe: boolean; nothing_saved: boolean }
export function errorTurn(turnId: string | null | undefined, e: unknown): {
  turn_id: string | null; assistant_text: ''; model: null; cards: []; notes: []; run: null; receipts: []; error: CoreTurnError
}
export function makeCore(options: { base: string; fetchImpl?: typeof fetch; paidTimeoutMs?: number; timeoutMs?: number }):
  (method: string, path: string, options?: { token?: string | null; body?: unknown }) => Promise<any>
