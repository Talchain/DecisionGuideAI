/**
 * InspectorGuidanceSection — Shows GuidanceItems relevant to the selected element.
 *
 * Renders inside NodeInspector (and optionally InspectorPanel for edges).
 * Max 2 items shown; "+N more" count shown when additional items exist.
 * Reacts to external activeGuidanceItemId for card highlighting.
 */

import { useRef, useCallback, useEffect, useMemo, memo } from 'react'
import { AlertTriangle, Lightbulb } from 'lucide-react'
import { typography } from '../../../styles/typography'
import {
  useGuidanceStore,
  type GuidanceItem,
  type GuidanceAction,
} from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'
import { scrollToField } from '../../conversation/utils/scrollToField'

const MAX_VISIBLE = 2
const FOCUS_DEBOUNCE_MS = 150

// ---------------------------------------------------------------------------
// Helpers
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

function cardBorderClass(category: GuidanceItem['category']): string {
  switch (category) {
    case 'must_fix':
    case 'should_fix':
      return 'border-l-danger'
    case 'could_fix':
    case 'technique':
      return 'border-l-info'
  }
}

function cardBgClass(category: GuidanceItem['category']): string {
  switch (category) {
    case 'must_fix':
    case 'should_fix':
      return 'bg-panel'
    case 'could_fix':
    case 'technique':
      return 'bg-panel'
  }
}

function cardIcon(category: GuidanceItem['category']) {
  switch (category) {
    case 'must_fix':
    case 'should_fix':
      return <AlertTriangle size={12} className="flex-shrink-0 mt-0.5 text-danger" aria-hidden="true" />
    case 'could_fix':
    case 'technique':
      return <Lightbulb size={12} className="flex-shrink-0 mt-0.5 text-info" aria-hidden="true" />
  }
}

// ---------------------------------------------------------------------------
// Single guidance card
// ---------------------------------------------------------------------------

interface GuidanceCardProps {
  item: GuidanceItem
  isActive: boolean
  onAction: (item: GuidanceItem) => void
  onSetActive: (id: string | null) => void
}

