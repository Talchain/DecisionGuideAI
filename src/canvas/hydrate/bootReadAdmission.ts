/**
 * ⭐ A COLD LOAD KEEPS THE READ'S ANALYSIS MODE (Canvas, DL 0df0e1; Reasoning 5 Oct: "OK to build … you own both halves").
 *
 * A fresh-browser cold load stored no admission at all (`testWithoutLinkEligibility.ts`'s measured exception), so
 * "Test without this link" was offered on a Run the service then refused, because its mode was below
 * `quantified_provisional`. CEE's graph read DOES carry the admission, as a PROJECTION
 * (`projectAnalysisAdmission`: admitted, permitted_analysis_mode, reason_codes, graph_hash…). It is not an
 * `AnalysisAdmissionV1` (no `reasons`, `options`, `goal_node_id`), so it is NEVER written to
 * `retainedAnalysisAdmission`: every reader of that field expects the turn's full shape. Only the MODE is kept, here.
 *
 * Recorded by `hydrateCanvasFromServer` beside `setBootAdmittedRevision`, under the same binding: the admission names
 * the read's revision, CEE admits it, and the canvas is proven equal to the read. Read by
 * `selectBootReadPermittedMode` ONLY while the canvas still IS that read (Reasoning's condition 1):
 *   · the store's scenario is the recorded one;
 *   · `bootAdmittedRevision` is still the recorded revision (cleared by a decision-context clear);
 *   · the revision on screen (`lastServerGraphHash`) is still that revision;
 *   · no edit is queued and no import is awaiting registration.
 * A turn's own admission (live or retained) always wins (`TestWithoutLinkButton`).
 */
import { create } from 'zustand'
import type { PermittedAnalysisMode } from '../../adapters/cee/types'

export interface BootReadAdmissionRecord {
  readonly scenarioId: string
  readonly graphHash: string
  readonly permittedAnalysisMode: PermittedAnalysisMode
}

export const useBootReadAdmissionStore = create<{ record: BootReadAdmissionRecord | null }>(() => ({ record: null }))

/** The read's mode for its scenario and revision, or null (any read that does not qualify clears it). */
export function recordBootReadAdmission(record: BootReadAdmissionRecord | null): void {
  useBootReadAdmissionStore.setState({ record })
}

export interface BootReadCanvasState {
  readonly currentScenarioId?: string | null
  readonly bootAdmittedRevision?: string | null
  readonly lastServerGraphHash?: string | null
  readonly pendingEmittedEdits?: number
  readonly importPendingServerRegistration?: boolean
}

/** The recorded mode while the canvas is still the read it was recorded from; otherwise null. */
export function selectBootReadPermittedMode(
  canvas: BootReadCanvasState,
  record: BootReadAdmissionRecord | null,
): PermittedAnalysisMode | null {
  if (record === null) return null
  if (canvas.currentScenarioId !== record.scenarioId) return null
  if (canvas.bootAdmittedRevision !== record.graphHash) return null
  if (canvas.lastServerGraphHash !== record.graphHash) return null
  if ((canvas.pendingEmittedEdits ?? 0) > 0 || canvas.importPendingServerRegistration === true) return null
  return record.permittedAnalysisMode
}

export function __resetBootReadAdmissionForTests(): void {
  recordBootReadAdmission(null)
}
