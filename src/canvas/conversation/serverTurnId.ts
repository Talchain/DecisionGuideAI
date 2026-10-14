import { ADDITIVE_EXTENSIONS_KEY } from '../../v5/responseParser'
import { isUUID } from '../../services/turn-request-builder'

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Read before spreading the parsed response: its additive sidecar is non-enumerable. */
export function readRecordedServerTurnId(response: unknown): string | undefined {
  if (!record(response)) return undefined
  const sidecar = response[ADDITIVE_EXTENSIONS_KEY]
  if (!record(sidecar) || !record(sidecar._agent)) return undefined
  const agent = sidecar._agent
  // CEE live replies attest `recorded`; committed replays omit durability and attest replayed.
  const recorded = agent.durability === 'recorded'
    || (agent.durability === undefined && agent.replayed === true && agent.stopped_reason === 'replayed')
  return recorded && isUUID(agent.turn_id) ? agent.turn_id : undefined
}
