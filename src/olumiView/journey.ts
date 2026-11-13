/**
 * THE JOURNEY LAYER (DL 12 Nov, redesign action layer, ruling a): what a screen needs to take the person through review -> correction ->
 * approval -> edit -> cold reopen, with no component, no DOM and no React. A new screen imports this, the View types (`./client`) and the
 * store (`./store`), and nothing of the lane's components. Every word the person reads is core's; this module decides only what may be
 * sent, sends it through `runWrite`, and says in a typed reason why something may not be done yet. It formats no model value.
 *
 * Lifted from the lane's components, which keep their own copies untouched (that screen is frozen): the proposal's ticks and their
 * together-rule (ViewChat.tsx Proposal), approve / set aside and the re-read after (ViewChat.tsx `act`), waiting for Olumi (poll.ts
 * `drafting`), the edit gate and base capture (model/editing.ts, FigureEdit.tsx, Rename.tsx), and who a card is by (CoreCard.tsx,
 * model/author.ts).
 *
 * Three things core does not take yet are typed slots here, so a screen built now needs no signature change later (DL rulings b, e):
 * an explicit refused set on an approval (`Refusals.lines`: core drops an unpicked line without a record today, approval.ts:197-203),
 * and an op on approve and set aside. Until core takes them they are not sent, and the outcome says so (`unrecorded`).
 */
import { TeamApiError, newOp } from '../olumiCore/team/api'
import { runWrite } from '../olumiCore/team/writes'
import { isForThisPage, useMe, type Me } from '../olumiCore/me'
import { derivedUuidOf } from '../olumiCore/team/sid'
import { useViewStore } from './store'
import { writes, type View, type ViewCard } from './client'

// ─── Opening a scenario ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Open core's scenario `sid` (s_<12 hex>) as the person whose private link this browser holds: who they are first (every write names
 *  them), then the View into the store. Opening again after a reload is the same call: core holds everything (cold reopen). */
export async function openScenario(sid: string): Promise<View | null> {
  await useMe.getState().load()
  await useViewStore.getState().use(derivedUuidOf(sid))
  return useViewStore.getState().view
}

// ─── Records by id ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE ONE PLACE TO CHECK A RECORD BY ID (DL ruling d): `collab.records`, core's list of the approved model's records. A record need not be
 * a card of its own: core folds one into a card's badge, a premise or the question's badge, and `all` does not unfold badges, so a card
 * list is never the test of whether a record is in the model. Empty while nothing is approved (a pending first draft).
 */
export const recordIdsOf = (view: View): ReadonlySet<string> => new Set(view.collab.records.map((r) => r.id))
export const hasRecord = (view: View, id: string): boolean => view.collab.records.some((r) => r.id === id)

// ─── Olumi's proposal: what is ticked ─────────────────────────────────────────────────────────────────────────────────────────────────
export type Proposal = NonNullable<View['proposal']>
export type Change = Proposal['changes'][number]
/** A line's key: its id and whether it is a top-level field (a record named like a field gives two lines with one id, API v1.9). */
export const lineKey = (c: Change): string => `${c.top ? 'top' : 'rec'}:${c.id}`

/**
 * The lines that stand or fall with this one: every line linked to it through core's `together.ids`, either way round, as far as the links
 * go. Core refuses an approval that chooses a line whose partner is left out (approval.ts approveSelected), so a tick never leaves
 * Olumi's figure without the line that reads it, and an untick never leaves a line without the figure it needs.
 */
export function partnersOf(changes: readonly Change[], c: Change): Change[] {
  const recs = changes.flatMap((x) => (x.top ? [] : [x]))
  const linked = (a: Change, b: Change) => !a.top && !b.top && ((a.together?.ids ?? []).includes(b.id) || (b.together?.ids ?? []).includes(a.id))
  const seen = new Set<string>([lineKey(c)]), out: Change[] = [c], queue: Change[] = [c]
  while (queue.length > 0) {
    const x = queue.shift()!
    for (const y of recs) if (!seen.has(lineKey(y)) && linked(x, y)) { seen.add(lineKey(y)); out.push(y); queue.push(y) }
  }
  return out
}

