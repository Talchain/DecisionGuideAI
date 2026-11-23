# Dialog

A modal for a single short task, such as renaming a scenario, confirming a deletion or reading the summary.

**Status: partly.** Summary follows the whole contract. The rename and history dialogs follow part of it. The keyboard legend is off the system.

## Anatomy

- **Scrim**: black at 20%, on layer 6000.
- **Panel**: `bg-panel`, a `border-default` hairline, `radius-lg` (14px), `shadow-3`, `p-3` and `gap-3`.
- **Heading**: `panelHeader`.
- **Fields**: 44px, `rounded-sm` (8px), with a `border-field` border.
- **Actions**: on the right. One green action (`VIEW_CHIP_PRIMARY_CLASS`) and a ghost Cancel.

## The contract (follow `ViewSummary.tsx`)

- Focus moves into the dialog: to its first field, or to Close.
- Tab is trapped inside the dialog.
- Escape closes it through the shared stack. So does a press on the scrim, unless the dialog is saving.
- Focus returns to the trigger.
- `role="dialog"`, `aria-modal="true"` and an accessible name.

## Code

- `src/olumiView/ViewSummary.tsx` (the model to follow)
- `src/olumiView/ScenarioTitleDialog.tsx`
- `src/olumiCore/DeleteMyDataDialog.tsx`

This preview is a static rendition at UI `9aa1b195`. It shows the rename dialog drawn to this system's spacing (`p-3`); the code uses `p-4` today.
