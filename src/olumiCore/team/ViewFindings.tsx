import { CardMark } from '../../canvas/nodes/shared/CardMark'
import { viewFindingsOf, type ViewFindingSide } from './model'
import { BODY, CARD, H, META } from './ui'
import type { TeamScenario } from './types'

/**
 * WHAT THEIR FIGURES DO TO THE MODEL (D7, OLUMI_D7): a member's revealed figure run in the model on the same draws as the model's own, so the team
 * sees whether it changes which option is most likely or only moves the chances. Drawn only from `view_findings` (absent or null: nothing, and the tab
 * is what it was). Every row is core's labels and the records' names (`viewFindingsOf`); this writes no sentence about what a difference means, ranks
 * nothing and averages nothing. A comparison gone stale shows that and nothing else. What each side rests on is kept apart, marked with the Olumi
 * mark where it rests on something Olumi proposed, the lines behind a disclosure.
 */
function Side({ id, side, label }: { id: string; side: ViewFindingSide; label: string }): JSX.Element {
  return (
    <div data-testid={id} className="grid gap-0.5">
      <p className={`${META} flex items-center gap-1.5`}>
        {label}
        {side.olumi && <CardMark id="source-olumi" testId={`${id}-olumi`} words="Rests on something Olumi proposed" description={side.lines.join('; ')} />}
      </p>
      {side.lines.length > 0 && (
        <details>
          <summary className={`${META} cursor-pointer`}>What it rests on</summary>
          <ul className={`${META} m-0 grid list-none gap-0.5 p-0`}>{side.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </details>
      )}
    </div>
  )
}

export function ViewFindings({ scenario }: { scenario: Pick<TeamScenario, 'view_findings' | 'version'> }): JSX.Element | null {
  const found = viewFindingsOf(scenario)
  if (found === null) return null
  if (found.status === 'stale') {
    return (
      <section data-testid="team-view-findings" aria-label="Their figures, run in the model" className="grid gap-2">
        <h3 className={H}>Their figures, run in the model</h3>
        <p className={META} data-testid="team-view-findings-stale">{found.words}</p>
      </section>
    )
  }
  if (found.rows.length === 0) return null
  return (
    <section data-testid="team-view-findings" aria-label="Their figures, run in the model" className="grid gap-2">
      <h3 className={H}>Their figures, run in the model</h3>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {found.rows.map((r) => (
          <li key={r.id} data-testid={`team-view-finding-${r.id}`} data-change={r.change ?? undefined} data-status={r.status} className={CARD}>
            <dl className="m-0 grid gap-0.5">
              {r.pairs.map((p) => (
                <div key={p.label} className="flex flex-wrap gap-x-1.5">
                  <dt className={META}>{p.label}:</dt>
                  <dd className={`${BODY} m-0`}>{p.item}</dd>
                </div>
              ))}
            </dl>
            {r.options.length > 0 && (
              <ul className={`${META} m-0 grid list-none gap-0.5 p-0`} data-testid={`team-view-finding-${r.id}-options`}>
                {r.options.map((o) => <li key={o.option}>{o.words}</li>)}
              </ul>
            )}
            {r.sides && (
              <div className="grid gap-1">
                <Side id={`team-view-finding-${r.id}-model`} side={r.sides.model} label="The model" />
                <Side id={`team-view-finding-${r.id}-view`} side={r.sides.view} label={`With ${r.holder}’s figure`} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
