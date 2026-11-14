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
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { newOp, READ_FAILED, TeamApiError, UNCERTAIN_WRITE } from '../olumiCore/team/api'
import { registerDockedOlumiFocus } from '../canvas/conversation/dockedOlumiFocus'
import { writes, VIEW_SHAPE_CHANGED, type FigureFirstShown, type View, type ViewTurn } from './client'
import { replyHasNext } from './replyHasNext'
import { verdictOf } from './verdict'
import { useViewStore } from './store'
import { questionsOf } from './journey'
import { usePreMortemGate, useViewLens } from './lens'
import { figureFirstOf, newestNextOf, nextCardsOf, olumiKey, optionInFocusOf, restingRingOf, sessionOf, type Session } from './layout'
import { derivedUuidOf } from '../olumiCore/team/sid'
import { isForThisPage, useMe } from '../olumiCore/me'
import { useCanvasStore } from '../canvas/store'
import { setCurrentScenarioId } from '../canvas/store/scenarios'
import { scenarioIdWrite } from '../canvas/stores/unboundModelBinding'
import { typography } from '../styles/typography'
import { useGuidanceStore, withOlumiReveal } from '../canvas/stores/guidanceStore'
import { takeAskTargetBinding } from '../canvas/ui/inspector-v2/askTargetBinding'
import type { AIInputBarProps } from '../canvas/components/AIInputBar'
import { useUIStore } from '../stores/uiStore'
import { FigureEdit } from './FigureEdit'
import { V10_METHODS, withMethodPrefix } from '../presentation/V10MethodChips'
import { endRing, pointRing, restRing } from './ring'
import { Button } from '../components/ui/Button'
import { VIEW_NOTE_SLOT } from './note'
import { storiesHeadingOf, storiesOf } from './k5'
import { FIGURE_FIRST_CLOSED, FigureFirstEntryPanel, FigureFirstShownPanel, FigureFirstSideBySide, useFigureFirst } from './ViewFigureFirst'
import { noteSaved, noticeWords, useModelNotice } from './notice'
import { ArrowDown, ArrowRight, ArrowUp, ExternalLink, FlipVertical2, Globe, History, MessageCircleQuestion, RefreshCw, SearchX, Target, X, Zap } from 'lucide-react'
import { VIEW_CHIP_CLASS, VIEW_CHIP_PRIMARY_CLASS } from '../v5/blocks/chipClass'
import styles from '../canvas/conversation/Conversation.module.css'
import './look/olumiLook.css'
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
        ? <sup key={i} className={typography.viewPanelMeta} data-view-cite={`${at}.${i}.cite`} title={p.cite} aria-label={p.cite}>{n++}</sup>
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
export function Blocks({ parts, at, first = 1 }: { parts: Said; at: string; first?: number }) {
  const lines: Piece[][] = [[]]
  parts.forEach((p, i) => {
    if ('cite' in p) { lines[lines.length - 1]!.push({ kind: 'cite', i, cite: p.cite }); return }
    p.text.split('\n').forEach((s, k) => { if (k > 0) lines.push([]); if (s !== '') lines[lines.length - 1]!.push({ kind: 'text', i, k, s }) })
  })
  let n = first
  const draw = (line: Piece[], strip: boolean) => line.map((x, j) => {
    if (x.kind === 'cite') return <sup key={j} className={typography.viewPanelMeta} data-view-cite={`${at}.${x.i}.cite`} title={x.cite} aria-label={x.cite}>{n++}</sup>
    const s = strip && j === 0 ? x.s.replace(/^\s*- /, '') : x.s
    return <span key={j} data-view={x.k === 0 ? `${at}.${x.i}.text` : `${at}.${x.i}.text.${x.k}`}>{s}</span>
  })
  const isItem = (line: Piece[]) => line[0]?.kind === 'text' && /^\s*- /.test(line[0].s)
  // Group: blank lines end a paragraph; consecutive "- " lines make one list.
  const groups: { list: boolean; lines: Piece[][] }[] = []
  for (const line of lines) {
    if (line.length === 0) { groups.push({ list: false, lines: [] }); continue }
    const list = isItem(line), last = groups[groups.length - 1]
    if (last && last.lines.length > 0 && last.list === list) last.lines.push(line); else groups.push({ list, lines: [line] })
  }
  return (
    <>
      {groups.filter((g) => g.lines.length > 0).map((g, gi) => (g.list
        ? <ul key={gi} className="m-0 list-disc space-y-1 pl-5" data-reply-list="">{g.lines.map((l, li) => <li key={li}>{draw(l, true)}</li>)}</ul>
        : <p key={gi} className="m-0" data-reply-para="">{g.lines.map((l, li) => <span key={li}>{li > 0 ? <br /> : null}{draw(l, false)}</span>)}</p>))}
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
      <p className={typography.panelHeader} data-view={`${at}.answer.stories_heading`}>{heading}</p>
      <ol className="space-y-2">
        {stories.map((st, i) => {
          const option = st.option === null ? null : headingOf(st.option)
          const rests = st.rests_on.flatMap((id) => { const h = headingOf(id); return h === null ? [] : [h] })
          return (
            <li key={i} data-story={i}>
              <p>{olumi === null ? null : <span className="text-info" title={olumi.text} aria-label={olumi.text} data-story-mark="">{olumi.glyph} </span>}<span data-view={`${at}.answer.stories.${i}.text`}>{st.text}</span></p>
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

/** Keep authorship before the reply (UI recovery witness row 11, DL 10 Nov). */
function Turn({ t, at, latest = false, moves = false, me }: { t: ViewTurn; at: string; latest?: boolean; moves?: boolean; me?: string | null }) {
  // The cards this turn's next step lit are cleared if the turn leaves the page while they are lit (Codex review dgai-v10 00002 ledger).
  const about = t.answer === null ? NO_CARDS : nextCardsOf(t.answer.next)
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
  const by = t.by_id === null || t.by === '' ? null : <p className={`ok-said-by ${typography.viewPanelMeta} ${other ? 'text-text-body' : 'text-text-light'}`} data-view={`${at}.by`}>{t.by}</p>
  const said = <div className={`${styles.messageBubbleUser} ok-said`} data-testid="view-chat-said-bubble">{by}<p className={typography.viewPanelBody} data-view={`${at}.said`}>{t.said}</p></div>
  // Olumi's reply carries Olumi's own mark (core's key item for Olumi, by its id: layout.ts olumiKey), in the margin beside its words.
  const model = useViewStore((st) => st.view?.model ?? null)
  const olumi = model === null ? null : olumiKey(model)
  // Each block's first cite number, in the reply's order: its answer, each Why line, its next step.
  const whyFirst: number[] = []
  let nextFirst = 1
  if (t.answer !== null) { nextFirst += citesIn(t.answer.answer); for (const w of t.answer.why) { whyFirst.push(nextFirst); nextFirst += citesIn(w) } }
  const answer = t.answer === null ? (reply === null ? null : (
    <p role="status" aria-live="polite" className={`${typography.viewPanelMeta} ${reply.status === 'running' ? 'text-text-light' : 'text-text-body'}`} data-testid="view-chat-reply" data-reply={reply.status}><span data-view="reply.words">{reply.words}</span></p>
  )) : (
    <div className={`${typography.viewPanelBody} ${styles.markdownContent} ${styles.v2AssistantText} ok-reply space-y-2`} data-testid="view-chat-answer">
      {olumi === null ? null : <span className="ok-reply-mark" role="img" aria-label={olumi.text} title={olumi.text} data-view={`${at}.answer.mark`}>{olumi.glyph}</span>}
      <Blocks parts={t.answer.answer} at={`${at}.answer.answer`} />
      {t.answer.why.length === 0 ? null : (
        <details>
          <summary>Why</summary>
          <ul className="list-disc pl-4">{t.answer.why.map((w, j) => <li key={j}><Words parts={w} at={`${at}.answer.why.${j}`} first={whyFirst[j]} /></li>)}</ul>
        </details>
      )}
      {/* v10: the cards this next step is about (core's `next.about`) are lit while it is pointed at; nothing else changes. */}
      <p tabIndex={about.length ? 0 : undefined} data-testid="view-chat-next" onMouseEnter={() => ring(true)}
        onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) ring(false) }} onFocus={() => ring(true)} onBlur={() => ring(false)}><span className={typography.panelHeader} data-view={`${at}.answer.next.label`}>{t.answer.next.label}</span> <Words parts={t.answer.next.text} at={`${at}.answer.next.text`} first={nextFirst} /></p>
      {moves && t.answer.next.newest ? <MoveTap turn={t.id} next={t.answer.next} /> : null}
      <Stories answer={t.answer} at={at} />
    </div>
  )
  // Who replied and the model version it read, under the reply, as DGAI's version chip (v10): core's words.
  const stamp = (
    <div className={`inline-flex items-center gap-1 text-text-light ${typography.chatMeta}`} data-testid="view-chat-version">
      <History size={12} aria-hidden="true" />
      <span><span data-view={`${at}.version`}>{t.version}</span>
        {t.status === null ? null : <> · <span data-view={`${at}.status`}>{t.status}</span></>}</span>
    </div>
  )
  return (
    <li data-view-turn={at} data-testid={latest ? 'view-chat-latest' : undefined} className="space-y-2">
      {said}{answer}{stamp}
      {t.broke === null ? null : <p data-view={`${at}.broke`}>{t.broke}</p>}
      {t.problem === null ? null : <p role="alert" data-view={`${at}.problem`}>{t.problem}</p>}
      {t.marks.map((m, j) => <p key={j} title={m.title}><span data-view={`${at}.marks.${j}.what`}>{m.what}</span>: <span data-view={`${at}.marks.${j}.status`}>{m.status}</span></p>)}
    </li>
  )
}

/** The conversation, oldest first, as the View holds it. */
export function ViewTurns({ chat }: { chat: View['chat'] }) {
  return (
    <ol className={`${typography.viewPanelBody} space-y-4`} data-testid="view-chat-turns">
      {chat.map((t, i) => <Turn key={t.id} t={t} at={`chat.${i}`} />)}
    </ol>
  )
}

/** Preserve the conversation's sequence and paths (UI recovery witness row 11, DL 10 Nov). */
export function ViewConversation({ chat, moves = false, me }: { chat: View['chat']; moves?: boolean; me?: string | null }) {
  if (chat.length === 0) return null
  const last = chat.length - 1
  return (
    <ol className={`${typography.viewPanelBody} space-y-4`} data-testid="view-chat-turns">
      {chat.map((t, i) => <Turn key={t.id} t={t} at={`chat.${i}`} latest={i === last} moves={i === last && moves} me={me} />)}
    </ol>
  )
}

/**
 * A turn Olumi is answering in core, or that ended unanswered (core API v1.28: the View's `turn`). Their words, then core's line verbatim
 * (`turn.words`) as a status, with the seconds since core accepted it (`started`, so a reload counts from the same moment). A failed or lost
 * turn shows core's plain reason and Try again (the same words, a new op). No word here is the page's own but the Try again control.
 */
export function TurnInFlight({ turn, me }: { turn: NonNullable<View['turn']>; me: string | null }) {
  const running = turn.status === 'answering'
  const busy = useViewChat((s) => s.busy)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [running])
  const from = Date.parse(turn.started), secs = Number.isFinite(from) ? Math.max(0, Math.floor((now - from) / 1000)) : null
  return (
    <ol className={`${typography.viewPanelBody} space-y-4`} data-testid="view-chat-turn-job" data-turn={turn.status}>
      <li className="space-y-1">
        {/* DL-538: the bubble names whose words it holds, inside it, as a saved turn's does (Turn); with no words, the name stands alone. */}
        {turn.said === null
          ? (turn.by_id === me ? null : <p className={typography.viewPanelMeta} data-view="turn.by">{turn.by}</p>)
          : <div className={`${styles.messageBubbleUser} ok-said`}>{turn.by === '' ? null : <p className={`ok-said-by ${typography.viewPanelMeta} ${turn.by_id === me ? 'text-text-light' : 'text-text-body'}`} data-view="turn.by">{turn.by}</p>}<p className={typography.viewPanelBody} data-view="turn.said">{turn.said}</p></div>}
        <p role="status" aria-live="polite" className={`${typography.viewPanelMeta} ${running ? 'text-text-light' : 'text-text-body'}`}>
          <span data-view="turn.words" data-testid="view-chat-turn-words">{turn.words}</span>
          {running ? <span aria-hidden="true" className="ml-2 inline-flex gap-1 motion-safe:animate-pulse" data-testid="view-chat-dots"><span className="h-1 w-1 rounded-full bg-current" /><span className="h-1 w-1 rounded-full bg-current" /><span className="h-1 w-1 rounded-full bg-current" /></span> : null}
          {running && secs !== null ? <span aria-hidden="true" className="tabular-nums" data-testid="view-chat-turn-seconds"> {secs} s</span> : null}
        </p>
        {running || turn.said === null || turn.by_id !== me || turn.ask !== 'message' ? null
          : <button type="button" disabled={busy} data-testid="view-chat-turn-again" onClick={() => void sayAgain()} className="min-h-[44px] rounded-md border border-border px-4 text-info hover:bg-panel-hover disabled:text-text-light disabled:cursor-not-allowed">Try again</button>}
      </li>
    </ol>
  )
}

/** The change card for the proposal Olumi holds, with core's words and marks, and the two acts on it. */
type Change = NonNullable<View['proposal']>['changes'][number]
/** A line's key: its id and whether it is a top-level field, since a record named like a field gives two lines with one id (API v1.9). */
const keyOf = (c: Change) => `${c.top ? 'top' : 'rec'}:${c.id}`

/**
 * One change line of core's change card (View `proposal.changes`, L8): its tick, core's line, and what a tap opens (`detail`), with Olumi's
 * mark on a line of Olumi's. Every word is core's.
 */
function ChangeLine({ c, i, ticked, toggle, busy }: { c: Change; i: number; ticked: boolean | null; toggle: (c: Change) => void; busy: boolean }) {
  // R4 (core v1.13): a line approved only with others carries core's why as its hover, verbatim (`together.why`).
  const why = c.together?.why ?? null
  const line = <><span data-view={`proposal.changes.${i}.text`} title={why ?? undefined} data-view-hover={why === null ? undefined : `proposal.changes.${i}.together.why`}>{c.text}</span>{c.olumi === null ? null : <> <span title={c.olumi.title} aria-label={c.olumi.title} data-view={`proposal.changes.${i}.olumi.glyph`}>{c.olumi.glyph}</span></>}</>
  return (
    <li className="flex items-start gap-2" data-change={keyOf(c)}>
      {/* R25 (24px targets): the box sits in a 24px label, the label the target. */}
      {ticked === null ? null : <label className="inline-flex min-h-[24px] min-w-[24px] flex-none cursor-pointer items-center justify-center" data-target-for={`view-change-tick-${i}`}><input type="checkbox" checked={ticked} disabled={busy} onChange={() => toggle(c)} aria-label={`Choose ${c.text}`} data-testid={`view-change-tick-${i}`} /></label>}
      {c.detail === '' ? <span>{line}</span> : (
        <details><summary className="cursor-pointer">{line}</summary><p className="whitespace-pre-line text-text-light" data-view={`proposal.changes.${i}.detail`}>{c.detail}</p></details>
      )}
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

export function Proposal({ p, busy, evidence }: { p: NonNullable<View['proposal']>; busy: boolean; evidence: View['evidence'] }) {
  // ORDER-UI-5 (5): core's words for the three actions where it sends them, so the coach's sentence and these buttons read one value.
  const actions = { keep: p.actions?.keep ?? READING_KEEP, use: p.actions?.use ?? READING_USE, approve: p.actions?.approve ?? APPROVE_WORD }
  // A proposal Olumi made on considering shared evidence (API v1.12) names who asked and the evidence, in its member's own words. Who asked is
  // core's words for them (`from.by`: "You", their name, "a former member"), never `asked_by`, which is their member id; a core that sends
  // no words names no one.
  const from = p.from == null ? null : { by: p.from.by ?? null, text: evidence.find((e) => e.id === p.from!.evidence)?.text ?? null }
  // A core before L8 serves no list (absent, never []): its card has Approve alone, as a proposal held without a list.
  const changes = p.changes ?? [], groups = p.groups ?? null
  // One line is the whole proposal: ticking it would only repeat Approve, so there are ticks from two lines (4 Nov drive at 1280).
  const tickable = changes.length > 1
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
  // ⛔ NEVER ORPHAN OLUMI'S FIGURE (R4, core v1.13 `together`): a line core marks as approved only with others is ticked and unticked with
  // them (the records named in its `together.ids`), so a tick can never leave the figure without the line that reads it.
  const withPartners = (c: Change): Change[] => { const ids = c.together?.ids ?? []; return [c, ...changes.flatMap((o) => (!o.top && ids.includes(o.id) ? [o] : []))] }
  const set = (n: Set<string>, cs: readonly Change[], on: boolean) => { for (const x of cs) { if (on) n.add(keyOf(x)); else n.delete(keyOf(x)) } }
  const toggle = (c: Change) => setTicked((t) => { const n = new Set(t); set(n, withPartners(c), !n.has(keyOf(c))); return n })
  const toggleGroup = (lines: number[], on: boolean) => setTicked((t) => { const n = new Set(t); for (const i of lines) { const c = changes[i]; if (c) set(n, withPartners(c), on) } return n })
  // The ticked lines, in core's order: a record's id in `only`, a top-level field's name in `only_top`, never mixed (API v1.8).
  const pick: { only: string[]; only_top: string[] } = { only: [], only_top: [] }
  for (const c of changes) if (ticked.has(keyOf(c))) (c.top ? pick.only_top : pick.only).push(c.id)
  const chosen = pick.only.length + pick.only_top.length
  const line = (i: number) => { const c = changes[i]!; return <ChangeLine key={keyOf(c)} c={c} i={i} ticked={tickable ? ticked.has(keyOf(c)) : null} toggle={toggle} busy={busy} /> }
  const verdict = verdictOf(p)
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
  // What the last approval whose answer never came sent (a dropped connection or a server error: core's `uncertain`). It may have been saved,
  // so only the same selection is sent again. A write core refused, or one that never left the page, was not saved: the person may change the
  // choices and approve again.
  const unsure = useRef<string | null>(null)
  const [refused, setRefused] = useState(false)
  const approve = (lines?: { only: string[]; only_top: string[] }) => {
    const every = { only: changes.flatMap((c) => (c.top ? [] : [c.id])), only_top: changes.flatMap((c) => (c.top ? [c.id] : [])) }
    const withReadings = onlyReadings.length + refuseReadings.length > 0
    const body = withReadings ? { ...(lines ?? every), ...(onlyReadings.length > 0 ? { only_readings: onlyReadings } : {}), ...(refuseReadings.length > 0 ? { refuse_readings: refuseReadings } : {}) } : lines
    const sent = JSON.stringify(body ?? null)
    if (unsure.current !== null && unsure.current !== sent && (/"(only|refuse)_readings"/.test(unsure.current) || withReadings)) { setRefused(true); return }
    setRefused(false)
    // After it is saved the controls go back to the original: the screen then draws the View core returns, never what was chosen here.
    void act(() => writes.approve(p.id, p.base, body).then((answer) => { unsure.current = null; setChoice({}); noteSaved(answer) }, (e: unknown) => { if (e instanceof TeamApiError && e.uncertain) unsure.current = sent; throw e }), true)
  }
  return (
    <div className={`${typography.viewPanelBody} space-y-2`} data-testid="view-chat-proposal">
      <div><span className={typography.panelHeader} data-view="proposal.heading">{p.heading}</span>{p.on === '' ? null : <> · <span data-view="proposal.on">{p.on}</span></>}
        {p.removed === null ? null : <> <span title={p.removed.title} data-view="proposal.removed.text">{p.removed.text}</span></>}</div>
      {from === null ? null : (
        <div className="text-text-light" data-testid="view-chat-proposal-from">
          {from.by === null ? null : <p>Asked by: <span data-view="proposal.from.by">{from.by}</span></p>}
          {from.text === null ? null : <p>From evidence: “<span data-testid="view-chat-proposal-from-evidence">{from.text}</span>”</p>}
        </div>
      )}
      {p.problem === null ? null : <p role="alert" data-view="proposal.problem">{p.problem}</p>}
      {readingIds.length === 0 ? null : <p className="text-text-light" data-testid="view-readings-note">{READINGS_NOTE}</p>}
      {p.marks.map((m, j) => {
        const words = <><span data-view={`proposal.marks.${j}.what`}>{m.what}</span>: <span data-view={`proposal.marks.${j}.status`}>{m.status}</span></>
        const id = m.reading?.id
        if (id === undefined || !readingIds.includes(id)) return <p key={j} title={m.title}>{words}</p>
        const choose = (on: boolean) => { setRefused(false); setChoice((c) => ({ ...c, [id]: on ? 'use' : 'keep' })) }
        const option = (on: boolean) => (
          <label className="inline-flex min-h-[24px] cursor-pointer items-center gap-1">
            <input type="radio" name={`view-reading-${p.id}-${j}`} checked={choice[id] === (on ? 'use' : 'keep')} disabled={busy} onChange={() => choose(on)} data-testid={`view-reading-${j}-${on ? 'use' : 'keep'}`} />
            {on ? actions.use : actions.keep}
          </label>
        )
        return (
          <fieldset key={j} className="m-0 grid min-w-0 gap-1 border-0 p-0" data-testid={`view-reading-${j}`}>
            <legend className="p-0">{words}</legend>
            {m.title === '' ? null : <p className="m-0 text-text-light" data-view={`proposal.marks.${j}.title`}>{m.title}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1">{option(false)}{option(true)}</div>
          </fieldset>
        )
      })}
      {changes.length === 0 ? null : groups === null
        ? <ul className="m-0 grid list-none gap-1 p-0" data-testid="view-changes">{changes.map((_, i) => line(i))}</ul>
        : (
          <ul className="m-0 grid list-none gap-1 p-0" data-testid="view-changes">
            {groups.map((g, gi) => {
              const all = g.lines.length > 0 && g.lines.every((i) => changes[i] !== undefined && ticked.has(keyOf(changes[i]!)))
              return (
                <li key={gi}>
                  {/* Closed at rest, a group opens on press (DL 11 Nov, replacing PL 7 Nov's open groups: 36 lines filled the panel). The heading
                      is core's, with its count and whose they are; Approve still approves every line, ticked or not, and a group's tick chooses it whole. */}
                  <details data-testid={`view-change-group-box-${gi}`}>
                    <summary className="cursor-pointer">
                      <label className="mr-1 inline-flex min-h-[24px] min-w-[24px] cursor-pointer items-center justify-center align-middle" onClick={(e) => e.stopPropagation()} data-target-for={`view-change-group-${gi}`}>
                        <input type="checkbox" checked={all} disabled={busy} onClick={(e) => e.stopPropagation()} onChange={() => toggleGroup(g.lines, !all)}
                          aria-label={`Choose every change under ${g.heading}`} data-testid={`view-change-group-${gi}`} />
                      </label>
                      <b data-view={`proposal.groups.${gi}.heading`}>{g.heading}</b>
                    </summary>
                    <ul className="m-0 mt-1 grid list-none gap-1 p-0 pl-3">{g.lines.map(line)}</ul>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      {/* V11 change 6: core's verdict on the change, before any approval (./verdict.ts). Not supported: core's words, what would support it,
          and no Approve; the person may still set it aside. */}
      {verdict === undefined ? null : (
        <div className="grid gap-1" data-testid="view-proposal-verdict" data-supported={verdict.supported}>
          <p className={verdict.supported ? 'text-text-body' : 'font-medium text-text-header'}>{verdict.text}</p>
          {verdict.asks === null ? null : <p className="text-text-light" data-testid="view-proposal-verdict-asks">{verdict.asks}</p>}
        </div>
      )}
      {readingIds.length === 0 || verdict?.supported === false ? null : (
        <p className="text-text-light" data-testid="view-readings-approve-says">
          {onlyReadings.length === 0 ? 'Approve keeps the original for every reading.' : `Approve uses Olumi’s reading for ${onlyReadings.length} of ${readingIds.length} and keeps the original for the rest.`}
          {' '}Approving records {you === null || you === '' ? 'you' : you} as the person who approved, never as the author of what Olumi read or proposed.
        </p>
      )}
      {refused ? <p role="alert" data-testid="view-readings-refused">{READINGS_CHANGED}</p> : null}
      <div className="flex flex-wrap gap-2">
        {verdict?.supported === false ? null : <button type="button" disabled={busy} className={VIEW_CHIP_PRIMARY_CLASS} data-testid="view-approve" onClick={() => approve()}>{actions.approve}</button>}
        {!tickable || verdict?.supported === false ? null : (
          <button type="button" disabled={busy || chosen === 0} data-testid="view-approve-ticked" title="Approve only the changes you ticked"
            className={`${VIEW_CHIP_CLASS} min-h-[44px]`} onClick={() => approve(pick)}>Approve ticked · {chosen}</button>
        )}
        <button type="button" disabled={busy} className={`${VIEW_CHIP_CLASS} min-h-[44px]`} onClick={() => void act(() => writes.discard(p.id))}>Set aside</button>
      </div>
    </div>
  )
}

/** A write core saved whose View could not then be read: it is not lost, and it is not shown yet (review 00052 #7). */
export const SAVED_NOT_SHOWN = 'Saved, but Olumi could not show it just now. Reload the page to see it.'

interface ViewChatState {
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
}

export const useViewChat = create<ViewChatState>()(() => ({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null }))

/** A past version is on the canvas (the version history's Draw): nothing is written until the person is back on the latest. */
export const PAST_HELD = 'Go back to the latest version to change the model.'

/** One write, then the View read again. An approval changes the model: the View is stale until the new one lands (00051). */
/** Where a write's words go when it does not go through: the composer's line, unless the write has its own panel (the figure-first entry). */
const toComposer = (said: string | null): void => useViewChat.setState({ said })

async function act(f: () => Promise<unknown>, changesModel = false, sink: (said: string | null) => void = toComposer): Promise<boolean> {
  if (useViewChat.getState().busy) return false
  if (useViewStore.getState().at !== null) { sink(PAST_HELD); return false }
  useViewChat.setState({ busy: true })
  sink(null)
  try {
    await f()
    const views = useViewStore.getState()
    const shown = await (changesModel ? views.modelChanged() : views.refresh())
    if (!shown) sink(SAVED_NOT_SHOWN)
    return true
  } catch (e) {
    sink(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    return false
  } finally { useViewChat.setState({ busy: false }) }
}

/**
 * A brief starts a scenario in core, and the page moves to core's id's own UUID form (`sid.ts`), the scenario's one address: the address
 * bar then names it (`/#/scenario/<uuid>`), so the link opens the same scenario in any browser of a member. An answer that lands after the
 * page moved on to another scenario moves nothing (review 00052 #5).
 */
async function startScenario(brief: string, op: string, uuid: string | null): Promise<void> {
  watchPageMoves()
  const left = pageMoves
  // AI jobs (core API v1.26): core accepts the brief at once (202) and drafts it in the server. Until it names the scenario, the brief and its
  // op stay in this tab for this person, so an answer lost on the way is recovered after a reload by the same op (pendingBrief), never redrafted.
  keepPending(brief, op)
  const made = await writes.create(brief, op)
  // An answer that names no scenario (unreadable, or JSON null) may still have been saved: uncertain, never "nothing saved" (00054 #4).
  if (typeof made?.scenario !== 'string' || !/^s_[0-9a-f]+$/.test(made.scenario)) throw new TeamApiError(0, UNCERTAIN_WRITE, true)
  dropPending(op)
  const derived = derivedUuidOf(made.scenario)
  if (derived === null) throw new TeamApiError(502, 'Olumi made the scenario but named it in a way this page cannot open. Reload the page.')
  // The page moved away while the answer was on its way, even if it has since come back (A → B → A): it moves nothing (review 00002).
  if (pageMoves !== left || useCanvasStore.getState().currentScenarioId !== uuid) return
  useCanvasStore.setState(scenarioIdWrite(useCanvasStore.getState().currentScenarioId, derived))
  setCurrentScenarioId(derived)
  try { window.history.replaceState(window.history.state, '', `/#/scenario/${derived}`) } catch { /* the address bar keeps its old address */ }
  await useViewStore.getState().use(derived)
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
function keepPendingTurn(sid: string, text: string, op: string): void {
  const me = pendingPerson()
  if (me === null) return
  try { sessionStorage.setItem(PENDING_TURN(me), JSON.stringify({ sid, text, op })) } catch { /* no storage: the op lives only in this page */ }
}
function dropPendingTurn(op: string): void {
  const me = pendingPerson()
  if (me === null) return
  try { if (pendingTurn(me)?.op === op) sessionStorage.removeItem(PENDING_TURN(me)) } catch { /* nothing kept */ }
}
/** This person's message still waiting for core's acceptance in this tab, if any: its scenario, words and op. */
export function pendingTurn(person: string): { sid: string; text: string; op: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING_TURN(person)) ?? 'null') as { sid?: unknown; text?: unknown; op?: unknown } | null
    return v !== null && typeof v.sid === 'string' && /^s_[0-9a-f]+$/.test(v.sid) && typeof v.text === 'string' && v.text.trim() !== '' && typeof v.op === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v.op) ? { sid: v.sid, text: v.text, op: v.op } : null
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
  useViewChat.setState({ text: p.text, ops: new Map(useViewChat.getState().ops).set(opKey(uuid, 'message', p.text), p.op) })
  return true
}
/** Try again on a plain message that ended unanswered (failed or lost): the same words, under a new op. A challenge, method question, move
 *  or evidence to consider is asked again from its own control, so it keeps what it was (Codex review 07 #4); it never becomes words. */
export function sayAgain(): Promise<boolean> {
  const { sid, view } = useViewStore.getState()
  const t = view?.turn
  if (sid === null || t == null || t.status === 'answering' || t.said === null || t.ask !== 'message') return Promise.resolve(false)
  const said = t.said
  return write('turn-again', `${sid}:${t.job}`, (op) => writes.message(sid, said, op))
}

/** A brief sent whose answer has not named its scenario yet: kept in this tab (sessionStorage) under the person's id, never another's. */
const PENDING = (person: string) => `olumi-pending-brief:${person}`
const pendingPerson = (): string | null => useMe.getState().me?.id ?? null
function keepPending(brief: string, op: string): void {
  const me = pendingPerson()
  if (me === null) return
  try { sessionStorage.setItem(PENDING(me), JSON.stringify({ brief, op })) } catch { /* no storage: the op lives only in this page */ }
}
function dropPending(op: string): void {
  const me = pendingPerson()
  if (me === null) return
  try { if (pendingBrief(me)?.op === op) sessionStorage.removeItem(PENDING(me)) } catch { /* nothing kept */ }
}
/** This person's brief still waiting for core's answer in this tab, if any: its words and the op it was sent with. */
export function pendingBrief(person: string): { brief: string; op: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING(person)) ?? 'null') as { brief?: unknown; op?: unknown } | null
    return v !== null && typeof v.brief === 'string' && v.brief.trim() !== '' && typeof v.op === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v.op) ? { brief: v.brief, op: v.op } : null
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
  useViewChat.setState({ text: p.brief, ops: new Map(useViewChat.getState().ops).set(opKey(uuid, 'brief', p.brief), p.op) })
  return true
}

/** Try again (core API v1.26): a new attempt on the scenario's saved brief after its first draft failed, was lost or was stopped, under a new op. */
export function tryAgain(): Promise<boolean> {
  const { sid, view } = useViewStore.getState(), status = view?.draft?.status
  if (sid === null || (status !== 'failed' && status !== 'lost' && status !== 'stopped')) return Promise.resolve(false)
  return write('redraft', `${sid}:${view!.draft!.job ?? ''}`, (op) => writes.redraft(sid, op))
}

/** Stop (core API v1.34): only while core offers it (`draft.stop`, the draft's author, while it drafts); then the View is read again. */
export function stopDraft(): Promise<boolean> {
  const { sid, view } = useViewStore.getState(), d = view?.draft
  if (sid === null || d?.status !== 'drafting' || d.stop == null || typeof d.job !== 'number') return Promise.resolve(false)
  const job = d.job
  return act(() => writes.stopDraft(sid, job))
}

/** Core holds no model and no proposal for this scenario (none yet, or its first draft was set aside): a message is a new brief (00052 #6). */
export const takesBrief = (sid: string | null, view: View | null) => sid === null || (view !== null && view.version === null && view.proposal === null)

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
function say(text: string): Promise<boolean> {
  const { uuid, sid, view } = useViewStore.getState()
  if (isDrafting(view)) return Promise.resolve(false) // its first model is still drafting: a second Send never makes a second scenario
  return takesBrief(sid, view) ? write('brief', text, (op) => startScenario(text, op, uuid))
    : write('message', text, async (op) => { keepPendingTurn(sid!, text, op); const r = await writes.message(sid!, text, op); dropPendingTurn(op); return r })
}

async function send(): Promise<void> {
  const { text, held } = useViewChat.getState()
  if (text.trim() === '') return
  const again = held !== null && held.text === text ? held : null
  if (held !== null && again === null) useViewChat.setState({ held: null })
  if (!(await (again !== null ? challenge(again.kind, again.record, again.text, again) : say(text)))) return
  if (useViewChat.getState().text === text) useViewChat.setState({ text: '' })
}

/**
 * A challenge on one card, to core's challenge route; one that does not go through is held for the same resend (`held`). A resend goes to
 * the scenario it was made in, with that scenario's op, whichever scenario is on screen now (review 00003 #2): it is the same write.
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
 * One plain question from the menu (core `POST …/method`): core sends it as a discussion-only turn on the challenges' path, so it never
 * changes the model or a pending proposal (core's guarantee). Its reply lands as the newest turn when the View is read again, as a
 * challenge's does. The same press after a dropped connection is sent with the same op id, so core answers (and pays) once.
 */
export async function askMethod(method: string): Promise<boolean> {
  const { sid, uuid, view } = useViewStore.getState()
  if (sid === null) return false
  const option = method === 'go_wrong' && view !== null ? optionInFocusOf(view, useCanvasStore.getState().selection.nodeIds) : null
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
export const FIGURE_FIRST = 'figure_first'

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
const moveKey = (sid: string, turn: number, move: string) => `${sid}\u0000${turn}\u0000${move}`

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

/** The newest reply's move as one tap, in the shell's button, with core's label for it. `arrow` (the Analysis tab's "Suggested next
 *  step", as the previous PoC drew it): the same tap as a round arrow, core's label as its name and hover. */
export function MoveTap({ turn, next, arrow = false, at }: { turn: number; next: Next; arrow?: boolean; /** Where the label sits in the View, for a surface that binds every word to its path. */ at?: string }) {
  const sid = useViewStore((s) => s.sid)
  const busy = useViewChat((s) => s.busy), gone = useViewChat((s) => s.gone ?? null)
  if (sid === null || typeof next.move !== 'string' || next.move === '' || gone === moveKey(sid, turn, next.move)) return null
  return (
    arrow
      ? <button type="button" data-testid="view-next-move" data-move={next.move} disabled={busy} onClick={() => void takeMove(turn, next)} aria-label={next.label} title={next.label}
          className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary text-text-on-color hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:bg-border disabled:border-border disabled:text-text-light disabled:cursor-not-allowed"><ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
      : <div><Button size="sm" variant="secondary" data-testid="view-next-move" data-move={next.move} disabled={busy} onClick={() => void takeMove(turn, next)}>{at === undefined ? next.label : <span data-view={`${at}.label`}>{next.label}</span>}</Button></div>
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
  return say(opts.message)
}

/** An ask made while a write is in flight: its words wait in the composer, never lost or sent twice (review 00055). */
export const STILL_ANSWERING = 'Olumi is still answering. Your words are in the message box: send them once it has.'
/** Words from the canvas the person can still send: put after whatever the composer already holds, never over it (review 00056). */
const keep = (text: string): void => {
  const now = useViewChat.getState().text
  if (now.split('\n').includes(text)) return
  useViewChat.setState({ text: now.trim() === '' ? text : `${now}\n${text}` })
}
const keptWhileBusy = (text: string): boolean => {
  if (!useViewChat.getState().busy && !isAnswering(useViewStore.getState().view)) return false
  keep(text)
  useViewChat.setState({ said: STILL_ANSWERING })
  return true
}
/** An ask from the canvas that did not go through (core refused it, or its answer never came) keeps its words beside core's sentence. */
const keptIfNotSent = (text: string) => (sent: boolean) => { if (!sent) keep(text) }

/** The canvas's asks, answered by this writer: one set for the page, so every holder registers the same functions. */
const ASKS = {
  _sendMessage: withOlumiReveal((text: string) => { if (!keptWhileBusy(text)) void say(text).then(keptIfNotSent(text)) }),
  // A prefill from a card (v10's Olumi corner: "About <card>:") is put after whatever the person has typed, never over it (Codex review
  // dgai-v10 00002 #1: the corner on every card must not delete a draft).
  _prefillChat: withOlumiReveal((text: string) => { keep(text) }),
  _dispatchAction: withOlumiReveal((opts: Press) => { if (!keptWhileBusy(opts.message)) void press(opts).then(keptIfNotSent(opts.message)) }),
  _isConversationBusy: () => useViewChat.getState().busy,
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

type WaitsOnItem = NonNullable<NonNullable<NonNullable<View['model']>['run']>['waits_on']>['items'][number]
export type NextStep = { readonly kind: 'approve' } | { readonly kind: 'figure'; readonly item: WaitsOnItem & { edit: NonNullable<WaitsOnItem['edit']> } } | { readonly kind: 'invite' }

/**
 * The one thing for the person to do next (lane C, Paul 3 Nov: a first-time person knows what to do within a minute), chosen from what
 * the View already states, in this order: a proposal Olumi holds is checked first (nothing is kept until it is approved); then the
 * first figure the chances wait on that core lets them type; then, while they are the only member, bringing a colleague in. Else
 * nothing: the conversation is the next step.
 */
export function nextStepOf(view: View): NextStep | null {
  if (view.proposal !== null) return { kind: 'approve' }
  const item = view.model?.edit_base == null ? undefined : view.model.run?.waits_on?.items.find((i) => i.edit !== null)
  if (item) return { kind: 'figure', item: item as WaitsOnItem & { edit: NonNullable<WaitsOnItem['edit']> } }
  if (view.version !== null && view.collab.alone && !replyHasNext(view)) return { kind: 'invite' }
  return null
}

// A figure step has no words of the UI's own: it says what the chances wait on in core's words (`run.waits_on`), so it never claims who can
// give the figure (strategy witness 8, 8 Nov: core said "which no one can size yet" where the UI said "only you can give").
export const NEXT_STEP_WORDS = {
  // R25 (Paul's 6 Nov test: no ✎ appeared while a proposal waited): say why, here, where the decision is (core holds edits by contract).
  approve: 'Olumi proposes changes, shown on the canvas. Check them against your situation, then approve them or set them aside. Nothing changes until you approve, and figure edits wait until then.',
  invite: 'Bring in a colleague: each of you gives your own view privately, then you reveal them together and see where you differ.',
} as const

/** What the chances wait on, for the figure step, in core's words at their paths: its label, the figure's name, and, where core says no one
 *  can size it yet, that clause. The hover is core's (the question asked, or why it is unknown). */
function FigureWaits({ view, item }: { view: View; item: WaitsOnItem }) {
  const w = view.model!.run!.waits_on!, k = w.items.indexOf(item)
  return (
    <p title={item.title} data-testid="view-next-figure-waits">
      <span data-view="run.waits_on.label">{w.label}</span>{' '}
      <span data-view={`run.waits_on.items.${k}.text`}>{item.text}</span>
      {item.unknown === null || item.unknown === '' ? null : <span data-view={`run.waits_on.items.${k}.unknown`}>{item.unknown}</span>}
    </p>
  )
}

/** The next step, highlighted at the top of the Olumi tab: its words and the one control that does it. */
function NextStepCard({ view, busy }: { view: View; busy: boolean }) {
  const step = nextStepOf(view)
  if (step === null) return null
  return (
    <section className={`${typography.viewPanelBody} rounded-lg border border-info/40 bg-panel p-3 space-y-2 ring-1 ring-info/20`} data-testid="view-next-step" data-step={step.kind} aria-label="Next step">
      <p className={typography.panelHeader}>Next step</p>
      {step.kind === 'figure' ? null : <p>{NEXT_STEP_WORDS[step.kind]}</p>}
      {step.kind === 'approve' ? <Proposal key={view.proposal!.id} p={view.proposal!} busy={busy} evidence={view.evidence} /> : null}
      {step.kind === 'figure' ? (
        <div className="space-y-1">
          <FigureWaits view={view} item={step.item} />
          <FigureEdit id={step.item.id} edit={step.item.edit} label="Add the figure" place="next-figure" />
        </div>
      ) : null}
      {step.kind === 'invite' ? (
        <button type="button" data-testid="view-next-invite" className={VIEW_CHIP_PRIMARY_CLASS} onClick={() => useUIStore.getState().forceActivateOutputTab('team')}>Invite a colleague</button>
      ) : null}
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
        <span className={`inline-flex items-center gap-1 rounded-[14px] border border-field bg-panel pl-2.5 pr-1 ${typography.viewPanelBody}`} data-testid="view-session-goal-chip">
          <Target className="h-3.5 w-3.5 text-info" aria-hidden="true" />
          <button type="button" disabled={held} onClick={() => setChanging(true)} title={session.set_by === null ? undefined : `Set by ${session.set_by}`}
            aria-label={`${GOAL_QUESTION} ${goal.text}. Change it`} data-testid="view-session-goal-change"
            className="py-1 text-text-body hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:text-text-light disabled:cursor-not-allowed">
            <span data-view="session.goal.text">{goal.text}</span>
          </button>
          <button type="button" disabled={held} onClick={() => choose(null)} aria-label={`Clear: ${goal.text}`} title={`Clear: ${goal.text}`} data-testid="view-session-goal-clear"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:text-text-light disabled:cursor-not-allowed">
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
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
 * The menu of plain questions (canon wave step 1; Paul's 18 Sep "Methods you can run", made prominent): every question core sends, in
 * core's order and words, none hidden; the ones that suit the goal (`first`) carry a quiet emphasis, never a filter. A press asks Olumi
 * that question as a discussion-only turn; while any turn is in flight the whole menu is held.
 */
function MethodMenu({ session, held }: { session: Session; held: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  // The reply lands as the newest turn, under the menu: once it is drawn, it is brought into view, so a press is seen to be answered.
  // "Let us give our figure first" opens its own entry (never a question to Olumi); every other item asks its question.
  const ask = (id: string) => (id === FIGURE_FIRST
    ? void openFigureFirst().then(() => bringIntoView(box.current, 'view-figure-first-entry'))
    : void askMethod(id).then((sent) => { if (sent) bringIntoView(box.current, 'view-chat-latest') }))
  return (
    <div ref={box} className="flex items-start gap-2 rounded-lg border border-panel-border bg-panel p-3" data-testid="view-session-menu">
      <span className="mt-1 inline-flex h-5 w-5 flex-none items-center justify-center text-info" title={MENU_NAME} aria-hidden="true"><MessageCircleQuestion className="h-4 w-4" /></span>
      <div className="flex min-w-0 flex-wrap gap-1.5" role="group" aria-label={MENU_NAME}>
        {session.methods.map((m, i) => (
          <button key={m.id} type="button" disabled={held} onClick={() => ask(m.id)} title={m.first ? FIRST_FOR_GOAL : undefined}
            className={`${VIEW_CHIP_CLASS}${m.first ? ' font-medium' : ''}`} data-method={m.id} data-first={m.first ? '' : undefined} data-testid="view-session-method">
            {m.first ? <span className="h-1.5 w-1.5 flex-none rounded-full bg-info" aria-hidden="true" data-testid="view-session-method-first" /> : null}
            <span data-view={`session.methods.${i}.text`}>{m.text}</span>
            {m.first ? <span className="sr-only"> ({FIRST_FOR_GOAL})</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * R25 spacing roles on this tab (plan v3 item 3; one value per role, alpha surfaces only): sections 16px (space-y-4, the tab's p-4);
 * a card's padding 12px (p-3); related items 8px (space-y-2); a label to its content 4px (space-y-1). The waiting change sits inside the
 * Next step card with no second border or padding of its own (the double padding is gone).
 */
/**
 * v10's methods (DGAI's reasoning moves' glyphs and words): each fills the composer with its prefix, keeping what was typed, for the person
 * to finish; nothing is sent. R25 (DL ruling 7 Nov, Paul 6 Nov: one next move visible, the methods behind "More ways"): drawn inside the
 * disclosure, each with its name, no longer as the composer's icon row.
 */
function MethodChips() {
  return (
    <span role="group" aria-label="Ways to test the model" className="flex flex-wrap items-center gap-1" data-testid="v10-method-chips">
      {V10_METHODS.map(({ key, label, prefix }) => {
        const Icon = METHOD_GLYPHS[key]
        return (
          <button key={key} type="button" data-testid={`v10-method-${key}`}
            className={`${typography.viewPanelBody} inline-flex min-h-[24px] items-center gap-1.5 rounded-md px-2 text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            onClick={() => { useViewChat.setState({ text: withMethodPrefix(prefix, useViewChat.getState().text) }); document.getElementById('view-chat-text')?.focus() }}>
            <Icon className="w-3.5 h-3.5 text-text-light" aria-hidden="true" />{label}
          </button>
        )
      })}
    </span>
  )
}

/** The disclosure holding what the team came for and every method (R25: depth one click away, never above Olumi's reply). */
export const MORE_WAYS = 'More ways to think about this'

/** Keep the thread together and methods within reach (UI recovery witness row 11, DL 10 Nov). */
export function ViewChat() {
  useAnswersAsks()
  const floating = useChatFloat((s) => s.floating)
  const view = useViewStore((s) => s.view), error = useViewStore((s) => s.error)
  const busy = useViewChat((s) => s.busy), past = useViewStore((s) => s.at)
  // Core's session block (canon wave step 1): what the team came for, then the menu; a View without it draws neither.
  const session = view === null ? null : sessionOf(view)
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
  const [away, setAway] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const readScroll = useCallback(() => {
    const el = scroll.current
    if (el === null) return
    // An automatic scroll to a long reply's start still follows it (pre-screen 4b92d394 row 14).
    if (follows.current && el.scrollTop === followedTop.current) return
    followedTop.current = null
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
    const job = el.querySelector<HTMLElement>('[data-testid="view-chat-turn-job"]')
    const newest = job ?? el.querySelector<HTMLElement>('[data-testid="view-chat-latest"]')
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight)
    let top = newest === null ? maxScroll : newest.offsetTop - 16
    // The Next step card is the person's one move (Approve, Set aside): with no turn running, it is brought whole into view below the
    // newest reply, or its top where it is taller than the thread (DL-183: at Paul's 1.33 scale it opened cut at its foot, Approve below).
    const step = job === null ? el.querySelector<HTMLElement>('[data-testid="view-next-step"]') : null
    // Olumi's question (core's model.coaching_questions) sits just above the step and is part of it: the block runs from its top.
    const asked = step === null ? null : el.querySelector<HTMLElement>('[data-testid="view-model-question"]')
    const from = asked?.offsetTop ?? step?.offsetTop ?? 0
    if (step !== null && step.offsetTop + step.offsetHeight + 16 > top + el.clientHeight) top = Math.min(from - 16, step.offsetTop + step.offsetHeight + 16 - el.clientHeight)
    el.scrollTop = Math.max(0, Math.min(maxScroll, top))
    followedTop.current = el.scrollTop
    setAway(false)
  }, [])
  // Start long replies at their first lines, without moving someone reading back (pre-screen 4b92d394 row 14).
  const turns = view?.chat.length ?? 0, lastTurn = view?.chat[turns - 1]?.id ?? null, job = view?.turn?.job ?? null
  useEffect(followNewest, [turns, lastTurn, job, followNewest, floating])
  // Replies and cards can grow without adding a turn (pre-screen 4b92d394 row 15).
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || content.current === null) return
    const observer = new ResizeObserver(followNewest)
    observer.observe(content.current)
    return () => observer.disconnect()
  }, [followNewest, floating])
  // Return focus to the pop-out control after docking (A2 stop/float, DL 10 Nov).
  const wasFloating = useRef(floating)
  useEffect(() => {
    if (wasFloating.current && !floating) tab.current?.querySelector<HTMLButtonElement>('[data-testid="view-chat-popout"]')?.focus()
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
  // The Next step core's View asks for, if any; while it shows, the newest reply's move tap is tucked behind More ways (below).
  // Tucked only when the step offers this person its control: a figure on someone else's page shows no editor (FigureEdit), so there the
  // reply's tap stays where it is (checker, slice 1b).
  const me = useMe((s) => s.me)
  const step = view === null ? null : nextStepOf(view)
  const offers = step !== null && (step.kind !== 'figure' || isForThisPage(view!, me))
  const newest = view === null || view.chat.length === 0 ? null : view.chat[view.chat.length - 1]!
  const tucked = offers && newest?.answer?.next.newest ? newest : null
  // The methods, behind More ways (none for a brief, or while a write holds the composer they fill).
  const sid = useViewStore((s) => s.sid)
  const methods = view !== null && !held && !takesBrief(sid, view)
  const give = () => void giveFigureFirst().then((sent) => { if (sent) bringIntoView(tab.current, 'view-figure-first-given') })
  const show = () => void showOlumiFigure().then((sent) => { if (sent) bringIntoView(tab.current, 'view-figure-first-shown') })
  const pinned = view !== null && nextStepOf(view)?.kind === 'approve'
  const chat = (
    <div ref={tab} className="flex flex-1 min-h-0 flex-col" data-testid="view-chat">
      {floating ? null : <div className="flex shrink-0 justify-end px-2 pt-1">
        <button type="button" onClick={popOutChat} data-testid="view-chat-popout" aria-label={CHAT_POPOUT_LABEL} title={CHAT_POPOUT_TITLE}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
          <ExternalLink size={14} aria-hidden="true" />
        </button>
      </div>}
      <div className="relative flex flex-1 min-h-0 flex-col">
        <div ref={scroll} onScroll={readScroll} data-testid="view-chat-scroll" className="relative flex-1 min-h-0 overflow-y-auto p-4">
          <div ref={content} className="space-y-4">
            {/* A read that failed says so, before a View or after a good one (lane audit 5.4). */}
            {error === null ? null : <p role="alert" data-testid="view-chat-unread">{error}</p>}
            <ModelNoticeLine />
            {/* One next move (DL ruling b, Paul 6 Nov: progressive disclosure): while the Next step card shows, the reply's own move tap waits
                behind "More ways to think about this"; with no Next step, it stays under the reply. Core's words for the move stay in the reply. */}
            {view === null ? null : <ViewConversation chat={view.chat} moves={!offers} me={view.you_id} />}
            {view?.turn == null ? null : <TurnInFlight turn={view.turn} me={view.you_id} />}
            {/* ORDER-UI-5 (2), DL-408: Olumi's questions on this model, at most three, each in core's words whole, in one block. First core's
                questions about its own trial figures (model.trial_questions, SEAM-13 c2 13bd106e: the waits_on item shape, an aim's baseline
                first): each opens that figure's own editor (`id`, with core's `edit`, the one the card offers); with no edit (a proposal is
                held) it is words. Then core's other questions (coaching_questions, words only: no id, so none is guessed from the words).
                An older core sends no trial_questions: as before. */}
            {(() => {
              const trial = (view?.model?.trial_questions ?? []).filter((t) => t.title !== '').map((t, at) => ({ key: `t:${t.id}`, view: `model.trial_questions.${at}.title`, text: t.title, id: t.id, edit: t.edit }))
              const words = view === null ? [] : questionsOf(view).filter((q) => q.text !== '').map((q) => ({ key: `c:${q.at}`, view: `model.coaching_questions.${q.at}`, text: q.text, id: null, edit: null }))
              const qs = [...trial, ...words].slice(0, 3)
              if (qs.length === 0) return null
              const head = qs.length === 1 ? 'Olumi’s question' : 'Olumi’s questions'
              const body = (q: (typeof qs)[number]) => <QuestionLine text={q.text} id={q.id} edit={q.edit} />
              const testid = (i: number) => (i === 0 ? 'view-model-question-text' : `view-model-question-text-${i}`)
              return (
                <section className={`${typography.viewPanelBody} space-y-1`} data-testid="view-model-question" aria-label={head}>
                  <p className={`${typography.viewPanelMeta} text-info`}>{head}</p>
                  {qs.length === 1
                    ? <div data-testid={testid(0)} data-view={qs[0]!.view} data-question-id={qs[0]!.id ?? undefined}>{body(qs[0]!)}</div>
                    : (
                      <ol className="m-0 list-decimal space-y-1 pl-5" data-testid="view-model-questions">
                        {qs.map((q, i) => <li key={q.key} data-testid={testid(i)} data-view={q.view} data-question-id={q.id ?? undefined}>{body(q)}</li>)}
                      </ol>
                    )}
                </section>
              )
            })()}
            {view === null || pinned ? null : <NextStepCard view={view} busy={busy} />}
            {/* Olumi's note, when the canvas has no free spot for it (OlumiAttentionCard): here, never over a card. */}
            <div {...{ [VIEW_NOTE_SLOT]: '' }} />
            {ffMine && ffOpen ? <FigureFirstEntryPanel held={held} onGive={give} onShow={show} onClose={closeFigureFirst} /> : null}
            {ffMine && ffShown ? <FigureFirstShownPanel onClose={() => useFigureFirst.setState({ shown: null })} /> : null}
            {ff?.given == null ? null : <FigureFirstSideBySide given={ff.given} headings={ff.headings} />}
          </div>
        </div>
        {away ? <button type="button" data-testid="view-chat-to-latest" aria-label="Go to the latest message" onClick={toLatest} className={`${typography.viewPanelBody} absolute bottom-2 right-4 inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-md border border-panel-border bg-panel px-3 text-text-body`}><ArrowDown size={16} aria-hidden="true" />Latest</button> : null}
      </div>
      {/* DL-538 (the target panel): Olumi's proposal, with Approve and Set aside, is pinned between the thread and the composer, never
          buried under a long reply; it scrolls on its own when taller than half the panel. */}
      {view === null || !pinned ? null : <div className="ok-pinned shrink-0 overflow-y-auto px-3 pb-2" data-testid="view-chat-pinned"><NextStepCard view={view} busy={busy} /></div>}
      {session === null && tucked === null && !methods ? null : (
        <details className="shrink-0 px-4" data-testid="view-more-ways" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
          <summary className={`${typography.viewPanelBody} flex min-h-[44px] cursor-pointer items-center text-text-body underline underline-offset-2`}>{MORE_WAYS}</summary>
          {/* Keep room for the thread after choosing a method (pre-screen 4b92d394 row 16). */}
          <div className="max-h-[25vh] overflow-y-auto space-y-4 pb-4" onClick={(e) => { if ((e.target as Element).closest('button')) setMoreOpen(false) }}>
            {tucked === null ? null : <div data-testid="view-more-ways-move"><MoveTap turn={tucked.id} next={tucked.answer!.next} /></div>}
            {methods ? <MethodChips /> : null}
            {session === null ? null : <><SessionGoal session={session} held={held} /><MethodMenu session={session} held={held} /></>}
          </div>
        </details>
      )}
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
  if (notice === null || notice.sid !== sid) return null
  return <p role="status" className={`${typography.viewPanelMeta} text-text-header`} data-testid="view-model-notice" data-notice={notice.kind}>{noticeWords(notice)}</p>
}

// A brief's drafting is said on the board in core's words (DraftingBoard.tsx, the View's `draft.words`); no UI words for it here.
export const THINKING_WORDS = 'Olumi is thinking…'

/**
 * While a write is in flight the composer is held and says why (lane audit 5.7), with the seconds since it started: a first draft takes
 * minutes, and a line that never moves reads as stuck (PL review, 4 Nov). Status only; nothing streams.
 */
function Working() {
  const [started] = useState(() => Date.now())
  const [now, setNow] = useState(started)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const s = Math.floor((now - started) / 1000)
  return (
    <p role="status" className={typography.viewPanelMeta} data-testid="view-chat-working">
      {THINKING_WORDS} <span data-testid="view-chat-working-seconds">{s} s</span>
    </p>
  )
}

/** What a first-time person needs before their brief (lane C, Paul 3 Nov: understood within a minute): what to write and what happens. */
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
  const { text, busy, said } = useViewChat()
  const drafting = isDrafting(view), answering = isAnswering(view)
  // A scenario whose View is not read yet (its first read failed): what it holds is unknown, so nothing is sent until it is (Codex r1 #4).
  const unknown = sid !== null && view === null
  const held = busy || past !== null || drafting || unknown
  const box = useRef<HTMLTextAreaElement>(null)
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
  if (sid !== null && view === null && error === null) return null
  const blocked = analysisAction !== undefined && !analysisAction.canRun && !analysisAction.isRunning
  const sendHeld = held || answering || text.trim() === ''
  const submit = () => { if (!sendHeld) void send() }
  const quiet = 'inline-flex items-center justify-center w-6 h-6 rounded-md text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:text-text-light disabled:cursor-not-allowed'
  // DGAI's placeholders by stage (useStageAwarePlaceholder), from the View: core runs the analysis on every save, so a saved model's run
  // is the latest; a proposal not yet approved is not one.
  // J1 gate: while Olumi's newest answer asks the person something, the box invites the reply (the prototype's words); a run with
  // nothing in it yet is not "the latest analysis".
  const asked = newestNextOf(view?.chat) !== null
  const placeholder = brief ? BRIEF_EXAMPLE : asked ? 'Reply, or edit the model' : view?.version != null && (view.model?.run?.aim ?? null) !== null ? 'Ask about the latest analysis…' : 'Ask about this model…'
  return (
    <div className={`${typography.viewPanelBody} px-2 pb-2 pt-1 space-y-2`} data-testid="view-composer">
      {said === null ? null : <p role="alert" data-testid="view-chat-said">{said}</p>}
      {/* While a write is in flight the composer is held: it says why (lane audit 5.7), in core's page's words. */}
      {/* A brief's drafting is said on the board (DraftingBoard.tsx), once; a message being answered is said here. */}
      {busy && !brief ? <Working /> : null}
      {past === null ? null : (
        <p className="flex flex-wrap items-center gap-2" data-testid="view-composer-past">
          <span>{PAST_HELD}</span>
          <button type="button" className="rounded px-2 py-1 border border-border" data-testid="view-composer-back" onClick={() => void useViewStore.getState().look(null)}>Back to the latest</button>
        </p>
      )}
      <label className={brief ? typography.panelHeader : 'sr-only'} htmlFor="view-chat-text">{brief ? 'Your brief' : 'Message Olumi'}</label>
      {/* What to write, until it is written: once the brief is sent, the box holds it and the board says what happens. */}
      {brief && !busy && !drafting ? <p id="view-brief-intro" className="text-text-body" data-testid="view-brief-intro">{BRIEF_INTRO}</p> : null}
      {/* Keep the first line compact as the brief or message grows (pre-screen 4b92d394 row 13). */}
      <div className={`relative bg-panel border border-panel-border rounded-[14px] transition-colors focus-within:border-text-light ${brief ? '' : 'flex items-center gap-2 py-1.5 pl-3 pr-1.5'}`}>
        <textarea ref={box} id="view-chat-text" className={`${typography.viewPanelBody} block w-full resize-none bg-transparent outline-none text-text-body placeholder:text-text-light ${brief ? 'pt-2 pb-1 px-3' : 'flex-1 py-1'}`}
          // The brief's example is what to write: shown whole until something is typed (it wraps; one row cut it mid-sentence at 1232, DL 10 Nov).
          rows={brief && !busy && !drafting && text === '' ? 3 : 1} value={text} placeholder={placeholder} aria-describedby={brief && !busy && !drafting ? 'view-brief-intro' : undefined} disabled={held}
          onChange={(e) => useViewChat.setState({ text: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} />
        <div className={`flex items-center justify-end gap-1 ${brief ? 'px-2 pb-1' : 'flex-none'}`} data-testid="view-composer-actions">
          {analysisAction === undefined ? null : (
            <button type="button" onClick={analysisAction.onRun} disabled={past !== null || analysisAction.isRunning || !analysisAction.canRun} aria-label={analysisAction.label}
              title={blocked ? analysisAction.blockedReason ?? analysisAction.label : analysisAction.label} className={quiet} data-testid="view-composer-analyse">
              <RefreshCw className={`w-3.5 h-3.5${analysisAction.isRunning ? ' animate-spin' : ''}`} aria-hidden="true" />
            </button>
          )}
          <button type="button" disabled={sendHeld} aria-label="Send" data-testid="view-composer-send" onClick={submit}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-text-header text-text-on-color focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header disabled:cursor-default">
            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" /><span className="sr-only">Send</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/** DGAI's reasoning-move glyphs (ComposerMoves), on v10's four methods in the same order. */
const METHOD_GLYPHS: Readonly<Record<(typeof V10_METHODS)[number]['key'], typeof Zap>> = { assumption: Zap, opposite: FlipVertical2, disconfirming: SearchX, outside: Globe }
