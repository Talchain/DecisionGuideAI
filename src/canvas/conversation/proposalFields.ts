/**
 * S-D slice 1 (§15): the ONE reader of CEE's held-proposal projection, `_proposal_fields` on a turn and
 * `proposal_fields` on the graph read. Pure: no React, no store, so the restore path can use it too.
 */
import { z } from 'zod'
import type { ActionChip, ConversationMessage } from './types'

// Slice 1 §15 projection only. The stored, type-specific operations never come back from this panel.
const bandSchema = z.enum(['slight', 'moderate', 'strong', 'very_strong'])
const actionSchema = z.object({ id: z.string().min(1), label: z.string().min(1), message: z.string().min(1), detail: z.string().optional() })
const linkStrengthFieldSchema = z.object({
  field_id: z.string().min(1), kind: z.literal('link_strength'),
  from_id: z.string().min(1), to_id: z.string().min(1), from_label: z.string().min(1), to_label: z.string().min(1),
  direction: z.enum(['positive', 'negative']),
  current: z.object({ band: bandSchema, source: z.enum(['placeholder', 'estimate', 'yours']) }),
  allowed_bands: z.tuple([z.literal('slight'), z.literal('moderate'), z.literal('strong'), z.literal('very_strong')]),
  editable: z.boolean(),
})
const factorValueFieldSchema = z.object({
  field_id: z.string().regex(/^factor_value:.+$/), kind: z.literal('factor_value'),
  node_id: z.string().min(1), label: z.string().min(1), unit: z.string(),
  cap: z.number().optional(), declared_scale: z.unknown().optional(),
  current: z.object({ value: z.number().finite(), unit: z.string(), source: z.enum(['estimate', 'yours', 'from_brief']) }),
  filled_missing: z.boolean(), editable: z.boolean(),
})
const fieldSchema = z.discriminatedUnion('kind', [linkStrengthFieldSchema, factorValueFieldSchema])
/**
 * The longest change note the card reads. A whole note, never parts: CEE split every note over 400 characters into
 * "(1/3)…(3/3)" fragments because this reader dropped anything longer (CEE `proposal-object/record.ts` `push`). Reader
 * first; CEE then sends each note whole.
 */
