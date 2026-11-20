/** The change card for a proposal Olumi holds: each change with its tick, the needs ticked with it, the readings and the approve row (moved verbatim from ViewChat.tsx). */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { TeamApiError } from '../../../olumiCore/team/api'
import { writes, type View } from '../../client'
import { verdictOf } from '../../verdict'
import { toReadOf } from '../../toRead'
import { useViewStore } from '../../store'
import { readingHeadingOf } from '../../layout'
import { isForThisPage, useMe } from '../../../olumiCore/me'
import { typography } from '../../../styles/typography'
import { FigureEdit } from '../../FigureEdit'
import { readingsRest, restTop } from '../../readingsRest'
import { noteSaved } from '../../notice'
import { VIEW_CHIP_CLASS, VIEW_CHIP_PRIMARY_CLASS } from '../../../v5/blocks/chipClass'
import { OkIconButton } from '../../look/icons'
import { act, isAnswering } from './chatActions'

/** The change card for the proposal Olumi holds, with core's words and marks, and the two acts on it. */
type Change = NonNullable<View['proposal']>['changes'][number]
/** A line's key: its id and whether it is a top-level field, since a record named like a field gives two lines with one id (API v1.9). */
const keyOf = (c: Change) => `${c.top ? 'top' : 'rec'}:${c.id}`
/** Chrome label before core's own text of the ticked line(s) that need this one. */
export const NEEDED_BY = 'Needed by:'
/** Chrome labels of the review's dependency lines: a ticked statement or note kept without an optional link (never said to be the person's own: the kept record keeps its author); a line core's refusal says the ticked lines need. */
export const KEPT_WITHOUT = 'Kept without:', REFUSAL_NEEDS = 'What you ticked needs this:', TICK_NEEDED = 'Tick what these need'
/** Said above the approve controls while any ticked line would be approved without an optional link: what pressing Approve ticked will leave off. */
export const WILL_LEAVE_OFF = 'Approving the ticked changes will leave off these links:', LEAVE_OFF_SEP = 'without'
/**
 * What a change line needs (core's review-boundary contract, 18 Nov; additive on olumi.view/3 as `proposal.changes[].needs`, not yet in the generated
 * types, so read here, defensively): `{ id, top, kind, why }`, in the direction "this line needs that one", already followed to the end by core, from the
 * same function its approval refuses by. `required`: approved only together. `optional`: a context link (`concerns`) from a claim, evidence or dissent record, whoever wrote
 * it, to a record of Olumi's this proposal adds; it may be left off by a stated choice (`without` on the approval), the kept record's words, author and source untouched. `one_of` (core 2f0235e0): ONE of the
 * tagged lines is needed, not all; the page never ticks one for the person and says core's why on the ticked line until one is ticked. A core that sends none: none.
 */
type Need = { id: string; top: boolean; kind: 'required' | 'optional' | 'one_of'; why: string; /** On a refusal's need: the ticked line it is unmet for. */ of?: string }
const needOf = (x: unknown): Need[] => { const n = x as { id?: unknown; top?: unknown; kind?: unknown; why?: unknown } | null
  return n !== null && typeof n === 'object' && typeof n.id === 'string' && (n.kind === 'required' || n.kind === 'optional' || n.kind === 'one_of') ? [{ id: n.id, top: n.top === true, kind: n.kind, why: typeof n.why === 'string' ? n.why : '', ...(typeof (n as { of?: unknown }).of === 'string' ? { of: (n as { of: string }).of } : {}) }] : [] }
export const needsOf = (c: unknown): Need[] => { const n = (c as { needs?: unknown } | null)?.needs; return Array.isArray(n) ? n.flatMap(needOf) : [] }
/** The lines core's refusal names (409 `{ code: 'needs', needs: [{ of, id, top, kind, why }] }`), by typed id; none for any other refusal. Its words are never read. */
const refusedNeedsOf = (e: unknown): Need[] => { if (!(e instanceof TeamApiError) || e.code !== 'needs') return []; const n = (e.body as { needs?: unknown } | null)?.needs; return Array.isArray(n) ? n.flatMap(needOf) : [] }

/**
 * One change line of core's change card (View `proposal.changes`, L8): its tick, core's line, and what a tap opens (`detail`), with Olumi's
 * mark on a line of Olumi's. Every word is core's.
 */
