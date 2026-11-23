# Editing

This page says how a person changes the model today. It also sets out the editing model that Codex proposed in its audit of 22 Nov 2026, which Paul has not yet ruled on. The audit was checked against the code at `9aa1b195`.

## What a person can do today

The table is drawn from the audit's coverage matrix.

- **Directly** means a typed edit that saves at once.
- **Through Olumi** means the person asks in chat, or uses a prefilled request, and Olumi proposes a change for them to approve, where Core can express it.

| Element | Directly | Through Olumi | Not possible |
|---|---|---|---|
| Framing question | | Change it (Frame: Ask Olumi to change it) | Edit or delete the banner itself |
| Aim or limit | Rename it; change its target or bound figure; remove an offered link | Its measure, comparator, unit or time reading; add or delete; add links; change direction | Turn an aim into a limit (add the other one instead) |
| Option | Rename; add one; remove an offered link | Delete; rule out or restore; set what it changes; add links; change direction | Change its kind; type over its chance |
| Factor or input | Rename; change the figure, between a point and a range; add a standalone figure; set an eligible link's strength; remove an offered link | Restate its unit; delete; add or reverse links; make it a setting; add workings | Convert it to another kind at will; drag a link from it |
| Calculated result | Rename; edit its inputs; remove an offered formula part | Revise its workings; delete; add links | Type over the result |
| Risk | Rename; set its chance and size; add a risk to a figure | Change what it affects or how it works; delete | Change its kind |
| Claim or note | Add one, attached or standalone; keep Olumi's words | Revise its text (a direct rename can be refused); delete | Change its kind |
| Open question | Add one | Restate it; delete | Edit or delete Olumi's coaching questions as cards |
| Link | Set an eligible strength; remove it where Core offers removal | Add one between valid cards; reverse it; change its sign, ends or confidence; edit its wording | Drag a handle to connect two cards |
| Folded group | Remove one identified line | | Edit the group as a whole (edit its members instead) |
| Option setting | Change its backing figure where that figure is editable | Change what it sets, to which value and when; add, re-point or remove it | Change the setting line's sign or strength |
| Your own figure in Team | Give a new contribution | | Update, withdraw or undo a figure already given |

**Undo** takes back one level of your own latest direct edit, while it is still the newest version and no proposal is pending. It does not take back an approved Olumi proposal or a private contribution, and there is no saved redo.

**The ways into an edit are scattered.**

- Rename has three editors with five ways in.
- Adding has three forms.
- Removing a link has four ways in and three confirmations.
- Frame's Edit opens the sheet behind the Frame stage (layer 1250 over 60), so the person cannot reach it.

Checked in code:

- The board has no link handles (`nodesConnectable={false}`, `ViewCanvas.tsx`).
- The board has no Delete key (`deleteKeyCode` is null).

## The proposed model

This model waits for Paul's ruling (Open decisions, rows 6 and 7).

**Select an element, and its sheet holds everything about it that can be edited.**

- The sheet's heading edits the element's name or text.
- Its value, unit, settings, connections and workings are rows in the sheet. Clicking a field edits it in place.
- Every other way into an edit goes to the same field on the same record: the card pencil, the card ⋯ menu, a right-click, the Model tab, Frame and results in the panel.
- Adding a card and making a link open the same sheet in draft mode.
- A folded group opens a list of its records, so the person can pick one.
- A calculated result shows its inputs and workings and is clearly read-only.
- A private figure says whose it is and whether it has been revealed.

**Proposed rules for every edit.**

- Click or Enter pins the sheet, and Tab reaches its fields.
- Shift+F10 and ⋯ offer the same actions.
- Delete opens the same dependency review as the menu does.
- Escape cancels the current edit and returns focus.
- Save and Try are separate, explicit buttons that work on the same draft.
  - Enter never changes meaning depending on how the edit was opened.
  - Try runs on a copy of the model, and Keep then saves the same change.
- One draft per element and field survives a change of selection and any error the person can recover from.
- **Undo.**
  - Every new direct change ships with its undo, reachable from its receipt and through Cmd/Ctrl+Z.
  - Undo keeps teammates' later work and authorship intact.
- **Core.** Core checks the person, base, references and units on every write. It mints the ids and saves atomically.

## Proposed delivery order

| Step | What a person gets | Status |
|---|---|---|
| 1. Make today's edits coherent | One rename editor, one Add menu and one link-removal confirmation. Frame and Model rows open the exact field. | Proposed. Part of it is in place: every figure edit already goes through one value row. |
| 2. Change the model's structure directly | Draw and reconnect links. Delete cards with their dependencies shown. Change a card's kind where that is valid. | Proposed. Needs new Core operations. |
| 3. Edit what an option does and how a result works | Option settings, unit changes with conversion, aim measures and formulas. | Proposed. Needs new Core operations. |
| 4. Control your own contribution | Revise, withdraw or supersede your own private figure, and correct it after it is revealed. | Proposed. Needs new Core operations. |
