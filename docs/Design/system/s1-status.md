# Status

This page records where every part of the system stands at UI commit `9aa1b195` (branch `wip/v12-s4-paul-asks`, 22 Nov 2026). Paths are relative to the UI repository. Card faces, charts, link lines and tab tools moved on after that: their status is in `s7-faces-and-charts.md`, at UI `b58c3c81` (26 Nov). The other component previews are still renditions at `9aa1b195`.

**Built** means it is in the code and follows this system. **Partly** means it is in the code, but some of it does not follow the system yet; the row says what. **Designed** means Paul has approved the design and it is not built yet. **Proposed** means Codex and the UI lead have written it up and it waits for Paul's ruling. **Open** means it needs a decision first.

## Components

| Component | Status | What is left | Code |
|---|---|---|---|
| Menu | Built | The board, chrome and composer share a menu chain. | `src/olumiView/look/Menu.tsx`, `menu.ts`, `menuArbiter.ts` |
| Light Tip | Built | See [Popups](components/Popups.md) for remaining exceptions. | `src/olumiView/look/Tip.tsx`, `Hover.tsx` |
| Card face (Simple and Detailed) | Built | The title and some face rules rely on `!important` in `olumiLook.css` (39 lines). | `src/olumiView/previous/CoreCard.tsx`, `src/olumiView/v12/SimpleFace.tsx`, `src/olumiView/look/olumiLook.css` |
| Kind marker | Built | None. | `src/canvas/nodes/NodeShapeIndicator.tsx` |
| Link line | Built | None. | `src/canvas/edges/ViewLinkEdge.tsx`, `src/olumiView/v12/links/` |
| Details sheet (peek and pinned) | Built | The value row's buttons are 28 and 32px, while the Edit form's are 44px. | `src/olumiView/v12/edit/LaneInspector.tsx`, `src/olumiView/v12/inspect/ValueRow.tsx` |
| Edit form | Built | Its controls are 44px, not the lane's 28px recipe. It has no focus trap. | `src/olumiView/v12/edit/EditForm.tsx` |
| Review line ("N figures not in your model yet") | Built | None. | `src/olumiView/v12/chat/IntakeSheet.tsx` |
| Answering state | Built | None. | `src/canvas/conversation/zones/ThinkingIndicator.tsx`, `src/olumiView/boardKindsOf.ts`, `ViewChat.tsx` `TurnInFlight` |
| Lane buttons and chips | Built | Their focus ring is still blue (`chipClass.ts:100`). The older look keeps its blue primary. | `src/v5/blocks/chipClass.ts`, `src/styles/controls.ts` |
| Composer | Partly | Its inset is `px-4 pb-3 pt-2`, not `p-3`. | `src/olumiView/ViewChat.tsx` (composer block) |
| Right panel tabs | Built | None. | `src/canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx` |
| Chat column | Partly | The scroll area is `px-3 py-4`, and the finding rows are `px-4`, not `p-3`. | `src/olumiView/ViewChat.tsx` |
| Ask Olumi menu (chat ⋯) | Built | Uses the shared menu chain. | `src/olumiView/v12/actionsMenu.tsx` |
| Session goal tiles | Built | They use `rounded-lg` (14). | `src/olumiView/ViewChat.tsx` (session goal) |
| Floating toolbars | Designed | Each has its own values: blue hover and focus, 16px icons, raw hex borders, 29 by 31 faces. The Share button is 14/600. Paul approved the compact one-toolbar style on 22 Nov; Codex is building it on `wip/v12-s4-toolbars`. | `src/components/layout/TopBar.module.css`, `CanvasFloatingToolbar.module.css`, `src/olumiView/ViewLensBar.tsx` |
| Foot controls (more cards, zoom notice, what-if pill, trays) | Partly | Each places itself. The zoom notice is 11px with a blue action, and the trays use 16px lucide icons and native titles. | `src/olumiView/BelowCue.tsx`, `ViewZoomNotice.tsx`, `ViewWhatIfKey.tsx` and the tray files |
| Modal dialogs | Partly | See [Popups](components/Popups.md) for the migrated dialogs and pending surfaces. | `src/olumiView/ViewSummary.tsx`, `ScenarioTitleDialog.tsx`, `src/canvas/help/KeyboardLegend.tsx` |
| Floating conversation | Partly | Inline styles throughout. | `src/olumiView/port/ChatFloat.tsx` |

## Menus

The [popup inventory](components/Popups.md#source-inventory) lists the board, chrome and composer menus and their submenus.

## Rules

| Rule | Status | Where it is broken |
|---|---|---|
| Type 12/14/18, weights 400/500 | Partly | 11px in the zoom notice, the question number badge, the Model tab badge, the top bar's save status, the viewport menu meta and the older menu tip. 600 on Share. |
| Blue means Olumi only | Partly | Hover and focus on the top bar, zoom rail and viewport menu. Focus rings on lane chips, the lens bar and the Edit form input. The zoom notice action. About 90 `info` class uses in `src/olumiView` have not been sorted into Olumi's and not. |
| Green for actions, no black buttons | Built | None found. The only black fills are modal backdrops. |
| Icons 14px, grey, from the registry | Partly | The registry's default is 16. Thirteen lane files import `lucide-react` directly. |
| No inline styles or `!important` in components | Partly | 108 `style=` lines across 35 lane files. Many carry data-driven positions and should become CSS variables, as `Tip.tsx` does. |
| Spacing standard | Partly | See [Popups](components/Popups.md) for shell gaps. The chat column and composer still use `px-4`. |
| One floating surface open at a time | Partly | Shared precedence covers the owned menus, sheet, dialogs and tips. The [inventory](components/Popups.md) lists surfaces still to migrate. |
| One hover look | Partly | See [Popups](components/Popups.md) for lane exceptions. |
| The older look keeps working | Built | `menuLook(false)`, the older inspector and the older card registry are all kept. Nothing checks this automatically. |
