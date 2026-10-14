import { typography } from '../../../../styles/typography'
import { olumiScaleLines } from '../../../domain/olumiScaleSentence'
import { TechnicalDisclosure } from './TechnicalDisclosure'

/**
 * Under the factor's value, when OLUMI chose its scale (CEE `observed_state.frame_source: 'olumi_convention'`):
 * a short plain line, and Science's full sentence one press away behind "Why?" (Paul 8 Oct, progressive disclosure).
 * Read-only. Renders nothing when the stamp is absent. Words: `domain/olumiScaleSentence.ts`.
 */
export function OlumiScaleLine({ label, observedState }: { label: string; observedState: unknown }) {
  const lines = olumiScaleLines({ label, observedState })
  if (lines === null) return null
  return (
    <div className="mt-1.5" data-testid="factor-olumi-scale">
      <p className={`${typography.panelMeta} text-text-light`} data-testid="factor-olumi-scale-short">{lines.short}</p>
      <TechnicalDisclosure visible label="Why?" openLabel="Hide why" compact>
        <span data-testid="factor-olumi-scale-why">{lines.why}</span>
      </TechnicalDisclosure>
    </div>
  )
}
