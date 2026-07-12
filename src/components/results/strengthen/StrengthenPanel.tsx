/**
 * StrengthenPanel — Wave 3a presentational panel (brief §8.3/§8.4/§8.9).
 *
 * Store-free: records and handlers arrive as props from StrengthenContainer.
 * §8.3 discipline: exactly ONE recommendation visible and expanded by
 * default; the rest behind Show more; Expand/Collapse all; a compact
 * summary line; addressed/dismissed history behind a disclosure — never a
 * completion score. Help types are internal and never rendered as stages.
 */
import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Crosshair, Sparkles } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { STRENGTHEN_COPY as COPY } from './strengthenCopy'
import type { RecRecord } from '../../../canvas/stores/strengthenStore'

export interface StrengthenPanelProps {
  active: RecRecord[]
  history: RecRecord[]
  addressedCount: number
  onPrimaryAction: (record: RecRecord) => void
  onWorkThrough: (record: RecRecord) => void
  onFocusCanvas?: (record: RecRecord) => void
  onNotRelevant: (record: RecRecord) => void
  onMarkAddressed: (record: RecRecord) => void
}

function RecCard({
  record,
  expanded,
  onToggle,
  onPrimaryAction,
  onWorkThrough,
  onFocusCanvas,
  onNotRelevant,
  onMarkAddressed,
}: {
  record: RecRecord
  expanded: boolean
  onToggle: () => void
  onPrimaryAction: (r: RecRecord) => void
  onWorkThrough: (r: RecRecord) => void
  onFocusCanvas?: (r: RecRecord) => void
  onNotRelevant: (r: RecRecord) => void
  onMarkAddressed: (r: RecRecord) => void
}) {
  const rec = record.snapshot
  const reopenReason = [...record.history].reverse().find((e) => e.event === 'reopened')?.reopenReason
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <li className="rounded-lg border border-panel-border bg-panel p-3 space-y-2" data-testid={`strengthen-rec-${record.id}`}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className={`${typography.panelHeader} flex w-full items-start gap-1.5 text-left text-text-header`}
      >
        <Chevron aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-text-light" />
        <span className="min-w-0 flex-1 break-words">{rec.title}</span>
      </button>

      {record.isStale && (
        <p className={`${typography.panelMeta} text-text-light italic`}>{COPY.staleLabel}</p>
      )}
      {record.status === 'reopened' && reopenReason && (
        <p className={`${typography.panelMeta} text-text-light`}>
          {COPY.reopenedPrefix} {reopenReason}.
        </p>
      )}

      {expanded && (
        <div className="space-y-1.5">
          <p className={`${typography.panelBody} text-text-body`}>
            {COPY.signalLabel} {rec.signal}
          </p>
          <p className={`${typography.panelBody} text-text-body`}>
            {COPY.whyLabel} {rec.whyNow}
          </p>
          <p className={`${typography.panelBody} text-text-body`}>
            {COPY.tryLabel} {rec.tryThis}
          </p>
          <p className={`${typography.panelMeta} text-text-light`}>{rec.sourceLine}</p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onPrimaryAction(record)}
              className={`${typography.panelMeta} rounded-pill bg-primary px-3 py-1 text-text-on-color transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              {rec.action.label}
            </button>
            <button
              type="button"
              onClick={() => onWorkThrough(record)}
              className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-pill border border-panel-border bg-transparent px-3 py-1 text-text-body hover:border-info/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              <Sparkles aria-hidden="true" className="h-3 w-3 text-info" />
              {COPY.workThrough}
            </button>
            {rec.targetId && onFocusCanvas && (
              <button
                type="button"
                onClick={() => onFocusCanvas(record)}
                className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-pill border border-panel-border bg-transparent px-3 py-1 text-text-body hover:border-info/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                <Crosshair aria-hidden="true" className="h-3 w-3 text-info" />
                {COPY.focusOnCanvas}
              </button>
            )}
            {record.status === 'in_progress' && (
              <button
                type="button"
                onClick={() => onMarkAddressed(record)}
                className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-pill border border-success/30 bg-transparent px-3 py-1 text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                <Check aria-hidden="true" className="h-3 w-3 text-success" />
                {COPY.markAddressed}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNotRelevant(record)}
              className={`${typography.panelMeta} ml-auto text-text-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              {COPY.notRelevant}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export function StrengthenPanel({
  active,
  history,
  addressedCount,
  onPrimaryAction,
  onWorkThrough,
  onFocusCanvas,
  onNotRelevant,
  onMarkAddressed,
}: StrengthenPanelProps) {
  const [showAll, setShowAll] = useState(false)
  const [allExpanded, setAllExpanded] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const visible = showAll ? active : active.slice(0, 1)
  const hiddenCount = active.length - 1

  const isExpanded = (record: RecRecord, index: number) =>
    allExpanded || (openId != null ? openId === record.id : index === 0)

  return (
    <section
      aria-label={COPY.title}
      data-testid="strengthen-panel"
      className="rounded-lg border border-panel-border bg-panel p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <h2 className={`${typography.panelHeader} text-text-header`}>{COPY.title}</h2>
        <span className={`${typography.panelMeta} ml-auto text-text-light`}>
          {COPY.summary(addressedCount, active.length)}
        </span>
      </div>

      {active.length === 0 ? (
        <p className={`${typography.panelBody} text-text-light`}>{COPY.empty}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((record, index) => (
            <RecCard
              key={record.id}
              record={record}
              expanded={isExpanded(record, index)}
              onToggle={() => setOpenId(isExpanded(record, index) ? '' : record.id)}
              onPrimaryAction={onPrimaryAction}
              onWorkThrough={onWorkThrough}
              onFocusCanvas={onFocusCanvas}
              onNotRelevant={onNotRelevant}
              onMarkAddressed={onMarkAddressed}
            />
          ))}
        </ul>
      )}

      {active.length > 1 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className={`${typography.panelMeta} text-text-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          >
            {showAll ? COPY.showFewer : COPY.showMore(hiddenCount)}
          </button>
          <button
            type="button"
            onClick={() => {
              setAllExpanded((v) => !v)
              if (!allExpanded) setShowAll(true)
            }}
            className={`${typography.panelMeta} text-text-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          >
            {allExpanded ? COPY.collapseAll : COPY.expandAll}
          </button>
        </div>
      )}

      <div className="border-t border-panel-border pt-2">
        <button
          type="button"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((v) => !v)}
          className={`${typography.panelMeta} text-text-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        >
          {COPY.historyToggle}
        </button>
        {historyOpen && (
          <div className="mt-2 space-y-1.5" data-testid="strengthen-history">
            <h3 className={`${typography.panelMeta} text-text-header`}>{COPY.historyHeading}</h3>
            {history.length === 0 ? (
              <p className={`${typography.panelMeta} text-text-light`}>{COPY.historyEmpty}</p>
            ) : (
              history.map((record) => {
                const last = record.history[record.history.length - 1]
                return (
                  <div key={record.id} className="space-y-0.5">
                    <p className={`${typography.panelBody} text-text-body`}>{record.snapshot.title}</p>
                    <p className={`${typography.panelMeta} text-text-light`}>
                      {record.status === 'dismissed' ? 'Dismissed as not relevant.' : last?.whatChanged ? `Addressed: ${last.whatChanged}.` : 'Addressed.'}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </section>
  )
}
