/**
 * SignalRow — one signal-backed coaching item: entity shape (what it is),
 * copy (trigger, method, action), an info rationale on hover and focus, and
 * one ask-Olumi spark. Resolved rows are quiet confirmations: greyed copy,
 * success check, actions hidden.
 *
 * Info affordances stay visible at reduced emphasis (the prototype's
 * hover-only reveal fails touch and discoverability) and strengthen on
 * hover/focus.
 */

import { memo } from 'react'
import { Check, Info, Sparkles } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '../../../../styles/typography'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { ATTRIBUTION_COPY } from '../constants'
import { PanelIconButton } from '../ui/PanelIconButton'
import type { NodeType } from '../../../domain/nodes'
import type { SignalView } from '../types'

interface SignalRowProps {
  view: SignalView
  onSendPrompt: (label: string, prompt: string) => void
  onAction: (view: SignalView) => void
}

export const SignalRow = memo(function SignalRow({ view, onSendPrompt, onAction }: SignalRowProps) {
  const { detection, status } = view
  const resolved = status === 'resolved'

  return (
    <div
      className="grid grid-cols-[16px_1fr_auto] items-start gap-2 border-t border-panel-border py-3 first:border-t-0"
      data-testid={`pre-analysis-v3-signal-${detection.signal_id}`}
      data-signal-status={status}
    >
      <span className={`mt-0.5 ${resolved ? 'opacity-45' : ''}`}>
        <NodeShapeIndicator nodeKind={detection.entityKind as NodeType} size={12} />
      </span>

      <p className={`${typography.panelBody} min-w-0 ${resolved ? 'text-text-light' : 'text-text-body'}`}>
        {detection.ceeOverride ? (
          <>
            <span className="font-semibold text-info">
              {detection.ceeOverride.attribution.kind === 'olumi'
                ? ATTRIBUTION_COPY.olumiNoticed
                : detection.ceeOverride.attribution.displayName}
            </span>{' '}
            {detection.ceeOverride.text}
          </>
        ) : (
          <>
            {detection.copy.lead}
            {detection.copy.emphasis ? (
              <>
                {' '}
                <span className="font-semibold text-text-header">{detection.copy.emphasis}</span>
              </>
            ) : null}
          </>
        )}
        {resolved && (
          <Check className="ml-1.5 inline-block h-3.5 w-3.5 align-text-bottom text-success" aria-hidden />
        )}
      </p>

      {!resolved && (
        <span className="flex items-center">
          {detection.rationale && (
            <Tooltip content={detection.rationale} delay={300}>
              <PanelIconButton
                variant="ghost"
                className="opacity-50 hover:opacity-100 focus-visible:opacity-100"
                aria-label="Why this matters"
              >
                <Info className="h-3.5 w-3.5" aria-hidden />
              </PanelIconButton>
            </Tooltip>
          )}
          {detection.spark && (
            <Tooltip content={detection.spark.label} delay={300}>
              <PanelIconButton
                variant="ai"
                aria-label={detection.spark.label}
                onClick={() =>
                  detection.action?.type === 'send_prompt'
                    ? onSendPrompt(detection.spark!.label, detection.spark!.prompt)
                    : onAction(view)
                }
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              </PanelIconButton>
            </Tooltip>
          )}
        </span>
      )}
    </div>
  )
})
