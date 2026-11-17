/**
 * THE ONE ADAPTER for "Show in the workspace": every name this folder takes from a file it does not own comes through here, so a rebuild
 * of the board, the bands or the layers changes this file alone. Nothing is wrapped or reworded: the names are the owners' own.
 *
 * Deliberately NOT taken: `cardOfQuantity` (layout.ts) and `cardOfRecord` (lenses/layers.ts). Both answer with the FIRST card whose badge
 * holds a record, and a record can sit behind several badges; which badge opens is this folder's own stated rule (targets.ts).
 */
export type { View, ViewModel, ViewCard, ViewTurn, Opened } from '../../client'
export { QUESTION, linkCards, drawnModelOf } from '../../layout'
export { inputIdsOf } from '../bands/bands'
export { inputsFolded } from '../bands/foldStore'
export { layerEntries, marksOf, type LayerId } from '../lenses/layers'
