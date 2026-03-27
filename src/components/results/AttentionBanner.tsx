/**
 * AttentionBanner — top-of-results coaching banner for critique items.
 *
 * Displays humanised critique messages with progressive disclosure:
 * - 0 items: not rendered
 * - 1 item: inline (no collapse)
 * - 2–3 items: collapsed by default with "[count] items to review" + chevron
 * - 4+ items: collapsed with count + chevron
 *
 * Design: border-danger/30 (no fill), AlertTriangle icon, coaching tone.
 * Each expanded item: humanised title + description + optional GraphLink CTA.
 */

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import type { HumanisedCritique } from './utils/humaniseCritique'

export interface AttentionBannerProps {
  /** Humanised critique items */
  items: HumanisedCritique[]
  /** Callback to focus a node on canvas */
  onFocusNode?: (nodeId: string) => void
}

function BannerItem({
  item,
  onFocusNode,
}: {
  item: HumanisedCritique
  onFocusNode?: (nodeId: string) => void
}) {
  const handleFocus = () => {
    if (!item.factorId) return
    if (onFocusNode) onFocusNode(item.factorId)
    else focusNodeById(item.factorId)
  }

  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="flex-1 min-w-0">
        <p className={`${typography.panelBody} text-text-header`}>
          {item.displayText}
        </p>
        <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
          {item.description}
        </p>
        {item.suggestion && item.factorId && (
          <button
            type="button"
            onClick={handleFocus}
            className={`${typography.panelMeta} text-info hover:underline mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 rounded`}
          >
            {item.suggestion}
          </button>
        )}
        {item.suggestion && !item.factorId && (
          <p className={`${typography.panelMeta} text-text-light italic mt-0.5`}>
            {item.suggestion}
          </p>
        )}
      </div>
    </div>
  )
}

/** Runtime guard patterns to reject internal field leaks (defence in depth) */
const INTERNAL_LEAK_PATTERNS = [
  /constraint_[a-z_]+/i,   // any constraint internal ID (V16.2: broadened from constraint_fac_ only)
  /observed_state\./i,
  /intercept\s*=/i,
  /fac_[a-z_]+/,           // raw factor IDs (V12.2: broadened to catch all patterns)
  /blocks_analysis/i,
  /node_id\s*=/i,
  /edge_id\s*=/i,
  /opt_[a-z_]+/i,          // raw option IDs
  /goal_[a-z_]+/i,         // raw goal IDs
  /compared as-is by ISL/i, // V16.2: ISL comparison fallback message
  /no derivable range/i,    // V16.2: ISL range resolution message
]

export function AttentionBanner({ items, onFocusNode }: AttentionBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Defence in depth: reject items without displayText or with internal pattern leaks
  const safeItems = items.filter(item => {
    if (!item.displayText) return false // V14.3: displayText is the only render path
    const text = `${item.displayText} ${item.description ?? ''} ${item.suggestion ?? ''}`
    return !INTERNAL_LEAK_PATTERNS.some(p => p.test(text))
  })

  if (safeItems.length === 0) return null

  // 1 item: inline, no collapse
  if (safeItems.length === 1) {
    return (
      <div
        className="p-3 border border-danger/30 rounded-lg"
        data-testid="attention-banner"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className={`${typography.panelBody} text-text-header`}>
              {safeItems[0].displayText}
            </p>
            <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
              {safeItems[0].description}
            </p>
            {safeItems[0].suggestion && safeItems[0].factorId && (
              <button
                type="button"
                onClick={() => {
                  if (onFocusNode) onFocusNode(safeItems[0].factorId!)
                  else focusNodeById(safeItems[0].factorId!)
                }}
                className={`${typography.panelMeta} text-info hover:underline mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 rounded`}
              >
                {safeItems[0].suggestion}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 2 items: collapsible (all behind toggle)
  if (safeItems.length === 2) {
    return (
      <div
        className="p-3 border border-danger/30 rounded-lg"
        data-testid="attention-banner"
      >
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left"
          aria-expanded={isExpanded}
        >
          <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
          <span className={`${typography.panelBody} text-text-header flex-1`}>
            A few inputs would sharpen these results
          </span>
          <span className={`${typography.panelMeta} text-text-light flex-shrink-0`}>
            {safeItems.length} items to review
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-light flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-light flex-shrink-0" />
          )}
        </button>

        {isExpanded && (
          <div className="mt-2 pl-6 space-y-1 border-t border-panel-border pt-2">
            {safeItems.map((item, idx) => (
              <BannerItem
                key={item.factorId ?? `critique-${idx}`}
                item={item}
                onFocusNode={onFocusNode}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // 3+ items: first inline, rest collapsed behind "and N more"
  const [first, ...rest] = safeItems

  return (
    <div
      className="p-3 border border-danger/30 rounded-lg"
      data-testid="attention-banner"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className={`${typography.panelBody} text-text-header`}>
            {first.displayText}
          </p>
          <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
            {first.description}
          </p>
          {first.suggestion && first.factorId && (
            <button
              type="button"
              onClick={() => {
                if (onFocusNode) onFocusNode(first.factorId!)
                else focusNodeById(first.factorId!)
              }}
              className={`${typography.panelMeta} text-info hover:underline mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 rounded`}
            >
              {first.suggestion}
            </button>
          )}
          {first.suggestion && !first.factorId && (
            <p className={`${typography.panelMeta} text-text-light italic mt-0.5`}>
              {first.suggestion}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 mt-2 pl-6"
        aria-expanded={isExpanded}
        data-testid="banner-show-more"
      >
        <span className={`${typography.panelMeta} text-info hover:underline`}>
          and {rest.length} more
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-info flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-info flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 pl-6 space-y-1 border-t border-panel-border pt-2">
          {rest.map((item, idx) => (
            <BannerItem
              key={item.factorId ?? `critique-${idx}`}
              item={item}
              onFocusNode={onFocusNode}
            />
          ))}
        </div>
      )}
    </div>
  )
}
