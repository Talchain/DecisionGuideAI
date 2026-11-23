# Composer

The box at the foot of the panel where the person writes to Olumi.

**Status: partly.** Its outer inset is `px-4 pb-3 pt-2`, not the panel's `p-3`.

## Anatomy

- **Box**:
  - `rounded-md` (12px), a `border-default` hairline;
  - the border turns `text-light` when the box has focus.
- **Text area**: `viewPanelBody`, `px-3 pt-2 pb-1`.
- **Footer**: `gap-1 px-2 pb-1.5`, holding Attach, the four method icons and Send, in that order.
  - Attach comes first. Menus that open from the composer are small floating menus, never top banners.
  - The method icons are challenge, opposite, disprove and outside. Each is a 28px `OkIconButton` with a grey registry icon, its method's name in the Tip, and a `bg-panel-hover` hover.
  - Send is a 28px round green button (`controls.act`) with an ink arrow.

## Code

- `src/olumiView/ViewChat.tsx` (composer block, `METHOD_ICON`, `useBriefDocumentUpload` for Attach)
- `src/olumiView/look/icons.tsx` (`method-*` ids)

This preview is a static rendition at UI `9aa1b195`.
