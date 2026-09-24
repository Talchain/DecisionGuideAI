/**
 * ⭐ THE METHOD STRIP — the Reasoning tab's one home for the thinking moves and
 * the global actions (Reasoning V2).
 *
 * ⛔ WHAT IT REPLACES, AND WHY. On the Reasoning tab every method in
 * `METHOD_CATALOGUE` rendered TWICE: once as the "Methods you can run" chip
 * shelf (`MethodsYouCanRun`, ZONE: FOCUS) and again inside the tab's "Actions"
 * dropdown (`ActionsMenu`, at the foot of the acts). This strip is both: five
 * icon-only methods in a row, then one overflow menu holding the remaining
 * methods and the global actions (`GLOBAL_ACTIONS`). No heading, no paragraph —
 * each method's name and one-line description ride on its tooltip, which is
 * also its accessible name.
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
 * @panel-act-opt-out the overflow's rows are full-width WAI-ARIA menuitems inside a popover, not tiered acts; every icon on the strip itself is a PanelIconButton
 *
 * The menu rows carry `min-h-[24px]` and `w-full` themselves (WCAG 2.2 AA
 * §2.5.8, both dimensions); `everyActIsReachableByTouch` reads this marker.
 */
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { ArrowUpDown, ClipboardList, Frame, GitFork, Globe, MoreHorizontal } from 'lucide-react'

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
import { PanelActRow } from '../PanelActRow'
import { PanelIconButton } from '../PanelIconButton'
import { ACTION_FOCUS } from '../panelSurfaces'

type Glyph = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

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

/** Moved into the overflow on a narrow dock. */
export const METHOD_STRIP_COMPACT_DROPS = 'pre_mortem'

/**
 * Content width (px) under which the strip shows four icons. At the 280px dock
 * floor the content budget is 254px; at the 416px default it is 390px. Six
 * 44px touch targets plus gaps need ~304px, five need ~252px.
 */
export const METHOD_STRIP_COMPACT_BELOW_PX = 300

/** Lucide glyphs matching the prototype's method icons. */
const METHOD_ICON: Record<(typeof METHOD_STRIP_ICON_IDS)[number], Glyph> = {
  different_option: GitFork,
  reframe_problem: Frame,
  consider_opposite: ArrowUpDown,
  outside_view: Globe,
  pre_mortem: ClipboardList,
}

/** Copy owned by this strip. Sentence case, en-GB, no em dashes. */
export const METHOD_STRIP_COPY = {
  group: 'Reasoning methods and actions',
  more: 'More methods and actions',
  menu: 'More methods and actions',
  raised: 'Raised by this run',
} as const

/** Tooltip AND accessible name: the catalogue's title and description. */
export function methodStripLabel(method: MethodEntry, raised: boolean): string {
  const base = `${method.title}. ${method.description}`
  return raised ? `${base} ${METHOD_STRIP_COPY.raised}.` : base
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
  const overflowMethods = METHOD_CATALOGUE.filter((m) => !shownIds.has(m.id))
  const globalActions = GLOBAL_ACTIONS.filter((a) => a.id !== 'rerun_analysis' || canRerun)
  const raisedInOverflow = overflowMethods.filter((m) => raised.has(m.id))

  const [open, setOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { showToast, toastElement } = useSelfToast()

  /* `PanelIconButton` forwards no ref, so the trigger is found inside its own
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
      openAskOlumi({ ...REVIEW_BRIEF_ASK, source: 'chip' })
      return
    }
    openAskOlumi({
      context: action.description,
      draft: action.prompt ?? '',
      label: action.title,
      source: 'chip',
    })
  }

  const itemClass = (current: boolean) =>
    `block w-full min-h-[24px] rounded-md px-2 py-1.5 text-left hover:bg-panel-hover focus-visible:bg-panel-hover ${
      current ? 'bg-panel-hover' : ''
    } ${ACTION_FOCUS}`

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
      <PanelActRow>
        {iconMethods.map(({ id, method }) => (
          <PanelIconButton
            key={id}
            Icon={METHOD_ICON[id]}
            label={methodStripLabel(method, raised.has(id))}
            onClick={() => onSelectMethod(id)}
            pressed={activeMethodId === id}
            marked={raised.has(id)}
            testId={`${testId}-method-${id}`}
          />
        ))}
        <div ref={overflowRef} className="relative ml-auto">
          <PanelIconButton
            Icon={MoreHorizontal}
            label={moreLabel}
            onClick={() => (open ? close(true) : setOpen(true))}
            hasPopup="menu"
            expanded={open}
            marked={raisedInOverflow.length > 0}
            testId={`${testId}-more`}
          />
          {open ? (
            <div
              ref={menuRef}
              role="menu"
              aria-label={METHOD_STRIP_COPY.menu}
              data-testid={`${testId}-menu`}
              className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-panel-border bg-panel p-1.5 shadow-2"
            >
              {overflowMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="menuitem"
                  aria-current={activeMethodId === m.id ? 'true' : undefined}
                  onClick={() => selectFromMenu(m.id)}
                  className={itemClass(activeMethodId === m.id)}
                  data-testid={`${testId}-menu-method-${m.id}`}
                >
                  <span className={`${typography.panelBody} block text-text-header`}>{m.title}</span>
                  <span className={`${typography.panelMeta} block text-text-light`}>{m.description}</span>
                  {raised.has(m.id) ? (
                    <span
                      className={`${typography.panelMeta} block text-info-ink`}
                      data-testid={`${testId}-menu-method-${m.id}-raised`}
                    >
                      {METHOD_STRIP_COPY.raised}
                    </span>
                  ) : null}
                </button>
              ))}
              {overflowMethods.length > 0 && globalActions.length > 0 ? (
                <div role="separator" className="my-1 border-b border-panel-border" data-testid={`${testId}-menu-separator`} />
              ) : null}
              {globalActions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="menuitem"
                  onClick={() => runGlobal(a)}
                  className={itemClass(false)}
                  data-testid={`${testId}-menu-action-${a.id}`}
                >
                  <span className={`${typography.panelBody} block text-text-header`}>{a.title}</span>
                  <span className={`${typography.panelMeta} block text-text-light`}>{a.description}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </PanelActRow>
      {toastElement}
    </div>
  )
}
