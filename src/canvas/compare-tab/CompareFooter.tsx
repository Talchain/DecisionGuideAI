import { RefreshCw } from 'lucide-react'
import { typography } from '../../styles/typography'
import { focusNodeById } from '../utils/focusHelpers'
import { useUIStore } from '../../stores/uiStore'
import type { AnalysisSnapshot, CompareState } from './types'

interface CompareFooterProps {
  state: CompareState
  latestSnapshot: AnalysisSnapshot | null
  onRunAnalysis: () => void
  onSwitchToResults: () => void
}

const CTA_CONFIG: Record<CompareState, { label: string; icon: boolean }> = {
  stale: { label: 'Rerun analysis', icon: true },
  noWinner: { label: 'Review top uncertainty', icon: false },
  // ROADMAP 2.835 — the run named no leading option. The CTA must not imply
  // one either, so it takes `noWinner`'s uncertainty-first wording rather than
  // "Review what changed" (there is no leader change to review) or "View in
  // Analysis" (which reads as "go and see the result"). The focus handler
  // below treats it the same way, for the same reason.
  unclaimed: { label: 'Review top uncertainty', icon: false },
  flipped: { label: 'Review what changed', icon: false },
  converged: { label: 'View in Analysis', icon: false },
  improving: { label: 'View in Analysis', icon: false },
}

export function CompareFooter({ state, latestSnapshot, onRunAnalysis, onSwitchToResults }: CompareFooterProps) {
  const cta = CTA_CONFIG[state]

  const handlePrimary = () => {
    if (state === 'stale') {
      onRunAnalysis()
      return
    }

    // Switch to Analysis tab first
    useUIStore.getState().setActiveOutputTab('results')

    // State-specific focus after tab switch
    if ((state === 'noWinner' || state === 'unclaimed') && latestSnapshot?.topCalibrationFactorId) {
      setTimeout(() => focusNodeById(latestSnapshot.topCalibrationFactorId), 150)
      // ROADMAP 2.835: `winnerId` is read here and ONLY here, and only on
      // 'flipped' — which the state machine grants only when both runs NAMED a
      // leader, so the id belongs to a producer-entitled claim. This is a
      // FOCUS action, not an assertion: `decisionVerdict`'s doctrine keeps
      // identity working for non-claiming consumers even where entitlement is
      // withheld. Any code here that wanted to SAY something about the leader
      // would need `deriveLeaderClaim` instead.
    } else if (state === 'flipped' && latestSnapshot?.winnerId) {
      setTimeout(() => focusNodeById(latestSnapshot.winnerId), 150)
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-panel-border">
      <button
        onClick={handlePrimary}
        className={`${typography.panelBody} font-semibold inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-text-on-color border-none cursor-pointer hover:opacity-90 transition-opacity shadow-sm`}
      >
        {cta.icon && <RefreshCw size={13} />}
        {cta.label}
      </button>
      {state === 'stale' && (
        <button
          onClick={onSwitchToResults}
          className={`${typography.panelBody} font-medium inline-flex items-center px-3 py-1.5 rounded-full border border-panel-border bg-transparent text-text-body cursor-pointer hover:bg-panel-hover transition-colors`}
        >
          View in Analysis →
        </button>
      )}
    </div>
  )
}
