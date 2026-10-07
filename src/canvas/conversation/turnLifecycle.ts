/**
 * ⭐ THE CHAT TURN LIFECYCLE — ONE STATE MACHINE (S-F, Paul 7 Oct 2026: "I don't want patches. I want completed
 * technical architecture").
 *
 * Before this module the in-flight state of a chat turn was ~15 independent pieces in `useConversation` (an
 * `isThinking` boolean written at 14 sites, its effect-synced ref, a draft-store mirror, three shared timer refs…),
 * and the measured consequences were:
 *   · a PREEMPTED turn's late `finally` cleared the NEWER turn's thinking state (the indicator vanished mid-turn);
 *   · nothing reported a failed or stuck turn anywhere — 0 Sentry calls on the whole turn path, so Paul's
 *     "Suggest risks → only a spinner" (7 Oct, S10) left no trace;
 *   · an unbounded session read before dispatch could hold the spinner with no request ever leaving the browser.
 *
 * The contract:
 *   idle ─start(id)→ pending ─stream(id)→ streaming
 *   pending|streaming ─settle(id, null)→ complete      ─settle(id, kind)→ failed(kind)
 *   pending|streaming ─stop→ stopped                    any ─reset→ idle
 * Every event that names a turn is OWNED: `stream` / `settle` for a turn that is not the current one are ignored, so a
 * superseded turn can never end the turn that replaced it. `isThinking` is DERIVED (`isTurnInFlight`), never set.
 * A settle to `failed` is reported through `reportTurnFailure` by the hook's one settle path, so every failure path
 * reports by construction.
 */
import { captureError } from '../../lib/monitoring'

/** Why a turn failed. `not_sent`: the request never left the browser; `session_timeout`: the session read hung. */
export type TurnFailureKind = 'not_sent' | 'session_timeout' | 'transport' | 'server' | 'timeout' | 'empty'

export type TurnPhase = 'idle' | 'pending' | 'streaming' | 'complete' | 'failed' | 'stopped'

export interface TurnState {
  readonly phase: TurnPhase
  readonly turnId: string | null
  readonly failure: TurnFailureKind | null
}

export const TURN_IDLE: TurnState = { phase: 'idle', turnId: null, failure: null }

export type TurnEvent =
  | { readonly type: 'start'; readonly turnId: string }
  | { readonly type: 'stream'; readonly turnId: string }
  | { readonly type: 'settle'; readonly turnId: string; readonly failure: TurnFailureKind | null }
  | { readonly type: 'stop' }
  | { readonly type: 'reset' }

export function isTurnInFlight(state: TurnState): boolean {
  return state.phase === 'pending' || state.phase === 'streaming'
}

export function turnReducer(state: TurnState, event: TurnEvent): TurnState {
  switch (event.type) {
    case 'start':
      return { phase: 'pending', turnId: event.turnId, failure: null }
    case 'stream':
      if (state.turnId !== event.turnId || state.phase !== 'pending') return state
      return { ...state, phase: 'streaming' }
    case 'settle':
      if (state.turnId !== event.turnId || !isTurnInFlight(state)) return state
      return event.failure === null
        ? { phase: 'complete', turnId: state.turnId, failure: null }
        : { phase: 'failed', turnId: state.turnId, failure: event.failure }
    case 'stop':
      return isTurnInFlight(state) ? { ...state, phase: 'stopped' } : state
    case 'reset':
      return TURN_IDLE
  }
}

/** What a failure report carries. No user text and no full ids: a scenario id is cut to its first 8 characters. */
export interface TurnFailureReport {
  kind: TurnFailureKind
  turnType: string
  mode: 'user' | 'system'
  requestId?: string
  scenarioId?: string | null
  elapsedMs: number
}

/**
 * The ONE place a failed or stuck chat turn is reported. The message is deliberately free of the substrings the
 * Sentry init filters (`ignoreErrors` includes 'NetworkError' as a substring), so a transport failure is never
 * discarded on arrival.
 */
export function reportTurnFailure(report: TurnFailureReport): void {
  const error = new Error(`Chat turn failed: ${report.kind}`)
  error.name = 'ChatTurnFailure'
  captureError(error, {
    component: 'chat-turn',
    turn_failure: report.kind,
    turn_type: report.turnType,
    turn_mode: report.mode,
    request_id: report.requestId,
    scenario: report.scenarioId ? report.scenarioId.slice(0, 8) : null,
    elapsed_ms: report.elapsedMs,
  })
}

/** How long the session read before a turn may take. A hung read used to hold the spinner with nothing sent. */
export const SESSION_READ_TIMEOUT_MS = 15_000

export class SessionReadTimeoutError extends Error {
  constructor() {
    super('The session read before the turn did not return in time')
    this.name = 'SessionReadTimeoutError'
  }
}

/** Resolve `work`, or reject with `SessionReadTimeoutError` after `ms`. The timer never outlives the race. */
export function withSessionReadTimeout<T>(work: Promise<T>, ms: number = SESSION_READ_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SessionReadTimeoutError()), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}
