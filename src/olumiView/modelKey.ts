/**
 * What on the canvas means the model changed, as one string: every node's and link's id and data, never where it sits. React Flow
 * moves a node by replacing it with a new position on every frame of a drag; a read of the View keyed on the nodes themselves would
 * then fire once per frame. Keyed on this, the View is read again only when the model on screen changes.
 */
type Item = { readonly id: string; readonly data?: unknown }
export const modelKeyOf = (nodes: readonly Item[], edges: readonly Item[]): string => JSON.stringify([nodes.map((n) => [n.id, n.data ?? null]), edges.map((e) => [e.id, e.data ?? null])])