export type Ticks = ReadonlySet<string>
const setAll = (t: Ticks, cs: readonly Change[], on: boolean): Ticks => { const n = new Set(t); for (const x of cs) { if (on) n.add(lineKey(x)); else n.delete(lineKey(x)) } return n }
/** Tick or untick one line, with every line that stands or falls with it. */
export const toggleLine = (changes: readonly Change[], t: Ticks, c: Change): Ticks => setAll(t, partnersOf(changes, c), !t.has(lineKey(c)))
/** Tick or untick every line of one of core's groups (`proposal.groups[].lines`, indexes into `changes`), with their partners. */
export function setGroup(changes: readonly Change[], t: Ticks, lines: readonly number[], on: boolean): Ticks {
  return setAll(t, lines.flatMap((i) => (changes[i] === undefined ? [] : partnersOf(changes, changes[i]!))), on)
}
/** Is every line of a group ticked? */
export const groupTicked = (changes: readonly Change[], t: Ticks, lines: readonly number[]): boolean =>
  lines.length > 0 && lines.every((i) => changes[i] !== undefined && t.has(lineKey(changes[i]!)))
/** Every line ticked: the whole proposal. */
export const tickEvery = (changes: readonly Change[]): Ticks => new Set(changes.map(lineKey))

/** What a set of ticks approves, in core's order and core's two lists, and what it leaves out (the lines that are not added). */
export type Picks = { readonly only: string[]; readonly only_top: string[] }
export function picksOf(changes: readonly Change[], t: Ticks): Picks & { readonly left: Change[] } {
  const only: string[] = [], only_top: string[] = [], left: Change[] = []
  for (const c of changes) { if (!t.has(lineKey(c))) left.push(c); else (c.top ? only_top : only).push(c.id) }
  return { only, only_top, left }
}

/** Core's verdict on the change (`proposal.verdict`): unsupported means no Approve, and core says what would support it. */
export type Verdict = { readonly supported: boolean; readonly text: string; readonly asks: string | null }
export function verdictOf(p: Proposal): Verdict | null {
  const v = (p as { verdict?: unknown }).verdict as { supported?: unknown; text?: unknown; asks?: unknown } | null | undefined
  if (v == null || typeof v.supported !== 'boolean' || typeof v.text !== 'string' || v.text === '') return null
  return { supported: v.supported, text: v.text, asks: typeof v.asks === 'string' && v.asks !== '' ? v.asks : null }
}

// ─── Acts ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Why an act was not sent, typed so the screen words it (core's own refusal words come back as `TeamApiError.message`). */
export type NotNow = 'past_version' | 'not_your_page' | 'no_view' | 'no_proposal' | 'unsupported' | 'nothing_ticked' | 'stale_question' | 'busy' | 'not_served'
export class JourneyRefusal extends Error { constructor(readonly reason: NotNow) { super(reason); this.name = 'JourneyRefusal' } }

/** After a saved write: whether the View read since shows it. False is "saved, not shown yet" (the screen says so; the write is not lost). */
export type Outcome<T> = { readonly answer: T; readonly shown: boolean }

/**
 * DL ruling b: what the person refuses, said explicitly. `readings`: Olumi's readings they refuse (core takes these today as
 * `refuse_readings`, app.ts:495, and saves them in the version). `lines`: change lines refused. CORE DOES NOT TAKE THESE YET: an approval
 * simply leaves them out and core keeps no record; they are returned in `unrecorded` so the screen never claims a refusal was saved.
 */
export type Refusals = { readonly lines?: readonly string[]; readonly readings?: readonly string[] }
/** DL ruling e: core takes no op on approve or set aside yet. The slot is here; until core takes it nothing is sent and a lost answer
 *  locks the act (runWrite without an op: no second send, "may have saved" words), never a silent resend. */
export const APPROVAL_TAKES_OP = false

function liveView(): View {
  const s = useViewStore.getState()
  if (s.at !== null) throw new JourneyRefusal('past_version')
  if (s.view === null || s.sid === null) throw new JourneyRefusal('no_view')
  return s.view
}

/**
 * Approve exactly what is ticked (`picks`), with the readings chosen (`readings`: Olumi's readings to use, `proposal.marks[].reading.id`)
 * and what is refused (`refused`). Then the View is read again (the model changed). Refused readings are sent; refused lines are not
 * (core takes none yet) and come back in `unrecorded`.
 */
