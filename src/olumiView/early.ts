import type { ViewTurn } from './client'

/**
 * Olumi's early answer (shared contract with core, 14 Nov): `view.draft.early` while a first draft builds or after it failed, and
 * `view.chat[i].early` on a turn, each `{ text }` in plain text: a blank line is a new paragraph, a line starting "- " is a list item.
 * Additive on olumi.view/3 and not yet in the generated types, so it is read here, defensively; absent or empty means today's rendering.
 */
export const EARLY_LABEL = "Olumi's first thoughts (general knowledge, unverified)"
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
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.trim() === '') { out.push({ list: false, lines: [] }); continue }
    const item = /^\s*- (.*)$/.exec(raw), last = out[out.length - 1]
    const list = item !== null, line = item === null ? raw : item[1]!
    if (last !== undefined && last.lines.length > 0 && last.list === list) last.lines.push(line); else out.push({ list, lines: [line] })
  }
  return out.filter((b) => b.lines.length > 0)
}

/** One kept reply on a scenario that has no model (core `view.floor[i]`): who said what, and Olumi's plain answer. */
export type FloorTurn = { job: number; at: string; by: string; by_id: string; said: string; text: string }

/** The model-less conversation (`view.floor`, additive, read defensively like `early`): well-formed entries only, in core's order; none where absent. */
export const floorOf = (view: unknown): FloorTurn[] => {
  const f = typeof view === 'object' && view !== null ? (view as { floor?: unknown }).floor : undefined
  if (!Array.isArray(f)) return []
  return f.filter((x): x is FloorTurn => typeof x === 'object' && x !== null && typeof (x as FloorTurn).text === 'string' && (x as FloorTurn).text.trim() !== '' && typeof (x as FloorTurn).said === 'string'
    && typeof (x as FloorTurn).job === 'number' && typeof (x as FloorTurn).at === 'string')
    .map((x) => ({ job: x.job, at: x.at, by: typeof x.by === 'string' ? x.by : '', by_id: typeof x.by_id === 'string' ? x.by_id : '', said: x.said, text: x.text }))
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
type Entry = { seq: number; kind: 'brief' | 'turn'; by_id: string; job: number | null; proposal: number | null }
export function entriesOf(draft: unknown): Entry[] | null {
  const entries = (draft as { conversation?: unknown } | null)?.conversation
  if (!Array.isArray(entries) || entries.length === 0) return null
  return entries.every((e) => e != null && Number.isSafeInteger(e.seq) && (e.kind === 'brief' || e.kind === 'turn') &&
    typeof e.by_id === 'string' && (e.job === null || Number.isSafeInteger(e.job)) && (e.proposal === null || Number.isSafeInteger(e.proposal)))
    ? entries : null
}

/** The board draws the brief's early answer. Only its actual job can refer to that same brief. */
export const floorShown = (view: { draft?: unknown } | null): FloorTurn[] => {
  const floor = floorOf(view)
  const boardAnswer = earlyOf(view?.draft)
  if (boardAnswer === null) return floor
  const briefJob = entriesOf(view?.draft)?.find(e => e.kind === 'brief')?.job ?? (view?.draft as { job?: number } | null)?.job
  return floor.filter(f => f.job !== briefJob || f.text !== boardAnswer)
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
