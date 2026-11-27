# Popups

This is the popup styling standard for the Olumi look (`VITE_OLUMI_CORE=1`). It covers the board, chrome and dock.

| Kind | Use |
|---|---|
| Tip | Read-only words beside an anchor, including the card hover peek. |
| Menu | Action and selection rows. A submenu belongs to its parent menu chain. |
| Sheet | Details, forms and popovers. |
| Dialog | A modal task with an accessible name and contained keyboard focus. |
| Float | A tray or surface beside the workspace or dock. |

## Behaviour today

- The menu arbiter keeps a single root menu chain across its callers. The canvas inspector store holds the current details, form or canvas menu request. Opening canvas details or an editor can dismiss an active menu, with an exception for the Add menu handing off to its own form. Other surfaces use their own state and can coexist.
- The shared Escape stack closes the newest registered surface when Escape reaches it unhandled. Menus can return one level from a submenu. The canvas key, delete dialog, chat pop-out and card hover hook also have local key handling. Each surface defines its own outside-press and focus behaviour. A canvas save guards store dismissal, while the rename and delete dialogs guard their own dismissals during the write.
- The delayed Tip coordinator replaces the previous Tip it opened. An open canvas-card Tip or an occupied inspector slot hides the card peek. An open menu suppresses the peek, and opening a lane menu clears the current peek. Native browser tips have their own lifecycle.
- Standard menu rows truncate long labels on one line. On hover or keyboard focus, the row tip supplies the truncated words and any row tip or disabled reason. Composer rows with explicit descriptions keep their existing layout.

## Surface recipe

Use [`ok-float`](../../../../src/olumiView/look/float.css) for the shell. It uses `bg-panel`, a 1px `border-default` border, `radius-md`, `shadow-2`, Inset padding and Stack gaps from the [spacing standard](../s8-spacing.md). Card popovers use the same Inset and Stack tokens at card scale. Use the existing panel typography tokens for 12px body and 14px titles where appropriate. Width, height caps and placement belong to the individual surface, with measured placement values kept in CSS custom properties where the surface already uses them.

## Source inventory

The counts are by reachable surface and shared implementation. Distinct menu chains, submenus and tray entry points count separately. Repeated cards, tips and form variants count once per family. Row tips count with their menus. The recipe column records the shared shell. Persistent toolbars, native form pickers, inline disclosures and forms, status cues, and page stages are outside these counts.

| Kind | Before on | Before off | After on | After off | Total |
|---|---:|---:|---:|---:|---:|
| Tip | 0 | 4 | 2 | 2 | 4 |
| Menu | 0 | 9 | 9 | 0 | 9 |
| Sheet | 0 | 9 | 9 | 0 | 9 |
| Dialog | 0 | 5 | 5 | 0 | 5 |
| Float | 0 | 7 | 7 | 0 | 7 |
| Total | 0 | 34 | 32 | 2 | 34 |

The before counts reflect joined base `8693c5a8`. The two browser-native `title` tips are the only off-recipe entries.

