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
type Placed = { by: string; by_id: string; quantity: string; figure: string; text: string | null; status: 'changes' | 'moves' | 'same'; leader: string | null; goal: string }

const NONE = '__no_leader__'
/** The three statuses' marks (shapes, not words; core's words are each mark's hover and the legend): `changes` solid and ringed, `moves` hollow, `same` faint. */
const MARK: Record<Placed['status'], string> = {
  changes: 'bg-info ring-2 ring-info/30',
  moves: 'border border-text-light bg-transparent',
  same: 'bg-text-light/40',
}
function StatusMark({ status, words }: { status: Placed['status']; words: string }): JSX.Element {
  return <span role="img" aria-label={words} title={words} data-differ-status={status} className={`mt-[5px] inline-block h-2 w-2 flex-none rounded-full ${MARK[status]}`} />
}

/** What the picture draws, or null when it draws nothing: each placed figure (a `changes` effect whose leader is null is placed under core's `no_leader`), and the aims' model-side facts. */
function differOf(view: View) {
  const c = view.collab, headings = effectHeadingsOf(c), cards = view.model?.cards ?? []
  if (view.gated || headings === null || cards.length === 0) return null
  const heading = (id: string) => cards.find((k) => k.id === id)?.heading ?? null
  const placed: Placed[] = []
  const modelLeads = new Map<string, Set<string>>()
  const noModelLeader = new Set<string>()
  for (const v of c.shared) {
    if (v.skip) continue
    for (const e of effectsOf(v)) {
      if ('refused' in e) continue
      const run = e as ViewEffectRun
      const own = run.leader != null && heading(run.leader) !== null
      // No option clearly most likely with their figure: only a `changes` effect is placed, in core's own `no_leader` lane.
      if (!own && !(run.leader == null && run.status === 'changes' && headings.no_leader !== undefined)) continue
      if (run.model_leader != null) { const s = modelLeads.get(run.goal) ?? new Set<string>(); s.add(run.model_leader); modelLeads.set(run.goal, s) } else noModelLeader.add(run.goal)
      const fig = v.figures.find((f) => f.quantity === run.quantity)
      placed.push({ by: v.by, by_id: v.by_id, quantity: run.quantity, figure: fig?.label ?? heading(run.quantity) ?? '', text: fig?.text ?? null, status: run.status, leader: own ? run.leader : null, goal: run.goal })
    }
  }
  if (new Set(placed.map((p) => p.by_id)).size < 2) return null
  return { c, headings, cards, heading, placed, modelLeads, noModelLeader }
}

/** The figures the picture draws (`<by_id>:<quantity>`), so the per-person rows below need not say again what a lane shows; null when no picture is drawn. */
export function differPlaced(view: View): ReadonlySet<string> | null {
  const d = differOf(view)
  return d === null ? null : new Set(d.placed.map((p) => `${p.by_id}:${p.quantity}`))
}

export function WhereYouDiffer({ view }: { view: View }): JSX.Element | null {
  const d = differOf(view)
  if (d === null) return null
  const { c, headings, cards, heading, placed, modelLeads, noModelLeader } = d
  const goals = [...new Set(placed.map((p) => p.goal))].filter((g) => heading(g) !== null)
  const unplaced = c.shared.filter((v) => !v.skip && !placed.some((p) => p.by_id === v.by_id)).map((v) => v.by)
  const drawn = (['changes', 'moves', 'same'] as const).filter((st) => placed.some((p) => p.status === st))
  return (
    <section data-testid="team-differ" aria-label="Where you differ" className="grid gap-2">
      <h3 className={H}>Where you differ</h3>
      {goals.map((goal) => {
        const here = placed.filter((p) => p.goal === goal)
        // Each lane: an option card, then (last) core's no-leader lane for figures that leave no option clearly ahead.
        const lanes: { id: string; heading: string }[] = [
          ...cards.filter((k) => here.some((p) => p.leader === k.id)).map((k) => ({ id: k.id, heading: k.heading })),
          ...(here.some((p) => p.leader === null) && headings.no_leader !== undefined ? [{ id: NONE, heading: headings.no_leader }] : []),
        ]
        const model = [...(modelLeads.get(goal) ?? [])].map(heading).filter((h): h is string => h !== null)
        return (
          <div key={goal} className={CARD} data-differ-aim={goal}>
            <p className={`${META} text-text-header`} data-differ-aim-heading="">{heading(goal)}</p>
            {model.length > 0 && headings.model_leader !== undefined ? <p className={META} data-differ-model="">{headings.model_leader}: {model.join(', ')}</p> : null}
            {noModelLeader.has(goal) && headings.no_model_leader !== undefined ? <p className={META} data-differ-no-model-leader="">{headings.no_model_leader}</p> : null}
            {headings.leader !== undefined ? <p className={META} data-differ-leader-label="">{headings.leader}</p> : null}
            <ul className="m-0 grid list-none gap-2 p-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              {lanes.map((k) => {
                const people = [...new Set(here.filter((p) => p.leader === (k.id === NONE ? null : k.id)).map((p) => p.by_id))]
                return (
                  <li key={k.id} data-differ-option={k.id} className="grid content-start gap-2 rounded-md border border-panel-border bg-canvas p-2">
                    <p className={`${META} text-text-header`} data-differ-option-heading="">{k.heading}</p>
                    <ul className="m-0 grid list-none gap-2 p-0">
                      {people.map((id) => {
                        // The same figure given again in a later round, with the same effect, is one line, not two.
                        const mine = here.filter((p) => p.leader === (k.id === NONE ? null : k.id) && p.by_id === id).filter((p, i, all) => all.findIndex((q) => q.figure === p.figure && q.text === p.text && q.status === p.status) === i)
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
