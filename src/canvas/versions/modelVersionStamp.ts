/**
 * modelVersionStamp — which MODEL VERSION the chat can truthfully say a reply read, and the receipts for saves.
 * British English: visualisation, colour, initialise.
 *
 * v10 (#/canvas2) only. The versions panel keeps its own list in component state, so nothing global answered "what
 * version was the model at when this reply arrived?". This is that answer, kept as a short log of what the client has
 * OBSERVED, and nothing else:
 *
 *   · `observations`: the model's version number as the client came to know it, and WHEN. A graph move starts an entry
 *     with no number ("moved, number not read yet"); the head read, or a save's own receipt, fills it. A reply is
 *     stamped with the latest entry at or before the moment it arrived.
 *   · `receipts`: one line per save of the person's own edit that created a version, for the chat thread.
 *
 * ⛔ NEVER INVENT A VERSION. A reply with no entry at or before it, or whose entry has no number, has no chip. A guest
 * has no versions, so a guest never sees one. A moved model whose number was never read stays unnumbered.
 */
import { create } from 'zustand'

export interface VersionObservation {
  readonly scenarioId: string
  /** Epoch ms the client learned the model was at this point. */
  readonly at: number
  /** The version number, or `null` while the model has moved and the number has not been read. */
  readonly number: number | null
}

export interface SavedVersionReceipt {
  /** The version's id: one receipt per version, so a replayed receipt never shows twice. */
  readonly id: string
  readonly scenarioId: string
  readonly at: number
  readonly number: number
  /** Plain words for what changed, e.g. `your value change`; `your change` when nothing more is known. */
  readonly what: string
}

interface StampState {
  readonly observations: readonly VersionObservation[]
  readonly receipts: readonly SavedVersionReceipt[]
}

const MAX_OBSERVATIONS = 200
const MAX_RECEIPTS = 100

export const useModelVersionStampStore = create<StampState>(() => ({ observations: [], receipts: [] }))

/** The model moved on the server: an entry with no number yet. Returns its time so the read can fill it. */
export function noteModelMoved(scenarioId: string, at: number = Date.now()): number {
  useModelVersionStampStore.setState((s) => ({
    observations: [...s.observations, { scenarioId, at, number: null }].slice(-MAX_OBSERVATIONS),
  }))
  return at
}

/**
 * The version number read for the move noted at `movedAt`. Only the LATEST entry for the scenario is filled: if the
 * model moved again while this was being read, the number may belong to the later move, so the earlier span stays
 * unnumbered rather than carrying a number it may not have had.
 */
export function noteVersionRead(scenarioId: string, movedAt: number, number: number): void {
  useModelVersionStampStore.setState((s) => {
    let latest = -1
    for (let i = s.observations.length - 1; i >= 0; i--) {
      if (s.observations[i].scenarioId === scenarioId) {
        latest = i
        break
      }
    }
    if (latest < 0 || s.observations[latest].at !== movedAt || s.observations[latest].number !== null) return s
    const observations = s.observations.slice()
    observations[latest] = { ...observations[latest], number }
    return { ...s, observations }
  })
}

/** A save's own receipt names the version outright: the number is known from that moment on. */
export function noteSavedVersion(input: {
  readonly scenarioId: string
  readonly versionId: string
  readonly number: number
  readonly what: string
  readonly at?: number
}): void {
  const at = input.at ?? Date.now()
  useModelVersionStampStore.setState((s) => {
    if (s.receipts.some((r) => r.id === input.versionId)) return s
    return {
      observations: [...s.observations, { scenarioId: input.scenarioId, at, number: input.number }].slice(-MAX_OBSERVATIONS),
      receipts: [
        ...s.receipts,
        { id: input.versionId, scenarioId: input.scenarioId, at, number: input.number, what: input.what },
      ].slice(-MAX_RECEIPTS),
    }
  })
}

/** The version a reply that arrived at `arrivedAt` read; `null` whenever it is not known. */
export function versionAtTime(
  observations: readonly VersionObservation[],
  scenarioId: string | null | undefined,
  arrivedAt: number,
): number | null {
  if (!scenarioId || !Number.isFinite(arrivedAt)) return null
  for (let i = observations.length - 1; i >= 0; i--) {
    const o = observations[i]
    if (o.scenarioId === scenarioId && o.at <= arrivedAt) return o.number
  }
  return null
}

/** `model_version_receipt.sequence` when the turn carries one: the saved version's number. */
export function readReceiptSequence(response: unknown): number | null {
  const receipt = (response as { model_version_receipt?: { sequence?: unknown } | null } | null | undefined)
    ?.model_version_receipt
  const sequence = receipt?.sequence
  return typeof sequence === 'number' && Number.isInteger(sequence) && sequence > 0 ? sequence : null
}

/**
 * What the person's saved edit was, in plain words, for "Version N saved: <what>". Only what the event itself states;
 * anything else is `your change`.
 */
export function plainChangeWords(event: { type: string; payload?: unknown }): string {
  const p = (event.payload ?? {}) as Record<string, unknown>
  const name = typeof p.label === 'string' && p.label.trim().length > 0 ? `"${p.label.trim()}"` : null
  switch (event.type) {
    case 'structural_add':
      return name ? `your addition of ${name}` : 'your addition'
    case 'structural_add_edge':
      return 'your new link'
    case 'structural_delete':
      return Array.isArray(p.removed_node_ids) && p.removed_node_ids.length > 0 ? 'your deletion' : 'your removed link'
    case 'structural_rename':
      return name ? `your rename to ${name}` : 'your rename'
    case 'factor_value_edit':
      return 'your value change'
    case 'option_intervention_edit':
      return 'your option setting change'
    case 'goal_target_edit':
      return 'your goal target change'
    case 'edge_strength_edit':
      return 'your link strength change'
    default:
      return 'your change'
  }
}

/** Test seam: back to an empty log. */
export function resetModelVersionStamp(): void {
  useModelVersionStampStore.setState({ observations: [], receipts: [] })
}
