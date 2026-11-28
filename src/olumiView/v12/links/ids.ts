import type { ViewLink } from '../../client'

/** Drawing identity, valid only within one View and ordered by that View's links. */
export function viewLinkEdgeIds(links: readonly ViewLink[]): string[] {
  const counts = new Map<string, number>()
  return links.map(({ from, to, kind }) => {
    const triple = `${from}->${to}:${kind}`
    const ordinal = counts.get(triple) ?? 0
    counts.set(triple, ordinal + 1)
    return `${triple}#${ordinal}`
  })
}

export function viewLinkByEdgeId(links: readonly ViewLink[], id: string): ViewLink | undefined {
  return links[viewLinkEdgeIds(links).indexOf(id)]
}
