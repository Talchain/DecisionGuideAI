/**
 * An option's chance drawn as a track: the fill to the chance (as before), core's range as a band behind it, the chance marked, and the range
 * in core's own words as the track's tip on hover and focus (UI-BRIEF-20261115; it was a caption beneath). And, under it, how much of the result rests on Olumi's estimates, as a two-tone fill that opens the Rests on
 * view. Everything is read from the View (resultRange.ts); Olumi's estimates take Olumi's blue, the person's own figures the ink, and what
 * core does not attribute (`unassigned`) its own grey segment, never counted as the person's. The words are core's own line for the entry, whatever the split (restWordsOf), held to two lines on the card with the whole line in the button's title and in the Rests on view, or a neutral link where it serves none; the shares set the bar widths only. Entries of kind 'limit' are deliberately not drawn on the card, and the first goal entry for the option and aim is the one used (restsShareOf). The track keeps its 3 px height and margins: the band and the mark are drawn out of flow.
 */
import type { ViewCard } from './client'
import { useViewStore } from './store'
import { useViewLens } from './lens'
import { chanceAtOf, rangeBandOf, restWordsOf, restsShareOf, shareWidths } from './resultRange'

export function ChanceBand({ card }: { card: ViewCard }): JSX.Element | null {
  const at = chanceAtOf(card)
  if (at === null) return null
  const range = card.headline?.range ?? null, band = rangeBandOf(range), id = card.id
  // UI-BRIEF-20261115 (Paul, 15 Nov: "so much text and busy content"; DL ruling 02:0xZ): core's range sentence is no longer printed under every
  // card. It is the band's own words, byte for byte: shown on hover and on keyboard focus of the track (the tip), and its accessible name. The
  // band, the fill and the mark keep their places; quarter ticks put every card's track on one readable scale. No range: the track is as before.
  const words = range == null || range === '' ? null : range
  return (
    <span className={`ok-track${words === null ? '' : ' nodrag'}`} aria-hidden={words === null ? 'true' : undefined} role={words === null ? undefined : 'img'}
      aria-label={words ?? undefined} tabIndex={words === null ? undefined : 0} data-view={`${id}.chance.track`}>
      {band === null ? null : <i className="ok-band" data-band={id} data-open-low={band.openLow ? '' : undefined} data-open-high={band.openHigh ? '' : undefined}
        style={{ left: `${band.from}%`, width: `${band.to - band.from}%` }} />}
      <span style={{ width: `${at * 100}%` }} />
      <i className="ok-tick" style={{ left: '25%' }} aria-hidden="true" />
      <i className="ok-tick" style={{ left: '50%' }} aria-hidden="true" />
      <i className="ok-tick" style={{ left: '75%' }} aria-hidden="true" />
      <i className="ok-mark-chance" data-chance-mark={id} style={{ left: `${at * 100}%` }} />
      {words === null ? null : <span className="ok-range-tip" aria-hidden="true" data-view={`${id}.headline.range`} data-range-caption={id}>{words}</span>}
    </span>
  )
}

export function RestsShareFill({ card }: { card: ViewCard }): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  const share = restsShareOf(model, card)
  if (share === null) return null
  const said = restWordsOf(share)
  const w = shareWidths(share)
  return (
    <button type="button" className="ok-share nodrag nopan" data-rests-share={card.id} data-rests-basis={said.basis} title={said.basis === 'line' ? said.words : share.hover}
      onClick={() => useViewLens.setState({ lens: 'rests_on' })}>
      <span className="ok-share-bar" aria-hidden="true">
        <i className="ok-share-olumi" data-share-olumi={card.id} style={{ width: `${w.olumi}%` }} />
        <i className="ok-share-person" data-share-person={card.id} style={{ width: `${w.person}%` }} />
        <i className="ok-share-unassigned" data-share-unassigned={card.id} style={{ width: `${w.unassigned}%` }} />
      </span>
      {/* The card holds core's line to two lines so the card keeps a bounded height; the WHOLE line stays reachable: it is the button's title, and pressing the
          button opens Rests on, which draws every entry's full line (restsOf). Only the line is a View string; the neutral label is the UI's. */}
      {said.basis === 'line'
        ? <span className="line-clamp-2" data-view={`${card.id}.rests.line`}>{said.words}</span>
        : <span data-rests-neutral={card.id}>{said.words}</span>}
    </button>
  )
}
