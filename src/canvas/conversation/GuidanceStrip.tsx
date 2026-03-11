/**
 * GuidanceStrip — Next best step strip above the chat input
 *
 * Shows the single highest-priority GuidanceItem. Dismissible per-item.
 * Compact (40-48px) flex row with category badge, title, and action button.
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { X as XIcon, AlertTriangle, Lightbulb } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useGuidanceStore, selectTopItem, type GuidanceItem, type GuidanceAction } from '../stores/guidanceStore'
import styles from './Conversation.module.css'
import { trackGuidance, type GuidanceEventPayload } from '../../telemetry/guidanceEvents'
import { useCanvasStore } from '../store'
import { scrollToField } from './utils/scrollToField'
import { beginInteractionChain } from '../../lib/debug-state'

const FOCUS_DEBOUNCE_MS = 150

// ---------------------------------------------------------------------------
// Category badge helpers
// ---------------------------------------------------------------------------

function categoryLabel(cat: GuidanceItem['category']): string {
  switch (cat) {
    case 'must_fix': return 'Must fix'
    case 'should_fix': return 'Should fix'
    case 'could_fix': return 'Could fix'
    case 'technique': return 'Technique'
  }
}

function categoryBadgeClass(cat: GuidanceItem['category']): string {
  switch (cat) {
    case 'must_fix': return styles.guidanceBadgeDanger
    case 'should_fix': return styles.guidanceBadgeInfo
    case 'could_fix': return styles.guidanceBadgeInfoLight
    case 'technique': return styles.guidanceBadgeOptionLight
  }
}

function categoryIcon(cat: GuidanceItem['category']) {
  switch (cat) {
    case 'must_fix':
    case 'should_fix':
      return <AlertTriangle size={11} aria-hidden="true" />
    case 'could_fix':
    case 'technique':
      return <Lightbulb size={11} aria-hidden="true" />
  }
}

// ---------------------------------------------------------------------------
// Action button label
// ---------------------------------------------------------------------------

function actionLabel(action: GuidanceAction): string {
  switch (action.type) {
    case 'open_inspector': return 'View'
    case 'discuss': return 'Discuss'
    case 'run_exercise': return 'Try it'
    case 'approve_patch': return 'Review'
    case 'navigate': return 'Go to'
  }
}

// ---------------------------------------------------------------------------
// Telemetry helpers
// ---------------------------------------------------------------------------

function coachingItemType(cat: GuidanceItem['category']): GuidanceEventPayload['item_type'] {
  switch (cat) {
    case 'must_fix':
    case 'should_fix':
      return 'bias_alert'
    case 'could_fix':
    case 'technique':
      return 'technique_rec'
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GuidanceStripProps {
  /** Send a message to the conversation */
  onSendMessage: (text: string) => void
  /** Set active guidance item ID for cross-surface focus */
  onSetActive: (id: string | null) => void
  /** Scroll conversation list to a GraphPatchBlock by patch_id */
  onScrollToPatch: (patchId: string) => void
  /** Open inspector for a node */
  onOpenInspector: (nodeId: string) => void
}

