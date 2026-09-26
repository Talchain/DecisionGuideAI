/**
 * ⭐ THE METHOD STRIP — the Reasoning tab's one home for the thinking moves and
 * the global actions (Reasoning V2).
 *
 * ⛔ WHAT IT REPLACES, AND WHY. On the Reasoning tab every method in
 * `METHOD_CATALOGUE` rendered TWICE: once as the "Methods you can run" chip
 * shelf (`MethodsYouCanRun`, ZONE: FOCUS) and again inside the tab's "Actions"
 * dropdown (`ActionsMenu`, at the foot of the acts). This strip is both: five
 * icon-only methods in a row, then one overflow menu holding EVERY method (the
 * V2 prototype's "one complete menu") and the global actions
 * (`GLOBAL_ACTIONS`). No heading, no paragraph — each method's name and
 * one-line description ride on its tooltip, which is also its accessible name.
 *
 * ⚠ `ActionsMenu` IS NOT TOUCHED. The Analysis tab's `DecisionOverviewCard`
 * still mounts it; this strip replaces it on the Reasoning tab only.
 *
 * ⚠ NO NEW METHOD, NO NEW PROMPT. Titles, descriptions and prompts are the
 * catalogue's, read by id. A method press does NOT open the drawer here: it
 * calls `onSelectMethod(id)` and the host decides what selecting a method means
 * (the V2 Challenge card). The global actions call the same functions
 * `ActionsMenu.runGlobal` calls, with the catalogue's own payloads.
 */
/**
 * @panel-act-opt-out the strip's circles are the V2 prototype's 36px method buttons and the overflow's rows are full-width WAI-ARIA menuitems, neither a tiered act
 *
 * The strip buttons carry `min-h-[24px] min-w-[24px]` and the menu rows
 * `min-h-[24px]` plus `w-full` themselves (WCAG 2.2 AA §2.5.8, both
 * dimensions); `everyActIsReachableByTouch` reads this marker.
 *
 * ⭐ V2 PROTOTYPE (design audit B1, 25 Sep 2026). The strip's circles are 36px
 * (35px in a narrow panel), not `PanelIconButton`'s 28px, so they are drawn
 * here with the same Tooltip, focus ring and pressed ring that component uses.
 * The ACTIVE method carries the ring AND the dot (`.iconbtn.active:after`); a
 * method the run raised keeps its dot. The ⋯ is ONE COMPLETE MENU (the
 * prototype's "one toolbar and one complete menu"): a "Reasoning methods"
 * label over every catalogue method, a separator, then "Model and workflow"
 * over the global actions — every row an icon and a name, no subtitle.
 */
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import {
  ArrowDownUp,
  Circle,
  ClipboardList,
  Frame,
  GitFork,
  Globe,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Scale,
} from 'lucide-react'

import { executeCanonicalRun } from '../../../../canvas/analysis/canonicalRunRegistry'
import { usePanelWidth } from '../../../../canvas/components/workspaceShell/usePanelWidth'
import { typography } from '../../../../styles/typography'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import {
  GLOBAL_ACTIONS,
  METHOD_CATALOGUE,
  REVIEW_BRIEF_ASK,
  RERUN_TOASTS,
  type GlobalActionEntry,
  type MethodEntry,
} from '../../decision-overview/actionsCatalogue'
import { useSelfToast } from '../../decision-overview/useSelfToast'
import Tooltip from '../../../Tooltip'
import { openBriefEdit } from '../briefEditStore'
import { ACTION_FOCUS, icon } from '../panelSurfaces'

export type MethodGlyph = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
type Glyph = MethodGlyph

/**
 * The five methods shown as icons, in the prototype's order. Every other
 * catalogue method lands in the overflow — DERIVED as "catalogue minus the
 * visible ids", so a method added to the catalogue can never be unreachable.
 */
export const METHOD_STRIP_ICON_IDS = [
  'different_option',
  'reframe_problem',
  'consider_opposite',
  'outside_view',
  'pre_mortem',
] as const

/**
 * The V2 prototype's menu order (its `methods` table): the strip's five, then
 * the bias check, then trade-offs. DERIVED for everything else — a catalogue
 * method not named here is appended in catalogue order, so a method added to
 * the catalogue can never be missing from the menu. Display order only: it
 * ranks nothing.
 */
export const METHOD_MENU_ORDER: readonly string[] = [...METHOD_STRIP_ICON_IDS, 'review_bias', 'explore_tradeoffs']

