/**
 * Reasoning V2 — "Challenge the thinking": ONE highest-value intervention, not
 * a list. The rest of the list stays in Strengthen; this card is the one move
 * a reader meets without opening anything.
 *
 * ⭐ PRECEDENCE, AND WHY IT IS THIS WAY ROUND. A method the reader picked in
 * the method strip wins, because it is what they just asked for. Otherwise the
 * run's own top intervention (the body's `glancePrimary`). Otherwise nothing:
 * no placeholder, no default technique.
 *
 * ⛔ THE HEADING IS `rec.title`, VERBATIM. `Recommendation` carries no question
 * field (see `prototype/ReasoningPanelV3.tsx`, "THE QUESTION-AS-HEADING"), so a
 * question composed here would be the render layer authoring a claim nothing
 * upstream sent. A picked method's heading is the catalogue's own title.
 *
 * ⛔ A PICKED METHOD CARRIES NO BASIS. The reader chose it; the card says so
 * ("Method you chose") and offers no "why this applies", because nothing
 * assessed whether it does. The basis, and the dismissal, exist only for the
 * grounded intervention.
 *
 * ⭐ THE KICKER PASSES `dskClaimId`. `methodIdsRaisedBy` (which lights the
 * method strip's "raised" dot) resolves with the claim id; `PrimaryIntervention`
 * and `StrengthenTheReasoning` call `methodForRecommendation` WITHOUT it, so on
 * a `CALIBRATION_PROMPT` card they name no technique while the strip marks one
 * as raised. This card asks the same question the strip asks, with the same
 * four arguments, so the two cannot disagree.
 *
 * ⚠ "NOT USEFUL RIGHT NOW" IS THE STRENGTHEN LIFECYCLE DISMISSAL, not a second
 * one: `seedIfAbsent` then `dismiss(recordKey(scenario, id))`, exactly the
 * sequence `StrengthenTheReasoning`'s "Not relevant" runs (seed first, because
 * `dismiss` silently no-ops on an id the store holds no record for). The view
 * model filters dismissed ids out of `vm.strengthen.interventions`, so the
 * card moves to the next intervention on the next render. The undo is offered
 * for `NOTICE_MS`, the same window the Strengthen notice uses, and restores
 * under the decision the dismissal was filed against.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
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
import { action } from '../panelSurfaces'
import { useFindingDissent } from '../useFindingDissent'

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
  /** The run the dismissal is seeded against (`responseHash ?? null`). */
  analysisHash?: string | null
  testId?: string
}

type Shown =
  | { kind: 'method'; key: string; methodId: string; heading: string }
  | {
      kind: 'intervention'
      key: string
      rec: Recommendation
      heading: string
      kicker: { id: string; title: string } | null
    }

function resolveShown(intervention: Recommendation | null, methodId: string | null): Shown | null {
  const picked = methodId ? METHOD_CATALOGUE.find((m) => m.id === methodId) : undefined
  if (picked) return { kind: 'method', key: `method:${picked.id}`, methodId: picked.id, heading: picked.title }
  if (!intervention) return null
  const method = methodForRecommendation(
    intervention.id,
    intervention.signalCode,
    intervention.biasCode,
    intervention.dskClaimId,
  )
  return {
    kind: 'intervention',
    key: `rec:${intervention.id}`,
    rec: intervention,
    heading: intervention.title,
    kicker: method ? { id: method.id, title: method.title } : null,
  }
}

