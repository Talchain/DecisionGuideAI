/** The conversation's turns: each said line, the person's presses, the floor and the turn in flight (moved verbatim from ViewChat.tsx). */
import { useEffect, useRef, useState } from 'react'
import { type View, type ViewTurn } from '../../client'
import { useViewStore } from '../../store'
import { nextCardsOf, olumiKey, restingRingOf } from '../../layout'
import { useCanvasStore } from '../../../canvas/store'
import { typography } from '../../../styles/typography'
import { endRing, pointRing, restRing } from '../../ring'
import styles from '../../../canvas/conversation/Conversation.module.css'
import { earlyOf, drawnLeadOf, entriesOf, pressOf, threadRows, type FloorTurn } from '../../early'
import { askFieldOf, pressFieldOf, pressHeading, type TurnPress } from '../../press'
import { ReplyLead } from './ReplyLead'
import { KeepChooser } from './KeepChooser'
import { EarlyAnswer } from '../../EarlyAnswer'
import { ResultReceipts } from '../../ResultReceipts'
import { KeepIdea } from '../KeepIdea'
import { approachesOf, floorEntryOf, ideaTextOf, isCoachedReply } from '../ideas'
import { aboutCardsOf, AboutChips } from './AboutChip'
import { ShowInWorkspace } from '../showInWorkspace/ShowInWorkspace'
import { ICONS, OkIcon } from '../../look/icons'
import { methodOfSaid, MethodMark } from './MethodChip'
import { firstAnswerOf } from './replyLabels'
import { Blocks, LEAD_WORDS, Stories, Words, citesIn } from './replyBlocks'
import { MoveTap, moveKey, moveTapDrawn, sayAgain, useViewChat } from './chatActions'
import { nextStepOf } from './nextStep'

const NO_CARDS: readonly string[] = []

/**
 * The turn whose next step the panel's one Next step card draws (a `move` step: the newest reply's own move), or null. That turn does not draw
 * its next line or its tap again: the step is said once, at the top (PANEL-SPEC 1 and 3).
 */
export function stepTurnOf(view: View | null, sid: string | null, gone: string | null): number | null {
  if (view === null) return null
  const step = nextStepOf(view, (turn, move) => sid !== null && gone === moveKey(sid, turn, move))
  return step?.kind === 'move' ? step.turn : null
}