export function methodsInMenuOrder(): MethodEntry[] {
  const rank = (id: string) => {
    const i = METHOD_MENU_ORDER.indexOf(id)
    return i === -1 ? METHOD_MENU_ORDER.length : i
  }
  return METHOD_CATALOGUE.map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m.id) - rank(b.m.id) || a.i - b.i)
    .map(({ m }) => m)
}

/** Moved into the overflow on a narrow dock. */
export const METHOD_STRIP_COMPACT_DROPS = 'pre_mortem'

/**
 * Content width (px) under which the strip shows four icons. At the 280px dock
 * floor the content budget is 254px; at the 416px default it is 390px. Six
 * 44px touch targets plus gaps need ~304px, five need ~252px.
 */
export const METHOD_STRIP_COMPACT_BELOW_PX = 300

/**
 * Lucide glyphs matching the V2 prototype's `paths` for every catalogue method
 * (`methods[id].icon`). Keyed by catalogue id; a method missing here falls back
 * to `HelpCircle` rather than rendering an icon-less row.
 * ⚠ `consider_opposite` is `ArrowDownUp` — the prototype's `opposite` path is
 * down-arrow-left / up-arrow-right, which is lucide `arrow-down-up`.
 */
export const METHOD_ICON: Readonly<Record<string, Glyph>> = {
  different_option: GitFork,
  reframe_problem: Frame,
  consider_opposite: ArrowDownUp,
  outside_view: Globe,
  pre_mortem: ClipboardList,
  review_bias: HelpCircle,
  explore_tradeoffs: Scale,
}

export const methodIcon = (methodId: string): Glyph => METHOD_ICON[methodId] ?? HelpCircle

/** The prototype's `menuHTML` icons for the global actions (edit / circle / refresh). */
const ACTION_ICON: Readonly<Record<string, Glyph>> = {
  edit_brief: Pencil,
  review_inputs: Circle,
  rerun_analysis: RefreshCw,
}

/** Copy owned by this strip. Sentence case, en-GB, no em dashes. */
export const METHOD_STRIP_COPY = {
  group: 'Reasoning methods and actions',
  more: 'All methods and actions',
  menu: 'All methods and actions',
  methodsLabel: 'Reasoning methods',
  actionsLabel: 'Model and workflow',
  raised: 'Raised by this run',
} as const

/** Tooltip AND accessible name: the catalogue's title and description. */
export function methodStripLabel(method: MethodEntry, raised: boolean): string {
  const base = `${method.title}. ${method.description}`
  return raised ? `${base} ${METHOD_STRIP_COPY.raised}.` : base
}

/**
 * ⭐ THE V2 PROTOTYPE'S POPOVER (`.popover` / `#popover` / `.menuitem`), shared
 * by this strip's ⋯ and the Challenge card's "Question options" so the two
 * menus cannot drift apart: 252px wide, 7px padding, the emphasis border, a
 * 12px radius; rows are an icon and a name, 12px, 8px padding, 34px tall, the
 * current method in info; the separator runs to the popover's edges.
 */
export const METHOD_MENU_POPOVER_CLASS =
  'absolute right-0 top-full z-20 mt-1.5 w-[252px] max-w-[calc(100vw-20px)] rounded-md border border-border-emphasis bg-panel p-[7px] shadow-2'
export const METHOD_MENU_SEPARATOR_CLASS = '-mx-[7px] my-[5px] border-b border-panel-border'
export const METHOD_MENU_GLYPH_CLASS = `${icon('row')} shrink-0 text-text-light`
export function methodMenuRowClass(current: boolean): string {
  return `flex w-full min-h-[34px] min-w-[24px] items-center gap-[9px] rounded-sm px-2 py-[7px] text-left ${typography.panelBody} hover:bg-panel-hover focus-visible:bg-panel-hover ${
    current ? 'text-info' : 'text-text-body'
  } ${ACTION_FOCUS}`
}

/** Telemetry label for runs started from this strip (`CanonicalRunOptions.source`). */
export const METHOD_STRIP_RUN_SOURCE = 'method-strip'

export interface MethodStripProps {
  /** The method the host currently has selected (e.g. on the Challenge card). */
  activeMethodId: string | null
  /** Called with a catalogue id. The strip never opens the drawer for a method. */
  onSelectMethod: (methodId: string) => void
  /**
   * `methodIdsRaisedBy(vm.strengthen.interventions)`. Absent or empty marks
   * nothing — never a guess.
   */
  raisedMethodIds?: ReadonlySet<string>
  /** The dock's run verdict. The rerun item renders only when this is true. */
  canRerun?: boolean
  testId?: string
}

