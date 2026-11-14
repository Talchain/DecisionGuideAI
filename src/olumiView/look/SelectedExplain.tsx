/**
 * A SELECTED OPTION'S EXPLANATION (DL journey 3, 14 Nov): what Paul reads after selecting an option, in the selected card, without hover.
 * Every word is core's; nothing is inferred from words:
 *  - what the option changes: its `sets[]` (the figure each lever takes with this option, and whose that figure is);
 *  - what it rests on: its `premises[]` (core's glyph and words; core's source on hover);
 *  - how the figure it moves is worked out: the steps (look/WorkedSteps.tsx) of each card a `through` link from this option, or from a figure
 *    it sets, leads into; this option's own terms are marked. The View does not project the relation's form (sum, product, stock), so the
 *    steps are the base and the terms the View gives, never a formula.
 */
import type { View, ViewCard } from '../client'
import { movedByWorked, WorkedSteps, workedStepsOf } from './WorkedSteps'

/** The cards this option moves through a sized term: `through` links from the option or a figure it sets, into a card worked out. */
export function movedBy(view: View, option: ViewCard): string[] {
  const from = new Set([option.id, ...(option.sets ?? []).map((s) => s.id)])
  const into = (view.model?.links ?? []).filter((l) => l.kind === 'through' && from.has(l.from)).map((l) => l.to)
  // DL j3: and every card core's own working (`card.worked`) says this option moves, by a step that takes a different record for it.
  return [...new Set([...into.filter((id) => workedStepsOf(view, id).length > 0), ...movedByWorked(view, option.id)])]
}

export function SelectedExplain({ view, id }: { view: View; id: string }): JSX.Element | null {
  const card = view.model?.cards.find((c) => c.id === id) ?? null
  if (card === null || card.family !== 'option') return null
  const sets = card.sets ?? [], premises = card.premises ?? [], moved = movedBy(view, card)
  const own = new Set([card.id, ...sets.map((s) => s.id)])
  if (sets.length === 0 && premises.length === 0 && moved.length === 0) return null
  return (
    <div className="ok-explain basis-full" data-testid="selected-explain" data-ok-own={[...own].join(' ')}>
      {sets.length === 0 ? null : (
        <section data-testid="selected-explain-sets">
          <p className="ok-explain-head">What it changes</p>
          <ul>{sets.map((s, i) => (
            <li key={s.id} data-view={`${id}.sets.${i}`}>
              <span>{s.label}</span>{' '}<b title={s.figure?.title ?? undefined} data-view={`${id}.sets.${i}.figure.text`}>{s.figure?.text ?? ''}</b>
              {s.author == null || s.author === '' ? null : <span className={s.whose === 'olumi' ? 'ok-by-olumi' : 'ok-by'}> · {s.author}</span>}
            </li>
          ))}</ul>
        </section>
      )}
      {premises.length === 0 ? null : (
        <section data-testid="selected-explain-premises">
          <p className="ok-explain-head">Rests on</p>
          <ul>{premises.map((p, i) => (
            <li key={`${p.id ?? i}`} title={p.title} data-view={`${id}.premises.${i}.text`}><span aria-hidden="true" className="ok-explain-glyph">{p.glyph}</span> {p.text}</li>
          ))}</ul>
        </section>
      )}
      {moved.length === 0 ? null : (
        <section data-testid="selected-explain-steps">
          {moved.map((m) => <WorkedSteps key={m} view={view} id={m} mine={own} option={card.id} />)}
        </section>
      )}
    </div>
  )
}
