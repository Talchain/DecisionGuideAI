/**
 * THE VIEW GALLERY'S LIST: every saved View file, what it lacks, and one frame at a time at each of Paul's three sizes. Plain DOM on
 * purpose: this page loads nothing of the app, so the only app on screen is the one inside the frame.
 */
import schema from '../view.v3.json'
import type { GalleryState } from './isolate'
import { SIZES, frameHashOf, isSavedView, loaders, type SavedView } from './manifest'

const REQUIRED: readonly string[] = (schema as { required?: readonly string[] }).required ?? []
type Row = { readonly key: string; readonly view: SavedView | null; readonly missing: readonly string[] }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', attrs: Readonly<Record<string, string>> = {}): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (text !== '') e.textContent = text
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}

/** One saved file read: a whole View document or not, and which of the schema's required keys it lacks (drawn as it is; nothing is filled in). */
export async function rowOf(key: string, load: () => Promise<unknown>): Promise<Row> {
  let doc: unknown = null
  try { doc = await load() } catch { doc = null }
  if (!isSavedView(doc)) return { key, view: null, missing: [] }
  const has = doc as unknown as Readonly<Record<string, unknown>>
  return { key, view: doc, missing: REQUIRED.filter((k) => !(k in has)) }
}

export const frameUrlOf = (view: SavedView, key: string): string => `${window.location.pathname}${frameHashOf(view, key)}`

export async function drawList(root: HTMLElement | null): Promise<void> {
  if (root === null) return
  root.setAttribute('style', 'font: 14px/1.45 system-ui, sans-serif; padding: 16px; color: CanvasText; background: Canvas; min-height: 100vh')
  root.append(
    el('h1', 'Saved Views, drawn by the real page', { style: 'font-size: 18px; margin: 0 0 4px' }),
    el('p', 'Read-only: no engine and no AI, and nothing is sent or saved. Each frame is the real scenario page reading one saved View. '
      + 'A model being built and a reply being written are in no saved file, so they are not shown here. '
      + 'One request leaves the page and cannot be held back here: the font stylesheet every page of the app asks for.', { style: 'margin: 0 0 8px; max-width: 80ch' }),
  )
  const summary = el('p', 'Reading the saved files…', { 'data-testid': 'gallery-summary', style: 'margin: 0 0 12px' })
  const stage = el('div', '', { 'data-testid': 'gallery-stage', style: 'margin: 0 0 16px' })
  const table = el('table', '', { 'data-testid': 'gallery-list', style: 'border-collapse: collapse' })
  root.append(summary, stage, table)

  let watch: number | undefined
  const show = (row: Row, w: number, h: number) => {
    if (row.view === null) return
    window.clearInterval(watch)
    const scale = Math.min(1, (window.innerWidth - 32) / w)
    const frame = el('iframe', '', { src: frameUrlOf(row.view, row.key), width: String(w), height: String(h), title: `${row.key} at ${w} by ${h}`,
      'data-testid': 'gallery-frame', style: `border: 1px solid GrayText; transform-origin: 0 0; transform: scale(${scale})` })
    const box = el('div', '', { style: `width: ${Math.ceil(w * scale)}px; height: ${Math.ceil(h * scale)}px; overflow: hidden` })
    box.append(frame)
    const held = el('pre', '', { 'data-testid': 'gallery-held', style: 'white-space: pre-wrap; margin: 8px 0 0; font-size: 12px' })
    stage.replaceChildren(el('p', `${row.key} · ${w} by ${h}${scale < 1 ? ` (shown at ${Math.round(scale * 100)}%)` : ''}`, { style: 'margin: 0 0 6px; font-weight: 600' }), box, held)
    // What the page asked for that the saved View could not answer, and what was refused: read from the frame's own isolation.
    watch = window.setInterval(() => {
      let g: GalleryState | undefined
      // A frame that has left this origin cannot be read; the page policy stops it leaving, and this never throws if it did.
      try { g = (frame.contentWindow as (Window & { __gallery?: GalleryState }) | null)?.__gallery } catch { g = undefined }
      if (g === undefined) return
      const lines = (name: string, list: GalleryState['refused']) => [`${name}: ${list.length}`, ...list.map((x) => `  ${x.method} ${x.url} (${x.why})`)]
      held.textContent = [...lines('Asked for, not in this saved View', g.unanswered), ...lines('Refused', g.refused)].join('\n')
    }, 1000)
  }

  const rows: Row[] = []
  for (const key of Object.keys(loaders).sort()) {
    const row = await rowOf(key, loaders[key]!)
    rows.push(row)
    const tr = el('tr', '', { 'data-gallery-row': key, 'data-gallery-view': row.view === null ? 'no' : row.missing.length === 0 ? 'whole' : 'lacks' })
    const cell = (child: HTMLElement | string) => { const td = el('td', typeof child === 'string' ? child : '', { style: 'padding: 2px 10px 2px 0; vertical-align: top' }); if (typeof child !== 'string') td.append(child); tr.append(td) }
    cell(key)
    cell(row.view === null ? 'not a whole View document' : row.missing.length === 0 ? 'every required key' : `lacks: ${row.missing.join(', ')}`)
    const acts = el('span')
    if (row.view !== null) {
      const view = row.view
      for (const [w, h] of SIZES) {
        const b = el('button', `${w} by ${h}`, { type: 'button', style: 'margin-right: 6px' })
        b.addEventListener('click', () => show(row, w, h))
        acts.append(b)
      }
      acts.append(el('a', 'open alone', { href: frameUrlOf(view, key), target: '_blank', rel: 'noopener' }))
    }
    cell(acts)
    table.append(tr)
    const views = rows.filter((r) => r.view !== null)
    summary.textContent = `${rows.length} of ${Object.keys(loaders).length} files read · ${views.length} whole View documents · ${views.filter((r) => r.missing.length === 0).length} with every key the schema requires`
  }
}
