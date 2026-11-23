# Review line

The "What you said" line in the panel. It counts the figures from what the person said that the model does not hold yet, and opens to show them.

**Status: built.**

## Anatomy

- **Box**: `rounded-md` (12px), a `border-default` hairline, `bg-panel`, `p-3` and `space-y-3`, with `viewPanelBody` text.
- **Summary**: one plain `text-body` line, "N figures not in your model yet". When nothing is missing, it reads "N figures from what you said".
- **Toggle**: the green `VIEW_CHIP_PRIMARY_CLASS`, reading "Review" or "Hide figures", plus a ghost remove button.
- **Open body**: a top hairline, `pt-3` and `space-y-4`.
- **Gap sentences**: under the heading "Not in your model yet" in `viewPanelHeading`, then the person's own words in `space-y-3`, with `leading-6` and a dashed `border-field` underline at a 4px offset.
- **Record rows**: divided by hairlines, each `py-2.5`, holding a 14px kind marker (dashed for an assumption), the heading and the figure on the right in tabular `text-light`. A row shows its card on the board.

## Code

- `src/olumiView/v12/chat/IntakeSheet.tsx`

This preview is a static rendition at UI `9aa1b195`, with example content.
