import { OkIcon } from '../../olumiView/look/icons'
import { MenuItem, MenuSeparator, SubMenu } from '../../olumiView/look/Menu.tsx'
import { isDivider, isMenuItem, type MenuEntry } from './types'

export function hasIcon(items: MenuEntry[]) {
  return items.some((entry) => isMenuItem(entry) && Boolean(entry.glyph || entry.iconId || entry.icon))
}

export function ContextRows({ items, lane }: { items: MenuEntry[]; lane: boolean }) {
  return items.map((item, index) => {
    if (isDivider(item)) return <MenuSeparator key={index} />
    const LegacyIcon = item.icon
    const iconSize = lane ? 14 : 16
    const iconColor = lane ? undefined : item.glyphColor ?? (item.id.startsWith('ask-ai') ? 'text-info' : undefined)
    const icon = item.glyph
      ? <span className={`olumi-menu-symbol text-sm ${lane ? '' : iconColor ?? 'text-text-light'}`}>{item.glyph}</span>
      : item.iconId !== undefined
        ? <OkIcon id={item.iconId} variant={item.iconAlt ? 'alt' : undefined} size={iconSize} decorative inherit className={iconColor} />
        : LegacyIcon && <LegacyIcon size={iconSize} className={iconColor} />
    const props = {
      id: item.id, label: item.label, icon, danger: item.destructive,
      disabled: !item.enabled, disabledReason: item.disabledReason, tip: item.tooltip, closeOnSelect: false,
    }
    if (item.hasSubmenu && item.submenuItems) {
      return (
        <SubMenu key={item.id} {...props} iconColumn={lane || hasIcon(item.submenuItems)}>
          <ContextRows items={item.submenuItems} lane={lane} />
        </SubMenu>
      )
    }
    return <MenuItem key={item.id} {...props} trailing={item.shortcut} onSelect={item.action} />
  })
}
