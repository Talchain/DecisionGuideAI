/**
 * Reasoning V2 — "Challenge the thinking": ONE highest-value intervention, not
 * a list. The rest of the list stays in Strengthen; this card is the one move
 * a reader meets without opening anything.
 *
 * ⭐ V2 PROTOTYPE (design audit B7, 25 Sep 2026 — `challengeHTML` and the
 * `question-options` popover). The section title carries ⓘ "Why this method
 * here?", which opens the method basis; under the title sits ONLY the
 * question (no kicker); then ✎ Respond, ✦ and ⋯ "Question options", whose
 * menu is "Why this question?", "Not useful right now", a separator and every
 * method with its icon; Respond's label is the item's exercise and its send is
 * "Send to Olumi" beside a round ➤.
 *
 * ⭐ PRECEDENCE, AND WHY IT IS THIS WAY ROUND. A method the reader picked in
 * the method strip wins, because it is what they just asked for — EXCEPT when
 * it is the very method the run's own top finding names: then the finding IS
 * that method's question, and it is shown (the prototype's "the active
 * method's question"). Otherwise the run's own top intervention (the body's
 * `glancePrimary`). Otherwise nothing: no placeholder, no default technique.
 *
 * ⛔ THE HEADING IS `rec.title`, VERBATIM. `Recommendation` carries no question
 * field (see `prototype/ReasoningPanelV3.tsx`, "THE QUESTION-AS-HEADING"), so a
 * question composed here would be the render layer authoring a claim nothing
 * upstream sent. A picked method's heading is the catalogue's own title. The
 * prototype's per-method questions are written about ITS example model; no
 * producer field carries one for a live model, and none is invented here.
 *
 * ⛔ A PICKED METHOD'S BASIS SAYS WHAT THE METHOD IS, NEVER THAT IT APPLIES.
 * Nothing assessed whether it applies to this model, so its basis is the
 * catalogue's own description plus "<method>: a reasoning aid, not a
 * prediction or diagnosis." A grounded finding's basis is its own why-line.
 *
 * ⭐ THE TECHNIQUE IS RESOLVED WITH `dskClaimId`. `methodIdsRaisedBy` (which
 * lights the method strip's "raised" dot) resolves with the claim id;
 * `PrimaryIntervention` and `StrengthenTheReasoning` call
 * `methodForRecommendation` WITHOUT it, so on a `CALIBRATION_PROMPT` card they
 * name no technique while the strip marks one as raised. This card asks the
 * same question the strip asks, with the same four arguments
 * (`methodOfIntervention`), so the two cannot disagree — and the body uses the
 * same function to choose the strip's active method at rest.
 *
 * ⚠ "NOT USEFUL RIGHT NOW" ON A FINDING IS THE STRENGTHEN LIFECYCLE DISMISSAL,
 * not a second one: `seedIfAbsent` then `dismiss(recordKey(scenario, id))`,
 * exactly the sequence `StrengthenTheReasoning`'s "Not relevant" runs (seed
 * first, because `dismiss` silently no-ops on an id the store holds no record
 * for). The view model filters dismissed ids out of
 * `vm.strengthen.interventions`, so the card moves to the next intervention on
 * the next render. The undo is offered for `NOTICE_MS`, the same window the
 * Strengthen notice uses, and restores under the decision the dismissal was
 * filed against. On a PICKED METHOD it writes nothing: it hands the pick back
 * to the host (`onSetAsideMethod`), which clears it.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Clock, Info, MessageSquareX, MoreHorizontal, Pencil } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY, strengthenWhyLine } from '../analysisNewCopy'
import { CHALLENGE_ZONE_COPY as ZONE } from '../challengeZoneCopy'
import { methodForRecommendation } from '../recommendationMethod'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { NOTICE_MS } from '../../strengthen/StrengthenPanel'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import { useStrengthenStore, recordKey } from '../../../../canvas/stores/strengthenStore'
import { useCanvasStore } from '../../../../canvas/store'
import { PanelIconButton } from '../PanelIconButton'
import { PanelActRow } from '../PanelActRow'
import { REVIEW_TOOL_COPY } from '../buildReviewQueue'
import { ACTION_FOCUS, action, icon } from '../panelSurfaces'
import { respondToIntervention, respondToMethod } from '../challengeResponse'
import type { MethodEntry } from '../../decision-overview/actionsCatalogue'
import {
  METHOD_MENU_GLYPH_CLASS,
  METHOD_MENU_POPOVER_CLASS,
  METHOD_MENU_SEPARATOR_CLASS,
  methodIcon,
  methodMenuRowClass,
  methodsInMenuOrder,
  type MethodGlyph,
} from './MethodStrip'

/**
 * 14px, the prototype's `.challenge-question` size, through the panel's own
 * token rather than a raw size-and-weight class pair, which bypassed the
 * declared scale (render-discipline RULE A, shell-conformance). It is a `<p>`
 * under the zone's h3, led by a dot, so the hierarchy is carried by element
 * and position.
 */
