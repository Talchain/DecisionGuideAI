/**
 * "Your options", restored (UI recovery row 15, DL 10 Nov 2026): the previous product's section, its own header and its own `OptionCards`,
 * fed by core's View through `legacyOptionsOf`. Each card says core's headline for the option (its chance of meeting the aim, DL #87) and
 * draws that chance as a bar. The cards draw what core sends and nothing else:
 * - no leader, rank, crown or win share (core sends none): designations are withheld and the bars take the neutral colour;
 * - every option is shown, in core's order: the previous "top two" cut hid options by a ranking core does not make;
 * - no hint about an inspector, and no chat or focus chips: those acted on the previous canvas.
 * Pointing at a card lights its card on the canvas (v10's ring), as the previous cards did.
 */
import type { MouseEvent } from 'react'
import { OptionCards } from '../../components/results/OptionCards'
import { SectionHeader } from '../../components/results/SectionHeader'
import type { ViewModel } from '../client'
import { endRing, pointRing } from '../ring'
import { legacyOptionsOf } from './legacyAnalysis'

export function YourOptions({ model }: { model: ViewModel }) {
  const { options, goalCellOf } = legacyOptionsOf(model)
  // The previous section drew only when there was more than one option to compare.
  if (model.run == null || options.length < 2) return null
  const point = (e: MouseEvent<HTMLElement>) => {
    const id = (e.target as HTMLElement).closest?.('[data-option-id]')?.getAttribute('data-option-id')
    if (id != null) pointRing([id])
    else endRing()
  }
  return (
    <section className="space-y-2 rounded-lg border border-panel-border p-3" data-testid="port-your-options" onMouseOver={point} onMouseLeave={endRing}>
      <SectionHeader title="Your options" testId="section-header-options" sectionColorMarker="bg-option" />
      <OptionCards options={options} goalCellOf={goalCellOf} hasGoalThreshold hasGoalNumbers hasLeadingOption={false} decisionState="indeterminate" truncate={false} labelHint={null} />
    </section>
  )
}

export default YourOptions
