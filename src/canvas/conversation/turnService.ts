/**
 * TurnService — HTTP client for the orchestrator endpoint
 *
 * Calls POST /orchestrate/v1/turn on CEE staging. When the
 * orchestratorV2 flag is OFF, callers should not invoke this —
 * use the existing useCEEDraft path instead.
 */

import type {
  OrchestratorTurnRequest,
  OrchestratorResponseEnvelopeV2,
} from './types'

const ORCHESTRATOR_BASE =
  (import.meta as any).env?.VITE_ORCHESTRATOR_BASE ||
  'https://cee-staging.onrender.com'

const ORCHESTRATOR_TIMEOUT_MS = 60_000

export class OrchestratorError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message)
    this.name = 'OrchestratorError'
  }
}

/**
 * Send a turn to the orchestrator and return the parsed envelope.
 *
 * @param request - The turn request payload
 * @param signal  - Optional AbortSignal for cancellation
 * @throws OrchestratorError on non-2xx responses
 */
export async function callOrchestratorTurn(
  request: OrchestratorTurnRequest,
  signal?: AbortSignal,
): Promise<OrchestratorResponseEnvelopeV2> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS)

  // Combine external signal with timeout
  const combinedSignal = signal
    ? combineSignals(signal, controller.signal)
    : controller.signal

  try {
    const response = await fetch(`${ORCHESTRATOR_BASE}/orchestrate/v1/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: combinedSignal,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new OrchestratorError(
        (body as Record<string, string>).message || `Orchestrator returned ${response.status}`,
        response.status,
        body,
      )
    }

    return (await response.json()) as OrchestratorResponseEnvelopeV2
  } finally {
    clearTimeout(timeoutId)
  }
}

/** Combine two AbortSignals — aborts when either fires */
function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (a.aborted || b.aborted) {
    controller.abort()
    return controller.signal
  }
  a.addEventListener('abort', abort, { once: true })
  b.addEventListener('abort', abort, { once: true })
  return controller.signal
}