const byId = (id: string): MethodEntry | undefined => METHOD_CATALOGUE.find((m) => m.id === id)

export function MethodStrip({
  activeMethodId,
  onSelectMethod,
  raisedMethodIds,
  canRerun = false,
  testId = 'analysis-new-method-strip',
}: MethodStripProps): JSX.Element {
  const { contentWidth } = usePanelWidth()
  const compact = contentWidth < METHOD_STRIP_COMPACT_BELOW_PX
  const raised = raisedMethodIds ?? new Set<string>()

  const iconIds = METHOD_STRIP_ICON_IDS.filter((id) => !(compact && id === METHOD_STRIP_COMPACT_DROPS))
  const iconMethods = iconIds
    .map((id) => ({ id, method: byId(id) }))
    .filter((x): x is { id: (typeof METHOD_STRIP_ICON_IDS)[number]; method: MethodEntry } => x.method !== undefined)
  const shownIds = new Set<string>(iconMethods.map((x) => x.id))
  /* ⭐ V2: the menu lists EVERY method, the strip's five included ("one
     toolbar and one complete menu"). The overflow's "raised" mark still asks
     only about the methods the strip does NOT show, because those are the
     ones a reader cannot see marked. */
  const menuMethods = methodsInMenuOrder()
  const globalActions = GLOBAL_ACTIONS.filter((a) => a.id !== 'rerun_analysis' || canRerun)
  const raisedInOverflow = METHOD_CATALOGUE.filter((m) => !shownIds.has(m.id) && raised.has(m.id))

  const [open, setOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { showToast, toastElement } = useSelfToast()

  /* `StripButton` forwards no ref, so the trigger is found inside its own
     wrapper: the only `aria-haspopup="menu"` button there. */
  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) {
      overflowRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')?.focus()
    }
  }, [])

  /* The keyboard model `ActionsMenu` already ships: first item focused on open,
     Arrow/Home/End rove, Escape closes and restores focus, Tab closes without
     trapping, a press outside closes. */
  useEffect(() => {
    if (!open) return
    const items = () =>
      Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
    items()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        close(false)
        return
      }
      if (e.key === 'Escape') {
        close(true)
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
    const onPointerDown = (e: MouseEvent) => {
      if (!overflowRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, close])

  const selectFromMenu = (id: string) => {
    close(true)
    onSelectMethod(id)
  }

  /* The same calls `ActionsMenu.runGlobal` makes, with the catalogue's own
     payloads. Only the telemetry `source` differs, because the surface does. */
  const runGlobal = (action: GlobalActionEntry) => {
    close(true)
    if (action.id === 'rerun_analysis') {
      void executeCanonicalRun({ source: METHOD_STRIP_RUN_SOURCE }).then((outcome) => {
        if (outcome.status === 'blocked' || outcome.status === 'unavailable') showToast(outcome.reason)
        else if (outcome.status === 'already-running') showToast(RERUN_TOASTS.alreadyRunning)
        else showToast(RERUN_TOASTS.started)
      })
      return
    }
    if (action.id === 'edit_brief') {
      // The tab's inline "Your question" form, the same one the review row's
      // pencil opens. Only when nothing is mounted to show it does this keep
      // the shared review-brief ask, so the item is never dead.
      if (!openBriefEdit()) openAskOlumi({ ...REVIEW_BRIEF_ASK, source: 'chip' })
      return
    }
    openAskOlumi({
      context: action.description,
      draft: action.prompt ?? '',
      label: action.title,
      source: 'chip',
    })
  }

  const itemClass = methodMenuRowClass
  const glyphClass = METHOD_MENU_GLYPH_CLASS
  const labelClass = `${typography.panelMeta} block px-2 py-[5px] text-text-light`

  const moreLabel =
    raisedInOverflow.length > 0
      ? `${METHOD_STRIP_COPY.more}. ${METHOD_STRIP_COPY.raised}: ${raisedInOverflow.map((m) => m.title).join(', ')}.`
      : METHOD_STRIP_COPY.more

  return (
    <div
      role="group"
      aria-label={METHOD_STRIP_COPY.group}
      data-testid={testId}
      data-compact={compact ? 'true' : 'false'}
    >
      {/* V2 prototype `.methodstrip`: 6px between circles, 4px in a narrow panel. */}
      <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'} min-h-[38px]`}>
        {iconMethods.map(({ id, method }) => (
          <StripButton
            key={id}
            Icon={methodIcon(id)}
            label={methodStripLabel(method, raised.has(id))}
            onClick={() => onSelectMethod(id)}
            pressed={activeMethodId === id}
            marked={activeMethodId === id || raised.has(id)}
            compact={compact}
            testId={`${testId}-method-${id}`}
          />
        ))}
        <div ref={overflowRef} className="relative ml-auto">
          <StripButton
            Icon={MoreHorizontal}
            label={moreLabel}
            onClick={() => (open ? close(true) : setOpen(true))}
            hasPopup="menu"
            expanded={open}
            marked={raisedInOverflow.length > 0}
            compact={compact}
            testId={`${testId}-more`}
          />
          {open ? (
            <div
              ref={menuRef}
              role="menu"
              aria-label={METHOD_STRIP_COPY.menu}
              data-testid={`${testId}-menu`}
              className={METHOD_MENU_POPOVER_CLASS}
            >
              <span className={labelClass} data-testid={`${testId}-menu-label-methods`}>
                {METHOD_STRIP_COPY.methodsLabel}
              </span>
              {menuMethods.map((m) => {
                const Glyph = methodIcon(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="menuitem"
                    aria-current={activeMethodId === m.id ? 'true' : undefined}
                    onClick={() => selectFromMenu(m.id)}
                    className={itemClass(activeMethodId === m.id)}
                    data-testid={`${testId}-menu-method-${m.id}`}
                  >
                    <span className="relative inline-flex shrink-0">
                      <Glyph className={glyphClass} aria-hidden={true} />
                      {raised.has(m.id) ? (
                        <span
                          className="absolute -right-0.5 -top-0.5 size-[5px] rounded-full bg-info"
                          aria-hidden={true}
                          data-testid={`${testId}-menu-method-${m.id}-dot`}
                        />
                      ) : null}
                    </span>
                    {m.title}
                    {raised.has(m.id) ? (
                      <span className="sr-only" data-testid={`${testId}-menu-method-${m.id}-raised`}>
                        {`. ${METHOD_STRIP_COPY.raised}`}
                      </span>
                    ) : null}
                  </button>
                )
              })}
              {globalActions.length > 0 ? (
                <>
                  <div
                    role="separator"
                    className={METHOD_MENU_SEPARATOR_CLASS}
                    data-testid={`${testId}-menu-separator`}
                  />
                  <span className={labelClass} data-testid={`${testId}-menu-label-actions`}>
                    {METHOD_STRIP_COPY.actionsLabel}
                  </span>
                </>
              ) : null}
              {globalActions.map((a) => {
                const Glyph = ACTION_ICON[a.id] ?? Circle
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="menuitem"
                    onClick={() => runGlobal(a)}
                    className={itemClass(false)}
                    data-testid={`${testId}-menu-action-${a.id}`}
                  >
                    <Glyph className={glyphClass} aria-hidden={true} />
                    {a.title}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
      {toastElement}
    </div>
  )
}

interface StripButtonProps {
  Icon: Glyph
  /** The tooltip AND the accessible name. */
  label: string
  onClick: () => void
  pressed?: boolean
  expanded?: boolean
  hasPopup?: 'menu'
  /** The prototype's dot: the active method, or a method this run raised. */
  marked?: boolean
  compact: boolean
  testId: string
}

/**
 * One V2 method circle (`.methodstrip .iconbtn`): 36px (35px narrow, 40px on a
 * coarse pointer), no border at rest, a quiet fill and ring on hover, an info
 * ring and colour when pressed, and a 5px info dot top-right with a 2px panel
 * halo when marked.
 */
function StripButton({ Icon, label, onClick, pressed, expanded, hasPopup, marked = false, compact, testId }: StripButtonProps) {
  return (
    <Tooltip asChild content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        aria-haspopup={hasPopup}
        onClick={onClick}
        data-testid={testId}
        className={`relative inline-flex shrink-0 items-center justify-center min-w-[24px] min-h-[24px] rounded-full ${
          compact ? 'size-[35px]' : 'size-9'
        } [@media(pointer:coarse)]:size-10 ${
          pressed
            ? 'text-info ring-1 ring-inset ring-info'
            : 'text-text-light hover:bg-panel-hover hover:ring-1 hover:ring-inset hover:ring-panel-border'
        } ${ACTION_FOCUS}`}
      >
        <Icon className={icon('section')} aria-hidden={true} />
        {marked ? (
          <span
            className="absolute right-px top-0.5 size-[5px] rounded-full bg-info ring-2 ring-panel"
            aria-hidden={true}
            data-testid={`${testId}-mark`}
          />
        ) : null}
      </button>
    </Tooltip>
  )
}
