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
export type FloorTurn = { job: number; at: string; by: string; by_id: string; said: string; text: string; order?: number }

/** The model-less conversation (`view.floor`, additive, read defensively like `early`): well-formed entries only, in core's order; none where absent. */
export const floorOf = (view: unknown): FloorTurn[] => {
  const f = typeof view === 'object' && view !== null ? (view as { floor?: unknown }).floor : undefined
  if (!Array.isArray(f)) return []
  return f.filter((x): x is FloorTurn => typeof x === 'object' && x !== null && typeof (x as FloorTurn).text === 'string' && (x as FloorTurn).text.trim() !== '' && typeof (x as FloorTurn).said === 'string'
    && typeof (x as FloorTurn).job === 'number' && typeof (x as FloorTurn).at === 'string')
    .map((x) => ({ job: x.job, at: x.at, by: typeof x.by === 'string' ? x.by : '', by_id: typeof x.by_id === 'string' ? x.by_id : '', said: x.said, text: x.text, ...(orderOf(x) === null ? {} : { order: orderOf(x)! }) }))
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

/**
 * Ordering of the conversation: only from what the service sends. Core names (core builder, 14 Nov; read defensively, absent = today's rendering):
 * `order` a finite number on a chat turn or a floor entry (acceptance order of the brief and each contributor's turn), and `job` the job or
 * proposal identity a later reply belongs to. NAMES ARE ASSUMED until core's handoff lists them: change them here only.
 * `chat[i].at` is not served and is never read. Without `order` on every row the array order the service sent stands (turns, then floor).
 */
export const orderOf = (x: unknown): number | null => {
  const o = typeof x === 'object' && x !== null ? (x as { order?: unknown }).order : undefined
  return typeof o === 'number' && Number.isFinite(o) ? o : null
}
export const jobOf = (x: unknown): number | null => {
  const j = typeof x === 'object' && x !== null ? (x as { job?: unknown }).job : undefined
  return typeof j === 'number' && Number.isFinite(j) ? j : null
}

/** The floor's replies that are not already drawn elsewhere: not the brief's own answer when the board draws it (`draft.early`, same words)
 *  or when the model's first turn carries it (the brief's turn exists). Order kept. */
export const floorShown = (view: { brief?: unknown; chat?: unknown; draft?: unknown } | null): FloorTurn[] => {
  if (view === null) return []
  const board = earlyOf(view.draft), chat = Array.isArray(view.chat) ? view.chat as { first?: unknown }[] : []
  const hasBriefTurn = chat.some((t) => t?.first === true)
  return floorOf(view).filter((f) => f.text !== board && !(hasBriefTurn && f.said === view.brief))
}
