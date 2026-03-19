/**
 * ModelTabHeader — "Show full detail" toggle + summary stats.
 *
 * Wraps children in DetailToggleContext.Provider so all section components
 * can read showDetail without prop drilling.
 *
 * Shows: title "Model" + summary stats line (factor count, edge count).
 * Toggle: "Show full detail" checkbox — expands scientific details in all sections.
 */

import { useState, type ReactNode } from 'react'
import { typography } from '../../../styles/typography'
import { DetailToggleContext } from './DetailToggleContext'

interface ModelTabHeaderProps {
  factorCount: number
  edgeCount: number
  fragileCount?: number
  children: ReactNode
}

export function ModelTabHeader({
  factorCount,
  edgeCount,
  fragileCount,
  children,
}: ModelTabHeaderProps) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <DetailToggleContext.Provider value={{ showDetail }}>
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 mb-3 px-0.5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`${typography.panelMeta} text-text-light`}>
            {factorCount} factor{factorCount !== 1 ? 's' : ''}
            {' · '}
            {edgeCount} relationship{edgeCount !== 1 ? 's' : ''}
            {fragileCount !== undefined && fragileCount > 0 && (
              <span className="text-warning"> · {fragileCount} fragile</span>
            )}
          </span>
        </div>

        {/* Show full detail toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDetail}
            onChange={e => setShowDetail(e.target.checked)}
            className="w-3 h-3 accent-info"
            data-testid="model-tab-show-detail-toggle"
          />
          <span className={`${typography.panelMeta} text-text-light`}>Show full detail</span>
        </label>
      </div>

      {children}
    </DetailToggleContext.Provider>
  )
}