export function ChallengeCard({
  intervention,
  methodId,
  onRunIntervention,
  onRunMethod,
  onDisagree,
  analysisHash = null,
  testId = 'analysis-new-challenge',
}: ChallengeCardProps) {
  const dismiss = useStrengthenStore((st) => st.dismiss)
  const restoreDismissed = useStrengthenStore((st) => st.restoreDismissed)
  const seedIfAbsent = useStrengthenStore((st) => st.seedIfAbsent)
  const scenarioId = useCanvasStore((st) => st.currentScenarioId)
  const dissent = useFindingDissent()

  const shown = resolveShown(intervention, methodId)

  // Keyed by the item on show, so neither the menu nor the basis stays open
  // over a different item when the pick changes underneath it.
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [basisFor, setBasisFor] = useState<string | null>(null)
  const [undoable, setUndoable] = useState<{ id: string; title: string; scenarioId: string | null } | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  const menuOpen = shown !== null && menuFor === shown.key
  const basisOpen = shown !== null && shown.kind === 'intervention' && basisFor === shown.key
  const disputeOpen = shown !== null && shown.kind === 'intervention' && dissent.openId === shown.rec.id
  const standingDispute = shown !== null && shown.kind === 'intervention' ? dissent.standing(shown.rec) : undefined

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenuFor(null)
      // Focus goes back to the trigger rather than to the document body.
      menuRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus()
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

  if (!shown) return notice

  const run = () => (shown.kind === 'method' ? onRunMethod(shown.methodId) : onRunIntervention(shown.rec.id))
  const basisId = `${testId}-basis`
  const whyLine = shown.kind === 'intervention' ? strengthenWhyLine(shown.rec.signal, shown.rec.whyNow) : ''

  return (
    <div
      data-testid={testId}
      data-source={shown.kind}
      {...(shown.kind === 'intervention'
        ? { 'data-recommendation-id': shown.rec.id }
        : { 'data-method-id': shown.methodId })}
    >
      {notice}
      {shown.kind === 'method' ? (
        <p className={`${typography.panelMeta} text-text-light`} data-testid={`${testId}-kicker`}>
          {ZONE.methodYouChose}
        </p>
      ) : shown.kicker ? (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid={`${testId}-kicker`}
          data-method-id={shown.kicker.id}
        >
          {shown.kicker.title}
        </p>
      ) : null}
      <div className="flex items-start gap-1">
        <h3 className={`${typography.panelHeader} text-text-header min-w-0 flex-1`} data-testid={`${testId}-heading`}>
          {shown.heading}
        </h3>
        <div className="flex shrink-0 items-center">
          <PanelIconButton ai label={ZONE.workThrough} onClick={run} testId={`${testId}-work-through`} />
          {shown.kind === 'intervention' ? (
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
                  role="menu"
                  aria-label={ZONE.moreOptions}
                  className="absolute right-0 top-full z-20 mt-1 min-w-[168px] py-1 rounded-md border border-panel-border bg-panel shadow-2"
                  data-testid={`${testId}-menu`}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setBasisFor(basisOpen ? null : shown.key)
                      setMenuFor(null)
                    }}
                    className={`${typography.panelBody} w-full px-3 py-1.5 text-left text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-why`}
                  >
                    {ZONE.whyThis}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuFor(null)
                      dissent.open(shown.rec, analysisHash)
                    }}
                    className={`${typography.panelBody} w-full px-3 py-1.5 text-left text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-disagree`}
                  >
                    {standingDispute ? COPY.dissent.edit : COPY.dissent.open}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => retire(shown.rec)}
                    className={`${typography.panelBody} w-full px-3 py-1.5 text-left text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-not-useful`}
                  >
                    {ZONE.notUseful}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {basisOpen && shown.kind === 'intervention' ? (
        <div
          id={basisId}
          className="mt-1 space-y-0.5"
          data-testid={basisId}
          {...(shown.rec.dskClaimId ? { 'data-dsk-claim-id': shown.rec.dskClaimId } : {})}
        >
          {whyLine ? (
            <p className={`${typography.panelBody} text-text-body`} data-testid={`${basisId}-why`}>
              {whyLine}
            </p>
          ) : null}
          {shown.rec.sourceLine ? (
            <p className={`${typography.panelMeta} text-text-light`} data-testid={`${basisId}-source`}>
              {shown.rec.sourceLine}
            </p>
          ) : null}
          {/* The claim id is an ID: it rides as a data attribute, never as
              copy (`ScienceGrounding`'s rule). What the reader sees is that the
              card is grounded, in the chip wording Strengthen already uses. */}
          {shown.rec.dskClaimId ? (
            <p className={`${typography.panelMeta} text-text-light`} data-testid={`${basisId}-grounded`}>
              {COPY.strengthen.groundedChip}
            </p>
          ) : null}
        </div>
      ) : null}
      {/* "I disagree" (E18) — the SAME writer `StrengthenTheReasoning` already
          ships: `strengthenStore.dispute` (session), `dissentStore.recordDissent`
          (durable) and the `finding_dissent` system event, ported by
          `useFindingDissent`. See that hook's docblock for the documented
          product-decision tension this PR surfaces rather than resolves. */}
      {disputeOpen && shown.kind === 'intervention' ? (
        <form
          className="mt-1.5"
          data-testid={`${testId}-disagree-form`}
          onSubmit={(e) => {
            e.preventDefault()
            dissent.commit(shown.rec)
          }}
        >
          <label
            className={`${typography.panelMeta} block text-text-light mb-1`}
            htmlFor={`${testId}-disagree-input`}
            data-testid={`${testId}-disagree-prompt`}
          >
            {dissent.willSend() ? COPY.dissent.promptSendsToOlumi : COPY.dissent.prompt}
          </label>
          <textarea
            id={`${testId}-disagree-input`}
            value={dissent.draft}
            onChange={(e) => dissent.setDraft(e.target.value)}
            rows={2}
            className={`${typography.panelBody} w-full rounded border border-panel-border bg-panel-hover px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            data-testid={`${testId}-disagree-input`}
          />
          {dissent.saveError ? (
            <p
              role="alert"
              className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
              data-testid={`${testId}-disagree-save-error`}
            >
              {dissent.saveError}
            </p>
          ) : null}
          <PanelActRow className="mt-1">
            <button
              type="submit"
              className={`${typography.panelMeta} ${action('inline')}`}
              data-testid={`${testId}-disagree-save`}
            >
              {COPY.dissent.save}
            </button>
            <button
              type="button"
              onClick={dissent.close}
              className={`${typography.panelMeta} rounded text-text-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              data-testid={`${testId}-disagree-cancel`}
            >
              {COPY.dissent.cancel}
            </button>
            {/* Ruling c5806258826.md §3 / the map's own fix note: "the chat
                route can stay as an option." Offered only when the host still
                wires it — this PR does not touch what TB passes. */}
            {onDisagree ? (
              <button
                type="button"
                onClick={() => {
                  dissent.close()
                  onDisagree(shown.rec)
                }}
                className={`${typography.panelMeta} rounded text-text-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                data-testid={`${testId}-disagree-chat-instead`}
              >
                {ZONE.discussInChat}
              </button>
            ) : null}
          </PanelActRow>
        </form>
      ) : standingDispute ? (
        <p
          className={`${typography.panelBody} mt-1.5 mb-0 rounded border border-attention/40 bg-panel-hover px-2 py-1 text-text-body`}
          data-testid={`${testId}-disagreement`}
          data-recommendation-id={shown.kind === 'intervention' ? shown.rec.id : undefined}
        >
          <span className={`${typography.panelMeta} text-text-light`}>{COPY.dissent.standing}: </span>
          {standingDispute}
        </p>
      ) : null}
    </div>
  )
}