export const GuidanceStrip = memo(function GuidanceStrip({
  onSendMessage,
  onSetActive,
  onScrollToPatch,
  onOpenInspector,
}: GuidanceStripProps) {
  const topItem = useGuidanceStore(selectTopItem)
  // Track the items array reference — when a new envelope arrives, the reference
  // changes and we should allow previously-dismissed items to show again.
  const guidanceItems = useGuidanceStore((s) => s.guidanceItems)

  // Track dismissed item_id in component state — cleared on each new envelope
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const prevItemsRef = useRef(guidanceItems)
  useEffect(() => {
    if (guidanceItems !== prevItemsRef.current) {
      prevItemsRef.current = guidanceItems
      setDismissedId(null)
    }
  }, [guidanceItems])

  // Telemetry: deduplicate COACHING_SHOWN — fire once per item_id per session
  const shownIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!topItem || topItem.item_id === dismissedId) return
    if (shownIdsRef.current.has(topItem.item_id)) return
    shownIdsRef.current.add(topItem.item_id)
    const state = useCanvasStore.getState()
    trackGuidance('COACHING_SHOWN', {
      item_id: topItem.item_id,
      item_type: coachingItemType(topItem.category),
      surface: 'guidance_panel',
      scenario_id: state.currentScenarioId ?? undefined,
      profile_stage: (state.currentStage ?? undefined) as GuidanceEventPayload['profile_stage'] | undefined,
    })
  }, [topItem, dismissedId])

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    if (!topItem || topItem.item_id === dismissedId) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      onSetActive(topItem.item_id)
    }, FOCUS_DEBOUNCE_MS)
  }, [topItem, dismissedId, onSetActive])

  const handleMouseLeave = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    onSetActive(null)
  }, [onSetActive])

  const handleFocus = useCallback(() => {
    if (!topItem || topItem.item_id === dismissedId) return
    onSetActive(topItem.item_id)
  }, [topItem, dismissedId, onSetActive])

  const handleBlur = useCallback(() => {
    onSetActive(null)
  }, [onSetActive])

  const handleDismiss = useCallback(() => {
    if (!topItem) return
    const state = useCanvasStore.getState()
    trackGuidance('COACHING_DISMISSED', {
      item_id: topItem.item_id,
      item_type: coachingItemType(topItem.category),
      surface: 'guidance_panel',
      scenario_id: state.currentScenarioId ?? undefined,
      profile_stage: (state.currentStage ?? undefined) as GuidanceEventPayload['profile_stage'] | undefined,
    })
    setDismissedId(topItem.item_id)
    onSetActive(null)
  }, [topItem, onSetActive])

  const handleAction = useCallback(() => {
    if (!topItem) return
    const action = topItem.primary_action
    const state = useCanvasStore.getState()
    trackGuidance('COACHING_CLICKED', {
      item_id: topItem.item_id,
      item_type: coachingItemType(topItem.category),
      surface: 'guidance_panel',
      scenario_id: state.currentScenarioId ?? undefined,
      profile_stage: (state.currentStage ?? undefined) as GuidanceEventPayload['profile_stage'] | undefined,
    })
    onSetActive(topItem.item_id)

    switch (action.type) {
      case 'open_inspector':
        // Task 3: Store deep-link field target before opening inspector
        if (action.field) {
          useGuidanceStore.setState({ inspectorDeepLinkField: action.field })
        }
        onOpenInspector(action.node_id)
        if (action.field) {
          scrollToField(action.field)
        }
        break
      case 'discuss':
        beginInteractionChain({
          triggerSurface: 'discuss_button',
          sourceSurface: 'ai_panel',
          initiatedBy: 'user',
          visibleTextSubmitted: action.prompt,
          submittedText: action.prompt,
          scenarioId: state.currentScenarioId ?? null,
          stagePill: state.currentStage ?? null,
          setPending: true,
        })
        onSendMessage(action.prompt)
        break
      case 'run_exercise':
        onSendMessage(`/exercise ${action.exercise}`)
        break
      case 'approve_patch': {
        // Scroll to matching GraphPatchBlock in conversation
        const patchOps = action.operations
        // Try to find a patch_id from operations metadata if present
        const patchId = (patchOps[0] as any)?.patch_id ?? topItem.item_id
        onScrollToPatch(patchId)
        break
      }
      case 'navigate':
        // Best-effort string interpretation
        if (action.target.startsWith('#') || action.target.startsWith('/')) {
          window.location.hash = action.target
        }
        break
    }
  }, [topItem, onSetActive, onOpenInspector, onSendMessage, onScrollToPatch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // Don't render if no items or current top item is dismissed
  if (!topItem || topItem.item_id === dismissedId) return null

  return (
    <div
      className={styles.guidanceStrip}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="guidance-strip"
      data-item-id={topItem.item_id}
      data-severity={topItem.category}
    >
      {/* Category badge */}
      <span className={`${styles.guidanceBadge} ${categoryBadgeClass(topItem.category)}`}>
        {categoryIcon(topItem.category)}
        <span>{categoryLabel(topItem.category)}</span>
      </span>

      {/* Title — truncated */}
      <span className={`${styles.guidanceStripTitle} ${typography.panelBody}`}>
        {topItem.title}
      </span>

      {/* Action button */}
      <button
        type="button"
        className={styles.guidanceStripAction}
        onClick={handleAction}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label={`${actionLabel(topItem.primary_action)}: ${topItem.title}`}
      >
        {actionLabel(topItem.primary_action)}
      </button>

      {/* Dismiss button */}
      <button
        type="button"
        className={styles.guidanceStripDismiss}
        onClick={handleDismiss}
        aria-label="Dismiss suggestion"
      >
        <XIcon size={14} aria-hidden="true" />
      </button>
    </div>
  )
})

GuidanceStrip.displayName = 'GuidanceStrip'