export const CHANGE_NOTE_MAX = 4000
// A core proposal's NEW factors and signed links (CEE `adds`, 21 Oct): shown on the canvas, never edited.
const addSource = z.enum(['estimate', 'yours'])
const addSchema = z.discriminatedUnion('kind', [
  z.object({ field_id: z.string().regex(/^factor_add:.+$/), kind: z.literal('factor_add'), node_id: z.string().min(1), label: z.string().min(1),
    value: z.object({ value: z.number().finite(), unit: z.string().min(1) }).nullable(), source: addSource }),
  z.object({ field_id: z.string().regex(/^link_add:.+$/), kind: z.literal('link_add'), link_id: z.string().min(1), from_id: z.string().min(1),
    to_id: z.string().min(1), from_label: z.string().min(1), to_label: z.string().min(1), direction: z.enum(['positive', 'negative']), source: addSource }),
  // Every other change the approval writes, as CEE's one plain sentence (DL 22 Oct, consent: 12/12 served approvals wrote
  // changes the card never showed). Shown before the approve, never edited.
  z.object({ field_id: z.string().regex(/^change_note:.+$/), kind: z.literal('change_note'), text: z.string().min(1).max(CHANGE_NOTE_MAX),
    source: z.enum(['estimate', 'yours', 'party', 'unverified']), editable: z.literal(false) }),
])
export type ChangeNote = Extract<z.infer<typeof addSchema>, { kind: 'change_note' }>
/** The change a note is about (`<kind>:<id>`, plus CEE's own suffix when two changes share a path): a long note's `#k` parts are one. */
const changeItemOf = (n: Pick<ChangeNote, 'field_id'>): string => n.field_id.replace(/^change_note:/, '').replace(/#\d+$/, '')
/** The card's own words before the summary (`SuggestedChips`). */
export const ALSO_CHANGES = 'Also changes'
const CHANGE_NOUNS: Readonly<Record<string, string>> = { aim: 'aim', option: 'option', factor: 'factor', risk: 'risk', link: 'link', condition: 'condition', view: 'view' }
/**
 * The approval card's one summary line (DL 22 Oct: one plain line, the notes behind "Details"), from the notes' own ids:
 * how many of each kind of item the approval also changes, in CEE's order. "Also changes 1 option, 2 factors and 1 link".
 */
export function changeNotesSummary(notes: readonly Pick<ChangeNote, 'field_id'>[], opts: { program?: boolean } = {}): string {
  const counts = new Map<string, Set<string>>()
  for (const n of notes) {
    const item = changeItemOf(n)
    const kind = item.split(':')[0] ?? ''
    const noun = opts.program ? PROGRAM_CHANGE_NOUNS[kind] ?? CHANGE_NOUNS[kind] ?? 'other item' : CHANGE_NOUNS[kind] ?? 'other change'
    counts.set(noun, (counts.get(noun) ?? new Set()).add(item))
  }
  const parts = [...counts].map(([noun, items]) => `${items.size} ${noun}${items.size === 1 ? '' : 's'}`)
  const list = parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `${ALSO_CHANGES} ${list}`
}
/**
 * A program board's record kinds (`living_model.canonical`), in plain nouns: "Also changes 1 goal, 8 figures and 4
 * calculations", never "Also changes 13 other changes" (DL, 23 Oct, served funding card). Any other kind is "other item".
 */
const PROGRAM_CHANGE_NOUNS: Readonly<Record<string, string>> = { goal: 'goal', quantity: 'figure', relation: 'calculation' }
/** CEE's own suffix for a second note on one path (`record.ts`: `<path>:<change>[:<n>]`), so the item's id is read exactly. */
const NOTE_CHANGE_SUFFIX = /:(?:add|change|remove)(?::\d+)?$/
const NOTE_HEAD = /^(Adds|Changes|Removes) ‘([^’]+)’/
/**
 * ⚠ INTERIM, for a program card WITHOUT `changes[]` (DL 23 Oct: until CEE's S2 ships `changes[]` on every program
 * proposal; then this goes in a later commit). A PROGRAM card's Details in plain words only (DL, 23 Oct): each changed item once, as the head of CEE's own sentence
 * ("Adds ‘Amount sought from angels’"). The rest of a program note is the record's raw fields (`kind … define_goal_measure`,
 * `parts {…}`), so it is not shown, and a head that names only the item's id has no plain words, so that note is not
 * listed. Nothing is reworded: the head is CEE's text up to its closing quote.
 */
export function programChangeNoteHeads(notes: readonly ChangeNote[]): ChangeNote[] {
  const seen = new Set<string>()
  const out: ChangeNote[] = []
  for (const n of notes) {
    const item = changeItemOf(n).replace(NOTE_CHANGE_SUFFIX, '')
    const head = NOTE_HEAD.exec(n.text)
    if (seen.has(item) || head === null || head[2] === item.slice(item.indexOf(':') + 1)) continue
    seen.add(item)
    out.push({ ...n, text: `${head[1]} ‘${head[2]}’` })
  }
  return out
}
/**
 * ⭐ THE SUBSTANCE OF EVERY CHANGE (DL 23 Oct, Paul: simplify): CEE's `changes[]` on a program proposal names each item the
 * approval writes, with its before and after in CEE's own rendered words and whose it is. Read whole, one entry at a time:
 * a malformed entry is dropped on its own, never the card. Absent (an older CEE, a board that is not a program board):
 * null, and the card keeps its change notes as before.
 */
const proposalChangeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['quantity', 'relation', 'goal', 'option', 'risk', 'record']),
  action: z.enum(['add', 'change', 'remove']),
  label: z.string().min(1),
  before: z.string().nullable(),
  after: z.string().nullable(),
  author: z.enum(['person', 'olumi']),
})
export type ProposalChange = z.infer<typeof proposalChangeSchema>
/** The card's words for one change, CEE's label and rendered values verbatim; nothing is shortened or reworded. */
export function proposalChangeWords(c: ProposalChange): string {
  const head = `${c.action === 'add' ? 'Adds' : c.action === 'remove' ? 'Removes' : 'Changes'} ‘${c.label}’`
  if (c.action === 'add') return c.after === null ? head : `${head}: ${c.after}`
  if (c.action === 'remove') return c.before === null ? head : `${head} (was: ${c.before})`
  if (c.before !== null && c.after !== null) return `${head}: ${c.before} → ${c.after}`
  return c.after !== null ? `${head}: ${c.after}` : c.before !== null ? `${head} (was: ${c.before})` : head
}
/** The mark beside an item that is Olumi's, never the person's (`author: 'olumi'`). */
export const OLUMI_CHANGE_MARK = 'Olumi’s'
const CHANGE_KIND_NOUNS: Readonly<Record<ProposalChange['kind'], string>> = {
  goal: 'goal', quantity: 'figure', relation: 'calculation', option: 'option', risk: 'risk', record: 'other item',
}
/** The summary from `changes[]`, counted by kind in CEE's order: "Also changes 1 goal, 4 calculations and 8 figures". */
export function proposalChangesSummary(changes: readonly ProposalChange[]): string {
  const counts = new Map<string, Set<string>>()
  for (const c of changes) {
    const noun = CHANGE_KIND_NOUNS[c.kind]
    counts.set(noun, (counts.get(noun) ?? new Set()).add(c.id))
  }
  const parts = [...counts].map(([noun, ids]) => `${ids.size} ${noun}${ids.size === 1 ? '' : 's'}`)
  const list = parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `${ALSO_CHANGES} ${list}`
}
/** The held card's change notes, in CEE's order. */
export const changeNotesOf = (p: Proposal): ChangeNote[] => p.adds.filter((a): a is ChangeNote => a.kind === 'change_note')
/**
 * How many OTHER changes a ghost should say its card holds (DL 22 Oct, served witness: "+9" counted note parts): distinct
 * changes (a long note's `#k` parts are one), less the items the ghost itself draws (a new factor or link, `adds`).
 */
