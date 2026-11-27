/**
 * THE SUMMARY PAGE (core API v1.16, DL 7 Nov): the lane's Summary, one saved version's reasoning artefact as core built it, drawn block by
 * block as core's `blocks` say, every word core's. It opens over the canvas from the top bar's Summary control and carries the two
 * exports core serves from the same blocks: "Download Markdown" and "Print or save as PDF" (core's print-ready page, in a new tab).
 * The version is the one on screen: the earlier version being looked at, else the latest saved one, never a proposal still held.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { OkIcon } from './look/icons'
import { GlyphMark, HoverButton } from './look/Hover'
import { CANVAS_LAYER_CLASS } from '../canvas/layers'
import { FLOAT_CLASS } from './look/float'
import { useDialogFocus } from './look/useDialogFocus'
import { typography } from '../styles/typography'
import { DECISION_BRIEF_TRIGGER_LABEL } from '../canvas/decisionBrief/DecisionBriefTrigger'
import { useViewStore } from './store'
import { useMe } from '../olumiCore/me'
import { readSummary, summaryGroups, summaryPath, summaryReachable, type Summary, type SummaryBlock, type SummaryPart } from './summary'

export const SUMMARY_DOWNLOAD_LABEL = 'Download Markdown'
export const SUMMARY_PRINT_LABEL = 'Print or save as PDF'
export const SUMMARY_LOADING = 'Reading the Summary…'
export const SUMMARY_FAILED = 'The Summary could not be read. Close it and try again.'

const TAG_CLASS: Record<SummaryBlock['tag'], string> = {
  h1: `${typography.viewPanelHeadline} text-text-header`,
  h2: `${typography.panelHeader} mt-6 border-b border-panel-border pb-2 text-text-header`,
  h3: `${typography.viewPanelMeta} font-medium mt-4 text-text-header`,
  p: `${typography.viewPanelBody} text-text-body`,
  li: `${typography.viewPanelBody} text-text-body`,
  meta: `${typography.viewPanelMeta} text-text-light`,
}

function Part({ part }: { part: SummaryPart }) {
  const words = part.href === null ? part.text : <a href={part.href} target="_blank" rel="noopener noreferrer" className="underline">{part.text}</a>
  return (
    <>
      {part.strong ? <b className="font-medium">{words}</b> : words}
      {part.mark === null ? null : <>{' '}<GlyphMark mark={part.mark} /></>}
    </>
  )
}

function Block({ block, at }: { block: SummaryBlock; at: number }) {
  const Tag = block.tag === 'meta' ? 'p' : block.tag
  return <Tag className={TAG_CLASS[block.tag]} data-summary-block={at}>{block.parts.map((p, i) => <Part key={i} part={p} />)}</Tag>
}

/** The Summary's document: every block core sent, in its order, each drawn as its parts say. */
export function SummaryDocument({ summary }: { summary: Summary }) {
  return (
    <article className="flex flex-col gap-2" data-testid="summary-document">
      {summaryGroups(summary.blocks).map((g) => (g.list
        ? <ul key={g.first} className="ml-3 list-disc flex flex-col gap-1">{g.blocks.map((b, i) => <Block key={g.first + i} block={b} at={g.first + i} />)}</ul>
        : <Block key={g.first} block={g.blocks[0]!} at={g.first} />))}
    </article>
  )
}

