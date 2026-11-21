/**
 * The Olumi tab on the olumi-core lane, drawn from the View (olumi.view/2) and writing straight to core (View API design §2): the
 * conversation exactly as core wrote it and the change card for a proposal Olumi holds (`ViewChat`), and the composer, which the dock's
 * footer holds (`ViewComposer`). Every word is core's; each drawn View string carries `data-view`, the path to the string it shows.
 *
 * Before core holds the scenario, or after its first draft was set aside, the composer takes the brief, which starts it
 * (`startScenario`). One write at a time. After a write the View, and the team's read (which moves the canvas to a newly approved
 * model), are read again. A write that fails keeps what was typed and says core's own words; one whose answer never came may have been
 * saved, and is sent again only with the same op id, so core saves it once. What was typed and its op ids live in `useViewChat`, so
 * closing the dock loses neither (review 00052).
 */
import { create } from 'zustand'
import { FindingLine } from './FindingLine'
import { useFindingSurface } from './findingSurface'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { call, newOp, READ_FAILED, TeamApiError, UNCERTAIN_WRITE } from '../olumiCore/team/api'
import { registerDockedOlumiFocus } from '../canvas/conversation/dockedOlumiFocus'
import { writes, VIEW_SHAPE_CHANGED, type DraftAccepted, type FigureFirstShown, type View, type ViewTurn } from './client'
import { verdictOf } from './verdict'
import { toReadOf } from './toRead'
import { useViewStore } from './store'
import { usePreMortemGate, useViewLens } from './lens'
import { chatQuestionsOf, isFirstLook, readingHeadingOf, figureFirstOf, nextCardsOf, olumiKey, optionInFocusOf, restingRingOf, sessionOf, type Session } from './layout'
import { derivedUuidOf } from '../olumiCore/team/sid'
import { isForThisPage, useMe } from '../olumiCore/me'
import { useCanvasStore } from '../canvas/store'
import { setCurrentScenarioId } from '../canvas/store/scenarios'
import { scenarioIdWrite } from '../canvas/stores/unboundModelBinding'
import { ThinkingIndicator } from '../canvas/conversation/zones/ThinkingIndicator'
import { typography } from '../styles/typography'
import { controls } from '../styles/controls'
import { useGuidanceStore, withOlumiReveal } from '../canvas/stores/guidanceStore'
import { takeAskTargetBinding } from '../canvas/ui/inspector-v2/askTargetBinding'
import { focusNodeById } from '../canvas/utils/focusHelpers'
import { armedIntent } from './armedIntent'
import { useEscapeFloor, useEscapeLayer } from './v12/edit/escapeLayers'
import type { AIInputBarProps } from '../canvas/components/AIInputBar'
import { useBriefDocumentUpload } from '../canvas/components/BriefDocumentUpload'
import { useUIStore } from '../stores/uiStore'
import { revealOlumiSurface } from '../canvas/conversation/revealOlumi'
import { FigureEdit } from './FigureEdit'
import { readingsRest, restTop } from './readingsRest'
import { V10_METHODS, withMethodPrefix } from '../presentation/V10MethodChips'
import { endRing, pointRing, restRing } from './ring'
import { Button } from '../components/ui/Button'
import { storiesHeadingOf, storiesOf } from './k5'
import { FIGURE_FIRST_CLOSED, FigureFirstEntryPanel, FigureFirstShownPanel, FigureFirstSideBySide, useFigureFirst } from './ViewFigureFirst'
import { noteSaved, noticeWords, useModelNotice } from './notice'
import { VIEW_CHIP_CLASS, VIEW_CHIP_PRIMARY_CLASS } from '../v5/blocks/chipClass'
import styles from '../canvas/conversation/Conversation.module.css'
import './look/olumiLook.css'
import { earlyOf, drawnLeadOf, floorShown, leadNotHeldOf, onFloor, entriesOf, pressOf, threadRows, type FloorTurn } from './early'
import { askFieldOf, pressFieldOf, pressHeading, pressKindFor, type PressKind, type TurnPress } from './press'
import { ReplyLead } from './v12/chat/ReplyLead'
import { KeepChooser } from './v12/chat/KeepChooser'
import { EarlyAnswer } from './EarlyAnswer'
import { ResultReceipts, hasReceipts } from './ResultReceipts'
import { SinceVersion } from '../olumiCore/compare'
import { ActionsMenu } from './v12/actionsMenu'
import { FIGURE_FIRST_ID, isRealMove, menuOf, nextStepFor, type NextStep as V12NextStep, type ToolId } from './v12/actions'
import { KeepIdea } from './v12/KeepIdea'
import { CommitFormFoot, CommitFormSlot, RecordStepButton, closeUntouchedCommit, useSavedExpectationCount } from './v12/team/CommitForm'
import { EXPECTATION_WORDS } from './v12/learning/ExpectationEntry'
import { answerQuestion } from './reasoning/answer'
import { approachOf, approachesOf, floorEntryOf, ideaTextOf, keptIdeasOf, isCoachedReply } from './v12/ideas'
import { aboutCardsOf } from './v12/chat/AboutChip'
import { ReplyFacts } from './v12/chat/ReplyFacts'
import { NotHeldItems, NotHeldLine, notHeldOf } from './v12/chat/NotHeld'
import { Hover, HoverButton } from './look/Hover'
import { useAnchoredTip } from './look/Tip'
import { OlumiAsks } from './v12/chat/OlumiAsks'
import { IntakeSheet, intakeOf } from './v12/chat/IntakeSheet'
import { ShowInWorkspace } from './v12/showInWorkspace/ShowInWorkspace'
import { ICONS, OkIcon, OkIconButton } from './look/icons'
import { FoldChevron } from './look/FoldChevron'
import { SelectionPill } from '../canvas/components/SelectionPill'
import { selectedKindMark, selectedRename, useDetailsOpenFor } from './SelectedRename'
import { methodOfSaid, MethodMark } from './v12/chat/MethodChip'
import { KeptIdeas } from './v12/chat/KeptIdeas'
import { ChatFootRow } from './v12/chat/ChatFootRow'
import { CatchUp } from './v12/journey/CatchUp'
import { ITEM_MARK, LEAD_IN, richText } from './v12/chat/richText'
import { firstAnswerOf, replyLineOf, type FirstAnswerLines, type ReplyLine } from './v12/chat/replyLabels'
import { useBriefPanelLeft } from './BriefPanel'
import { CHAT_POPOUT_LABEL, CHAT_POPOUT_TITLE, ChatDockBack, ChatFloatHost, popOutChat, useChatFloat } from './port/ChatFloat'

/*
 * The panel wears DGAI's own conversation look (DL, 4 Nov: Paul's original UI, staging #/canvas): the person's words in the panel-filled
 * bubble and Olumi's reply unframed (Conversation.module.css), the acts as the conversation's chips (chipClass), and the composer as
 * AIInputBar's footer box: the text, then a row of quiet icons and the round send. Only the look is DGAI's; every word and act is the
 * View's, as before.
 */

type Said = NonNullable<ViewTurn['answer']>['answer']

/** How many cites core put in one block of a reply. */
const citesIn = (parts: Said) => parts.flatMap((p) => ('cite' in p ? [p] : [])).length

/**
 * One block of a reply, in core's parts. Each cite is numbered by its place in the reply (`first` is this block's first number), with core's
 * cite as its hover, verbatim (R5, the look check: a "◦" read as a stray dot). The number is a position, never a word of the UI's own.
 */
export function Words({ parts, at, first = 1 }: { parts: Said; at: string; first?: number }) {
  let n = first
  return (
    <>
      {parts.map((p, i) => ('cite' in p
        ? <Hover key={i} as="sup" words={p.cite} className={typography.viewPanelMeta} data-view-cite={`${at}.${i}.cite`} aria-label={p.cite}>{n++}</Hover>
        : <span key={i} data-view={`${at}.${i}.text`}>{p.text}</span>))}
    </>
  )
}

/**
 * A reply's answer in core's own layout (ORDER-UI-NEXT, 13 Nov: the first reply on #/scenario drew as one wall of text). Core's text keeps its
 * line breaks: a blank line is a new paragraph, a line that starts "- " is a list item (drawn as a bullet, the "- " marker dropped), any other
 * line break stays a line break. Words verbatim and in order; citation markers exactly as `Words` draws them, numbered in the same order.
 * Each part keeps its `data-view`; a part split across lines carries `.text` on its first piece and `.text.<k>` on the rest.
 */
type Piece = { kind: 'text'; i: number; k: number; s: string } | { kind: 'cite'; i: number; cite: string }
/** How many list items of a long reply show at rest (contract §2: a lead, then at most three bullets; the rest behind one press). */
export const REST_ITEMS = 3
/** The panel's one 18 px line (contract §2): a newest reply's opening paragraph, only when it is one short sentence's length. */
export const LEAD_WORDS = 20
export const SHOW_WHOLE_FIRST = 'Show the whole first answer'
export const SHOW_WHOLE_REPLY = 'Show the whole reply'
export const SHOW_LESS = 'Show less'
/** A drawn line's plain words (its list marker dropped, whitespace squashed), for `everyLine`; null where it holds a cite (no prose entry does). */
const lineWords = (l: readonly Piece[]): string | null =>
  l.some((x) => x.kind === 'cite') ? null : l.map((x) => (x.kind === 'text' ? x.s : '')).join('').replace(ITEM_MARK, '').replace(/\s+/g, ' ').trim() || null
