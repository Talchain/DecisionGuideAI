import { useId, useLayoutEffect, useRef, useState } from 'react'
import { TeamApiError } from '../../../olumiCore/team/api'
import { typography } from '../../../styles/typography'
import type { View } from '../../client'
import { optionCards } from '../../layout'
import { Hover } from '../../look/Hover'
import { WhatIfBars } from '../../port/WhatIfBars'
import { useViewStore } from '../../store'
import { Row, WhatIfSizeLines } from '../../ViewChances'
import { runWhatIf, WHAT_IF_STALE, type WhatIfVariant } from '../../whatif'
import { figureRange } from '../contract'

export const WHAT_IF_SLIDER_WORDS = {
  label: 'Try a what-if',
  pending: 'Trying…',
  release: 'Release to try this value',
  preview: 'What-if, not saved',
  clear: 'Clear',
  ineligible: 'To try a value, this figure needs an editable numeric range and a visible basis if Olumi supplied it.',
  unavailable: 'Olumi could not read this what-if.',
} as const

const META = `${typography.viewPanelMeta} text-text-body`
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header'
const RELEASE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']

export function whatIfInputOf(view: View, quantity: string) {
  // A closed badge carries identities alone. Use the visible record itself, never its folded parent or an option's result row.
  const card = view.model?.cards.find((item) => item.id === quantity && item.family === 'quantity')
  const figure = card?.figure
  const range = card && figureRange(card)
  const reason = view.model?.run?.waits_on?.items.find((item) => item.id === quantity)?.title
  const refused = { reason: reason || WHAT_IF_SLIDER_WORDS.ineligible }
  if (!card || figure?.edit == null || 'route' in figure.edit || figure.state === 'waits'
    || !range || range.low >= range.high) return refused

  const author = card.author
  if (author?.by === 'person' || author?.by === 'brief' || author?.by === 'mixed') {
    return { range, label: card.heading, words: figure.text, assumption: null }
  }
  // The author hover can contain only an attribution. Figure-first is the View's
  // separate, typed basis, and is usable here only when it identifies this saved figure.
  const given = view.session?.figure_first?.given
  const basis = given?.olumi
  if (author?.by === 'olumi' && range.unit.trim() && given?.quantity === quantity && basis?.version === view.version?.n
    && basis?.unit === range.unit && basis.low === range.low && basis.high === range.high
    && basis.likely === range.likely && basis.basis.trim()) {
    return { range, label: card.heading, words: figure.text, assumption: { author: author.text, basis: basis.basis } }
  }
  return refused
}

type Preview = {
  position: number | null
  pending: boolean
  notice: string | null
  variant: WhatIfVariant | null
}
type Flight = { scenario: string; quantity: string; base: number }

// Pass the current View at both mounts. A chat host also pins its visual's version
// and can omit the mount when its frozen Run no longer matches.
export function WhatIfSlider({ view, quantity, pinnedVersion }: {
  view: View; quantity: string; pinnedVersion?: number
}) {
  const at = useViewStore((state) => state.sid === view.id ? state.at : null)
  const stale = useViewStore((state) => state.sid === view.id && (state.stale || state.error !== null))
  const latest = useViewStore((state) => state.sid === view.id ? state.view?.version?.id ?? null : undefined)
  const [flight, setFlight] = useState<Flight | null>(null)
  const base = view.version?.id
  if (base == null || at !== null || stale || view.proposal != null || view.model?.edit_base !== base
    || (latest !== undefined && latest !== base) || (pinnedVersion !== undefined && pinnedVersion !== base)) return null

  const input = whatIfInputOf(view, quantity)
  if ('reason' in input) return <p className={META}>{input.reason}</p>

  const superseded = flight?.scenario === view.id && flight.quantity === quantity && flight.base !== base
  return <SliderPreview key={JSON.stringify([view.id, base, quantity])} view={view} base={base} quantity={quantity} input={input}
    superseded={superseded} setFlight={setFlight} />
}

