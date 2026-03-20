/**
 * AttentionBanner — post-analysis warning strip.
 *
 * Shows counts of: truly missing sources, AI-estimated factors, fragile edges.
 * Links to the Strengthen section for remediation.
 */

import { AlertTriangle } from 'lucide-react'
import { typography } from '../../../styles/typography'

interface AttentionBannerProps {
  factorsTrulyMissingSource: number
  factorsAiEstimated: number
  fragileEdgeCount: number
}

export function AttentionBanner({
  factorsTrulyMissingSource,
  factorsAiEstimated,
  fragileEdgeCount,
}: AttentionBannerProps) {
  const show = factorsTrulyMissingSource > 0 || factorsAiEstimated > 0 || fragileEdgeCount > 0
  if (!show) return null

  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded-sm bg-warning/[0.08] border border-warning/[0.18]"
      data-testid="model-attention-banner"
    >
      <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className={`${typography.panelBody} text-text-body`}>
          {[
            factorsTrulyMissingSource > 0
              ? `${factorsTrulyMissingSource} factor${factorsTrulyMissingSource !== 1 ? 's' : ''} missing source`
              : null,
            factorsAiEstimated > 0
              ? `${factorsAiEstimated} AI-estimated`
              : null,
            fragileEdgeCount > 0
              ? `${fragileEdgeCount} fragile edge${fragileEdgeCount !== 1 ? 's' : ''}`
              : null,
          ].filter(Boolean).join(' · ')}
        </div>
        <a
          href="#strengthen"
          className={`${typography.panelMeta} text-info hover:underline`}
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('model-strengthen')?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          Review in Strengthen ↓
        </a>
      </div>
    </div>
  )
}
