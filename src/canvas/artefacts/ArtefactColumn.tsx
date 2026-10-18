/**
 * ⭐ THE THINKING TOOLS BESIDE THE MODEL (Paul, 18 Oct 2026: "simple visual reasoning tools that can be displayed on
 * the canvas, either as an overlay above the graph or next to it"; "a much more beautiful, premium visual experience
 * … it needs to easily switch between them"; 28 Sep study §1 and §3.1).
 *
 * A slim tool rail stays docked to the left edge of the OutputsDock whenever there is a model: each tool with its
 * icon, its short name and how much is waiting in it. Pressing a tool opens its stage between the graph and the rail
 * (pressing it again closes it), so switching is one press and the chat stays beside it. The graph is framed beside
 * the rail and the stage (`computeFitPadding` and `measureDockInset` read this aside with the dock). A tool opens when
 * the artefact the user asked for arrives, from the Reasoning tab's openers, or from the rail. Nothing here writes the
 * model: each tool acts only through the model's own controls.
 *
 * WHY A SIBLING OF THE DOCK AND NOT A SECOND COLUMN INSIDE IT: the dock aside is the `workspace-shell` size container,
 * so widening it would hand every `@container` rule in the panel the wrong width.
 *
 * WHY THE STAGE SLIDES IN: `reservedBoxWatcher` re-fits on `transitionend`, so the entry transition is what re-frames
 * the graph when a tool opens without a press (an artefact arriving). A press already re-fits on its `pointerup`.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Layers, X, type LucideIcon } from 'lucide-react'
import { selectPremortemWorksheet, useCanvasStore } from '../store'
import { PREMORTEM_COPY, type PremortemWorksheetV1 } from '../../v5/readPremortemWorksheet'
import { PreMortemWorksheet } from '../../components/results/analysisNew/sections/PreMortemWorksheet'
import { action, ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { typography } from '../../styles/typography'
import { useIsViewer } from '../../lib/viewerMode'
import { DOCK_EDGE_EVENT } from '../utils/computeFitPadding'
import { askAi } from '../conversation/askAi'
import { revealOlumiSurface } from '../conversation/revealOlumi'
import { ACTION_BAR_COPY } from '../conversation/actionBar/ActionBar'
import { useArtefactStore, type ArtefactId } from './artefactStore'
import { AssumptionMap, useAssumptionMap } from './AssumptionMap'
import { ASSUMPTION_MAP_COPY, type AssumptionColumn, type AssumptionItem } from './assumptionMapModel'
import { figureKey } from './figureMarks'

export const ARTEFACT_COLUMN_TESTID = 'artefact-column'
export const ARTEFACT_RAIL_TESTID = 'artefact-rail'
export const ARTEFACT_RAIL_WIDTH = '72px'
export const ARTEFACT_COLUMN_WIDTH = 'clamp(340px, 28vw, 420px)'
export const ARTEFACT_COPY = {
  open: 'Open beside the model',
  close: 'Close',
  switcher: 'Thinking tools',
  waiting: (n: number) => `${n} to check or set`,
  stories: (n: number) => (n === 1 ? '1 story' : `${n} stories`),
  premortemEmpty: 'Olumi has not imagined this model failing yet.',
  premortemWhat: 'It writes plausible ways each option could fail, each tied to what it rests on in the model, for you to challenge.',
  premortemAsk: 'Ask Olumi to imagine it failed',
} as const

/** Every tool the rail holds, in the rail's order: its title, short name, one-line purpose and icon. */
const TOOLS: Readonly<Record<ArtefactId, { title: string; short: string; purpose: string; Icon: LucideIcon }>> = Object.freeze({
  assumptions: {
    title: ASSUMPTION_MAP_COPY.title,
    short: 'Figures',
    purpose: 'The figures the model rests on, and where each came from.',
    Icon: Layers,
  },
  premortem: {
    title: PREMORTEM_COPY.title,
    short: 'Pre-mortem',
    purpose: 'Olumi’s plausible ways each option could fail, for you to challenge.',
    Icon: AlertTriangle,
  },
})
const TOOL_ORDER: readonly ArtefactId[] = ['assumptions', 'premortem']
const tabId = (id: ArtefactId) => `artefact-rail-tab-${id}`

/** The open scenario's pre-mortem worksheet, or null (none, unavailable, or another scenario's). */
export function useCurrentPremortemWorksheet(): PremortemWorksheetV1 | null {
  const read = useCanvasStore(selectPremortemWorksheet)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  return read?.status === 'available' && read.worksheet.scenario_id === scenarioId ? read.worksheet : null
}

