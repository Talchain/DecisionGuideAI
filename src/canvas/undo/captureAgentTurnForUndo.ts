/**
 * P48 slice 3 (audit #23) — AN AI-APPLIED CHANGE IS ONE UNDO STEP.
 *
 * Before this, a turn in which Olumi changed the model (an approved proposal, an adopted option) left the journal
 * untouched: the agent response carries no `model_version_receipt`, only `_agent.receipts` — the versions the turn
 * minted, as ids (CEE `turn-receipts.ts`). So neither ⌘Z nor the reply could take the change back.
 *
 * The journal needs, per receipt, the version's identity hash and the version it was written over. Both are on the
 * versions list CEE already serves (`full_hash`, `lineage.parent_version_id`), so this reads that list once and
 * records the turn's receipts as ONE gesture. Undo then goes through the ONE door every canvas undo uses
 * (`runCanvasUndo` → the restore route), never a screen revert.
 *
 * Fail-closed, and says nothing it cannot stand behind:
 *  - a guest has no versions (owned-only): nothing is recorded;
 *  - the list cannot be read, a receipt is not on it, its hash is malformed, the receipts repeat a mutation or a
 *    version, they are not one chain, or the head is no longer the turn's last version (someone wrote since): the
 *    journal is CLEARED as a foreign write — nothing before an unknown write is safe to undo;
 *  - the journal moved while the list was on the wire (a newer write settled with its own receipt): NOTHING is written
 *    (compare-and-set) — the newer write's step stands;
 *  - the first version has no known parent: recorded as a barrier by `recordEditReceipt` (nothing to step back to).
 */
import { ADDITIVE_EXTENSIONS_KEY } from '../../v5/responseParser'
import type { listModelVersions } from '../../adapters/cee/modelVersions'
import type { getSessionIdentity } from '../../lib/supabase'
import { useUndoJournalStore } from './captureUndoReceipt'
import { recordEditReceipt, recordForeignWrite, type UndoJournalState, type UndoReceipt } from './undoJournal'

/** The step's name: the notice reads "Undone: Olumi's change." and the restored version "Undo: Olumi's change". */
export const AI_CHANGE_UNDO_LABEL = "Olumi's change"

