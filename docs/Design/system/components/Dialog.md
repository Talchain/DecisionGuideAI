# Dialog

A modal for a single short task, such as renaming a scenario, confirming a deletion or reading the summary.

Summary, Rename scenario and Delete your data use the shared shell and focus lifecycle. Remaining dialogs are listed in [Popups](Popups.md).

## Anatomy

- **Scrim**: `--backdrop`, on the modal layer.
- **Panel**: the [shared popup shell](Popups.md).
- **Heading**: `panelHeader`.
- **Fields**: 44px, `rounded-sm` (8px), with a `border-field` border.
- **Actions**: on the right. One green action (`VIEW_CHIP_PRIMARY_CLASS`) and a ghost Cancel.

## The contract (follow `ViewSummary.tsx`)

- Focus moves into the dialog: to its first field, or to Close.
- Tab is trapped inside the dialog.
- Escape closes it through the shared stack. An outside press also closes it. A dialog with a write in flight stays open until the write settles.
- Focus returns to the trigger.
- `role="dialog"`, `aria-modal="true"` and an accessible name.

## Code

- `src/olumiView/ViewSummary.tsx` (the model to follow)
- `src/olumiView/ScenarioTitleDialog.tsx`
- `src/olumiCore/DeleteMyDataDialog.tsx`