const ITEM_TEXT = typography.panelQuestion

/**
 * The technique a finding names — the ONE four-argument call (`dskClaimId`
 * included) the strip's "raised" dot also makes. `null` when it names none.
 */
export function methodOfIntervention(rec: Recommendation | null): MethodEntry | null {
  if (!rec) return null
  return methodForRecommendation(rec.id, rec.signalCode, rec.biasCode, rec.dskClaimId)
}

export interface ChallengeCardProps {
  /** The body's `glancePrimary` — `vm.strengthen.interventions`' pick. */
  intervention: Recommendation | null
  /** A method the reader picked in the method strip, or `null`. */
  methodId: string | null
  /** The existing `runIntervention` route (ask drawer, carries `block_id`). */
  onRunIntervention: (recommendationId: string) => void
  /** The existing `runMethod` route, by catalogue id. */
  onRunMethod: (methodId: string) => void
  /** "I disagree" on a grounded finding: continues into the conversation. */
  onDisagree?: (rec: Recommendation) => void
  /**
   * The ⋯ menu's method rows pick a method, exactly as the strip does. Absent
   * ⇒ the menu lists no methods.
   */
  onSelectMethod?: (methodId: string) => void
  /**
   * "Not useful right now" on a PICKED method: the host clears the pick.
   * Absent ⇒ a picked method offers no set-aside.
   */
  onSetAsideMethod?: () => void
  /**
   * The section title ("Challenge the thinking"). When given, the card renders
   * it as an h3 beside the ⓘ that opens the basis; absent, the card renders no
   * title (and nothing at all when it has nothing to show).
   */
  title?: string
  titleTestId?: string
  /** The run the dismissal is seeded against (`responseHash ?? null`). */
  analysisHash?: string | null
  testId?: string
}

type Shown =
  | { kind: 'method'; key: string; heading: string; method: MethodEntry }
  | { kind: 'intervention'; key: string; heading: string; rec: Recommendation; method: MethodEntry | null }

function resolveShown(intervention: Recommendation | null, methodId: string | null): Shown | null {
  const named = methodOfIntervention(intervention)
  const picked = methodId ? METHOD_CATALOGUE.find((m) => m.id === methodId) : undefined
  if (picked && !(intervention && named?.id === picked.id))
    return { kind: 'method', key: `method:${picked.id}`, heading: picked.title, method: picked }
  if (!intervention) return null
  return { kind: 'intervention', key: `rec:${intervention.id}`, heading: intervention.title, rec: intervention, method: named }
}

/** One row of the "Question options" menu: the prototype's icon plus name. */
function MenuRow({
  Glyph,
  label,
  onClick,
  current = false,
  testId,
}: {
  Glyph: MethodGlyph
  label: string
  onClick: () => void
  current?: boolean
  testId: string
}): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      aria-current={current ? 'true' : undefined}
      onClick={onClick}
      className={methodMenuRowClass(current)}
      data-testid={testId}
    >
      <Glyph className={METHOD_MENU_GLYPH_CLASS} aria-hidden={true} />
      {label}
    </button>
  )
}