export async function approveSelected(picks: Picks, choose: { readonly readings?: readonly string[] } = {}, refused: Refusals = {}): Promise<Outcome<unknown> & { readonly unrecorded: readonly string[] }> {
  const view = liveView(), p = view.proposal
  if (p === null) throw new JourneyRefusal('no_proposal')
  if (verdictOf(p)?.supported === false) throw new JourneyRefusal('unsupported')
  const readings = [...(choose.readings ?? [])], refuse = [...(refused.readings ?? [])]
  if (picks.only.length + picks.only_top.length === 0 && readings.length === 0 && refuse.length === 0) throw new JourneyRefusal('nothing_ticked')
  // Core reads a missing `only` / `only_top` as empty once readings are named, so both lists always go together (client.ts approve).
  const body = { only: picks.only, only_top: picks.only_top, ...(readings.length > 0 ? { only_readings: readings } : {}), ...(refuse.length > 0 ? { refuse_readings: refuse } : {}) }
  const answer = await runWrite(`${useViewStore.getState().sid}:approve:${p.id}`, { op: APPROVAL_TAKES_OP }, body,
    () => writes.approve(p.id, p.base, body as Parameters<typeof writes.approve>[2]))
  return { answer, shown: await useViewStore.getState().modelChanged(), unrecorded: [...(refused.lines ?? [])] }
}

/** Approve the whole proposal as core holds it (no selection sent: core's own whole approval). Then the View is read again. */
export async function approveAll(): Promise<Outcome<unknown>> {
  const p = liveView().proposal
  if (p === null) throw new JourneyRefusal('no_proposal')
  if (verdictOf(p)?.supported === false) throw new JourneyRefusal('unsupported')
  const answer = await runWrite(`${useViewStore.getState().sid}:approve:${p.id}`, { op: APPROVAL_TAKES_OP }, { whole: p.id }, () => writes.approve(p.id, p.base))
  return { answer, shown: await useViewStore.getState().modelChanged() }
}

/**
 * OLUMI'S READING ON A PROPOSAL (a mark with core's `reading.id`, e.g. which saved figure an aim is measured by): core's own words for it (`status`,
 * and `title`, its question naming the choices) and the three acts the person has (PL-626). None of them writes a refusal:
 * - `confirmReading`: approve the ticked lines WITH the reading (`only_readings`), so it is applied;
 * - a different measure: the person tells Olumi in their own words (`tellOlumi`), and Olumi answers in core;
 * - `unsureOfReading`: approve the ticked lines WITHOUT the reading and without refusing it: the record stays as
 *   they gave it, and the question stays open. Never `refuse_readings`: unsure is not a no. Nothing ticked: neither act sends anything (PL-640).
 */
export type Reading = { readonly id: string; readonly what: string; readonly status: string; readonly question: string }
export const readingsOn = (p: Proposal | null): Reading[] =>
  (p?.marks ?? []).flatMap((m) => (m.reading ? [{ id: m.reading.id, what: m.what, status: m.status, question: m.title }] : []))
// PL-640: an answer to a reading is scoped to what the person chose. An empty selection is never widened to every change: approveSelected refuses
// it (`nothing_ticked`), so neither act ever approves a line the person did not tick. The screen holds the answer until they approve.
export async function confirmReading(picks: Picks & { readonly left: Change[] }, reading: string) {
  if (picks.only.length + picks.only_top.length === 0) throw new JourneyRefusal('nothing_ticked')
  return approveSelected(picks, { readings: [reading] }, { lines: picks.left.map((c) => c.id) })
}
export async function unsureOfReading(picks: Picks & { readonly left: Change[] }) {
  if (picks.only.length + picks.only_top.length === 0) throw new JourneyRefusal('nothing_ticked')
  return approveSelected(picks, {}, { lines: picks.left.map((c) => c.id) })
}
/** A reading id this proposal serves (PL-661): ids are core's opaque keys, used exactly as served; one it does not serve is refused, never sent. */
function served(p: Proposal, ids: readonly string[]) {
  const known = new Set(readingsOn(p).map((r) => r.id))
  if (ids.some((id) => !known.has(id))) throw new JourneyRefusal('not_served')
}
/**
 * The person's answers to Olumi's readings, with the lines they chose (PL-661): confirmed readings go as `only_readings`, declined ones as
 * `refuse_readings`, each by its served id; a reading left unsure goes in neither (unsure is not a no). Core refuses (409, its own words) an
 * approval that leaves a reading carried from an earlier message unsettled. A reading confirmed or declined is an act on its own (PL-667):
 * with no line ticked it goes with empty `only` / `only_top`. Only a truly empty act (no line, nothing confirmed or declined) is refused.
 */
