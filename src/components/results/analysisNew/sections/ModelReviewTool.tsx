/**
 * ONE REVIEW AFFORDANCE FOR THE WHOLE MODEL — framing, assumptions,
 * relationships, values, alternatives and evidence, one item at a time.
 *
 * Collapsed, it is one row: "N to review" and an ask to check the whole
 * framing. Empty, it draws nothing (see the note above the return). Open, it
 * pages through `buildReviewQueue`'s items with the acts a
 * reader needs on each: inspect it in the Model, focus it on the canvas, ask
 * Olumi about it, change its value, confirm an estimate as their own.
 *
 * ⚠⚠ REVIEWED IS NOT VERIFIED IS NOT ESTABLISHED. Confirming an estimate makes
 * it the reader's estimate; it verifies nothing behind it, and the control says
 * so. There is no "Mark reviewed": nothing would persist it, and a tick that
 * forgets itself on reload is a claim the product does not keep.
 *
 * ⚠ "Add evidence or context" IS AN ASK, NOT A FORM. There is no model-level
 * evidence store, so the words go to Olumi with the item's context and are
 * never recorded as evidence.
 *
 * ⚠ THIS FILE OPENS NO ROUTE OF ITS OWN. The ask, the Model-tab inspection and
 * the edit are the caller's handlers (`onAsk`, `onInspect`, `onEdit`); the
 * canvas focus defaults to `focusModelTarget`; the value write is
 * `FactorValueControl`'s; the confirmation is the write authority's
 * `proposeFactorConfirmation`; "Not relevant" is the strengthen lifecycle
 * store's `dismiss`, the same one the Strengthen cards write.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Info,
  ListTree,
  MoreHorizontal,
  Pencil,
  Search,
  X,
} from 'lucide-react'

import Tooltip from '../../../Tooltip'
import { useCanvasStore } from '../../../../canvas/store'
import { useModelEditAuthority } from '../../../../canvas/hooks/useModelEditAuthority'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { useShowToastSafe } from '../../../../canvas/ToastContext'
import { recordKey, useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { typography } from '../../../../styles/typography'
import type { AskOlumiPayload } from '../../coaching/askOlumiStore'
import { NOTICE_MS } from '../../strengthen/StrengthenPanel'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
import { stripNodeValueSignature } from '../buildModelStrip'
import {
  buildReviewQueue,
  REVIEW_KIND_LABEL,
  REVIEW_TOOL_COPY as COPY,
  reviewItemAskPayload,
  reviewItemContextPayload,
  reviewItemDisagreePayload,
  reviewValueProvenance,
  reviewValueText,
  WHOLE_FRAMING_ASK,
} from '../buildReviewQueue'
import { FactorValueControl } from '../FactorValueControl'
import { OlumiAiIcon } from '../OlumiAiIcon'
import { PanelIconButton } from '../PanelIconButton'
import { ACTION_FOCUS, action, icon } from '../panelSurfaces'

export interface ModelReviewToolProps {
  /** `vm.strengthen.interventions`, in engine order. */
  interventions: readonly Recommendation[]
  /** The recommendation the Challenge card promotes; left out of this queue. */
  excludeId?: string | null
  /** The tab's ask route. Wire `openAskOlumi`. */
  onAsk: (payload: AskOlumiPayload) => void
  /** Open the target's row on the Model tab. Absent = no Inspect control. */
  onInspect?: (targetId: string) => void
  /**
   * Show the target on the canvas. Must answer whether it could — `false`
   * says so to the reader rather than doing nothing silently.
   */
  onFocus?: (targetId: string) => boolean
  /** Edit a non-factor target. A factor is edited inline instead. */
  onEdit?: (targetId: string) => void
  /** The run the findings came from, stamped on a dismissal record. */
  analysisHash?: string | null
  testId?: string
}

