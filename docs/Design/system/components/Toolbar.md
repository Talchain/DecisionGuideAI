# Toolbar

The floating rails and bars on the board: the left rail, the zoom rail, the lens bar and the top bar.

**Status: designed, being built.** Paul approved the compact version (B) for every floating toolbar on 22 Nov, with Share at 500 and 14px icons; Codex is building it on `wip/v12-s4-toolbars`. Until it lands: Each toolbar has its own values today: blue hover and focus, 16px icons, raw hex borders and 29 by 31 faces. The top bar also has an 11px save status and Share at 14/600.

## The approved spec (version B)

- **Shell**: opaque `bg-panel`, a 1px `border-default` hairline, a 12px radius (`radius-md`), `shadow-2` and a 4px inset, on every toolbar including the top bar.
- **Faces**: 30px, flat and transparent, with an 8px radius (`radius-sm`), each with an invisible 44px hit area (`HIT_44`). One track, with its inset and border, is 40px, today's depth.
- **Icons**: 14px, in `text-light`, from the registry.
- **Labels and counts**: labels in `viewPanelBody`, counts in `viewPanelMeta`, and 500 for the selected face. The scenario title is `viewPanelHeadline` (14/500). Share is a labelled face at 500.
- **Hover**: `bg-panel-hover`, with ink rising to `text-body`.
- **Selected or open**: `bg-panel-hover` plus a 1px inset `text-header` edge.
- **Focus**: a 2px `text-header` outline at 2px offset. Never blue.
- **Groups**: one hairline between groups.
- **Help**: the light Tip, after 150ms, at an 8px gap.
- **Keyboard**: each vertical rail is one Tab stop, with ↑ ↓ Home End inside it. The lens bar keeps its radio arrows.
- **Layers**: dock 900, rails 1100, top lenses 1250, app bar 3000. All toolbars are placed by one measured chrome layout.

## Migration order

1. The top bar and the lenses.
2. The left and zoom rails.
3. The foot controls.
4. The dock, pop-out, Frame and composer.

## Code today

- `src/components/layout/TopBar.module.css`
- `src/components/layout/CanvasFloatingToolbar.module.css`
- `src/olumiView/ViewLensBar.tsx`
- `src/components/layout/LeftSidebar.tsx`
- `src/components/layout/CanvasViewportControls.tsx`

The spec comes from the floating toolbars audit of 22 Nov 2026. It was compacted to version B on the toolbar board (https://claude.ai/artifact/PMMK8jFwErXWX8YuCJmCt3). This preview is a static rendition of version B, not of the current code.