export function Blocks({ parts, at, first = 1, item, everyLine = false, fold = false, lines: coreLines = null, lead: big = false, under }: { parts: Said; at: string; first?: number; /** A first draft's reply that has a lead: what is drawn FIRST, in the authority position, given the check's own blocks under core's heading to fold (null where the reply ends at the first answer). The first answer follows it as earlier material: core's label, its opening at rest, its later detail one press away. */ under?: (check: ReactNode | null) => ReactNode; /** `item` is offered on a paragraph's lines too, not only a list's (a floor reply: core offers each line of Olumi's prose, words-start CONTRACT 4). */ everyLine?: boolean; /** Core's own label and check heading for this reply (`answer.first_answer`); null: no such lines. */ lines?: FirstAnswerLines | null; /** V12: drawn under a list line, given that line's words when it is plain words (a method reply's own approaches, each kept on its own). */ item?: (words: string) => ReactNode; /** sx-panel (PANEL-SPEC 2): a long reply shows its opening (core's label, if any, then its first paragraph and the first three items of a list that follows it), then one press for the rest; a first draft's check (core's heading line) and all after it always show. Off unless asked (the conversation asks). */ fold?: boolean; /** The newest reply: its opening paragraph is the panel's one 18 px line when it is {@link LEAD_WORDS} words or fewer. */ lead?: boolean }) {
  const [whole, setWhole] = useState(false)
  const lines: Piece[][] = [[]]
  parts.forEach((p, i) => {
    if ('cite' in p) { lines[lines.length - 1]!.push({ kind: 'cite', i, cite: p.cite }); return }
    p.text.split('\n').forEach((s, k) => { if (k > 0) lines.push([]); if (s !== '') lines[lines.length - 1]!.push({ kind: 'text', i, k, s }) })
  })
  // Each cite keeps its number by its place in core's parts, whether or not the blocks before it are folded away (a fold never renumbers).
  const citeNo = new Map<number, number>()
  parts.forEach((p, i) => { if ('cite' in p) citeNo.set(i, first + citeNo.size) })
  // `strip`: the line's own marker, which is layout, not words: a list line's "- ", or a lead-in's two to six hashes (LEAD_IN).
  const draw = (line: Piece[], strip: RegExp | null) => line.map((x, j) => {
    if (x.kind === 'cite') return <Hover key={j} as="sup" words={x.cite} className={typography.viewPanelMeta} data-view-cite={`${at}.${x.i}.cite`} aria-label={x.cite}>{citeNo.get(x.i)}</Hover>
    const s = strip !== null && j === 0 ? x.s.replace(strip, '') : x.s
    return <span key={j} data-view={x.k === 0 ? `${at}.${x.i}.text` : `${at}.${x.i}.text.${x.k}`}>{richText(s)}</span>
  })
  const isItem = (line: Piece[]) => line[0]?.kind === 'text' && ITEM_MARK.test(line[0].s)
  // A line core opens with two to six hashes and a space is a lead-in (the reply contract keeps core's markers, 17 Nov): drawn as a quiet heading,
  // the hashes dropped. One hash, or seven, is words, drawn as typed.
  const isLeadIn = (line: Piece[]) => line[0]?.kind === 'text' && LEAD_IN.test(line[0].s)
  // Group: blank lines end a paragraph; consecutive "- " lines make one list; a lead-in stands alone.
  const groups: { list: boolean; leadIn?: boolean; lines: Piece[][] }[] = []
  let breakBefore = true
  for (const line of lines) {
    if (line.length === 0) { breakBefore = true; continue }
    if (isLeadIn(line)) { groups.push({ list: false, leadIn: true, lines: [line] }); breakBefore = true; continue }
    const list = isItem(line), last = groups[groups.length - 1]
    if (!breakBefore && last && !last.leadIn && last.list === list) last.lines.push(line); else groups.push({ list, lines: [line] })
    breakBefore = false
  }
  // How long the reply reads, in lines of the panel (about 44 characters to a line at 12 px): an estimate, never a measure.
  const chars = (l: Piece[]) => l.reduce((n, x) => n + (x.kind === 'text' ? x.s.length : 2), 0)
  const linesIn = (gs: typeof groups) => gs.reduce((n, g) => n + g.lines.reduce((m, l) => m + Math.max(1, Math.ceil(chars(l) / 44)), 0), 0)
  // Core's own label and heading lines, by the words core sent on this turn (replyLabels.ts): drawn apart from the prose, and the label is not
  // counted as one of the two folded blocks.
  const lineOf = (g: { list: boolean; leadIn?: boolean; lines: Piece[][] }): ReplyLine => {
    if (g.list || g.leadIn || g.lines.length !== 1) return null
    const only = g.lines[0]!
    return only.every((x) => x.kind === 'text') ? replyLineOf(only.map((x) => (x.kind === 'text' ? x.s : '')).join(''), coreLines) : null
  }
  const lead = groups.length > 0 && lineOf(groups[0]!) === 'label' ? 1 : 0
  // Olumi's check against the model (core's heading line) and everything after it always show: the fold hides only the first answer's later
  // detail, never the model's check or correction of it (Codex, 16 Nov: a folded reply could show the unverified claim and hide its correction).
  const check = groups.findIndex((g) => lineOf(g) === 'heading')
  const head = check === -1 ? groups.length : check
  // What shows at rest, by group: core's label; the opening (a paragraph whole, or the first three items of a list it opens with); after an
  // opening paragraph, the first three items of a list that follows it. Whole groups and whole list items only: no sentence is ever cut.
  const rest = new Map<number, number>()
  for (let gi = 0; gi < lead; gi++) rest.set(gi, groups[gi]!.lines.length)
  // A lead-in over the opening stays with it (it names what follows).
  let o = lead
  while (o < head && groups[o]!.leadIn) { rest.set(o, 1); o++ }
  const opening = o < head ? groups[o]! : null
  if (opening !== null) {
    rest.set(o, opening.list ? Math.min(REST_ITEMS, opening.lines.length) : opening.lines.length)
    const then = o + 1 < head ? groups[o + 1]! : null
    if (!opening.list && then !== null && then.list) rest.set(o + 1, Math.min(REST_ITEMS, then.lines.length))
  }
  const hides = groups.slice(0, head).some((g, gi) => (rest.get(gi) ?? 0) < g.lines.length)
  // With `under`, the check is drawn short by its lead, so only the first answer's own length decides whether its later detail folds.
  const est = linesIn(under === undefined ? groups : groups.slice(0, head))
  const foldable = fold && hides && est > 8
  const folded = foldable && !whole
  const textOf = (g: { lines: Piece[][] }) => g.lines.flatMap((l) => l.map((x) => (x.kind === 'text' ? x.s : ''))).join(' ')
  // The panel's one 18 px line (contract §2): the newest reply's opening paragraph, only when it is one short sentence's length. Never a paragraph under
  // core's first-answer label (`lead`: the reply opens with that label): core marks that answer as the earlier one, so it is not the panel's largest
  // words above its own check, with or without a lead (a reply stored before leads existed has the label and none). By core's label line, no words read.
  const bigLead = big && lead === 0 && opening !== null && !opening.list && textOf(opening).trim().split(/\s+/).length <= LEAD_WORDS
  const groupEl = (g: { list: boolean; leadIn?: boolean; lines: Piece[][] }, gi: number) => {
    const shown = folded && gi < head ? rest.get(gi) ?? 0 : g.lines.length
    if (shown === 0) return null
    const open = gi === o && opening !== null ? { 'data-reply-opening': '' } : {}
    if (g.leadIn) return <p key={gi} className={`m-0 mt-2 ${typography.viewPanelHeading} text-text-header`} data-reply-lead-in="">{draw(g.lines[0]!, LEAD_IN)}</p>
    return lineOf(g) === 'label'
      ? <p key={gi} className={`m-0 ${typography.viewPanelMeta} text-text-light`} data-reply-label="">{g.lines[0]!.map((x) => (x.kind === 'text' ? x.s : '')).join('')}</p>
      : lineOf(g) === 'heading'
      ? <p key={gi} className={`m-0 mt-2 ${typography.viewPanelHeading} text-text-header`} data-reply-heading="">{g.lines[0]!.map((x) => (x.kind === 'text' ? x.s : '')).join('')}</p>
      : (g.list
      ? <ul key={gi} className="m-0 !list-none !pl-3" data-reply-list="" {...open}>{g.lines.slice(0, shown).map((l, li) => { const w = item === undefined ? null : everyLine ? lineWords(l) : approachOf(l.map((x) => (x.kind === 'cite' ? { cite: x.cite } : { text: x.s }))); return <li key={li} className="group/item relative !mb-1 last:!mb-0 before:absolute before:-left-3 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:!bg-text-light before:content-['']">{draw(l, ITEM_MARK)}{w === null ? null : item!(w)}</li> })}</ul>
      : <p key={gi} className={bigLead && gi === o ? `m-0 ${typography.viewPanelHeadline} text-text-header` : 'm-0'} data-reply-para="" {...open}>{g.lines.map((l, li) => { const w = item === undefined || !everyLine ? null : lineWords(l); return <span key={li} className={w === null ? undefined : 'group/item'}>{li > 0 ? <br /> : null}{draw(l, null)}{w === null ? null : item!(w)}</span> })}</p>)
  }
  return (
    <>
      {/* The CURRENT answer has the authority position (Codex 19:46:53Z, after replay 012: a first answer later found wrong stood large above its
          own correction). With `under`, the caller's lead and the check it folds are drawn FIRST; the first answer follows as earlier material
          under core's own label. Core's check heading opens the folded check; nothing is said twice. */}
      {/* (A heading core sent with nothing after it labels nothing: there is no check to fold, so no fold is drawn for it.) */}
      {under === undefined ? null : under(check === -1 || check + 1 >= groups.length ? null : <>{groups.slice(check).map((g, gi) => groupEl(g, check + gi))}</>)}
      {groups.slice(0, head).map((g, gi) => groupEl(g, gi))}
      {foldable
        ? <button type="button" aria-expanded={!folded} data-testid="view-reply-fold" onClick={() => setWhole(!whole)}
            className={`${typography.viewPanelHeading} inline-flex min-h-[24px] items-center gap-1 self-start text-text-light hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>{folded ? (coreLines === null ? SHOW_WHOLE_REPLY : SHOW_WHOLE_FIRST) : SHOW_LESS}<FoldChevron open={!folded} /></button>
        : null}
      {under === undefined ? groups.slice(head).map((g, gi) => groupEl(g, head + gi)) : null}
    </>
  )
}

/**
 * K5 "If it failed" (R3): the pre-mortem's stories on the reply they came with, under core's heading, each marked Olumi's with the key's
 * own Olumi glyph (`model.key`); the option a story is about and the cards it rests on as label: value lines, in each card's own heading.
 * Every word is core's (./k5.ts, ahead of core); a record that is not a card on the canvas is not named, and nothing is drawn without stories.
 */
function Stories({ answer, at }: { answer: NonNullable<ViewTurn['answer']>; at: string }) {
  const model = useViewStore((s) => s.view?.model ?? null)
  const stories = storiesOf(answer), heading = storiesHeadingOf(answer)
  if (stories.length === 0 || heading === null) return null
  // Core's key item for Olumi by its id (`olumi`), never its words (DL 4 Nov, R4): the one matcher, layout.ts olumiKey.
  const olumi = model === null ? null : olumiKey(model)
  const headingOf = (id: string) => model?.cards.find((c) => c.id === id)?.heading ?? null
  return (
    <section data-testid="view-chat-stories" aria-label={heading}>
      <p className={`${typography.viewPanelHeading} text-text-header`} data-view={`${at}.answer.stories_heading`}>{heading}</p>
      <ol className="space-y-2">
        {stories.map((st, i) => {
          const option = st.option === null ? null : headingOf(st.option)
          const rests = st.rests_on.flatMap((id) => { const h = headingOf(id); return h === null ? [] : [h] })
          return (
            <li key={i} data-story={i}>
              <p>{olumi === null ? null : <Hover words={olumi.text} className="text-info" aria-label={olumi.text} data-story-mark="">{olumi.glyph} </Hover>}<span data-view={`${at}.answer.stories.${i}.text`}>{st.text}</span></p>
              {option === null ? null : <p className={`${typography.chatMeta} text-text-light`} data-story-option="">Option: <span>{option}</span></p>}
              {rests.length === 0 ? null : <p className={`${typography.chatMeta} text-text-light`} data-story-rests="">Rests on: <span>{rests.join(', ')}</span></p>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

const NO_CARDS: readonly string[] = []

/** The label of a pressed ask (core's typed ask 'challenge' or 'method'): the registry's own words for the mark, what the person did, never the question the page drafted for it.
 *  One mark for both: 'challenge' covers four methods and core's entry does not say which. */
export const PRESSED_WORDS = ICONS['method-mark'].hover

/** Keep authorship before the reply (UI recovery witness row 11, DL 10 Nov). */
/** A message sent by a press on the canvas (typed fields 13b): core's label, then the pressed card's heading where the reader's model has it.
 *  Never `said` as words the person typed. */
function PressedLine({ press, at }: { press: TurnPress; at: string }): JSX.Element {
  const view = useViewStore((st) => st.view)
  const heading = pressHeading(press, view)
  return (
    <p className={typography.viewPanelBody} data-testid="view-chat-press" data-press={press.kind} data-press-card={press.card ?? undefined}>
      <span data-view={`${at}.press.label`}>{press.label}</span>{heading === null ? null : <> · <span data-view={`${at}.press.card`}>{heading}</span></>}
    </p>
  )
}

function Turn({ t, at, latest = false, moves = false, primary = false, me, floor }: { t: ViewTurn; floor?: FloorTurn | null; at: string; latest?: boolean; moves?: boolean; /** The move tap is the filled primary button: only when no Approve / Set aside is pinned beside it (14 Nov). */ primary?: boolean; me?: string | null }) {
  // The cards this turn's next step lit are cleared if the turn leaves the page while they are lit (Codex review dgai-v10 00002 ledger).
  const about = t.answer === null ? NO_CARDS : nextCardsOf(t.answer.next)
  const gone = useViewChat((st) => st.gone ?? null)
  // Said once (S4, 19 Nov): where this reply's move is drawn as its own press, that press carries core's `next.label`; the bold label is not drawn beside it.
  const sidNow = useViewStore((st) => st.sid)
  const tapDrawn = t.answer !== null && moves && t.answer.next.newest && moveTapDrawn(sidNow, t.answer.next, gone === null ? false : sidNow !== null && gone === moveKey(sidNow, t.id, t.answer.next.move))
  const lit = useRef(false)
  useEffect(() => () => { if (lit.current) endRing() }, [])
  const ring = (on: boolean) => { lit.current = on; if (on) pointRing(about); else endRing() }
  // Coaching on its card (track 4 step 2): the newest reply's next step keeps the cards it names lit at rest (ring.ts). The card Olumi's
  // note is open on steps out, as a selected card does in ring.ts: one focus per screen. Keyed by value, so an equal reply rewrites nothing.
  const noted = useCanvasStore((st) => st.olumiAttention?.nodeIds?.[0] ?? null)
  const restKey = latest ? restingRingOf(about, noted === null ? NO_CARDS : [noted]).join('\u0000') : ''
  // Core API v1.29: Olumi's reply to this edit while it runs, or how it ended without one (the View's `reply`), in place of its answer.
  const reply = useViewStore((st) => (st.view?.reply != null && st.view.reply.proposal === t.id ? st.view.reply : null))
  useEffect(() => {
    if (!latest) return undefined
    restRing(restKey === '' ? NO_CARDS : restKey.split('\u0000'))
    return () => restRing(NO_CARDS)
  }, [latest, restKey])
  // DL-538 (the target panel): the bubble names whose words it holds, inside it (core's `by`): another person's name in ink, the viewer's own
  // quieter. A turn core names no one for has none.
  const other = me !== undefined && t.by_id !== null && t.by_id !== me
  const by = t.by_id === null || t.by === '' ? null : <p className={`ok-said-by ${typography.viewPanelMeta} ${other ? 'text-text-body' : 'text-text-light'}`} data-view={`${at}.by`} data-testid="view-said-by">{t.by}</p>
  const early = earlyOf(t)
  // The reply's short lead (core `answer.lead`, Paul 11:02Z): drawn first, and the whole answer as today (on a first draft, the kept first answer,
  // Olumi's initial reply and the check) folded under ONE "Full answer". No lead, or one that says all of it: drawn exactly as before.
  const lead = drawnLeadOf(t, floor)
  // V12 Create: an Olumi method reply (the person's turn is one of core's menu questions) can be kept as an idea, in Olumi's own words.
  // J1 (Codex 008/009a): any Olumi reply whose own list lines separate its routes offers each route to keep, before or after a model is approved;
  // a method reply with no such lines is kept whole.
  const keepSid = useViewStore((st) => (st.view !== null && t.answer !== null ? st.sid : null))
  // Codex 008e #3: any coached Olumi reply (an answer with a next step) can be kept whole, whatever the person typed; core refuses what it cannot keep.
  const coached = isCoachedReply(t)
  // Where core's reply separates its approaches (its own list lines, two or more), each is kept on its own; otherwise the reply is kept whole.
  const approaches = t.answer === null || keepSid === null ? [] : approachesOf(t.answer.answer)
  const idea = t.answer === null || keepSid === null || !coached || approaches.length > 0 ? null : (() => { const text = ideaTextOf(t.answer); return text === null ? null : { sid: keepSid, text } })()
  const keepEach = keepSid === null || approaches.length === 0 ? undefined : (words: string) => (approaches.includes(words) ? <KeepIdea sid={keepSid} turn={t.id} text={words} inline /> : null)
  // V12: the person's message is a method chip when it is, word for word, one of core's menu questions.
  const whole = useViewStore((st) => st.view)
  const method = methodOfSaid(whole, t.said)
  const aboutCards = t.answer === null ? [] : aboutCardsOf(whole, t.answer.next)
  // A question the page drafted that the person pressed (core's typed ask 'challenge' or 'method') is their act, not words they typed: drawn as chrome.
  // How it was asked: core's own `chat[].ask` (typed fields 13a) where it sends one, else the draft's conversation entry, as before.
  const asked = askFieldOf(t)
  const pressed = asked === 'challenge' || asked === 'method' ? asked : asked !== null ? null : pressOf(whole?.draft, t)
  const typed = pressFieldOf(t)
  const said = <div className={`${styles.messageBubbleUser} ok-said`} data-testid="view-chat-said-bubble">{by}{typed !== null ? <PressedLine press={typed} at={at} /> : pressed !== null
    ? <p className={`${typography.viewPanelBody} inline-flex items-center gap-1.5`} data-testid="view-chat-pressed" data-pressed={pressed}><OkIcon id="method-mark" size={14} decorative />{PRESSED_WORDS}</p>
    : <p className={typography.viewPanelBody} data-view={`${at}.said`}>{method === null ? null : <MethodMark id={method.id} />}{t.said}</p>}</div>
  // Olumi's reply carries Olumi's own mark (core's key item for Olumi, by its id: layout.ts olumiKey), in the margin beside its words.
  const model = useViewStore((st) => st.view?.model ?? null)
  const olumi = model === null ? null : olumiKey(model)
  // UI-BRIEF-20261115 step 2, answer first (Paul, 15 Nov: "so much text"): a reply leads with its answer, whole, as core wrote it
  // (paragraphs, lists, cites and conditions kept); its next step follows; the reasons (Why lines) sit behind the product's own "Why".
  // A reply with no Why line has no fold. Each cite is numbered by its place in the order the reply DRAWS it (answer, next step, Why lines).
  const leads = t.answer !== null && t.answer.why.length > 0
  const whyFirst: number[] = []
  let nextFirst = 1
  if (t.answer !== null) {
    nextFirst = 1 + citesIn(t.answer.answer)
    let k = nextFirst + citesIn(t.answer.next.text)
    for (let j = 0; j < t.answer.why.length; j++) { whyFirst[j] = k; k += citesIn(t.answer.why[j]!) }
  }
  const answer = t.answer === null ? (reply === null ? null : (
    <p role="status" aria-live="polite" className={`${typography.viewPanelMeta} ${reply.status === 'running' ? 'text-text-light' : 'text-text-body'}`} data-testid="view-chat-reply" data-reply={reply.status}><span data-view="reply.words">{reply.words}</span></p>
  )) : (
    <div className={`${typography.viewPanelBody} ok-reply space-y-3`} data-testid="view-chat-answer">
      {olumi === null ? null : <Hover words={olumi.text} className="ok-reply-mark" role="img" aria-label={olumi.text} data-view={`${at}.answer.mark`}>{olumi.glyph}</Hover>}
      <DegradedLine of={t} at={at} />
      {lead !== null && firstAnswerOf(t.answer) !== null
        // A first draft's reply with a lead. The CURRENT answer leads (Codex 19:46:53Z): core's lead first, as on any reply (the newest one's short
        // opening is the panel's large line), with the check folded under "Full answer". The first answer is kept beneath as earlier material under
        // core's own label ("written before the model. Not checked…"): its opening at rest, the rest one press away, never the large line, and
        // never folded out of reach (Codex 011: the practical answer had been hidden under the lead) and its own later detail one press away (progressive disclosure; merging with "Full answer" is a later restructure). No flag and no reading of its words.
        // Paul, 19 Nov ("buried behind repeated disclosures"; Codex: one expansion): the first answer is drawn whole under core's label, so its
        // finding and next steps read at rest; "Full answer" (the check) is the reply's one fold. No second "Show the whole first answer".
        ? <Blocks parts={t.answer.answer} at={`${at}.answer.answer`} item={keepEach} lines={firstAnswerOf(t.answer)}
            under={(checkBody) => {
              const folded = early === null && floor == null && checkBody === null ? null : <>
                {early === null ? null : <EarlyAnswer text={early} testid="view-chat-early" />}
                {floor == null ? null : <div data-floor-job={floor.job}><p className={typography.viewPanelMeta}>Olumi’s initial reply</p><EarlyAnswer text={floor.text} testid="view-floor-reply-text" bare /></div>}
                {checkBody}
              </>
              return <ReplyLead lead={lead} at={`${at}.answer`} big={latest && lead.opening.trim().split(/\s+/).length <= LEAD_WORDS}>{folded}</ReplyLead>
            }} />
        : lead !== null
        ? <ReplyLead lead={lead} at={`${at}.answer`} big={latest && lead.opening.trim().split(/\s+/).length <= LEAD_WORDS}>
            {early === null ? null : <EarlyAnswer text={early} testid="view-chat-early" />}
            {floor == null ? null : <div data-floor-job={floor.job}><p className={typography.viewPanelMeta}>Olumi’s initial reply</p><EarlyAnswer text={floor.text} testid="view-floor-reply-text" bare /></div>}
            <Blocks parts={t.answer.answer} at={`${at}.answer.answer`} item={keepEach} lines={firstAnswerOf(t.answer)} />
          </ReplyLead>
        : leads
        // Codex UI reviewer P1 (shared note 15:35:01Z, DL): a reply with no lead is drawn whole, never folded; only a valid lead's "Full answer" folds.
        ? <div data-reply-lead={at}><Blocks parts={t.answer.answer} at={`${at}.answer.answer`} item={keepEach} lines={firstAnswerOf(t.answer)} lead={latest} /></div>
        : <Blocks parts={t.answer.answer} at={`${at}.answer.answer`} item={keepEach} lines={firstAnswerOf(t.answer)} lead={latest} />}
      {/* v10: the cards this next step is about (core's `next.about`) are lit while it is pointed at; nothing else changes. */}
      {/* P2 (system spec): the reply's own next step is drawn ONCE, here, at the end of the reply; there is no second copy at the top of the panel. */}
      <p tabIndex={about.length ? 0 : undefined} data-testid="view-chat-next" onMouseEnter={() => ring(true)}
        onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) ring(false) }} onFocus={() => ring(true)} onBlur={() => ring(false)}>{tapDrawn ? null : <><span className={`${typography.viewPanelHeading} text-text-header${about.length > 0 && !(moves && t.answer.next.newest) ? ' sr-only' : ''}`} data-view={`${at}.answer.next.label`}>{t.answer.next.label}</span>{' '}</>}<Words parts={t.answer.next.text} at={`${at}.answer.next.text`} first={nextFirst} /></p>
      {tapDrawn ? <MoveTap turn={t.id} next={t.answer.next} primary={primary} at={`${at}.answer.next`} /> : null}
      <Stories answer={t.answer} at={at} />
    </div>
  )
  const waiting = whole?.proposal != null
  // P4 (system spec): the reply's facts are ONE compact grey icon row (ReplyFacts): the cards it is about, what it rests on and why (one disclosure), keep,
  // show in the workspace, and the version as its icon. Core's version and status words are the icon's hover and name (Tip), never drawn beside it.
  // Keyboard (Codex panel round 2): the wrapper is NOT a tab stop; the labelled icon inside it is the one stop, and its focus opens the Tip.
  // say3 (Paul 18 Nov, "nothing said twice"): while Olumi's proposal waits, the reply's status is its own and the foot says the proposal once; the icon keeps core's words.
  const stampWords = t.status === null ? t.version : `${t.version} · ${t.status}`
  const stamp = (
    <span className="inline-flex" data-testid="view-chat-version">
      <OkIcon id="version-tag" size={14} words={stampWords} decorative={false} testid={t.status === null || waiting ? 'view-chat-version-icon' : 'view-chat-status-icon'} />
    </span>
  )
  const heldNot = notHeldOf(t.not_held)
  const viewer = useViewStore((st) => st.view?.you ?? null)
  const tools = (
    <ReplyFacts at={at} about={aboutCards} held={heldNot === null ? null : <NotHeldItems n={heldNot} you={viewer} at={at} />} heldHeading={heldNot?.heading}
      rests={t.answer !== null && hasReceipts(t.answer.claims) ? <ResultReceipts claims={t.answer.claims} /> : null}
      why={t.answer === null || !leads ? null
        : <ul className="list-disc pl-4">{t.answer.why.map((w, j) => <li key={j}><Words parts={w} at={`${at}.answer.why.${j}`} first={whyFirst[j]} /></li>)}</ul>}>
      {idea === null ? null : <KeepIdea sid={idea.sid} turn={t.id} text={idea.text} />}
      {t.answer === null ? null : <ShowInWorkspace turn={t.id} next={t.answer.next} />}
      {stamp}
    </ReplyFacts>
  )
  return (
    <li data-view-turn={at} data-testid={latest ? 'view-chat-latest' : undefined} className="space-y-2">
      {said}
      {/* K1/K6 (core d903f2af, `chat[].receipt`): why code filled nothing in from this person's answer, served on their own turn only; one quiet line under their words, core's words verbatim. */}
      {t.receipt === undefined ? null : <p className={`${typography.viewPanelMeta} text-text-light m-0`} data-testid="view-receipt" data-receipt={t.receipt.why} data-view={`${at}.receipt`}>{t.receipt.words}</p>}
      {lead !== null || early === null ? null : <EarlyAnswer text={early} testid="view-chat-early" />}
      {lead !== null || floor == null ? null : <div data-floor-job={floor.job}><p className={typography.viewPanelMeta}>Olumi’s initial reply</p><EarlyAnswer text={floor.text} testid="view-floor-reply-text" bare /></div>}
      {answer}{heldNot === null ? null : <NotHeldLine n={heldNot} at={at} />}
      {/* K1: a lead that is not drawn (it repeats the answer) still says core's `lead.not_held`, under the whole answer, as the lead would have. */}
      {lead !== null || t.answer === null || leadNotHeldOf(t.answer) === null ? null : <p className={`${typography.viewPanelMeta} m-0 text-text-light`} data-testid="view-lead-not-held" data-view={`${at}.answer.lead.not_held`}>{leadNotHeldOf(t.answer)}</p>}
      {tools}
      {t.broke === null ? null : <p data-view={`${at}.broke`}>{t.broke}</p>}
      {t.problem === null ? null : <p role="alert" data-view={`${at}.problem`}>{t.problem}</p>}
      {t.answer === null && t.problem !== null && t.said !== '' ? <AskAgain words={t.said} /> : null}
      {t.marks.map((m, j) => <Hover key={j} as="p" words={m.title}><span data-view={`${at}.marks.${j}.what`}>{m.what}</span>: <span data-view={`${at}.marks.${j}.status`}>{m.status}</span></Hover>)}
    </li>
  )
}

/** The conversation, oldest first, as the View holds it. */
export function ViewTurns({ chat }: { chat: View['chat'] }) {
  return (
    <ol className={`${typography.viewPanelBody} space-y-6`} data-testid="view-chat-turns">
      {chat.map((t, i) => <Turn key={t.id} t={t} at={`chat.${i}`} />)}
    </ol>
  )
}

/** Preserve the conversation's sequence and paths (UI recovery witness row 11, DL 10 Nov). */
/**
 * DL journey (5): a message that failed and was sent again (Try again sends the same words) is one message in the thread: a saved row with
 * no answer and core's failure (`problem`) is drawn only when the next row is not the same person's same words. Matched by fields, never
 * by prose; the attempt that stands (the newest) keeps its own failure or its answer.
 */
export const retriedAt = (chat: View['chat'], i: number): boolean => {
  const t = chat[i], next = chat[i + 1]
  return t !== undefined && next !== undefined && t.answer === null && t.problem !== null && !!t.by_id && next.by_id === t.by_id && next.said === t.said
}
/** v10 review item 6/11: "Ask this again" on a message that got no answer. It copies that message's words into the composer's draft and sends nothing,
 *  writes nothing and calls no AI; the person reads them, edits if they wish, and sends. A draft already typed is kept: the words follow it. */
export const ASK_AGAIN = 'Ask this again'
export function askAgainDraft(typed: string, words: string): string { return typed.trim() === '' ? words : typed.includes(words) ? typed : `${typed}\n\n${words}` }
function AskAgain({ words }: { words: string }) {
  return (
    <OkIconButton id="retry" tone="ghost" words={ASK_AGAIN} testid="view-ask-again"
      onClick={() => { useViewChat.setState({ text: askAgainDraft(useViewChat.getState().text, words) }); document.getElementById('view-chat-text')?.focus() }} />
  )
}
/** Honest degradation (core `degraded`, optional on a chat turn and a floor entry; the vendored contract predates it; `chat[].status` is the version
 *  stamp's string): a reply that ran on less than it should have says so once, in core's own sentence, its short form on hover. */
function DegradedLine({ of, at }: { of: unknown; at: string }): JSX.Element | null {
  const d = (of as { degraded?: { text?: unknown; title?: unknown } | null }).degraded
  if (typeof d?.text !== 'string' || d.text === '') return null
  return <Hover as="p" words={typeof d.title === 'string' ? d.title : d.text} className={`${typography.viewPanelMeta} m-0 text-text-light`} data-view={`${at}.degraded.text`} data-testid="view-chat-turn-degraded">{d.text}</Hover>
}
/** One exchange of the model-less floor (`view.floor[i]`, 14 Nov): the person's words and Olumi's plain reply, drawn as an ordinary turn (no label,
 *  no model-grounded parts: there is no model). The words are core's, verbatim. */
function FloorLine({ f, me, latest }: { f: FloorTurn; me?: string | null; latest: boolean }) {
  const other = me !== undefined && me !== null && f.by_id !== '' && f.by_id !== me
  // Words-start CONTRACT 4 (Codex 04:16:02Z, root 04:22:35Z and 04:41:16Z): core offers what can be kept on this row (`prose`: each line of Olumi's
  // own prose, as served, one entry each). Each entry is offered on the line that draws it and kept VERBATIM (Codex root 05:32:34Z): no length
  // cap, no list rule, nothing read from the text (which also holds the host's lines). Core stays the only authority on what may be kept.
  const sid = useViewStore((st) => st.sid)
  const entries = sid === null ? [] : f.prose ?? []
  const keepEach = sid === null || entries.length === 0 ? undefined : (line: string) => {
    const entry = floorEntryOf(entries, line)
    // With a lead, the chooser beside it offers every entry (one control each); the fold's lines stay plain. Without one, each line offers its own.
    return entry === null || f.lead !== undefined ? null : <KeepIdea sid={sid} turn={f.job} text={entry} inline floor />
  }
  // A saved message whose reply failed or was lost (core `floor[].unanswered`): their words, then core's own sentence for that job as a quiet
  // line. No reply, no Keep and no Try again here: only the newest turn (`turn`) retries, and it is never also in the floor.
  const un = f.unanswered
  const text = <section className="space-y-2 text-left text-text-body" data-testid="view-floor-reply-text"><Blocks parts={[{ text: f.text }]} at={`floor.${f.job}.text`} item={keepEach} everyLine /></section>
  return (
    <li data-testid="view-floor-turn" data-floor-job={f.job} data-unanswered={un?.status} className="space-y-2">
      <div className={`${styles.messageBubbleUser} ok-said`} data-testid="view-floor-said-bubble" data-latest-floor={latest && un !== undefined && un.words === null ? '' : undefined}>
        {f.by === '' ? null : <p className={`ok-said-by ${typography.viewPanelMeta} ${other ? 'text-text-body' : 'text-text-light'}`} data-testid="view-said-by">{f.by}</p>}
        {f.press === undefined ? <p className={typography.viewPanelBody} data-testid="view-floor-said">{f.said}</p> : <PressedLine press={f.press} at={`floor.${f.job}`} />}
      </div>
      {/* Contract 3 (Codex 15 Nov): the newest floor exchange's marker is on Olumi's reply, so the thread rests on the reply's first line,
          never on a long brief drawn above it in the same exchange. */}
      {un !== undefined
        ? <>
            {un.words === null ? null : <p className={`${typography.viewPanelMeta} text-text-body`} data-testid="view-floor-unanswered" data-view={`floor.${f.job}.unanswered.words`} data-latest-floor={latest ? '' : undefined}>{un.words}</p>}
            {f.said === '' ? null : <AskAgain words={f.said} />}
          </>
        : <div className={`${typography.viewPanelBody} ok-reply space-y-3`} data-testid="view-floor-reply" data-latest-floor={latest ? '' : undefined}><DegradedLine of={f} at={`floor.${f.job}`} />{f.lead === undefined ? <>{text}{f.lead_not_held === undefined ? null : <p className={`${typography.viewPanelMeta} m-0 text-text-light`} data-testid="view-lead-not-held" data-view={`floor.${f.job}.lead.not_held`}>{f.lead_not_held}</p>}</>
          // The reply's short lead (core `floor[].lead`): drawn first, the reply as today folded under "Full answer"; Keep is one chooser beside it.
          : <ReplyLead lead={f.lead} at={`floor.${f.job}`} keep={sid === null ? null : <KeepChooser sid={sid} turn={f.job} entries={entries} />}>{text}</ReplyLead>}</div>}
    </li>
  )
}
/** One row per accepted contribution, with its immediate and model-grounded replies together. */
export function ViewConversation({ chat, floor = [], draft, moves = false, primary = false, me }: { chat: View['chat']; floor?: readonly FloorTurn[]; draft?: View['draft']; moves?: boolean; primary?: boolean; me?: string | null }) {
  const entries = entriesOf(draft)
  const rows = threadRows(chat, floor, entries)
  if (!rows.length) return null
  // The final row can be an independent floor exchange. Find the last saved row in the actual display order.
  let newestSaved: number | null = null
  for (let i = rows.length - 1; i >= 0 && newestSaved === null; i--) newestSaved = rows[i]!.index
  return (
    <ol className={`${typography.viewPanelBody} space-y-6`} data-testid="view-chat-turns">
      {rows.map((row, position) => {
        const latest = position === rows.length - 1
        if (row.index === null) return <FloorLine key={`floor:${row.floor!.job}`} f={row.floor!} me={me} latest={latest} />
        const t = chat[row.index]!
        const next = rows[position + 1]
        // Fold only consecutive attempts. A floor reply may add distinct context even when the subsequent message repeats the words.
        if (next?.index === row.index + 1 && row.floor === null && earlyOf(t) === null && retriedAt(chat, row.index)) return null
        const latestAnswer = row.index === newestSaved
        return <Turn key={t.id} t={t} at={`chat.${row.index}`} floor={row.floor} latest={latestAnswer} moves={moves} primary={primary} me={me} />
      })}
    </ol>
  )
}

/**
 * A turn Olumi is answering in core, or that ended unanswered (core API v1.28: the View's `turn`). Their words, then core's line verbatim
 * (`turn.words`) as a status, with the seconds since core accepted it (`started`, so a reload counts from the same moment). A failed or lost
 * turn shows core's plain reason and Try again (the same words, a new op). No word here is the page's own but the Try again control.
 */
/** A completed job may also be the newest saved chat row (Codex d9d66e579, ported): match exact fields, never infer failure from prose. */
export function turnAlreadyShown(view: Pick<View, 'chat' | 'turn'>): boolean {
  const turn = view.turn, last = view.chat[view.chat.length - 1]
  return turn != null && turn.status !== 'answering' && last != null && last.answer === null &&
    last.by_id === turn.by_id && last.said === turn.said && last.problem === turn.words
}

/** `shown`: the saved row already draws this turn's message and its failure, so only Try again is added (one notice, one retry). */
export function TurnInFlight({ turn, me, shown = false, replyVisible = false }: { turn: NonNullable<View['turn']> | null; me: string | null; shown?: boolean; replyVisible?: boolean }) {
  // `turn` null: the write is in flight and core has not yet accepted it. The SAME mount then carries through acceptance (one loader, one clock,
  // no restart: ViewChat draws it at one place in the thread), with the page's one waiting sentence until core's own words arrive.
  const running = turn === null || turn.status === 'answering'
  const busy = useViewChat((s) => s.busy)
  // Seconds are per JOB (Codex panel round 2). Once core has accepted, the clock is core's own `started`, never earlier (so a retained failed turn followed by
  // another job cannot carry the earlier job's time). Before acceptance (`turn` null) it is the moment of Send, which restarts each time the mount goes back
  // to waiting for a new acceptance; a started that cannot be read falls back to that same moment.
  const [sent, setSent] = useState(() => Date.now())
  const [waiting, setWaiting] = useState(turn === null)
  if ((turn === null) !== waiting) { setWaiting(turn === null); if (turn === null) setSent(Date.now()) }
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { if (!running) return; setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [running, turn?.started])
  const parsed = turn === null ? NaN : Date.parse(turn.started)
  const from = Number.isFinite(parsed) ? parsed : sent, secs = Math.max(0, Math.floor((now - from) / 1000))
  return (
    <ol className={`${typography.viewPanelBody} space-y-4`} data-testid="view-chat-turn-job" data-turn={turn?.status ?? 'answering'} data-shown={shown ? '' : undefined} data-reply-visible={replyVisible ? '' : undefined}>
      <li className="space-y-1">
        {/* DL-538: the bubble names whose words it holds, inside it, as a saved turn's does (Turn); with no words, the name stands alone. */}
        {shown || replyVisible || turn === null ? null : turn.said === null
          ? (turn.by_id === me ? null : <p className={typography.viewPanelMeta} data-view="turn.by">{turn.by}</p>)
          : <div className={`${styles.messageBubbleUser} ok-said`}>{turn.by === '' ? null : <p className={`ok-said-by ${typography.viewPanelMeta} ${turn.by_id === me ? 'text-text-light' : 'text-text-body'}`} data-view="turn.by" data-testid="view-said-by">{turn.by}</p>}{pressFieldOf(turn) !== null ? <PressedLine press={pressFieldOf(turn)!} at="turn" /> : turn.ask === 'challenge' || turn.ask === 'method'
            ? <p className={`${typography.viewPanelBody} inline-flex items-center gap-1.5`} data-testid="view-chat-pressed" data-pressed={turn.ask}><OkIcon id="method-mark" size={14} decorative />{PRESSED_WORDS}</p>
            : <p className={typography.viewPanelBody} data-view="turn.said">{turn.said}</p>}</div>}
        {shown ? null : <div className="ok-waiting" data-testid="view-chat-turn-wait">
          {running ? <div aria-hidden="true" data-testid="view-chat-turn-loader"><ThinkingIndicator /></div> : null}
          <p role="status" aria-live="polite" className={`${typography.viewPanelMeta} m-0 ${running ? 'text-text-light' : 'text-text-body'}`}>
            <span {...(turn === null ? {} : { 'data-view': 'turn.words' })} data-testid="view-chat-turn-words">{turn === null ? THINKING_WORDS : turn.words}</span>
            {running ? <span aria-hidden="true" className="tabular-nums" data-testid="view-chat-turn-seconds"> {secs} s</span> : null}
          </p>
        </div>}
        {running && !replyVisible ? (
          <div className="ok-reply-skeleton" data-testid="view-chat-reply-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : null}
        {running || turn === null || turn.said === null || turn.by_id !== me || turn.ask !== 'message' ? null
          : <button type="button" disabled={busy} data-testid="view-chat-turn-again" onClick={() => void sayAgain()} className="min-h-[44px] rounded-md border border-panel-border px-4 text-info hover:bg-panel-hover disabled:text-text-light disabled:cursor-not-allowed">Try again</button>}
      </li>
    </ol>
  )
}

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
  // Under a summary (the line has detail) the summary is the one tab stop and owns the hover; the spans are plain there.
  const detailed = c.detail !== ''
  const olumiWords = c.olumi === null ? null : c.olumi.title
  const summaryTip = useAnchoredTip([why, olumiWords].filter((w): w is string => w !== null && w !== '').join('\n') || undefined)
  const line = <><Hover words={detailed ? null : why} data-view={`proposal.changes.${i}.text`} data-view-hover={why === null ? undefined : `proposal.changes.${i}.together.why`}>{c.text}</Hover>{c.olumi === null ? null : <> <Hover words={detailed ? null : c.olumi.title} aria-label={c.olumi.title} data-view={`proposal.changes.${i}.olumi.glyph`}>{c.olumi.glyph}</Hover></>}</>
  return (
    <li className="flex items-start gap-2" data-change={keyOf(c)}>
      {/* R25 (24px targets): the box sits in a 24px label, the label the target. */}
      {ticked === null ? null : <label className="inline-flex min-h-[24px] min-w-[24px] flex-none cursor-pointer items-center justify-center" data-target-for={`view-change-tick-${i}`}><input type="checkbox" checked={ticked} disabled={busy} onChange={() => toggle(c)} aria-label={`Choose ${c.text}`} data-testid={`view-change-tick-${i}`} /></label>}
      <div className="min-w-0">
        {c.detail === '' ? <span>{line}</span> : (
          <details><summary className="cursor-pointer" {...summaryTip.handlers} aria-describedby={summaryTip.describedBy}>{line}</summary><p className="whitespace-pre-line text-text-light" data-view={`proposal.changes.${i}.detail`}>{c.detail}</p>{summaryTip.tip}</details>
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
function QuestionLine({ text, id, edit }: { text: string; id: string | null; edit: { prompt: string; ask: string } | null }): JSX.Element {
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
      {closed ? null : inRow ? (p.removed === null ? null : <div><Hover words={p.removed.title} data-view="proposal.removed.text">{p.removed.text}</Hover></div>)
        : <div><span className={`${typography.viewPanelHeading} text-text-header`} data-view="proposal.heading">{p.heading}</span>{p.on === '' ? null : <> · <span data-view="proposal.on">{p.on}</span></>}
        {p.removed === null ? null : <> <Hover words={p.removed.title} data-view="proposal.removed.text">{p.removed.text}</Hover></>}</div>}
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
        if (id === undefined || !readingIds.includes(id)) return <Hover key={j} as="p" words={m.title}>{words}</Hover>
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

/** A write core saved whose View could not then be read: it is not lost, and it is not shown yet (review 00052 #7). */
export const SAVED_NOT_SHOWN = 'Saved, but Olumi could not show it just now. Reload the page to see it.'

export interface ViewChatState {
  /** What is typed in the composer. */
  readonly text: string
  /**
   * One op id per write: the same words sent again after a dropped connection are saved once. Keyed by the scenario, the kind of write
   * and the words (`opKey`), so one scenario's op is never reused for another's (review 00054 #5).
   */
  readonly ops: ReadonlyMap<string, string>
  readonly busy: boolean
  /** Core's words for the last write that did not go through, or SAVED_NOT_SHOWN. */
  readonly said: string | null
  /**
   * A challenge that did not go through, its words waiting in the composer: sending those words again resends THAT challenge, with its
   * op id (it may already be saved), never a plain message (review 00002 #3). Changed words are a new message.
   */
  readonly held: { readonly text: string; readonly kind: string; readonly record: string; readonly sid: string; readonly uuid: string | null } | null
  /** A move core refused as no longer the newest (409): its tap is not offered again, and it is not retried. */
  readonly gone?: string | null
  /** Words-start (Codex root 03:42:17Z): a brief put back after a reload that was sent to start in words. Sending those same words again keeps that
   *  choice and its op, whichever button is pressed; changed words are a new brief. */
  readonly wordsBrief?: string | null
  /** Typed fields 13b (Codex HOLD 03:05:28Z): a press put back after a reload. Sending those same words again resends the same press about the
   *  same card under its op (core answers a replay with the turn it has); changed words are the person's own message. */
  readonly pressBack?: { readonly text: string; readonly about: string; readonly press: PressKind; /** The scenario (page uuid) and person it was made for: used only there (Codex 6afc8c1a). */ readonly uuid: string | null; readonly person: string | null } | null
  /** A challenge picked in the composer with no single card selected (menu brief UI-A, 18 Nov): it runs on the next card the person picks. */
  readonly armed?: ChallengeKind | null
  /** The words a canvas ask put in an EMPTY box (the Frame question's "Ask Olumi to change it"): while the box still holds exactly them nothing of the person's is in it and Escape clears it. Any typing clears this. */
  readonly prefilled?: string | null
}

export const useViewChat = create<ViewChatState>()(() => ({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null }))
// Any write to the text (typing, a send, a restore) that is not the prefill itself makes the box the person's: `prefilled` is cleared at the one place every write passes.
useViewChat.subscribe((st, was) => { if (st.text !== was.text && st.prefilled != null && st.text !== st.prefilled) useViewChat.setState({ prefilled: null }) })

/** A past version is on the canvas (the version history's Draw): nothing is written until the person is back on the latest. */
export const PAST_HELD = 'Go back to the latest version to change the model.'

/** One write, then the View read again. An approval changes the model: the View is stale until the new one lands (00051). */
/** Where a write's words go when it does not go through: the composer's line, unless the write has its own panel (the figure-first entry). */
const toComposer = (said: string | null): void => useViewChat.setState({ said })

async function act(f: () => Promise<unknown>, changesModel = false, sink: (said: string | null) => void = toComposer): Promise<boolean> {
  if (useViewChat.getState().busy) return false
  if (useViewStore.getState().at !== null) { sink(PAST_HELD); return false }
  // A write that settles after the page has moved to another scenario says nothing there: its words belong to the scenario it was made in
  // (delta review of 006 #1: A's refusal appeared in B's composer).
  const at = useViewStore.getState().uuid, here = () => useViewStore.getState().uuid === at
  useViewChat.setState({ busy: true })
  sink(null)
  try {
    await f()
    const views = useViewStore.getState()
    const shown = await (changesModel ? views.modelChanged() : views.refresh())
    if (!shown && here()) sink(SAVED_NOT_SHOWN)
    return true
  } catch (e) {
    if (here()) sink(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    return false
  } finally { useViewChat.setState({ busy: false }) }
}

/**
 * A brief starts a scenario in core, and the page moves to core's id's own UUID form (`sid.ts`), the scenario's one address: the address
 * bar then names it (`/#/scenario/<uuid>`), so the link opens the same scenario in any browser of a member. An answer that lands after the
 * page moved on to another scenario moves nothing (review 00052 #5).
 */
/**
 * Start in words (core `POST /api/scenarios { brief, start: 'words' }`, words-start CONTRACT 1, 17 Nov): core saves the scenario and its brief and
 * builds no model (no draft job, no AI call). The page then sends the same words as the person's first message (`POST …/messages`, the existing
 * route), so Olumi answers them on the floor at once, in words; that answer is the only AI call. Its op is derived from the brief's op, so a
 * retry after a lost answer replays the same message instead of sending a second one.
 */
const createInWords = (brief: string, op: string) => call<DraftAccepted>('POST', '/api/scenarios', { brief, op, start: 'words' })
const firstMessageOp = (op: string) => `${op}-m`.slice(0, 64)

async function startScenario(brief: string, op: string, uuid: string | null, words = false): Promise<void> {
  watchPageMoves()
  const left = pageMoves
  // AI jobs (core API v1.26): core accepts the brief at once (202) and drafts it in the server. Until it names the scenario, the brief and its
  // op stay in this tab for this person, so an answer lost on the way is recovered after a reload by the same op (pendingBrief), never redrafted.
  keepPending(brief, op, words)
  const made = words ? await createInWords(brief, op) : await writes.create(brief, op)
  // An answer that names no scenario (unreadable, or JSON null) may still have been saved: uncertain, never "nothing saved" (00054 #4).
  if (typeof made?.scenario !== 'string' || !/^s_[0-9a-f]+$/.test(made.scenario)) throw new TeamApiError(0, UNCERTAIN_WRITE, true)
  // Words-start (Codex root 04:07:06Z #1): the first message's receipt (the brief, its op) is saved for the named scenario BEFORE the brief's
  // receipt is dropped and before any read, so a close or reload in between still finds the brief to send, by that same op.
  const mop = firstMessageOp(op)
  if (words) keepPendingTurn(made.scenario, brief, mop)
  dropPending(op)
  const derived = derivedUuidOf(made.scenario)
  if (derived === null) throw new TeamApiError(502, 'Olumi made the scenario but named it in a way this page cannot open. Reload the page.')
  // The page moved away while the answer was on its way, even if it has since come back (A → B → A): it moves nothing (review 00002).
  if (pageMoves !== left || useCanvasStore.getState().currentScenarioId !== uuid) return
  useCanvasStore.setState(scenarioIdWrite(useCanvasStore.getState().currentScenarioId, derived))
  setCurrentScenarioId(derived)
  try { window.history.replaceState(window.history.state, '', `/#/scenario/${derived}`) } catch { /* the address bar keeps its old address */ }
  await useViewStore.getState().use(derived)
  if (words) {
    // The brief is sent ONCE as the first message, under its op saved above (as any message's), so a reload or a lost acceptance asks core
    // again by that op. If it does not go through, the words go back in this scenario's box with that op and core's
    // own words, so one press sends the same message again; the person never types it again.
    try { await writes.message(made.scenario, brief, mop); dropPendingTurn(mop) } catch (e) {
      const said = e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.'
      if (useViewStore.getState().uuid === derived) useViewChat.setState({ text: brief, said, ops: new Map(useViewChat.getState().ops).set(opKey(derived, 'message', brief), mop) })
      throw e
    }
  }
  // The central brief box goes away when a draft starts. Take this writer to the ordinary follow-up composer, wherever they keep Olumi.
  const opened = useViewStore.getState()
  if (opened.uuid === derived && useCanvasStore.getState().currentScenarioId === derived && (words || opened.view?.draft?.status === 'drafting')) revealOlumiSurface()
}

/** How many times the page has moved to another scenario: an answer is applied only to the page it was asked from. */
let pageMoves = 0
let watching = false
/** Counted from the first scenario this page starts, not from import: a module that only imports this file subscribes to nothing. */
function watchPageMoves(): void {
  if (watching) return
  watching = true
  useCanvasStore.subscribe((now, before) => { if (now.currentScenarioId !== before.currentScenarioId) pageMoves += 1 })
}

/** The scenario on screen is drafting its first model in core (core API v1.26: the View's `draft`, the job's state in core's words). */
export const isDrafting = (view: View | null): boolean => view?.draft?.status === 'drafting'
/** A turn on the scenario on screen is being answered in core (core API v1.28: the View's `turn`); Send waits until it has answered. */
export const isAnswering = (view: View | null): boolean => view?.turn?.status === 'answering'

/** A message sent whose acceptance has not come back yet: kept in this tab per person, as a brief is, so a reload asks core again by the SAME op. */
const PENDING_TURN = (person: string) => `olumi-pending-turn:${person}`
function keepPendingTurn(sid: string, text: string, op: string, about: string | null = null, press: PressKind | null = null): void {
  const me = pendingPerson()
  if (me === null) return
  try { sessionStorage.setItem(PENDING_TURN(me), JSON.stringify(about === null ? { sid, text, op } : press === null ? { sid, text, op, about } : { sid, text, op, about, press })) } catch { /* no storage: the op lives only in this page */ }
}
function dropPendingTurn(op: string): void {
  const me = pendingPerson()
  if (me === null) return
  try { if (pendingTurn(me)?.op === op) sessionStorage.removeItem(PENDING_TURN(me)) } catch { /* nothing kept */ }
}
/** This person's message still waiting for core's acceptance in this tab, if any: its scenario, words and op. */
export function pendingTurn(person: string): { sid: string; text: string; op: string; about: string | null; press?: PressKind } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING_TURN(person)) ?? 'null') as { sid?: unknown; text?: unknown; op?: unknown; about?: unknown; press?: unknown } | null
    // `about` (the card the message was about) is optional: a record kept before it existed restores as a plain message, as it was sent.
    return v !== null && typeof v.sid === 'string' && /^s_[0-9a-f]+$/.test(v.sid) && typeof v.text === 'string' && v.text.trim() !== '' && typeof v.op === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v.op)
      ? { sid: v.sid, text: v.text, op: v.op, about: typeof v.about === 'string' && v.about !== '' ? v.about : null, ...(v.press === 'explain' || v.press === 'ask_about' ? { press: v.press } : {}) } : null
  } catch { return null }
}
/**
 * After a reload, a message whose acceptance never came back is put back in the box with the op it was sent with, so Send asks core again
 * by that op: core answers a replay with the turn it already has (never a second answer), or takes it as new if it never arrived. It is
 * never dropped because the View shows the same words, which may be someone else's or an earlier message of theirs (Codex review 07 #5).
 * Reloading sends nothing.
 */
