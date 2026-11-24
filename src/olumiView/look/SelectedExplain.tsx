/**
 * A SELECTED OPTION'S EXPLANATION (DL journey 3, 14 Nov): what Paul reads after selecting an option, in the selected card, without hover.
 * The explanation uses core's fields:
 *  - what the option changes: its `sets[]` (the figure each lever takes with this option, and whose that figure is);
 *  - what it rests on: its `premises[]` (core's glyph and words; core's source on hover);
 *  - how the figure it moves is worked out: the steps (look/WorkedSteps.tsx) of each card a `through` link from this option, or from a figure
 *    it sets, leads into; this option's own terms are marked. The View does not project the relation's form (sum, product, stock), so the
 *    steps are the base and the terms the View gives, never a formula.
 */
import type { View, ViewCard } from '../client'
import { Hover } from './Hover'
import { movedByWorked, WorkedSteps, workedStepsOf } from './WorkedSteps'

/** Said where the served fields show this route no figure change. It describes the display, never a numerical zero (PL 1202): a Run can exist from other facts, and band rows omit missing and unsampled withheld rows. */
export const NO_FIGURE_WORDS = 'No figure change is shown for this route yet.'

/** The cards this option moves through a sized term: `through` links from the option or a figure it sets, into a card worked out. */
export function movedBy(view: View, option: ViewCard): string[] {
  const from = new Set([option.id, ...(option.sets ?? []).map((s) => s.id)])
  const into = (view.model?.links ?? []).filter((l) => l.kind === 'through' && from.has(l.from)).map((l) => l.to)
  // DL j3: and every card core's own working (`card.worked`) says this option moves, by a step that takes a different record for it.
  return [...new Set([...into.filter((id) => workedStepsOf(view, id).length > 0), ...movedByWorked(view, option.id)])]
}

/** The served fields show this option nothing to explain: sets and premises present and empty, nothing it moves, the Run shown and not all withheld, and no value withheld for it. That is an empty visible explanation, not proof of a zero. */
export function changesNoFigure(view: View, card: ViewCard): boolean {
  const model = view.model
  return Array.isArray(card.sets) && card.sets.length === 0
    && Array.isArray(card.premises) && card.premises.length === 0
    && model?.run != null && model.run.all_withheld !== true
    && movedBy(view, card).length === 0
    && !model.cards.some((c) => c.values_withheld?.some((value) => value.option === card.id))
}

/** `testid`: the root test id (default the dock's; the details panel passes its own, so one page never holds two of the same). */
export function SelectedExplain({ view, id, testid = 'selected-explain' }: { view: View; id: string; testid?: string }): JSX.Element | null {
  const card = view.model?.cards.find((c) => c.id === id) ?? null
  if (card === null || card.family !== 'option') return null
  const sets = card.sets ?? [], premises = card.premises ?? [], moved = movedBy(view, card)
  const empty = sets.length === 0 && premises.length === 0 && moved.length === 0
  if (empty && !changesNoFigure(view, card)) return null
  const own = new Set([card.id, ...sets.map((s) => s.id)])
  return (
    <div className="ok-explain basis-full" data-testid={testid} data-ok-own={[...own].join(' ')}>
      {empty ? <p data-testid={`${testid}-none`}>{NO_FIGURE_WORDS}</p> : null}
      {sets.length === 0 ? null : (
        <section data-testid={`${testid}-sets`}>
          <p className="ok-explain-head">What it changes</p>
          <ul>{sets.map((s, i) => (
            <li key={s.id} data-view={`${id}.sets.${i}`}>
              <span>{s.label}</span>{' '}<Hover as="b" words={s.figure?.title ?? undefined} data-view={`${id}.sets.${i}.figure.text`}>{s.figure?.text ?? ''}</Hover>
              {s.author == null || s.author === '' ? null : <span className={s.whose === 'olumi' ? 'ok-by-olumi' : 'ok-by'}> · {s.author}</span>}
            </li>
          ))}</ul>
        </section>
      )}
      {premises.length === 0 ? null : (
        <section data-testid={`${testid}-premises`}>
          <p className="ok-explain-head">Rests on</p>
          <ul>{premises.map((p, i) => (
            <Hover as="li" key={`${p.id ?? i}`} words={p.title} data-view={`${id}.premises.${i}.text`}><span aria-hidden="true" className="ok-explain-glyph">{p.glyph}</span> {p.text}</Hover>
          ))}</ul>
        </section>
      )}
      {moved.length === 0 ? null : (
        <section className="space-y-4" data-testid={`${testid}-steps`}>
          {moved.map((m) => <WorkedSteps key={m} view={view} id={m} mine={own} option={card.id} />)}
        </section>
      )}
    </div>
  )
}
