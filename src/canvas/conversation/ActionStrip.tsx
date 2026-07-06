/**
 * ActionStrip — ambient awareness bar at the top of the conversation panel
 *
 * Shows top guidance item, contextual navigation CTA, and analysis state badge.
 * Single-line, hidden when there's nothing meaningful to display.
 */

import { useMemo, useCallback } from 'react'
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { selectConversationStatus } from './selectors'
import type { ConversationStatusInput, CtaKind } from './selectors'
import type { ConversationMessage } from './types'
import type { PatchBlockState } from './useConversation'
import type { GraphPatchBlock } from './types'
import styles from './Conversation.module.css'

// ---------------------------------------------------------------------------
// Category pill styling (matches existing guidance badge pattern)
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, string> = {
  must_fix: styles.guidanceBadgeDanger,
  should_fix: styles.guidanceBadgeInfo,
  could_fix: styles.guidanceBadgeInfoLight,
  technique: styles.guidanceBadgeOptionLight,
}

// ---------------------------------------------------------------------------
// CTA labels
// ---------------------------------------------------------------------------

const CTA_LABELS: Record<NonNullable<CtaKind>, string> = {
  view_issues: 'View model issues',
  review_patch: 'Review suggestion',
  view_results: 'View results',
  view_brief: 'View brief',
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export type NavigateTarget = 'guidance' | 'patch' | 'results' | 'brief'

function resolveNavigateTarget(ctaKind: CtaKind): NavigateTarget | null {
  switch (ctaKind) {
    case 'view_issues': return 'guidance'
    case 'review_patch': return 'patch'
    case 'view_results': return 'results'
    case 'view_brief': return 'brief'
    default: return null
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActionStripProps {
  messages: ConversationMessage[]
  patchBlockStates: Map<string, PatchBlockState>
  onNavigate?: (target: NavigateTarget) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionStrip({ messages, patchBlockStates, onNavigate }: ActionStripProps) {
  // Store subscriptions — stable primitive references from authoritative store
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const resultsStatus = useCanvasStore((s) => s.results.status)
  const hasCompletedFirstRun = useCanvasStore((s) => s.hasCompletedFirstRun)
  // Freshness comes from the CEE slice + local dirty overlay (the shared display
  // semantic), NOT the dead/local `graphEditedSinceLastRun` flag — so the
  // "Results outdated" badge stays in sync with the rest of the analysis trust
  // surface and never independently fabricates stale.
  const analysisFreshness = useCanvasStore((s) => s.analysisFreshness)
  const analysisFreshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const guidanceItems = useGuidanceStore((s) => s.guidanceItems)
  const activeGuidanceItemId = useGuidanceStore((s) => s.activeGuidanceItemId)

  // Build input bag for the pure selector
  const input: ConversationStatusInput = useMemo(() => ({
    nodeCount,
    resultsStatus,
    hasCompletedFirstRun,
    analysisFreshness,
    analysisFreshnessDirty,
    guidance: { guidanceItems, activeGuidanceItemId, inspectorDeepLinkField: null, _sendMessage: null, _scrollToPatch: null, _runAnalysis: null, _sendChip: null, _prefillChat: null, _dispatchAction: null, _registrationToken: null },
    messages,
    patchBlockStates,
  }), [nodeCount, resultsStatus, hasCompletedFirstRun, analysisFreshness, analysisFreshnessDirty, guidanceItems, activeGuidanceItemId, messages, patchBlockStates])

  const { status, topGuidanceItem, guidanceCount, ctaKind } = useMemo(
    () => selectConversationStatus(input),
    [input],
  )

  const handleCtaClick = useCallback(() => {
    const target = resolveNavigateTarget(ctaKind)
    if (target) onNavigate?.(target)
  }, [ctaKind, onNavigate])

  const handleTopItemClick = useCallback(() => {
    onNavigate?.('guidance')
  }, [onNavigate])

  // Hide strip when nothing to show
  if (!topGuidanceItem && status === 'empty') return null
  if (!topGuidanceItem && status === 'framing') return null
  if (!topGuidanceItem && status === 'graph_ready' && guidanceCount === 0) return null

  // State badge content
  let badgeText: string | null = null
  let badgeClass = ''
  if (status === 'analysis_running') {
    badgeText = 'Analysing\u2026'
    badgeClass = styles.actionStripBadgeInfo
  } else if (status === 'analysis_ready') {
    badgeText = 'Results ready'
    badgeClass = styles.actionStripBadgeSuccess
  } else if (status === 'analysis_stale') {
    badgeText = 'Results outdated'
    badgeClass = styles.actionStripBadgeWarning
  } else if (status === 'brief_ready') {
    badgeText = 'Brief ready'
    badgeClass = styles.actionStripBadgeSuccess
  }

  return (
    <div className={styles.actionStrip} data-testid="action-strip">
      {/* Left: top guidance item */}
      <button
        type="button"
        className={styles.actionStripLeft}
        onClick={handleTopItemClick}
        data-testid="action-strip-top-item"
        disabled={!topGuidanceItem}
      >
        {topGuidanceItem && (
          <>
            <span className={CATEGORY_STYLES[topGuidanceItem.category] ?? styles.guidanceBadgeInfo}>
              {topGuidanceItem.category.replace('_', ' ')}
            </span>
            <span className={styles.actionStripTitle}>
              {topGuidanceItem.title}
            </span>
            {guidanceCount > 1 && (
              <span className={styles.actionStripCount} data-testid="action-strip-count">
                {guidanceCount} items
              </span>
            )}
          </>
        )}
      </button>

      {/* Centre-right: navigation CTA */}
      {ctaKind && (
        <button
          type="button"
          className={styles.actionStripCta}
          onClick={handleCtaClick}
          data-testid="action-strip-cta"
        >
          {CTA_LABELS[ctaKind]}
        </button>
      )}

      {/* Right: state badge */}
      {badgeText && (
        <span className={`${styles.actionStripBadge} ${badgeClass}`} data-testid="action-strip-badge">
          {badgeText}
        </span>
      )}
    </div>
  )
}
