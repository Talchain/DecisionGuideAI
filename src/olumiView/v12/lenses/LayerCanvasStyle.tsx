/**
 * V12 LAYERS ON THE CANVAS: renders nothing but a `<style>` that sets back the cards and links a layer is not about, and tags a card with the layer's
 * note on it (an option's name on a sensitive figure; Grounded / Assumed / No data on a figure). It reaches the nodes and edges by React Flow's own
 * `data-id` (card id; edge id `from->to:kind`, as `canvas.ts` names them), so no canvas file changes and R24's lens bar (`lens.ts`) is untouched.
 * Mount once inside the canvas: `{hasModel ? <LayerCanvasStyle /> : null}`. The words are the View's (option headings) or the three basis names.
 */
import { useMemo } from 'react'
import { useViewStore } from '../../store'
import { BASIS_LABEL } from './layers'
import { useLayerMarks } from './store'

const q = (s: string): string => `"${s.replace(/[\\"]/g, '\\$&').replace(/\n/g, ' ')}"`

export function layerCss(
  model: { cards: { id: string }[]; links: { from: string; to: string; kind: string }[] },
  m: { on: ReadonlySet<string>; links: ReadonlySet<number>; tags: ReadonlyMap<string, string>; basis: ReadonlyMap<string, keyof typeof BASIS_LABEL>; dim: boolean },
): string {
  const out: string[] = []
  const node = (id: string) => `.react-flow__node[data-id=${q(id)}]`
  const edge = (i: number) => { const l = model.links[i]; return l === undefined ? null : `.react-flow__edge[data-id=${q(`${l.from}->${l.to}:${l.kind}`)}]` }
  if (m.dim) {
    for (const c of model.cards) if (!m.on.has(c.id)) out.push(`${node(c.id)}{opacity:.55;transition:opacity .2s}`)
    model.links.forEach((_, i) => { const e = edge(i); if (e !== null && !m.links.has(i)) out.push(`${e}{opacity:.4;transition:opacity .2s}`) })
  }
  const tag = (id: string, text: string, info: boolean) =>
    out.push(`${node(id)}::after{content:${q(text)};position:absolute;left:0;top:100%;margin-top:4px;font-size:11px;line-height:1.3;white-space:nowrap;color:${info ? 'var(--o-info)' : 'var(--o-body)'};pointer-events:none}`)
  for (const [id, text] of m.tags) tag(id, text, false)
  for (const [id, b] of m.basis) tag(id, BASIS_LABEL[b], b === 'assumed')
  return out.join('\n')
}

export function LayerCanvasStyle(): JSX.Element | null {
  const m = useLayerMarks()
  const model = useViewStore((s) => s.view?.model ?? null)
  const css = useMemo(() => (m === null || model === null ? '' : layerCss(model, m)), [m, model])
  return css === '' ? null : <style data-testid="v12-layers-style">{css}</style>
}
