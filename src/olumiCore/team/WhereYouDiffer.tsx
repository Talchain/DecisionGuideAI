import type { View } from '../../olumiView/client'
import { effectHeadingsOf, effectsOf, type ViewEffectRun } from '../../olumiView/standin'
import { AVATAR, CARD, H, META } from './ui'

/**
 * WHERE YOU DIFFER (capability inventory item 3; TIER-C-DESIGN-QA "Where you differ"; legacy `collab/DisagreementBody.tsx` is the layout
 * spec). After the reveal: one compact picture of who leans where. Per aim, one lane for each option; a person stands in the lane of the
 * option core says is most likely with THEIR figure (`effects[].leader`), once per lane, with each of their figures under them as
 * "<their label>: <their figure text>" and a small mark for what it does to the Run (core's `effect_headings` words are the mark's hover and,
 * said once, the legend; only `changes` is emphasised). The option the model itself favours is one line per aim in core's field label
 * for it (`model_leader`: "<label>: <option>"). Everything is core's: by id from the same `collab.shared[].effects` the per-person rows below read; no number is
 * computed or formatted here and no sentence of reasoning is composed. The picture takes no mean, makes no consensus line, and orders
 * people only as core does: a lone dissenter stands exactly like anyone else.
 *
 * Drawn only once two people each have an option placed by their own figure (otherwise there is nothing to compare), and never for a
 * gated viewer. A person core placed no option for (a skip, no figure, a figure core did not run, no option ahead) is named, not hidden.
 */
type Placed = { by: string; by_id: string; figure: string; text: string | null; status: 'changes' | 'moves' | 'same'; leader: string; goal: string }

/** The three statuses' marks (shapes, not words; core's words are each mark's hover and the legend): `changes` solid and ringed, `moves` hollow, `same` faint. */
const MARK: Record<Placed['status'], string> = {
  changes: 'bg-info ring-2 ring-info/30',
  moves: 'border border-text-light bg-transparent',
  same: 'bg-text-light/40',
}
function StatusMark({ status, words }: { status: Placed['status']; words: string }): JSX.Element {
  return <span role="img" aria-label={words} title={words} data-differ-status={status} className={`mt-[5px] inline-block h-2 w-2 flex-none rounded-full ${MARK[status]}`} />
}

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
      const fig = v.figures.find((f) => f.quantity === run.quantity)
      placed.push({ by: v.by, by_id: v.by_id, figure: fig?.label ?? heading(run.quantity) ?? '', text: fig?.text ?? null, status: run.status, leader: run.leader, goal: run.goal })
    }
  }
  if (new Set(placed.map((p) => p.by_id)).size < 2) return null
  const goals = [...new Set(placed.map((p) => p.goal))].filter((g) => heading(g) !== null)
  const unplaced = c.shared.filter((v) => !v.skip && !placed.some((p) => p.by_id === v.by_id)).map((v) => v.by)
  const drawn = (['changes', 'moves', 'same'] as const).filter((st) => placed.some((p) => p.status === st))
  return (
    <section data-testid="team-differ" aria-label="Where you differ" className="grid gap-2">
      <h3 className={H}>Where you differ</h3>
      {goals.map((goal) => {
        const here = placed.filter((p) => p.goal === goal)
        const lanes = cards.filter((k) => here.some((p) => p.leader === k.id))
        const model = [...(modelLeads.get(goal) ?? [])].map(heading).filter((h): h is string => h !== null)
        return (
          <div key={goal} className={CARD} data-differ-aim={goal}>
            <p className={`${META} text-text-header`} data-differ-aim-heading="">{heading(goal)}</p>
            {model.length > 0 && headings.model_leader !== undefined ? <p className={META} data-differ-model="">{headings.model_leader}: {model.join(', ')}</p> : null}
            {headings.leader !== undefined ? <p className={META} data-differ-leader-label="">{headings.leader}</p> : null}
            <ul className="m-0 grid list-none gap-2 p-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              {lanes.map((k) => {
                const people = [...new Set(here.filter((p) => p.leader === k.id).map((p) => p.by_id))]
                return (
                  <li key={k.id} data-differ-option={k.id} className="grid content-start gap-2 rounded-md border border-panel-border bg-canvas p-2">
                    <p className={`${META} text-text-header`} data-differ-option-heading="">{k.heading}</p>
                    <ul className="m-0 grid list-none gap-2 p-0">
                      {people.map((id) => {
                        const mine = here.filter((p) => p.leader === k.id && p.by_id === id)
                        return (
                          <li key={id} data-differ-person={id} className={`${META} grid gap-1`}>
                            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={AVATAR}>{mine[0]!.by.slice(0, 1).toUpperCase()}</span><span className="text-text-header" data-differ-by="">{mine[0]!.by}</span></span>
                            <ul className="m-0 grid list-none gap-1 p-0">
                              {mine.map((p, i) => (
                                <li key={i} className={`flex items-start gap-1.5 break-words ${p.status === 'changes' ? 'font-medium text-text-header' : ''}`} data-differ-fig-status={p.status}>
                                  <StatusMark status={p.status} words={headings[p.status]} />
                                  <span data-differ-figure="">{p.text === null ? p.figure : `${p.figure}: ${p.text}`}</span>
                                </li>
                              ))}
                            </ul>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      <p className={`${META} flex flex-wrap items-center gap-x-3 gap-y-1`} data-testid="team-differ-legend">
        {drawn.map((st) => <span key={st} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${MARK[st]}`} />{headings[st]}</span>)}
      </p>
      {unplaced.length === 0 ? null : <p className={META} data-testid="team-differ-unplaced">Not placed here: {unplaced.join(', ')}</p>}
    </section>
  )
}
