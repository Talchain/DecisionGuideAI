/**
 * ⭐ M2: THE RERUN'S CONSEQUENCE, ON THE CANVAS (PTL #85 5933452605 / 5933474575, investor-P0; lease CANVAS 5933472900).
 *
 * After a rerun the user should not have to open a tab to learn what their change did. A one-line pill in the
 * band's bottom-centre cell says what changed and what moved; "Why?" opens the rest above it: the producer's
 * comparability sentence (verbatim) and what remains uncertain. Each changed input focuses its node or link, and
 * "Open in Compare" shows the full pair. Closing it hides it for this analysis; the next Run brings it back.
 *
 * The words are `graphChanges/runChangesSummaryLines` (the Compare section's own phrasing, from the one reader). This
 * file only lays them out and arbitrates for the cell.
 *
 * ⚠ A BAND OCCUPANT, NOT A POSITION. `CanvasOverlayBand` owns overlay space: this claims `bottom-centre` by its
 * test id and renders into the cell, after the live LOD notice and before the first-model notice (`OVERLAY_PRIORITY`).
 * The pill fits the band's fixed 64px; only the user-opened "Why?" detail rises above it, like the lens panel.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useOverlayCell } from './CanvasOverlayBand'
import { useCanvasStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { selectWinShareWithheldReason, selectWinSharesWithheld } from '../state/winShareGate'
import { useDisplayedRunDeltaView } from '../../components/results/analysisNew/displayedRunDeltaView'
import { canvasLinkOfRow, useCanvasLight } from '../graphChanges/rowCanvasLink'
import { useValuePrefillStore, valuePrefillOfRow, type ValuePrefill } from '../graphChanges/valuePrefill'
import type { RunDeltaInputRow } from '../../components/results/analysisNew/runDeltaView'
import {
  RUN_CHANGES_SUMMARY_COPY as COPY,
  runChangesSummaryHasContent,
  runChangesSummaryLines,
} from '../graphChanges/runChangesSummaryLines'
import { typography } from '../../styles/typography'
import { useIsViewer } from '../../lib/viewerMode'

export const RUN_CHANGES_SUMMARY_TESTID = 'run-changes-summary'

/** What-if "Put it back" (DL #85 5942153284, option B): the words of the one control. */
export const PUT_IT_BACK_COPY = 'Put it back'

function DetailLine({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-x-3" data-testid={`${RUN_CHANGES_SUMMARY_TESTID}-${id}`}>
      <dt className={`${typography.panelMeta} text-text-light m-0 pt-px`}>{label}</dt>
      <dd className={`${typography.panelBody} text-text-body m-0 min-w-0 break-words`}>{children}</dd>
    </div>
  )
}

