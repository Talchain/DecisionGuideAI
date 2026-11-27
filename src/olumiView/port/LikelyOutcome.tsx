import type { View, ViewModel } from '../client'
import { BandsChart } from '../v12/scale/OptionBand'
import { optionLetters } from '../v12/cards/letters'
import { visualIdentity, type VisualV3 } from '../visual'
import type { ChartGroup } from './pick'
import { Hover } from '../look/Hover'
import { typography } from '../../styles/typography'

/** The tab's own chrome, used only when Core sends no outcome lens to name the section. */
export const OUTCOME_WORDS = { heading: 'Likely outcome' } as const

export function LikelyOutcome({ model, group, view }: { model: ViewModel; group: ChartGroup; view: View | null }) {
  const run = model.run
  if (run == null) return null
  const li = run.lenses?.findIndex((l) => l.id === 'outcome') ?? -1
  const lens = run.lenses?.[li] ?? null
  const letters = optionLetters(model)
  const lanes = group.rows.flatMap<VisualV3['lanes'][number]>(({ card, row }) => {
    const outcome = row.outcome, letter = letters.get(card.id)
    if (outcome == null || letter === undefined) return []
    return [{
      option: card.id, letter, label: card.heading, state: 'value',
      p10: outcome.low, p50: outcome.median, p90: outcome.high, text: outcome.text, title: outcome.title,
      if_absent: [], if_approved: null, provenance: row.olumi == null
        ? { kind: 'theirs', author: null }
        : { kind: 'olumi', basis: row.olumi.title },
    }]
  })
  if (lanes.length === 0) return null
  const label = lens?.label ?? OUTCOME_WORDS.heading
  const payload: VisualV3 = {
    kind: 'visual', chart: 'CH-bands', quantity: group.aimId,
    ...visualIdentity(model, view),
    unit: group.rows.find(({ row }) => row.outcome != null)?.row.outcome?.unit ?? null,
    lanes,
  }
  return (
    <section className="space-y-3" data-testid="analysis-likely-outcome" aria-label={label} data-outcome-aim={group.aimId}>
      {lens === null
        ? <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`}>{label}</h3>
        : <Hover as="h3" words={lens.title} wordsAt={`run.lenses.${li}.title`} className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view={`run.lenses.${li}.label`}>{label}</Hover>}
      <BandsChart payload={payload} />
    </section>
  )
}
