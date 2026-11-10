/**
 * A4 (DL briefs 10 Nov, Paul: Compare was worse than the previous product): core's version comparison drawn in the previous Compare tab's
 * layout (`canvas/compare-tab/ComparePairSections`, `CompareRunPairBody`): the two ends first ("Earlier → Latest"), one headline, each
 * option's chance earlier → now on the previous slope (`PairChanceSlope`, reused unchanged), then the changes between the two, in ruled
 * sections. Every word and number is core's (`GET /api/scenarios/:s/compare`): nothing is ranked or chosen here, and no field core does not
 * send is made up (core's change lines carry no record ids, so they are listed, not linked to the canvas).
 */
import { ArrowRight } from 'lucide-react'
import { typography } from '../styles/typography'
import { icon, PANEL_RULE } from '../components/results/analysisNew/panelSurfaces'
import { PairChanceSlope } from '../canvas/compare-tab/PairChanceSlope'
import type { PairChanceFigures, PairChanceRow, PairChanceSide } from '../canvas/runView/runView'
import { ChangeItem, what, whoOf, type Compared, type Move } from './compare'

/** Its own test id: the CEE lane's run pair keeps `compare-run-pair` (J1 binds it to a Run's ids, which core's versions do not carry). */
export const COMPARE_SECTIONS_TESTID = 'core-compare-sections'

const headOf = (s: NonNullable<Move['before']>) => (typeof s.headline === 'string' && s.headline.trim() !== '' ? s.headline : s.value)
/** A side's mark: core's own number (0 to 1) placed on the track, with core's words; none where core gives no number (never a mark at 0%). */
const sideOf = (s: Move['before']): PairChanceSide | null =>
  s && typeof s.chance === 'number' && Number.isFinite(s.chance) && s.chance >= 0 && s.chance <= 1 ? { kind: 'point', words: headOf(s), scaleAt: s.chance * 100 } : null

/** Each chance result as a slope row, by core's own label for it ("‘Add one specialist’ on ‘At least 100 a week’"); a result with no number on
 *  either side is a row with core's words as its note. No claim: which option is ahead is core's to say (its most-likely line), never this module's. */
export function figuresOf(c: Compared): PairChanceFigures {
  const rows: PairChanceRow[] = c.results.filter((r) => r.kind === 'chance').map((r, i) => {
    const earlier = sideOf(r.before), now = sideOf(r.after)
    const row = { optionId: `${r.option ?? 'option'}:${i}`, label: what(r), earlier, now }
    return earlier === null && now === null ? { ...row, note: `${r.before ? headOf(r.before) : 'none'} → ${r.after ? headOf(r.after) : 'none'}` } as PairChanceRow : row as PairChanceRow
  })
  return { rows, claim: null, chanceWords: null, notCurrent: false } as PairChanceFigures
}

/** The headline: core's own most-likely line for the later version, with the earlier one where it differs; else what the section holds. */
function headlineOf(c: Compared): string {
  const lead = c.results.find((r) => r.kind === 'most_likely' && r.after)
  if (!lead || !lead.after) return 'How the results moved'
  const was = lead.before ? headOf(lead.before) : null, now = headOf(lead.after)
  return was !== null && was !== now ? `${what(lead)}: ${now} (was ${was})` : `${what(lead)}: ${now}`
}

const when = (at: string) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? '' : ` · ${d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` }

export function CompareSections({ c }: { c: Compared }): JSX.Element {
  // Core always reads from the lower version to the higher (service.ts compare: [lo, hi]); its `versions` list runs in that order.
  const first = c.versions[0], last = c.versions[c.versions.length - 1]
  const figures = figuresOf(c)
  const others = c.results.filter((r) => r.kind === 'limit')
  return (
    <div className="px-4 pt-2 pb-4 space-y-4" data-testid={COMPARE_SECTIONS_TESTID}>
      <section data-compare-section="headline" aria-label="What changed between versions">
        <p className={`${typography.panelMeta} text-text-light flex items-center justify-between gap-3 mt-0 mb-2`} data-testid="compare-run-times">
          <span>{first ? `Version ${first.n}${when(first.at)}` : ''}</span>
          <ArrowRight className={`${icon('inline')} flex-shrink-0`} aria-hidden="true" />
          <span>{last ? `Version ${last.n}${when(last.at)}` : ''}</span>
        </p>
        <h3 className={`${typography.panelHeader} text-text-header m-0`} data-testid="compare-headline">{headlineOf(c)}</h3>
        <PairChanceSlope figures={figures} />
        {others.length ? (
          <ul className="list-none p-0 m-0 mt-3 space-y-1" data-testid="compare-limits">
            {others.map((r, i) => <li key={i} className={`${typography.panelBody} text-text-body`}>{what(r)}: {r.before ? headOf(r.before) : 'none'} → {r.after ? headOf(r.after) : 'none'}</li>)}
          </ul>
        ) : null}
      </section>
      <section className={PANEL_RULE} data-compare-section="inputs" aria-labelledby="compare-input-changes-heading">
        <h4 id="compare-input-changes-heading" className={`${typography.panelMeta} text-text-light m-0 mb-2`}>Changed between the two versions</h4>
        {c.changes.length
          ? <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="compare-changes">{c.changes.map((l, i) => <ChangeItem key={i} l={l} />)}</ul>
          : <p className={`${typography.panelBody} text-text-light m-0`} data-testid="compare-changes-none">No change to the model</p>}
      </section>
      <section className={PANEL_RULE} data-compare-section="who" aria-labelledby="compare-who-heading">
        <h4 id="compare-who-heading" className={`${typography.panelMeta} text-text-light m-0 mb-2`}>Who proposed and approved</h4>
        <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="compare-who">
          {c.versions.map((v) => <li key={v.n} className={`${typography.panelBody} text-text-body`}><span className="text-text-header">Version {v.n}:</span> {whoOf(v)}</li>)}
        </ul>
      </section>
    </div>
  )
}
