/**
 * THE MODEL TAB ON THE CORE LANE (DL 4 Nov, R2: Paul's staging has it): the legacy Model tab's outline (`model-tab-v2/ModelOutline.tsx`:
 * its groups, in its order, under its own titles), drawn from core's View. Question & goal: the question, the aims and limits, and the aim
 * core measures (`model.aim`); Options; Factors (the figures a person sets); Outcomes & risks (the figures core works out from others, the
 * risks); Relationships (the links, from its card to its card, with core's sign and its strength words). Every word is core's: each
 * card's number and heading as the canvas draws them, its figure or rows, and Olumi's mark where core marks it.
 *
 * View only: a row's press puts its card in front on the canvas (the canvas's own focus, `focusNodeById`). Changing the model stays the
 * card's ✎ and the chat. Assumptions and conditions are the Rests on lens's; the legacy outline has no group for them either.
 */
import { Fragment, useMemo } from 'react'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { MODEL_GROUP_TITLE } from '../canvas/domain/vocabulary'
import { focusNodeById } from '../canvas/utils/focusHelpers'
import type { ViewCard, ViewModel } from './client'
import { cardNumbersOf, linkEndHeading, modelGroupsOf } from './layout'
import { useViewStore } from './store'
import { Row } from './ViewChances'

const Mark = ({ at, mark }: { at: string; mark: { glyph: string; title: string } | null }) =>
  mark === null ? null : <span title={mark.title} aria-label={mark.title} data-view={`${at}.glyph`}>{mark.glyph}</span>

function CardRow({ card, number }: { card: ViewCard; number: string | null }) {
  return (
    <li>
      <button type="button" onClick={() => focusNodeById(card.id)} data-model-row={card.id}
        className={`w-full cursor-pointer rounded px-1 py-1 text-left hover:bg-panel-hover ${ACTION_FOCUS}`}>
        <span className="flex items-baseline gap-1">
          {number === null ? null : <span className="text-text-light">{number}</span>}
          <span className="text-text-header" title={card.detail === '' ? undefined : card.detail} data-view={`${card.id}.heading`}>{card.heading}</span>
          <Mark at={`${card.id}.olumi`} mark={card.olumi} />
          <Mark at={`${card.id}.change`} mark={card.change} />
        </span>
        {card.figure === null ? null : <span className="block" title={card.figure.title} data-view={`${card.id}.figure.text`}>{card.figure.text}</span>}
        {card.rows.map((row, i) => <Row key={i} card={card} row={row} i={i} />)}
      </button>
    </li>
  )
}

export function ViewModelTab({ model }: { model: ViewModel }): JSX.Element {
  const numbers = useMemo(() => cardNumbersOf(model), [model])
  const groups = useMemo(() => modelGroupsOf(model), [model])
  return (
    <div className={`${typography.panelBody} space-y-4 pb-4`} data-testid="view-model-tab">
      {groups.map((g) => (g.cards.length === 0 && g.id !== 'goal' ? null : (
        <section key={g.id} aria-label={g.title} data-model-group={g.id}>
          <h3 className={`${typography.panelHeader} text-text-header`}>{g.title} <span className={`${typography.panelMeta} text-text-light`}>{g.cards.length + (g.id === 'goal' ? 1 : 0)}</span></h3>
          <ul className="mt-1 space-y-0.5">
            {g.id === 'goal' ? (
              <li className="px-1 py-1">
                <span className="text-text-header" data-view="model.question.text">{model.question.text}</span>
                {model.aim == null ? null : <span className="block" title={model.aim.title} data-view="model.aim.text">{model.aim.text}</span>}
              </li>
            ) : null}
            {g.cards.map((c) => <CardRow key={c.id} card={c} number={numbers.get(c.id) ?? null} />)}
          </ul>
        </section>
      )))}
      {model.links.length === 0 ? null : (
        <section aria-label={MODEL_GROUP_TITLE.relationships} data-model-group="relationships">
          <h3 className={`${typography.panelHeader} text-text-header`}>{MODEL_GROUP_TITLE.relationships} <span className={`${typography.panelMeta} text-text-light`}>{model.links.length}</span></h3>
          <ul className="mt-1 space-y-0.5">
            {model.links.map((l, i) => (
              <li key={i}>
                <button type="button" onClick={() => focusNodeById(l.from)} data-model-link={`links.${i}`} title={l.title}
                  className={`w-full cursor-pointer rounded px-1 py-1 text-left hover:bg-panel-hover ${ACTION_FOCUS}`}>
                  <span>{linkEndHeading(model, l.from)}</span>
                  <span aria-hidden="true"> → </span>
                  <span>{linkEndHeading(model, l.to)}</span>
                  {l.label === '' ? null : <Fragment> <span data-view={`links.${i}.label`}>{l.label}</span></Fragment>}
                  {l.effect == null ? null : <span className="block text-text-light" title={l.effect.title} data-view={`links.${i}.effect.text`}>{l.effect.text}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** The tab's body for the scenario on screen: the View's model, or nothing before core holds one. */
export function ViewModelTabBlock(): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  return model === null ? null : <ViewModelTab model={model} />
}
