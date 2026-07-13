/**
 * StrengthenPanel — presentational panel, prototype-parity build
 * (build-ready v6 section#strengthCard; brief §8.3/§8.4/§8.9).
 *
 * Store-free: records and handlers arrive as props from StrengthenContainer.
 * Layout follows the prototype: card head (title over progress line), flush
 * full-width rows separated by border-bottom (no inner cards), each row a
 * two-line block (title + trigger signal) with a leading family icon and a
 * rotating chevron; expanded body indented under the title with the bold
 * info-blue "Try this" lead-in; footer hosts Show more / Expand all and the
 * addressed-history text toggle. §8.3 discipline: exactly ONE recommendation
 * visible and expanded by default; never a completion score. Help types are
 * internal and never rendered as stages.
 *
 * Per-row expansion is independent (not an exclusive accordion) and survives
 * re-renders. Dismiss shows a transient 6s notice with Undo; Mark as
 * addressed shows a transient confirmation.
 */
import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardCheck,
  Crosshair,
  GitBranch,
  MessageCircle,
  MoveHorizontal,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { typography } from '../../../styles/typography'
import { STRENGTHEN_COPY as COPY } from './strengthenCopy'
import type { RecRecord } from '../../../canvas/stores/strengthenStore'

export interface StrengthenPanelProps {
  active: RecRecord[]
  history: RecRecord[]
  addressedCount: number
  onPrimaryAction: (record: RecRecord) => void
  /** Opens the Ask-Olumi drawer PREFILLED (never auto-sends, never mutates status). */
  onWorkThrough: (record: RecRecord) => void
  /** Returns false when the target no longer resolves (honest feedback). */
  onFocusCanvas?: (record: RecRecord) => boolean | void
  onNotRelevant: (record: RecRecord) => void
  onMarkAddressed: (record: RecRecord) => void
  /** Undo affordance for a just-dismissed record. */
  onUndoDismiss?: (record: RecRecord) => void
}

/** Rec-family → leading icon (17px Lucide stroke in the 22px first column,
 * neutral text-factor per the prototype's --factor token, aria-hidden).
 * Mapping (documented for the design deck):
 * - success-measure (define success/goal)  → Target
 * - voi (investigate before relying)       → TrendingUp
 * - flip (assumption most likely to flip)  → AlertTriangle
 * - lehi (give the factor a range)         → MoveHorizontal
 * - robustness (pressure-test the leader)  → Scale
 * - broaden (find a different route)       → GitBranch
 * - commit (record the decision)           → ClipboardCheck
 * - phase3 (Olumi model review item)       → MessageCircle
 * - unknown families fall back to Check (prototype fallback). */
export function recIconFor(recId: string): LucideIcon {
  if (recId === 'strengthen:success-measure') return Target
  if (recId.startsWith('strengthen:voi:')) return TrendingUp
  if (recId.startsWith('strengthen:flip:')) return AlertTriangle
  if (recId.startsWith('strengthen:lehi:')) return MoveHorizontal
  if (recId === 'strengthen:robustness') return Scale
  if (recId === 'strengthen:broaden') return GitBranch
  if (recId === 'strengthen:commit') return ClipboardCheck
  if (recId.startsWith('strengthen:phase3:')) return MessageCircle
  return Check
}

type Notice =
  | { kind: 'dismissed'; record: RecRecord }
  | { kind: 'addressed' }
  | { kind: 'focus-failed' }

const NOTICE_MS = 6000