export function restorePendingTurn(): boolean {
  const me = pendingPerson(), { uuid, sid, view } = useViewStore.getState()
  if (me === null || sid === null || view === null) return false
  const p = pendingTurn(me)
  if (p === null || p.sid !== sid) return false
  if (useViewChat.getState().text !== '' || useViewChat.getState().busy) return false
  // A message about a card comes back about that card (Codex 008, 18 Nov): the card is selected again, so the composer shows its subject and
  // Send asks core again with the same card and the same op. A card no longer in the model: the words come back alone, under a new op.
  const about = p.about !== null && view.model?.cards.some((c) => c.id === p.about) ? p.about : null
  if (p.about !== null && about === null) { useViewChat.setState({ text: p.text, said: ABOUT_GONE }); return true }
  // A press comes back as that press (Codex HOLD 03:05:28Z): the same words sent unchanged resend its kind, card and op; changed words are the
  // person's own message, about no card unless they pick one (an edited prefill is their message, typed fields 13b (b)).
  if (p.press !== undefined && about !== null) {
    useViewChat.setState({ text: p.text, pressBack: { text: p.text, about, press: p.press, uuid, person: me }, ops: new Map(useViewChat.getState().ops).set(opKey(uuid, `message:${about}:${p.press}`, p.text), p.op) })
    return true
  }
  if (about !== null) useCanvasStore.setState({ selection: { nodeIds: new Set([about]), edgeIds: new Set(), anchorPosition: null } })
  useViewChat.setState({ text: p.text, ops: new Map(useViewChat.getState().ops).set(opKey(uuid, about === null ? 'message' : `message:${about}`, p.text), p.op) })
  return true
}
/** Said when a message put back after a reload was about a card the model no longer holds (Codex 008 P2): it goes as a new message, about no card. */
export const ABOUT_GONE = 'The card this message was about is no longer in the model, so it will be sent without it.'
/** Try again on a plain message that ended unanswered (failed or lost): the same words, under a new op. A challenge, method question, move
 *  or evidence to consider is asked again from its own control, so it keeps what it was (Codex review 07 #4); it never becomes words. */
