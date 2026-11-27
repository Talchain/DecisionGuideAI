import { useId, useLayoutEffect, useState } from 'react'
import { unitIsDisplayable } from '../../../utils/unitClassifier'
import { typography } from '../../../styles/typography'
import type { View, ViewRun } from '../../client'
import { optionCards } from '../../layout'
import { Hover } from '../../look/Hover'
import { useViewStore } from '../../store'
import { Row, WhatIfSizeLines } from '../../ViewChances'
import { clearSliderPreview, syncWhatIfBase, trySliderPoint, useWhatIfSliderStore } from './whatIfSliderStore'
import { figureRange } from '../contract'

export const WHAT_IF_SLIDER_WORDS = {
  label: 'Try a what-if',
  pending: 'Trying…',
  release: 'Release to try this value',
  preview: 'What-if, not saved',
  clear: 'Clear',
  ineligible: 'To try a value, this figure needs an editable number with a unit. Olumi assumptions also need a visible basis.',
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
  const run = view.model?.run
  const unitAsk = run?.ask?.about.includes(quantity) ? run.ask.text : null
  const reason = unitAsk ?? run?.waits_on?.items.find((item) => item.id === quantity)?.title
  const refused = { reason: reason || WHAT_IF_SLIDER_WORDS.ineligible }
  if (!card || figure?.edit == null || 'route' in figure.edit || figure.state === 'waits'
    || !range || range.low > range.high || unitAsk !== null || !unitIsDisplayable(range.unit)) return refused

  const author = card.author
  // Core's author title uses a colon only when its current Olumi origin supplies
  // a basis. A bare attribution and a rename alone don't qualify.
  const assumption = author?.by === 'olumi' && /^Proposed by Olumi:\s+\S/.test(author.title) ? author.title : null
  if (assumption === null && author?.by !== 'person' && author?.by !== 'brief' && author?.by !== 'mixed') return refused

  const common = { range, label: card.heading, words: figure.text, title: figure.title, assumption }
  if (range.low < range.high) return { ...common, kind: 'range' as const }
  if (range.likely === range.low) return { ...common, kind: 'point' as const }
  return refused
}

export function useWhatIfBase(view: View) {
  const at = useViewStore((state) => state.sid === view.id ? state.at : null)
  const stale = useViewStore((state) => state.sid === view.id && (state.stale || state.error !== null))
  const latest = useViewStore((state) => state.sid === view.id ? state.view?.version?.id ?? null : undefined)
  const base = view.version?.id
  return base == null || at !== null || stale || view.proposal != null || view.model?.edit_base !== base
    || (latest !== undefined && latest !== base) ? null : base
}

type RunId = string | number

// Chat passes the pinned visual's version and Run. Older Views may omit the Run id.
export function WhatIfSlider({ view, quantity, pinnedVersion, pinnedRun, currentRun }: {
  view: View; quantity: string; pinnedVersion?: number; pinnedRun?: RunId | null; currentRun?: RunId | null
}) {
  const base = useWhatIfBase(view)
  useLayoutEffect(() => { if (base !== null) syncWhatIfBase(view.id, base) }, [view.id, base])
  const run = (view.model?.run as (ViewRun & { id?: RunId }) | null | undefined)?.id ?? currentRun
  if (base === null || (pinnedVersion !== undefined && pinnedVersion !== base)
    || (pinnedRun != null && run != null && pinnedRun !== run)) return null

  const input = whatIfInputOf(view, quantity)
  if ('reason' in input) return <p className={META}>{input.reason}</p>

  return <SliderPreview key={JSON.stringify([view.id, base, quantity, input.kind])} view={view} base={base} quantity={quantity} input={input} />
}

function SliderPreview({ view, base, quantity, input }: {
  view: View; base: number; quantity: string; input: Exclude<ReturnType<typeof whatIfInputOf>, { reason: string }>
}) {
  const id = useId()
  const { range, words, assumption } = input
  const start = range.likely ?? (range.low / 2 + range.high / 2)
  const [draft, setDraft] = useState<string | null>(null)
  const preview = useWhatIfSliderStore(({ scenarios }) => {
    const current = scenarios.get(view.id)
    return current?.base === base ? current.records.get(quantity) : undefined
  })

  function clear() {
    setDraft(null)
    clearSliderPreview(view.id, base, quantity)
  }

  function release(value: number) {
    if (draft === null || !Number.isFinite(value)) return
    if (input.kind === 'range' && (value < range.low || value > range.high)) return
    setDraft(null)
    void trySliderPoint(view.id, base, quantity, value)
  }

  const variant = preview?.variant
  const edit = variant?.edits.find((item) => item.quantity === quantity)
  const status = preview?.pending ? WHAT_IF_SLIDER_WORDS.pending
    : preview?.notice ?? variant?.stopped ?? variant?.blocked ?? variant?.why_not ?? (preview && !variant ? WHAT_IF_SLIDER_WORDS.unavailable : null)
  const model = view.model!
  return (
    <div className="grid min-w-0 gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className={META}>{WHAT_IF_SLIDER_WORDS.label}</label>
        {preview !== undefined && <button type="button" onClick={clear} className={`${META} ${FOCUS} underline`}>{WHAT_IF_SLIDER_WORDS.clear}</button>}
      </div>
      {input.kind === 'point' ? (
        <div className="flex items-center gap-2">
          <input id={id} type="number" step="any" value={draft ?? preview?.position ?? start}
            aria-describedby={`${id}-unit`}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); release(event.currentTarget.valueAsNumber) }
            }}
            onBlur={(event) => { release(event.currentTarget.valueAsNumber); setDraft(null) }}
            className={`${typography.viewPanelBody} ${FOCUS} min-w-0 grow rounded-sm border border-panel-border bg-panel px-2 text-text-body`} />
          <span id={`${id}-unit`} className={META}>{range.unit}</span>
        </div>
      ) : <input id={id} type="range" min={range.low} max={range.high} step="any"
        value={draft ?? preview?.position ?? start}
        aria-valuetext={draft !== null ? WHAT_IF_SLIDER_WORDS.release : edit?.words ?? (preview?.pending ? WHAT_IF_SLIDER_WORDS.pending : words)}
        aria-describedby={`${id}-figure`}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onPointerUp={(event) => void release(event.currentTarget.valueAsNumber)}
        onPointerCancel={() => setDraft(null)}
        onKeyUp={(event) => { if (RELEASE_KEYS.includes(event.key)) void release(event.currentTarget.valueAsNumber) }}
        onBlur={(event) => void release(event.currentTarget.valueAsNumber)}
        className={`${FOCUS} w-full accent-text-header`} />}
      <div id={`${id}-figure`} className={META}>
        <span>{input.label}</span>
        {preview === undefined && <Hover as="p" words={input.title} className="m-0">{words}</Hover>}
        {assumption !== null && <div>{assumption}</div>}
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
