# Decisions

This page lists each decision and who made it. On 23 Nov Paul said to go with all of the UI lead's recommendations, so every row is now decided.

| # | Decision | Owner |
|---|---|---|
| 1 | Decided 22 Nov: Paul chose the compact toolbar style (B) for every floating toolbar: a 12px radius, `shadow-2`, a 4px inset, 30px faces with 44px hit areas, a 40px track, grey 14px icons, the light Tip and no blue. Building in this order: the top bar and lenses, the left and zoom rails, then the foot controls. | Decided by Paul; the UI lead builds with Codex |
| 2 | Decided 22 Nov: Share becomes a labelled face at 500 like the others. | Decided by Paul |
| 3 | Decided 22 Nov for the toolbars, and 23 Nov everywhere: 14px registry icons; the registry default becomes 14 and its check accepts 14 only. In build on `wip/v12-s4-rules`. | Decided by Paul |
| 4 | Decided 23 Nov: the menu shell keeps its 6px inset; the rows carry the padding, as in the menu design Paul approved. The spacing audit's "4px" note is corrected here. | Decided (Paul: go with the UI lead's recommendations) |
| 5 | Decided 23 Nov: move the remaining menus onto `Menu`: viewport ⋯, Layers and Add, top bar ⋯ and account, then chat ⋯, then the tips and linked floaters. Starts once the toolbar change lands, because they share files. | Decided; UI lead, Codex implements |
| 6 | Decided 23 Nov: build editing step 1: one rename editor, one Add menu, one removal confirmation, Frame's Edit reaching the sheet, and the Try that closed a newer selection. In build on `wip/v12-s4-edit1`. | Decided; UI lead, Codex implements |
| 7 | Decided 23 Nov: step 2 (draw and reconnect links, delete with dependencies shown, valid kind changes) comes next, because it closes the largest gap; steps 3 and 4 follow. Each needs new Core operations, so the Core design goes to the delivery lead and Core owner first. | Decided; Core owner designs the operations, UI lead builds the sheet |
| 8 | Decided 23 Nov: add the missing checks (spacing classes, blue outside Olumi's own surfaces, native titles, inline styles, `!important`, and sizes that come from a type token) as ratchets in the design guard. In build on `wip/v12-s4-rules`. | Decided; UI lead, Codex implements |
| 9 | Decided 23 Nov: the visual baselines move to 2000 by 1205, 1232 by 704 and 1128 by 680 at 1.33. In build on `wip/v12-s4-rules`. | Decided; UI lead |
| 10 | Decided 23 Nov: `CLAUDE.md` and `docs/Design/Olumi_Design_System_v5.md` point here; the blue primary button rule goes. In build on `wip/v12-s4-rules`. | Decided; UI lead |
| 11 | Decided 23 Nov: `radius-lg` stays 14px, which is what the app draws, and `brand.css` says so in one place instead of being overridden. No visible change. | Decided; UI lead |
| 12 | Decided 23 Nov: fix the pinned chat summary so it never covers the brief, and bring the chat column and composer to the panel's `p-3`. In build on `wip/v12-s4-rules`. | Decided; UI lead, Codex implements |
