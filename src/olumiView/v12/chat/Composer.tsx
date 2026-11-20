/** The composer the dock's footer holds, with the working line while a write is in flight (moved verbatim from ViewChat.tsx). */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { registerDockedOlumiFocus } from '../../../canvas/conversation/dockedOlumiFocus'
import { useViewStore } from '../../store'
import { sessionOf } from '../../layout'
import { useMe } from '../../../olumiCore/me'
import { ThinkingIndicator } from '../../../canvas/conversation/zones/ThinkingIndicator'
import { typography } from '../../../styles/typography'
import { controls } from '../../../styles/controls'
import { useEscapeLayer } from '../edit/escapeLayers'
import type { AIInputBarProps } from '../../../canvas/components/AIInputBar'
import { useBriefDocumentUpload } from '../../../canvas/components/BriefDocumentUpload'
import { useUIStore } from '../../../stores/uiStore'
import { V10_METHODS } from '../../../presentation/V10MethodChips'
import { VIEW_CHIP_OUTLINE_CLASS } from '../../../v5/blocks/chipClass'
import { onFloor } from '../../early'
import { ActionsMenu } from '../actionsMenu'
import { menuOf } from '../actions'
import { OkIcon, OkIconButton } from '../../look/icons'
import { SelectionPill } from '../../../canvas/components/SelectionPill'
import { selectedKindMark, selectedRename, useDetailsOpenFor } from '../../SelectedRename'
import { CHAT_POPOUT_LABEL, CHAT_POPOUT_TITLE, popOutChat, useChatFloat } from '../../port/ChatFloat'
import { PAST_HELD, PICK_A_CARD, TALK_FIRST, TALK_FIRST_HOVER, askAboutSelection, buildModel, buildOfferOf, isAnswering, isDrafting, pressChallenge, restorePendingBrief, restorePendingTurn, send, takesBrief, useArmedChallenge, useViewChat } from './chatActions'
import { SessionGoal, runMethod, runTool } from './nextStep'

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
    // Paul, 19 Nov: the faint line alone was hard to see and dull; the older look's brand loader (the six node shapes in a colour wave,
    // canvas/conversation/zones/ThinkingIndicator, still in use there; still under reduced motion) stands above it again.
    <div className="grid justify-items-center gap-1 py-2">
      <div aria-hidden="true"><ThinkingIndicator /></div>
      <p role="status" className={`${typography.viewPanelMeta} m-0 text-text-light`} data-testid="view-chat-working">{THINKING_WORDS} <span data-testid="view-chat-working-seconds">{s} s</span></p>
    </div>
  )
}

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
export function ViewComposerBody({ analysisAction }: { analysisAction?: AIInputBarProps['analysisAction'] }): ReactNode {
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
  const onOlumiTab = useUIStore((s) => s.activeOutputTab === 'olumi')
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
  // Core's own method offers, in core's words (`session.methods[].text`): the UI chooses which to show, never what they are called.
  // Only on the Olumi tab and only while the box is empty: they duplicate the method icons, so they fold away once the person types or leaves the tab.
  const thinkingMethods = !onOlumiTab || text !== '' ? [] : (menu?.methods ?? []).filter((m) => THINKING_METHOD_IDS.has(m.id))
  // V12 boards: one sentence in the box once there is a model to ask about (it replaces the stage-by-stage lines); the first brief keeps its example.
  const placeholder = brief ? BRIEF_EXAMPLE : COMPOSER_PLACEHOLDER
  return (
    <div className={`${typography.viewPanelBody} px-4 pb-3 pt-2 space-y-2`} data-testid="view-composer">
      {said === null ? null : <p role="alert" data-testid="view-chat-said">{said}</p>}
      {/* While a write is in flight the composer is held: it says why (lane audit 5.7), in core's page's words. */}
      {/* A brief's drafting is said on the board (DraftingBoard.tsx), once; a message being answered is said here. */}
      {busy && !brief ? <Working /> : null}
      {past === null ? null : (
        <p className="flex flex-wrap items-center gap-2" data-testid="view-composer-past">
          <span>{PAST_HELD}</span>
          <button type="button" className="rounded-sm px-2 py-1 border border-panel-border" data-testid="view-composer-back" onClick={() => void useViewStore.getState().look(null)}>Back to the latest</button>
        </p>
      )}
      <label className={brief ? `${typography.viewPanelHeading} text-text-header` : 'sr-only'} htmlFor="view-chat-text">{brief ? 'Your brief' : 'Message Olumi'}</label>
      {/* What to write, until it is written: once the brief is sent, the box holds it and the board says what happens. */}
      {brief && !busy && !drafting ? <p id="view-brief-intro" className="text-text-body" data-testid="view-brief-intro">{BRIEF_INTRO}</p> : null}
      {thinkingMethods.length === 0 ? null : (
        <div role="group" aria-label="Ways to think about this" className="flex flex-wrap items-center gap-1" data-testid="view-thinking-methods">
          {thinkingMethods.map((m) => (
            <button key={m.id} type="button" className={VIEW_CHIP_OUTLINE_CLASS} disabled={held || answering}
              data-testid={`view-thinking-${m.id}`} onClick={() => runMethod(m.id)}><span data-view={`session.methods.${m.i}.text`}>{m.text}</span></button>
          ))}
        </div>
      )}
      {/* Keep the first line compact as the brief or message grows (pre-screen 4b92d394 row 13). */}
      <div className="relative bg-panel border border-panel-border rounded-md transition-colors focus-within:border-text-light">
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
          {analysisAction === undefined ? null : (
            <OkIconButton id="run-analysis" words={blocked ? analysisAction.blockedReason ?? analysisAction.label : analysisAction.label} active={analysisAction.isRunning} testid="view-composer-analyse"
              className={`h-7 w-7 rounded-md hover:bg-panel-hover${analysisAction.isRunning ? ' [&_svg]:animate-spin' : ''}`} disabled={past !== null || analysisAction.isRunning || !analysisAction.canRun} onClick={analysisAction.onRun} />
          )}
          {/* Words-start (17 Nov): the one deliberate choice for a new brief, beside Send; Send still builds a model (the default). */}
          {!brief ? null : (
            <button type="button" disabled={sendHeld} title={TALK_FIRST_HOVER} data-testid="view-composer-talk-first" onClick={() => { if (!sendHeld) void send(true) }}
              className={`${typography.viewPanelHeading} inline-flex min-h-7 items-center gap-1.5 rounded-md px-2 text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header disabled:cursor-default`}>
              <OkIcon id="talk-first" size={14} inherit />{TALK_FIRST}
            </button>
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
/** Core's native thinking methods offered beside the box when core serves them (ids only; their words are core's). */
const THINKING_METHOD_IDS: ReadonlySet<string> = new Set(['else_do', 'right_question'])
