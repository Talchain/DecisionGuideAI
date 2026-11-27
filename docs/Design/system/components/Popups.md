# Popups

This is the binding popup standard for the Olumi look (`VITE_OLUMI_CORE=1`). It applies across the board, chrome and dock.

| Kind | Use |
|---|---|
| Tip | Words only. No controls or tab stops. A card's read-only hover peek occupies this same slot. |
| Menu | Action or selection rows. A submenu belongs to its parent chain. |
| Sheet | Details and forms. All sheets share one slot. |
| Dialog | A rare modal task with an accessible name and contained keyboard focus. |
| Float | A tray docked to the workspace. It has its own slot and participates in the shared Escape stack. |

- One of each kind at most. The newest request wins within a kind. The order across kinds is **Dialog > Sheet > Menu > Tip**. Higher kinds dismiss lower ones. A menu, sheet or dialog blocks standalone tips and hover peeks, including delayed opens. A menu’s own row tip belongs to its menu. Across surfaces, at most one tip or peek is visible, including a menu’s row tip.
- Escape closes the most recent surface only, through the shared stack. In a menu it dismisses the row tip with the menu or goes back one submenu level. An outside pointer press dismisses the surface. A sheet or dialog with a write in flight stays open until the write settles, including on Escape, outside press or a replacement request. Sheets and dialogs show a close control. Closing restores focus to the opener if it is still present. Preserve focus when the action has already taken it into its destination.
- A menu row is one line. Truncate long labels. On hover or keyboard focus, the light row tip shows the full truncated label and the row’s tip text or disabled reason.
- Use the shared `ok-float` shell from `src/olumiView/look/float.css` and the typography tokens in `float.ts`. The shell uses `bg-panel`, a 1px `border-default` border, `radius-md`, `shadow-2`, Inset padding and Stack gaps. Use 12px body and 14px title tokens. Measure placement and choose a width and height cap suited to the contents. Write measured values to CSS custom properties.
- A float may coexist with the other kinds. Its close action docks it or ends the view it opened. Put forms that need their own floating surface in the sheet slot.

## Source inventory

