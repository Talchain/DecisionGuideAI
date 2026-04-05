/**
 * ModelTabHeader — summary stats bar.
 * Wraps children in DetailToggleContext.Provider.
 * Expert mode toggle lives in OutputsDock.
 */
import type { ReactNode } from 'react'
import { typography } from '../../../styles/typography'
import { DetailToggleContext } from './DetailToggleContext'

interface ModelTabHeaderProps {
  factorCount: number
  edgeCount: number
  fragileCount?: number
  contestedCount?: number
  sortNote?: string
  showDetail: boolean
  children: ReactNode
}

export function ModelTabHeader({
  factorCount, edgeCount, fragileCount, contestedCount, sortNote, showDetail, children,
}: ModelTabHeaderProps) {
  return (
    <DetailToggleContext.Provider value={{ showDetail }}>
      <div className="flex items-center gap-3 flex-wrap mb-3 px-0.5">
        <span className={`${typography.panelMeta} text-text-light`}>
          {factorCount} factor{factorCount !== 1 ? 's' : ''}
          {' · '}
          {edgeCount} relationship{edgeCount !== 1 ? 's' : ''}
          {fragileCount !== undefined && fragileCount > 0 && (
            <span className="text-warning"> · {fragileCount} fragile</span>
          )}
          {contestedCount !== undefined && contestedCount > 0 && (
            <span className="text-info" data-testid="header-contested-count"> · {contestedCount} contested</span>
          )}
          {showDetail && (
            <span className="text-info" data-testid="header-expert-indicator"> · expert</span>
          )}
        </span>
        {sortNote && (
          <span className={`${typography.panelMeta} text-text-light`} data-testid="header-sort-note">
            {sortNote}
          </span>
        )}
      </div>
      <div className={showDetail ? 'border-t-2 border-info/40 pt-3' : ''}>
        {children}
      </div>
    </DetailToggleContext.Provider>
  )
}
