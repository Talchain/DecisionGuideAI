/**
 * ONE REVIEW AFFORDANCE FOR THE WHOLE MODEL — framing, assumptions,
 * relationships, values, alternatives and evidence, one item at a time.
 *
 * Collapsed, it is one row: "N to review", an ask to check the whole framing,
 * and "Edit the full question" (`BriefEditForm`). Open, it pages through
 * `buildReviewQueue`'s items with the acts a reader needs on each: edit the
 * belief, add evidence or context, inspect it in the Model, focus it on the
 * canvas, ask Olumi about it, change its value, confirm an estimate as their own.
 *
 * ⚠⚠ REVIEWED IS NOT VERIFIED IS NOT ESTABLISHED. Confirming an estimate makes
 * it the reader's estimate; it verifies nothing behind it, and the control says
 * so. There is no "Mark reviewed": nothing would persist it, and a tick that
 * forgets itself on reload is a claim the product does not keep.
 *
 * ⭐ LAID OUT AS THE V2 PROTOTYPE'S `review-shell` (`reviewHTML()`, design audit
 * B6): a divider; "Review the thinking" as a quiet 12px label with ‹ n/N › ×;
 * a numbered item select; a kind icon and "kind · source"; the belief bullet;
 * the why line with its ⓘ; ✎ ⌖ ✦ ⋯; "Add evidence or context". Only fields
 * the queue already holds are rendered — a finding carries no belief field,
 * so it gets no bullet (PRODUCER GAP), and "Mark reviewed" stays absent.
 *
 * ⚠ THE ⋯ MENU STAYS, THOUGH THE PROTOTYPE HAS NONE. Its three acts — Focus on
 * canvas, I disagree, Not relevant (a persisted lifecycle write, with undo) —
 * are replaced in the prototype by "Mark reviewed", which cannot be built
 * (above). Removing ⋯ now would delete the only dismissal route and put
 * nothing in its place (PRODUCT DECISION, reported).
 *
 * ⚠ "Edit this belief" AND "Add evidence or context" CAPTURE, THEN ASK. They
 * open one inline form (`ReviewItemEditor`) whose submit goes to Olumi through
 * `onAsk`. There is no model-level evidence store and no writer for a
 * finding's wording, so nothing typed there is stored, and the form says so.
 *
 * ⚠ THIS FILE OPENS NO ROUTE OF ITS OWN. The ask and the Model-tab inspection
 * are the caller's handlers (`onAsk`, `onInspect`); the
 * canvas focus defaults to `focusModelTarget`; the value write is
 * `FactorValueControl`'s; the confirmation is the write authority's
 * `proposeFactorConfirmation`; "Not relevant" is the strengthen lifecycle
 * store's `dismiss`, the same one the Strengthen cards write.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Crosshair,
  Frame,
  Info,
  Link,
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
import { stripNodeValueSignature } from '../buildModelStrip'
import {
  buildReviewQueue,
  REVIEW_KIND_LABEL,
  REVIEW_TOOL_COPY as COPY,
  reviewItemAskPayload,
  reviewItemDisagreePayload,
  reviewValueProvenance,
  reviewValueText,
  WHOLE_FRAMING_ASK,
} from '../buildReviewQueue'
import { useBriefEditStore } from '../briefEditStore'
import { FactorValueControl } from '../FactorValueControl'
import { OlumiAiIcon } from '../OlumiAiIcon'
import { PanelIconButton } from '../PanelIconButton'
import { ACTION_FOCUS, action, icon } from '../panelSurfaces'
import { BRIEF_EDIT_COPY, BriefEditForm } from './BriefEditForm'
import { ReviewItemEditor, type ReviewEditorField } from './ReviewItemEditor'

/**
 * A census mark's route into this tool (prototype `gotoReview` / `entity`,
 * P:614): open AT the item about a node, or close. `seq` makes a repeated
 * request for the same node a new one. See `ModelStrip`'s `reviewSlot`.
 */
export type ReviewToolRequest =
  | { kind: 'open'; targetId: string; seq: number }
  | { kind: 'close'; seq: number }
  /**
   * Prototype `data-action="reviews"` from About › Sources and limits
   * ("Inspect beliefs and source notes"): open where the reader left off (or
   * at the first item) and bring the tool into view. It resets nothing, so an
   * edit already in progress survives.
   */
  | { kind: 'reveal'; seq: number }

