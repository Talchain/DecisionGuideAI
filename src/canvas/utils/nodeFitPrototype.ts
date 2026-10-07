/** Session-local state for the node-size exploration. This is deliberately not
 * a persisted flag: the URL is sampled by the layout and the default path does
 * not consult text at all. */
let contentFit = false
const widths = new Map<string, number>()

export function readNodeFitPrototypeAtLayout(): boolean {
  contentFit = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('nodeFit') === 'content'
  if (!contentFit) widths.clear()
  return contentFit
}

export function nodeFitPrototypeEnabled(): boolean {
  return contentFit
}

export function publishNodeFitPrototypeWidths(next: ReadonlyMap<string, number>): void {
  widths.clear()
  for (const [id, width] of next) widths.set(id, width)
}

export function nodeFitPrototypeWidth(id: string): number | undefined {
  return contentFit ? widths.get(id) : undefined
}
