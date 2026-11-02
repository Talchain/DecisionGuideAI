/**
 * EVERY TEAM WRITE GOES THROUGH HERE. A write whose answer is lost may or may not have been saved, and no later read can say which (the
 * write can still land after the read, and a read cannot tell one send from another). So nothing here guesses from a read:
 *
 *   · a write core can de-duplicate (it takes an operation id: evidence, an outcome) carries a client-made op id. After a lost answer
 *     the SAME request is sent again with the SAME op, and core's answer is the truth: the receipt of the first save, or the save.
 *   · a write core has no op for (a view, a skip, a reveal, a commitment) is LOCKED after a lost answer: it may have saved, so it is
 *     not sent again from this page; the person reloads to see what Olumi holds.
 *
 * The state lives in this store, not in a component, so changing tabs neither drops a lock nor forgets an op.
 */
import { create } from 'zustand'
import { newOp, TeamApiError } from './api'

export const MAY_HAVE_SAVED = 'The connection dropped before Olumi answered, so this may already have been saved. It is not sent again from this page: reload the page to see what Olumi holds.'
export const NOT_CONFIRMED = 'Olumi did not confirm that. Send it again: it is the same request, so it will not be recorded twice.'

interface Attempt { readonly op: string; readonly request: string }
interface WritesState {
  /** An unconfirmed write with an op: the op to send again, and the request it was for. */
  readonly attempts: Readonly<Record<string, Attempt>>
  /** Writes that may have been saved and cannot be asked about: no second send. */
  readonly locked: Readonly<Record<string, true>>
}
export const useWrites = create<WritesState>()(() => ({ attempts: {}, locked: {} }))

/** For specs. */
export function resetWrites(): void { useWrites.setState({ attempts: {}, locked: {} }) }
/** Is this write locked (it may have been saved, and cannot be asked about)? */
export const useWriteLocked = (key: string): boolean => useWrites((s) => s.locked[key] === true)

const without = <T,>(o: Readonly<Record<string, T>>, key: string): Record<string, T> => { const { [key]: _gone, ...rest } = o; return rest }

/**
 * Sends a write once, and settles what a lost answer means.
 * `key` names the write (scenario and form). `request` is the request's content: an op is reused only for the same content.
 * `send` gets the op to carry (null for a write core has no op for).
 */
export async function runWrite<T>(key: string, kind: { readonly op: boolean }, request: unknown, send: (op: string | null) => Promise<T>): Promise<T> {
  if (!kind.op) {
    if (useWrites.getState().locked[key]) throw new TeamApiError(0, MAY_HAVE_SAVED, true)
    try { return await send(null) } catch (e) {
      if (e instanceof TeamApiError && e.uncertain) useWrites.setState((s) => ({ locked: { ...s.locked, [key]: true } }))
      throw e
    }
  }
  const body = JSON.stringify(request)
  const held = useWrites.getState().attempts[key]
  const op = held !== undefined && held.request === body ? held.op : newOp()
  useWrites.setState((s) => ({ attempts: { ...s.attempts, [key]: { op, request: body } } }))
  const forget = () => useWrites.setState((s) => ({ attempts: without(s.attempts, key) }))
  const once = async (): Promise<T> => { const r = await send(op); forget(); return r }
  try { return await once() } catch (e) {
    if (!(e instanceof TeamApiError && e.uncertain)) { forget(); throw e }
    // The answer was lost: the same request, the same op. Core's answer to it is the truth.
    try { return await once() } catch (again) {
      if (again instanceof TeamApiError && again.uncertain) throw new TeamApiError(again.status, NOT_CONFIRMED, true)
      forget(); throw again
    }
  }
}