/**
 * Restores this browser's worksheet for the same Run (P02, moved here from the section so it runs whether or not the
 * stage is open) and opens it when a worksheet the user has not seen arrives. A worksheet already held when the canvas
 * mounts, or restored on reload, counts as seen: it never opens the stage by itself.
 */
function useOpenOnNewWorksheet(worksheet: PremortemWorksheetV1 | null): void {
  const hydrate = useCanvasStore((s) => s.hydratePremortemWorksheet)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const graphHash = useCanvasStore((s) => s.lastServerGraphHash)
  const runAt = useCanvasStore((s) =>
    s.analysisStateV1?.run_state.kind === 'complete_current' ? s.analysisStateV1.run_state.computed_at : null)
  const show = useArtefactStore((s) => s.show)
  const enter = useArtefactStore((s) => s.enter)
  const mounted = useRef(false)
  const seen = useRef<string | null>(null)

  // Another scenario never inherits an open tool, a picked figure or a lit one. Keyed to the scenario, not to this
  // component's life: the dock remounting the rail must not close what the user opened. Declared before the opener
  // below, so a worksheet arriving with the new scenario opens after the scenario's state is cleared, not before.
  useEffect(() => enter(scenarioId), [scenarioId, enter])

  // A live turn can change the worksheet and the Run in one commit, and it must open before the restore below would
  // count it as seen.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      seen.current = worksheet?.turn_id ?? null
      return
    }
    if (!worksheet || worksheet.turn_id === seen.current) return
    seen.current = worksheet.turn_id
    show('premortem')
  }, [worksheet, show])

  useEffect(() => {
    if (selectPremortemWorksheet(useCanvasStore.getState())?.status === 'available') return
    hydrate()
    const restored = selectPremortemWorksheet(useCanvasStore.getState())
    if (restored?.status === 'available') seen.current = restored.worksheet.turn_id
  }, [hydrate, scenarioId, graphHash, runAt])
}

/**
 * THE SIGNATURE: a figure that becomes the user's own (set, stated or accepted) while the canvas is open is marked
 * settled, and stays lit in the map until the user has looked at it. Compared by identity against the last reading;
 * the first reading of a scenario is the baseline, so opening a model lights nothing.
 */
function useSettledFigures(items: readonly AssumptionItem[]): void {
  const settle = useArtefactStore((s) => s.settle)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const before = useRef<Map<string, AssumptionColumn> | null>(null)
  useEffect(() => {
    before.current = null
  }, [scenarioId])
  useEffect(() => {
    const now = new Map(items.map((item) => [figureKey(item), item.column]))
    const previous = before.current
    before.current = now
    if (previous === null) return
    const moved = [...now].filter(([key, column]) => column === 'yours' && previous.has(key) && previous.get(key) !== 'yours')
    if (moved.length > 0) settle(moved.map(([key]) => key))
  }, [items, settle])
}

/** Tells the pushed dock-edge measurements (band inset, floating panel clamp) that the rail or the stage moved. */
const announceDockEdge = () => window.dispatchEvent(new Event(DOCK_EDGE_EVENT))

/** The artefacts this model can show content for now: the map once there is a model, the worksheet once written. */
function useAvailableArtefacts(): readonly ArtefactId[] {
  const worksheet = useCurrentPremortemWorksheet()
  const hasModel = useCanvasStore((s) => s.nodes.length > 0)
  return TOOL_ORDER.filter((id) => (id === 'premortem' ? worksheet !== null : hasModel))
}

export interface ArtefactColumnProps {
  /** The dock's own freshness and in-flight authorities, the same values the Reasoning tab receives. */
  isStale: boolean
  isBusy: boolean
  hidden?: boolean
}

