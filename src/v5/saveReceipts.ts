/**
 * C8: a turn's own save receipts, read from the entries alone, ONE definition for every consumer that takes a receipt as proof
 * of a save: the normal reply's saved notice and Undo (`captureAgentTurnForUndo.ts`), and a failed or stopped turn's
 * `save_outcome` (`coreTurnContract.ts`). No imports, so the contract can use it without the canvas.
 */
export interface AgentTurnReceipt {
  readonly version: number
  readonly versionId: string
  readonly mutationId: string
}

/**
 * C8: a guest save's own receipt, as CEE sends it. A guest's model has no versions, so it names the saved model's identity
 * and carries no `version`, `version_id` or `mutation_id`: it proves the save, and is never an Undo version.
 */
export interface UnversionedSaveReceipt {
  readonly kind: 'unversioned'
  readonly scenario_revision: string
  readonly run_id: string | null
  readonly source_turn_id: string
  readonly authorised_by: 'person' | 'olumi'
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export const SHA256_HEX = /^[0-9a-f]{64}$/
const RUN_ID = /^mp_run_\d+_[0-9a-f]{12}$/

export function isUnversionedSaveReceipt(r: unknown): r is UnversionedSaveReceipt {
  return record(r) && r.kind === 'unversioned'
    && r.version === undefined && r.version_id === undefined && r.mutation_id === undefined
    && typeof r.scenario_revision === 'string' && SHA256_HEX.test(r.scenario_revision)
    && (r.run_id === null || (typeof r.run_id === 'string' && RUN_ID.test(r.run_id)))
    && typeof r.source_turn_id === 'string' && r.source_turn_id.length > 0
    && (r.authorised_by === 'person' || r.authorised_by === 'olumi')
}

/**
 * The versions the receipts name, oldest first; `null` means a malformed set. A well-formed versionless receipt (C8) is
 * skipped: it is no version to undo.
 */
export function receiptVersions(entries: readonly unknown[]): readonly AgentTurnReceipt[] | null {
  const out: AgentTurnReceipt[] = []
  for (const r of entries) {
    if (isUnversionedSaveReceipt(r)) continue
    // One that says it is versionless but is not well-formed is malformed, never read as a version.
    if (!record(r) || r.kind === 'unversioned') return null
    if (typeof r.version !== 'number' || !Number.isFinite(r.version)) return null
    if (typeof r.version_id !== 'string' || r.version_id.length === 0) return null
    if (typeof r.mutation_id !== 'string' || r.mutation_id.length === 0) return null
    out.push({ version: r.version, versionId: r.version_id, mutationId: r.mutation_id })
  }
  return out.sort((a, b) => a.version - b.version)
}

/** C8: do the receipts prove the turn's own save, a version or a guest's versionless one? A malformed set proves nothing. */
export function receiptsProveOwnSave(entries: readonly unknown[]): boolean {
  const versions = receiptVersions(entries)
  return versions !== null && (versions.length > 0 || entries.some(isUnversionedSaveReceipt))
}
