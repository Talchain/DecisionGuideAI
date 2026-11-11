/**
 * "Stress test", restored (UI recovery row 17, DL 10 Nov 2026): the previous product's accordion and its bordered cards, open at first,
 * fed by core's View. It is the tab's one home for what would test the result; each group sits under core's own heading and every line
 * is core's, verbatim, with core's hover:
 * - what would have to be true (`run.tipping`, `tipping_heading`), and an aim's silent line where core says why it has none;
 * - what could go wrong (`run.failure`, `failure_heading`; core fills it only for an option someone committed to);
 * - how much rests on Olumi's guesses (`run.rests`, `rests_heading`); under each line, where core sends them, its figures one by one
 *   (`rests[].figures`, under `rests_figures_heading`): core's line for each, verbatim, whose it is by core's mark, a bar whose length is
 *   core's `share` (a position only, never drawn as a number), and the figure's own edit where core offers one (`give`). These are shares of
 *   the UNCERTAINTY in this model, counting each figure on its own, never shares of the chance; they do not add up to the whole, so the
 *   parent line, which says what is not attributed to any one figure, is always drawn above them (Codex PL-218).
 * The previous section's own sentences (sensitive assumptions, thinking patterns, fragile factors) are not drawn: they were composed
 * from a winner, a runner-up and flip rates, none of which core sends. Nothing here when core sends none of the three.
 */
import { Accordion } from '../../components/results/Accordion'
import { typography } from '../../styles/typography'
import type { ViewModel } from '../client'
import { failureOf, restsOf, tippingOf } from '../layout'
import { FigureEdit } from '../FigureEdit'
import { TYPE } from './type'

const CARD = 'rounded-lg border border-panel-border px-3 py-2'
type Mark = { glyph: string; title: string } | null | undefined
type RestsLine = NonNullable<NonNullable<ViewModel['run']>['rests']>[number]

/** One figure's share of the uncertainty: core's line, its mark, a bar from `share` (position only), and the card's own edit if core offers it. */
function RestsFigures({ line, i, heading }: { line: RestsLine; i: number; heading: string | undefined }) {
  const figures = line.figures ?? []
  if (figures.length === 0) return null
  return (
    <div className="space-y-1.5 pl-2" data-testid={`port-rests-figures-${line.id}`}>
      {heading == null || heading === '' ? null : <p className={`${typography.panelBody} font-medium text-text-header`} data-view="run.rests_figures_heading">{heading}</p>}
      {figures.map((f, j) => (
        <div key={f.id} className="space-y-0.5" data-rests-figure={f.id} data-whose={f.whose}>
          <p className={`${typography.panelBody} text-text-body`}>
            {f.mark === null ? null : <><span className={f.whose === 'olumi' ? 'text-info' : 'text-text-body'} title={f.mark.title} aria-label={f.mark.title} data-testid="port-rests-figure-mark">{f.mark.glyph}</span> </>}
            <span data-view={`run.rests.${i}.figures.${j}.line`}>{f.line}</span>
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/5" aria-hidden="true">
            <div className={`h-full rounded-full ${f.whose === 'olumi' ? 'bg-info' : 'bg-text-light'}`} style={{ width: `${Math.max(0, Math.min(1, f.share)) * 100}%` }} data-testid="port-rests-figure-bar" />
          </div>
          {f.give === null ? null : (
            <div className={`${TYPE.meta} text-text-light`} data-testid="port-rests-figure-give">
              <FigureEdit id={f.id} edit={f.give.edit} place="rests" glyph="✎" words={false} lead={f.give.text} label={`${f.give.text}: ${f.label}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Line({ id, at, text, hover, olumi }: { id: string; at: string; text: string; hover: string; olumi?: Mark }) {
  return (
    <p className={`${typography.panelBody} ${CARD} text-text-body`} title={hover} data-view-fact={id}>
      {olumi == null ? null : <><span title={olumi.title} aria-label={olumi.title}>{olumi.glyph}</span> </>}
      <span data-view={at}>{text}</span>
    </p>
  )
}

export function StressTest({ model }: { model: ViewModel }) {
  const run = model.run ?? null
  const tipping = tippingOf(run), failure = failureOf(run), rests = restsOf(run)
  const total = (tipping === null ? 0 : tipping.lines.length + tipping.silent.length) + (failure?.lines.length ?? 0) + (rests?.lines.length ?? 0)
  if (total === 0) return null
  return (
    <Accordion title="Stress test" defaultExpanded badgeCount={total} testId="accordion-stress-test">
      <div className="space-y-3" data-testid="port-stress-test">
        {tipping === null || tipping.lines.length + tipping.silent.length === 0 ? null : (
          <div className="space-y-1.5" data-testid="port-stress-tipping">
            <h4 className={`${typography.panelHeader} text-text-header`} data-view="run.tipping_heading">{tipping.heading}</h4>
            {tipping.lines.map(({ line: l, i }) => <Line key={l.id} id={l.id} at={`run.tipping.${i}.line`} text={l.line} hover={l.hover} olumi={l.olumi} />)}
            {tipping.silent.map((s) => <p key={s.aim} className={`${typography.panelBody} ${CARD} text-text-light`} data-view-silent={s.aim}>{s.line}</p>)}
          </div>
        )}
        {([['failure', failure, 'run.failure'], ['rests', rests, 'run.rests']] as const).map(([key, facts, path]) => (facts === null ? null : (
          <div key={key} className="space-y-1.5" data-testid={`port-stress-${key}`}>
            <h4 className={`${typography.panelHeader} text-text-header`} data-view={`${path}_heading`}>{facts.heading}</h4>
            {facts.lines.map(({ line: l, i }) => (
              <div key={l.id} className="space-y-1.5">
                <Line id={l.id} at={`${path}.${i}.line`} text={l.line} hover={l.hover} />
                {key === 'rests' ? <RestsFigures line={l as RestsLine} i={i} heading={run?.rests_figures_heading} /> : null}
              </div>
            ))}
          </div>
        )))}
      </div>
    </Accordion>
  )
}

export default StressTest
