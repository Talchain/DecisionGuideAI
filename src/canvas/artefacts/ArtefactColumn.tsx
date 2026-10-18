/**
 * ⭐ THE REASONING ARTEFACT BESIDE THE MODEL (Paul, 18 Oct 2026: "simple visual reasoning tools that can be displayed on
 * the canvas, either as an overlay above the graph or next to it"; 28 Sep study §1 and §3.1).
 *
 * One artefact at a time, in a column docked to the left edge of the OutputsDock, so the chat stays beside it and the
 * graph is framed beside both (`computeFitPadding` and `measureDockInset` read the column with the dock). It opens when
 * the artefact the user asked for arrives, or from the artefact's one-line opener in the Reasoning tab, and closes on
 * the user's press. Nothing here writes the model: each artefact keeps its own existing actions.
 *
 * WHY A SIBLING OF THE DOCK AND NOT A SECOND COLUMN INSIDE IT: the dock aside is the `workspace-shell` size container,
 * so widening it would hand every `@container` rule in the panel the wrong width.
 *
 * WHY IT SLIDES IN: `reservedBoxWatcher` re-fits on `transitionend`, so the entry transition is what re-frames the graph
 * when the column opens without a press (an artefact arriving). A press already re-fits on its `pointerup`.
 */
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { selectPremortemWorksheet, useCanvasStore } from '../store'
import { PREMORTEM_COPY, type PremortemWorksheetV1 } from '../../v5/readPremortemWorksheet'
import { PreMortemWorksheet } from '../../components/results/analysisNew/sections/PreMortemWorksheet'
import { action, ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { typography } from '../../styles/typography'
import { DOCK_EDGE_EVENT } from '../utils/computeFitPadding'
import { useArtefactStore } from './artefactStore'

export const ARTEFACT_COLUMN_TESTID = 'artefact-column'
export const ARTEFACT_COLUMN_WIDTH = 'min(360px, 30vw)'
export const ARTEFACT_COPY = {
  open: 'Open beside the model',
  close: 'Close',
} as const

/** The open scenario's pre-mortem worksheet, or null (none, unavailable, or another scenario's). */
export function useCurrentPremortemWorksheet(): PremortemWorksheetV1 | null {
  const read = useCanvasStore(selectPremortemWorksheet)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  return read?.status === 'available' && read.worksheet.scenario_id === scenarioId ? read.worksheet : null
}

/**
 * Restores this browser's worksheet for the same Run (P02, moved here from the section so it runs whether or not the
 * column is open) and opens the column when a worksheet the user has not seen arrives. A worksheet already held when
 * the canvas mounts, or restored on reload, counts as seen: it never opens the column by itself.
 */
function useOpenOnNewWorksheet(worksheet: PremortemWorksheetV1 | null): void {
  const hydrate = useCanvasStore((s) => s.hydratePremortemWorksheet)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const graphHash = useCanvasStore((s) => s.lastServerGraphHash)
  const runAt = useCanvasStore((s) =>
    s.analysisStateV1?.run_state.kind === 'complete_current' ? s.analysisStateV1.run_state.computed_at : null)
  const show = useArtefactStore((s) => s.show)
  const close = useArtefactStore((s) => s.close)
  const mounted = useRef(false)
  const seen = useRef<string | null>(null)

  // Declared first: a live turn can change the worksheet and the Run in one commit, and it must open before the
  // restore below would count it as seen.
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

  // Another scenario never inherits an open artefact.
  useEffect(() => close, [scenarioId, close])
}

/** Tells the pushed dock-edge measurements (band inset, floating panel clamp) that the column moved. */
const announceDockEdge = () => window.dispatchEvent(new Event(DOCK_EDGE_EVENT))

export interface ArtefactColumnProps {
  /** The dock's own freshness and in-flight authorities, the same values the Reasoning tab receives. */
  isStale: boolean
  isBusy: boolean
  hidden?: boolean
}

export function ArtefactColumn({ isStale, isBusy, hidden = false }: ArtefactColumnProps) {
  const worksheet = useCurrentPremortemWorksheet()
  useOpenOnNewWorksheet(worksheet)
  const open = useArtefactStore((s) => s.open)
  const close = useArtefactStore((s) => s.close)
  const [entered, setEntered] = useState(false)
  const visible = open === 'premortem' && worksheet !== null && !hidden

  useEffect(() => {
    // After the DOM change, whichever way it went.
    const announce = requestAnimationFrame(announceDockEdge)
    if (!visible) {
      setEntered(false)
      return () => cancelAnimationFrame(announce)
    }
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => {
      cancelAnimationFrame(announce)
      cancelAnimationFrame(frame)
    }
  }, [visible])

  if (!visible || worksheet === null) return null
  return (
    <aside
      data-artefact-column=""
      data-testid={ARTEFACT_COLUMN_TESTID}
      data-artefact="premortem"
      aria-label={PREMORTEM_COPY.title}
      className="flex flex-col pointer-events-auto transition-[opacity,transform] duration-150 ease-out"
      onTransitionEnd={(event) => { if (event.target === event.currentTarget) announceDockEdge() }}
      style={{
        position: 'fixed',
        right: 'var(--dock-right-offset, 0rem)',
        top: 'var(--topbar-h, 0px)',
        bottom: 'var(--bottombar-h)',
        width: ARTEFACT_COLUMN_WIDTH,
        background: 'rgb(var(--bg-panel-rgb) / 0.95)',
        backdropFilter: 'blur(8px)',
        borderLeft: '1px solid var(--panel-edge-rule)',
        zIndex: 900,
        opacity: entered ? 1 : 0,
        transform: entered ? 'none' : 'translateX(12px)',
      }}
    >
      <header className="flex items-center gap-2 border-b border-panel-border px-4 py-3">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 flex-none text-text-light" />
        <h2 className={`${typography.panelHeader} min-w-0 flex-1 text-text-body`}>{PREMORTEM_COPY.title}</h2>
        <button
          type="button"
          onClick={close}
          aria-label={ARTEFACT_COPY.close}
          data-testid={`${ARTEFACT_COLUMN_TESTID}-close`}
          className={`inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded text-text-light hover:text-text-body ${ACTION_FOCUS}`}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <PreMortemWorksheet isBusy={isBusy} isStale={isStale} />
      </div>
    </aside>
  )
}

/** The Reasoning tab's one line for the worksheet: it says the worksheet exists and opens it beside the model. */
export function ArtefactOpener() {
  const worksheet = useCurrentPremortemWorksheet()
  const show = useArtefactStore((s) => s.show)
  if (worksheet === null) return null
  return (
    <div data-testid="premortem-worksheet-opener" className="flex items-center gap-2 border-b border-panel-border py-3">
      <AlertTriangle aria-hidden="true" className="h-4 w-4 flex-none text-text-light" />
      <span className={`${typography.panelHeader} min-w-0 flex-1 text-text-body`}>{PREMORTEM_COPY.title}</span>
      <button type="button" className={`${typography.panelBody} ${action('inline')}`} onClick={() => show('premortem')}>
        {ARTEFACT_COPY.open}
      </button>
    </div>
  )
}
