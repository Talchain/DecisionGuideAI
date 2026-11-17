/** Scale helpers shared by the V12 scale components: one true linear axis per card, never shaded as a probability. Pure. */
import type { ViewCard, ViewModel } from '../../client'

export interface Axis { min: number; max: number; ticks: number[] }

/** A 0-based axis (or from the lowest value when something is negative) reaching `hi`, with 1-2-5 ticks. */
export function axisOf(lo: number, hi: number, want = 4): Axis {
  const min = Math.min(0, lo)
  const top = Math.max(hi, min + 1e-9)
  const raw = (top - min) / want
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag
  const first = Math.ceil(min / step - 1e-9) * step
  const max = Math.ceil(top / step - 1e-9) * step
  const ticks: number[] = []
  for (let t = first; t <= max + step * 1e-6; t += step) ticks.push(Math.round(t / step) * step + 0)
  return { min: Math.min(min, first) + 0, max: Math.max(max, top), ticks }
}

export const pctOf = (a: Axis, v: number): number => Math.min(100, Math.max(0, ((v - a.min) / (a.max - a.min)) * 100))
export const fmt = (n: number): string => n.toLocaleString('en-GB', { maximumFractionDigits: 2 })

/** The View model, from either the View or the model itself. */
export function modelOf(view: { model?: ViewModel | null } | ViewModel): ViewModel | null {
  const m = 'cards' in view ? view : view.model
  return m ?? null
}

/** Core's aim object: `model.aim` (today) or `model.run.aim` where core sends it there as an object (today `run.aim` is a string, ignored). */
export interface AimLike { quantity: string; value: number; unit: string | null }
export function aimOf(model: ViewModel): AimLike | null {
  const objectOnly = (x: unknown): unknown => (typeof x === 'object' && x !== null ? x : null)
  const a = (objectOnly((model as { run?: { aim?: unknown } | null }).run?.aim) ?? objectOnly((model as { aim?: unknown }).aim)) as Partial<AimLike> | null
  return a !== null && typeof a === 'object' && typeof a.quantity === 'string' && typeof a.value === 'number' && Number.isFinite(a.value)
    ? { quantity: a.quantity, value: a.value, unit: typeof a.unit === 'string' && a.unit !== '' ? a.unit : null } : null
}

/** The unit of a calculated card's bands: core's own where the card carries one, else the aim's where the card is the aim's quantity. */
export function unitOf(card: ViewCard, aim: AimLike | null): string | null {
  const own = (card as { unit?: unknown }).unit
  if (typeof own === 'string' && own !== '') return own
  return aim !== null && aim.quantity === card.id ? aim.unit : null
}

export type Letters = ReadonlyMap<string, string> | Readonly<Record<string, string>>
export const letterOf = (l: Letters, option: string): string => (l instanceof Map ? l.get(option) : (l as Record<string, string>)[option]) ?? ''

/** The scale's own text: 12 px at the board's type scale (`--o-s`, the look's counter-scale), so an axis label is the card's own size, never a bare 12 flow px that draws at half. */
export const LABEL_PX = 'calc(12px * var(--o-s, 1))'