export function sayAgain(): Promise<boolean> {
  const { sid, view } = useViewStore.getState()
  const t = view?.turn
  if (sid === null || t == null || t.status === 'answering' || t.said === null || t.ask !== 'message') return Promise.resolve(false)
  const said = t.said
  // A pressed message is asked again as the same press about the same card (typed fields 13b, Codex ROOT 02:53:03Z): core's `turn.press`;
  // where core says the card is gone (null), neither goes, and the words are a plain message, as with ABOUT_GONE.
  const p = pressFieldOf(t)
  // A plain message sent about a card keeps that card too (typed fields 13b: core's `turn.about`, null where this reader's model lacks it, absent
  // where it was about none or on an older core, which sends it about none as before).
  const was = (t as { about?: unknown }).about
  const card = p !== null ? p.card : typeof was === 'string' ? was : null
  const about = card !== null && view?.model?.cards.some((c) => c.id === card) ? card : null
  return write('turn-again', `${sid}:${t.job}`, (op) => writes.message(sid, said, op, about, about === null || p === null ? null : p.kind))
}

/** A brief sent whose answer has not named its scenario yet: kept in this tab (sessionStorage) under the person's id, never another's. */
const PENDING = (person: string) => `olumi-pending-brief:${person}`
const pendingPerson = (): string | null => useMe.getState().me?.id ?? null
function keepPending(brief: string, op: string, words = false): void {
  const me = pendingPerson()
  if (me === null) return
  try { sessionStorage.setItem(PENDING(me), JSON.stringify({ brief, op, ...(words ? { words: true } : {}) })) } catch { /* no storage: the op lives only in this page */ }
}
function dropPending(op: string): void {
  const me = pendingPerson()
  if (me === null) return
  try { if (pendingBrief(me)?.op === op) sessionStorage.removeItem(PENDING(me)) } catch { /* nothing kept */ }
}
/** This person's brief still waiting for core's answer in this tab, if any: its words and the op it was sent with. */
export function pendingBrief(person: string): { brief: string; op: string; words?: true } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING(person)) ?? 'null') as { brief?: unknown; op?: unknown; words?: unknown } | null
    return v !== null && typeof v.brief === 'string' && v.brief.trim() !== '' && typeof v.op === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v.op) ? { brief: v.brief, op: v.op, ...(v.words === true ? { words: true as const } : {}) } : null
  } catch { return null }
}
/**
 * After a reload, a brief whose answer never arrived is put back in the box with the op it was sent with, so Send asks core again by that op:
 * the same scenario and job when core had it (a replay never drafts again), a first draft only when it never arrived. Reloading alone
 * sends nothing.
 */
