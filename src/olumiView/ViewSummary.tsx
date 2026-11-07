/**
 * THE SUMMARY PAGE (core API v1.16, DL 7 Nov): the lane's Summary, one saved version's reasoning artefact as core built it, drawn block by
 * block as core's `blocks` say, every word core's. It opens over the canvas from the top bar's Summary control and carries the two
 * exports core serves from the same blocks: "Download Markdown" and "Print or save as PDF" (core's print-ready page, in a new tab).
 * The version is the one on screen: the earlier version being looked at, else the latest saved one, never a proposal still held.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileText, Printer, X } from 'lucide-react'
import { typography } from '../styles/typography'
import { DECISION_BRIEF_TRIGGER_LABEL } from '../canvas/decisionBrief/DecisionBriefTrigger'
import { useViewStore } from './store'
import { useMe } from '../olumiCore/me'
import { readSummary, summaryGroups, summaryPath, type Summary, type SummaryBlock, type SummaryPart } from './summary'

export const SUMMARY_DOWNLOAD_LABEL = 'Download Markdown'
export const SUMMARY_PRINT_LABEL = 'Print or save as PDF'
export const SUMMARY_LOADING = 'Reading the Summary…'
export const SUMMARY_FAILED = 'The Summary could not be read. Close it and try again.'

const TAG_CLASS: Record<SummaryBlock['tag'], string> = {
  h1: `${typography.viewPanelHeadline} text-text-header`,
  h2: `${typography.panelHeader} mt-5 border-b border-panel-border pb-1 text-text-header`,
  h3: `${typography.panelHeader} mt-3 text-text-header`,
  p: `${typography.viewPanelBody} text-text-body`,
  li: `${typography.viewPanelBody} text-text-body`,
  meta: `${typography.viewPanelMeta} text-text-light`,
}

function Part({ part }: { part: SummaryPart }) {
  const words = part.href === null ? part.text : <a href={part.href} target="_blank" rel="noopener noreferrer" className="underline">{part.text}</a>
  return (
    <>
      {part.strong ? <b className="font-medium">{words}</b> : words}
      {part.mark === null ? null : <>{' '}<span role="img" title={part.mark.title} aria-label={part.mark.title}>{part.mark.glyph}</span></>}
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
    <article className="flex flex-col gap-1.5" data-testid="summary-document">
      {summaryGroups(summary.blocks).map((g) => (g.list
        ? <ul key={g.first} className="ml-5 list-disc flex flex-col gap-1">{g.blocks.map((b, i) => <Block key={g.first + i} block={b} at={g.first + i} />)}</ul>
        : <Block key={g.first} block={g.blocks[0]!} at={g.first} />))}
    </article>
  )
}

/** The page: core's Summary for `sid` at `at`, with its two exports, read afresh each time it opens. */
export function SummaryPage({ sid, at, onClose }: { sid: string; at: number | null; onClose: () => void }) {
  const [state, setState] = useState<{ summary: Summary } | { error: string } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
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
  useEffect(() => { closeRef.current?.focus() }, [])
  // The exports are of the version this page read, not of whatever is latest by the time they are clicked.
  const readN = state !== null && 'summary' in state && state.summary.version !== null ? state.summary.version.n : at
  // Tab never leaves the dialog: from the last control it wraps to the first, and Shift+Tab from the first to the last.
  const trap = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const stops = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
    const first = stops[0], last = stops[stops.length - 1]
    if (first === undefined || last === undefined) return
    const here = document.activeElement
    if (!e.shiftKey && (here === last || !e.currentTarget.contains(here))) { e.preventDefault(); first.focus() }
    else if (e.shiftKey && (here === first || !e.currentTarget.contains(here))) { e.preventDefault(); last.focus() }
  }
  const exportLink = 'inline-flex items-center gap-1.5 rounded-md border border-panel-border px-2.5 py-1.5 text-sm text-text-header hover:bg-panel-hover'
  return (
    <div role="dialog" aria-modal="true" aria-label={DECISION_BRIEF_TRIGGER_LABEL} data-testid="summary-page" onKeyDown={trap}
      className="fixed inset-0 z-[1600] flex justify-center bg-black/20 px-3 pb-3 pt-14" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex w-full max-w-[820px] flex-col rounded-lg border border-panel-border bg-panel shadow-panel">
        <div className="flex items-center gap-2 border-b border-panel-border px-4 py-2.5">
          <FileText size={14} aria-hidden="true" />
          <span className="text-sm font-semibold text-text-header">{DECISION_BRIEF_TRIGGER_LABEL}</span>
          <span className="flex-1" />
          {/* The exports only beside a Summary this page has read for its own person. */}
          {state !== null && 'summary' in state ? (
            <>
              <a href={summaryPath(sid, readN, 'md')} download className={exportLink} data-testid="summary-download"><Download size={14} aria-hidden="true" />{SUMMARY_DOWNLOAD_LABEL}</a>
              <a href={summaryPath(sid, readN, 'html')} target="_blank" rel="noopener noreferrer" className={exportLink} data-testid="summary-print"><Printer size={14} aria-hidden="true" />{SUMMARY_PRINT_LABEL}</a>
            </>
          ) : null}
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md p-1.5 text-text-light hover:bg-panel-hover hover:text-text-header" aria-label="Close summary" data-testid="summary-close">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {state === null ? <p className={typography.viewPanelBody} role="status">{SUMMARY_LOADING}</p>
            : 'error' in state ? <p className={typography.viewPanelBody} role="alert" data-testid="summary-error">{state.error}</p>
            : <SummaryDocument summary={state.summary} />}
        </div>
      </div>
    </div>
  )
}

/** The top bar's Summary control on the lane: shown once core holds a saved version of this scenario; opens the page. */
export function ViewSummaryTrigger({ className = '' }: { className?: string }) {
  const sid = useViewStore((s) => s.sid)
  const at = useViewStore((s) => s.at)
  const saved = useViewStore((s) => s.view !== null && s.view.version !== null)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  // A page opened for one scenario is closed when the scenario changes, never kept open behind a control that is not there.
  useEffect(() => { setOpen(false) }, [sid])
  // Closing hands focus back to the control that opened the page.
  const close = useCallback(() => { setOpen(false); trigger.current?.focus() }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])
  if (sid === null || !saved) return null
  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)} className={className} aria-expanded={open} aria-haspopup="dialog" aria-label={DECISION_BRIEF_TRIGGER_LABEL} data-testid="summary-trigger">
        <FileText size={14} aria-hidden="true" />
      </button>
      {open && createPortal(<SummaryPage sid={sid} at={at} onClose={close} />, document.body)}
    </>
  )
}
