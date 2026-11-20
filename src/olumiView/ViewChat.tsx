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
import { FindingLine } from './FindingLine'
import { useFindingSurface } from './findingSurface'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useViewStore } from './store'
import { chatQuestionsOf, figureFirstOf } from './layout'
import { typography } from '../styles/typography'
import { VIEW_NOTE_SLOT } from './note'
import { FigureFirstEntryPanel, FigureFirstShownPanel, FigureFirstSideBySide, useFigureFirst } from './ViewFigureFirst'
import { noticeWords, useModelNotice } from './notice'
import './look/olumiLook.css'
import { earlyOf, floorShown } from './early'
import { SinceVersion } from '../olumiCore/compare'
import { CommitFormSlot } from './v12/team'
import { answerQuestion } from './reasoning/answer'
import { OlumiAsks } from './v12/chat/OlumiAsks'
import { IntakeSheet } from './v12/chat/IntakeSheet'
import { OkIcon } from './look/icons'
import { KeptIdeas } from './v12/chat/KeptIdeas'
import { CatchUp } from './v12/journey/CatchUp'
import { ChatDockBack, ChatFloatHost, useChatFloat } from './port/ChatFloat'
import { bringIntoView, closeFigureFirst, giveFigureFirst, moveKey, openFigureFirst, say, showOlumiFigure, useAnswersAsks, useViewChat, write } from './v12/chat/chatActions'
import { QuestionLine } from './v12/chat/ProposalCard'
import { NextStepCard, nextStepOf } from './v12/chat/nextStep'
import { TurnInFlight, ViewConversation, turnAlreadyShown } from './v12/chat/Turns'
import { ViewComposerBody } from './v12/chat/Composer'

/*
 * The panel wears DGAI's own conversation look (DL, 4 Nov: Paul's original UI, staging #/canvas): the person's words in the panel-filled
 * bubble and Olumi's reply unframed (Conversation.module.css), the acts as the conversation's chips (chipClass), and the composer as
 * AIInputBar's footer box: the text, then a row of quiet icons and the round send. Only the look is DGAI's; every word and act is the
 * View's, as before.
 */