export async function answerReadings(picks: Picks & { readonly left: Change[] }, answers: { readonly confirm: readonly string[]; readonly decline: readonly string[] }) {
  const p = liveView().proposal
  if (p === null) throw new JourneyRefusal('no_proposal')
  served(p, [...answers.confirm, ...answers.decline])
  if (picks.only.length + picks.only_top.length + answers.confirm.length + answers.decline.length === 0) throw new JourneyRefusal('nothing_ticked')
  return approveSelected(picks, { readings: answers.confirm }, { readings: answers.decline, lines: picks.left.map((c) => c.id) })
}
/** Set the whole proposal aside (core's discard): nothing of it is added. `decline`: the readings the person declined, sent as core's
 *  `refuse_readings` (PL-629); with none declined nothing is refused, and core says (409) if a carried reading is still unsettled. */
export async function setAside({ decline = [] }: { readonly decline?: readonly string[] } = {}): Promise<Outcome<unknown>> {
  const p = liveView().proposal
  if (p === null) throw new JourneyRefusal('no_proposal')
  served(p, decline)
  const answer = await runWrite(`${useViewStore.getState().sid}:discard:${p.id}`, { op: APPROVAL_TAKES_OP }, { proposal: p.id, refuse_readings: decline }, () => writes.discard(p.id, decline))
  return { answer, shown: await useViewStore.getState().modelChanged() }
}

/**
 * Tell Olumi something in the person's own words (a correction, an answer, a doubt): one message, answered in core (`awaitTurn`). While a
 * proposal is pending this is how it is corrected: core takes the message against the pending draft (app/turns.ts:162/198), where a direct
 * edit waits for approval (DL ruling c, amended by PL-567).
 */
export async function tellOlumi(text: string) {
  liveView()
  const sid = useViewStore.getState().sid!
  return runWrite(`${sid}:tell`, { op: true }, { text }, (op) => writes.message(sid, text, op!))
}

/**
 * One of Olumi's questions as the SCREEN shows it: its place in `model.coaching_questions` and its words. SCREEN CONTEXT ONLY: core has no
 * question id and binds no answer to a question (the message route takes words alone), so nothing of this is sent. It only guards that
 * the screen still asks that question in those words when the person answers.
 */
export type QuestionRef = { readonly at: number; readonly text: string }
/** Answer one of Olumi's questions: the guard above, then the person's words as an ordinary message (`tellOlumi`). No binding is implied. */
export async function answer(q: QuestionRef, text: string) {
  const view = liveView()
  if ((view.model?.coaching_questions ?? [])[q.at] !== q.text) throw new JourneyRefusal('stale_question')
  return tellOlumi(text)
}

/** Challenge one record (a card or a statement) of the model, by one of core's challenge kinds. Olumi answers in core. */
export async function challenge(kind: string, record: string) {
  liveView()
  const sid = useViewStore.getState().sid!
  return runWrite(`${sid}:challenge:${kind}:${record}`, { op: true }, { kind, record }, (op) => writes.challenge(sid, kind, record, op!))
}

/** Is Olumi still working on this scenario (a first draft drafting, a turn being answered, a reply to an edit running)? */
export const working = (view: View | null): boolean =>
  view === null || view.draft?.status === 'drafting' || view.turn?.status === 'answering' || view.reply?.status === 'running'

/**
 * Wait for Olumi: the store reads the View again every `everyMs` until Olumi is no longer working, then answers how the turn ended
 * ('done', 'failed', 'lost', ... as core says it on `turn.status`, or 'idle' with no turn), or 'timeout'. Reading never starts work.
 */
export async function awaitTurn({ timeoutMs = 120_000, everyMs = 1_500 }: { timeoutMs?: number; everyMs?: number } = {}): Promise<string> {
  const t0 = Date.now()
  for (;;) {
    await useViewStore.getState().refresh()
    const v = useViewStore.getState().view
    if (!working(v)) return v?.turn?.status ?? 'idle'
    if (Date.now() - t0 >= timeoutMs) return 'timeout'
    await new Promise((r) => setTimeout(r, everyMs))
  }
}

