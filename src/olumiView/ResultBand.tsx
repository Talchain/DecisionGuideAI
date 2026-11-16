/**
 * An option's chance drawn as a track: the fill to the chance (as before), core's range as a band behind it, the chance marked, and the range
 * in core's own words as the track's tip on hover and focus (UI-BRIEF-20261115; it was a caption beneath). And, under it, how much of the result rests on Olumi's estimates, as a two-tone fill that opens the Rests on
 * view. Everything is read from the View (resultRange.ts); Olumi's estimates take Olumi's blue, the person's own figures the ink, and what
 * core does not attribute (`unassigned`) its own grey segment, never counted as the person's. The words are core's own line for the entry, whatever the split (restWordsOf), held to two lines on the card with the whole line in the button's title and in the Rests on view, or a neutral link where it serves none; the shares set the bar widths only. Entries of kind 'limit' are deliberately not drawn on the card, and the first goal entry for the option and aim is the one used (restsShareOf). The track keeps its 3 px height and margins: the band and the mark are drawn out of flow.
 */
import { useState } from 'react'
import type { ViewCard } from './client'
import { useViewStore } from './store'
import { useViewLens } from './lens'
import { chanceAtOf, NEUTRAL_REST_WORDS, rangeBandOf, restWordsOf, restsShareOf, shareWidths } from './resultRange'

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
      {/* `hidden` at rest (never on the card face, whatever the cascade); olumiLook.css shows it while the track is hovered or focused. Not a
          span, so the track's `> span` (the fill) rule can never reach it. */}
      {words === null ? null : <small className="ok-range-tip ok-pop" hidden aria-hidden="true" data-view={`${id}.headline.range`} data-range-caption={id}>{words}</small>}
    </span>
  )
}

export function RestsShareFill({ card }: { card: ViewCard }): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  const share = restsShareOf(model, card)
  const [open, setOpen] = useState(false)
  if (share === null) return null
  const said = restWordsOf(share)
  const w = shareWidths(share)
  // DL 15 Nov: a title is hover only; pressing the label also shows the whole sentence under it, out of the card's flow (as "Why not"), so
  // keyboard and touch reach it. Not in the page until pressed: the face keeps only the label.
  const whole = said.basis === 'line' ? said.words : share.hover
  return (
    <span className="ok-share-wrap" data-rests-wrap={card.id}>
    <button type="button" className="ok-share nodrag nopan" data-rests-share={card.id} data-rests-basis={said.basis} title={whole} aria-expanded={open}
      onClick={() => { setOpen((o) => !o); useViewLens.setState({ lens: 'rests_on' }) }}>
      <span className="ok-share-bar" aria-hidden="true">
        <i className="ok-share-olumi" data-share-olumi={card.id} style={{ width: `${w.olumi}%` }} />
        <i className="ok-share-person" data-share-person={card.id} style={{ width: `${w.person}%` }} />
        <i className="ok-share-unassigned" data-share-unassigned={card.id} style={{ width: `${w.unassigned}%` }} />
      </span>
      {/* DL 15 Nov (Paul: "so much text and busy content"): core's line is off the card face. The face says only the UI's short label; core's
          line is the button's title, and pressing it opens Rests on, which draws every entry's line whole (restsOf). */}
      <span data-rests-neutral={card.id}>{NEUTRAL_REST_WORDS}</span>
    </button>
    {open && whole ? <p className="ok-pop nodrag nopan" role="note" data-rests-said={card.id}>{whole}</p> : null}
    </span>
  )
}
