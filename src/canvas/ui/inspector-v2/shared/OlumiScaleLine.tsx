import { typography } from '../../../../styles/typography'
import { olumiScaleSentence } from '../../../domain/olumiScaleSentence'

/**
 * Says, under the factor's value, that OLUMI chose its scale (CEE `observed_state.frame_source: 'olumi_convention'`).
 * Read-only. Renders nothing when the stamp is absent. Words: `domain/olumiScaleSentence.ts`.
 */
export function OlumiScaleLine({ label, observedState }: { label: string; observedState: unknown }) {
  const sentence = olumiScaleSentence({ label, observedState })
  if (sentence === null) return null
  return (
    <p className={`${typography.panelMeta} text-text-light mt-1.5`} data-testid="factor-olumi-scale">
      {sentence}
    </p>
  )
}