const GuidanceCard = memo(function GuidanceCard({
  item,
  isActive,
  onAction,
  onSetActive,
}: GuidanceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Highlight when activated externally — scroll card into view
  useEffect(() => {
    if (isActive && cardRef.current && typeof cardRef.current.scrollIntoView === 'function') {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isActive])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      onSetActive(item.item_id)
    }, FOCUS_DEBOUNCE_MS)
  }, [item.item_id, onSetActive])

  const handleMouseLeave = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    onSetActive(null)
  }, [onSetActive])

  const handleFocus = useCallback(() => {
    onSetActive(item.item_id)
  }, [item.item_id, onSetActive])

  const handleBlur = useCallback(() => {
    onSetActive(null)
  }, [onSetActive])

  return (
    <div
      ref={cardRef}
      className={`
        flex items-start gap-2 p-2 rounded border-l-4
        ${cardBorderClass(item.category)}
        ${isActive ? `${cardBgClass(item.category)} ring-1 ring-info/40` : 'bg-panel border border-panel-border border-l-4'}
        transition-colors
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
      role="article"
      aria-label={item.title}
      data-testid="inspector-guidance-card"
      data-item-id={item.item_id}
    >
      {cardIcon(item.category)}
      <div className="flex-1 min-w-0">
        <p className={`${typography.panelBody} text-text-body font-medium leading-snug`}>
          {item.title}
        </p>
        {item.detail && (
          <p
            className={`${typography.panelMeta} text-text-light mt-0.5`}
            style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}
          >
            {item.detail}
          </p>
        )}
        <button
          type="button"
          className={`mt-1.5 px-3 py-1 min-h-[44px] min-w-[44px] ${typography.panelMeta} text-info border border-info/30 rounded bg-transparent hover:bg-info-light transition-colors cursor-pointer`}
          onClick={() => onAction(item)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-label={`${actionLabel(item.primary_action)}: ${item.title}`}
        >
          {actionLabel(item.primary_action)}
        </button>
      </div>
    </div>
  )
})

GuidanceCard.displayName = 'GuidanceCard'

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

interface InspectorGuidanceSectionProps {
  /** The ID of the selected node or edge */
  elementId: string
  /** Send a message to the conversation panel */
  onSendMessage?: (text: string) => void
  /** Open inspector for a different node */
  onOpenInspector?: (nodeId: string) => void
  /** Scroll to a patch block in the conversation */
  onScrollToPatch?: (patchId: string) => void
}

export const InspectorGuidanceSection = memo(function InspectorGuidanceSection({
  elementId,
  onSendMessage,
  onOpenInspector,
  onScrollToPatch,
}: InspectorGuidanceSectionProps) {
  // Subscribe to the raw array (stable reference from Zustand) then derive locally.
  // Avoids the "getSnapshot should be cached" infinite loop from inline selectors
  // that return new arrays on every render.
  const allItems = useGuidanceStore((s) => s.guidanceItems)
  const activeId = useGuidanceStore((s) => s.activeGuidanceItemId)
  const setActiveGuidanceItem = useGuidanceStore((s) => s.setActiveGuidanceItem)

  // Sort by priority descending, show max 2
  const sorted = useMemo(
    () =>
      allItems
        .filter((i) => i.target_object?.id === elementId)
        .sort((a, b) => b.priority - a.priority),
    [allItems, elementId],
  )
  const visible = sorted.slice(0, MAX_VISIBLE)
  const extraCount = sorted.length - MAX_VISIBLE

  // Fall back to store-registered callbacks when props are absent.
  // This lets inspectors (mounted outside the conversation tree) trigger
  // conversation actions without prop drilling through InspectorModal.
  const handleAction = useCallback((item: GuidanceItem) => {
    const action = item.primary_action
    setActiveGuidanceItem(item.item_id)

    const storeState = useGuidanceStore.getState()
    const sendMsg = onSendMessage ?? storeState._sendMessage ?? undefined
    const scrollPatch = onScrollToPatch ?? storeState._scrollToPatch ?? undefined

    switch (action.type) {
      case 'discuss':
        sendMsg?.(action.prompt)
        break
      case 'run_exercise':
        sendMsg?.(`/exercise ${action.exercise}`)
        break
      case 'open_inspector':
        // Task 3: Store deep-link field target before opening inspector
        if (action.field) {
          useGuidanceStore.setState({ inspectorDeepLinkField: action.field })
        }
        if (onOpenInspector) {
          onOpenInspector(action.node_id)
        } else {
          // Fallback: inspector is already open — just select the target node
          useCanvasStore.getState().selectNodeWithoutHistory(action.node_id)
          useCanvasStore.getState().setShowInspectorPanel(true)
        }
        if (action.field) {
          scrollToField(action.field)
        }
        break
      case 'approve_patch': {
        const patchId = (action.operations[0] as any)?.patch_id ?? item.item_id
        scrollPatch?.(patchId)
        break
      }
      case 'navigate':
        if (action.target.startsWith('#') || action.target.startsWith('/')) {
          window.location.hash = action.target
        }
        break
    }
  }, [setActiveGuidanceItem, onSendMessage, onOpenInspector, onScrollToPatch])

  // Don't render the section at all when there are no guidance items
  if (visible.length === 0) return null

  return (
    <div className="mt-3 pt-2 border-t border-panel-border" data-testid="inspector-guidance-section">
      <p className={`${typography.panelMeta} font-medium text-text-body mb-2`}>Suggestions</p>

      <div className="space-y-2">
        {visible.map((item) => (
          <GuidanceCard
            key={item.item_id}
            item={item}
            isActive={activeId === item.item_id}
            onAction={handleAction}
            onSetActive={setActiveGuidanceItem}
          />
        ))}
        {extraCount > 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>
            +{extraCount} more suggestion{extraCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
})

InspectorGuidanceSection.displayName = 'InspectorGuidanceSection'
