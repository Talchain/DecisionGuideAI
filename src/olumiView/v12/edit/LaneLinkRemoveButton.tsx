import { VIEW_EDIT_CHIP_CLASS } from '../../../v5/blocks/chipClass'
import { useModelEdit } from '../../model/editing'
import type { ViewLink } from '../../client'
import { OkIcon } from '../../look/icons'
import { HoverButton } from '../../look/Hover'
import { openLinkRemoval } from './structuralEdits'

export function LaneLinkRemoveButton({ edge, link }: { edge: string; link: ViewLink }): JSX.Element | null {
  const { base } = useModelEdit()
  if (base === null || link.remove == null) return null
  return (
    <HoverButton type="button" data-link-for={edge} words="Review what depends on this link before removing it"
      className={`nodrag nopan pointer-events-auto border border-panel-border bg-panel ${VIEW_EDIT_CHIP_CLASS}`} onClick={(e) => {
        e.stopPropagation()
        openLinkRemoval(link, e.currentTarget)
      }}>
      <OkIcon id="remove-link" size={14} decorative inherit />Remove link
    </HoverButton>
  )
}
