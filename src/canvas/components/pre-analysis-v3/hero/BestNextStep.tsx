/**
 * BestNextStep — renders the deterministic ladder step with its one action.
 */

import { memo } from 'react'
import { ArrowRight } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '../../../../styles/typography'
import { PANEL_COPY } from '../constants'
import { PanelIconButton } from '../ui/PanelIconButton'
import type { LadderStep } from '../types'

interface BestNextStepProps {
  ladder: LadderStep
  onAct: (step: LadderStep) => void
}

export const BestNextStep = memo(function BestNextStep({ ladder, onAct }: BestNextStepProps) {
  return (
    <div className="mt-4 flex items-center gap-2.5 border-t border-panel-border pt-4">
      <div className="min-w-0">
        <div className={`${typography.panelMeta} tracking-wide text-text-light`}>
          {PANEL_COPY.bestNextStep}
        </div>
        <div
          className={`${typography.panelBody} mt-0.5 font-semibold text-text-header`}
          data-testid="pre-analysis-v3-next-step"
        >
          {ladder.copy}
        </div>
      </div>
      <Tooltip content={ladder.copy}>
        <PanelIconButton
          variant="go"
          className="ml-auto"
          aria-label="Act on best next step"
          onClick={() => onAct(ladder)}
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </PanelIconButton>
      </Tooltip>
    </div>
  )
})