/**
 * ⭐ THE PROTOTYPE'S WORDS FOR TWO CONTROLS, LOCAL TO THIS FILE — the review
 * tool's shared copy (`REVIEW_TOOL_COPY`) is also read by the Challenge card,
 * and neither name belongs there.
 */
const CHOOSE_ITEM_LABEL = 'Choose a review item'
/** Prototype `focus-review`: it goes to the Model view, and says so. */
const INSPECT_IN_MODEL_VIEW_LABEL = 'Inspect this item in the Model view'
/** Prototype `btn('x','reviews','Close review tool')`, verbatim. */
const CLOSE_REVIEW_TOOL_LABEL = 'Close review tool'

/**
 * The prototype's kind icon (`reviewHTML()`: `relationship` → link,
 * `framing` → frame, anything else → circle), keyed on the kind the queue
 * READ — never a guess made here.
 */
const KIND_ICON = {
  frame: Frame,
  link: Link,
  circle: Circle,
} as const
const kindIconFor = (kind: string): keyof typeof KIND_ICON =>
  kind === 'relationship' ? 'link' : kind === 'framing' ? 'frame' : 'circle'

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
  /** The run the findings came from, stamped on a dismissal record. */
  analysisHash?: string | null
  /**
   * Rendered between the "N to review" row and the open item — the V2
   * prototype's order puts the success line there (design audit B5).
   */
  successSlot?: ReactNode
  /** Open at a node's item, or close — a census mark's route. */
  request?: ReviewToolRequest | null
  /** Told which node ids the queue holds an item about, whenever that changes. */
  onQueueTargets?: (ids: readonly string[]) => void
  testId?: string
}