export function ChallengeCard({
  intervention,
  methodId,
  onRunIntervention,
  onRunMethod,
  onDisagree,
  onSelectMethod,
  onSetAsideMethod,
  title,
  titleTestId,
  analysisHash = null,
  testId = 'analysis-new-challenge',
}: ChallengeCardProps) {
  const dismiss = useStrengthenStore((st) => st.dismiss)
  const restoreDismissed = useStrengthenStore((st) => st.restoreDismissed)
  const seedIfAbsent = useStrengthenStore((st) => st.seedIfAbsent)
  const scenarioId = useCanvasStore((st) => st.currentScenarioId)

  const shown = resolveShown(intervention, methodId)

  // Keyed by the item on show, so neither the menu nor the basis stays open
  // over a different item when the pick changes underneath it.
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [basisFor, setBasisFor] = useState<string | null>(null)
  const [undoable, setUndoable] = useState<{ id: string; title: string; scenarioId: string | null } | null>(null)
  // Respond (E11): the reader's own note. ⚠ THE TEXT IS BOUND TO THE ITEM IT
  // WAS WRITTEN FOR, not merely the open state: keyed text alone survived a
  // pick-change, so reopening Respond on the next item sent the old words under
  // the new heading (review 5819068969). One record, so they cannot part.
  const [respond, setRespond] = useState<{ key: string; text: string } | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const respondRef = useRef<HTMLButtonElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  const menuOpen = shown !== null && menuFor === shown.key
  const basisOpen = shown !== null && basisFor === shown.key
  const respondOpen = shown !== null && respond !== null && respond.key === shown.key
  const respondText = respondOpen ? respond.text : ''

  const closeRespond = () => setRespond(null)
  const focusTrigger = () =>
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus()

  const sendRespond = () => {
    const text = respondText.trim()
    if (!shown || !text) return
    if (shown.kind === 'method') respondToMethod(shown.method, text)
    else respondToIntervention(shown.rec, text)
    closeRespond()
  }

  /* The keyboard model the method strip's menu ships: first item focused on
     open, Arrow/Home/End rove, Escape closes and restores focus, a press
     outside closes. */
  useEffect(() => {
    if (!menuOpen) return
    const items = () =>
      Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    items()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuFor(null)
        // Focus goes back to the trigger rather than to the document body.
        focusTrigger()
        return
      }
      if (e.key === 'Tab') {
        setMenuFor(null)
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      const list = items()
      if (list.length === 0) return
      e.preventDefault()
      const current = list.indexOf(document.activeElement as HTMLButtonElement)
      const next =
        e.key === 'Home' ? 0
        : e.key === 'End' ? list.length - 1
        : e.key === 'ArrowDown' ? (current + 1 + list.length) % list.length
        : (current - 1 + list.length) % list.length
      list[next]?.focus()
    }
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuFor(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [menuOpen])

  const retire = useCallback(
    (rec: Recommendation) => {
      seedIfAbsent(rec, analysisHash, scenarioId)
      dismiss(recordKey(scenarioId, rec.id))
      setMenuFor(null)
      setBasisFor(null)
      setUndoable({ id: rec.id, title: rec.title, scenarioId })
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
      noticeTimer.current = setTimeout(() => setUndoable(null), NOTICE_MS)
    },
    [seedIfAbsent, dismiss, analysisHash, scenarioId],
  )

  // The item the reader just retired unmounts with its menu, so focus moves to
  // the Undo that names it (Strengthen's notice does the same).
  useEffect(() => {
    if (undoable) undoRef.current?.focus()
  }, [undoable])

  const undo = () => {
    if (!undoable) return
    restoreDismissed(recordKey(undoable.scenarioId, undoable.id))
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setUndoable(null)
  }

  const notice = undoable ? (
    <p className={`${typography.panelMeta} text-text-light`} role="status" data-testid={`${testId}-dismissed-notice`}>
      {STRENGTHEN_COPY.dismissedNotice}: {undoable.title}{' '}
      <button
        ref={undoRef}
        type="button"
        onClick={undo}
        className={action('inline')}
        data-testid={`${testId}-dismissed-undo`}
      >
        {STRENGTHEN_COPY.undo}
      </button>
    </p>
  ) : null

  const basisId = `${testId}-basis`
  const toggleBasis = () => {
    if (!shown) return
    setBasisFor(basisOpen ? null : shown.key)
  }

  /* ⭐ V2 `.section-title`: the h3 and its ⓘ on one row, the ⓘ at the far end.
     The ⓘ is the h3's SIBLING, not its child, so the heading's accessible name
     stays exactly the title. 28px tall whether or not the ⓘ renders. */
  const titleRow = title ? (
    <div className="flex min-h-7 items-center justify-between gap-2.5">
      <h3 className={`${typography.panelHeader} text-text-header m-0`} data-testid={titleTestId}>
        {title}
      </h3>
      {shown ? (
        <PanelIconButton
          Icon={Info}
          /* Names a METHOD only when the card shows one (#2066 review
             note): a finding that names no technique has no method to
             explain, and its basis panel has no protocol line. */
          label={shown.method ? ZONE.whyMethodHere : ZONE.whyThis}
          onClick={toggleBasis}
          expanded={basisOpen}
          testId={`${testId}-why-method`}
        />
      ) : null}
    </div>
  ) : null
  const withTitle = (inner: ReactNode) =>
    titleRow ? (
      <div data-testid={`${testId}-section`}>
        {titleRow}
        {inner}
      </div>
    ) : (
      inner
    )

  if (!shown) return withTitle(notice)

  const run = () => (shown.kind === 'method' ? onRunMethod(shown.method.id) : onRunIntervention(shown.rec.id))
  const shownMethod = shown.method
  const whyText =
    shown.kind === 'intervention' ? strengthenWhyLine(shown.rec.signal, shown.rec.whyNow) : shown.method.description
  // The exercise: the producer's own `tryThis` when it sent one; otherwise the
  // neutral label. Never a composed one (see `ZONE.respondLabel`).
  const exercise = shown.kind === 'intervention' && shown.rec.tryThis ? shown.rec.tryThis : ZONE.respondLabel
  const canSetAside = shown.kind === 'intervention' || onSetAsideMethod !== undefined
  const setAside = () => {
    if (shown.kind === 'intervention') {
      retire(shown.rec)
      return
    }
    setMenuFor(null)
    setBasisFor(null)
    onSetAsideMethod?.()
  }
  const bullet = `${typography.panelBody} relative pl-[11px] text-text-body before:absolute before:left-px before:content-['·']`

  return withTitle(
    <div
      data-testid={testId}
      data-source={shown.kind}
      {...(shown.kind === 'intervention' ? { 'data-recommendation-id': shown.rec.id } : {})}
      {...(shownMethod ? { 'data-method-id': shownMethod.id } : {})}
    >
      {notice}
      {/* ⭐ V2 prototype (`.challenge-question` + `.challenge-footer`): the item
          is the zone's QUESTION on its own line — 14px/500 with a quiet leading
          dot — and the acts sit on the row BELOW it: "✎ Respond" as an
          icon-led info text-button on the left, the AI and "…" icons on the
          right. Still `.title` verbatim (ruling §3). No kicker above it: the
          method is carried by the strip's active marker and by the basis. */}
      <p className={`${ITEM_TEXT} text-text-header m-0 mt-[7px] mb-1 min-w-0 flex gap-1.5`}>
        <span className="text-text-light" aria-hidden={true}>·</span>
        <span className="min-w-0" data-testid={`${testId}-heading`}>{shown.heading}</span>
      </p>
      <div className="flex items-center justify-between gap-2.5 mt-[3px] min-h-[27px]">
        <button
          ref={respondRef}
          type="button"
          onClick={() => (respondOpen ? closeRespond() : setRespond({ key: shown.key, text: '' }))}
          aria-expanded={respondOpen}
          className={`${typography.panelBody} ${action('text')}`}
          data-testid={`${testId}-respond`}
        >
          <Pencil className={`${icon('row')} shrink-0`} aria-hidden={true} />
          {ZONE.respond}
        </button>
        <div className="flex shrink-0 items-center gap-[3px]">
          <PanelIconButton
            ai
            label={shownMethod ? ZONE.guideMethod : ZONE.workThrough}
            onClick={run}
            testId={`${testId}-work-through`}
          />
          <div className="relative" ref={menuRef}>
            <PanelIconButton
              Icon={MoreHorizontal}
              label={ZONE.moreOptions}
              onClick={() => setMenuFor(menuOpen ? null : shown.key)}
              hasPopup="menu"
              expanded={menuOpen}
              testId={`${testId}-more`}
            />
            {menuOpen ? (
              <div
                ref={listRef}
                role="menu"
                aria-label={ZONE.moreOptions}
                className={METHOD_MENU_POPOVER_CLASS}
                data-testid={`${testId}-menu`}
              >
                <MenuRow
                  Glyph={Info}
                  label={ZONE.whyThis}
                  onClick={() => {
                    toggleBasis()
                    setMenuFor(null)
                  }}
                  testId={`${testId}-why`}
                />
                {canSetAside ? (
                  <MenuRow Glyph={Clock} label={ZONE.notUseful} onClick={setAside} testId={`${testId}-not-useful`} />
                ) : null}
                {shown.kind === 'intervention' && onDisagree ? (
                  <MenuRow
                    Glyph={MessageSquareX}
                    label={REVIEW_TOOL_COPY.disagree}
                    onClick={() => {
                      setMenuFor(null)
                      onDisagree(shown.rec)
                    }}
                    testId={`${testId}-disagree`}
                  />
                ) : null}
                {onSelectMethod ? (
                  <>
                    <div role="separator" className={METHOD_MENU_SEPARATOR_CLASS} data-testid={`${testId}-menu-separator`} />
                    {methodsInMenuOrder().map((m) => (
                      <MenuRow
                        key={m.id}
                        Glyph={methodIcon(m.id)}
                        label={m.title}
                        current={shownMethod?.id === m.id}
                        onClick={() => {
                          setMenuFor(null)
                          focusTrigger()
                          onSelectMethod(m.id)
                        }}
                        testId={`${testId}-menu-method-${m.id}`}
                      />
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {/* V2 `.method-basis`: the basis, then the protocol line — after the
          footer, before the Respond form. */}
      {basisOpen ? (
        <div
          id={basisId}
          className="py-2"
          data-testid={basisId}
          {...(shown.kind === 'intervention' && shown.rec.dskClaimId ? { 'data-dsk-claim-id': shown.rec.dskClaimId } : {})}
        >
          <ul className="m-0 my-1.5 grid list-none gap-1.5 pl-[15px]">
            {whyText ? (
              <li className={bullet} data-testid={`${basisId}-why`}>
                {whyText}
              </li>
            ) : null}
            {shownMethod ? (
              <li className={bullet} data-testid={`${basisId}-protocol`}>
                <strong>{shownMethod.title}:</strong> {ZONE.reasoningAid}
              </li>
            ) : null}
          </ul>
          {shown.kind === 'intervention' && shown.rec.sourceLine ? (
            <p className={`${typography.panelMeta} text-text-light my-1`} data-testid={`${basisId}-source`}>
              {shown.rec.sourceLine}
            </p>
          ) : null}
          {/* The claim id is an ID: it rides as a data attribute, never as
              copy (`ScienceGrounding`'s rule). What the reader sees is that the
              card is grounded, in the chip wording Strengthen already uses. */}
          {shown.kind === 'intervention' && shown.rec.dskClaimId ? (
            <p className={`${typography.panelMeta} text-text-light my-1`} data-testid={`${basisId}-grounded`}>
              {COPY.strengthen.groundedChip}
            </p>
          ) : null}
        </div>
      ) : null}
      {respondOpen ? (
        <form
          className="grid gap-2 pt-[9px] pb-[5px]"
          data-testid={`${testId}-respond-form`}
          onSubmit={(e) => {
            e.preventDefault()
            sendRespond()
          }}
        >
          <div className="grid gap-[5px]">
            <label className={`${typography.panelBody} text-text-body`} htmlFor={`${testId}-respond-note`}>
              {exercise}
            </label>
            <textarea
              id={`${testId}-respond-note`}
              value={respondText}
              autoFocus={true}
              onChange={(e) => setRespond({ key: shown.key, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return
                e.preventDefault()
                closeRespond()
                // Back to the trigger, as the menu's Escape does.
                respondRef.current?.focus()
              }}
              placeholder={ZONE.respondPlaceholder}
              rows={2}
              className={`${typography.panelBody} min-h-[64px] w-full resize-y rounded-sm border border-field bg-panel px-[9px] py-[7px] text-text-body ${ACTION_FOCUS}`}
              data-testid={`${testId}-respond-note`}
            />
          </div>
          <PanelActRow className="justify-between">
            <button
              type="button"
              onClick={closeRespond}
              className={`${typography.panelBody} ${action('text')}`}
              data-testid={`${testId}-respond-cancel`}
            >
              {ZONE.respondCancel}
            </button>
            {/* V2 `sendButton()`: the words, then the round ➤. The words are
                the button's own name, so they are hidden from the tree once. */}
            <span className={`${typography.panelMeta} ml-auto flex items-center gap-[7px] text-text-light`}>
              <span aria-hidden={true}>{ZONE.respondSend}</span>
              <button
                type="submit"
                disabled={respondText.trim() === ''}
                aria-label={ZONE.respondSend}
                className={`inline-flex size-[29px] shrink-0 items-center justify-center rounded-full bg-info text-text-on-color hover:bg-info-hover disabled:cursor-default disabled:opacity-40 ${ACTION_FOCUS}`}
                data-testid={`${testId}-respond-send`}
              >
                <ArrowUp className={icon('section')} aria-hidden={true} />
              </button>
            </span>
          </PanelActRow>
        </form>
      ) : null}
    </div>,
  )
}
