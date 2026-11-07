/**
 * EVERY TEAM WRITE GOES THROUGH HERE. A write whose answer is lost may or may not have been saved, and no later read can say which (the
 * write can still land after the read, and a read cannot tell one send from another). So nothing here guesses from a read:
 *
 *   · a write core can de-duplicate (it takes an operation id: evidence, an outcome) carries a client-made op id. After a lost answer
 *     the SAME request is sent again with the SAME op, and core's answer is the truth: the receipt of the first save, or the save.
 *   · a write sent without an op (a skip, a reveal) is LOCKED after a lost answer: it may have saved, so it is
 *     not sent again from this page; the person reloads to see what Olumi holds.
 *
 * The state lives in this store, not in a component, so changing tabs neither drops a lock nor forgets an op.
 */
import { create } from 'zustand'
import { newOp, TeamApiError } from './api'
import { useViewStore } from '../../olumiView/store'

export const MAY_HAVE_SAVED = 'The connection dropped before Olumi answered, so this may already have been saved. It is not sent again from this page: reload the page to see what Olumi holds.'
export const NOT_CONFIRMED = 'Olumi did not confirm that. Send it again: it is the same request, so it will not be recorded twice.'

interface Attempt { readonly op: string; readonly request: string }
interface WritesState {
  /** An unconfirmed write with an op: the op to send again, and the request it was for. */
  readonly attempts: Readonly<Record<string, Attempt>>
  /** Writes that may have been saved and cannot be asked about: no second send. */
  readonly locked: Readonly<Record<string, true>>
  /** Writes on their way to core now. */
  readonly sending: Readonly<Record<string, true>>
}
export const useWrites = create<WritesState>()(() => ({ attempts: {}, locked: {}, sending: {} }))
/** The writes on their way now, by key, so a second press waits for the first. */
const inFlight = new Map<string, Promise<unknown>>()

/** For specs. */
export function resetWrites(): void { inFlight.clear(); useWrites.setState({ attempts: {}, locked: {}, sending: {} }) }
/** Is this write locked (it may have been saved, and cannot be asked about)? */
export const useWriteLocked = (key: string): boolean => useWrites((s) => s.locked[key] === true)
/** Is this write on its way now? A form drawn again while it is says so and offers no second send. */
export const useWriteSending = (key: string): boolean => useWrites((s) => s.sending[key] === true)

const without = <T,>(o: Readonly<Record<string, T>>, key: string): Record<string, T> => { const { [key]: _gone, ...rest } = o; return rest }

/**
 * Sends a write once, and settles what a lost answer means.
 * `key` names the write (scenario and form). `request` is the request's content: an op is reused only for the same content.
 * `send` gets the op to carry (null for a write core has no op for).
 */
/** A past version is on the canvas (the version history's Draw): the team's record is the live scenario's, so nothing is added to it. */
export const TEAM_PAST_HELD = 'Go back to the latest version to add to the team’s record.'

export function runWrite<T>(key: string, kind: { readonly op: boolean; readonly anyVersion?: boolean }, request: unknown, send: (op: string | null) => Promise<T>): Promise<T> {
  // Views, evidence, commitments and outcomes belong to the live scenario: none is written while an earlier version is drawn (R1 review
  // 1). An invitation (`anyVersion`) is about who is in, not about any version.
  if (!kind.anyVersion && useViewStore.getState().at !== null) return Promise.reject(new TeamApiError(0, TEAM_PAST_HELD))
  // A write still on its way is not sent again: a second press (the form remounted, its own busy flag gone) waits for the first's answer
  // (review 00002 #2). A write sent without an op (a skip, a reveal) would be saved twice by a second send.
  const going = inFlight.get(key)
  if (going !== undefined) return going as Promise<T>
  const p = settle(key, kind, request, send)
  inFlight.set(key, p)
  useWrites.setState((s) => ({ sending: { ...s.sending, [key]: true } }))
  const done = () => { inFlight.delete(key); useWrites.setState((s) => ({ sending: without(s.sending, key) })) }
  p.then(done, done)
  return p
}


async function settle<T>(key: string, kind: { readonly op: boolean }, request: unknown, send: (op: string | null) => Promise<T>): Promise<T> {
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
  // Core answers 409 while an earlier send of this op is still running (API.md "Retries"): the op is unresolved, so it is kept. A later
  // press with the same content resends it, which returns that send's result once it has one and is never a second paid attempt
  // (final review 00004 #2). Only an answer that settles the request lets its op go.
  const unresolved = (e: unknown) => e instanceof TeamApiError && (e.uncertain || e.status === 409)
  try { return await once() } catch (e) {
    if (!(e instanceof TeamApiError && e.uncertain)) { if (!unresolved(e)) forget(); throw e }
    // The answer was lost: the same request, the same op. Core's answer to it is the truth.
    try { return await once() } catch (again) {
      if (again instanceof TeamApiError && again.uncertain) throw new TeamApiError(again.status, NOT_CONFIRMED, true)
      if (!unresolved(again)) forget()
      throw again
    }
  }
}