export function restorePendingBrief(): boolean {
  const me = pendingPerson(), { uuid, sid, view } = useViewStore.getState()
  if (me === null || sid !== null || !takesBrief(sid, view) || useViewChat.getState().text !== '' || useViewChat.getState().busy) return false
  const p = pendingBrief(me)
  if (p === null) return false
  // A brief sent to start in words keeps that choice and its op (Codex root 03:42:17Z): the same words sent again replay that start.
  useViewChat.setState({ text: p.brief, wordsBrief: p.words === true ? p.brief : null, ops: new Map(useViewChat.getState().ops).set(opKey(uuid, p.words === true ? 'brief-words' : 'brief', p.brief), p.op) })
  return true
}

/** Try again (core API v1.26): a new attempt on the scenario's saved brief after its first draft failed, was lost or was stopped, under a new op. */
export function tryAgain(): Promise<boolean> {
  const { sid, view } = useViewStore.getState(), status = view?.draft?.status
  if (sid === null || (status !== 'failed' && status !== 'lost' && status !== 'stopped')) return Promise.resolve(false)
  return write('redraft', `${sid}:${view!.draft!.job ?? ''}`, (op) => writes.redraft(sid, op))
}

/**
 * "Build a model from this" (DL 06:0xZ; Codex UI review 05:44:59Z): core's offer to draft a model from the reasoning so far (the conversation with
 * its writers, revealed views, kept ideas as Olumi's provisional ones). Core sends ONE View field shaped as `draft.stop` ({ label, title }) only
 * where a press would draft from the current reasoning; the page draws the offer only then, in core's words, and never decides it itself.
 * The path is core's (sx-team 06:11:29Z): top-level `build_model: { label, title }`, absent everywhere else; BUILD_FIELD is the one place it is read.
 */
export const BUILD_FIELD = 'build_model'
export function buildOfferOf(view: View | null): { label: string; title: string } | null {
  const b = view === null ? undefined : (view as unknown as Record<string, unknown>)[BUILD_FIELD] as { label?: unknown; title?: unknown } | null | undefined
  return b != null && typeof b.label === 'string' && b.label.trim() !== '' && typeof b.title === 'string' ? { label: b.label, title: b.title } : null
}
/** The press: the same write as Try again (POST …/draft, its op kept until core has it), only while core offers it; the first model then drafts
 *  on the DraftingBoard as any first draft, and its proposal is reviewed as any other. */
export function buildModel(): Promise<boolean> {
  const { sid, view } = useViewStore.getState()
  if (sid === null || buildOfferOf(view) === null) return Promise.resolve(false)
  return write('build', sid, (op) => writes.redraft(sid, op))
}

/** Stop (core API v1.34): only while core offers it (`draft.stop`, the draft's author, while it drafts); then the View is read again. */
export function stopDraft(): Promise<boolean> {
  const { sid, view } = useViewStore.getState(), d = view?.draft
  if (sid === null || d?.status !== 'drafting' || d.stop == null || typeof d.job !== 'number') return Promise.resolve(false)
  const job = d.job
  return act(() => writes.stopDraft(sid, job))
}

/** Core holds no model and no proposal for this scenario (none yet, or its first draft was set aside): a message is a new brief (00052 #6). */
// A scenario that already holds a kept idea is under way: what the person sends there is a message about it (core answers a message on a
// scenario with no model in words, turns.ts chat floor), never a new brief that would start another scenario (Codex 008e).
const holdsKept = (view: View): boolean => { const k = (view as { kept?: unknown }).kept; return Array.isArray(k) && k.length > 0 }
/** A scenario started in words: core's own `start: "words"` in the View, read from the stored header (words-start CONTRACT 3, revised 03:55Z),
 *  so it holds before the first reply and after any reopen. Never inferred from what is absent. What the person sends there is a message in that
 *  scenario, answered on the floor, never a new brief. */
export const startedInWords = (view: View | null): boolean => view !== null && (view as { start?: unknown }).start === 'words'
export const takesBrief = (sid: string | null, view: View | null) => sid === null || (view !== null && view.version === null && view.proposal === null && !onFloor(view) && !holdsKept(view) && !startedInWords(view))

const opKey = (uuid: string | null, kind: string, text: string) => `${uuid ?? '-'}\u0000${kind}\u0000${text}`

/** One write of `text`, with its op id kept until core has it; true when it went through. `uuid`: the scenario it belongs to (the page's). */
async function write(kind: string, text: string, f: (op: string) => Promise<unknown>, changesModel = false, uuid = useViewStore.getState().uuid): Promise<boolean> {
  const key = opKey(uuid, kind, text)
  const op = useViewChat.getState().ops.get(key) ?? newOp()
  useViewChat.setState({ ops: new Map(useViewChat.getState().ops).set(key, op) })
  const sent = await act(() => f(op), changesModel)
  if (sent) { const left = new Map(useViewChat.getState().ops); left.delete(key); useViewChat.setState({ ops: left }) }
  return sent
}

/** Words to core: a new brief while it holds no model for this scenario, else a message. */
function say(text: string, words = false, about: string | null = selectedRecord(), press: PressKind | null = null): Promise<boolean> {
  const { uuid, sid, view } = useViewStore.getState()
  if (sid !== null) closeUntouchedCommit(sid)
  // A message while its first model drafts is a message to THIS scenario (onFloor), never a second scenario: core answers it, or refuses it in its own words.
  return takesBrief(sid, view) ? write(words ? 'brief-words' : 'brief', text, (op) => startScenario(text, op, uuid, words))
    // The card the composer shows as "About: <card>" goes with the words, by id (core candidate 8); the same words about another card are another write.
    // A press's kind (typed fields 13b) goes only with its card; the same words pressed differently are another write.
    : ((about, kind) => write(about === null ? 'message' : `message:${about}${kind === null ? '' : `:${kind}`}`, text, async (op) => { keepPendingTurn(sid!, text, op, about, kind); const r = await writes.message(sid!, text, op, about, kind); dropPendingTurn(op); return r }))(about, about === null ? null : press)
      // A new message starts a new exchange: the last save's receipt and comparison stand down (they followed the thread's newest line).
      .then((sent) => { if (sent) useModelNotice.setState({ notice: null }); return sent })
}

/**
 * The held challenge a Send resends: only the one made in the scenario on screen, and only for its own words. A challenge held for another
 * scenario is neither resent here (the address guard, `team/api.ts`, would refuse it) nor dropped: it waits for its own scenario.
 */
export function resendOf(held: ViewChatState['held'], text: string, here: string | null): { readonly again: ViewChatState['held']; readonly drop: boolean } {
  const mine = held !== null && held.uuid === here ? held : null
  const again = mine !== null && mine.text === text ? mine : null
  return { again, drop: mine !== null && again === null }
}

async function send(pressedWords = false): Promise<void> {
  const { text, held, wordsBrief, pressBack } = useViewChat.getState()
  if (text.trim() === '') return
  const words = pressedWords || (wordsBrief != null && wordsBrief === text)
  // A press put back is resent as that press only on its own scenario, for its own person, with its words unchanged (Codex 6afc8c1a); anywhere
  // else the same words are an ordinary message.
  const back = pressBack != null && pressBack.text === text && pressBack.uuid === useViewStore.getState().uuid && pressBack.person === pendingPerson() ? pressBack : null
  const { again, drop } = resendOf(held, text, useViewStore.getState().uuid)
  if (drop) useViewChat.setState({ held: null })
  if (!(await (again !== null ? challenge(again.kind, again.record, again.text, again) : back !== null ? say(text, words, back.about, back.press) : say(text, words)))) return
  if (useViewChat.getState().text === text) useViewChat.setState({ text: '', wordsBrief: null, pressBack: null })
}

/** The composer's one choice for a new brief (words-start, 17 Nov): build a model from it (Send, the default), or talk it through first. */
export const TALK_FIRST = 'Talk it through first'
export const TALK_FIRST_HOVER = 'Olumi answers in the conversation and does not build a model. You can keep its ideas.'

/**
 * A challenge on one card, to core's challenge route; one that does not go through is held for the same resend (`held`). A resend goes to
 * the scenario it was made in, with that scenario's op (review 00003 #2): it is the same write. Since Codex 006 #1 it is sent only while that
 * scenario is on screen (`resendOf`; the address guard refuses any other), and its words return to the composer when the page is back on it.
 */
/** The four challenge kinds core's challenge route takes (writes.challenge), as the chips and asks send them. */
export const CHALLENGE_KINDS = ['assumption', 'opposite', 'disconfirming', 'outside'] as const
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number]
/** Exported for the port's ChallengeCard "Respond" (DL 7 Nov, port ruling R3): the one write path for a challenge, unchanged. */
export async function challenge(kind: string, record: string, text: string, at = { sid: useViewStore.getState().sid, uuid: useViewStore.getState().uuid }): Promise<boolean> {
  const { sid, uuid } = at
  if (sid === null) return false
  const sent = await write(`challenge:${kind}:${record}`, text, (op) => writes.challenge(sid, kind, record, op), false, uuid)
  useViewChat.setState({ held: sent ? null : { text, kind, record, sid, uuid } })
  return sent
}

/**
 * What the team came for (core `POST …/goal`, canon wave step 1): one of the View's goal ids, or null to clear it. No AI call and no change
 * to the model; core orders the menu by it. One write at a time, with its op id, then the View read again (its `session` then says it).
 */
export async function chooseGoal(goal: string | null): Promise<boolean> {
  const { sid, uuid } = useViewStore.getState()
  if (sid === null) return false
  return write('goal', goal ?? '', (op) => writes.goal(sid, goal, op), false, uuid)
}

/**
 * One plain question from the menu (core `POST …/method`): core answers it as one turn on the challenges' path. It may propose a change,
 * which is held for the person's approval like any other proposal (core 7035, Codex 18 Nov; it was once discussion-only). Its reply lands as the newest turn when the View is read again, as a
 * challenge's does. The same press after a dropped connection is sent with the same op id, so core answers (and pays) once.
 */
export async function askMethod(method: string): Promise<boolean> {
  const { sid, uuid, view } = useViewStore.getState()
  if (sid === null) return false
  // "What could go wrong?" and the pre-mortem name the one option card selected (core's named route, rule 1); none or several selected sends none.
  const option = (method === 'go_wrong' || method === PRE_MORTEM) && view !== null ? optionInFocusOf(view, useCanvasStore.getState().selection.nodeIds) : null
  let refused = false
  const sent = await write('method', option === null ? method : `${method}:${option}`, async (op) => {
    try { return await writes.method(sid, method, op, option ?? undefined) } catch (e) { if (method === PRE_MORTEM && e instanceof TeamApiError && e.status === 409) refused = true; throw e }
  }, false, uuid)
  if (refused) await openPreMortemEntry()
  return sent
}

/** The pre-mortem move (core's `session.methods` id, and the coach's next move). */
const PRE_MORTEM = 'pre_mortem'

/**
 * A tap on the pre-mortem move while the person's gate is closed is core's `409` with the gate sentence, and no AI call. The tap opens the entry
 * instead (the "If it failed" key, where core's question, their box and "Show me Olumi's now" are drawn): the View is read again first, so a gate that has
 * opened since (another tab) shows Olumi's stories rather than the entry. The composer carries nothing: the refusal is not a message to correct.
 */
async function openPreMortemEntry(): Promise<boolean> {
  useViewChat.setState({ said: null })
  await useViewStore.getState().refresh()
  if (useViewStore.getState().view?.session?.pre_mortem?.state !== 'closed') return false
  useViewLens.setState({ lens: 'premortem' })
  return true
}

const toGate = (said: string | null): void => usePreMortemGate.setState({ said })

/**
 * "Write mine first" (core `POST …/pre-mortem`): their own reasons, one per line (core takes 1 to `max_reasons`, each up to `max_chars`; it refuses the rest in
 * its own words, said in the entry). Then the View is read again: the gate is open for them, and Olumi's stories show. No AI call.
 */
export async function giveReasons(): Promise<boolean> {
  const { sid } = useViewStore.getState(), { text } = usePreMortemGate.getState()
  if (sid === null) return false
  const reasons: string[] = []
  for (const line of text.split('\n')) { const r = line.trim(); if (r !== '') reasons.push(r) }       // their own sentences, as typed: nothing of the View's
  const sent = await act(() => writes.preMortem(sid, reasons), false, toGate)
  if (sent) usePreMortemGate.setState({ text: '' })
  return sent
}

/** "Show me Olumi's now" (core `POST …/pre-mortem/show`): a logged choice, no reasons written; then the View is read again. */
export async function showOlumisNow(): Promise<boolean> {
  const { sid } = useViewStore.getState()
  if (sid === null) return false
  return act(() => writes.preMortemShow(sid), false, toGate)
}

/** The menu item core sends while it offers "Let us give our figure first" (API.md): a press opens its entry, never POST …/method. */
export const FIGURE_FIRST = FIGURE_FIRST_ID

/**
 * Open the blind entry (`GET …/figure-first`, a read that writes nothing), keeping core's headings from the View (the show answer has none).
 * Opened again when the View moves on while it is open (ViewChat), keeping what was typed. A refused read says core's words in the panel.
 */
export async function openFigureFirst(): Promise<boolean> {
  const { sid, uuid, view } = useViewStore.getState()
  if (sid === null || view === null) return false
  const keep = useFigureFirst.getState().uuid === uuid ? {} : { typed: '', text: '' }
  useFigureFirst.setState({ ...keep, uuid, reading: true, said: null, shown: null, headings: figureFirstOf(view)?.headings ?? null })
  try {
    const entry = await writes.figureFirstEntry(sid)
    if (entry === null || typeof entry !== 'object' || typeof entry.quantity !== 'string' || typeof entry.version !== 'number' || typeof entry.heading !== 'string'
      || typeof entry.question !== 'string' || typeof entry.ask !== 'string' || typeof entry.note !== 'string' || typeof entry.show !== 'string') throw new TeamApiError(0, VIEW_SHAPE_CHANGED)
    if (useViewStore.getState().uuid !== uuid) return false
    useFigureFirst.setState({ entry, signature: view.signature, reading: false })
    return true
  } catch (e) {
    useFigureFirst.setState({ entry: null, signature: null, reading: false, said: e instanceof TeamApiError ? e.message : READ_FAILED })
    return false
  }
}

const toPanel = (said: string | null): void => useFigureFirst.setState({ said })

/**
 * Their figure and their words for the offered quantity (`POST …/figure-first { quantity, version, text, typed }`), the quantity and version
 * the entry was read with; the figure goes as typed and core reads it (or refuses in the card's ask, said in the panel). One write at a time,
 * then the View read again: it then holds their figure beside Olumi's, and the entry closes.
 */
export async function giveFigureFirst(): Promise<boolean> {
  const { sid } = useViewStore.getState(), { entry, typed, text } = useFigureFirst.getState()
  if (sid === null || entry === null) return false
  const sent = await act(() => writes.figureFirstGive(sid, entry.quantity, entry.version, text, typed), false, toPanel)
  if (sent) useFigureFirst.setState({ entry: null, signature: null, typed: '', text: '' })
  return sent
}

/** "Show me Olumi's figure instead" (`POST …/figure-first/show { quantity, version }`): Olumi's figure and basis, drawn under the headings kept. */
export async function showOlumiFigure(): Promise<boolean> {
  const { sid } = useViewStore.getState(), { entry, headings } = useFigureFirst.getState()
  if (sid === null || entry === null) return false
  let got = null as FigureFirstShown | null
  const sent = await act(async () => {
    const r = await writes.figureFirstShow(sid, entry.quantity, entry.version)
    if (r === null || typeof r !== 'object' || typeof r.olumi?.text !== 'string' || typeof r.olumi.title !== 'string' || typeof r.olumi.basis !== 'string') throw new TeamApiError(0, VIEW_SHAPE_CHANGED)
    got = r
  }, false, toPanel)
  if (sent && got !== null) useFigureFirst.setState({ entry: null, signature: null, shown: { ...got, headings }, typed: '', text: '' })
  return sent
}

const closeFigureFirst = () => useFigureFirst.setState({ ...FIGURE_FIRST_CLOSED })

/** Bring a panel of the Olumi tab into view once drawn (a press is seen to be answered). */
const bringIntoView = (from: Element | null, testid: string) =>
  requestAnimationFrame(() => from?.closest('[data-testid="view-chat"]')?.querySelector(`[data-testid="${testid}"]`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }))

type Next = NonNullable<ViewTurn['answer']>['next']
/** The one key for a refused move (sid, turn, move); the Journey's Next step press uses it too, so the two never disagree. */
export const moveKey = (sid: string, turn: number, move: string) => `${sid}\u0000${turn}\u0000${move}`