export function RunChangesSummary(): JSX.Element | null {
  const responseHash = useCanvasStore((s) => s.results?.hash ?? null)
  const view = useDisplayedRunDeltaView(responseHash)
  const winSharesWithheld = useCanvasStore(selectWinSharesWithheld)
  const winShareWithheldReason = useCanvasStore(selectWinShareWithheldReason)
  const [closedFor, setClosedFor] = useState<string | null>(null)
  const [openFor, setOpenFor] = useState<string | null>(null)
  const light = useCanvasLight()
  const storedDelta = useCanvasStore((s) => s.runDelta?.delta ?? null)
  const requestPrefill = useValuePrefillStore((s) => s.requestPrefill)
  // ACCOUNTS viewer mode (CANVAS 5947752314): a viewer reads the changes but cannot put a value back.
  const isViewer = useIsViewer()
  // Is the pill's one line cut short? Only then does the detail repeat what the pill already says (R3 5935751708: the
  // open detail covered the Goal at 1440x900, half of it a second copy of the pill's two lines).
  const lineRef = useRef<HTMLSpanElement>(null)
  const [lineTruncated, setLineTruncated] = useState(false)
  useLayoutEffect(() => {
    const el = lineRef.current
    const cut = el !== null && el.scrollWidth > el.clientWidth + 1
    if (cut !== lineTruncated) setLineTruncated(cut)
  })

  const wants = view !== null && responseHash !== null && closedFor !== responseHash && runChangesSummaryHasContent(view)
  const { granted, target } = useOverlayCell('bottom-centre', RUN_CHANGES_SUMMARY_TESTID, wants)
  if (!wants || !granted || view === null || responseHash === null) return null

  const lines = runChangesSummaryLines(view, winSharesWithheld, winShareWithheldReason)
  const open = openFor === responseHash
  const changedHead = lines.changed[0]?.text ?? lines.changedNote
  const changedExtra = lines.changed.length - 1 + lines.changedMore
  const movedHead = lines.moved[0] ?? lines.movedNote
  const movedExtra = lines.moved.length - 1 + lines.movedMore
  const detailId = `${RUN_CHANGES_SUMMARY_TESTID}-detail`
  // The detail says only what the pill cannot: more rows than its one line holds, or the line itself when it is cut.
  const detailRepeatsChanged = changedExtra > 0 || lineTruncated
  const detailRepeatsMoved = movedExtra > 0 || lineTruncated
  // ⭐ Each changed row lights its element on the canvas on hover / keyboard focus, and focuses it on click (DL 5939855664).
  const headLink = lines.changed[0] ? canvasLinkOfRow(lines.changed[0].row) : null
  // ⭐ What-if "Put it back": opens the card's OWN value editor pre-filled with the earlier value (the user commits with
  // Enter through the existing writer). Offered only where `valuePrefillOfRow` allows it (same unit, the card has an editor).
  const prefillOf = (row: RunDeltaInputRow): ValuePrefill | null =>
    isViewer ? null : valuePrefillOfRow(row, storedDelta, useCanvasStore.getState().nodes)
  const putBack = (row: RunDeltaInputRow, prefill: ValuePrefill, where: 'pill' | 'detail') => (
    <button
      type="button"
      data-testid={`${RUN_CHANGES_SUMMARY_TESTID}-put-back`}
      data-entity-id={row.entityId}
      data-where={where}
      onClick={() => {
        canvasLinkOfRow(row)?.focus()
        requestPrefill(prefill)
      }}
      className={`${where === 'pill' ? `${typography.panelMeta} flex-none` : 'block'} rounded-sm text-text-light underline decoration-dotted underline-offset-2 hover:text-text-body hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
    >
      {PUT_IT_BACK_COPY}
    </button>
  )
  const headPrefill = lines.changed[0] ? prefillOf(lines.changed[0].row) : null

  const body = (
    <div
      data-testid={RUN_CHANGES_SUMMARY_TESTID}
      data-response-hash={responseHash}
      data-attributable={view.attributable ? 'true' : 'false'}
      className="pointer-events-auto relative max-w-full"
    >
      {open && (
        <div
          id={detailId}
          role="region"
          aria-label={COPY.title}
          data-testid={detailId}
          // ⚠ OUT OF FLOW, ABOVE THE PILL. In flow it grew the band's fixed 64px row DOWNWARD, off the bottom of the
          // canvas (preview 1280x800, 1 Oct). Only the pill takes band space; the detail rises over the canvas while
          // the user has it open, as wide as the pill, capped in height.
          className="absolute inset-x-0 bottom-full mb-2 max-h-[min(60vh,420px)] overflow-y-auto rounded-xl border border-panel-border bg-panel px-4 py-3 shadow-2"
        >
          <dl className="m-0 flex flex-col gap-2">
            {detailRepeatsChanged && (
            <DetailLine label={lines.changed.length === 0 ? COPY.inputs : COPY.changed} id="changed">
              {lines.changed.length === 0 ? (
                <span className="text-text-light">{lines.changedNote}</span>
              ) : (
                lines.changed.map(({ row, text }) => {
                  const link = canvasLinkOfRow(row)
                  const prefill = prefillOf(row)
                  return (
                    <span key={row.key} className="block">
                  {link ? (
                    <button
                      type="button"
                      onClick={link.focus}
                      onMouseEnter={() => light.on(link)}
                      onMouseLeave={light.off}
                      onFocus={() => light.on(link)}
                      onBlur={light.off}
                      data-testid={`${RUN_CHANGES_SUMMARY_TESTID}-detail-focus`}
                      data-entity-id={row.entityId}
                      data-canvas-target={`${link.target.kind}:${link.target.id}`}
                      className="block text-left underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info rounded-sm"
                    >
                      {text}
                    </button>
                  ) : (
                    <span className="block">{text}</span>
                  )}
                  {prefill ? putBack(row, prefill, 'detail') : null}
                    </span>
                  )
                })
              )}
              {lines.changedMore > 0 && <span className="block text-text-light">{COPY.more(lines.changedMore)}</span>}
            </DetailLine>
            )}
            {detailRepeatsMoved && (lines.moved.length > 0 || lines.movedNote !== null) && (
              <DetailLine label={COPY.moved} id="moved">
                {lines.movedNote !== null ? (
                  <span className="text-text-light">{lines.movedNote}</span>
                ) : (
                  lines.moved.map((t) => <span key={t} className="block">{t}</span>)
                )}
                {lines.movedMore > 0 && <span className="block text-text-light">{COPY.more(lines.movedMore)}</span>}
              </DetailLine>
            )}
            <DetailLine label={COPY.why} id="why">{lines.why}</DetailLine>
            {lines.uncertain !== null && (
              <DetailLine label={COPY.uncertain} id="uncertain">
                <span className="text-text-light">{lines.uncertain}</span>
              </DetailLine>
            )}
          </dl>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              data-testid={`${RUN_CHANGES_SUMMARY_TESTID}-open-compare`}
              onClick={() => useUIStore.getState().forceActivateOutputTab('compare')}
              className={`${typography.panelMeta} text-text-body underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info rounded-sm`}
            >
              {COPY.openCompare}
            </button>
          </div>
        </div>
      )}
      <div
        role="status"
        className="flex max-w-full items-center gap-2 rounded-full border border-panel-border bg-panel px-3 py-1.5 shadow-2"
      >
        <span className={`${typography.panelMeta} flex-none font-medium text-text-header`}>{COPY.title}</span>
        <span
          ref={lineRef}
          data-testid={`${RUN_CHANGES_SUMMARY_TESTID}-line`}
          className={`${typography.panelMeta} min-w-0 truncate text-text-body`}
          title={[changedHead, movedHead].filter(Boolean).join(' · ')}
        >
          {changedHead !== null && <span className="text-text-light">{lines.changed.length === 0 ? COPY.inputs : COPY.changed} </span>}
          {changedHead === null ? null : headLink ? (
            <button
              type="button"
              onClick={headLink.focus}
              onMouseEnter={() => light.on(headLink)}
              onMouseLeave={light.off}
              onFocus={() => light.on(headLink)}
              onBlur={light.off}
              data-testid={`${RUN_CHANGES_SUMMARY_TESTID}-focus`}
              data-entity-id={lines.changed[0]!.row.entityId}
              data-canvas-target={`${headLink.target.kind}:${headLink.target.id}`}
              className="underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info rounded-sm"
            >
              {changedHead}
            </button>
          ) : (
            changedHead
          )}
          {changedExtra > 0 && <span className="text-text-light"> · +{changedExtra} more</span>}
          {movedHead !== null && (
            <>
              <span className="text-text-light">{changedHead !== null ? ' · ' : ''}{COPY.moved} </span>
              {movedHead}
              {movedExtra > 0 && <span className="text-text-light"> · +{movedExtra} more</span>}
            </>
          )}
        </span>
        {headPrefill && lines.changed[0] ? putBack(lines.changed[0].row, headPrefill, 'pill') : null}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailId}
          data-testid={`${RUN_CHANGES_SUMMARY_TESTID}-why-toggle`}
          onClick={() => setOpenFor(open ? null : responseHash)}
          className={`${typography.panelMeta} flex flex-none items-center gap-0.5 rounded-md px-1 text-text-body hover:text-text-header focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        >
          {open ? COPY.hideWhy : COPY.showWhy}
          {open ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronUp className="h-3 w-3" aria-hidden="true" />}
        </button>
        <button
          type="button"
          aria-label={COPY.close}
          data-testid={`${RUN_CHANGES_SUMMARY_TESTID}-close`}
          onClick={() => setClosedFor(responseHash)}
          className="-m-1.5 flex-none rounded-md p-1.5 text-text-light transition-colors duration-fast hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  )

  return target ? createPortal(body, target) : body
}