/** The reply's disclosure (V12 Main): the reasons, and what would move the answer. */
export const WHY_AND_WHAT_MOVES_IT = 'Why, and what moves it'

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
  const inStep = useViewStore((st) => t.answer !== null && stepTurnOf(st.view, st.sid, gone) === t.id)
  // Said once (S4, 19 Nov): where this reply's move is drawn as its own press, that press carries core's `next.label`; the bold label is not drawn beside it.
  const sidNow = useViewStore((st) => st.sid)
  const tapDrawn = t.answer !== null && moves && t.answer.next.newest && !inStep && moveTapDrawn(sidNow, t.answer.next, gone === null ? false : sidNow !== null && gone === moveKey(sidNow, t.id, t.answer.next.move))
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
      {olumi === null ? null : <span className="ok-reply-mark" role="img" aria-label={olumi.text} title={olumi.text} data-view={`${at}.answer.mark`}>{olumi.glyph}</span>}
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
      {/* The reply's move that is the panel's Next step is drawn in that card at the top, once; it is not drawn again here. Every other reply keeps its own. */}
      {inStep ? null : <p tabIndex={about.length ? 0 : undefined} data-testid="view-chat-next" onMouseEnter={() => ring(true)}
        onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) ring(false) }} onFocus={() => ring(true)} onBlur={() => ring(false)}>{tapDrawn ? null : <><span className={`${typography.viewPanelHeading} text-text-header${about.length > 0 && !(moves && t.answer.next.newest) ? ' sr-only' : ''}`} data-view={`${at}.answer.next.label`}>{t.answer.next.label}</span>{' '}</>}<Words parts={t.answer.next.text} at={`${at}.answer.next.text`} first={nextFirst} /></p>}
      {tapDrawn ? <MoveTap turn={t.id} next={t.answer.next} primary={primary} /> : null}
      <ResultReceipts claims={t.answer.claims} />
      {!leads ? null : (
        <details className="ok-reply-more" data-reply-more={at}>
          <summary>{WHY_AND_WHAT_MOVES_IT}</summary>
          <ul className="list-disc pl-4">{t.answer.why.map((w, j) => <li key={j}><Words parts={w} at={`${at}.answer.why.${j}`} first={whyFirst[j]} /></li>)}</ul>
        </details>
      )}
      <Stories answer={t.answer} at={at} />
    </div>
  )
  // Who replied and the model version it read, under the reply, as DGAI's version chip (v10): core's words.
  const waiting = whole?.proposal != null
  // The reply's ONE footer row (17 Nov, the calm panel): the cards it is about, show in the workspace, keep as an idea, and the version stamp.
  // D1 (independent review of 833c1609): core's version and status words are CONTENT, drawn visibly beside the version-tag icon, small and light
  // (viewPanelMeta, --text-light); the icon keeps its hover. They were an sr-only span inside the icon, so a sighted reader never saw them.
  const stampWords = t.status === null ? t.version : `${t.version} · ${t.status}`
  const stamp = (
    <span className={`inline-flex min-w-0 flex-wrap items-center gap-1 text-text-light ${typography.viewPanelMeta}`} data-testid="view-chat-version">
      <span tabIndex={0} role="img" aria-label={stampWords} title={stampWords} className="inline-flex" data-testid={t.status === null || waiting ? 'view-chat-version-icon' : 'view-chat-status-icon'}>
        <OkIcon id="version-tag" size={14} decorative />
      </span>
      {/* Paul, 19 Nov (one plain status line; DL GO 12:08Z): ONE of core's two words is drawn, its status when it sends one (the reply's current
          state), else its version; both stay in the icon's hover. No UI words. */}
      {/* say3 (Paul 18 Nov, "nothing said twice"): while Olumi's proposal waits, its foot already says it (the newest reply only) ("Olumi proposes N changes"), so the reply's
          status ("Proposed, waiting for approval: N changes…") is not drawn a second time; core's words stay in the icon's hover. */}
      {waiting && latest && t.status !== null ? null : t.status === null ? <span data-view={`${at}.version`}>{t.version}</span> : <span title={stampWords} data-view={`${at}.status`}>{t.status}</span>}
    </span>
  )
  const tools = (
    <div className="flex flex-wrap items-center gap-1" data-testid="view-reply-tools">
      {t.answer === null ? null : <AboutChips cards={aboutCards} />}
      {t.answer === null ? null : <ShowInWorkspace turn={t.id} next={t.answer.next} />}
      {idea === null ? null : <KeepIdea sid={idea.sid} turn={t.id} text={idea.text} />}
      {stamp}
    </div>
  )
  return (
    <li data-view-turn={at} data-testid={latest ? 'view-chat-latest' : undefined} className="space-y-2">
      {said}{lead !== null || early === null ? null : <EarlyAnswer text={early} testid="view-chat-early" />}
      {lead !== null || floor == null ? null : <div data-floor-job={floor.job}><p className={typography.viewPanelMeta}>Olumi’s initial reply</p><EarlyAnswer text={floor.text} testid="view-floor-reply-text" bare /></div>}
      {answer}{tools}
      {t.broke === null ? null : <p data-view={`${at}.broke`}>{t.broke}</p>}
      {t.problem === null ? null : <p role="alert" data-view={`${at}.problem`}>{t.problem}</p>}
      {t.answer === null && t.problem !== null && t.said !== '' ? <AskAgain words={t.said} /> : null}
      {t.marks.map((m, j) => <p key={j} title={m.title}><span data-view={`${at}.marks.${j}.what`}>{m.what}</span>: <span data-view={`${at}.marks.${j}.status`}>{m.status}</span></p>)}
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
    <button type="button" data-testid="view-ask-again" aria-label={ASK_AGAIN} title={ASK_AGAIN}
      onClick={() => { useViewChat.setState({ text: askAgainDraft(useViewChat.getState().text, words) }); document.getElementById('view-chat-text')?.focus() }}
      className={`${typography.viewPanelMeta} inline-flex min-h-[24px] items-center gap-1 rounded-md px-1.5 text-text-light hover:bg-panel-hover hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
      <OkIcon id="retry" size={14} inherit decorative /><span className="sr-only">{ASK_AGAIN}</span>
    </button>
  )
}
/** Honest degradation (core `degraded`, optional on a chat turn and a floor entry; the vendored contract predates it; `chat[].status` is the version
 *  stamp's string): a reply that ran on less than it should have says so once, in core's own sentence, its short form on hover. */
function DegradedLine({ of, at }: { of: unknown; at: string }): JSX.Element | null {
  const d = (of as { degraded?: { text?: unknown; title?: unknown } | null }).degraded
  if (typeof d?.text !== 'string' || d.text === '') return null
  return <p className={`${typography.viewPanelMeta} m-0 text-text-light`} title={typeof d.title === 'string' ? d.title : d.text} data-view={`${at}.degraded.text`} data-testid="view-chat-turn-degraded">{d.text}</p>
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
        : <div className={`${typography.viewPanelBody} ok-reply space-y-3`} data-testid="view-floor-reply" data-latest-floor={latest ? '' : undefined}><DegradedLine of={f} at={`floor.${f.job}`} />{f.lead === undefined ? text
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
export function TurnInFlight({ turn, me, shown = false }: { turn: NonNullable<View['turn']>; me: string | null; shown?: boolean }) {
  const running = turn.status === 'answering'
  const busy = useViewChat((s) => s.busy)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [running])
  const from = Date.parse(turn.started), secs = Number.isFinite(from) ? Math.max(0, Math.floor((now - from) / 1000)) : null
  return (
    <ol className={`${typography.viewPanelBody} space-y-4`} data-testid="view-chat-turn-job" data-turn={turn.status} data-shown={shown ? '' : undefined}>
      <li className="space-y-1">
        {/* DL-538: the bubble names whose words it holds, inside it, as a saved turn's does (Turn); with no words, the name stands alone. */}
        {shown ? null : turn.said === null
          ? (turn.by_id === me ? null : <p className={typography.viewPanelMeta} data-view="turn.by">{turn.by}</p>)
          : <div className={`${styles.messageBubbleUser} ok-said`}>{turn.by === '' ? null : <p className={`ok-said-by ${typography.viewPanelMeta} ${turn.by_id === me ? 'text-text-light' : 'text-text-body'}`} data-view="turn.by" data-testid="view-said-by">{turn.by}</p>}{pressFieldOf(turn) !== null ? <PressedLine press={pressFieldOf(turn)!} at="turn" /> : turn.ask === 'challenge' || turn.ask === 'method'
            ? <p className={`${typography.viewPanelBody} inline-flex items-center gap-1.5`} data-testid="view-chat-pressed" data-pressed={turn.ask}><OkIcon id="method-mark" size={14} decorative />{PRESSED_WORDS}</p>
            : <p className={typography.viewPanelBody} data-view="turn.said">{turn.said}</p>}</div>}
        {shown ? null : <p role="status" aria-live="polite" className={`${typography.viewPanelMeta} ${running ? 'text-text-light' : 'text-text-body'}`}>
          <span data-view="turn.words" data-testid="view-chat-turn-words">{turn.words}</span>
          {running ? <span aria-hidden="true" className="ml-2 inline-flex gap-1 motion-safe:animate-pulse" data-testid="view-chat-dots"><span className="h-1 w-1 rounded-full bg-current" /><span className="h-1 w-1 rounded-full bg-current" /><span className="h-1 w-1 rounded-full bg-current" /></span> : null}
          {running && secs !== null ? <span aria-hidden="true" className="tabular-nums" data-testid="view-chat-turn-seconds"> {secs} s</span> : null}
        </p>}
        {running || turn.said === null || turn.by_id !== me || turn.ask !== 'message' ? null
          : <button type="button" disabled={busy} data-testid="view-chat-turn-again" onClick={() => void sayAgain()} className="min-h-[44px] rounded-md border border-panel-border px-4 text-info hover:bg-panel-hover disabled:text-text-light disabled:cursor-not-allowed">Try again</button>}
      </li>
    </ol>
  )
}
