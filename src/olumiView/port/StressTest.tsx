/**
 * "Stress test", restored (UI recovery row 17, DL 10 Nov 2026): the previous product's accordion and its bordered cards, open at first,
 * fed by core's View. It is the tab's one home for what would test the result; each group sits under core's own heading and every line
 * is core's, verbatim, with core's hover:
 * - what would have to be true (`run.tipping`, `tipping_heading`), and an aim's silent line where core says why it has none;
 * - what could go wrong (`run.failure`, `failure_heading`; core fills it only for an option someone committed to);
 * - how much rests on Olumi's guesses (`run.rests`, `rests_heading`).
 * The previous section's own sentences (sensitive assumptions, thinking patterns, fragile factors) are not drawn: they were composed
 * from a winner, a runner-up and flip rates, none of which core sends. Nothing here when core sends none of the three.
 */
import { Accordion } from '../../components/results/Accordion'
import { typography } from '../../styles/typography'
import type { ViewModel } from '../client'
import { failureOf, restsOf, tippingOf } from '../layout'

const CARD = 'rounded-lg border border-panel-border px-3 py-2'
type Mark = { glyph: string; title: string } | null | undefined

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
            {facts.lines.map(({ line: l, i }) => <Line key={l.id} id={l.id} at={`${path}.${i}.line`} text={l.line} hover={l.hover} />)}
          </div>
        )))}
      </div>
    </Accordion>
  )
}

export default StressTest
