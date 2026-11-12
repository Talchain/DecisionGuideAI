import type { Difference, DifferenceHeadings } from './differences'
import { AVATAR, BODY, CARD, META } from './ui'

/**
 * A difference revealed on an EARLIER version (core 2a5f61f7 SCI-HISTORY, `differences[].earlier`): the two figures as given on that version,
 * each person's chance from that version's stored runs, and what the team decided then, kept after a shared edit made a newer version.
 * HISTORY, read-only (Codex PL-538): no step, no preview on the canvas, no keep or find-out action, nothing to press. Every word is core's
 * (its `status_text` opens with the version's own sentence); the one word added here is the version's label, on the card and as the model
 * column's head, never the current model's heading ("With the model's figure"); each of that column's cells names the version in core's words.
 */
export function EarlierDifference({ d, h, ring }: { d: Difference & { earlier: NonNullable<Difference['earlier']> }; h: DifferenceHeadings; ring: (ids: readonly string[]) => void }): JSX.Element {
  const w = d.earlier.version
  const at = `team-difference-${d.record}${d.goal ? `-${d.goal}` : ''}-v${w}`
  const cards = d.cards ?? [d.record]
  return (
    <article className={CARD} data-testid={at} data-difference-earlier={w} data-difference-status={d.status} data-difference-kind={d.kind ?? 'figure'}
      onMouseEnter={() => ring(cards)} onMouseLeave={() => ring([])}>
      <p className={META} data-testid={`${at}-version`}>Version {w}</p>
      <p className={`${BODY} break-words text-text-header`}><span data-testid={`${at}-label`}>{d.label}</span>{d.goal_label ? <span className="text-text-light"> · {d.goal_label}</span> : null}</p>

      <div className="grid gap-1" data-testid={`${at}-sides`}>
        <p className={META}>{d.sides_heading ?? h.sides}</p>
        <ul className="m-0 grid list-none gap-1 p-0">
          {d.sides.map((s) => (
            <li key={s.holder_id} className={`${BODY} flex items-start gap-1.5 break-words`} data-difference-side={s.holder_id} title={s.title}>
              <span aria-hidden="true" className={AVATAR}>{s.holder.slice(0, 1).toUpperCase()}</span>
              <span data-difference-figure=""><span className="text-text-header">{s.holder}</span>: {s.figure}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className={`${BODY} break-words`} data-testid={`${at}-status`}>{d.status_text}</p>

      {d.options.length > 0 && (
        <div className="grid gap-1" data-testid={`${at}-options`}>
          <p className={META}>{h.options}</p>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={`${META} py-0.5 pr-2 text-left font-normal`}><span className="sr-only">Option</span></th>
                {d.sides.map((s) => <th key={s.holder_id} scope="col" className={`${META} py-0.5 pr-2 text-left font-normal text-text-header`}>{s.holder}</th>)}
                <th scope="col" className={`${META} py-0.5 text-left font-normal`}>Version {w}</th>
              </tr>
            </thead>
            <tbody>
              {d.options.map((o) => (
                <tr key={o.option} data-difference-option={o.option} className="border-t border-panel-border">
                  <th scope="row" className={`${BODY} py-1 pr-2 text-left font-normal text-text-header`}>{o.label}</th>
                  {d.sides.map((s) => {
                    const c = o.chances.find((x) => x.holder_id === s.holder_id)
                    return <td key={s.holder_id} className={`${BODY} py-1 pr-2 ${c?.withheld ? 'text-text-light' : 'tabular-nums'}`} data-difference-chance={s.holder_id}
                      data-difference-withheld={c?.withheld ? '' : undefined} title={c?.withheld?.reason}>{c?.text ?? ''}</td>
                  })}
                  <td className={`${META} py-1 tabular-nums`} data-difference-model="">{o.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.steps.length > 0 && (
        <div className="grid gap-1" data-testid={`${at}-steps`}>
          <p className={META}>{h.steps}</p>
          <ul className="m-0 grid list-none gap-1 p-0">
            {d.steps.map((s) => <li key={s.id} className={`${BODY} break-words`} data-step={s.step} data-step-by={s.by_id} data-step-version={s.version}>{s.text}</li>)}
          </ul>
        </div>
      )}
    </article>
  )
}