function ChangeLine({ c, i, ticked, toggle, busy, neededBy = [], reasons = [], without = [], refused = [], oneOf = null }: { c: Change; i: number; ticked: boolean | null; toggle: (c: Change) => void; busy: boolean; /** Core's text of each TICKED line that is approved only with this one: why this line is ticked. */ neededBy?: readonly string[]; /** Core's `why` of each such need, with where core sent it (`needs[k].why` of the line that needs this one). */ reasons?: readonly { at: string; why: string }[]; /** The optional associations this ticked line is kept WITHOUT: core's text of each left-off line and core's why. */ without?: readonly { at: string; text: string; why: string }[]; /** Core's why for each need its refusal named this line for. */ refused?: readonly string[]; /** A ticked line that needs one of several lines, none ticked yet: core's why for it, with where core sent it. */ oneOf?: { at: string; why: string } | null }) {
  // R4 (core v1.13): a line approved only with others carries core's why as its hover, verbatim (`together.why`).
  const why = c.together?.why ?? null
  const line = <><span data-view={`proposal.changes.${i}.text`} title={why ?? undefined} data-view-hover={why === null ? undefined : `proposal.changes.${i}.together.why`}>{c.text}</span>{c.olumi === null ? null : <> <span title={c.olumi.title} aria-label={c.olumi.title} data-view={`proposal.changes.${i}.olumi.glyph`}>{c.olumi.glyph}</span></>}</>
  return (
    <li className="flex items-start gap-2" data-change={keyOf(c)}>
      {/* R25 (24px targets): the box sits in a 24px label, the label the target. */}
      {ticked === null ? null : <label className="inline-flex min-h-[24px] min-w-[24px] flex-none cursor-pointer items-center justify-center" data-target-for={`view-change-tick-${i}`}><input type="checkbox" checked={ticked} disabled={busy} onChange={() => toggle(c)} aria-label={`Choose ${c.text}`} data-testid={`view-change-tick-${i}`} /></label>}
      <div className="min-w-0">
        {c.detail === '' ? <span>{line}</span> : (
          <details><summary className="cursor-pointer">{line}</summary><p className="whitespace-pre-line text-text-light" data-view={`proposal.changes.${i}.detail`}>{c.detail}</p></details>
        )}
        {/* A tick that brings other lines with it is never silent (015; Codex root 21:32Z): once ticked, the line says core's why at rest (its hover
            before), and each line it brought says which ticked line needs it, by that line's own words from core. */}
        {ticked === true && why !== null ? <p className="m-0 text-text-light" data-view={`proposal.changes.${i}.together.why`} data-testid={`view-change-why-${i}`}>{why}</p> : null}
        {ticked === true && neededBy.length > 0 ? <p className="m-0 text-text-light" data-testid={`view-change-needed-by-${i}`}>{NEEDED_BY} {neededBy.join(' · ')}</p> : null}
        {ticked === true ? reasons.map((r) => <p key={r.at} className="m-0 text-text-light" data-view={r.at} data-change-reason="">{r.why}</p>) : null}
        {/* An optional link left off: said on the kept line before it is approved, in core's words, never silently; the line keeps its own author mark. */}
        {ticked === true ? without.map((w) => <p key={w.at} className="m-0 text-text-light" data-view={w.at} data-testid={`view-change-without-${i}`}>{KEPT_WITHOUT} {w.text}{w.why === '' ? null : <> · {w.why}</>}</p>) : null}
        {ticked === true && oneOf !== null ? <p className="m-0 text-text-light" data-view={oneOf.at} data-testid={`view-change-one-of-${i}`}>{oneOf.why}</p> : null}
        {refused.length === 0 ? null : <p className="m-0 text-text-header" data-testid={`view-change-refused-${i}`}>{REFUSAL_NEEDS}{refused.filter((w) => w !== '').map((w, k) => <span key={k}> {w}</span>)}</p>}
      </div>
    </li>
  )
}

/** Said once above the readings Olumi offers: what the choice is, and that nothing is saved before Approve (a reload returns every choice to the original). */
// ORDER-UI-5 (3), DL-408: said of EVERY offered choice, so it claims nothing about where each came from. Core says that beneath each, in its own
// words (core src/view/model.ts readingMark): "Olumi read your message as …" for a reading of someone's words, "Olumi's general, unverified
// placeholder for this figure …" for a figure Olumi offered on request (model.ts:222). Core sends no kind field, so the UI never tells them
// apart from the words; this note said "Olumi read each of these from someone's words", false on a placeholder (live v4, 13 Nov).
export const READINGS_NOTE = 'Choose for each one. Nothing is saved until you press Approve, and a choice you have not approved is not kept if the page is reloaded.'
// The panel's three action labels, as an older core (no `proposal.actions`) is drawn. A core that sends them is the producer (ORDER-OP-9 (3),
// core src/view/view.ts:306 from words/pending-notice.ts PANEL, the value its notice and the coach's sentences read): the buttons draw its words.
export const READING_KEEP = 'Keep the original'
export const READING_USE = 'Use Olumi’s reading'
export const APPROVE_WORD = 'Approve'
/** An approval with readings that did not go through may still have been saved: a different selection is never sent in its place. */
export const READINGS_CHANGED = 'Your choices changed after an approval that did not go through, so nothing was sent. That approval may have been saved: reload the page to see what the model holds, or put the choices back as they were and press Approve again.'

/**
 * The proposal, as core's change card: its heading, the change list (flat, or under core's group headings over 12), and Approve (the whole
 * card), Approve ticked (exactly the ticked lines, core's `only` / `only_top`) and Set aside. A proposal held without a list has Approve alone.
 *
 * A reading of Olumi's (a mark with core's `reading.id`) carries a two-way choice, neither chosen until the person chooses. On approval the
 * readings they chose to use are confirmed (`only_readings`), the ones they chose to keep the original for are refused (`refuse_readings`),
 * and any other offered reading is not applied (nor refused: PL-661). So an approval with an answered reading sends those ids WITH the
 * proposal's own lines (every line for Approve, the ticked lines for Approve ticked): core reads a missing `only` / `only_top` as empty once
 * readings are named. With no reading answered the approval is exactly as before.
 */