export function otherChangeCountOf(p: Proposal): number {
  // Present `changes[]` is the whole list, an empty one included (zero changes); the notes count only when it is absent.
  if (p.changes !== null) return new Set(p.changes.map((c) => `${c.kind}:${c.id}`)).size
  const drawn = new Set(p.adds.flatMap((a) => a.kind === 'factor_add' ? [`factor:${a.node_id}`] : a.kind === 'link_add' ? [`link:${a.link_id}`] : []))
  return new Set(changeNotesOf(p).map(changeItemOf).filter((item) => !drawn.has(item))).size
}
const proposalSchema = z.object({
  proposal_id: z.string().regex(/^(?:gmh_[0-9a-f]{12}|prop_[0-9a-f]{32})$/),
  // CEE (EDIT-PANEL, 8 Oct): the turn whose reply first offered this proposal; null = CEE could not match it (= absent).
  issued_turn_id: z.string().min(1).nullable().optional(),
  revision: z.string().min(1),
  digest: z.string().regex(/^[0-9a-f]{32}$/),
  approve_action: actionSchema,
  decline_action: actionSchema.extend({ label: z.literal('Not now'), message: z.literal('Not now.') }),
  // ⭐ CEE PR-2 (no silent lapse): a card kept for review after the model changed. Shown as "Review this change" beside its
  // "Not now", never as approve; a reload restores it the same way.
  review_action: actionSchema.optional(),
  fields: z.array(z.unknown()).refine(fields => {
    // Check identity across the raw entries, including kinds this panel cannot render.
    const ids = fields.flatMap(field => field !== null && typeof field === 'object' && 'field_id' in field ? [field.field_id] : [])
    return new Set(ids).size === ids.length
  }).transform(fields => fields.filter(field => field !== null && typeof field === 'object' && 'kind' in field
    && (field.kind === 'link_strength' || field.kind === 'factor_value'))).pipe(z.array(fieldSchema)),
  missing: z.array(z.object({ node_id: z.string().min(1), label: z.string().min(1), kind: z.enum(['risk', 'factor']), what: z.literal('level_today') })),
  // Each entry on its own: an unknown kind, a malformed entry or a malformed container is dropped, never the card (Codex R1).
  adds: z.unknown().optional().transform(adds => (Array.isArray(adds) ? adds : []).flatMap(a => {
    const r = addSchema.safeParse(a)
    return r.success ? [r.data] : []
  })),
  changes: z.unknown().optional().transform(changes => (Array.isArray(changes) ? changes : null)),
}).refine(p => p.approve_action.id === `agent-approve-proposal:${p.proposal_id}`
  && p.decline_action.id === `agent-decline-proposal:${p.proposal_id}`
  && (p.review_action === undefined || p.review_action.id === `${REVIEW_PROPOSAL_PREFIX}${p.proposal_id}`))
  // Each `changes[]` entry is read on its own and the readable ones are kept on view; `changesUnread` says a PRESENT list
  // could not be read in full, so the card cannot be approved as shown (buddy on #2957: never approve 3 while showing 2).
  .transform(({ changes, ...p }) => {
    if (changes === null) return { ...p, changes: null, changesUnread: false }
    const read = changes.flatMap(c => {
      const r = proposalChangeSchema.safeParse(c)
      return r.success ? [r.data] : []
    })
    return { ...p, changes: read, changesUnread: read.length !== changes.length }
  })
// CEE pins `_proposal_fields` to its 16-hex freshness token (graph-hash.ts HASH_HEX_LENGTH; served 4f9f9e5); 64 hex is its durable form.
const wireSchema = z.object({ version: z.literal(1), graph_hash: z.string().regex(/^(?:[0-9a-f]{16}|[0-9a-f]{64})$/), proposals: z.array(z.unknown()) })
export type Proposal = z.infer<typeof proposalSchema>
export type Band = z.infer<typeof bandSchema>
export interface ProposalEdits {
  proposal_id: string
  revision: string
  digest: string
  graph_hash: string
  fields: Array<{ field_id: string; band: Band } | { field_id: string; value: number }>
}
export type ProposalPanelAction = ActionChip & { proposalEdits?: ProposalEdits }