function SliderPreview({ view, base, quantity, input, superseded, setFlight }: {
  view: View; base: number; quantity: string; input: Exclude<ReturnType<typeof whatIfInputOf>, { reason: string }>
  superseded: boolean; setFlight: (flight: Flight | null) => void
}) {
  const id = useId()
  const { range, words, assumption } = input
  const start = range.likely ?? (range.low / 2 + range.high / 2)
  const [draft, setDraft] = useState<number | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const request = useRef(0)
  const committed = useRef<number | null>(null)
  useLayoutEffect(() => () => { request.current += 1 }, [])

  function clear() {
    request.current += 1
    committed.current = null
    setFlight(null)
    setDraft(null)
    setPreview(null)
  }

  async function release(value: number) {
    if (draft === null || value === committed.current || !Number.isFinite(value) || value < range.low || value > range.high) return
    committed.current = value
    const ticket = ++request.current
    setFlight({ scenario: view.id, quantity, base })
    setDraft(null)
    setPreview({ position: value, pending: true, notice: null, variant: null })
    try {
      const variant = await runWhatIf(view.id, base, quantity, { kind: 'point', value })
      if (request.current !== ticket) return
      setFlight(null)
      setPreview({ position: value, pending: false, variant, notice: variant === null ? WHAT_IF_SLIDER_WORDS.unavailable : null })
    } catch (error) {
      if (request.current !== ticket) return
      setFlight(null)
      const coreMessage = error instanceof TeamApiError && (error.body as { error?: unknown } | null)?.error
      const message = typeof coreMessage === 'string' && coreMessage ? coreMessage
        : error instanceof TeamApiError && !error.uncertain ? error.message : WHAT_IF_SLIDER_WORDS.unavailable
      committed.current = null
      setPreview({ position: null, pending: false, variant: null, notice: message })
    }
  }

  const variant = preview?.variant
  const edit = variant?.edits.find((item) => item.quantity === quantity)
  const status = preview?.pending ? WHAT_IF_SLIDER_WORDS.pending
    : preview?.notice ?? variant?.stopped ?? variant?.blocked ?? variant?.why_not ?? (superseded ? WHAT_IF_STALE : null)
  const model = view.model!
  return (
    <div className="grid min-w-0 gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className={META}>{WHAT_IF_SLIDER_WORDS.label}</label>
        {(preview !== null || superseded) && <button type="button" onClick={clear} className={`${META} ${FOCUS} underline`}>{WHAT_IF_SLIDER_WORDS.clear}</button>}
      </div>
      <input id={id} type="range" min={range.low} max={range.high} step="any"
        value={draft ?? preview?.position ?? start}
        aria-valuetext={draft !== null ? WHAT_IF_SLIDER_WORDS.release : edit?.words ?? (preview?.pending ? WHAT_IF_SLIDER_WORDS.pending : words)}
        aria-describedby={`${id}-figure`}
        onChange={(event) => setDraft(event.currentTarget.valueAsNumber)}
        onPointerUp={(event) => void release(event.currentTarget.valueAsNumber)}
        onPointerCancel={() => setDraft(null)}
        onKeyUp={(event) => { if (RELEASE_KEYS.includes(event.key)) void release(event.currentTarget.valueAsNumber) }}
        onBlur={(event) => void release(event.currentTarget.valueAsNumber)}
        className={`${FOCUS} w-full accent-text-header`} />
      <div id={`${id}-figure`} className={META}>
        <span>{input.label}</span>
        {preview === null && <p className="m-0">{words}</p>}
        {assumption !== null && <div><div>{assumption.author}</div><div>{assumption.basis}</div></div>}
      </div>
      <div role="status" className={META}>
        {status}
      </div>
      {variant != null && (
        <div className={`${typography.viewPanelBody} grid gap-1 text-text-body`} aria-label={WHAT_IF_SLIDER_WORDS.preview}>
          <div className={META}>{WHAT_IF_SLIDER_WORDS.preview}</div>
          {edit && <div>{edit.words}</div>}
          {variant.stopped == null && variant.blocked == null && (
            <>
              {variant.most_likely && <Hover words={variant.most_likely.title}>{variant.most_likely.text}</Hover>}
              {optionCards(model).map((card) => {
                const rows = variant.rows.find((group) => group.option_id === card.id)?.rows ?? []
                if (rows.length === 0 && !variant.size?.some((size) => size.option === card.id)) return null
                return (
                  <div key={card.id}>
                    <div className={typography.viewPanelHeading}>{card.heading}</div>
                    <WhatIfBars card={card} rows={rows} facts={variant.facts} />
                    {rows.map((row, i) => <Row key={i} card={{ ...card, id: `whatif.${id}.${card.id}` }} row={row} i={i} />)}
                    <WhatIfSizeLines variant={variant} option={card.id} />
                  </div>
                )
              })}
              {variant.facts?.map(({ id: fact, about, text }) =>
                about?.kind === 'input' && about.olumi === true && text ? <p key={fact} className={META}>{text}</p> : null)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