export function ModelReviewTool({
  interventions,
  excludeId = null,
  onAsk,
  onInspect,
  onFocus = focusModelTarget,
  onEdit,
  analysisHash = null,
  testId = 'analysis-new-review',
}: ModelReviewToolProps) {
  const showToast = useShowToastSafe()
  const regionId = useId()

  /**
   * ⚠ SUBSCRIBED THROUGH SIGNATURES, as `ModelStrip` is: React Flow replaces
   * `nodes` on every drag, so selecting the array would re-render this row
   * continuously. The node signature covers every field the queue reads.
   */
  const nodeSignature = useCanvasStore((s) =>
    (s.nodes ?? [])
      .map((n) => `${n.id}:${n.type ?? ''}:${stripNodeValueSignature(n)}`)
      .join('|'),
  )
  const edgeSignature = useCanvasStore((s) => (s.edges ?? []).map((e) => e.id).join('|'))
  const queue = useMemo(() => {
    const state = useCanvasStore.getState()
    return buildReviewQueue({
      interventions,
      excludeId,
      nodes: state.nodes ?? [],
      edgeIds: (state.edges ?? []).map((e) => e.id),
    })
    // The signatures ARE the node and edge dependencies; see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventions, excludeId, nodeSignature, edgeSignature])

  const [open, setOpen] = useState(false)
  /**
   * The item on screen, BY KEY. When it leaves the queue — confirmed, answered,
   * dismissed — the item that took its place is shown, not the first one.
   */
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const lastIndex = useRef(0)
  const [moreOpen, setMoreOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [confirmInfoOpen, setConfirmInfoOpen] = useState(false)

  const total = queue.length
  const found = currentKey === null ? -1 : queue.findIndex((item) => item.key === currentKey)
  const index = total === 0 ? -1 : found >= 0 ? found : Math.min(lastIndex.current, total - 1)
  const current = index >= 0 ? queue[index] : undefined
  useEffect(() => {
    if (index >= 0) lastIndex.current = index
  }, [index])
  /** Derived, so confirming the last item cannot strand an empty open tool. */
  const isOpen = open && current !== undefined

  const resetItemState = () => {
    setMoreOpen(false)
    setSourceOpen(false)
    setConfirmInfoOpen(false)
  }
  const goTo = (i: number) => {
    const item = queue[i]
    if (!item) return
    setCurrentKey(item.key)
    lastIndex.current = i
    resetItemState()
  }

  // ── Confirm as my estimate: the write authority's own gesture ─────────────
  /**
   * Keyed to the item on screen, and only when the strip's predicate says there
   * is an estimate to ratify — `factorIsConfirmable`, the same function the
   * authority refuses on, so the control is never offered for a refusal.
   */
  const confirmNodeId = current?.factor?.needsCheck ? current.factor.nodeId : null
  const authority = useModelEditAuthority(confirmNodeId)
  const confirm = () => {
    const outcome = authority.proposeFactorConfirmation()
    showToast(outcome === 'committed' ? COPY.confirmed : COPY.confirmRefused)
  }

  // ── Not relevant: the strengthen lifecycle store, with its undo ───────────
  const scenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  const seedIfAbsent = useStrengthenStore((s) => s.seedIfAbsent)
  const dismiss = useStrengthenStore((s) => s.dismiss)
  const restoreDismissed = useStrengthenStore((s) => s.restoreDismissed)
  const [undoable, setUndoable] = useState<{ id: string; title: string; scenarioId: string | null } | null>(
    null,
  )
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    [],
  )
  const dismissRecommendation = (rec: Recommendation) => {
    // Seed first: `dismiss` silently no-ops on an id it holds no record for,
    // and before a run there is none (the defect `StrengthenTheReasoning` records).
    seedIfAbsent(rec, analysisHash, scenarioId)
    dismiss(recordKey(scenarioId, rec.id))
    setUndoable({ id: rec.id, title: rec.title, scenarioId })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setUndoable(null), NOTICE_MS)
  }

  // ── The overflow menu ─────────────────────────────────────────────────────
  const moreRef = useRef<HTMLSpanElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const closeMenu = (restoreFocus: boolean) => {
    setMoreOpen(false)
    if (restoreFocus) moreRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }
  useEffect(() => {
    if (!moreOpen) return
    const items = () =>
      Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    items()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setMoreOpen(false)
        return
      }
      if (e.key === 'Escape') {
        setMoreOpen(false)
        moreRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      const list = items()
      if (list.length === 0) return
      e.preventDefault()
      const at = list.indexOf(document.activeElement as HTMLButtonElement)
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? list.length - 1
            : e.key === 'ArrowDown'
              ? (at + 1 + list.length) % list.length
              : (at - 1 + list.length) % list.length
      list[next]?.focus()
    }
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !moreRef.current?.contains(t)) setMoreOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [moreOpen])

  const focusTarget = (targetId: string) => {
    if (!onFocus(targetId)) showToast(STRENGTHEN_COPY.focusFailedNotice)
  }

  const provenance = reviewValueProvenance(current?.factor ?? null)
  const valueText = reviewValueText(current?.factor ?? null)
  const valueLead =
    current?.factor && current.factor.label && current.factor.label !== current.name
      ? current.factor.label
      : ANALYSIS_NEW_COPY.modelStrip.valueLabel
  /**
   * Menu items and the entry toggle are written out rather than tiered: every
   * tier is either underlined or a pill, and neither is a menu row. Height comes
   * from `py-1.5`/`py-1` over 12px relaxed type (about 28px), width from `w-full`.
   */
  const menuItemClass = `flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-text-body hover:bg-panel-hover ${ACTION_FOCUS}`

  /*
   * ⛔ AN EMPTY QUEUE DRAWS NOTHING (V2 design pass, 24 Sep 2026). At rest it
   * drew "Nothing to review" beside an AI icon: a row that says nothing is to
   * be done, in the first viewport, is noise.
   *
   * ⭐ WHY DROPPING THE WHOLE-FRAMING ASK HERE STRANDS NOTHING. The same act is
   * reachable on the same tab: `MethodStrip`'s overflow, "Edit decision brief"
   * (`GLOBAL_ACTIONS.edit_brief`), sends `{ ...REVIEW_BRIEF_ASK, source: 'chip' }`
   * — byte-identical to `WHOLE_FRAMING_ASK` — and `AnalysisNewTabBody` mounts
   * that strip unconditionally, above this tool. With a non-empty queue the ask
   * stays on this row, beside the count it belongs with.
   *
   * ⚠ BUT NOT WHILE AN UNDO IS PENDING. Dismissing the LAST item empties the
   * queue; the "Recommendation dismissed · Undo" notice must outlive it, or
   * the undo would vanish with the row that offered it.
   *
   * ⚠ AN EMPTY, `hidden` MARKER, NOT `null`. It draws nothing — `hidden` is
   * `display: none`, and Tailwind 3's `space-y-*` skips `[hidden]` children, so
   * it adds no gap — but it keeps the tool's slot in document order, which the
   * tab's zone-order specs read, and lets a reader tell "mounted, nothing
   * queued" from "failed to render".
   */
  if (total === 0 && undoable === null) {
    return <div data-testid={testId} data-review-empty="true" hidden />
  }

  return (
    <div data-testid={testId} className="border-b border-panel-border py-1">
      {total > 0 ? (
        <div className="flex items-center justify-between gap-1">
          <Tooltip asChild content={COPY.entryTip}>
            <button
              type="button"
              onClick={() => {
                setOpen((v) => !v)
                resetItemState()
              }}
              aria-expanded={isOpen}
              aria-controls={regionId}
              aria-label={COPY.toReviewName(total)}
              className={`inline-flex items-center gap-1 rounded py-1 pr-1 text-text-body hover:text-text-header ${ACTION_FOCUS} ${typography.panelBody}`}
              data-testid={`${testId}-toggle`}
            >
              <Search className={icon('row')} aria-hidden={true} />
              <span data-testid={`${testId}-count`}>{COPY.toReview(total)}</span>
              {isOpen ? (
                <ChevronDown className={icon('row')} aria-hidden={true} />
              ) : (
                <ChevronRight className={icon('row')} aria-hidden={true} />
              )}
            </button>
          </Tooltip>
          <PanelIconButton
            ai
            label={COPY.askFraming}
            onClick={() => onAsk(WHOLE_FRAMING_ASK)}
            testId={`${testId}-ask-framing`}
          />
        </div>
      ) : null}

      {isOpen && current ? (
        <div
          id={regionId}
          className="pt-1"
          data-testid={`${testId}-item`}
          data-review-key={current.key}
          data-target-id={current.targetId ?? undefined}
        >
          <div className="flex items-center justify-between gap-1">
            <span className={`${typography.panelHeader} text-text-header`}>{COPY.heading}</span>
            <span className="flex items-center">
              <PanelIconButton
                Icon={ChevronLeft}
                label={COPY.previous}
                disabled={index <= 0}
                onClick={() => goTo(index - 1)}
                testId={`${testId}-prev`}
              />
              <span
                className={`${typography.panelMeta} tabular-nums text-text-light`}
                data-testid={`${testId}-pager`}
              >
                {COPY.pager(index + 1, total)}
              </span>
              <PanelIconButton
                Icon={ChevronRight}
                label={COPY.next}
                disabled={index >= total - 1}
                onClick={() => goTo(index + 1)}
                testId={`${testId}-next`}
              />
              <PanelIconButton
                Icon={X}
                label={COPY.close}
                onClick={() => {
                  setOpen(false)
                  resetItemState()
                }}
                testId={`${testId}-close`}
              />
            </span>
          </div>

          <p className={`${typography.panelBody} text-text-header`} data-testid={`${testId}-name`}>
            {current.name}
          </p>
          <p className={`${typography.panelMeta} text-text-light`}>
            <span
              data-testid={`${testId}-kind`}
              data-kind={current.kind}
              data-kind-basis={current.kindBasis}
            >
              {REVIEW_KIND_LABEL[current.kind]}
            </span>
            {provenance ? (
              <>
                {' · '}
                <span data-testid={`${testId}-provenance`}>{provenance}</span>
              </>
            ) : null}
          </p>

          {current.factor ? (
            <div className="flex flex-wrap items-center gap-1" data-testid={`${testId}-value`}>
              {valueText !== null ? (
                <span className={`${typography.panelBody} text-text-body`}>
                  <span className="text-text-light">{valueLead}: </span>
                  <span className="tabular-nums" data-testid={`${testId}-value-text`}>
                    {valueText}
                  </span>
                </span>
              ) : null}
              <FactorValueControl
                key={current.factor.nodeId}
                nodeId={current.factor.nodeId}
                label={current.factor.label || undefined}
                testIdPrefix={testId}
              />
            </div>
          ) : null}

          {current.reason ? (
            <div className="flex items-start gap-1">
              <p
                className={`${typography.panelBody} min-w-0 flex-1 text-text-body`}
                data-testid={`${testId}-reason`}
              >
                {current.reason}
              </p>
              {current.sourceLine ? (
                <PanelIconButton
                  Icon={Info}
                  label={current.sourceLine}
                  expanded={sourceOpen}
                  onClick={() => setSourceOpen((v) => !v)}
                  testId={`${testId}-source-info`}
                />
              ) : null}
            </div>
          ) : null}
          {sourceOpen && current.sourceLine ? (
            <p className={`${typography.panelMeta} text-text-light`} data-testid={`${testId}-source`}>
              {current.sourceLine}
            </p>
          ) : null}

          <div className="relative flex flex-wrap items-center gap-1 pt-0.5">
            <span className="flex items-center" data-testid={`${testId}-acts`}>
              {current.targetId && onInspect ? (
                <PanelIconButton
                  Icon={ListTree}
                  label={COPY.inspect}
                  onClick={() => onInspect(current.targetId as string)}
                  testId={`${testId}-inspect`}
                />
              ) : null}
              {current.targetId ? (
                <PanelIconButton
                  Icon={Crosshair}
                  label={COPY.focus}
                  onClick={() => focusTarget(current.targetId as string)}
                  testId={`${testId}-focus`}
                />
              ) : null}
              <PanelIconButton
                ai
                label={COPY.ask}
                onClick={() => onAsk(reviewItemAskPayload(current))}
                testId={`${testId}-ask`}
              />
              <span ref={moreRef} className="inline-flex">
                <PanelIconButton
                  Icon={MoreHorizontal}
                  label={COPY.more}
                  hasPopup="menu"
                  expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                  testId={`${testId}-more`}
                />
              </span>
            </span>

            {current.factor?.needsCheck ? (
              <span className="inline-flex items-center">
                <button
                  type="button"
                  onClick={confirm}
                  className={`${action('inline')} ${typography.panelMeta}`}
                  data-testid={`${testId}-confirm`}
                  data-node-id={current.factor.nodeId}
                >
                  {COPY.confirm}
                </button>
                <PanelIconButton
                  Icon={Info}
                  label={COPY.confirmTip}
                  expanded={confirmInfoOpen}
                  onClick={() => setConfirmInfoOpen((v) => !v)}
                  testId={`${testId}-confirm-info`}
                />
              </span>
            ) : null}

            {moreOpen ? (
              <div
                ref={menuRef}
                role="menu"
                aria-label={COPY.more}
                className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-panel-border bg-panel p-1 shadow-2"
                data-testid={`${testId}-menu`}
              >
                {current.targetId && onEdit && !current.factor ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeMenu(true)
                      onEdit(current.targetId as string)
                    }}
                    className={menuItemClass}
                    data-testid={`${testId}-edit`}
                  >
                    <Pencil className={icon('row')} aria-hidden={true} />
                    <span className={typography.panelBody}>{COPY.edit}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenu(true)
                    onAsk(reviewItemContextPayload(current))
                  }}
                  className={`${menuItemClass} items-start`}
                  data-testid={`${testId}-add-context`}
                >
                  <OlumiAiIcon className={`${icon('row')} mt-0.5 shrink-0 text-info`} aria-hidden={true} />
                  <span className="min-w-0">
                    <span className={`${typography.panelBody} block`}>{COPY.addContext}</span>
                    <span className={`${typography.panelMeta} block text-text-light`}>{COPY.addContextTip}</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenu(true)
                    onAsk(reviewItemDisagreePayload(current))
                  }}
                  className={`${menuItemClass} items-start`}
                  data-testid={`${testId}-disagree`}
                >
                  <OlumiAiIcon className={`${icon('row')} mt-0.5 shrink-0 text-info`} aria-hidden={true} />
                  <span className="min-w-0">
                    <span className={`${typography.panelBody} block`}>{COPY.disagree}</span>
                    <span className={`${typography.panelMeta} block text-text-light`}>{COPY.disagreeTip}</span>
                  </span>
                </button>
                {current.recommendation ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeMenu(true)
                      dismissRecommendation(current.recommendation as Recommendation)
                    }}
                    className={menuItemClass}
                    data-testid={`${testId}-dismiss`}
                  >
                    <X className={icon('row')} aria-hidden={true} />
                    <span className={typography.panelBody}>{STRENGTHEN_COPY.notRelevant}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {confirmInfoOpen && current.factor?.needsCheck ? (
            <p className={`${typography.panelMeta} text-text-light`} data-testid={`${testId}-confirm-note`}>
              {COPY.confirmTip}
            </p>
          ) : null}
        </div>
      ) : null}

      {undoable ? (
        <div
          className={`${typography.panelMeta} flex flex-wrap items-center gap-1 text-text-light`}
          role="status"
          data-testid={`${testId}-dismissed-notice`}
        >
          <span>
            {STRENGTHEN_COPY.dismissedNotice}: {undoable.title}
          </span>
          <button
            type="button"
            onClick={() => {
              restoreDismissed(recordKey(undoable.scenarioId, undoable.id))
              if (noticeTimer.current) clearTimeout(noticeTimer.current)
              setUndoable(null)
            }}
            className={action('inline')}
            data-testid={`${testId}-dismissed-undo`}
          >
            {STRENGTHEN_COPY.undo}
          </button>
        </div>
      ) : null}
    </div>
  )
}
