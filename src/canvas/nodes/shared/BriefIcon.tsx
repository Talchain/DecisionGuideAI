/**
 * BriefIcon — small FileText icon indicating a user-provided value from the brief.
 *
 * ⭐ HOVER IS A REAL TOOLTIP, NOT `title=`. The words are unchanged; what changed
 * is that they now arrive as a styled bubble after `NODE_TOOLTIP_DELAY_MS`
 * instead of as OS chrome after the platform's own ~1s dwell. See
 * `nodeTooltip.ts` for the founder report this answers.
 *
 * ⚠ AND THE NATIVE `title` IS GONE, DELIBERATELY — NOT KEPT "AS A FALLBACK".
 * Keeping both renders BOTH: the styled bubble at 300ms and the OS tooltip on
 * top of it a moment later, saying the same sentence twice.
 *
 * The accessible name moves to `role="img"` + `aria-label`, which is STRONGER
 * than the `title` it replaces: a `title` on a `<span>` is an accessible-name
 * fallback that assistive tech is not required to expose, and it is unreachable
 * by keyboard and by touch. The name is now explicit and needs neither hover nor
 * focus — the same channel `NodeProvenanceMark` already uses, and for the reason
 * recorded there.
 */
import { FileText } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { NODE_TOOLTIP_DELAY_MS, NODE_TOOLTIP_WRAPPER } from './nodeTooltip'

export const BRIEF_ICON_LABEL = 'From your brief'

export function BriefIcon() {
  return (
    <Tooltip content={BRIEF_ICON_LABEL} delay={NODE_TOOLTIP_DELAY_MS} wrapperClassName={NODE_TOOLTIP_WRAPPER}>
      <span
        data-testid="brief-icon"
        role="img"
        aria-label={BRIEF_ICON_LABEL}
        className="inline-flex cursor-help"
      >
        <FileText size={10} className="text-text-light" aria-hidden="true" />
      </span>
    </Tooltip>
  )
}
