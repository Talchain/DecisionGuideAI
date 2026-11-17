/**
 * THE ONE ADAPTER for "Show in the workspace": every name this folder takes from a file it does not own comes through here, so a rebuild
 * of the board, the bands or the layers changes this file alone. Nothing is wrapped or reworded: the names are the owners' own.
 *
 * Deliberately NOT taken: `cardOfQuantity` (layout.ts) and `cardOfRecord` (lenses/layers.ts). Both answer with the FIRST card whose badge
 * holds a record, and a record can sit behind several badges; which badge opens is this folder's own stated rule (targets.ts).
 */
export type { View, ViewModel, ViewCard, ViewTurn, Opened } from '../../client'
export { QUESTION, linkCards, drawnModelOf } from '../../layout'
export { VIEW_CARD, boardOf, viewLaying } from '../../canvas'
export { openBadgesKeyOf } from '../../camera'
export { causalPathOf, inputIdsOf } from '../bands/bands'
export { groupOpen, inputsFolded, setGroupOpen, setInputsOpen, useInputsOpen } from '../bands/foldStore'
export { cardGroupsOf } from '../bands/groups'
export { levelOf, useLevel, useSimpleLevel } from '../simpleStore'
export { layerEntries, marksOf, type LayerId } from '../lenses/layers'
export { useLayer } from '../lenses/store'
export { failureStoriesOf, useViewLens, type ViewLens } from '../../lens'
export { useViewStore } from '../../store'
export { freePane } from '../../revealCamera'
export { pulseCards } from '../../ring'
export { useCanvasStore } from '../../../canvas/store'
export { typography } from '../../../styles/typography'