/** The page: core's Summary for `sid` at `at`, with its two exports, read afresh each time it opens. */
export function SummaryPage({ sid, at, onClose, trigger }: { sid: string; at: number | null; onClose: () => void; trigger?: RefObject<HTMLButtonElement> }) {
  const [state, setState] = useState<{ summary: Summary } | { error: string } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const { dialogRef, onKeyDown } = useDialogFocus<HTMLDivElement>({
    popup: true,
    initialFocus: () => closeRef.current,
    opener: () => trigger?.current,
    onEscape: onClose,
  })
  // The person the page is for: each read is bound to them, and a change of person reads again (summary.ts readSummary).
  const person = useMe((s) => s.me?.id ?? null)
  // Showing the latest: the latest saved version's number, so a newer save reads again rather than leaving an older version as current.
  const latest = useViewStore((s) => (at === null ? s.view?.version?.n ?? null : null))
  useEffect(() => {
    let live = true
    setState(null)
    readSummary(sid, at, person).then((summary) => { if (live) setState({ summary }) }, (e: unknown) => { if (live) setState({ error: e instanceof Error && e.message !== '' ? e.message : SUMMARY_FAILED }) })
    return () => { live = false }
  }, [sid, at, person, latest])
  // The exports are of the version this page read, not of whatever is latest by the time they are clicked.
  const readN = state !== null && 'summary' in state && state.summary.version !== null ? state.summary.version.n : at
  const exportLink = `inline-flex items-center gap-1.5 rounded-full border border-panel-border px-4 py-2 ${typography.viewPanelMeta} font-medium text-text-header hover:bg-panel-hover`
  return (
    <div className={`fixed inset-0 ${CANVAS_LAYER_CLASS.modalBackdrop} flex justify-center bg-[var(--backdrop)] p-3 pr-[calc(var(--dock-right-offset,0rem)+var(--space-3))] pt-[var(--space-12)]`}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={DECISION_BRIEF_TRIGGER_LABEL}
        data-testid="summary-page" onKeyDown={onKeyDown} className={`${FLOAT_CLASS} w-full max-w-[820px] outline-none`}>
        <div className="flex items-center gap-2 border-b border-panel-border pb-2">
          <OkIcon id="brief" size={14} decorative inherit />
          <h2 className={`${typography.panelHeader} m-0 text-text-header`}>{DECISION_BRIEF_TRIGGER_LABEL}</h2>
          <span className="flex-1" />
          {/* The exports only beside a Summary this page has read for its own person. */}
          {state !== null && 'summary' in state ? (
            <>
              <a href={summaryPath(sid, readN, 'md')} download className={exportLink} data-testid="summary-download"><OkIcon id="export" size={14} decorative inherit />{SUMMARY_DOWNLOAD_LABEL}</a>
              <a href={summaryPath(sid, readN, 'html')} target="_blank" rel="noopener noreferrer" className={exportLink} data-testid="summary-print"><OkIcon id="print" size={14} decorative inherit />{SUMMARY_PRINT_LABEL}</a>
            </>
          ) : null}
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md p-1.5 text-text-light hover:bg-panel-hover hover:text-text-header" aria-label="Close summary" data-testid="summary-close">
            <OkIcon id="cancel-close" size={14} decorative inherit />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {state === null ? <p className={typography.viewPanelBody} role="status">{SUMMARY_LOADING}</p>
            : 'error' in state ? <p className={typography.viewPanelBody} role="alert" data-testid="summary-error">{state.error}</p>
            : <SummaryDocument summary={state.summary} />}
        </div>
      </div>
    </div>
  )
}

/** The top bar's Summary control on the lane: shown once core holds a saved version of this scenario, or working notes before one; opens the page. Its tooltip wraps
 *  the button alone: the page is portalled from here, and React carries a portal's focus and pointer events up to the tooltip around it,
 *  so a tooltip around both opened over the page whenever a control inside it took focus (a real Chromium, 7 Nov). */
export function ViewSummaryTrigger({ className = '', tooltip = null }: { className?: string; tooltip?: string | null }) {
  const sid = useViewStore((s) => s.sid)
  const at = useViewStore((s) => s.at)
  // A saved version, or core's working notes for a scenario with none yet (summaryReachable): never an empty page.
  const saved = useViewStore((s) => summaryReachable(s.view))
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  // A page opened for one scenario is closed when the scenario changes, never kept open behind a control that is not there.
  useEffect(() => { setOpen(false) }, [sid])
  if (sid === null || !saved) return null
  return (
    <>
      <HoverButton words={tooltip} ref={trigger} type="button" onClick={() => setOpen(true)} className={className} aria-expanded={open} aria-haspopup="dialog" aria-label={DECISION_BRIEF_TRIGGER_LABEL} data-testid="summary-trigger">
          <OkIcon id="brief" size={14} decorative inherit />
      </HoverButton>
      {open && createPortal(<SummaryPage sid={sid} at={at} onClose={() => setOpen(false)} trigger={trigger} />, document.body)}
    </>
  )
}
