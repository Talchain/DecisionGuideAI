import { isOlumiCoreLane } from '../../olumiCore/lane'
import type { OutputTab } from '../../stores/uiStore'
import { typography } from '../../styles/typography'
import { checkItemsOf } from '../check/items'
import { displayedDissent } from '../reasoning/dissent'
import { shownModel, useViewStore } from '../store'

export const TAB_COUNT_CLASS = `${typography.viewPanelMeta} shrink-0 rounded-full border border-panel-border bg-panel px-1 text-text-light tabular-nums`

export function useLaneTabCount(id: OutputTab): number | null {
  const lane = isOlumiCoreLane()
  return useViewStore((state) => {
    if (!lane) return null
    if (id === 'analysisNew') {
      const model = shownModel(state)
      if (model === null) return 0
      return checkItemsOf(model, state.view).reduce(
        (total, group) => total + group.blocks.reduce((count, block) => count + block.items.length, 0),
        0,
      )
    }
    if (id === 'team') return (state.view?.collab.dissent ?? []).filter(displayedDissent).length
    return null
  })
}
