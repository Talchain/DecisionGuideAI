/**
 * HowComputedTrigger — the always-visible way in to the Model-Card-Lite
 * (roadmap M4 / P1-9).
 *
 * Sits at the top of the results panel, above every number it explains, so
 * "where did that number come from?" is answerable without hunting. Opens
 * `HowComputedModal` through the store, so no props thread through the panel.
 *
 * Renders nothing when there are no results on screen: a method note for an
 * analysis that has not run would be explaining numbers that do not exist.
 */
import { Info } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { openHowComputed } from './howComputedStore'
import { HOW_COMPUTED_COPY } from './HowComputedModal'

export interface HowComputedTriggerProps {
  /** True when the panel is showing analysis numbers. */
  hasResults: boolean
}

export function HowComputedTrigger({ hasResults }: HowComputedTriggerProps) {
  if (!hasResults) return null
  return (
    <button
      type="button"
      onClick={openHowComputed}
      data-testid="how-computed-trigger"
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border border-panel-border bg-panel px-2.5 py-1 ${typography.panelMeta} text-text-body hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
    >
      <Info className="h-3.5 w-3.5 shrink-0 text-info" aria-hidden="true" />
      {HOW_COMPUTED_COPY.title}
    </button>
  )
}

export default HowComputedTrigger