function RecRow({
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
  const Icon = recIconFor(rec.id)
  const showAddressAffordance = record.status === 'in_progress' || record.status === 'reopened'
  return (
    <li
      className="border-b border-panel-border last:border-b-0"
      data-testid={`strengthen-rec-${record.id}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="grid w-full grid-cols-[22px_minmax(0,1fr)_18px] items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <Icon aria-hidden="true" data-testid="strengthen-rec-icon" className="mt-px h-[17px] w-[17px] text-factor" />
        <span className="min-w-0">
          <span className={`${typography.panelBody} block font-semibold text-text-header`}>
            {rec.title}
            {record.status === 'in_progress' && (
              <span
                className={`${typography.panelMeta} ml-1.5 inline-flex items-center rounded-pill border border-info/30 bg-transparent px-1.5 font-normal text-text-body align-middle`}
              >
                {COPY.inProgressPill}
              </span>
            )}
            {record.status === 'reopened' && (
              <span
                className={`${typography.panelMeta} ml-1.5 inline-flex items-center rounded-pill border border-warning/30 bg-transparent px-1.5 font-normal text-text-body align-middle`}
              >
                {COPY.reopenedPill}
              </span>
            )}
          </span>
          <span className={`${typography.panelMeta} mt-0.5 block text-text-light`}>{rec.signal}</span>
          {record.isStale && (
            <span className={`${typography.panelMeta} block italic text-text-light`}>{COPY.staleLabel}</span>
          )}
          {record.status === 'reopened' && reopenReason && (
            <span className={`${typography.panelMeta} block text-text-light`}>
              {COPY.reopenedPrefix} {reopenReason}.
            </span>
          )}
        </span>
        <ChevronRight
          aria-hidden="true"
          className={`mt-0.5 h-4 w-4 text-text-light transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="space-y-1.5 pb-3 pl-[42px] pr-3">
          <p className={`${typography.panelBody} text-text-body`}>{rec.whyNow}</p>
          <p className={`${typography.panelBody} text-text-header`}>
            <span className="font-semibold text-info">{COPY.tryThisLead}</span> {rec.tryThis}
          </p>
          <p className={`${typography.panelMeta} text-text-light`}>{rec.sourceLine}</p>

          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            <button
              type="button"
              onClick={() => onPrimaryAction(record)}
              className={`${typography.panelBody} rounded-pill bg-primary px-3 py-1 font-semibold text-text-on-color transition-colors hover:bg-primary-hover active:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              {rec.action.label}
            </button>
            {rec.targetId && onFocusCanvas && (
              <button
                type="button"
                onClick={() => onFocusCanvas(record)}
                className={`${typography.panelBody} inline-flex items-center gap-1 rounded-pill border border-panel-border bg-transparent px-2.5 py-1 text-text-body transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                <Crosshair aria-hidden="true" className="h-3 w-3 text-info" />
                {COPY.focusOnCanvas}
              </button>
            )}
            {showAddressAffordance && (
              <button
                type="button"
                onClick={() => onMarkAddressed(record)}
                className={`${typography.panelBody} inline-flex items-center gap-1 rounded-pill border border-success/30 bg-transparent px-2.5 py-1 text-text-body transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                <Check aria-hidden="true" className="h-3 w-3 text-success" />
                {COPY.markAddressed}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNotRelevant(record)}
              className={`${typography.panelBody} text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              {COPY.notRelevant}
            </button>
            <button
              type="button"
              aria-label={COPY.workThrough}
              title={COPY.workThrough}
              onClick={() => onWorkThrough(record)}
              className="ml-auto inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-panel-border bg-transparent text-info transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
            >
              <Sparkles aria-hidden="true" className="h-4 w-4" />
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
  onUndoDismiss,
}: StrengthenPanelProps) {
  const [showAll, setShowAll] = useState(false)
  const [allExpanded, setAllExpanded] = useState(false)
  // Independent per-row expansion: explicit user choices override the default
  // (first row open; every row open under Expand all). Never an exclusive
  // accordion — opening one row does not close another.
  const [expandOverrides, setExpandOverrides] = useState<Record<string, boolean>>({})
  const [historyOpen, setHistoryOpen] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showNotice = (next: Notice) => {
    setNotice(next)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
  }, [])

  const visible = showAll ? active : active.slice(0, 1)
  const hiddenCount = active.length - 1

  const isExpanded = (record: RecRecord, index: number) =>
    expandOverrides[record.id] ?? (allExpanded || index === 0)

  const handleNotRelevant = (record: RecRecord) => {
    onNotRelevant(record)
    showNotice({ kind: 'dismissed', record })
  }
  const handleMarkAddressed = (record: RecRecord) => {
    onMarkAddressed(record)
    showNotice({ kind: 'addressed' })
  }
  const handleFocusCanvas = onFocusCanvas
    ? (record: RecRecord) => {
        if (onFocusCanvas(record) === false) showNotice({ kind: 'focus-failed' })
      }
    : undefined
  const handleUndo = () => {
    if (notice?.kind === 'dismissed') onUndoDismiss?.(notice.record)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(null)
  }

  return (
    <section
      aria-label={COPY.title}
      data-testid="strengthen-panel"
      className="overflow-hidden rounded-lg border border-panel-border bg-panel"
    >
      <div className="px-3 pb-2 pt-3">
        <h2 className={`${typography.panelHeader} text-text-header`}>{COPY.title}</h2>
        <p className={`${typography.panelMeta} text-text-light`}>
          {COPY.summary(addressedCount, active.length)}
        </p>
      </div>

      {notice && (
        <div
          role="status"
          data-testid="strengthen-notice"
          className={`${typography.panelBody} flex items-center gap-2 border-t border-panel-border px-3 py-2 text-text-body`}
        >
          <span>
            {notice.kind === 'dismissed'
              ? COPY.dismissedNotice
              : notice.kind === 'addressed'
                ? COPY.addressedNotice
                : COPY.focusFailedNotice}
          </span>
          {notice.kind === 'dismissed' && onUndoDismiss && (
            <button
              type="button"
              onClick={handleUndo}
              className={`${typography.panelBody} font-semibold text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              {COPY.undo}
            </button>
          )}
        </div>
      )}

      {active.length === 0 ? (
        <p className={`${typography.panelBody} border-t border-panel-border px-3 py-3 text-text-body`}>
          {COPY.empty}
        </p>
      ) : (
        <ul className="border-t border-panel-border">
          {visible.map((record, index) => (
            <RecRow
              key={record.id}
              record={record}
              expanded={isExpanded(record, index)}
              onToggle={() =>
                setExpandOverrides((prev) => ({
                  ...prev,
                  [record.id]: !isExpanded(record, index),
                }))
              }
              onPrimaryAction={onPrimaryAction}
              onWorkThrough={onWorkThrough}
              onFocusCanvas={handleFocusCanvas}
              onNotRelevant={handleNotRelevant}
              onMarkAddressed={handleMarkAddressed}
            />
          ))}
        </ul>
      )}

      {historyOpen && (
        <div className="border-t border-panel-border px-3 py-2" data-testid="strengthen-history">
          <h3 className={`${typography.panelMeta} mb-1 text-text-light`}>{COPY.historyHeading}</h3>
          {history.length === 0 ? (
            <p className={`${typography.panelMeta} text-text-light`}>{COPY.historyEmpty}</p>
          ) : (
            history.map((record) => {
              const last = record.history[record.history.length - 1]
              return (
                <div key={record.id} className="flex items-start gap-1.5 py-0.5">
                  <Check aria-hidden="true" className="mt-0.5 h-[17px] w-[17px] flex-none text-text-light" />
                  <div className="min-w-0">
                    <p className={`${typography.panelBody} text-text-body`}>{record.snapshot.title}</p>
                    <p className={`${typography.panelMeta} text-text-light`}>
                      {record.status === 'dismissed'
                        ? 'Dismissed as not relevant.'
                        : last?.whatChanged
                          ? `Addressed: ${last.whatChanged}.`
                          : 'Addressed.'}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      <div
        className="flex items-center gap-3 border-t border-panel-border px-3 py-2"
        data-testid="strengthen-footer"
      >
        {active.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className={`${typography.panelMeta} text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              {showAll ? COPY.showFewer : COPY.showMore(hiddenCount)}
            </button>
            <button
              type="button"
              onClick={() => {
                setAllExpanded((v) => !v)
                setExpandOverrides({})
                if (!allExpanded) setShowAll(true)
              }}
              className={`${typography.panelMeta} text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              {allExpanded ? COPY.collapseAll : COPY.expandAll}
            </button>
          </>
        )}
        <button
          type="button"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((v) => !v)}
          className={`${typography.panelMeta} ml-auto text-text-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        >
          {COPY.historyToggle}
        </button>
      </div>
    </section>
  )
}
