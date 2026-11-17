import type { ViewTurn } from './client'

/**
 * Olumi's early answer (shared contract with core, 14 Nov): `view.draft.early` while a first draft builds or after it failed, and
 * `view.chat[i].early` on a turn, each `{ text }` in plain text: a blank line is a new paragraph, a line starting "- " is a list item.
 * Additive on olumi.view/3 and not yet in the generated types, so it is read here, defensively; absent or empty means today's rendering.
 */
/** The early answer's caption (UI chrome: core sends `early` as text only). Worded as core's first-answer label, so the two read the same. */
export const EARLY_LABEL = 'A first answer from your brief and general knowledge, written before the model. Not checked against the model.'
export const EARLY_FAILED = 'The model could not be built this time. You can try again, or keep talking below.'

/** The early text of a draft or a chat turn, or null where there is none. */
export const earlyOf = (holder: unknown): string | null => {
  const e = typeof holder === 'object' && holder !== null ? (holder as { early?: unknown }).early : undefined
  const text = typeof e === 'object' && e !== null ? (e as { text?: unknown }).text : undefined
  return typeof text === 'string' && text.trim() !== '' ? text : null
}

/** Paragraphs and "- " list lines of a plain text, in order: `{ list: false, lines: [...] }` or `{ list: true, lines: [...items] }`. */
export const earlyBlocks = (text: string): { list: boolean; lines: string[] }[] => {
  const out: { list: boolean; lines: string[] }[] = []
  let breakBefore = true
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.trim() === '') { breakBefore = true; continue }
    const item = /^\s*- (.*)$/.exec(raw), last = out[out.length - 1]
    const list = item !== null, line = item === null ? raw : item[1]!
    if (!breakBefore && last !== undefined && last.list === list) last.lines.push(line); else out.push({ list, lines: [line] })
    breakBefore = false
  }
  return out
}

/** One kept reply on a scenario that has no model (core `view.floor[i]`): who said what, and Olumi's plain answer. */
export type FloorTurn = { job: number; at: string; by: string; by_id: string; said: string; text: string; /** Olumi's own typed prose blocks of this reply (words-start CONTRACT 4, `floor[].prose`): what can be kept; absent on legacy or untyped replies. */ prose?: string[]; /** A plain message whose reply failed or was lost (core `floor[].unanswered`, sx-team 08:51Z): core's status and its own sentence for that job, verbatim; `words` null where core has none. Such a row has no reply, no prose and no Keep. */ unanswered?: Unanswered; /** The reply's short lead (core `floor[].lead`, Paul 11:02Z): drawn first, the full text folded under it. */ lead?: ReplyLead }
/** A reply's short lead (View v3, additive; DL 11:06:45Z): one or two opening sentences and its points, in Olumi's words as core serves them.
 *  The page draws it and folds the full answer beneath; it never cuts, counts or writes one. Absent: the reply is drawn as before. */
export type ReplyLead = { opening: string; points: string[] }
const squash = (s: string) => s.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/^\s*#{2,6}\s+/, '').replace(/^\s*[-*•]\s+/, '').replace(/\*\*([^*\n]+)\*\*/g, '$1')).join(' ').replace(/\s+/g, ' ').trim()
/** A well-formed lead on `holder` (a turn's answer or a floor row), or null: a non-empty opening and points that are each non-empty words. `full`
 *  is the whole answer's text: a lead that says all of it (the same words) folds nothing, so the reply is drawn as before. */
export const leadOf = (holder: unknown, full: string): ReplyLead | null => {
  const l = typeof holder === 'object' && holder !== null ? (holder as { lead?: unknown }).lead : undefined
  if (l === null || typeof l !== 'object') return null
  const { opening, points } = l as { opening?: unknown; points?: unknown }
  if (typeof opening !== 'string' || opening.trim() === '' || !Array.isArray(points) || !points.every((p) => typeof p === 'string' && p.trim() !== '')) return null
  const lead = { opening, points: points as string[] }
  return squash(full) === squash([opening, ...lead.points].join('\n')) ? null : lead
}
export type Unanswered = { status: 'failed' | 'lost'; words: string | null }
const unansweredOf = (u: unknown): Unanswered | null => {
  if (u === null || typeof u !== 'object') return null
  const { status, words } = u as { status?: unknown; words?: unknown }
  return (status === 'failed' || status === 'lost') && (words === null || typeof words === 'string') ? { status, words } : null
}

/** The model-less conversation (`view.floor`, additive, read defensively like `early`): well-formed entries only, in core's order; none where absent. */
export const floorOf = (view: unknown, alreadyShown?: { job?: number | null; text: string }): FloorTurn[] => {
  const f = typeof view === 'object' && view !== null ? (view as { floor?: unknown }).floor : undefined
  if (!Array.isArray(f)) return []
  const rows: FloorTurn[] = []
  for (const row of f) {
    if (row === null || typeof row !== 'object' || typeof row.text !== 'string' ||
      typeof row.said !== 'string' || typeof row.job !== 'number' || typeof row.at !== 'string') continue
    const by = typeof row.by === 'string' ? row.by : '', by_id = typeof row.by_id === 'string' ? row.by_id : ''
    // A saved message whose reply failed stays in the conversation (sx-team 08:51Z): core says so by a typed `unanswered` on an empty reply,
    // never by reading words. Its own text and any prose are not drawn: there is no reply to draw or keep.
    const unanswered = row.text.trim() === '' && row.said.trim() !== '' ? unansweredOf(row.unanswered) : null
    if (unanswered !== null) { rows.push({ job: row.job, at: row.at, by, by_id, said: row.said, text: '', unanswered }); continue }
    if (!row.text.trim()) continue
    if (alreadyShown && row.job === alreadyShown.job && row.text === alreadyShown.text) continue
    const prose = Array.isArray(row.prose) && row.prose.length > 0 && row.prose.every((p: unknown) => typeof p === 'string') ? { prose: row.prose as string[] } : {}
    const lead = leadOf(row, row.text)
    rows.push({ job: row.job, at: row.at, by, by_id, said: row.said, text: row.text, ...prose, ...(lead === null ? {} : { lead }) })
  }
  return rows
}