export function ArtefactColumn({ isStale, isBusy, hidden = false }: ArtefactColumnProps) {
  const worksheet = useCurrentPremortemWorksheet()
  useOpenOnNewWorksheet(worksheet)
  const map = useAssumptionMap()
  useSettledFigures(map.items)
  const hasModel = useCanvasStore((s) => s.nodes.length > 0)
  const open = useArtefactStore((s) => s.open)
  const toggle = useArtefactStore((s) => s.toggle)
  const close = useArtefactStore((s) => s.close)
  const [entered, setEntered] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)
  const railVisible = hasModel && !hidden
  const stageOpen = railVisible && open !== null

  useEffect(() => {
    // After the DOM change, whichever way it went.
    const announce = requestAnimationFrame(announceDockEdge)
    if (!stageOpen) {
      setEntered(false)
      return () => cancelAnimationFrame(announce)
    }
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => {
      cancelAnimationFrame(announce)
      cancelAnimationFrame(frame)
    }
  }, [stageOpen, railVisible])

  if (!railVisible) return null

  const waiting = map.items.filter((item) => item.column !== 'yours').length
  const badge: Record<ArtefactId, { n: number; label: string } | null> = {
    assumptions: waiting > 0 ? { n: waiting, label: ARTEFACT_COPY.waiting(waiting) } : null,
    premortem: worksheet ? { n: worksheet.rows.length, label: ARTEFACT_COPY.stories(worksheet.rows.length) } : null,
  }
  const focusTab = (id: ArtefactId) => railRef.current?.querySelector<HTMLButtonElement>(`#${tabId(id)}`)?.focus()
  const onRailKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = TOOL_ORDER.findIndex((id) => tabId(id) === (event.target as HTMLElement).id)
    if (at < 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusTab(TOOL_ORDER[(at + (event.key === 'ArrowDown' ? 1 : TOOL_ORDER.length - 1)) % TOOL_ORDER.length])
    }
  }
  const onEscape = (event: KeyboardEvent<HTMLElement>) => {
    // An editor inside the stage (a value being typed) keeps its own Escape.
    const typing = (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]') !== null
    if (event.key !== 'Escape' || open === null || event.defaultPrevented || typing) return
    event.stopPropagation()
    const was = open
    close()
    focusTab(was)
  }

  return (
    <aside
      data-artefact-column=""
      data-testid={`${ARTEFACT_RAIL_TESTID}-host`}
      aria-label={ARTEFACT_COPY.switcher}
      className="pointer-events-none flex"
      onKeyDown={onEscape}
      style={{
        position: 'fixed',
        right: 'var(--dock-right-offset, 0rem)',
        top: 'var(--topbar-h, 0px)',
        bottom: 'var(--bottombar-h)',
        zIndex: 900,
      }}
    >
      {stageOpen && open !== null ? (
        <Stage
          id={open}
          entered={entered}
          isBusy={isBusy}
          isStale={isStale}
          hasWorksheet={worksheet !== null}
          onClose={() => {
            close()
            focusTab(open)
          }}
        />
      ) : null}
      <div
        ref={railRef}
        role="tablist"
        aria-orientation="vertical"
        aria-label={ARTEFACT_COPY.switcher}
        data-testid={ARTEFACT_RAIL_TESTID}
        onKeyDown={onRailKey}
        className="pointer-events-auto flex flex-none flex-col items-center gap-1 pt-3"
        style={{ width: ARTEFACT_RAIL_WIDTH, background: 'var(--bg-panel)', borderLeft: '1px solid var(--panel-edge-rule)' }}
      >
        {TOOL_ORDER.map((id, index) => {
          const { short, title, Icon } = TOOLS[id]
          const active = open === id
          const count = badge[id]
          const roving = open === null ? index === 0 : active
          return (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={active ? `${ARTEFACT_COLUMN_TESTID}-panel` : undefined}
              aria-label={count ? `${title}, ${count.label}` : title}
              title={title}
              tabIndex={roving ? 0 : -1}
              data-testid={`${ARTEFACT_RAIL_TESTID}-${id}`}
              onClick={() => toggle(id)}
              className={`relative flex w-[66px] flex-col items-center gap-1 rounded-xl px-1 pb-1.5 pt-2 text-center transition-colors duration-200 ease-out ${active ? 'bg-[var(--panel-tab-active-bg)] text-text-header' : 'text-text-light hover:bg-panel-hover hover:text-text-body'} ${ACTION_FOCUS}`}
            >
              <Icon aria-hidden="true" className={`h-5 w-5 ${active ? 'text-info' : ''}`} />
              <span className={`${typography.panelMeta} whitespace-nowrap`}>{short}</span>
              {count ? (
                <span
                  aria-hidden="true"
                  data-testid={`${ARTEFACT_RAIL_TESTID}-${id}-count`}
                  className={`${typography.panelMeta} absolute -top-0.5 right-0 min-w-[18px] rounded-full border border-info/30 bg-panel px-1 tabular-nums text-info-ink`}
                >
                  {count.n}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </aside>
  )
}

interface StageProps {
  id: ArtefactId
  entered: boolean
  isBusy: boolean
  isStale: boolean
  hasWorksheet: boolean
  onClose: () => void
}

/** The open tool: its title, purpose and Close, then its body, cross-fading in when the tool changes. */
function Stage({ id, entered, isBusy, isStale, hasWorksheet, onClose }: StageProps) {
  const { title, purpose, Icon } = TOOLS[id]
  const [shown, setShown] = useState<ArtefactId | null>(null)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(id))
    return () => cancelAnimationFrame(frame)
  }, [id])
  const swapped = shown === id
  return (
    <section
      id={`${ARTEFACT_COLUMN_TESTID}-panel`}
      role="tabpanel"
      aria-labelledby={tabId(id)}
      data-testid={ARTEFACT_COLUMN_TESTID}
      data-artefact={id}
      onTransitionEnd={(event) => { if (event.target === event.currentTarget) announceDockEdge() }}
      className="pointer-events-auto my-3 mr-2 flex flex-col overflow-hidden rounded-[20px] border border-panel-border bg-panel shadow-3 transition-[opacity,transform] duration-300 ease-out"
      style={{ width: ARTEFACT_COLUMN_WIDTH, opacity: entered ? 1 : 0, transform: entered ? 'none' : 'translateX(16px)' }}
    >
      <header className="flex items-start gap-3 border-b border-panel-border px-5 pb-4 pt-5">
        <span aria-hidden="true" className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full border border-panel-border">
          <Icon className="h-4 w-4 text-info" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`${typography.panelHeader} text-text-header`}>{title}</h2>
          <p className={`${typography.panelMeta} mt-0.5 text-text-light`}>{purpose}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={ARTEFACT_COPY.close}
          data-testid={`${ARTEFACT_COLUMN_TESTID}-close`}
          className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-text-light transition-colors duration-200 hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>
      <div
        key={id}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 transition-[opacity,transform] duration-200 ease-out"
        style={{ opacity: swapped ? 1 : 0, transform: swapped ? 'none' : 'translateY(4px)' }}
      >
        {id === 'assumptions' ? <AssumptionMap /> : hasWorksheet ? <PreMortemWorksheet isBusy={isBusy} isStale={isStale} /> : <PremortemNotYet />}
      </div>
    </section>
  )
}

/** The pre-mortem before Olumi has written one: what it is, and the one way to ask for it. */
function PremortemNotYet() {
  const viewer = useIsViewer()
  return (
    <div data-testid="premortem-not-yet" className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-info">
        <AlertTriangle className="h-5 w-5 text-info" />
      </span>
      <p className={`${typography.panelQuestion} text-text-header`}>{ARTEFACT_COPY.premortemEmpty}</p>
      <p className={`${typography.panelBody} max-w-[34ch] text-text-body`}>{ARTEFACT_COPY.premortemWhat}</p>
      {!viewer ? (
        <button
          type="button"
          data-testid="premortem-ask"
          className={`${typography.panelBody} ${action('primary')} mt-1 rounded-full px-3`}
          onClick={() => {
            const result = askAi({ intent: 'pre-mortem' })
            if (result === 'sent') revealOlumiSurface()
            if (result === 'none') {
              window.dispatchEvent(new CustomEvent('topbar:show-toast', { detail: { message: ACTION_BAR_COPY.noConversation, level: 'warning' } }))
            }
          }}
        >
          {ARTEFACT_COPY.premortemAsk}
        </button>
      ) : null}
    </div>
  )
}

/** The Reasoning tab's one row: every artefact this model can show now, each opened beside the model. */
export function ArtefactOpeners() {
  const available = useAvailableArtefacts()
  const show = useArtefactStore((s) => s.show)
  if (available.length === 0) return null
  return (
    <ul data-testid="artefact-openers" className="space-y-1 border-b border-panel-border py-2">
      {available.map((id) => {
        const { title, Icon } = TOOLS[id]
        return (
          <li key={id} className="flex items-center gap-2">
            <Icon aria-hidden="true" className="h-4 w-4 flex-none text-text-light" />
            <span className={`${typography.panelBody} min-w-0 flex-1 text-text-body`}>{title}</span>
            <button
              type="button"
              data-testid={`artefact-opener-${id}`}
              className={`${typography.panelBody} ${action('inline')}`}
              onClick={() => show(id)}
            >
              {ARTEFACT_COPY.open}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