The counts are by reachable surface and shared implementation, with distinct menu chains, submenus and tray entry points listed separately. Repeated cards, tips and form variants count once per surface family. Row tips are counted with their menus. On-recipe refers to the shell and type only. Behaviour gaps are listed below. Persistent toolbars, native form pickers, inline disclosures and forms within document flow, status cues (including the off-screen-card and zoom cues), and page stages are outside the popup counts. Page stages retain their own navigation and use the Escape stack at [Frame](../../../../src/olumiView/v12/frame/FrameStage.tsx#L55), [Overview](../../../../src/olumiView/strategy/overview/StrategyOverviewOpener.tsx#L53) and [Compare views](../../../../src/olumiView/v12/views/CompareViewsStage.tsx#L94).

| Kind | On recipe | Off recipe | Total |
|---|---:|---:|---:|
| Tip | 2 | 2 | 4 |
| Menu | 9 | 0 | 9 |
| Sheet | 2 | 4 | 6 |
| Dialog | 3 | 2 | 5 |
| Float | 0 | 7 | 7 |
| Total | 16 | 15 | 31 |

The recipe column gives background, border, radius, shadow, padding and gap, width cap, and type, in that order. “Shared” refers to the exact shell above. The default shared menu is 232px wide, capped at the measured boundary and 320px, with 12px body type.

| Surface and source | Kind | Opens | Closes | Exclusivity and Escape | Recipe |
|---|---|---|---|---|---|
| [Hover, toolbar, icons, card/link words and citations](../../../../src/olumiView/look/Tip.tsx#L50) | Tip | Delayed pointer or keyboard focus | Leave, blur, press, outside press, Escape, scroll or resize | Shared tip slot and Escape | Shared, max 240px or viewport less gutter, 12px |
| [Card peek](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L246) | Tip | Rest or keyboard focus on card | Leave/blur, outside press, Escape, pin, replacement | Shared tip slot and Escape | Shared, 280px, 12px/14px |
| [Influence explainer Dismiss native tip](../../../../src/components/assistants/InfluenceExplainer.tsx#L93) | Tip | Browser hover over Dismiss | Browser-managed | None | Browser defaults |
| [Detailed Olumi note marker native tip](../../../../src/canvas/components/OlumiAttentionCard.tsx#L397) | Tip | Browser hover before the note is opened | Browser-managed | None | Browser defaults |
| [More options](../../../../src/components/layout/KebabMenu.tsx#L279) | Menu | Top bar ⋯ | Opener, outside press, row action, Escape | menuArbiter and shared Escape | Shared menu |
| [Account menu](../../../../src/components/layout/UserAvatarMenu.tsx#L116) | Menu | Avatar | Opener, outside press, row action, Escape | menuArbiter and shared Escape | Shared menu |
| [More view options](../../../../src/components/layout/CanvasViewportControls.tsx#L156) | Menu | Viewport rail ⋯ | Opener, outside press, row action, Escape | menuArbiter and shared Escape | Shared menu |
| [Add to model](../../../../src/olumiView/v12/edit/LaneEditingLayer.tsx#L69) | Menu | Add rail button | Opener, outside press, row action, Escape | menuArbiter and shared Escape, with request in inspectorStore | Shared menu |
| [Canvas context menu](../../../../src/canvas/contextMenu/CanvasContextMenu.tsx#L98) | Menu | Board/card/link context action or card ⋯ | Opener when present, outside press, row action, Escape, canvas movement/selection | menuArbiter and shared Escape, with request in inspectorStore | Shared menu |
| [Canvas Add submenu](../../../../src/canvas/contextMenu/laneMenu.ts#L148) | Menu | Add row hover or keyboard activation | Escape or Left to parent, row action or whole chain closes outside | Parent menuArbiter chain and shared Escape | Shared menu |
| [Canvas Ask Olumi submenu](../../../../src/canvas/contextMenu/laneMenu.ts#L127) | Menu | Ask Olumi row hover or keyboard activation | Escape or Left to parent, row action or whole chain closes outside | Parent menuArbiter chain and shared Escape | Shared menu |
| [Layers and level of detail](../../../../src/olumiView/v12/lenses/LensesMenu.tsx#L63) | Menu | Layers rail button | Opener, outside press, row action, Escape | menuArbiter and shared Escape | Shared menu |
| [Composer actions and Ask Olumi](../../../../src/olumiView/v12/actionsMenu.tsx#L67) | Menu | Composer ⋯ | Opener, outside press, row action, Escape | menuArbiter and shared Escape | Shared menu |
| [Pinned card or link details](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L187) | Sheet | Card/link press or edit/details action | Close, outside press, Escape, target gone or replacement, protected during save | inspectorStore and LaneEditingLayer Escape | Shared, 280px with measured 60vh height cap, 12px/14px |
| [Canvas settings](../../../../src/components/layout/KebabMenu.tsx#L304) | Sheet | More options → Canvas settings | Close, opener, outside press, Escape or replacement | Shared sheet precedence and Escape | Shared, 14rem capped to the measured free canvas, 12px/14px |
| [Canvas edit form](../../../../src/olumiView/v12/edit/EditForm.tsx#L213) | Sheet | Add, rename, size, add a record or remove link | Cancel, Escape (draft retained), pane press, save or replacement | inspectorStore and LaneEditingLayer Escape | Panel, default, lg, shadow-2, 12px/12px, 280px, 12px/14px |
| [Layer reading panel](../../../../src/olumiView/v12/lenses/LensesMenu.tsx#L227) | Sheet | Select a layer in Layers | Close, Escape, change layer or reopen Layers | Local state and shared Escape | Panel, default, lg, shadow-2, 12px/12px, 300/420px, 12px |
| [How to read this](../../../../src/olumiView/ViewLegend.tsx#L46) | Sheet | More view options → How to read this | Document mousedown or local Escape; no visible close | Local state and document key listener | Panel, default, lg, shadow-3, 12px/child margins, 18rem, 12px |
| [Kept idea](../../../../src/olumiView/v12/bands/IdeaPanel.tsx#L40) | Sheet | Select a kept idea card | Close or deselection, including canvas selection clear | Canvas selection only | Panel, default, md, none, 12px/8px, 320px capped at available width minus 8rem, 12px |
| [Summary](../../../../src/olumiView/ViewSummary.tsx#L86) | Dialog | Summary in top bar | Close, outside press, Escape, replacement or scenario change | Shared dialog slot and Escape | Shared, max 820px, 12px/14px |
| [Rename scenario](../../../../src/olumiView/ScenarioTitleDialog.tsx#L61) | Dialog | More options → Rename | Cancel, outside press, Escape, replacement or save. Stays open while saving. | Shared dialog slot and Escape | Shared, max 420px, 12px/14px |
| [Delete your data](../../../../src/olumiCore/DeleteMyDataDialog.tsx#L76) | Dialog | Account menu or Account page | Cancel, outside press, Escape, replacement or successful deletion. Stays open after confirmation until the deletion settles. | Shared dialog slot and Escape | Shared, max 28rem, 12px/14px |
| [Keyboard shortcuts](../../../../src/canvas/help/KeyboardLegend.tsx#L192) | Dialog | More options or `?` | Close, Done, backdrop click, shared Escape or toggle | Local state and shared Escape | Panel, no border, lg, shadow-3, 12px/12px, max 48rem, mixed typography tokens |
| [Version history](../../../../src/canvas/versions/WhatChangedPanel.tsx#L150) | Dialog | Version history in top bar | Close, backdrop mousedown, shared Escape | Local trigger state and shared Escape | Panel, default, lg, shadow-3, 12px/12px, max 420px, 12px/14px |
| [How influence works](../../../../src/components/assistants/InfluenceExplainer.tsx#L82) | Float | More options → How influence works, through LaneHelp | Dismiss | Local help state, no Escape or outside press | Panel, default, lg, shadow-panel, 12px/child margins, LaneHelp caps at 20rem/viewport, caption and label |
| [What if tray](../../../../src/olumiView/ViewWhatIfKey.tsx#L77) | Float | Select What if or open from a figure | Close or change lens | Shared active lens, no Escape or outside press | Panel, default, md, shadow-2, 12px/12px, 20rem capped at foot width, 12px/14px |
| [Trade-offs tray](../../../../src/olumiView/ViewTradeOffsKey.tsx#L75) | Float | Select Trade-offs | Close or change lens | Shared active lens, no Escape or outside press | Panel, default, md, shadow-2, 12px/12px, max 40rem or foot width, 12px/14px |
| [If it failed tray](../../../../src/olumiView/ViewPreMortemKey.tsx#L58) | Float | Select If it failed | Close or change lens | Shared active lens, no Escape or outside press | Panel, default, md, shadow-2, 12px/12px, 26rem capped at foot width, 12px/14px |
| [Pinned chat tray](../../../../src/olumiView/v12/chat/ChatFootRow.tsx#L70) | Float | Press a chat foot chip or focus a requested source | Chip, outside press, Escape or content removed | Local one-source slot and shared Escape | Panel, top hairline only, zero radius, none, 12px inline, dock width, source type tokens |
| [Olumi chat pop-out](../../../../src/olumiView/port/ChatFloat.tsx#L184) | Float | Composer pop-out | Dock control, dock tab, local capture Escape from chat or body | Chat float store and private key listener | Panel, default, midpoint of sm and md, shadow-2, no shell padding/gap, measured canvas width, inherited chat type |
| [Detailed Olumi note](../../../../src/canvas/components/OlumiAttentionCard.tsx#L616) | Float | Press the note marker in Detailed view (also opens automatically for some notes) | Dismiss or note removed | None on the board, pinned tray when portalled into chat | Panel, default, lg, shadow-panel, 12px/child margins, 268px, 12px/14px |

The old `MENU_EXCLUSIVE_EVENT` has no executable declaration or readers in this checkout. The only source reference is an obsolete comment in [scenarioRenameEvent.ts](../../../../src/canvas/components/scenarioRenameEvent.ts#L9). The chrome menus, Add and Ask Olumi already used `Menu` before this slice. The legacy scenario dropdown, invite dialog, older Add form and floating figure editor for cards are gated out of the lane. The commitment form is in the document flow. Figure edits for records without a card use an in-flow editor. The in-flow chat Keep list, question editor, intake, Analysis and Reasoning disclosures do not float.

## Still to do

### Lane A · Canvas

| Surface | Change |
|---|---|
| [Card hover hook](../../../../src/canvas/hooks/usePopoverHover.ts#L313) | Remove the lane peek’s parallel document Escape listener once the hook can delegate dismissal for lane cards. Keep the older look’s own preview lifecycle. |
| [Canvas edit form](../../../../src/olumiView/v12/edit/EditForm.tsx#L213) | Use the shared sheet shell and dismissal, including outside press beyond the canvas pane and opener focus for every entry point. |
| [Layer reading panel](../../../../src/olumiView/v12/lenses/LensesMenu.tsx#L227) | Mount through the shared sheet slot and shell. |
| [How to read this](../../../../src/olumiView/ViewLegend.tsx#L46) | Join the shared sheet slot so a dialog replaces the legend. Replace its document Escape listener with the shared stack and return focus to the viewport opener. |
| [Plain details opens](../../../../src/olumiView/ViewCanvas.tsx#L525) | Move focus into the details sheet when a card or link opens it. Plain opens currently leave focus on the canvas. |
| [Kept idea](../../../../src/olumiView/v12/bands/IdeaPanel.tsx#L40) | Put idea details in the shared sheet slot. |
| [Keyboard shortcuts](../../../../src/canvas/help/KeyboardLegend.tsx#L192) | Join the shared dialog slot so a dialog replaces the legend and opening the legend replaces any prior dialog. Summary can currently keep trapping focus behind the keyboard legend. |
| [Version history](../../../../src/canvas/versions/WhatChangedPanel.tsx#L150) | Mount through the shared Dialog shell, precedence and focus lifecycle. |
| [How influence works](../../../../src/olumiView/v12/LaneHelp.tsx#L53) and [Dismiss native tip](../../../../src/components/assistants/InfluenceExplainer.tsx#L93) | Mount the explainer in the shared Float slot with measured placement and give its close icon an accessible label through the shared control. |
| [What if](../../../../src/olumiView/ViewWhatIfKey.tsx#L77), [Trade-offs](../../../../src/olumiView/ViewTradeOffsKey.tsx#L75), [If it failed](../../../../src/olumiView/ViewPreMortemKey.tsx#L58) | Use the shared Float shell and dismissal for the active lens tray. Route separately floating form interactions to the sheet slot. |
| [Detailed Olumi note and its marker](../../../../src/canvas/components/OlumiAttentionCard.tsx#L397) | Use the shared Float slot and shell for the board instance and give its opener a shared Tip. |

### Lane C · Chat

| Surface | Change |
|---|---|
| [Composer menu](../../../../src/olumiView/v12/actionsMenu.tsx#L71) | Move descriptions from multiline rows to their row tips. |
| [Pinned chat tray](../../../../src/olumiView/v12/chat/ChatFootRow.tsx#L70) | Join the shared Float slot while retaining its source selection and drafts. |
| [Olumi chat pop-out](../../../../src/olumiView/port/ChatFloat.tsx#L184) | Join the shared Float slot and Escape stack, dock on outside press and restore focus to the pop-out opener. |
