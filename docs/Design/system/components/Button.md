# Button

The lane uses 28px chips and 30px toolbar faces. Controls use the 6px `radius-control` and the lane type scale. The toolbar keeps its expanded hit area across the track.

## Recipes

| Role | Geometry | Recipes |
|---|---|---|
| Text chip | `controls.chipText` · `min-h-7`, 8px horizontal padding, 12px type | `VIEW_CHIP_PRIMARY_CLASS`, `VIEW_CHIP_CLASS`, `VIEW_CHIP_OUTLINE_CLASS`, shared `Button size="chip"` |
| Icon chip | `controls.chipIcon` · `min-h-7`, 28px minimum width, no padding, 12px type | `VIEW_ICON_BUTTON_PRIMARY_CLASS`, `VIEW_ICON_BUTTON_CLASS`, `OkIconButton` |
| Toolbar | `controls.toolbarButton` · 30px face, 12px type. Fixed-width icons are 30px with no horizontal padding. Counted icons use 4px and labels use 8px | `TOOLBAR_ICON`, `TOOLBAR_RAIL_ICON`, `TOOLBAR_COUNTED_ICON`, `TOOLBAR_LABEL`, `TOOLBAR_ACTION` |
| Menu row | `MENU_ROW` · a single line with the menu's own padding | `MenuItem`, `SubMenu` |

A button with an icon and visible count uses the text-chip geometry so it can grow with the count.

## Rules

- One filled button per screen.
- Use the lane's green for a filled action. Blue identifies Olumi.
- A held control stays legible and gives its reason in its tip.
- Use the 12px, 14px and 18px typography tokens at weight 400 or 500.

## Exceptions

The following buttons target an entire content block or appear in place of readable content. Their geometry belongs to that content.

- [`src/olumiCore/compare.tsx:488`](../../../../src/olumiCore/compare.tsx#L488). The target covers the full changed-card comparison.
- [`src/olumiCore/compare.tsx:513`](../../../../src/olumiCore/compare.tsx#L513). The target covers the full changed-link comparison.
- [`src/olumiCore/team/CommitmentPanel.tsx:152`](../../../../src/olumiCore/team/CommitmentPanel.tsx#L152). Selectable option tile keeps room for a wrapped description.
- [`src/olumiCore/team/TeamTab.tsx:176`](../../../../src/olumiCore/team/TeamTab.tsx#L176). The button covers the complete step row.
- [`src/olumiView/FigureEdit.tsx:224`](../../../../src/olumiView/FigureEdit.tsx#L224). Inline value editor preserves the dimensions of the figure it replaces.
- [`src/olumiView/FigureEdit.tsx:312`](../../../../src/olumiView/FigureEdit.tsx#L312). Inline value opener shares the dimensions of the figure.
- [`src/olumiView/ViewReasoning.tsx:192`](../../../../src/olumiView/ViewReasoning.tsx#L192). The challenge target includes the question and its supporting reason.
- [`src/olumiView/model/ModelCardRow.tsx:181`](../../../../src/olumiView/model/ModelCardRow.tsx#L181). The press target is the editable model heading.
- [`src/olumiView/model/detail.tsx:83`](../../../../src/olumiView/model/detail.tsx#L83). The linked-record target includes its optional expert detail.
- [`src/olumiView/port/ChanceChart.tsx:101`](../../../../src/olumiView/port/ChanceChart.tsx#L101). The comparison target includes the chart and its labels.
- [`src/olumiView/port/LikelyOutcome.tsx:60`](../../../../src/olumiView/port/LikelyOutcome.tsx#L60). The outcome target includes its supporting detail.
- [`src/olumiView/port/PortAnalysisTab.tsx:93`](../../../../src/olumiView/port/PortAnalysisTab.tsx#L93). The constraint target includes the option and its condition.
- [`src/olumiView/port/ResultNeeds.tsx:49`](../../../../src/olumiView/port/ResultNeeds.tsx#L49). The finding target includes its supporting text.
- [`src/olumiView/reasoning/TowardsCommitment.tsx:113`](../../../../src/olumiView/reasoning/TowardsCommitment.tsx#L113). The option target covers the entire content row.
- [`src/olumiView/reasoning/TowardsCommitment.tsx:131`](../../../../src/olumiView/reasoning/TowardsCommitment.tsx#L131). The disagreement target covers the entire content row.
- [`src/olumiView/v12/bands/BandNodes.tsx:72`](../../../../src/olumiView/v12/bands/BandNodes.tsx#L72). The whole grouped card uses the band card height.
- [`src/olumiView/v12/bands/BandNodes.tsx:87`](../../../../src/olumiView/v12/bands/BandNodes.tsx#L87). The whole collapsed Inputs card uses the band card height.
- [`src/olumiView/v12/chat/IntakeSheet.tsx:109`](../../../../src/olumiView/v12/chat/IntakeSheet.tsx#L109). The button covers the entire intake row.
- [`src/olumiView/v12/edit/RenameHeading.tsx:68`](../../../../src/olumiView/v12/edit/RenameHeading.tsx#L68). The press target is the editable card title.
- [`src/olumiView/v12/journey/CatchUp.tsx:38`](../../../../src/olumiView/v12/journey/CatchUp.tsx#L38). The catch-up summary can wrap across multiple lines.
- [`src/olumiView/v12/journey/JourneyRecord.tsx:111`](../../../../src/olumiView/v12/journey/JourneyRecord.tsx#L111). The press target covers the complete record.
- [`src/olumiView/v12/journey/JourneyRecord.tsx:139`](../../../../src/olumiView/v12/journey/JourneyRecord.tsx#L139). The press target covers the complete outcome record.
- [`src/olumiView/v12/scale/DifferAxis.tsx:72`](../../../../src/olumiView/v12/scale/DifferAxis.tsx#L72). The target follows the height of its data-grid row.
- [`src/olumiView/v12/tools/DifferTool.tsx:78`](../../../../src/olumiView/v12/tools/DifferTool.tsx#L78). The target covers the difference and its supporting text.


Menu rows use their own single-line recipe at [MenuRow](../../../../src/olumiView/look/Menu.tsx) and retain full text in the tooltip when clipped. No audited typography exceptions remain in the lane.

## Code

- [Control geometry](../../../../src/styles/controls.ts)
- [Chip recipes](../../../../src/v5/blocks/chipClass.ts)
- [Toolbar recipes](../../../../src/olumiView/look/toolbar.ts)
- [Before-and-after inventory](Button-audit.md)