| Surface and source | Kind | Opens | Closes | State and Escape | Size | Recipe |
|---|---|---|---|---|---|---|
| [Hover, toolbar, icons, card/link words and citations](../../../../src/olumiView/look/Tip.tsx#L62) | Tip | Delayed pointer or keyboard focus | Leave, blur, anchor Escape, scroll or resize. A press on the anchor dismisses it where wired. | The delayed Tip coordinator replaces the previous Tip. Row tips also follow their menu lifecycle. | 240px max, viewport-capped | On recipe |
| [Card peek](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L215) | Tip | Rest or keyboard focus on card | Leave, blur, local Escape or pin. A canvas request or an open card Tip hides the peek. | Canvas hover state. Opening a shared menu clears the current peek. | 280px with a measured height cap | On recipe |
| [Influence explainer Dismiss native tip](../../../../src/components/assistants/InfluenceExplainer.tsx#L93) | Tip | Browser hover over Dismiss | Browser-managed | Browser-managed | Native title | Off |
| [Detailed Olumi note marker native tip](../../../../src/canvas/components/OlumiAttentionCard.tsx#L397) | Tip | Browser hover before the note is opened | Browser-managed | Browser-managed | Native title | Off |
| [More options](../../../../src/components/layout/KebabMenu.tsx#L268) | Menu | Top bar ⋯ | Opener, outside pointer press, row action, Tab or Escape. | Shared menu chain and Escape. | 232px, capped by viewport and boundary | On recipe |
| [Account menu](../../../../src/components/layout/UserAvatarMenu.tsx#L116) | Menu | Avatar | Opener, outside pointer press, most row actions, Tab or Escape. | Shared menu chain and Escape. | 232px, capped by viewport and boundary | On recipe |
| [More view options](../../../../src/components/layout/CanvasViewportControls.tsx#L156) | Menu | Viewport rail ⋯ | Opener, outside pointer press, row action, Tab or Escape. | Shared menu chain and Escape. | 232px, capped by viewport and boundary | On recipe |
| [Add to model](../../../../src/olumiView/v12/edit/LaneEditingLayer.tsx#L69) | Menu | Add rail button | Opener, outside pointer press, row action, Tab or Escape. | Shared menu chain and Escape, with a request in the canvas inspector store. | 232px, capped by viewport and boundary | On recipe |
| [Canvas context menu](../../../../src/canvas/contextMenu/CanvasContextMenu.tsx#L98) | Menu | Board/card/link context action or card ⋯ | Opener when present, outside pointer press, row action, Tab, Escape or canvas movement and selection. | Shared menu chain and Escape, with a request in the canvas inspector store. | 232px, capped by viewport and boundary | On recipe |
| [Canvas Add submenu](../../../../src/canvas/contextMenu/laneMenu.ts#L148) | Menu | Add row hover or keyboard activation | Escape or Left returns to the parent. A row action or outside press can close the chain. | Part of the canvas context menu chain. | 232px, capped by viewport and boundary | On recipe |
| [Canvas Ask Olumi submenu](../../../../src/canvas/contextMenu/laneMenu.ts#L127) | Menu | Ask Olumi row hover or keyboard activation | Escape or Left returns to the parent. A row action or outside press can close the chain. | Part of the canvas context menu chain. | 232px, capped by viewport and boundary | On recipe |
| [Layers and level of detail](../../../../src/olumiView/v12/lenses/LensesMenu.tsx#L63) | Menu | Layers rail button | Opener, outside pointer press, row action, Tab or Escape. | Shared menu chain and Escape. | 232px, capped by viewport and boundary | On recipe |
| [Composer actions and Ask Olumi](../../../../src/olumiView/v12/actionsMenu.tsx#L67) | Menu | Composer ⋯ | Opener, outside pointer press, row action, Tab or Escape. | Shared menu chain and Escape. | 232px, capped by viewport and boundary | On recipe |
| [Pinned card or link details](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L160) | Sheet | Card/link press or edit/details action | Close, pane press, Escape, target removed, scenario change or replacement. Store dismissal is guarded during a save. | Canvas inspector store and shared Escape. | 280px with a measured 60vh height cap | On recipe |
| [Canvas settings](../../../../src/components/layout/KebabMenu.tsx#L293) | Sheet | More options → Canvas settings | Close, reopen More options, outside pointer press or Escape. | Kebab menu local state and shared Escape. | 14rem, viewport-capped | On recipe |
| [Canvas edit form](../../../../src/olumiView/v12/edit/EditForm.tsx#L213) | Sheet | Add, rename, size, add a record or remove link | Cancel, Escape, pane press, scenario change, save or replacement. Escape preserves the draft. Store dismissal is guarded during a save. | Canvas inspector store and shared Escape. | 280px with a height cap | On recipe |
| [Layer reading panel](../../../../src/olumiView/v12/lenses/LensesMenu.tsx#L227) | Sheet | Select a layer in Layers | Close, Escape, change to the full model or reopen Layers. | Layers local state and shared Escape. | 300px or 420px, 70vh max | On recipe |
| [How to read this](../../../../src/olumiView/ViewLegend.tsx#L46) | Sheet | More view options → How to read this | Outside mousedown, document Escape or toggle. | Viewport controls local state and document listeners. | 18rem, viewport height cap | On recipe |
| [Kept idea](../../../../src/olumiView/v12/bands/IdeaPanel.tsx#L40) | Sheet | Select a kept idea card | Close or deselection, including when canvas selection clears. | Canvas selection. | 320px, capped to available width minus 8rem | On recipe |
| [Detailed long answer](../../../../src/olumiView/v12/detailed/marks.tsx#L122) | Sheet | Press a long result row’s full-answer mark | Press the mark again or leave the card’s view. | Row-local toggle. | 280px at card scale 1 | On recipe |
| [Rests on popover](../../../../src/olumiView/ResultBand.tsx#L60) | Sheet | Press the Rests on label, which also selects its lens | Press the label again or leave the card’s view. | Card-local toggle. | 280px at card scale 1 | On recipe |
| [Floating worked steps](../../../../src/olumiView/look/WorkedSteps.tsx#L125) | Sheet | Open the card’s worked-steps disclosure | Close the disclosure or leave the card’s view. | Native disclosure state. | 280px at card scale 1 | On recipe |
| [Summary](../../../../src/olumiView/ViewSummary.tsx#L83) | Dialog | Summary in top bar | Close, backdrop mousedown, Escape or scenario change. | Summary trigger local state and shared Escape. | 820px max | On recipe |
| [Rename scenario](../../../../src/olumiView/ScenarioTitleDialog.tsx#L59) | Dialog | More options → Rename | Cancel, backdrop mousedown, Escape or save. Cancel and dismissal are guarded while saving. | Kebab menu local state and shared Escape. | 420px max | On recipe |
| [Delete your data](../../../../src/olumiCore/DeleteMyDataDialog.tsx#L92) | Dialog | Account menu or Account page | Cancel, backdrop mousedown, dialog Escape or successful deletion. Dismissal is guarded during deletion. | Account entry point local state and dialog key handler. | 28rem max | On recipe |
| [Keyboard shortcuts](../../../../src/canvas/help/KeyboardLegend.tsx#L192) | Dialog | More options or `?` | Close, Done, backdrop click, Escape or toggle. | Keyboard legend local state and shared Escape. | 48rem and 80vh max | On recipe |
| [Version history](../../../../src/canvas/versions/WhatChangedPanel.tsx#L150) | Dialog | Version history in top bar | Close, backdrop mousedown or Escape. | Version history trigger state and shared Escape. | 420px max | On recipe |
| [How influence works](../../../../src/components/assistants/InfluenceExplainer.tsx#L82) | Float | More options → How influence works, through LaneHelp | Dismiss. | LaneHelp state and the explainer’s own dismiss control. | 20rem, viewport-capped | On recipe |
| [What if tray](../../../../src/olumiView/ViewWhatIfKey.tsx#L77) | Float | Select What if or open from a figure | Close or change lens. | Active lens state. | 20rem, capped to foot width | On recipe |
| [Trade-offs tray](../../../../src/olumiView/ViewTradeOffsKey.tsx#L75) | Float | Select Trade-offs | Close or change lens. | Active lens state. | 40rem max, capped to foot width | On recipe |
| [If it failed tray](../../../../src/olumiView/ViewPreMortemKey.tsx#L58) | Float | Select If it failed | Close or change lens. | Active lens state. | 26rem, capped to foot width | On recipe |
| [Pinned chat tray](../../../../src/olumiView/v12/chat/ChatFootRow.tsx#L70) | Float | Press a chat foot chip or focus a requested source | Chip, outside press, Escape or content removed. | One local source at a time and shared Escape. | Dock width, 62% height cap | On recipe |
| [Olumi chat pop-out](../../../../src/olumiView/port/ChatFloat.tsx#L184) | Float | Composer pop-out | Dock control, dock tab or capture-phase Escape from the floated chat or the page body while no menu is open. | Chat float store and local key listener. | Measured canvas width and height | On recipe |
| [Detailed Olumi note](../../../../src/canvas/components/OlumiAttentionCard.tsx#L616) | Float | Press the note marker in Detailed view (also opens automatically for some notes) | Dismiss, release the held attention where applicable, or note removed. | Board note lifecycle or pinned tray when portalled into chat. | 268px on the board, dock width in the tray | On recipe |

## Still to do

| Surface | Behaviour work | Status |
|---|---|---|
| Card peek | Consolidate Escape handling with the lane’s canvas surface lifecycle. | Not done |
| Canvas edit form | Extend outside-press handling beyond the pane and make opener focus restoration consistent across entry points. | Not done |
| Canvas details | Move focus into the details sheet for plain card and link opens. | Not done |
| Canvas settings, layer reading panel, canvas key and kept idea | Decide how these surfaces should coexist with other sheets and dialogs. Bring the canvas key onto the shared Escape stack and restore focus to its opener. | Not done |
| Detailed long answer, Rests on and floating worked steps | Define shared dismissal and focus behaviour for card popovers. | Not done |
| Summary, rename, delete, keyboard shortcuts and version history | Define dialog coexistence and align dismissal and focus handling across entry points. | Not done |
| Influence explainer and Detailed Olumi note | Define float dismissal behaviour and move the native title tips to the shared Tip lifecycle. | Not done |
| What if, Trade-offs and If it failed | Define active lens tray Escape and outside-press behaviour. | Not done |
| Pinned chat tray and Olumi chat pop-out | Align coexistence across floats, bring the pop-out into the shared Escape stack and define its outside-press and opener-focus behaviour. | Not done |