export function ModelReviewTool({
  interventions,
  excludeId = null,
  onAsk,
  onInspect,
  onFocus = focusModelTarget,
  analysisHash = null,
  successSlot = null,
  request = null,
  onQueueTargets,
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

  // ── "Edit the full question": ONE form, opened from here or the Method strip ──
  // This row hosts it; while mounted it registers, so the strip's "Edit decision
  // brief" opens this form rather than falling back to its generic ask.
  const briefOpen = useBriefEditStore((s) => s.isOpen)
  const briefOpenRequest = useBriefEditStore((s) => s.openRequest)
  const setBriefOpen = useBriefEditStore((s) => s.setOpen)
  const registerBriefHost = useBriefEditStore((s) => s.registerHost)
  useEffect(() => registerBriefHost(), [registerBriefHost])
  const briefPencilRef = useRef<HTMLSpanElement | null>(null)
  /** Closing hands focus back to the pencil, so a keyboard reader is not dropped. */
  const closeBrief = () => {
    setBriefOpen(false)
    briefPencilRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }

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
  /** The inline item editor, keyed to the item it was opened on. */
  const [editor, setEditor] = useState<{ key: string; field: ReviewEditorField } | null>(null)

  const total = queue.length
  const found = currentKey === null ? -1 : queue.findIndex((item) => item.key === currentKey)
  const index = total === 0 ? -1 : found >= 0 ? found : Math.min(lastIndex.current, total - 1)
  const current = index >= 0 ? queue[index] : undefined
  useEffect(() => {
    if (index >= 0) lastIndex.current = index
  }, [index])
  /** Derived, so confirming the last item cannot strand an empty open tool. */
  const isOpen = open && current !== undefined
  const editorOpen = editor !== null && current !== undefined && editor.key === current.key

  // ── The item editor: open, toggle, and hand focus back on Cancel/Escape ──
  const itemRef = useRef<HTMLDivElement | null>(null)
  const returnFocusTo = useRef<string | null>(null)
  const openEditor = (field: ReviewEditorField) => {
    if (!current) return
    setMoreOpen(false)
    setEditor((e) => (e && e.key === current.key && e.field === field ? null : { key: current.key, field }))
  }
  const closeEditor = (restoreFocus: boolean) => {
    if (restoreFocus && editor) {
      returnFocusTo.current = editor.field === 'belief' ? `${testId}-edit` : `${testId}-add-context`
    }
    setEditor(null)
  }
  useEffect(() => {
    if (editorOpen || returnFocusTo.current === null) return
    const id = returnFocusTo.current
    returnFocusTo.current = null
    itemRef.current?.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)?.focus()
  }, [editorOpen])

  const resetItemState = () => {
    setMoreOpen(false)
    setSourceOpen(false)
    setConfirmInfoOpen(false)
    setEditor(null)
  }
  const goTo = (i: number) => {
    const item = queue[i]
    if (!item) return
    setCurrentKey(item.key)
    lastIndex.current = i
    resetItemState()
  }

  // ── A census mark's route in (prototype `gotoReview`, design audit B12) ──
  /**
   * The node ids this queue holds an item about, in queue order and once
   * each. The strip routes a mark HERE only for these; every other mark opens
   * its own detail.
   */
  const queueTargets = useMemo(
    () => Array.from(new Set(queue.map((item) => item.targetId).filter((id): id is string => !!id))),
    [queue],
  )
  useEffect(() => {
    onQueueTargets?.(queueTargets)
  }, [queueTargets, onQueueTargets])

  /**
   * ⚠ HANDLED ONCE PER `seq`. The queue re-derives on every canvas signature
   * change; without the guard an old request would re-open the tool at its
   * item after the reader had closed it.
   */
  const handledSeq = useRef<number | null>(null)
  const scrollOnOpen = useRef(false)
  /**
   * A `reveal` comes from About, far below the tool, so keyboard focus moves
   * to the item picker with it; otherwise the next Tab resumes in About. A
   * mark sits just above the tool and keeps its focus.
   */
  const focusOnReveal = useRef(false)
  const selectRef = useRef<HTMLSelectElement | null>(null)
  /** Bumped by a `reveal`, so an ALREADY-open tool still scrolls into view. */
  const [revealTick, setRevealTick] = useState(0)
  useEffect(() => {
    if (request === null || handledSeq.current === request.seq) return
    handledSeq.current = request.seq
    if (request.kind === 'close') {
      setOpen(false)
      resetItemState()
      return
    }
    if (request.kind === 'reveal') {
      if (queue.length === 0) return
      setOpen(true)
      scrollOnOpen.current = true
      focusOnReveal.current = true
      setRevealTick((t) => t + 1)
      return
    }
    const at = queue.findIndex((item) => item.targetId === request.targetId)
    if (at < 0) return
    setCurrentKey(queue[at].key)
    lastIndex.current = at
    setOpen(true)
    resetItemState()
    scrollOnOpen.current = true
  }, [request, queue])
  /** The prototype scrolls the tool into view when a mark opens it (`go('review-tool')`). */
  useEffect(() => {
    if (!isOpen || !scrollOnOpen.current) return
    scrollOnOpen.current = false
    itemRef.current?.scrollIntoView?.({ block: 'nearest' })
    if (!focusOnReveal.current) return
    focusOnReveal.current = false
    selectRef.current?.focus({ preventScroll: true })
  }, [isOpen, current?.key, revealTick])

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
  // Close hands focus back to the entry toggle that opened the tool. Without
  // it the focused X unmounts and keyboard focus falls to <body> (Panel
  // whole-tab witness, served 046f67ab, 26 Sep 2026: D3).
  const toggleRef = useRef<HTMLButtonElement | null>(null)
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
  /**
   * Whose value the bullet states, ONLY when the item is named for something
   * else (a finding about a factor). An item named for the factor itself needs
   * no lead-in — the prototype's cost item reads "£80,000 per year" alone.
   */
  const valueLead =
    current?.factor && current.factor.label && current.factor.label !== current.name
      ? current.factor.label
      : null
  /**
   * Menu items and the entry toggle are written out rather than tiered: every
   * tier is either underlined or a pill, and neither is a menu row. Height comes
   * from `py-1.5`/`py-1` over 12px relaxed type (about 28px), width from `w-full`.
   */
  const menuItemClass = `flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-text-body hover:bg-panel-hover ${ACTION_FOCUS}`

  return (
    /* ⭐ NO RULE OF ITS OWN (design-audit-20260925, gaps SPACE-2 / FIRST-2 /
       NARROW-8). This row used to draw an inset `border-b`, 12px above the
       full-bleed section rule that already separates the model block from
       "Challenge the thinking" — two hairlines that close read as a
       rendering mistake. `!mt-1` overrides whatever `space-y-*` rhythm the
       parent applies (the same override PANEL_RULE's `!mt-[11px]` uses, for
       the same reason: `space-y`'s selector out-specifies a plain `mt-*`). */
    <div data-testid={testId} className="!mt-1 pt-1">
      <div className="flex items-center justify-between gap-1">
        {total > 0 ? (
          <Tooltip asChild content={COPY.entryTip}>
            <button
              ref={toggleRef}
              type="button"
              onClick={() => {
                setOpen((v) => !v)
                resetItemState()
              }}
              aria-expanded={isOpen}
              aria-controls={regionId}
              aria-label={COPY.toReviewName(total)}
              /* ⭐⭐ H3: ONE WORKLIST COUNT, IN INFO BLUE — the prototype's own
                 "🔍 5 to review" (`Olumi_Reasoning_Prototype_V2.html`). This is
                 the ONLY review-count affordance the first screen offers; the
                 strip's separate amber "N to verify"/"N with no value" chips
                 render only inside its own disclosure (`{open ? ... : null}`
                 above them in `ModelStrip.tsx`), never on the closed first
                 screen, so nothing here duplicates them or adds new amber. */
              className={`inline-flex items-center gap-1 rounded py-1 pr-1 text-info hover:text-info-hover ${ACTION_FOCUS} ${typography.panelBody}`}
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
        ) : (
          <span
            className={`${typography.panelMeta} text-text-light`}
            data-testid={`${testId}-empty`}
          >
            {COPY.nothingToReview}
          </span>
        )}
        <span className="flex items-center">
          <PanelIconButton
            ai
            label={COPY.askFraming}
            onClick={() => onAsk(WHOLE_FRAMING_ASK)}
            testId={`${testId}-ask-framing`}
          />
          <span ref={briefPencilRef} className="inline-flex">
            <PanelIconButton
              Icon={Pencil}
              label={BRIEF_EDIT_COPY.open}
              expanded={briefOpen}
              onClick={() => setBriefOpen(!briefOpen)}
              testId={`${testId}-edit-brief`}
            />
          </span>
        </span>
      </div>

      {briefOpen ? (
        <BriefEditForm
          onAsk={onAsk}
          onClose={closeBrief}
          focusRequest={briefOpenRequest}
          testIdPrefix={testId}
        />
      ) : null}

      {/* V2 prototype order: "N to review", then the success line, then the
          open review shell (design audit B5). */}
      {successSlot}

      {isOpen && current ? (
        <div
          id={regionId}
          ref={itemRef}
          /* The prototype's `.review-shell`: a hairline across the column,
             10px above the header and 3px below the last act. */
          className="relative mt-2 border-t border-panel-border pt-[9px] pb-[3px]"
          data-testid={`${testId}-item`}
          data-review-key={current.key}
          data-target-id={current.targetId ?? undefined}
        >
          <div className="flex items-center justify-between gap-[7px]">
            {/* `.review-nav .header-text`: 12px, regular, light — a label for
                the shell, not a section title. */}
            <span className={`${typography.panelBody} text-text-light`} data-testid={`${testId}-heading`}>
              {COPY.heading}
            </span>
            <span className="flex items-center gap-1">
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
                label={CLOSE_REVIEW_TOOL_LABEL}
                onClick={() => {
                  setOpen(false)
                  resetItemState()
                  toggleRef.current?.focus()
                }}
                testId={`${testId}-close`}
              />
            </span>
          </div>

          {/* ⭐ THE ITEM SELECT — the prototype's `review-filter`: every item,
              numbered, the one on screen selected. It carries the item's NAME,
              so no separate name line is drawn (the selected option keeps the
              `-name` testid). "· reviewed" marks need "Mark reviewed", which
              nothing persists — see the header. */}
          <select
            ref={selectRef}
            aria-label={CHOOSE_ITEM_LABEL}
            value={index}
            onChange={(e) => goTo(Number(e.target.value))}
            className={`${typography.panelBody} my-[5px] w-full min-h-[31px] rounded-md border border-field bg-panel p-[5px] text-text-body ${ACTION_FOCUS}`}
            data-testid={`${testId}-select`}
          >
            {queue.map((item, i) => (
              <option
                key={item.key}
                value={i}
                data-testid={i === index ? `${testId}-name` : undefined}
              >
                {`${i + 1}. ${item.name}`}
              </option>
            ))}
          </select>
          {/* The prototype's `review-context`: kind icon, "kind · source". */}
          <p
            className={`${typography.panelMeta} my-1 flex items-center gap-1.5 text-text-light`}
            data-testid={`${testId}-context`}
          >
            {(() => {
              const which = kindIconFor(current.kind)
              const KindIcon = KIND_ICON[which]
              return (
                <KindIcon
                  className={`${icon('inline')} shrink-0`}
                  aria-hidden={true}
                  data-testid={`${testId}-kind-icon`}
                  data-kind-icon={which}
                />
              )
            })()}
            <span
              data-testid={`${testId}-kind`}
              data-kind={current.kind}
              data-kind-basis={current.kindBasis}
            >
              {REVIEW_KIND_LABEL[current.kind]}
            </span>
            {provenance ? (
              <>
                <span aria-hidden={true}>·</span>
                <span data-testid={`${testId}-provenance`}>{provenance}</span>
              </>
            ) : null}
          </p>

          {/* ⭐ THE BELIEF BULLET (`review-belief`), ONLY FROM A FIELD THE ITEM
              CARRIES: an item about a factor states that factor's value, which
              is what the prototype's own cost item shows. A finding carries no
              belief field, so it gets no bullet (PRODUCER GAP). The value
              editor stays beside it — the standing rule. */}
          {current.factor ? (
            <div className="my-[5px] flex flex-col items-start gap-1" data-testid={`${testId}-value`}>
              {valueText !== null ? (
                <ul className={`${typography.panelBody} m-0 list-disc pl-[15px] text-text-body`}>
                  <li data-testid={`${testId}-belief`}>
                    {valueLead !== null ? <span className="text-text-light">{valueLead}: </span> : null}
                    <span className="tabular-nums" data-testid={`${testId}-value-text`}>
                      {valueText}
                    </span>
                  </li>
                </ul>
              ) : null}
              <FactorValueControl
                key={current.factor.nodeId}
                nodeId={current.factor.nodeId}
                label={current.factor.label || undefined}
                testIdPrefix={testId}
              />
            </div>
          ) : null}

          {/* The prototype's `review-mini`: the why line, 11px light, with its ⓘ. */}
          {current.reason ? (
            <div className="flex items-center justify-between gap-1.5">
              <p
                className={`${typography.panelMeta} m-0 min-w-0 flex-1 text-text-light`}
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

          <div className="relative mt-[5px] flex flex-wrap items-center gap-1.5">
            <span className="flex items-center" data-testid={`${testId}-acts`}>
              {current.recommendation ? (
                <PanelIconButton
                  Icon={Pencil}
                  label={COPY.editBelief}
                  expanded={editorOpen && editor?.field === 'belief'}
                  onClick={() => openEditor('belief')}
                  testId={`${testId}-edit`}
                />
              ) : null}
              {current.targetId && onInspect ? (
                <PanelIconButton
                  Icon={Crosshair}
                  label={INSPECT_IN_MODEL_VIEW_LABEL}
                  onClick={() => onInspect(current.targetId as string)}
                  testId={`${testId}-inspect`}
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
              /* Where the prototype puts "Mark reviewed": the right end. */
              <span className="ml-auto inline-flex items-center">
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
                {current.targetId ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeMenu(true)
                      focusTarget(current.targetId as string)
                    }}
                    className={menuItemClass}
                    data-testid={`${testId}-focus`}
                  >
                    <Crosshair className={icon('row')} aria-hidden={true} />
                    <span className={typography.panelBody}>{COPY.focus}</span>
                  </button>
                ) : null}
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

          {/* The prototype's at-rest "Add evidence or context"; the editor takes
              its place while open. */}
          {editorOpen && editor ? (
            <ReviewItemEditor
              key={current.key}
              item={current}
              focusField={editor.field}
              onAsk={onAsk}
              onClose={closeEditor}
              testIdPrefix={testId}
            />
          ) : (
            /* The prototype's `.textbutton`: 12px info, no underline, padded
               4px top and bottom — the padding is its rest-state shape. */
            <button
              type="button"
              onClick={() => openEditor('evidence')}
              className={`${typography.panelBody} mt-[7px] inline-flex items-center gap-[5px] py-1 min-h-[28px] text-info hover:text-info-hover ${ACTION_FOCUS}`}
              data-testid={`${testId}-add-context`}
            >
              <Link className={icon('row')} aria-hidden={true} />
              {COPY.addContext}
            </button>
          )}
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