// ─── Editing the model directly ───────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * WHERE THE CONVERSATION STANDS, typed (DL 12 Nov): whatever the screen looks like, it draws each of these as its own state, in core's words.
 * - `waiting`: Olumi is answering (the View's `turn`, `answering`): the person's words and core's words for it.
 * - `failed` / `lost`: the turn did not finish (core's words; the model is as it was). Lost is a turn a restart ended.
 * - `held`: Olumi held its reply back: the newest turn carries core's own sentence (`broke`) and no answer. With a core that types it
 *   (COACH-WITHHELD, f549b9cc) `withheld` says what it could not stand behind and the question to take forward; at ac41 it is null.
 * - `answered`: Olumi's answer on the newest turn, and the proposal it brought (null when it only discussed).
 * - `problem`: the newest turn ended with no answer and no held reply, only core's words for why (`problem`: a stopped or blocked turn,
 *   a reply held from a gated viewer). Drawn as that, never as an empty reply.
 * - `none`: nothing has been said yet.
 */
export type Withheld = { readonly kind: string; readonly limit: string; readonly next: string | null }
export type TurnState =
  | { readonly kind: 'none' }
  | { readonly kind: 'waiting'; readonly said: string | null; readonly words: string | null; readonly job: number }
  | { readonly kind: 'failed' | 'lost'; readonly said: string | null; readonly words: string | null; readonly job: number }
  | { readonly kind: 'held'; readonly said: string; readonly words: string; readonly withheld: Withheld | null; readonly turn: number }
  | { readonly kind: 'answered'; readonly said: string; readonly answer: NonNullable<View['chat'][number]['answer']>; readonly turn: number; readonly proposal: number | null }
  | { readonly kind: 'problem'; readonly said: string; readonly words: string; readonly turn: number }
export function turnStateOf(view: View): TurnState {
  const t = view.turn
  if (t) return t.status === 'answering' ? { kind: 'waiting', said: t.said, words: t.words, job: t.job } : { kind: t.status, said: t.said, words: t.words, job: t.job }
  const last = view.chat.at(-1)
  if (!last) return { kind: 'none' }
  if (last.broke) return { kind: 'held', said: last.said, words: last.broke, withheld: (last as { withheld?: Withheld | null }).withheld ?? null, turn: last.id }
  if (last.answer) return { kind: 'answered', said: last.said, answer: last.answer, turn: last.id, proposal: view.proposal?.id ?? null }
  return last.problem ? { kind: 'problem', said: last.said, words: last.problem, turn: last.id } : { kind: 'none' }
}
/** Olumi's open questions on this model, each as the person may answer it (`answer`): core's words, in core's order. */
export const questionsOf = (view: View): QuestionRef[] => (view.model?.coaching_questions ?? []).map((text, at) => ({ at, text }))
/** Where the model cannot support a chance yet: each option's own words ("No chance yet") and the View's question for what it waits on. */
export type NoChance = { readonly option: string; readonly text: string; readonly waits: string; readonly add: string | null }
export const noChanceOf = (view: View): NoChance[] => (view.model?.cards ?? []).flatMap((c) =>
  c.family === 'option' && c.headline?.state === 'none' ? [{ option: c.id, text: c.headline.text, waits: c.headline.title, add: c.headline.add }] : [])
/**
 * One turn of the conversation, through the layer only: the person's words (as an answer to one of Olumi's questions, or as anything else
 * told to Olumi, which is how a pending proposal is corrected), then wait for Olumi (`awaitTurn`), then where it stands. Nothing is retried.
 */
export async function converse(text: string, q: QuestionRef | null = null, wait: { timeoutMs?: number; everyMs?: number } = {}): Promise<{ readonly ended: string; readonly state: TurnState }> {
  await (q ? answer(q, text) : tellOlumi(text))
  const ended = await awaitTurn(wait)
  const v = useViewStore.getState().view
  return { ended, state: v ? turnStateOf(v) : { kind: 'none' } }
}

/**
 * May the person change the model directly now, and on which version? One gate for every direct edit (lifted from model/editing.ts):
 * their own page, the latest version, a View read whole and not overtaken, and a version core takes edits on (`model.edit_base`).
 * DL ruling c: while Olumi's proposal is held core takes no edit (edits.ts:382, 409) and the reason is `after_approval`, typed, never a
 * silent absence: the proposal is Olumi's, and approving (selectively) then correcting keeps whose figure is whose.
 */
export type EditGate =
  | { readonly ok: true; readonly sid: string; readonly base: number }
  | { readonly ok: false; readonly reason: 'after_approval' | 'past_version' | 'not_your_page' | 'not_read' | 'no_version'; readonly held: { readonly id: number; readonly heading: string } | null }
export function editGateOf(s: { readonly sid: string | null; readonly view: View | null; readonly at: number | null; readonly error: string | null; readonly stale: boolean }, me: Me | null): EditGate {
  const no = (reason: Extract<EditGate, { ok: false }>['reason'], held: { id: number; heading: string } | null = null): EditGate => ({ ok: false, reason, held })
  if (s.at !== null) return no('past_version')
  if (s.sid === null || s.view === null || s.error !== null || s.stale) return no('not_read')
  if (!isForThisPage(s.view, me)) return no('not_your_page')
  const base = s.view.model?.edit_base ?? null
  if (base !== null) return { ok: true, sid: s.sid, base }
  const p = s.view.proposal
  return p !== null ? no('after_approval', { id: p.id, heading: p.heading }) : no('no_version')
}
/** The same gate, as the store and the page's person stand now (for a screen that re-draws on every store change). */
export const editGateNow = (): EditGate => editGateOf(useViewStore.getState(), useMe.getState().me)
/** The figure edit core offers on this card (`figure.edit`: its ask, in core's words), or null where core offers none. */
export const figureEditOf = (card: ViewCard) => card.figure?.edit ?? null

/**
 * Correct one figure, as the person typed it, on the base the editor OPENED on (`gate.base`, captured once at open: a background re-read
 * never moves their words onto a newer version; core refuses a stale base in its own words). Then the View is read again.
 */
export async function correctFigure(gate: Extract<EditGate, { ok: true }>, quantity: string, typed: string) {
  const answer = await runWrite(`${gate.sid}:edit:${quantity}`, { op: true }, { base: gate.base, quantity, typed }, (op) => writes.edit(gate.sid, gate.base, quantity, typed, op!))
  return { answer, shown: await useViewStore.getState().modelChanged() }
}
/** Give one card the person's own name, on the base the editor opened on. Then the View is read again. */
export async function renameCard(gate: Extract<EditGate, { ok: true }>, record: string, label: string) {
  const answer = await runWrite(`${gate.sid}:rename:${record}`, { op: true }, { base: gate.base, record, label }, (op) => writes.rename(gate.sid, gate.base, record, label, op!))
  return { answer, shown: await useViewStore.getState().modelChanged() }
}

// ─── Who a card is by ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Who a card is by, and how settled it is, from core's fields only (lifted from CoreCard.tsx and model/author.ts). `by` and its words are
 * core's `card.author` (null where core says nothing readable). `proposed`: core marks a change on it (Olumi's proposal holds it).
 * `provisional`: core doubts it, or Olumi proposes it and it is not yet the person's (DL ruling 12 Nov: dashed means exactly this).
 * `challenged`: core marks it challenged. A screen draws these; it never infers one from words.
 */
export type Authorship = {
  readonly by: 'person' | 'brief' | 'olumi' | 'mixed' | null
  readonly text: string | null
  readonly title: string | null
  readonly proposed: boolean
  readonly provisional: boolean
  readonly challenged: boolean
}
export function authorshipOf(card: ViewCard): Authorship {
  const a = (card as unknown as { author?: unknown }).author as { by?: unknown; text?: unknown; title?: unknown } | null | undefined
  const ok = a != null && typeof a === 'object' && (a.by === 'person' || a.by === 'brief' || a.by === 'olumi' || a.by === 'mixed') && typeof a.text === 'string' && a.text !== ''
  const by = ok ? (a!.by as Authorship['by']) : null
  const proposed = card.change != null
  return {
    by, text: ok ? (a!.text as string) : null, title: ok && typeof a!.title === 'string' ? a!.title : null,
    proposed, provisional: card.doubt === true || (proposed && by === 'olumi'), challenged: card.challenged === true,
  }
}

/** For specs and a fresh page: a new op id, as runWrite mints one. */
export { newOp, TeamApiError }