type Holder = { version?: unknown; proposal?: unknown; brief?: unknown; draft?: { status?: unknown } | null } | null

/**
 * The scenario has no model and the person is talking to Olumi anyway: its first model is building (a message then is a message, never a
 * second scenario), or the build failed, was lost or was stopped and core kept Olumi's answer to the brief (`draft.early`) or a reply of the
 * floor. Then the composer takes a message to THIS scenario, not a new brief. A failed draft with nothing kept keeps today's rule.
 */
export const onFloor = (view: Holder & object | null): boolean => {
  if (view === null || view.version != null || view.proposal != null) return false
  const s = view.draft?.status
  if (s === 'drafting') return true
  // A failed, lost or stopped first draft of a scenario core holds a brief for: the next ordinary message stays in THIS scenario (Codex, 14 Nov),
  // whether or not Olumi's answer was kept. A scenario with no draft at all (set aside) and no brief keeps the old rule: a message is a new brief.
  const hasBrief = typeof view.brief === 'string' && view.brief.trim() !== ''
  return (s === 'failed' || s === 'lost' || s === 'stopped') && (hasBrief || earlyOf(view.draft) !== null || floorOf(view).length > 0)
}

/** The conversation sequence is the acceptance row id. floor.job and chat.id identify its replies. */
type Entry = { seq: number; kind: string; by_id: string; job: number | null; proposal: number | null }
export function entriesOf(draft: unknown): Entry[] | null {
  const entries = (draft as { conversation?: unknown } | null)?.conversation
  if (!Array.isArray(entries) || entries.length === 0) return null
  const known: Entry[] = []
  for (const e of entries) {
    if (e == null || !Number.isSafeInteger(e.seq) || typeof e.kind !== 'string' || !e.kind.trim() || typeof e.by_id !== 'string' || !e.by_id.trim()) continue
    // The ordering and identity fields also apply to a newer kind. Only a known brief shares its first answer with the drafting board.
    if (e.job == null && e.proposal == null) continue
    if ((e.job != null && !Number.isSafeInteger(e.job)) || (e.proposal != null && !Number.isSafeInteger(e.proposal))) continue
    known.push({ seq: e.seq, kind: e.kind, by_id: e.by_id, job: e.job ?? null, proposal: e.proposal ?? null })
  }
  return known.length ? known : null
}

/** The board draws the brief's early answer. Only its actual job can refer to that same brief. */
export const floorShown = (view: { draft?: unknown; turn?: { job?: unknown } | null } | null): FloorTurn[] => {
  const boardAnswer = earlyOf(view?.draft)
  const briefJob = boardAnswer === null ? undefined : entriesOf(view?.draft)?.find(e => e.kind === 'brief')?.job ?? (view?.draft as { job?: number } | null)?.job
  const rows = boardAnswer === null ? floorOf(view) : floorOf(view, { job: briefJob, text: boardAnswer })
  // The newest turn draws its own message, status and the one Try again (`turn`). Core never serves that job in the floor as well; if it did,
  // the floor's copy is dropped by job identity (never by words), so the message shows once and only the newest keeps its retry.
  const turnJob = view?.turn?.job
  return typeof turnJob === 'number' ? rows.filter(f => !(f.unanswered !== undefined && f.job === turnJob)) : rows
}

type ThreadRow = { seq: number; index: number | null; floor: FloorTurn | null }

/** Edits saved directly on the canvas have a chat row but no turn job. Their own row id orders the edit among accepted contributions. */
export function threadRows(chat: readonly ViewTurn[], floors: readonly FloorTurn[], entries: readonly Entry[] | null): ThreadRow[] {
  const saved = chat.map((t, index) => ({ seq: t.id, index, floor: null }))
  const plain = floors.map(floor => ({ seq: floor.job, index: null, floor }))
  if (entries === null) return [...saved, ...plain]
  const byProposal = new Map(saved.map(row => [row.seq, row]))
  const byJob = new Map(plain.map(row => [row.seq, row]))
  const rows: ThreadRow[] = []
  for (const entry of entries) {
    const savedRow = entry.proposal === null ? undefined : byProposal.get(entry.proposal)
    const floorRow = entry.job === null ? undefined : byJob.get(entry.job)
    const t = savedRow && chat[savedRow.index]!.by_id === entry.by_id ? savedRow : undefined
    const f = floorRow && floorRow.floor.by_id === entry.by_id ? floorRow : undefined
    if (!t && !f) continue
    if (t) byProposal.delete(t.seq)
    if (f) byJob.delete(f.seq)
    // A saved brief's early answer is already projected inside its chat turn. A follow-up's floor reply is a distinct stage of its job.
    rows.push({ seq: entry.seq, index: t?.index ?? null, floor: entry.kind === 'brief' && t && f && earlyOf(chat[t.index]) === f.floor.text ? null : f?.floor ?? null })
  }
  return [...rows, ...byProposal.values(), ...byJob.values()].sort((a, b) => a.seq - b.seq)
}
