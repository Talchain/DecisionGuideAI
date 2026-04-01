/**
 * FromBrief — Subgroup 4: Factors confirmed from the user's brief. Collapsed by default.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Pill } from '../primitives'
import { typography } from '@/styles/typography'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'

interface FromBriefProps {
  items: ImprovementItem[]
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

export function FromBrief({ items, onFocusNode, onHoverEnter, onHoverLeave }: FromBriefProps) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left cursor-pointer py-0.5"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-text-light" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-light" />
        )}
        <span className={`${typography.panelMeta} text-text-light`}>
          {expanded ? 'Hide' : `Show ${items.length} confirmed values`}
        </span>
      </button>
      {expanded && items.map(item => (
        <div key={item.key} className="flex items-center gap-2 py-0.5 px-1">
          <button
            type="button"
            onClick={() => item.focus?.id && onFocusNode?.(item.focus.id)}
            onMouseEnter={() => item.focus?.id && onHoverEnter?.('node', item.focus.id)}
            onMouseLeave={() => onHoverLeave?.()}
            className={`${typography.panelBody} text-info hover:underline cursor-pointer text-left truncate flex-1 min-w-0`}
            title={item.label}
          >
            {item.label}
          </button>
          {item.rawValue != null && (
            <span className={`${typography.panelMeta} text-text-light shrink-0`}>
              {item.unit ? `${item.rawValue} ${item.unit}` : String(item.rawValue)}
            </span>
          )}
          <Pill size="small" variant="success">From brief</Pill>
        </div>
      ))}
    </div>
  )
}
