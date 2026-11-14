/**
 * An option's chance drawn as a track: the fill to the chance (as before), core's range as a band behind it, the chance marked, and the range
 * in core's own words beneath. And, under it, how much of the result rests on Olumi's estimates, as a two-tone fill that opens the Rests on
 * view. Everything is read from the View (resultRange.ts); Olumi's estimates take Olumi's blue, the person's own figures the ink, and what
 * core does not attribute stays the track. The track keeps its 3 px height and margins: the band and the mark are drawn out of flow.
 */
import type { ViewCard } from './client'
import { useViewStore } from './store'
import { useViewLens } from './lens'
import { chanceAtOf, rangeBandOf, restsShareOf, shareWidths, sharedWords } from './resultRange'

export function ChanceBand({ card }: { card: ViewCard }): JSX.Element | null {
  const at = chanceAtOf(card)
  if (at === null) return null
  const range = card.headline?.range ?? null, band = rangeBandOf(range), id = card.id
  return (
    <>
      <span className="ok-track" aria-hidden="true" data-view={`${id}.chance.track`}>
        {band === null ? null : <i className="ok-band" data-band={id} data-open-low={band.openLow ? '' : undefined} data-open-high={band.openHigh ? '' : undefined}
          style={{ left: `${band.from}%`, width: `${band.to - band.from}%` }} />}
        <span style={{ width: `${at * 100}%` }} />
        <i className="ok-mark-chance" data-chance-mark={id} style={{ left: `${at * 100}%` }} />
      </span>
      {range == null || range === '' ? null : <p className="ok-qual line-clamp-2" title={range} data-view={`${id}.headline.range`} data-range-caption={id}>{range}</p>}
    </>
  )
}

export function RestsShareFill({ card }: { card: ViewCard }): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  const share = restsShareOf(model, card)
  if (share === null) return null
  const words = sharedWords(share)
  if (words === null) return null
  const w = shareWidths(share)
  return (
    <button type="button" className="ok-share nodrag nopan" data-rests-share={card.id} title={share.hover === '' ? share.line : share.hover}
      onClick={() => useViewLens.setState({ lens: 'rests_on' })}>
      <span className="ok-share-bar" aria-hidden="true">
        <i className="ok-share-olumi" data-share-olumi={card.id} style={{ width: `${w.olumi}%` }} />
        <i className="ok-share-person" data-share-person={card.id} style={{ width: `${w.person}%` }} />
      </span>
      <span data-view={`${card.id}.rests.words`}>{words}</span>
    </button>
  )
}
