/**
 * "What could change the result", restored (UI recovery row 16, DL 10 Nov 2026): the previous product's accordion, open at first, holding
 * the driver chart. It is the tab's one home for what moves each option's chance:
 * - the chart (`DriverTornado`): each option's chance when the figure it moves most with is low and when it is high, on one axis;
 * - core's line on what those two chances are (`run.sensitivity`), once;
 * - any option's driver sentence its own row above does not already say (SC-02: each thing once).
 * The title and its second line are core's (`lens_words.label.what_changes`, `lens_words.hint.what_changes`); the previous title stands
 * only for a core that sends none.
 *
 * What is NOT drawn, because core does not send it (listed for the engine, BUILD-LEDGER A3 10 Nov): the previous tornado's one row per
 * FACTOR for an option, and the previous "What the result moves most with" list. The View carries one driver per option
 * (`cards[].driver`), so the chart has one row per option and no factor is ranked here.
 */
import { Accordion } from '../../components/results/Accordion'
import type { ViewModel } from '../client'
import { useViewStore } from '../store'
import { figureCard, Sensitivity, sensitivityShown } from '../ViewChances'
import { DriverTornado, tornadoRowsOf } from './DriverTornado'
import { driverCardsOf, drawnByRows } from './pick'
import { TYPE } from './type'

export function WhatWouldChange({ model }: { model: ViewModel }) {
  const words = useViewStore((s) => s.view?.lens_words ?? null)
  const charted = tornadoRowsOf(model).length
  const said = drawnByRows(model)
  const unsaid = driverCardsOf(model).filter((c) => !said.drivers.has(c.id))
  if (charted < 2 && unsaid.length === 0 && !sensitivityShown(model)) return null
  return (
    <Accordion title={words?.label.what_changes ?? 'What could change the result'} subtitle={words?.hint.what_changes} defaultExpanded badgeCount={charted < 2 ? undefined : charted} testId="accordion-tornado">
      <div className={`${TYPE.body} space-y-3`} data-testid="port-what-would-change">
        <DriverTornado model={model} framed={false} />
        <Sensitivity model={model} />
        {unsaid.map((card) => {
          const d = card.driver!, figure = figureCard(model, d)
          return (
            <div key={card.id} className="space-y-1" data-testid="port-unsaid-driver" data-option-id={card.id} title={d.title}>
              <p className="font-medium text-text-header" data-view={`${card.id}.heading`}>{card.heading}</p>
              <p className="text-text-body" data-view={`${card.id}.driver.text`}>{d.text}</p>
              {figure === null ? null : <p className={`${TYPE.meta} text-text-light`} data-view={`${figure.id}.heading`}>{figure.heading}</p>}
            </div>
          )
        })}
      </div>
    </Accordion>
  )
}

export default WhatWouldChange
