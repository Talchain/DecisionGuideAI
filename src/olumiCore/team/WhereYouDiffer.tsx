import type { View } from '../../olumiView/client'
import { effectHeadingsOf, effectsOf, type ViewEffectRun } from '../../olumiView/standin'
import { AVATAR, CARD, H, META } from './ui'

/**
 * WHERE YOU DIFFER (capability inventory item 3; TIER-C-DESIGN-QA "Where you differ"; legacy `collab/DisagreementBody.tsx` is the layout
 * spec). After the reveal: one compact picture of who leans where. Per aim, one lane for each option; a person stands in the lane of the
 * option core says is most likely with THEIR figure (`effects[].leader`), under their own label for the figure and core's words for what
 * it does to the Run (`effect_headings`, verbatim). The option the model itself favours is marked with core's label for it
 * (`model_leader`). Everything is core's: by id from the same `collab.shared[].effects` the per-person rows below read; no number is
 * computed or formatted here and no sentence of reasoning is composed. The picture takes no mean, makes no consensus line, and orders
 * people only as core does: a lone dissenter stands exactly like anyone else.
 *
 * Drawn only once two people each have an option placed by their own figure (otherwise there is nothing to compare), and never for a
 * gated viewer. A person core placed no option for (a skip, no figure, a figure core did not run, no option ahead) is named, not hidden.
 */
type Placed = { by: string; by_id: string; figure: string; status: string; leader: string; goal: string }

export function WhereYouDiffer({ view }: { view: View }): JSX.Element | null {
  const c = view.collab, headings = effectHeadingsOf(c), cards = view.model?.cards ?? []
  if (view.gated || headings === null || cards.length === 0) return null
  const heading = (id: string) => cards.find((k) => k.id === id)?.heading ?? null
  const placed: Placed[] = []
  const modelLeads = new Map<string, Set<string>>()
  for (const v of c.shared) {
    if (v.skip) continue
    for (const e of effectsOf(v)) {
      if ('refused' in e) continue
      const run = e as ViewEffectRun
      if (run.model_leader != null) { const s = modelLeads.get(run.goal) ?? new Set<string>(); s.add(run.model_leader); modelLeads.set(run.goal, s) }
      if (run.leader == null || heading(run.leader) === null) continue
      placed.push({ by: v.by, by_id: v.by_id, figure: v.figures.find((f) => f.quantity === run.quantity)?.label ?? heading(run.quantity) ?? '', status: headings[run.status], leader: run.leader, goal: run.goal })
    }
  }
  if (new Set(placed.map((p) => p.by_id)).size < 2) return null
  const goals = [...new Set(placed.map((p) => p.goal))].filter((g) => heading(g) !== null)
  const unplaced = c.shared.filter((v) => !v.skip && !placed.some((p) => p.by_id === v.by_id)).map((v) => v.by)
  return (
    <section data-testid="team-differ" aria-label="Where you differ" className="grid gap-2">
      <h3 className={H}>Where you differ</h3>
      {goals.map((goal) => {
        const here = placed.filter((p) => p.goal === goal)
        const lanes = cards.filter((k) => here.some((p) => p.leader === k.id) || modelLeads.get(goal)?.has(k.id))
        return (
          <div key={goal} className={CARD} data-differ-aim={goal}>
            <p className={`${META} text-text-header`} data-differ-aim-heading="">{heading(goal)}</p>
            <ul className="m-0 grid list-none gap-2 p-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              {lanes.map((k) => (
                <li key={k.id} data-differ-option={k.id} className="grid content-start gap-1.5 rounded-md border border-panel-border bg-canvas p-2">
                  <p className={`${META} text-text-header`} data-differ-option-heading="">{k.heading}</p>
                  {modelLeads.get(goal)?.has(k.id) && headings.model_leader !== undefined ? <p className={META} data-differ-model="">{headings.model_leader}</p> : null}
                  <ul className="m-0 grid list-none gap-1 p-0">
                    {here.filter((p) => p.leader === k.id).map((p, i) => (
                      <li key={`${p.by_id}-${i}`} data-differ-person={p.by_id} className={META}>
                        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={AVATAR}>{p.by.slice(0, 1).toUpperCase()}</span><span className="text-text-header" data-differ-by="">{p.by}</span></span>
                        <span className="block" data-differ-figure="">{p.figure}</span>
                        <span className="block" data-differ-status="">{p.status}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {unplaced.length === 0 ? null : <p className={META} data-testid="team-differ-unplaced">Not placed here: {unplaced.join(', ')}</p>}
    </section>
  )
}