export interface AgentTurnReceipt {
  readonly version: number
  readonly versionId: string
  readonly mutationId: string
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** `_agent.receipts` from the parser's non-enumerable additive sidecar, oldest version first. Malformed rows are dropped. */
export function readAgentTurnReceipts(response: unknown): readonly AgentTurnReceipt[] {
  if (!record(response)) return []
  const sidecar = (response as Record<string, unknown>)[ADDITIVE_EXTENSIONS_KEY]
  if (!record(sidecar) || !record(sidecar._agent) || !Array.isArray(sidecar._agent.receipts)) return []
  const out: AgentTurnReceipt[] = []
  for (const r of sidecar._agent.receipts) {
    if (!record(r)) continue
    if (typeof r.version !== 'number' || !Number.isFinite(r.version)) continue
    if (typeof r.version_id !== 'string' || r.version_id.length === 0) continue
    if (typeof r.mutation_id !== 'string' || r.mutation_id.length === 0) continue
    out.push({ version: r.version, versionId: r.version_id, mutationId: r.mutation_id })
  }
  return out.sort((a, b) => a.version - b.version)
}

export type AgentUndoCapture = 'none' | 'recorded' | 'cleared' | 'superseded'

export interface CaptureAgentTurnDeps {
  readonly listVersions?: typeof listModelVersions
  readonly identity?: typeof getSessionIdentity
}

const SHA256_HEX = /^[0-9a-f]{64}$/

/**
 * Compare-and-set: write `next` only while the journal is still the one this capture started from. A journal that
 * moved meanwhile holds a NEWER write's own receipt (a canvas edit that settled during the list read), and an older
 * capture must never overwrite it — not with a step, not with a clear (buddy r1 P1).
 */
function commit(start: UndoJournalState, next: UndoJournalState, outcome: AgentUndoCapture): AgentUndoCapture {
  if (useUndoJournalStore.getState().journal !== start) return 'superseded'
  useUndoJournalStore.setState({ journal: next })
  return outcome
}

/** The Agent wrote, but its versions cannot be placed: nothing before that write is safe to undo. */
function clear(start: UndoJournalState, scenarioId: string): AgentUndoCapture {
  return commit(start, recordForeignWrite(start, { scenarioId, head: null }), 'cleared')
}

/**
 * Captures run ONE AT A TIME, in the order their turns settled (buddy r2 P1). Two in flight would share one starting
 * journal, and whichever list answered first would win the compare-and-set, so an older turn could discard a newer
 * one. Queued, each starts from the journal the previous one left, and the server's head decides (a turn whose head
 * has already moved on clears; the newer turn then records over that).
 */
let captureQueue: Promise<unknown> = Promise.resolve()

export function captureAgentTurnForUndo(
  input: { readonly scenarioId: string; readonly turnId: string; readonly response: unknown; readonly label?: string },
  deps: CaptureAgentTurnDeps = {},
): Promise<AgentUndoCapture> {
  const run = captureQueue.then(() => captureOne(input, deps))
  captureQueue = run.catch(() => undefined)
  return run
}

async function captureOne(
  input: { readonly scenarioId: string; readonly turnId: string; readonly response: unknown; readonly label?: string },
  deps: CaptureAgentTurnDeps,
): Promise<AgentUndoCapture> {
  const receipts = readAgentTurnReceipts(input.response)
  if (receipts.length === 0) return 'none'
  const journalAtStart: UndoJournalState = useUndoJournalStore.getState().journal

  // Loaded at call time: `captureUndoReceipt.ts` imports this module, and the session client throws at import where no
  // Supabase env exists (every spec that imports the journal), so a static import would break them all.
  const readIdentity = deps.identity ?? (await import('../../lib/supabase')).getSessionIdentity
  const identity = await readIdentity().catch(() => ({ userId: null, accessToken: null }))
  // A guest's model has no versions, so its turn minted none to undo; nothing is recorded.
  if (!identity.userId) return 'none'

  const listVersions = deps.listVersions ?? (await import('../../adapters/cee/modelVersions')).listModelVersions
  const list = await listVersions(input.scenarioId, {
    userId: identity.userId,
    accessToken: identity.accessToken,
    limit: 50,
  })
  // Every write below goes through `commit`, the ONE compare-and-set against `journalAtStart`.
  if (list.status !== 'list') return clear(journalAtStart, input.scenarioId)

  // One mutation per version and one version per mutation, or the set is malformed/replayed (buddy r1 P1).
  if (new Set(receipts.map((r) => r.mutationId)).size !== receipts.length
    || new Set(receipts.map((r) => r.versionId)).size !== receipts.length) {
    return clear(journalAtStart, input.scenarioId)
  }
  const byId = new Map(list.versions.map((v) => [v.id, v]))
  const rows = receipts.map((r) => ({ receipt: r, row: byId.get(r.versionId) }))
  const last = rows[rows.length - 1]
  if (rows.some((r) => r.row === undefined || !SHA256_HEX.test(r.row.graphIdentityHash))
    || last.row === undefined || list.currentVersionId !== last.row.id) {
    return clear(journalAtStart, input.scenarioId)
  }
  // The turn's versions must be ONE chain (each written over the one before), or they are not one gesture.
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].row?.parentVersionId !== rows[i - 1].row?.id) return clear(journalAtStart, input.scenarioId)
  }

  let journal = journalAtStart
  for (const { receipt, row } of rows) {
    if (row === undefined) return clear(journalAtStart, input.scenarioId)
    const undoReceipt: UndoReceipt = {
      mutationId: receipt.mutationId,
      versionId: row.id,
      fullHash: row.graphIdentityHash,
      undoVersionId: row.parentVersionId ?? null,
    }
    journal = recordEditReceipt(journal, {
      scenarioId: input.scenarioId,
      receipt: undoReceipt,
      gestureId: input.turnId,
      label: input.label ?? AI_CHANGE_UNDO_LABEL,
    })
  }
  return commit(journalAtStart, journal, 'recorded')
}

/** For the reply's control: is the next ⌘Z exactly this turn's AI change? */
export function isNextUndoThisTurn(journal: UndoJournalState, scenarioId: string | null, turnId: string | undefined): boolean {
  if (scenarioId === null || turnId === undefined || journal.scenarioId !== scenarioId) return false
  const top = journal.undo[journal.undo.length - 1]
  return top !== undefined && top.kind === 'step' && top.gestureId === turnId && top.first.undoVersionId !== null
}