/**
 * The coach's next move, taken in one tap (R2 W1; DL 16:36Z): a structured choice `{ move, at }`, never words, through the same write as a
 * message (one op id, then the View read again). The person's turn is what core records for it (the move's label); `next.text`, Olumi's
 * own words to the person, is never sent as theirs. A move core refuses as no longer the newest (409) re-reads the View, and its tap is
 * dropped, not retried.
 */
async function takeMove(turn: number, next: Next): Promise<boolean> {
  const { sid, uuid } = useViewStore.getState()
  if (sid === null) return false
  let stale = false
  const sent = await write(`move:${next.move}`, String(turn), async (op) => {
    // Core's one-turn-at-a-time refusal is a 409 too, told apart by its code (`turn_busy`): that move is still offered, so it is never dropped.
    try { return await writes.move(sid, next.move, next.at, op) } catch (e) { if (e instanceof TeamApiError && e.status === 409 && e.code !== 'turn_busy') stale = true; throw e }
  }, false, uuid)
  // The pre-mortem tap with the gate closed is also a 409: it opens the entry; any other 409 is the stale move below.
  if (stale && next.move === PRE_MORTEM && await openPreMortemEntry()) return sent
  if (stale) {
    useViewChat.setState({ gone: moveKey(sid, turn, next.move) })
    await useViewStore.getState().refresh()
  }
  return sent
}

/** Whether a move is drawn as a press at all (the same test MoveTap makes): a session, a real move, and not one core refused as stale. */
export const moveTapDrawn = (sid: string | null, next: Next, gone: boolean): boolean => sid !== null && isRealMove(next.move) && !gone

/** The newest reply's move as one tap, in the shell's button, with core's label for it. `arrow` (the Analysis tab's "Suggested next
 *  step", as the previous PoC drew it): the same tap as a round arrow, core's label as its name and hover. */