// ViewChat.tsx was split by domain (20 Nov, no behaviour change); its public names stay importable from here.
export { Blocks, LEAD_WORDS, REST_ITEMS, SHOW_LESS, SHOW_WHOLE_FIRST, SHOW_WHOLE_REPLY, Words } from './v12/chat/replyBlocks'
export { ABOUT_GONE, BUILD_FIELD, CHALLENGE_KINDS, type ChallengeKind, FIGURE_FIRST, MoveTap, PAST_HELD, PICK_A_CARD, type Press, SAVED_NOT_SHOWN, STILL_ANSWERING, TALK_FIRST, TALK_FIRST_HOVER, type ViewChatState, askMethod, askOnPress, buildModel, buildOfferOf, challenge, challengeIdea, chooseGoal, giveFigureFirst, giveReasons, isAnswering, isDrafting, moveKey, moveTapDrawn, openFigureFirst, pendingBrief, pendingTurn, prefillComposer, pressChallenge, resendOf, restorePendingBrief, restorePendingTurn, sayAgain, showOlumiFigure, showOlumisNow, startedInWords, stopDraft, takesBrief, tryAgain, useAnswersAsks, useViewChat } from './v12/chat/chatActions'
export { APPROVE_WORD, KEPT_WITHOUT, LEAVE_OFF_SEP, NEEDED_BY, NOTED_SHOW_ALL, NOTED_SHOW_FEWER, Proposal, READINGS_CHANGED, READINGS_NOTE, READING_KEEP, READING_USE, REFUSAL_NEEDS, REVIEW_CHANGES, TICK_NEEDED, WILL_LEAVE_OFF, needsOf } from './v12/chat/ProposalCard'
export { FIRST_FOR_GOAL, GOAL_QUESTION, MENU_NAME, NEXT_STEP_WORDS, type NextStep, ProposalReview, nextStepOf, runMethod, runTool } from './v12/chat/nextStep'
export { ASK_AGAIN, PRESSED_WORDS, TurnInFlight, ViewConversation, ViewTurns, WHY_AND_WHAT_MOVES_IT, askAgainDraft, retriedAt, stepTurnOf, turnAlreadyShown } from './v12/chat/Turns'
export { BRIEF_EXAMPLE, BRIEF_INTRO, COMPOSER_PLACEHOLDER, THINKING_WORDS, ViewComposer } from './v12/chat/Composer'

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
  const busy = useViewChat((s) => s.busy), past = useViewStore((s) => s.at)
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
    const job = el.querySelector<HTMLElement>('[data-testid="view-chat-turn-job"]:not([data-shown])')
    // Contract 3 (Codex 15 Nov): the newest REPLY's first line, never the person's message drawn above it in the same turn.
    const latest = el.querySelector<HTMLElement>('[data-testid="view-chat-latest"]')
    // The answer first, the early reply only where there is no answer yet (one query each: a comma list would pick DOM order, and the early
    // reply is drawn above the answer; Codex 15 Nov, round 2).
    const newest = job ?? el.querySelector<HTMLElement>('[data-latest-floor]') ?? latest?.querySelector<HTMLElement>('[data-testid="view-chat-answer"]') ?? latest?.querySelector<HTMLElement>('[data-testid="view-chat-early"]') ?? latest
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight)
    let top = newest === null ? maxScroll : newest.offsetTop - 16
    // Contract 3 (ONE-PLAN, 15 Nov: "the newest reply opens on its first line"; as the old look): the thread never carries past the newest
    // reply's (or job's) first line. The Next step is not in the thread (it sits above it, PANEL-SPEC 1). The person's own save (below) still
    // wins: its receipt is what they look for.
    if (newest !== null) top = Math.min(top, newest.offsetTop - 16)
    // DL journey (4): a save's receipt and what it changed (ModelNoticeLine, after the newest line) come into view as the step does: whole,
    // or from its top where it is taller than the thread.
    const saved = job === null ? el.querySelector<HTMLElement>('[data-testid="view-model-notice-block"]') : null
    // It wins over the Next step below it (the person's own save is what they look for); the step stays a scroll away.
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
  const floorKey = floorShown(view).map((f) => f.job).join(',') + '|' + (earlyOf(view?.draft) === null ? 0 : 1) + (view?.draft?.status ?? '')
  const noticeKey = useModelNotice((s) => (s.notice === null ? '' : `${s.notice.kind}:${s.notice.n}`))
  const sinceTo = useViewStore((s) => s.view?.model?.run?.since?.to.n ?? null)
  // The person's own save is what they look for (DL journey (4)): each new notice (a new object, even for the same version) makes its
  // receipt due, so the rest that draws it brings it into view over the reader's floor (Codex 15 Nov, rounds 2 and 3). A notice going away
  // makes nothing due. Declared first: it runs before the rest below.
  const notice = useModelNotice((s) => s.notice)
  useEffect(() => { if (notice !== null) receiptDue.current = true }, [notice])
  useEffect(followNewest, [turns, lastTurn, job, followNewest, floating, noticeKey, notice, sinceTo, floorKey])
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
  const sid = useViewStore((s) => s.sid), gone = useViewChat((s) => s.gone ?? null)
  // PANEL-SPEC 1: the ONE next step, chosen as core's state says (v12/actions.ts nextStepFor), drawn once, at the top under the tabs.
  const step = view === null ? null : nextStepOf(view, (turn, move) => sid !== null && gone === moveKey(sid, turn, move))
  const pinned = step?.kind === 'approve'
  const chat = (
    <div ref={tab} className="flex flex-1 min-h-0 flex-col" data-testid="view-chat">
      {/* Catch up (overnight/journey SYNTHESIS item 4): one quiet row of counts at the very top, one press to the scenario record in the
          history panel; drawn only when there is something to catch up on. It repeats nothing below it (no Next step, no conclusion words). */}
      <CatchUp />
      {/* PANEL-SPEC 1 (sx-panel): the one next step sits under the tabs, above the conversation, with its button in view at rest; never below
          the thread, never cut by the composer. Olumi's waiting proposal is the one exception: one line pinned at the thread's foot (below). */}
      {/* Above the conversation only where the model has a calculated result: with none, the finding is a status the reply's lead already says, and
          it is said once here (it stays on the question card and on Analysis). */}
      {surface !== 'panel' ? null : <div className="relative z-10 shrink-0 border-b border-panel-border bg-panel px-4 pb-2 pt-1" data-testid="view-chat-finding"><FindingLine model={view?.model} at="panel" /></div>}
      {view === null || step === null || pinned ? null
        : <div className="shrink-0 px-4 pt-1" data-testid="view-chat-step"><NextStepCard view={view} busy={busy} step={step} /></div>}
      {/* The thread keeps room for its newest lines beside a pinned proposal (DL-538); the proposal shrinks and scrolls first. */}
      {/* DL 06:57Z (2): beside a pinned proposal the thread keeps a smaller floor, so the step's own words and its buttons are never cut. */}
      <div className={`relative flex flex-1 ${pinned ? 'min-h-[min(18vh,128px)]' : 'min-h-0'} flex-col`} data-thread-wrap="">
        <div ref={scroll} onScroll={readScroll} data-testid="view-chat-scroll" className="relative flex-1 min-h-0 overflow-y-auto px-3 py-4">
          <div ref={content} className="space-y-6">
            {/* A read that failed says so, before a View or after a good one (lane audit 5.4). */}
            {error === null ? null : <p role="alert" data-testid="view-chat-unread">{error}</p>}
            {/* The newest reply's own move: in the Next step card when it is the step; under the reply, quiet, while another step (Olumi's
                proposal) is the one filled button (PANEL-SPEC 1). */}
            {view === null ? null : <ViewConversation chat={view.chat} floor={floorShown(view)} draft={view.draft} moves me={view.you_id} />}
            {view?.turn == null ? null : <TurnInFlight turn={view.turn} me={view.you_id} shown={turnAlreadyShown(view)} />}
            {/* DL journey (4): the model's newest saved version and what it changed, after the thread's newest line (brought into view when it
                lands, below), so the person sees it where they are reading. */}
            <ModelNoticeLine />
            {/* V12 Solo-Return: the ideas kept on this scenario, with where each came from and who kept it. */}
            <KeptIdeas />
            {/* E4 (DL 19 Nov, URL 2): what the person said, figure by figure, and whether the model uses it: only where core serves view.intake, only once a model exists. */}
            <IntakeSheet />
            {/* ORDER-UI-5 (2), DL-408: Olumi's questions on this model, at most three, each in core's words whole, in one block. First core's
                questions about its own trial figures (model.trial_questions, SEAM-13 c2 13bd106e: the waits_on item shape, an aim's baseline
                first): each opens that figure's own editor (`id`, with core's `edit`, the one the card offers); with no edit (a proposal is
                held) it is words. Then core's other questions (coaching_questions, words only: no id, so none is guessed from the words).
                An older core sends no trial_questions: as before. */}
            {/* 17 Nov (calm panel mock v2): the questions are ONE card, one question at a time with the rest behind it (v12/chat/OlumiAsks). */}
            {/* Codex 21:12Z (17 Nov): the card is bound to its scenario (a new scenario is a new card: no draft or place carried over), and the
                answer sent is the person's words ALONE. Core's question is Olumi's; sending it inside the person's message would make the AI's
                wording and figures the person's. Core already holds the question it asked. */}
            <OlumiAsks
              key={view?.id ?? ''}
              scope={view?.id ?? ''}
              // PANEL-SPEC 4: one input for one thing. The figure the Next step asks for has its box there; its question is not drawn again.
              questions={chatQuestionsOf(view?.model).filter((q) => step?.kind !== 'figure' || q.id !== step.item.id)}
              body={(q) => <QuestionLine text={q.text} id={q.id} edit={q.edit as { prompt: string; ask: string } | null} />}
              held={held}
              // A question core sent typed (CONTRACT §3) carries its id (`answers`): the answer is bound to it on core's answer route (same op for the same words; a refusal is core's). Else today's message.
              // The question card draws no method row of its own (batch 2): the composer's one row is the place for a method.
              onAnswer={(q, answer) => { const id = q.answers ?? null, sid = useViewStore.getState().sid; return id === null || sid === null ? say(answer) : write(`answer:${id}`, answer, (op) => answerQuestion(sid, id, answer, op)) }} />
            <CommitFormSlot />
            {/* Olumi's note, when the canvas has no free spot for it (OlumiAttentionCard): here, never over a card. */}
            <div {...{ [VIEW_NOTE_SLOT]: '' }} />
            {ffMine && ffOpen ? <FigureFirstEntryPanel held={held} onGive={give} onShow={show} onClose={closeFigureFirst} /> : null}
            {ffMine && ffShown ? <FigureFirstShownPanel onClose={() => useFigureFirst.setState({ shown: null })} /> : null}
            {ff?.given == null ? null : <FigureFirstSideBySide given={ff.given} headings={ff.headings} />}
          </div>
        </div>
      </div>
      {/* "Latest" sits in its own row under the thread, never over it: drawn over the scroller it covered the review's words at 1232 (DL 15 Nov). */}
      {away ? (
        <div className="flex shrink-0 justify-end px-4 pt-1" data-testid="view-chat-latest-row">
          <button type="button" data-testid="view-chat-to-latest" aria-label="Go to the latest message" title="Go to the latest message" onClick={toLatest} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-panel-border bg-panel text-text-body"><OkIcon id="go-latest" decorative inherit /></button>
        </div>
      ) : null}
      {/* 17 Nov (the calm panel): Olumi's waiting proposal is ONE line pinned at the thread's foot, just above the composer, never over the
          conversation: the thread above it keeps its own scroll. Opened, its list grows upward inside this box (its own scroll). */}
      {view === null || step === null || !pinned ? null
        : <div className="ok-pinned mt-1 shrink-0 overflow-y-auto" data-testid="view-chat-pinned"><NextStepCard view={view} busy={busy} step={step} /></div>}
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