/**
 * One of Olumi's questions in the question block (ORDER-UI-5 (2)): where core gives the figure it asks about (`id`) and that figure's editor
 * (`edit`), and this person may edit it now (their page; a version to edit on), the question opens that editor (FigureEdit, the card's own);
 * otherwise core's words alone, never dropped.
 */
export function QuestionLine({ text, id, edit }: { text: string; id: string | null; edit: { prompt: string; ask: string } | null }): JSX.Element {
  const view = useViewStore((s) => s.view)
  const me = useMe((s) => s.me)
  const can = id !== null && edit !== null && view !== null && isForThisPage(view, me) && view.model?.edit_base != null
  return can ? <FigureEdit id={id} edit={edit} label={text} place="view-question" /> : <>{text}</>
}

/** The filled button of a closed review where Approve cannot be pressed blind (Olumi's readings wait for a choice, or core does not support the change). */
export const REVIEW_CHANGES = 'Review the changes'
/** The fold of core's noted points (`proposal.to_read.noted`): chrome words only; the sentence it folds is core's. */
export const NOTED_SHOW_ALL = 'Show all'
export const NOTED_SHOW_FEWER = 'Show fewer'

export function Proposal({ p, busy, evidence, inRow = false, open = true, onOpen, lead }: { /** The one-line review's own row (Olumi's mark, core's heading, Review), drawn first in the actions line, at the foot (17 Nov, the calm panel). */ lead?: ReactNode; /** Drawn inside the one-row review (NextStepCard): its heading is the row's own line, so it is not drawn again. */ inRow?: boolean; /** In the one-row review: false while the row is closed, when only core's alerts and the actions are drawn (the person's ticks and choices are kept). */ open?: boolean; /** Opens the row (the closed review's filled button where Approve waits on a choice). */ onOpen?: () => void; p: NonNullable<View['proposal']>; busy: boolean; evidence: View['evidence'] }) {
  // Olumi answering a turn on THIS proposal (core's `turn` answering while it holds this proposal as the pending one, or its `reply` to it running) holds the
  // approve controls (only those) as a write of the person's own does: an approval made now would discard the answer (Paul's 19 Nov test). Read by id and status, never words.
  const answeringHere = useViewStore((st) => st.view?.proposal?.id === p.id && (isAnswering(st.view) || (st.view?.reply?.status === 'running' && st.view.reply.proposal === p.id)))
  const approveHeld = busy || answeringHere
  const closed = inRow && !open
  // ORDER-UI-5 (5): core's words for the three actions where it sends them, so the coach's sentence and these buttons read one value.
  const actions = { keep: p.actions?.keep ?? READING_KEEP, use: p.actions?.use ?? READING_USE, approve: p.actions?.approve ?? APPROVE_WORD }
  // A proposal Olumi made on considering shared evidence (API v1.12) names who asked and the evidence, in its member's own words. Who asked is
  // core's words for them (`from.by`: "You", their name, "a former member"), never `asked_by`, which is their member id; a core that sends
  // no words names no one.
  const from = p.from == null ? null : { by: p.from.by ?? null, text: evidence.find((e) => e.id === p.from!.evidence)?.text ?? null }
  // A core before L8 serves no list (absent, never []): its card has Approve alone, as a proposal held without a list.
  const changes = p.changes ?? [], groups = p.groups ?? null
  // Test 019 (the 32-change review): where core says how the proposal reads (`to_read`), the list is core's `lines` (or its `groups`) in core's order, and the
  // person's own points it only notes are core's ONE sentence, folded until Show all. Nothing is ranked or hidden by the page: every index of `changes` is in
  // exactly one of the two, or `toReadOf` gives null and today's list is drawn. Ticks and approve keep the same ids (approve takes the whole `changes`).
  const read = toReadOf(p, changes.length)
  const [showNoted, setShowNoted] = useState(false)
  // One line is the whole proposal: ticking it would only repeat Approve, so there are ticks from two lines (4 Nov drive at 1280).
  const tickable = changes.length > 1
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
  // The lines core's last refusal said the ticked lines need (its typed `needs`), marked until the selection changes or is sent again. Nothing is ticked for
  // the person: one press of theirs ticks them (TICK_NEEDED), and an excluded line is never approved by the page.
  const [missing, setMissing] = useState<readonly Need[]>([])
  // What the one press may tick: a required need, and a one_of group with a single member (core names only one line, so there is no choice to make). A group of
  // several stays the person's choice: each is marked, none is ticked.
  const pressable = (n: Need): boolean => !n.top && records.has(n.id) && (n.kind === 'required' || (n.kind === 'one_of' && n.of !== undefined && missing.filter((m) => m.kind === 'one_of' && m.of === n.of).length === 1))
  // ⛔ NEVER ORPHAN OLUMI'S FIGURE (R4, core v1.13 `together`): a line core marks as approved only with others is ticked and unticked with
  // them (the records named in its `together.ids`), so a tick can never leave the figure without the line that reads it.
  const records = new Map(changes.flatMap((o) => (o.top ? [] : [[o.id, o] as const])))
  // TWO fields of core's, two meanings, never merged:
  //  - `needs` kind `required` (the review-boundary contract): mandatory, all of them, already followed to the end by core through mandatory edges only. The
  //    ticked set is kept whole over these: ticking a line ticks them, and unticking one unticks every ticked line that requires it (a hard dependent leaves
  //    with its rejected target; Codex root 21:32Z). An `optional` need is never followed and never ticked for the person (contract item 7).
  //  - `together.ids` (core v1.13): the line's partners as before, ONE step, ticked and unticked with it. It may list ALTERNATIVE readers of a figure, where core
  //    needs one of them and not all (contract item 8, any-of): so it is never followed further and never enforced here; core's own check decides.
  const requiredOf = (c: Change): string[] => needsOf(c).flatMap((n) => (n.kind === 'required' && !n.top ? [n.id] : []))
  const partnersOf = (c: Change): Change[] => (c.together?.ids ?? []).flatMap((id) => { const o = records.get(id); return o === undefined ? [] : [o] })
  const withRequired = (c: Change): Change[] => {
    const out = new Map<string, Change>([[keyOf(c), c]]), walk = [c]
    while (walk.length > 0) for (const id of requiredOf(walk.pop()!)) { const o = records.get(id); if (o !== undefined && !out.has(keyOf(o))) { out.set(keyOf(o), o); walk.push(o) } }
    return [...out.values()]
  }
  /** What ticking a line ticks: the line, its partners (one step) and what each of those requires, to the end. */
  const withPartners = (c: Change): Change[] => [...new Map([c, ...partnersOf(c)].flatMap(withRequired).map((o) => [keyOf(o), o] as const)).values()]
  const set = (n: Set<string>, cs: readonly Change[], on: boolean) => { for (const x of cs) { if (on) n.add(keyOf(x)); else n.delete(keyOf(x)) } }
  const settle = (n: Set<string>): Set<string> => { for (let again = true; again;) { again = false; for (const o of changes) if (n.has(keyOf(o)) && withRequired(o).some((x) => !n.has(keyOf(x)))) { n.delete(keyOf(o)); again = true } } return n }
  // Unticking a line unticks its partners with it, as before (`together`), then every ticked line that requires something no longer ticked (`needs`).
  const toggle = (c: Change) => { setMissing([]); setTicked((t) => { const n = new Set(t), on = !n.has(keyOf(c)); set(n, on ? withPartners(c) : [c, ...partnersOf(c)], on); return settle(n) }) }
  const toggleGroup = (lines: number[], on: boolean) => { setMissing([]); setTicked((t) => { const n = new Set(t); for (const i of lines) { const c = changes[i]; if (c) set(n, on ? withPartners(c) : [c, ...partnersOf(c)], on) } return settle(n) }) }
  // The ticked lines, in core's order: a record's id in `only`, a top-level field's name in `only_top`, never mixed (API v1.8).
  const pick: { only: string[]; only_top: string[] } = { only: [], only_top: [] }
  for (const c of changes) if (ticked.has(keyOf(c))) (c.top ? pick.only_top : pick.only).push(c.id)
  const chosen = pick.only.length + pick.only_top.length
  // The optional associations each ticked record is kept WITHOUT (its optional needs whose line is not ticked), stated on the approval, never inferred.
  const leftOff = (c: Change): Need[] => (c.top || !ticked.has(keyOf(c)) ? [] : needsOf(c).filter((n) => n.kind === 'optional' && !n.top && records.has(n.id) && !ticked.has(keyOf(records.get(n.id)!))))
  const without = changes.flatMap((c) => { const off = leftOff(c); return off.length === 0 ? [] : [{ id: c.id, concerns: off.map((n) => n.id) }] })
  const picked = without.length === 0 ? pick : { ...pick, without }
  // Which ticked lines are approved only with this one (it is in their partners or their required needs): core's own text of each, and core's why.
  const needers = (c: Change) => (c.top ? [] : changes.flatMap((o, oi) => (o !== c && ticked.has(keyOf(o)) && (requiredOf(o).includes(c.id) || (o.together?.ids ?? []).includes(c.id)) ? [{ o, oi }] : [])))
  // A noted line that is chosen (ticked, or pulled in as another's partner) or that core's refusal names is never folded out of sight: the fold stays open.
  const notedHeld = read?.noted != null && read.noted.lines.some((i) => { const c = changes[i]!; return ticked.has(keyOf(c)) || (!c.top && missing.some((n) => !n.top && n.id === c.id)) })
  // Once a hold opens the fold it stays open (review 19 Nov): letting the line go never unmounts it, or the checkbox, under the person's focus.
  if (notedHeld && !showNoted) setShowNoted(true)
  const notedOpen = showNoted || notedHeld
  const shownGroups = read === null ? groups : read.groups, groupAt = read === null ? 'proposal.groups' : 'proposal.to_read.groups'
  const line = (i: number) => {
    const c = changes[i]!, on = tickable ? ticked.has(keyOf(c)) : null, by = tickable ? needers(c) : []
    const reasons = by.flatMap(({ o, oi }) => needsOf(o).flatMap((n, k) => (n.id === c.id && n.kind === 'required' && n.why !== '' ? [{ at: `proposal.changes.${oi}.needs.${k}.why`, why: n.why }] : [])))
    const off = tickable ? needsOf(c).flatMap((n, k) => (leftOff(c).some((x) => x.id === n.id) ? [{ at: `proposal.changes.${i}.needs.${k}.why`, text: records.get(n.id)!.text, why: n.why }] : [])) : []
    const refusedFor = c.top ? [] : missing.flatMap((n) => (n.id === c.id && !n.top ? [n.why] : []))
    const ones = needsOf(c).map((n, k) => ({ n, k })).filter(({ n }) => n.kind === 'one_of' && !n.top)
    const oneOf = !tickable || ones.length === 0 || ones.some(({ n }) => records.has(n.id) && ticked.has(keyOf(records.get(n.id)!))) || ones[0]!.n.why === '' ? null : { at: `proposal.changes.${i}.needs.${ones[0]!.k}.why`, why: ones[0]!.n.why }
    return <ChangeLine key={keyOf(c)} c={c} i={i} ticked={on} toggle={toggle} busy={busy} neededBy={by.map(({ o }) => o.text)} reasons={reasons} without={off} refused={refusedFor} oneOf={oneOf} />
  }
  const verdict = verdictOf(p)
  // THE FILLED BUTTON FOLLOWS THE TICKS (Codex root 21:10Z, 18 Nov, the native partial-approve read: with lines ticked the filled Approve still took the
  // whole batch, so a person who ticked three lines and pressed the one green button approved all of them). With nothing ticked the filled button is the
  // whole proposal, as before. Once a line is ticked the filled button is Approve ticked, first, and the whole proposal is the quiet one beside it, saying
  // how many lines it takes: the green button never approves more than the person chose. What each sends is unchanged (`only` / `only_top`, or `base` alone).
  // A selection is never dropped silently (Codex root 21:24Z): the review keeps its ticks when it is collapsed, so while lines are ticked a CLOSED review
  // offers no approve at all; its filled button reopens the review (as it does while Olumi's readings wait), where the ticked lines are in view.
  const heldTicks = tickable && chosen > 0
  const followsTicks = heldTicks
  const wholeWords = actions.approve === APPROVE_WORD ? (followsTicks ? 'Approve all' : 'Approve these changes') : actions.approve
  const approveWhole = <OkIconButton id="approve" tone={followsTicks ? 'ghost' : 'primary'} words={followsTicks ? `${wholeWords} · ${changes.length}` : wholeWords} count={followsTicks ? changes.length : undefined} disabled={approveHeld} testid="view-approve" onClick={() => approve()} />
  const approveTicked = !tickable ? null : <OkIconButton id="approve-ticked" tone={followsTicks ? 'primary' : 'ghost'} words={`Approve ticked · ${chosen}`} count={chosen} disabled={approveHeld || chosen === 0} testid="view-approve-ticked" onClick={() => approve(picked)} />
  // The readings Olumi offers, by core's own id for each (`marks[].reading.id`). A core that serves no change list offers no choice: the
  // proposal's own lines could not be named beside the readings, and core would then drop them. Nor does a proposal core does not support:
  // it has no Approve, so there is nothing a choice could be sent with.
  const readingIds = p.changes === undefined || verdict?.supported === false ? [] : [...new Set(p.marks.flatMap((m) => (m.reading ? [m.reading.id] : [])))]
  // Each reading's own answer, as the person gave it: Use Olumi's reading, or Keep the original. Neither is chosen until they choose (PL-661: an
  // unanswered reading is not a refusal, and is never sent as one). An explicit Keep is the refusal core needs to settle a reading carried from
  // an earlier message (PL-629, approval.ts `carriedSettled`): it once never left the page, so every approval of such a proposal was a 409
  // (acceptance run, 13 Nov 15:03Z). One left unanswered core names in its own words.
  const [choice, setChoice] = useState<Readonly<Record<string, 'use' | 'keep'>>>({})
  const onlyReadings = readingIds.flatMap((id) => (choice[id] === 'use' ? [id] : []))
  const refuseReadings = readingIds.flatMap((id) => (choice[id] === 'keep' ? [id] : []))
  const you = useViewStore((s) => s.view?.you ?? null)
  // PL-1083 (3): where core serves the same explanation under every reading (its `title`), it is drawn once above them, so each row is its
  // own words and its two choices; a reading whose explanation differs keeps its own beneath it.
  const { sharedTitle, firstReading } = readingHeadingOf(p.marks, readingIds)
  // PL-1083 (1): the reading rows rest wholly above the pinned actions (./readingsRest.ts). THE RULE, one sentence: when the proposal is held,
  // and again whenever the box, a row or the actions change size (a resize, the dock opening, a font arriving, a label wrapping), the box is
  // scrolled the least that puts the rows whole above the actions, and not at all if they already are.
  // The person's own scrolling is never read or guessed at (three Codex reads, 13:33Z to 14:1xZ, each found a state in which a guess at
  // whose scroll it was left the rows under the actions for good): what they scroll to stands until the layout next changes, and a layout
  // change puts the rows back in view. That is the DL's order of 12:5xZ (the rows and the actions never rest under anything).
  const root = useRef<HTMLDivElement>(null)
  // Keyed on the marks as they are drawn (each reading's id at its own place), so rows that are replaced are watched again (Codex 13:50Z).
  const restKey = `${p.id}:${p.marks.map((m) => (m.reading !== undefined && readingIds.includes(m.reading.id) ? m.reading.id : '-')).join(',')}`
  useLayoutEffect(() => {
    const el = root.current, box = el?.closest<HTMLElement>('.ok-pinned') ?? null
    if (el === null || box === null || readingIds.length === 0) return
    const land = () => {
      // Contract 3: while the one-row review is closed, its rows are not on screen; nothing is placed and the box keeps its own height.
      if (el.closest<HTMLElement>('[data-testid="view-proposal-review"]')?.getAttribute('data-open') === 'false') { box.style.maxHeight = ''; return }
      // The rows rest above the WHOLE pinned foot (fcab51e6: the omission list, core's refusal and the press sit above the actions in it),
      // never only above the actions line, or a shown omission list would cover them. Older layouts without the foot: the actions.
      const foot = el.querySelector<HTMLElement>('[data-testid="view-proposal-foot"]') ?? el.querySelector<HTMLElement>('[data-testid="view-proposal-actions"]')
      if (foot === null) return
      // DL 12:5xZ (A): the box grows to hold every row and the actions (More ways and the thread yield, olumiLook.css); where the panel
      // cannot give that much it shrinks rather than run past the composer, and as many leading rows as fit are shown whole. Measured
      // afresh each time from the stylesheet's own cap, so the box is never left taller than the rows now need.
      box.style.maxHeight = ''
      // Contract 3 (Codex 15 Nov on the redesign): the review's row stays at the box's top as its header (sticky, olumiLook.css); the rows
      // rest below it, never behind it.
      // 17 Nov (the calm panel): the row now sits in the actions line at the foot, so nothing is held at the box's top.
      const head = null
      const first = readingsRest(box, el, foot, 8, head)
      if (first === null) return
      if (first.short > 0) box.style.maxHeight = `${Math.ceil(box.getBoundingClientRect().height + first.short)}px`
      const range = readingsRest(box, el, foot, 8, head)
      if (range === null) return
      const to = restTop(box.scrollTop, range, box.scrollHeight - box.clientHeight)
      if (to !== box.scrollTop) box.scrollTop = to
    }
    land()
    // Codex 13:33Z (2), 14:3xZ: every block of the step and of the proposal is watched (the rows, the actions, and what stands above,
    // between and below them: the step's words, the heading, the note, the list of changes), so whichever of them changes size, the rows
    // are placed again. The two wrappers are `display: contents` (olumiLook.css), so these blocks are the box's own layout. Contract 3: the
    // one-row review's wrapper and its open body are `display: contents` too, so its own blocks (the step's words; the heading's row sits in
    // the actions line, watched as the actions) are watched by themselves; a wrapper with no box of its own reports no size.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(land)
    if (observer !== null) {
      observer.observe(box)
      for (const part of Array.from(box.querySelectorAll('[data-testid="view-next-step"] > *, [data-testid="view-chat-proposal"] > *, [data-testid="view-proposal-review"] > *, [data-review-body] > *'))) observer.observe(part)
    }
    return () => { observer?.disconnect(); box.style.maxHeight = '' }
  }, [restKey, open]) // eslint-disable-line react-hooks/exhaustive-deps
  // What the last approval whose answer never came sent (a dropped connection or a server error: core's `uncertain`). It may have been saved,
  // so only the same selection is sent again. A write core refused, or one that never left the page, was not saved: the person may change the
  // choices and approve again.
  const unsure = useRef<string | null>(null)
  const [refused, setRefused] = useState(false)
  // What core said when it refused this card's own approval or set-aside (its words, verbatim), drawn IN the card beside the actions it answers
  // (015, 18 Nov: a refused selective approval was said under the message box, away from the ticked lines it was about). Said once: not under the composer too.
  const [said, setSaid] = useState<string | null>(null)
  const approve = (lines?: { only: string[]; only_top: string[]; without?: { id: string; concerns: string[] }[] }) => {
    const every = { only: changes.flatMap((c) => (c.top ? [] : [c.id])), only_top: changes.flatMap((c) => (c.top ? [c.id] : [])) }
    const withReadings = onlyReadings.length + refuseReadings.length > 0
    const body = withReadings ? { ...(lines ?? every), ...(onlyReadings.length > 0 ? { only_readings: onlyReadings } : {}), ...(refuseReadings.length > 0 ? { refuse_readings: refuseReadings } : {}) } : lines
    const sent = JSON.stringify(body ?? null)
    if (unsure.current !== null && unsure.current !== sent && (/"((only|refuse)_readings|without)"/.test(unsure.current) || withReadings || lines?.without !== undefined)) { setRefused(true); return }
    setRefused(false); setMissing([])
    // After it is saved the controls go back to the original: the screen then draws the View core returns, never what was chosen here.
    void act(() => writes.approve(p.id, p.base, body).then((answer) => { unsure.current = null; setChoice({}); noteSaved(answer) }, (e: unknown) => { if (e instanceof TeamApiError && e.uncertain) unsure.current = sent; setMissing(refusedNeedsOf(e)); throw e }), true, setSaid)
  }
  return (
    <div ref={root} className={`${typography.viewPanelBody} space-y-2`} data-testid="view-chat-proposal">
      {closed ? null : inRow ? (p.removed === null ? null : <div><span title={p.removed.title} data-view="proposal.removed.text">{p.removed.text}</span></div>)
        : <div><span className={`${typography.viewPanelHeading} text-text-header`} data-view="proposal.heading">{p.heading}</span>{p.on === '' ? null : <> · <span data-view="proposal.on">{p.on}</span></>}
        {p.removed === null ? null : <> <span title={p.removed.title} data-view="proposal.removed.text">{p.removed.text}</span></>}</div>}
      {/* Who asked and the evidence it rests on stay in view with the closed card: Approve is never offered without its basis. */}
      {from === null ? null : (
        <div className="text-text-light" data-testid="view-chat-proposal-from">
          {from.by === null ? null : <p>Asked by: <span data-view="proposal.from.by">{from.by}</span></p>}
          {from.text === null ? null : <p>From evidence: “<span data-testid="view-chat-proposal-from-evidence">{from.text}</span>”</p>}
        </div>
      )}
      {p.problem === null ? null : <p role="alert" data-view="proposal.problem">{p.problem}</p>}
      {readingIds.length === 0 || closed ? null : <p className="text-text-light" data-testid="view-readings-note">{READINGS_NOTE}</p>}
      {closed ? null : p.marks.map((m, j) => {
        const words = <><span data-view={`proposal.marks.${j}.what`}>{m.what}</span>: <span data-view={`proposal.marks.${j}.status`}>{m.status}</span></>
        const id = m.reading?.id
        if (id === undefined || !readingIds.includes(id)) return <p key={j} title={m.title}>{words}</p>
        const shared = sharedTitle !== null && j === firstReading
          ? <p key={`t${j}`} className="m-0 text-text-light" data-testid="view-readings-title" data-view={`proposal.marks.${j}.title`}>{sharedTitle}</p> : null
        const choose = (on: boolean) => { setRefused(false); setChoice((c) => ({ ...c, [id]: on ? 'use' : 'keep' })) }
        const option = (on: boolean) => (
          <label className="inline-flex min-h-[24px] cursor-pointer items-center gap-1">
            <input type="radio" name={`view-reading-${p.id}-${j}`} checked={choice[id] === (on ? 'use' : 'keep')} disabled={busy} onChange={() => choose(on)} data-testid={`view-reading-${j}-${on ? 'use' : 'keep'}`} />
            {on ? actions.use : actions.keep}
          </label>
        )
        return (
          [shared, <fieldset key={j} className="m-0 grid min-w-0 gap-1 border-0 p-0" data-testid={`view-reading-${j}`} data-reading-row="">
            <legend className="p-0">{words}</legend>
            {m.title === '' || sharedTitle !== null ? null : <p className="m-0 text-text-light" data-view={`proposal.marks.${j}.title`}>{m.title}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1">{option(false)}{option(true)}</div>
          </fieldset>]
        )
      })}
      {changes.length === 0 || closed ? null : shownGroups === null
        ? <ul className="m-0 grid list-none gap-1 p-0" data-testid="view-changes">{(read === null ? changes.map((_, i) => i) : read.lines).map(line)}</ul>
        : (
          <ul className="m-0 grid list-none gap-1 p-0" data-testid="view-changes">
            {shownGroups.map((g, gi) => {
              const all = g.lines.length > 0 && g.lines.every((i) => changes[i] !== undefined && ticked.has(keyOf(changes[i]!)))
              // Some but not all of its lines are ticked (a line ticked inside it, or pulled in as another line's partner while the group is closed): the
              // box shows the mixed state, so a closed group never hides that part of it is chosen.
              const part = !all && g.lines.some((i) => changes[i] !== undefined && ticked.has(keyOf(changes[i]!)))
              return (
                <li key={gi}>
                  {/* Closed at rest, a group opens on press (DL 11 Nov, replacing PL 7 Nov's open groups: 36 lines filled the panel). The heading
                      is core's, with its count and whose they are; Approve still approves every line, ticked or not, and a group's tick chooses it whole. */}
                  <details data-testid={`view-change-group-box-${gi}`}>
                    <summary className="cursor-pointer">
                      <label className="mr-1 inline-flex min-h-[24px] min-w-[24px] cursor-pointer items-center justify-center align-middle" onClick={(e) => e.stopPropagation()} data-target-for={`view-change-group-${gi}`}>
                        <input type="checkbox" checked={all} ref={(el) => { if (el !== null) el.indeterminate = part }} data-group-part={part ? '' : undefined} disabled={busy} onClick={(e) => e.stopPropagation()} onChange={() => toggleGroup(g.lines, !all)}
                          aria-label={`Choose every change under ${g.heading}`} data-testid={`view-change-group-${gi}`} />
                      </label>
                      <span className="font-medium text-text-header" data-view={`${groupAt}.${gi}.heading`}>{g.heading}</span>
                    </summary>
                    <ul className="m-0 mt-1 grid list-none gap-1 p-0 pl-3">{g.lines.map(line)}</ul>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      {/* Core's one sentence for the person's own points the proposal only notes (`to_read.noted.text`), and the fold of their lines (chrome words). */}
      {changes.length === 0 || closed || read?.noted == null ? null : (
        <div className="grid gap-1" data-testid="view-noted">
          <p className="m-0 text-text-light"><span data-view="proposal.to_read.noted.text">{read.noted.text}</span>
            {notedHeld ? null : <> <button type="button" aria-expanded={notedOpen} onClick={() => setShowNoted((o) => !o)} className="rounded-sm text-text-body underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info" data-testid="view-noted-show-all">{notedOpen ? NOTED_SHOW_FEWER : NOTED_SHOW_ALL}</button></>}</p>
          {notedOpen ? <ul className="m-0 grid list-none gap-1 p-0" data-testid="view-noted-lines">{read.noted.lines.map(line)}</ul> : null}
        </div>
      )}
      {/* V11 change 6: core's verdict on the change, before any approval (./verdict.ts). Not supported: core's words, what would support it,
          and no Approve; the person may still set it aside. */}
      {verdict === undefined || (closed && verdict.supported) ? null : (
        <div className="grid gap-1" data-testid="view-proposal-verdict" data-supported={verdict.supported}>
          <p className={verdict.supported ? 'text-text-body' : 'font-medium text-text-header'}>{verdict.text}</p>
          {verdict.asks === null ? null : <p className="text-text-light" data-testid="view-proposal-verdict-asks">{verdict.asks}</p>}
        </div>
      )}
      {readingIds.length === 0 || verdict?.supported === false || closed ? null : (
        <p className="text-text-light" data-testid="view-readings-approve-says">
          {/* PL-1083 (2): no sentence here says what Approve keeps or uses: core may refuse an approval that leaves a reading's companions
              without it (409, 12:08Z click-through), and the View does not say which lines go with which reading, so any such claim could be
              false. Core's own words say it when it refuses. */}
          Approving records {you === null || you === '' ? 'you' : you} as the person who approved, never as the author of what Olumi read or proposed.
        </p>
      )}
      {refused ? <p role="alert" data-testid="view-readings-refused">{READINGS_CHANGED}</p> : null}
      {/* The foot of the card, kept in view however long the list (olumiLook.css `.ok-actions-foot`): what Approve ticked will leave off, core's refusal and the
          actions, together, so nothing the approval states is ever scrolled out of sight while its button is in view (Codex root 22:08Z). */}
      <div className="ok-actions-foot space-y-2" data-testid="view-proposal-foot">
      {/* Every omission the approval would state, said beside the controls that send it and outside any group (Codex root 22:08Z: a group ticked while
          closed hid the per-line note, so Approve ticked could send a choice the person never saw). Core's text of each kept line and each left-off link. */}
      {closed || !tickable || without.length === 0 ? null : (
        <div className="text-text-light" data-testid="view-proposal-leave-off">
          <p className="m-0">{WILL_LEAVE_OFF}</p>
          <ul className="m-0 grid list-none gap-0.5 p-0 pl-3">
            {without.flatMap((w) => w.concerns.map((id) => <li key={`${w.id}>${id}`} data-leave-off={`${w.id}>${id}`}>{records.get(w.id)?.text} · {LEAVE_OFF_SEP} {records.get(id)?.text}</li>))}
          </ul>
        </div>
      )}
      {said === null ? null : <p role="alert" data-testid="view-proposal-said">{said}</p>}
      {/* Core's refusal named lines by id: they are marked in the list, and ONE press of the person's ticks the required ones (with what those need). */}
      {closed || !missing.some((n) => pressable(n)) ? null : (
        <button type="button" disabled={busy} className={VIEW_CHIP_CLASS} data-testid="view-tick-needed" onClick={() => { const add = missing.flatMap((n) => (pressable(n) ? withPartners(records.get(n.id)!) : [])); setMissing([]); setTicked((t) => { const n = new Set(t); set(n, add, true); return settle(n) }) }}>{TICK_NEEDED}</button>
      )}
      {/* DL-538: the actions stay in view at the card's foot however long its list (olumiLook.css). PANEL-SPEC 1: one filled button, the others
          quiet text links. With the review closed, Approve is in view at rest; where it waits on the person's choice of Olumi's readings, or core does
          not support the change, the filled button opens the review instead (nothing is approved blind). */}
      {/* Closed, the one-row strip stays ONE line (calm panel, 17 Nov). Open, the line wraps (D3, olumiLook.css): Approve ticked joins the controls, and kept on
          one line they squeezed core's heading to a ~47 px column, eight lines tall at 1128x680 @1.33, so the sticky foot grew to 126 px and covered the
          review's last group heading (UI lead's probe 19 Nov). Wrapped, the heading keeps its 12rem basis and the controls take the line below. */}
      <div className={`ok-actions flex ${lead === undefined || !closed ? 'flex-wrap' : 'flex-nowrap'} items-center gap-x-2 gap-y-0`} data-testid="view-proposal-actions">
        {lead}
        {closed && (readingIds.length > 0 || verdict?.supported === false || heldTicks)
          ? (onOpen === undefined ? null : <button type="button" disabled={busy} className={VIEW_CHIP_PRIMARY_CLASS} data-testid="view-review-changes" onClick={onOpen}>{REVIEW_CHANGES}</button>)
          : verdict?.supported === false ? null : followsTicks ? approveTicked : approveWhole}
        {closed || verdict?.supported === false ? null : followsTicks ? approveWhole : approveTicked}
        {/* Set aside sends the readings the person chose to keep the original for (core's discard contract, approval.ts: a reading carried from
            an earlier message is settled only by an explicit refusal, else core answers 409). */}
        {/* Not on a closed card while Olumi's readings wait (Line reviewer F4): core refuses a set-aside that leaves a carried reading unsettled
            (approval.ts carriedSettled, 409), so the choice is made in the open review first, where Keep the original is sent with it. */}
        {closed && readingIds.length > 0 ? null : <OkIconButton id="set-aside" tone="ghost" words="Set aside" disabled={busy} testid="view-set-aside" onClick={() => void act(() => writes.discard(p.id, refuseReadings), false, setSaid)} />}
      </div>
      </div>
    </div>
  )
}