/** CEE amend bounds apply to the stored value, without any unit conversion. */
export function factorValueAllowed(field: Pick<z.infer<typeof factorValueFieldSchema>, 'cap' | 'declared_scale'>, value: number): boolean {
  if (!Number.isFinite(value)) return false
  if (typeof field.cap === 'number' && !(value <= field.cap)) return false
  if (field.declared_scale === 'unit_interval' && !(value >= 0)) return false
  if (field.declared_scale !== null && typeof field.declared_scale === 'object') {
    const scale = field.declared_scale as { min?: unknown; max?: unknown }
    if (typeof scale.min === 'number' && !(value >= scale.min)) return false
    if (typeof scale.max === 'number' && !(value <= scale.max)) return false
  }
  return true
}

export function readTurnProposalFields(response: unknown): unknown {
  if (!response || typeof response !== 'object') return undefined
  const additive = (response as { __additive__?: { _proposal_fields?: unknown } }).__additive__
  return additive?._proposal_fields
}

export function readProposalFields(raw: unknown) {
  const parsed = wireSchema.safeParse(raw)
  if (!parsed.success) return null
  const proposals = parsed.data.proposals.flatMap(entry => {
    const p = proposalSchema.safeParse(entry)
    return p.success ? [p.data] : []
  })
  // An ambiguous identity must never authorise either reading.
  return { graph_hash: parsed.data.graph_hash, proposals: proposals.filter(p => proposals.filter(other => other.proposal_id === p.proposal_id).length === 1) }
}

/** CEE's amend control, byte-identical to its AMEND_CHIP; it carries no proposal id of its own. */
/** The card chips of a held change: its approve, or (kept for review) its "Review this change". */
export const REVIEW_PROPOSAL_PREFIX = 'agent-review-proposal:'
export const isHeldCardChipId = (id: unknown): boolean =>
  typeof id === 'string' && (id.startsWith('agent-approve-proposal:') || id.startsWith(REVIEW_PROPOSAL_PREFIX))
export const AMEND_PROPOSAL_ACTION = { id: 'agent-amend-proposal', label: 'Change something first', message: 'Before you apply it, I want to change some of it.' } as const

const APPROVE_PREFIX = 'agent-approve-proposal:'
export interface DisplayedProposal { proposal_id: string; revision?: string }
/**
 * ⭐ WHAT THE USER IS SHOWN (Codex BLOCK on CEE #3420 / DGAI #2819, 18 Oct, P1: a replacement whose reply was lost inherited
 * the typed consent given to the card still on screen). Every typed turn tells CEE the cards with a button on screen, at the
 * revision this client rendered, and CEE binds typed words ONLY to one of them. Mirrors ChatThread's rule: the latest reply
 * shows all its buttons; an earlier reply shows a card it is the newest owner of while the latest real reply's current held
 * set and that reply's own projection both list it.
 */
export function displayedProposals(messages: readonly ConversationMessage[]): DisplayedProposal[] {
  const replies = messages.filter(m => m.role === 'assistant' && typeof m.sessionDivider !== 'string')
  const latest = replies[replies.length - 1]
  if (latest === undefined) return []
  const latestReal = [...replies].reverse().find(m => !m.synthetic)
  const current = readProposalFields(latestReal?.proposalFields)?.proposals ?? []
  const owners = new Map<string, ConversationMessage>()
  for (const m of replies) {
    if (m.synthetic) continue
    for (const chip of m.actionChips ?? []) if (typeof chip.id === 'string' && chip.id.startsWith(APPROVE_PREFIX)) owners.set(chip.id, m)
  }
  for (const chip of latest.actionChips ?? []) if (typeof chip.id === 'string' && chip.id.startsWith(APPROVE_PREFIX)) owners.set(chip.id, latest)
  const shown: DisplayedProposal[] = []
  for (const [chipId, owner] of owners) {
    const id = chipId.slice(APPROVE_PREFIX.length)
    const own = readProposalFields(owner.proposalFields)?.proposals ?? []
    if (owner !== latest && !(current.some(p => p.proposal_id === id) && own.some(p => p.proposal_id === id))) continue
    const record = current.find(p => p.proposal_id === id) ?? own.find(p => p.proposal_id === id)
    shown.push(record === undefined ? { proposal_id: id } : { proposal_id: id, revision: record.revision })
  }
  return shown
}