export function MoveTap({ turn, next, arrow = false, primary = false, at }: { turn: number; next: Next; arrow?: boolean; /** Drawn as the filled primary button, under the newest reply (14 Nov: the reply's next move is not tucked away). */ primary?: boolean; /** Where the label sits in the View, for a surface that binds every word to its path. */ at?: string }) {
  const sid = useViewStore((s) => s.sid)
  const busy = useViewChat((s) => s.busy), gone = useViewChat((s) => s.gone ?? null)
  if (!moveTapDrawn(sid, next, sid !== null && gone === moveKey(sid, turn, next.move))) return null
  return (
    arrow
      ? <HoverButton words={next.label} type="button" data-testid="view-next-move" data-move={next.move} disabled={busy} onClick={() => void takeMove(turn, next)} aria-label={next.label}
          className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-full ${controls.act}`}><OkIcon id="move-tap" size={16} decorative /></HoverButton>
      : <div><Button size="sm" variant={primary ? 'primary' : 'secondary'} data-testid="view-next-move" data-move={next.move} disabled={busy} onClick={() => void takeMove(turn, next)}>{at === undefined ? next.label : <span data-view={`${at}.label`}>{next.label}</span>}</Button></div>
  )
}

/** core's four challenges (API `POST …/challenge` `kind`), by the press's chip id. */
const CHALLENGES: Readonly<Record<string, ChallengeKind>> = { 'ask:challenge': 'assumption', 'ask:method-opposite': 'opposite', 'ask:falsify': 'disconfirming', 'ask:method-outside-view': 'outside' }

export type Press = { id?: string; parameters?: Record<string, unknown>; message: string }

/**
 * A press on the canvas (a coaching icon, a chip). A challenge on exactly one card of the model goes to core's challenge route for that
 * card; anything else is its words, said to core. The card is the ask's own target, else the canvas's selection.
 */
function press(opts: Press): Promise<boolean> {
  const chip = opts.id ?? (typeof opts.parameters?.['chip_id'] === 'string' ? opts.parameters['chip_id'] as string : '')
  const kind = CHALLENGES[chip]
  const { sid, view } = useViewStore.getState()
  const target = takeAskTargetBinding(opts.message)?.nodeIds ?? useCanvasStore.getState().selection.nodeIds
  const ids = [...target]
  const record = ids.length === 1 && view?.model?.cards.some((c) => c.id === ids[0]) ? ids[0]! : null
  if (kind !== undefined && record !== null && sid !== null) return challenge(kind, record, opts.message)
  // A press is about ITS OWN card (the ask's target, else the selection), never whatever the canvas selected since: the same `record`; with
  // it, what kind of press it was (typed fields 13b: Explain, else a one-card ask), sent as the page's own prefill, unedited.
  const pressed = pressKindFor(chip, record)
  // A press that did not go through keeps its whole identity for the unchanged words (Codex 037cbe59 report): Send from the message box resends
  // the same press about the same card under the same op (write() keeps it until core has it); changed words are the person's own message.
  // Made for the scenario and person on screen now; a failure that settles after the page has moved on writes nothing (keptIfNotSent's `at`).
  const at = useViewStore.getState().uuid, who = pendingPerson()
  return say(opts.message, false, record, pressed).then((sent) => {
    if (!sent && pressed !== null && record !== null && useViewStore.getState().uuid === at && pendingPerson() === who) useViewChat.setState({ pressBack: { text: opts.message, about: record, press: pressed, uuid: at, person: who } })
    return sent
  })
}

/** An ask made while a write is in flight: its words wait in the composer, never lost or sent twice (review 00055). */
export const STILL_ANSWERING = 'Olumi is still answering. Your words are in the message box: send them once it has.'
/** Words from the canvas the person can still send: put after whatever the composer already holds, never over it (review 00056). An EMPTY box takes them as `prefilled`. */
const keep = (text: string): void => {
  const now = useViewChat.getState().text
  if (now.split('\n').includes(text)) return
  const empty = now.trim() === ''
  useViewChat.setState({ text: empty ? text : `${now}\n${text}`, prefilled: empty ? text : null })
}
const keptWhileBusy = (text: string): boolean => {
  if (!useViewChat.getState().busy && !isAnswering(useViewStore.getState().view)) return false
  keep(text)
  useViewChat.setState({ said: STILL_ANSWERING })
  return true
}
/** An ask from the canvas that did not go through (core refused it, or its answer never came) keeps its words beside core's sentence. */
const keptIfNotSent = (text: string, at = useViewStore.getState().uuid) => (sent: boolean) => { if (!sent && useViewStore.getState().uuid === at) keep(text) }

/**
 * The canvas's ask path with its own result (Codex ROOT HOLD 01:11:46Z): the same guards as `_dispatchAction` (while Olumi is still answering
 * the words wait in the message box; an ask that does not go through keeps its words, for the scenario it was made in), returning the write's
 * actual result, so a deliberate press elsewhere on the page (Team's "Ask Olumi about this difference") can say sent or not sent truthfully.
 */
export function askOnPress(opts: Press): Promise<boolean> {
  if (keptWhileBusy(opts.message)) return Promise.resolve(false)
  const kept = keptIfNotSent(opts.message)
  return press(opts).then((sent) => { kept(sent); return sent })
}

/** The canvas's asks, answered by this writer: one set for the page, so every holder registers the same functions. */
const ASKS = {
  _sendMessage: withOlumiReveal((text: string) => { if (!keptWhileBusy(text)) void say(text).then(keptIfNotSent(text)) }),
  // A prefill from a card (v10's Olumi corner: "About <card>:") is put after whatever the person has typed, never over it (Codex review
  // dgai-v10 00002 #1: the corner on every card must not delete a draft).
  _prefillChat: withOlumiReveal((text: string) => { keep(text) }),
  _dispatchAction: withOlumiReveal((opts: Press) => { void askOnPress(opts) }),
  _isConversationBusy: () => useViewChat.getState().busy,
}
/**
 * The selection chip's Ask on this lane (menu brief UI-D, 18 Nov; Codex 23:56Z: a generic Ask is prefilled and never auto-sent). It was not
 * drawn at all: its legacy sender is never registered here. It starts the person's own question about that card in the message box, after
 * whatever they have typed, as a card's Olumi corner does; they finish it and send it.
 */
const askAboutSelection = (s: { label: string }): void => { keep(`About ${s.label}: `); document.getElementById('view-chat-text')?.focus() }
/** The one card of the model the canvas has selected: null for none, several, or a node the model does not hold. Bound by id. */
const selectedRecord = (): string | null => {
  const ids = [...useCanvasStore.getState().selection.nodeIds], view = useViewStore.getState().view
  return ids.length === 1 && view?.model?.cards.some((c) => c.id === ids[0]) ? ids[0]! : null
}
armedIntent.cancel = () => { if ((useViewChat.getState().armed ?? null) !== null) useViewChat.setState({ armed: null }) }
/** Fixed chrome, said in the composer while a challenge waits for its card. */
export const PICK_A_CARD = 'pick a card on the canvas. Esc cancels.'
/** Core's typed challenge on ONE card of the model (the route a card's own Challenge uses). The words are only what returns to the box if it is not sent. */
function challengeCard(kind: ChallengeKind, record: string): void {
  useViewChat.setState({ armed: null })
  const label = useViewStore.getState().view?.model?.cards.find((c) => c.id === record)?.heading ?? ''
  const words = `${V10_METHODS.find((m) => m.key === kind)!.prefix}${label}`
  if (keptWhileBusy(words)) return
  void challenge(kind, record, words).then(keptIfNotSent(words))
  focusNodeById(record)
}
/**
 * "Challenge this idea" on an idea kept ON the model (a record of its form: menu brief UI-E, 18 Nov): core's typed challenge on that record,
 * the opposite case. Its words return to the box only if it is not sent. An idea kept before approval (a `kept:` row) has no record: the panel
 * puts its question in the box instead.
 */
export function challengeIdea(record: string, words: string): void {
  if (keptWhileBusy(words)) return
  void challenge('opposite', record, words).then(keptIfNotSent(words))
}

/**
 * A press on one of the composer's four challenge icons (menu brief UI-A, 18 Nov). They used to paste a prefix into the box, which nothing
 * read. Now: words already typed are still the person's own subject (the prefix goes before them, as before, and they send it); with an
 * empty box the challenge is core's typed one on the selected card, or (no single card selected) it waits for the next card picked. A
 * second press on a waiting icon, or Esc, cancels it. Any change Olumi proposes from it is held for the person's approval.
 */
export function pressChallenge(kind: ChallengeKind): 'prefixed' | 'sent' | 'armed' | 'cancelled' {
  const { text, armed } = useViewChat.getState()
  if (text.trim() !== '') { useViewChat.setState({ armed: null, text: withMethodPrefix(V10_METHODS.find((m) => m.key === kind)!.prefix, text) }); return 'prefixed' }
  if (armed === kind) { useViewChat.setState({ armed: null }); return 'cancelled' }
  const record = selectedRecord()
  if (record === null) { useViewChat.setState({ armed: kind }); return 'armed' }
  challengeCard(kind, record)
  return 'sent'
}
/** While a challenge waits: the next single card picked gets it; Esc, words typed or put in the box, or another scenario on screen, cancels it. */
function useArmedChallenge(): ChallengeKind | null {
  const armed = useViewChat((st) => st.armed ?? null)
  useEffect(() => {
    if (armed === null) return undefined
    const at = useViewStore.getState().uuid
    const pick = () => {
      if (useViewChat.getState().armed !== armed) return
      if (useViewStore.getState().uuid !== at) { useViewChat.setState({ armed: null }); return }
      if (useViewChat.getState().busy) return // Olumi is still answering: the challenge keeps waiting, never turned into a plain message
      // Words in the box are a new intent (Codex 008, 18 Nov): the waiting challenge stands down and the words stay.
      if (useViewChat.getState().text.trim() !== '') { useViewChat.setState({ armed: null }); return }
      const record = selectedRecord()
      if (record !== null) challengeCard(armed, record)
    }
    const typed = (st: ViewChatState, was: ViewChatState) => { if (st.armed === armed && st.text !== was.text && st.text.trim() !== '') useViewChat.setState({ armed: null }) }
    const off = useCanvasStore.subscribe(pick), offView = useViewStore.subscribe(pick), offChat = useViewChat.subscribe(typed)
    return () => { off(); offView(); offChat() }
  }, [armed])
  // The waiting challenge is the Escape floor: any open surface closes first, whenever it opened; the next press cancels the wait.
  useEscapeFloor(armed !== null, () => useViewChat.setState({ armed: null }))
  return armed
}

/** A question from a kept idea (Codex 008e #2): put in the message box after whatever is typed, never sent; the person edits and sends it. */
export const prefillComposer = (text: string): void => {
  const f = useGuidanceStore.getState()._prefillChat
  if (f !== null) f(text)
  else { keep(text); revealOlumiSurface() }
}
let holders = 0

/**
 * While the tab, or the dock that holds it, is on the page it answers the canvas's asks (the coaching icons need one), as the /bff
 * Olumi tab did (00054 #3): with the dock collapsed too (lane audit 24), each ask then fronting the Olumi tab. Released when the last
 * holder leaves.
 */
export function useAnswersAsks(on = true): void {
  useEffect(() => {
    if (!on) return
    holders += 1
    useGuidanceStore.setState(ASKS)
    return () => {
      holders -= 1
      if (holders > 0) return
      const now = useGuidanceStore.getState(), gone: Record<string, null> = {}
      for (const [k, f] of Object.entries(ASKS)) if (now[k as keyof typeof ASKS] === f) gone[k] = null
      useGuidanceStore.setState(gone)
    }
  }, [on])
}

export type NextStep = V12NextStep

/**
 * The one step the panel pins: a proposal Olumi holds (checked first; nothing is kept until it is approved), else none. The newest reply's own
 * move is drawn once, at the end of that reply (Turn, MoveTap); the UI chooses no method, figure or invitation of its own (system spec P2).
 */
export function nextStepOf(view: View): NextStep | null {
  return nextStepFor(view)
}

export const NEXT_STEP_WORDS = {
  // R25 (Paul's 6 Nov test: no ✎ appeared while a proposal waited): say why, here, where the decision is (core holds edits by contract).
  // Paul, 20 Nov: one sentence, no waffle. Keeps R25's reason (edits wait while a proposal is open).
  approve: 'Check Olumi’s changes on the canvas: nothing changes, and figure edits wait, until you approve.',
} as const

/** The next step, highlighted at the top of the Olumi tab: its words and the one control that does it. */
/**
 * Contract 3: the one row of Olumi's waiting proposal. A button (core's heading · on) opens and closes it; keyed on the proposal, so a new one
 * starts closed. Its body stays mounted while closed (the person's ticks and reading choices are kept) and is `hidden`; while open it is
 * `display: contents` (olumiLook.css), so the step's words, the change list and the actions are the pinned column's own items and the list
 * keeps its bounded scroll (Codex 15 Nov: a block wrapper, as a <details> body is, let the list grow and the whole box scroll instead).
 */
export function ProposalReview({ p, busy, evidence }: { p: NonNullable<View['proposal']>; busy: boolean; evidence: View['evidence'] }) {
  const [open, setOpen] = useState(false)
  const body = `view-proposal-body-${p.id}`
  const self = useRef<HTMLDivElement>(null)
  // The list opens ABOVE the one line at the foot, so an opened review starts at its first words (Codex 15 Nov, held 329, nine changes: a long
  // list is the box's own scroll). Readings, where held, are placed by their own rule (Proposal's land), which this leaves alone.
  useLayoutEffect(() => {
    if (!open) return
    const box = self.current?.closest<HTMLElement>('.ok-pinned') ?? null
    if (box !== null && box.querySelector('[data-reading-row]') === null) box.scrollTop = 0
  }, [open])
  // ONE line (17 Nov, the calm panel): Olumi's mark in --info, core's heading and version, Review (opens the list), then Approve as the one green
  // filled button and Set aside as an icon (Proposal's actions). The mark is beside core's words, never in their place.
  const lead = (
    <>
      <HoverButton words={p.on === '' ? p.heading : `${p.heading} · ${p.on}`} type="button" className="flex min-h-7 min-w-0 flex-[1_1_12rem] cursor-pointer items-center gap-2 text-left" data-testid="view-proposal-row"
        aria-expanded={open} aria-controls={body} onClick={() => setOpen((o) => !o)}>
        <OkIcon id="olumi-mark" size={16} decorative />
        {/* One flowing run: the heading, the dot and the version wrap together, never three flex columns (DL look at 1500x904 at 1.33). It wraps and is never cut: Paul, 19 Nov. */}
        <span className="min-w-0 flex-1 break-words" data-testid="view-proposal-words"><span className={`${typography.viewPanelHeading} text-text-header`} data-view="proposal.heading">{p.heading}</span>{p.on === '' ? null : <> · <span data-view="proposal.on">{p.on}</span></>}</span>
      </HoverButton>
      <button type="button" className={`${VIEW_CHIP_CLASS} ok-review-toggle`}
        data-testid="view-proposal-review-toggle" aria-expanded={open} aria-controls={body} onClick={() => setOpen((o) => !o)}>
        Review<FoldChevron open={open} />
      </button>
    </>
  )
  return (
    <div ref={self} className="ok-row-review" data-testid="view-proposal-review" data-open={open ? 'true' : 'false'}>
      {/* PANEL-SPEC 1: closed, the body draws only core's alerts and the actions, so Approve is in view at rest; open, the step's words, the
          change list and the readings join them, above the line. The Proposal stays mounted either way, so ticks and reading choices are kept. */}
      <div id={body} data-review-body="">
        {open ? <p>{NEXT_STEP_WORDS.approve}</p> : null}
        <Proposal p={p} busy={busy} evidence={evidence} inRow open={open} onOpen={() => setOpen(true)} lead={lead} />
      </div>
    </div>
  )
}

/** The presses the menu and the next step share: one action system. A question is asked as one answered turn that may propose a change, held for approval (askMethod); "Let us give
 *  our figure first" opens its blind entry; the reply or the entry is brought into view once drawn. */
export function runMethod(id: string): void {
  const from = document.querySelector('[data-testid="view-chat"]')
  if (id === FIGURE_FIRST) void openFigureFirst().then(() => bringIntoView(from, 'view-figure-first-entry'))
  else void askMethod(id).then((sent) => { if (sent) bringIntoView(from, 'view-chat-latest') })
}

/** The tools folded in from the Reasoning tab. "Your brief" shows the brief's account (the brief panel on a first look, else the tab that holds
 *  the brief); "Review all inputs" opens the Model tab, the model's own inputs, to read and change there. Neither asks Olumi anything. */
export function runTool(id: ToolId): void {
  if (id === 'review_inputs') { useUIStore.getState().forceActivateOutputTab('diagnostics'); return }
  const { sid, view } = useViewStore.getState()
  if (sid !== null) useBriefPanelLeft.setState((st) => { const left = new Set(st.left); left.delete(sid); return { left } })
  if (!isFirstLook(view)) useUIStore.getState().forceActivateOutputTab('analysisNew')
}

/** The panel's one pinned step: the proposal Olumi holds, as ONE row (Contract 3, ONE-PLAN 15 Nov: the pending review collapses to one row; all changes
 *  can be read without approving). Closed at rest so the thread keeps its room; opening shows every change, its readings and Approve / Set aside.
 *  Every other next step is the newest reply's own, at that reply's end (system spec P2). */
function NextStepCard({ view, busy }: { view: View; busy: boolean }) {
  const p = view.proposal!
  return (
    <section className={`${typography.viewPanelBody} space-y-2`} data-testid="view-next-step" data-step="approve" aria-label="Next step">
      <ProposalReview key={p.id} p={p} busy={busy} evidence={view.evidence} />
    </section>
  )
}

/** The question the goal picker asks: the page's own words for core's `session.goals` (canon wave step 1). */
export const GOAL_QUESTION = 'What did you come here for?'

/**
 * What the team came for (canon wave step 1; Paul: asked at the start, always changeable). With no goal: one small row of core's goals,
 * in core's order and words. With one: a compact chip of core's words for it, which reopens the row to change it, and a clear (null).
 * Who set it is the chip's hover (`set_by`, a member's name). Nothing here touches the model.
 */
function SessionGoal({ session, held }: { session: Session; held: boolean }) {
  const [changing, setChanging] = useState(false)
  const goal = session.goal
  const choose = (id: string | null) => { setChanging(false); if (id !== (goal?.id ?? null)) void chooseGoal(id) }
  if (goal !== null && !changing) {
    return (
      <div className="flex" data-testid="view-session-goal">
        <span className={`inline-flex items-center gap-1 rounded-lg border border-field bg-panel pl-2.5 pr-1 ${typography.viewPanelBody}`} data-testid="view-session-goal-chip">
          <OkIcon id="goal" size={14} decorative />
          <HoverButton words={session.set_by === null ? undefined : `Set by ${session.set_by}`} type="button" disabled={held} onClick={() => setChanging(true)}
            aria-label={`${GOAL_QUESTION} ${goal.text}. Change it`} data-testid="view-session-goal-change"
            className="py-1 text-text-body hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info aria-disabled:text-text-light aria-disabled:cursor-not-allowed">
            <span data-view="session.goal.text">{goal.text}</span>
          </HoverButton>
          <HoverButton words={`Clear: ${goal.text}`} type="button" disabled={held} onClick={() => choose(null)} aria-label={`Clear: ${goal.text}`} data-testid="view-session-goal-clear"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info aria-disabled:text-text-light aria-disabled:cursor-not-allowed">
            <OkIcon id="clear-goal" size={14} decorative inherit />
          </HoverButton>
        </span>
      </div>
    )
  }
  // The question, then core's goals two by two: the dock is too narrow for four on one line, and a wrapped row reads ragged.
  return (
    <div role="group" aria-labelledby="view-session-goal-question" className="space-y-2" data-testid="view-session-goal">
      <p id="view-session-goal-question" className={`${typography.chatMeta} text-text-light`}>{GOAL_QUESTION}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {session.goals.map((g, i) => (
          <button key={g.id} type="button" disabled={held} onClick={() => choose(g.id)} aria-pressed={g.id === goal?.id}
            className={VIEW_CHIP_CLASS} data-goal={g.id} data-testid="view-session-goal-option">
            <span data-view={`session.goals.${i}.text`}>{g.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** The menu's name for assistive technology; on screen it is the question glyph (visual indicators, not default text: Paul, 24 Oct). */
export const MENU_NAME = 'Questions to explore with Olumi'
/** What the quiet emphasis on a question means, for its hover and for assistive technology. */
export const FIRST_FOR_GOAL = 'Suits what you came here for'

/**
 * R25 spacing roles on this tab (plan v3 item 3; one value per role, alpha surfaces only): sections 16px (space-y-4, the tab's p-4);
 * a card's padding 12px (p-3); related items 8px (space-y-2); a label to its content 4px (space-y-1). The waiting change sits inside the
 * Next step card with no second border or padding of its own (the double padding is gone).
 */
/** The thread and the Next step. The ways in to Olumi's questions are the composer's ⋯ menu (V12: one action system). */
export function ViewChat() {
  useAnswersAsks()
  const floating = useChatFloat((s) => s.floating)
  const view = useViewStore((s) => s.view), error = useViewStore((s) => s.error)
  const busy = useViewChat((s) => s.busy), past = useViewStore((s) => s.at), sid = useViewStore((s) => s.sid)
  const savedExpectationCount = useSavedExpectationCount()
  const surface = useFindingSurface()
  const held = busy || past !== null
  // "Let us give our figure first": the entry and Olumi's figure shown instead are this scenario's only; the side by side is the View's.
  const ff = view === null ? null : figureFirstOf(view)
  const uuid = useViewStore((s) => s.uuid)
  const ffMine = useFigureFirst((s) => s.uuid === uuid)
  const ffOpen = useFigureFirst((s) => s.entry !== null || s.said !== null || s.reading)
  const ffShown = useFigureFirst((s) => s.shown !== null)
  const tab = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const follows = useRef(true)
  const followedTop = useRef<number | null>(null)
  // Contract 3 (Codex 15 Nov): where the person last scrolled the thread themselves. The thread at rest is never moved above it, on this or
  // any later rest (a reply growing, a step drawn), until they scroll again; null until they first do.
  const readerTop = useRef<number | null>(null)
  // A save receipt not yet brought into view (each save is a new notice, even of the same version). The first rest that draws its receipt
  // brings it into view over the reader's floor, once; until then the floor stands (Codex 15 Nov, round 3).
  const receiptDue = useRef(false)
  const [away, setAway] = useState(false)
  const readScroll = useCallback(() => {
    const el = scroll.current
    if (el === null) return
    // An automatic scroll to a long reply's start still follows it (pre-screen 4b92d394 row 14).
    if (follows.current && el.scrollTop === followedTop.current) return
    followedTop.current = null
    readerTop.current = el.scrollTop
    const gap = el.scrollHeight - el.clientHeight - el.scrollTop
    follows.current = gap <= 80
    setAway(gap > 80)
  }, [])
  const toLatest = useCallback(() => {
    const el = scroll.current
    if (el === null) return
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
    followedTop.current = el.scrollTop
    follows.current = true
    setAway(false)
  }, [])
  const followNewest = useCallback(() => {
    const el = scroll.current
    if (el === null) return
    if (!follows.current) { setAway(true); return }
    // A job the saved row already draws (its message and failure; only Try again added) is not the newest message: his message is
    // (DL 1128 fault 3: following the job's Try again scrolled his own message out of view above the pinned proposal).
    const job = el.querySelector<HTMLElement>('[data-testid="view-chat-turn-job"]:not([data-shown]):not([data-reply-visible])')
    // Contract 3 (Codex 15 Nov): the newest REPLY's first line, never the person's message drawn above it in the same turn.
    const latest = el.querySelector<HTMLElement>('[data-testid="view-chat-latest"]')
    // The answer first, the early reply only where there is no answer yet (one query each: a comma list would pick DOM order, and the early
    // reply is drawn above the answer; Codex 15 Nov, round 2).
    const newest = job ?? el.querySelector<HTMLElement>('[data-latest-floor]') ?? latest?.querySelector<HTMLElement>('[data-testid="view-chat-answer"]') ?? latest?.querySelector<HTMLElement>('[data-testid="view-chat-early"]') ?? latest
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight)
    let top = newest === null ? maxScroll : newest.offsetTop - 16
    // Contract 3 (ONE-PLAN, 15 Nov: "the newest reply opens on its first line"; as the old look): the thread never carries past the newest
    // reply's (or job's) first line. Supporting material stays outside the thread. The person's own save (below) still
    // wins: its receipt is what they look for.
    if (newest !== null) top = Math.min(top, newest.offsetTop - 16)
    // DL journey (4): a save's receipt and what it changed (ModelNoticeLine, after the newest line) come into view as the step does: whole,
    // or from its top where it is taller than the thread.
    const saved = job === null ? el.querySelector<HTMLElement>('[data-testid="view-model-notice-block"]') : null
    // The person's own save is what they look for; it remains a conversation turn.
    if (saved !== null) {
      const first = top, own = Math.min(saved.offsetTop - 16, Math.max(top, saved.offsetTop + saved.offsetHeight + 16 - el.clientHeight))
      // Where the receipt would slice the reply (its top lands inside the reply's body), the reply's first line wins: a half-cut headline
      // is worse than a receipt a scroll away (audit chat-1). Where the reply would be wholly above the thread, nothing is cut: the receipt wins.
      // Nor is a short line left scrolled out above the thread (Paul 19 Nov, a lost reply half under the strip): where, from its first line, the whole line and the
      // top of the receipt both stand in the thread, it starts there and the receipt follows it. A line the page has not measured (height 0) has nothing to cut.
      const wholeLine = newest !== null && newest.offsetHeight > 0 && newest.offsetTop + newest.offsetHeight <= first + el.clientHeight && saved.offsetTop + 16 <= first + el.clientHeight
      const cuts = newest !== null && own > newest.offsetTop && (own < newest.offsetTop + newest.offsetHeight || wholeLine)
      top = cuts ? first : own
    }
    // Someone who has scrolled on themselves (readerTop, contract 3) is never pulled back above where they scrolled, except to bring the
    // receipt of a save they have just made into view, once; the floor is then theirs again from where that leaves them.
    if (saved !== null && receiptDue.current) { receiptDue.current = false; readerTop.current = null }
    else top = Math.max(top, readerTop.current ?? -Infinity)
    el.scrollTop = Math.max(0, Math.min(maxScroll, top))
    followedTop.current = el.scrollTop
    setAway(false)
  }, [])
  // Start long replies at their first lines, without moving someone reading back (pre-screen 4b92d394 row 14).
  const turns = view?.chat.length ?? 0, lastTurn = view?.chat[turns - 1]?.id ?? null, job = view?.turn?.job ?? null
  // The model-less floor and the early answer redraw the thread too (14 Nov): a new reply there is followed like a new turn.
  const floor = floorShown(view)
  const floorKey = floor.map((f) => f.job).join(',') + '|' + (earlyOf(view?.draft) === null ? 0 : 1) + (view?.draft?.status ?? '')
  // The View can show initial text while the job is still open. Match it by job, or by the job's linked chat row.
  const entry = job === null ? undefined : entriesOf(view?.draft)?.find((row) => row.job === job && row.proposal !== null)
  const savedReply = entry === undefined ? undefined : view?.chat.find((row) => row.id === entry.proposal && row.by_id === entry.by_id)
  const replyVisible = isAnswering(view) && (floor.some((row) => row.job === job && row.unanswered === undefined) ||
    (savedReply !== undefined && (earlyOf(savedReply) !== null || savedReply.answer?.answer.some((part) => 'text' in part && part.text.trim() !== '') === true)))
  const noticeKey = useModelNotice((s) => (s.notice === null ? '' : `${s.notice.kind}:${s.notice.n}`))
  const sinceTo = useViewStore((s) => s.view?.model?.run?.since?.to.n ?? null)
  // The person's own save is what they look for (DL journey (4)): each new notice (a new object, even for the same version) makes its
  // receipt due, so the rest that draws it brings it into view over the reader's floor (Codex 15 Nov, rounds 2 and 3). A notice going away
  // makes nothing due. Declared first: it runs before the rest below.
  const notice = useModelNotice((s) => s.notice)
  useEffect(() => { if (notice !== null) receiptDue.current = true }, [notice])
  useEffect(followNewest, [turns, lastTurn, job, followNewest, floating, noticeKey, notice, sinceTo, floorKey, replyVisible])
  // Replies and cards can grow without adding a turn (pre-screen 4b92d394 row 15).
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || content.current === null) return
    const observer = new ResizeObserver(followNewest)
    observer.observe(content.current)
    // The thread's own height changes too (the review row opening or closing in the pinned box below): rest again (Codex 15 Nov).
    if (scroll.current !== null) observer.observe(scroll.current)
    return () => observer.disconnect()
  }, [followNewest, floating])
  // Return focus to the pop-out control after docking (A2 stop/float, DL 10 Nov).
  const wasFloating = useRef(floating)
  useEffect(() => {
    if (wasFloating.current && !floating) document.querySelector<HTMLButtonElement>('[data-testid="view-chat-popout"]')?.focus()
    wasFloating.current = floating
  }, [floating])
  // The View moved on while the entry is open (a new version, the offer gone, a goal set): read the entry again while core still offers
  // it, else close it (their figure then stands beside Olumi's, drawn from the View). Read against the signature it was opened with.
  const signature = view?.signature ?? null
  useEffect(() => {
    const st = useFigureFirst.getState()
    if (st.entry === null || st.uuid !== useViewStore.getState().uuid || signature === null || st.signature === signature) return
    if (ff?.offer == null) closeFigureFirst()
    else void openFigureFirst()
  }, [signature]) // eslint-disable-line react-hooks/exhaustive-deps
  const give = () => void giveFigureFirst().then((sent) => { if (sent) bringIntoView(tab.current, 'view-figure-first-given') })
  const show = () => void showOlumiFigure().then((sent) => { if (sent) bringIntoView(tab.current, 'view-figure-first-shown') })
  // P2 (system spec): the panel pins only a proposal Olumi holds. The reply's own next step is drawn once, at that reply's end.
  const step = view === null ? null : nextStepOf(view)
  const pinned = step?.kind === 'approve'
  const chat = (
    <div ref={tab} className="flex flex-1 min-h-0 flex-col" data-testid="view-chat">
      {/* Catch up (overnight/journey SYNTHESIS item 4): one quiet row of counts at the very top, one press to the scenario record in the
          history panel; drawn only when there is something to catch up on. It repeats nothing below it (no Next step, no conclusion words). */}
      <CatchUp />
      {/* Above the conversation only where the model has a calculated result: with none, the finding is a status the reply's lead already says, and
          it is said once here (it stays on the question card and on Analysis). */}
      {surface !== 'panel' ? null : <div className="relative z-10 shrink-0 border-b border-panel-border bg-panel px-4 pb-2 pt-1" data-testid="view-chat-finding"><FindingLine model={view?.model} at="panel" /></div>}
      {/* Only conversation turns live in the thread; supporting panels open at its foot. */}
      <div className="relative flex flex-1 min-h-0 flex-col" data-thread-wrap="">
        <div ref={scroll} onScroll={readScroll} data-testid="view-chat-scroll" className="relative flex-1 min-h-0 overflow-y-auto px-3 py-4">
          <div ref={content} className="space-y-6">
            {/* A read that failed says so, before a View or after a good one (lane audit 5.4). */}
            {error === null ? null : <p role="alert" data-testid="view-chat-unread">{error}</p>}
            {/* The newest reply's own move, once, at the end of that reply: the filled button, unless Olumi's proposal is pinned (then it is the one filled button). */}
            {view === null ? null : <ViewConversation chat={view.chat} floor={floor} draft={view.draft} moves primary={!pinned} me={view.you_id} />}
            {/* P1: ONE waiting mount from Send through acceptance: before core accepts, `turn` is null; the same element then takes core's turn (no remount, so the loader and its seconds never restart). */}
            {view?.turn == null && !(busy && !takesBrief(sid, view)) ? null : <TurnInFlight turn={view?.turn ?? null} me={view?.you_id ?? null} shown={view === null || view.turn == null ? false : turnAlreadyShown(view)} replyVisible={replyVisible} />}
            {/* DL journey (4): the model's newest saved version and what it changed, after the thread's newest line (brought into view when it
                lands, below), so the person sees it where they are reading. */}
            <ModelNoticeLine />
          </div>
        </div>
      </div>
      {/* "Latest" sits in its own row under the thread, never over it: drawn over the scroller it covered the review's words at 1232 (DL 15 Nov). */}
      {away ? (
        <div className="flex shrink-0 justify-end px-4 pt-1" data-testid="view-chat-latest-row">
          <OkIconButton id="go-latest" tone="ghost" words="Go to the latest message" testid="view-chat-to-latest" className="ok-to-latest" onClick={toLatest} />
        </div>
      ) : null}
      {/* Person-opened forms dock above the quiet row; none belongs to the conversation. */}
      <div className="ok-form-foot" data-testid="view-chat-form">
        <CommitFormFoot />
        {ffMine && ffOpen ? <FigureFirstEntryPanel held={held} onGive={give} onShow={show} onClose={closeFigureFirst} /> : null}
        {ffMine && ffShown ? <FigureFirstShownPanel onClose={() => useFigureFirst.setState({ shown: null })} /> : null}
        {ff?.given == null ? null : <FigureFirstSideBySide given={ff.given} headings={ff.headings} />}
      </div>
      {/* CatchUp only opens the history panel, with no inline open area. Use the permitted foot-row fallback
          for kept ideas and intake rather than rewriting CatchUp and its history-panel contract. */}
      <ChatFootRow key={view?.id ?? ''} sources={[
        { id: 'proposal', label: 'Olumi’s proposal', icon: 'olumi-mark', count: pinned ? 1 : 0,
          content: view === null || !pinned ? null : <NextStepCard view={view} busy={busy} /> },
        { id: 'asks', label: 'Olumi asks', icon: 'ask-about-this', count: chatQuestionsOf(view?.model).length,
          content: <OlumiAsks
              key={view?.id ?? ''}
              scope={view?.id ?? ''}
              questions={chatQuestionsOf(view?.model)}
              body={(q) => <QuestionLine text={q.text} id={q.id} edit={q.edit as { prompt: string; ask: string } | null} />}
              held={held}
              // A question core sent typed (CONTRACT §3) carries its id (`answers`): the answer is bound to it on core's answer route (same op for the same words; a refusal is core's). Else today's message.
              // The question card draws no method row of its own (batch 2): the composer's one row is the place for a method.
              onAnswer={(q, answer) => { const id = q.answers ?? null, sid = useViewStore.getState().sid; return id === null || sid === null ? say(answer) : write(`answer:${id}`, answer, (op) => answerQuestion(sid, id, answer, op)) }} /> },
        { id: 'kept', label: 'Kept ideas', icon: 'idea-keep', count: keptIdeasOf(view).length, content: <KeptIdeas /> },
        { id: 'intake', label: 'What you said', icon: 'file-read', count: view?.model == null ? 0 : intakeOf(view).length, content: <IntakeSheet /> },
        { id: 'expectation', label: EXPECTATION_WORDS.expect, icon: 'committed', count: savedExpectationCount, content: <CommitFormSlot /> },
      ]} />
    </div>
  )
  // The dock keeps only its return control; one thread and composer (A2 stop/float, DL 10 Nov).
  return <>
    {floating ? <div className="flex justify-end px-2 pt-1"><ChatDockBack /></div> : null}
    <ChatFloatHost composer={<ViewComposerBody />}>{chat}</ChatFloatHost>
  </>
}

/** The newest line of the conversation about the model's version: the person's own approval saved, or another member's approval arrived. */
function ModelNoticeLine() {
  const notice = useModelNotice((s) => s.notice), sid = useViewStore((s) => s.sid)
  const since = useViewStore((s) => s.view?.model?.run?.since ?? null)
  if (notice === null || notice.sid !== sid) return null
  // DL journey (4): under the receipt, what the new version changed, as core compares it with the one before (`run.since`: whose figure
  // changed, and each chance that moved, in core's words), where core's comparison is of this very version. Nothing is computed here.
  return (
    <div className="space-y-2" data-testid="view-model-notice-block">
      <p role="status" className={`${typography.viewPanelMeta} text-text-header`} data-testid="view-model-notice" data-notice={notice.kind}>{noticeWords(notice)}</p>
      {since === null || since.to.n !== notice.n ? null : <SinceVersion since={since} movedFirst dense />}
    </div>
  )
}

// A brief's drafting is said on the board (DraftingBoard.tsx, the View's `draft.words`); no UI words for it here.
// While a message is in flight the thread's one waiting line (TurnInFlight) says it: the brand loader, the words and the seconds, from Send through acceptance.
export const THINKING_WORDS = 'Olumi is thinking…'

/** What a first-time person needs before their brief (lane C, Paul 3 Nov: understood within a minute): what to write and what happens. */
/** The composer's one sentence once there is something to ask about (V12 boards); the brief's example stays for the first brief. */
export const COMPOSER_PLACEHOLDER = 'Ask about your thinking…'
export const BRIEF_INTRO = 'Describe the situation in your own words: the options you are weighing, what you are aiming for, and any figures you know. Olumi builds a model from it for you to check and change.'
export const BRIEF_EXAMPLE = 'For example: should we hire a second engineer now or wait until next quarter? We need the release out by June, and each engineer ships about two features a month.'

/**
 * The composer on the core lane, in the dock's footer in place of the /bff conversation's (review 00052 #3): a brief while core holds
 * no model for this scenario, else a message. It keeps the footer's run control (`analysisAction`, the dock's canonical runner).
 */
export function ViewComposer({ analysisAction }: { analysisAction?: AIInputBarProps['analysisAction'] }): ReactNode {
  const floating = useChatFloat((s) => s.floating)
  return floating ? null : <ViewComposerBody analysisAction={analysisAction} />
}

// The same composer in either surface (A2 stop/float, DL 10 Nov).
function ViewComposerBody({ analysisAction }: { analysisAction?: AIInputBarProps['analysisAction'] }): ReactNode {
  const sid = useViewStore((s) => s.sid), view = useViewStore((s) => s.view), error = useViewStore((s) => s.error), past = useViewStore((s) => s.at)
  const { text, busy, said, prefilled } = useViewChat()
  const popped = useChatFloat((st) => st.floating)
  const drafting = isDrafting(view), answering = isAnswering(view)
  // A scenario whose View is not read yet (its first read failed): what it holds is unknown, so nothing is sent until it is (Codex r1 #4).
  const unknown = sid !== null && view === null
  const held = busy || past !== null || (drafting && !onFloor(view)) || unknown // a model-less build no longer holds the composer: a message is answered or refused by core
  const box = useRef<HTMLTextAreaElement>(null)
  // The paperclip (Paul, 15 Nov: "I don't want to lose the functions and the icons within the AI panel text box"): one file read in this browser,
  // its text added to the box for the person to check before they send (BriefDocumentUpload, the old composer's own reader); nothing is uploaded.
  // #26: the read belongs to the page it was chosen on (the scenario's address, as `act` binds a write); one that ends after a move adds nothing.
  const page = useViewStore((s) => s.uuid)
  const attach = useBriefDocumentUpload({ draft: text, setDraft: (t) => useViewChat.setState({ text: t }), onAdded: () => box.current?.focus(), inChat: !takesBrief(sid, view), page })
  // Fit up to six lines, including restored text; clearing returns to one (pre-screen 4b92d394 row 13).
  useEffect(() => {
    const el = box.current
    if (el === null) return
    el.style.height = 'auto'
    const css = getComputedStyle(el)
    const cap = (parseFloat(css.lineHeight) || 24) * 6 + (parseFloat(css.paddingTop) || 0) + (parseFloat(css.paddingBottom) || 0)
    el.style.height = text === '' ? '' : `${Math.min(el.scrollHeight, cap)}px`
    el.style.overflowY = el.scrollHeight > cap && text !== '' ? 'auto' : 'hidden'
  }, [text, unknown])
  const brief = takesBrief(sid, view)
  // A brief whose answer was lost before a reload is back in the box, with its op (restorePendingBrief); nothing is sent until Send.
  const me = useMe((m) => m.me)
  useEffect(() => { if (me !== null && sid === null) restorePendingBrief() }, [me, sid])
  // A message whose acceptance was lost before a reload is back in the box with its op (restorePendingTurn), once the View is read.
  const known = view !== null
  useEffect(() => { if (me !== null && sid !== null && known) restorePendingTurn() }, [me, sid, known])
  // A scenario waiting for its brief puts the person in the brief box (canvas A S6 D6), once no write holds it disabled (00065).
  useEffect(() => { if (brief && !busy) box.current?.focus() }, [brief, busy])
  // The dock's focus channel reaches this composer (review 00065 ledger).
  useEffect(() => registerDockedOlumiFocus(() => box.current?.focus()), [])
  const armed = useArmedChallenge()
  // An untouched prefill is not a draft: Escape clears it (one press, the one Escape rule). A word edited, added or deleted makes it the person's, and it is never discarded.
  useEscapeLayer(text !== '' && text === prefilled, () => useViewChat.setState({ text: '', prefilled: null }))
  if (sid !== null && view === null && error === null) return null
  const blocked = analysisAction !== undefined && !analysisAction.canRun && !analysisAction.isRunning
  const sendHeld = held || answering || text.trim() === ''
  const submit = () => { if (!sendHeld) void send() }
  // The four methods as icon buttons under the typing line (Paul, 15 Nov: "I don't want to lose the functions and the icons"): same rule as
  // "More ways" (they need a model; none for a brief, a model-less conversation or while a write holds the composer). What a press does: `pressChallenge`.
  const methods = view !== null && !held && !takesBrief(sid, view) && !onFloor(view)
  const session = view === null || brief ? null : sessionOf(view), menu = view === null || brief ? null : menuOf(view), build = buildOfferOf(view)
  // V12 boards: one sentence in the box once there is a model to ask about (it replaces the stage-by-stage lines); the first brief keeps its example.
  const placeholder = brief ? BRIEF_EXAMPLE : COMPOSER_PLACEHOLDER
  return (
    <div className={`${typography.viewPanelBody} px-4 pb-3 pt-2 space-y-2`} data-testid="view-composer">
      {said === null ? null : <p role="alert" data-testid="view-chat-said">{said}</p>}
      {/* While a write is in flight the composer is held: it says why (lane audit 5.7), in core's page's words. */}
      {past === null ? null : (
        <p className="flex flex-wrap items-center gap-2" data-testid="view-composer-past">
          <span>{PAST_HELD}</span>
          <button type="button" className="rounded-sm px-2 py-1 border border-panel-border" data-testid="view-composer-back" onClick={() => void useViewStore.getState().look(null)}>Back to the latest</button>
        </p>
      )}
      <label className={brief ? `${typography.viewPanelHeading} text-text-header` : 'sr-only'} htmlFor="view-chat-text">{brief ? 'Your brief' : 'Message Olumi'}</label>
      {/* What to write, until it is written: once the brief is sent, the box holds it and the board says what happens. */}
      {brief && !busy && !drafting ? <p id="view-brief-intro" className="text-text-body" data-testid="view-brief-intro">{BRIEF_INTRO}</p> : null}
      {/* Keep the first line compact as the brief or message grows (pre-screen 4b92d394 row 13). */}
      <div className="relative bg-panel border border-panel-border rounded-md transition-colors focus-within:border-text-light">
        {answering ? <span className="ok-composer-turn-line" data-testid="view-composer-turn-line" aria-hidden="true" /> : null}
        {/* 17 Nov (the calm panel): the selected card is a chip inside the composer, "About: <card heading>" with an X to clear it. */}
        <SelectionPill chip after={selectedRename} mark={selectedKindMark} onAsk={askAboutSelection} useQuiet={useDetailsOpenFor} />
        {/* A challenge waiting for its card says so here, in words (the pressed icon alone is not enough on touch or by keyboard). */}
        {armed === null ? null : <p role="status" className={`${typography.viewPanelMeta} m-0 px-3 pt-2 text-text-light`} data-testid="view-composer-armed">{V10_METHODS.find((m) => m.key === armed)!.label}: {PICK_A_CARD}</p>}
        <textarea ref={box} id="view-chat-text" className={`${typography.viewPanelBody} block w-full resize-none bg-transparent outline-none text-text-body placeholder:text-text-light pt-2 pb-1 px-3`}
          // The brief's example is what to write: shown whole until something is typed (it wraps; one row cut it mid-sentence at 1232, DL 10 Nov).
          rows={brief && !busy && !drafting && text === '' ? 3 : 1} value={text} placeholder={placeholder} aria-describedby={brief && !busy && !drafting ? 'view-brief-intro' : undefined} disabled={held}
          onChange={(e) => useViewChat.setState({ text: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} />
        <div className="flex items-center gap-1 px-2 pb-1.5" data-testid="view-composer-footer">
          {held ? null : <span className="flex items-center" data-testid="view-composer-attach">{attach.trigger}</span>}
          {!methods ? null : (
            <span role="group" aria-label="Ways to test the model" className="flex items-center gap-0.5" data-testid="view-composer-methods">
              {/* The four methods are the registry's method icons, neutral (Paul, 17 Nov: icons carry no hue); the method's own label is the hover. */}
              {V10_METHODS.map(({ key, label }) => (
                <OkIconButton key={key} id={METHOD_ICON[key]} words={label} pressed={armed === key} disabled={busy} testid={`view-composer-method-${key}`}
                  className={`h-7 w-7 rounded-md hover:bg-panel-hover${armed === key ? ' bg-panel-hover' : ''}`}
                  onClick={() => { if (pressChallenge(key) === 'prefixed') box.current?.focus() }} />
              ))}
            </span>
          )}
          {/* V12 one action system: the ⋯ opens core's questions in core's order, what they came for, and the tools folded in from the Reasoning
              tab (it replaces the "More ways" disclosure). Core sends no session block, or the scenario has no model yet: no ⋯. */}
          {menu === null || session === null ? null : (
            <ActionsMenu menu={menu} held={held} onMethod={runMethod} onTool={runTool} goal={<SessionGoal session={session} held={held} />} build={build === null ? undefined : { ...build, onPress: () => void buildModel() }} />
          )}
        <div className="ml-auto flex flex-none items-center justify-end gap-1" data-testid="view-composer-actions">
          {/* v10 review item 10: the popout moved here from a 44 px strip above every conversation; same control, same test id, drawn in the composer's icon row. */}
          {popped ? null : (
            <OkIconButton id="popout" words={CHAT_POPOUT_LABEL} hover={CHAT_POPOUT_TITLE} testid="view-chat-popout" className="h-7 w-7 rounded-md hover:bg-panel-hover" onClick={popOutChat} />
          )}
          {/* P5 (system spec): the ONE entry to Record what you will do, an icon beside the other right-side icons (its words are the hover); the form opens in the thread. */}
          <RecordStepButton />
          {analysisAction === undefined ? null : (
            <OkIconButton id="run-analysis" words={blocked ? analysisAction.blockedReason ?? analysisAction.label : analysisAction.label} active={analysisAction.isRunning} testid="view-composer-analyse"
              className={`h-7 w-7 rounded-md hover:bg-panel-hover${analysisAction.isRunning ? ' [&_svg]:animate-spin' : ''}`} disabled={past !== null || analysisAction.isRunning || !analysisAction.canRun} onClick={analysisAction.onRun} />
          )}
          {/* Words-start (17 Nov): the one deliberate choice for a new brief, beside Send; Send still builds a model (the default). */}
          {!brief ? null : (
            <HoverButton words={TALK_FIRST_HOVER} type="button" disabled={sendHeld} data-testid="view-composer-talk-first" onClick={() => { if (!sendHeld) void send(true) }}
              className={`${typography.viewPanelHeading} inline-flex min-h-7 items-center gap-1.5 rounded-md px-2 text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header aria-disabled:cursor-default`}>
              <OkIcon id="talk-first" size={14} inherit />{TALK_FIRST}
            </HoverButton>
          )}
          <button type="button" disabled={sendHeld} aria-label="Send" data-testid="view-composer-send" onClick={submit}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${controls.act}`}>
            <OkIcon id="send" inherit decorative /><span className="sr-only">Send</span>
          </button>
        </div>
        </div>
      </div>
      {/* What the file added and the way to take it out again, only once a file was read (or failed). */}
      {attach.feedback}
    </div>
  )
}

/** The registry's method icons, on v10's four methods in the same order (neutral: icons carry no hue). */
const METHOD_ICON: Readonly<Record<(typeof V10_METHODS)[number]['key'], 'method-challenge' | 'method-opposite' | 'method-disprove' | 'method-outside'>> = { assumption: 'method-challenge', opposite: 'method-opposite', disconfirming: 'method-disprove', outside: 'method-outside' }
