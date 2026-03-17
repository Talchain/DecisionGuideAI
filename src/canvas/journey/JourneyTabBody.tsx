/**
 * JourneyTabBody — Decision Journey timeline for the right-panel OutputsDock.
 *
 * Renders a stage-grouped timeline of ScenarioEvent[] from the active scenario.
 * Track 1: events are not yet wired from persistence — shows empty state.
 * When events are connected in future tracks, the component "just works".
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import {
  Target,
  GitBranch,
  Check,
  X,
  AlertTriangle,
  Pencil,
  BarChart3,
  FileText,
  Share2,
  ArrowRight,
  Gauge,
  Activity,
  Clock,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { typography } from '@/styles/typography'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useCanvasStore } from '../store'
import { EmptyState } from '../components/EmptyState'
import { Accordion } from '../components/pre-analysis/primitives/Accordion'
import type { ScenarioEvent, ScenarioStage } from '../../types/scenario'
import type { TimelineEntry, TimelineIconKey } from './types'
import { STAGE_LABELS } from './types'
import { renderTimeline } from './renderTimeline'
import { renderTimelineSummary } from './renderTimelineSummary'
import { formatJourneyTime } from './formatJourneyTime'

// ---------------------------------------------------------------------------
// Icon lookup (Lucide components keyed by TimelineIconKey)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<TimelineIconKey, ComponentType<{ className?: string }>> = {
  Target,
  GitBranch,
  Check,
  X,
  AlertTriangle,
  Pencil,
  BarChart3,
  FileText,
  Share2,
  ArrowRight,
  Gauge,
  Activity,
}

// ---------------------------------------------------------------------------
// Stage groups
// ---------------------------------------------------------------------------

interface StageGroup {
  stage: ScenarioStage
  entries: TimelineEntry[]
}

function groupByStage(entries: TimelineEntry[]): StageGroup[] {
  const map = new Map<ScenarioStage, TimelineEntry[]>()
  for (const entry of entries) {
    const list = map.get(entry.stage)
    if (list) {
      list.push(entry)
    } else {
      map.set(entry.stage, [entry])
    }
  }
  // Preserve insertion order (chronological by first appearance)
  return Array.from(map.entries()).map(([stage, items]) => ({
    stage,
    entries: items,
  }))
}

// ---------------------------------------------------------------------------
// Events hook — integration point for future tracks
// ---------------------------------------------------------------------------

/**
 * Read scenario events from the active scenario.
 *
 * Track 3: reads events from canvas store (hydrated from Supabase row on scenario load).
 * Falls back to empty array when events are absent or not yet loaded.
 */
function useJourneyEvents(): ScenarioEvent[] {
  const raw = useCanvasStore(s => s._hydratedEvents)
  if (!raw || !Array.isArray(raw)) return []
  return raw as ScenarioEvent[]
}

// ---------------------------------------------------------------------------
// Now clock — coarse 60s interval, only when Journey tab is visible
// ---------------------------------------------------------------------------

function useNowClock(active: boolean): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!active) return
    // Refresh immediately when becoming active
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [active])

  return now
}

// ---------------------------------------------------------------------------
// Event row
// ---------------------------------------------------------------------------

function JourneyEventRow({
  entry,
  now,
}: {
  entry: TimelineEntry
  now: Date
}) {
  const Icon = ICON_MAP[entry.icon] ?? Activity

  return (
    <li className="flex items-start gap-2 py-1" data-testid="journey-event-row">
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${entry.colour}`} aria-hidden="true" />
      <span className={`${typography.panelBody} text-text-body flex-1 min-w-0`}>
        {entry.headline}
      </span>
      <span className={`${typography.panelMeta} text-text-light shrink-0 whitespace-nowrap`}>
        {formatJourneyTime(entry.timestamp, now)}
      </span>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function JourneyTabBody() {
  const events = useJourneyEvents()
  const currentStage = useCanvasStore(s => s.currentStage)
  const prefersReducedMotion = usePrefersReducedMotion()
  const now = useNowClock(true)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  const entries = useMemo(() => renderTimeline(events), [events])
  const groups = useMemo(() => groupByStage(entries), [entries])
  const summary = useMemo(() => renderTimelineSummary(events), [events])

  // Determine which stage to expand by default
  const defaultExpandedStage = useMemo(() => {
    if (currentStage) return currentStage
    if (entries.length > 0) return entries[entries.length - 1].stage
    return null
  }, [currentStage, entries])

  // Track expanded state per stage
  const [expandedStages, setExpandedStages] = useState<Set<ScenarioStage>>(new Set())

  // Sync default expansion when stage changes
  useEffect(() => {
    if (defaultExpandedStage) {
      setExpandedStages(new Set([defaultExpandedStage]))
    }
  }, [defaultExpandedStage])

  const handleToggle = useCallback((stage: ScenarioStage, expanded: boolean) => {
    setExpandedStages(prev => {
      const next = new Set(prev)
      if (expanded) {
        next.add(stage)
      } else {
        next.delete(stage)
      }
      return next
    })
  }, [])

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (entries.length > prevCountRef.current && sentinelRef.current) {
      sentinelRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
    }
    prevCountRef.current = entries.length
  }, [entries.length, prefersReducedMotion])

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={Clock}
          title="No activity yet"
          description="Your decision journey will appear here as you work."
          testId="journey-empty-state"
        />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full"
      aria-label="Decision journey timeline"
      data-testid="journey-tab-body"
    >
      {/* Scrollable timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-3 py-3">
        {groups.map(group => (
          <Accordion
            key={group.stage}
            title={STAGE_LABELS[group.stage]}
            rightContent={
              <span className={`${typography.panelMeta} bg-transparent border border-panel-border rounded-full px-2 py-0.5 text-text-body`}>
                {group.entries.length} {group.entries.length === 1 ? 'action' : 'actions'}
              </span>
            }
            isExpanded={expandedStages.has(group.stage)}
            onExpandChange={(expanded) => handleToggle(group.stage, expanded)}
            testId={`journey-stage-${group.stage}`}
            className="border-panel-border"
          >
            <ol className="space-y-1 list-none p-0 m-0">
              {group.entries.map(entry => (
                <JourneyEventRow key={entry.id} entry={entry} now={now} />
              ))}
            </ol>
          </Accordion>
        ))}
        {/* Scroll sentinel */}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>

      {/* Summary footer */}
      <div
        className="sticky bottom-0 bg-panel border-t border-panel-border py-2 px-4"
        data-testid="journey-summary-footer"
      >
        <p className={`${typography.panelMeta} text-text-light truncate m-0`}>
          {summary}
        </p>
      </div>
    </div>
  )
}
