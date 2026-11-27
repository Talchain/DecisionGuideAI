# Lane button and type inventory

Source recount on the joined UI tree starting at `8c0b417c3`. The unit is a button render site. It follows native buttons, `HoverButton`, `Hover as="button"`, `OkIconButton`, `Button`, `MenuItem`, `SubMenu`, and shared chrome to their DOM controls. Mapped records are counted once at their source site. Menu rows are counted as a role. Native `summary` disclosures, navigation links outside menus, and older-look branches are outside the census.

A recipe includes named chip, toolbar and menu geometry. “Matching size” records a site whose starting geometry already matched its role but came from a local declaration. The role column names the closest recipe for the sites that started off-size. After migration, card and content-row controls listed in [Button exceptions](Button.md#exceptions) retain their existing geometry.

| UI lane | Sites | Recipe before | Matching size before | Off-size before | Recipe after | Kept geometry |
|---|---:|---:|---:|---:|---:|---:|
| View | 254 | 80 | 35 | 139 | 234 | 20 |
| Team | 36 | 1 | 0 | 35 | 34 | 2 |
| Versions and comparison | 13 | 0 | 0 | 13 | 11 | 2 |
| Shared chrome | 43 | 30 | 3 | 10 | 43 | 0 |
| **Total** | **346** | **111** | **38** | **197** | **322** | **24** |


## Typography

Counted explicit utilities, arbitrary values, CSS declarations, and references to typography tokens that resolve to the audited sizes or weights.

| Type | View | Team | Versions and comparison | Shared chrome | Total before → after |
|---|---:|---:|---:|---:|---:|
| 11px | 0 | 0 | 0 | 0 | 0 → 0 |
| 13px | 0 | 0 | 0 | 0 | 0 → 0 |
| 16px | 0 | 0 | 0 | 0 | 0 → 0 |
| 600 | 0 | 0 | 2 | 0 | 2 → 0 |
| 700 | 0 | 0 | 0 | 0 | 0 → 0 |

- [`src/olumiCore/scenarioCompare.tsx:94`](../../../../src/olumiCore/scenarioCompare.tsx#L94) used `font-semibold` at line 94 before the migration. It now uses `font-medium` (500).
- [`src/olumiCore/versions.tsx:118`](../../../../src/olumiCore/versions.tsx#L118) used `font-semibold` at line 116 before the migration. It now uses `font-medium` (500).

## View

| Render site | Role | Before | After |
|---|---|---|---|
| [`src/olumiView/AddFigure.tsx:124`](../../../../src/olumiView/AddFigure.tsx#L124) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/Badge.tsx:58`](../../../../src/olumiView/Badge.tsx#L58) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiView/BelowCue.tsx:89`](../../../../src/olumiView/BelowCue.tsx#L89) · `button` | toolbar | Recipe | Recipe |
| [`src/olumiView/BelowCue.tsx:95`](../../../../src/olumiView/BelowCue.tsx#L95) · `button` | toolbar | Recipe | Recipe |
| [`src/olumiView/BriefPanel.tsx:59`](../../../../src/olumiView/BriefPanel.tsx#L59) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/DraftingBoard.tsx:78`](../../../../src/olumiView/DraftingBoard.tsx#L78) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/DraftingBoard.tsx:133`](../../../../src/olumiView/DraftingBoard.tsx#L133) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/DraftingBoard.tsx:94`](../../../../src/olumiView/DraftingBoard.tsx#L94) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiView/DraftingBoard.tsx:126`](../../../../src/olumiView/DraftingBoard.tsx#L126) · `HoverButton` | text chip | Recipe | Recipe |
| [`src/olumiView/EvidenceDock.tsx:143`](../../../../src/olumiView/EvidenceDock.tsx#L143) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/EvidenceDock.tsx:167`](../../../../src/olumiView/EvidenceDock.tsx#L167) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/FigureEdit.tsx:103`](../../../../src/olumiView/FigureEdit.tsx#L103) · `button` | icon chip | Off-size | Recipe |
| [`src/olumiView/FigureEdit.tsx:115`](../../../../src/olumiView/FigureEdit.tsx#L115) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/FigureEdit.tsx:117`](../../../../src/olumiView/FigureEdit.tsx#L117) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/FigureEdit.tsx:224`](../../../../src/olumiView/FigureEdit.tsx#L224) · `button` | text chip | Off-size | Kept geometry |
| [`src/olumiView/FigureEdit.tsx:229`](../../../../src/olumiView/FigureEdit.tsx#L229) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/FigureEdit.tsx:231`](../../../../src/olumiView/FigureEdit.tsx#L231) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/FigureEdit.tsx:260`](../../../../src/olumiView/FigureEdit.tsx#L260) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/FigureEdit.tsx:266`](../../../../src/olumiView/FigureEdit.tsx#L266) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/FigureEdit.tsx:268`](../../../../src/olumiView/FigureEdit.tsx#L268) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/FigureEdit.tsx:270`](../../../../src/olumiView/FigureEdit.tsx#L270) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/FigureEdit.tsx:312`](../../../../src/olumiView/FigureEdit.tsx#L312) · `button` | text chip | Off-size | Kept geometry |
| [`src/olumiView/FigureEdit.tsx:315`](../../../../src/olumiView/FigureEdit.tsx#L315) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/FigureEdit.tsx:317`](../../../../src/olumiView/FigureEdit.tsx#L317) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/FigureEdit.tsx:192`](../../../../src/olumiView/FigureEdit.tsx#L192) · `SizeEditButton` | text chip | Off-size | Recipe |
| [`src/olumiView/FindingLine.tsx:44`](../../../../src/olumiView/FindingLine.tsx#L44) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/LinkMarkChip.tsx:58`](../../../../src/olumiView/LinkMarkChip.tsx#L58) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/LinkMarkChip.tsx:76`](../../../../src/olumiView/LinkMarkChip.tsx#L76) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ResultBand.tsx:50`](../../../../src/olumiView/ResultBand.tsx#L50) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiView/RevealDock.tsx:217`](../../../../src/olumiView/RevealDock.tsx#L217) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/RevealDock.tsx:239`](../../../../src/olumiView/RevealDock.tsx#L239) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiView/RevealDock.tsx:240`](../../../../src/olumiView/RevealDock.tsx#L240) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/RevealMarks.tsx:71`](../../../../src/olumiView/RevealMarks.tsx#L71) · `HoverButton` | icon chip | Off-size | Recipe |
| [`src/olumiView/RevealMarks.tsx:120`](../../../../src/olumiView/RevealMarks.tsx#L120) · `HoverButton` | icon chip | Off-size | Recipe |
| [`src/olumiView/RevealMarks.tsx:157`](../../../../src/olumiView/RevealMarks.tsx#L157) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiView/ScenarioTitleDialog.tsx:68`](../../../../src/olumiView/ScenarioTitleDialog.tsx#L68) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/ScenarioTitleDialog.tsx:70`](../../../../src/olumiView/ScenarioTitleDialog.tsx#L70) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/SelectedRename.tsx:44`](../../../../src/olumiView/SelectedRename.tsx#L44) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/TeamPresence.tsx:41`](../../../../src/olumiView/TeamPresence.tsx#L41) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/TeamPresence.tsx:103`](../../../../src/olumiView/TeamPresence.tsx#L103) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewChances.tsx:112`](../../../../src/olumiView/ViewChances.tsx#L112) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewChat.tsx:239`](../../../../src/olumiView/ViewChat.tsx#L239) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewChat.tsx:456`](../../../../src/olumiView/ViewChat.tsx#L456) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:457`](../../../../src/olumiView/ViewChat.tsx#L457) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:642`](../../../../src/olumiView/ViewChat.tsx#L642) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewChat.tsx:983`](../../../../src/olumiView/ViewChat.tsx#L983) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewChat.tsx:1020`](../../../../src/olumiView/ViewChat.tsx#L1020) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:1031`](../../../../src/olumiView/ViewChat.tsx#L1031) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:1819`](../../../../src/olumiView/ViewChat.tsx#L1819) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:1861`](../../../../src/olumiView/ViewChat.tsx#L1861) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:2302`](../../../../src/olumiView/ViewChat.tsx#L2302) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewChat.tsx:2358`](../../../../src/olumiView/ViewChat.tsx#L2358) · `button` | icon chip | Matching size | Recipe |
| [`src/olumiView/ViewChat.tsx:524`](../../../../src/olumiView/ViewChat.tsx#L524) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:834`](../../../../src/olumiView/ViewChat.tsx#L834) · `OkIconButton` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:835`](../../../../src/olumiView/ViewChat.tsx#L835) · `OkIconButton` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:1038`](../../../../src/olumiView/ViewChat.tsx#L1038) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:2180`](../../../../src/olumiView/ViewChat.tsx#L2180) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:2329`](../../../../src/olumiView/ViewChat.tsx#L2329) · `OkIconButton` | icon chip | Matching size | Recipe |
| [`src/olumiView/ViewChat.tsx:2343`](../../../../src/olumiView/ViewChat.tsx#L2343) · `OkIconButton` | icon chip | Matching size | Recipe |
| [`src/olumiView/ViewChat.tsx:2348`](../../../../src/olumiView/ViewChat.tsx#L2348) · `OkIconButton` | icon chip | Matching size | Recipe |
| [`src/olumiView/ViewChat.tsx:1587`](../../../../src/olumiView/ViewChat.tsx#L1587) · `HoverButton` | icon chip | Off-size | Recipe |
| [`src/olumiView/ViewChat.tsx:1931`](../../../../src/olumiView/ViewChat.tsx#L1931) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewChat.tsx:1936`](../../../../src/olumiView/ViewChat.tsx#L1936) · `HoverButton` | icon chip | Off-size | Recipe |
| [`src/olumiView/ViewChat.tsx:2353`](../../../../src/olumiView/ViewChat.tsx#L2353) · `HoverButton` | text chip | Matching size | Recipe |
| [`src/olumiView/ViewChat.tsx:1589`](../../../../src/olumiView/ViewChat.tsx#L1589) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewChat.tsx:1948`](../../../../src/olumiView/ViewChat.tsx#L1948) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/olumiView/ViewChat.tsx:2346`](../../../../src/olumiView/ViewChat.tsx#L2346) · `RecordStepButton` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewFigureFirst.tsx:53`](../../../../src/olumiView/ViewFigureFirst.tsx#L53) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/ViewFigureFirst.tsx:96`](../../../../src/olumiView/ViewFigureFirst.tsx#L96) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/ViewFigureFirst.tsx:67`](../../../../src/olumiView/ViewFigureFirst.tsx#L67) · `HoverButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/ViewFigureFirst.tsx:80`](../../../../src/olumiView/ViewFigureFirst.tsx#L80) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewLensBar.tsx:100`](../../../../src/olumiView/ViewLensBar.tsx#L100) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewModelTab.tsx:62`](../../../../src/olumiView/ViewModelTab.tsx#L62) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewModelTab.tsx:95`](../../../../src/olumiView/ViewModelTab.tsx#L95) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/ViewModelTab.tsx:218`](../../../../src/olumiView/ViewModelTab.tsx#L218) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/ViewPreMortemKey.tsx:63`](../../../../src/olumiView/ViewPreMortemKey.tsx#L63) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewPreMortemKey.tsx:118`](../../../../src/olumiView/ViewPreMortemKey.tsx#L118) · `HoverButton` | icon chip | Matching size | Recipe |
| [`src/olumiView/ViewPreMortemKey.tsx:72`](../../../../src/olumiView/ViewPreMortemKey.tsx#L72) · `button` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewPreMortemKey.tsx:81`](../../../../src/olumiView/ViewPreMortemKey.tsx#L81) · `button` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewPreMortemKey.tsx:124`](../../../../src/olumiView/ViewPreMortemKey.tsx#L124) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/ViewReasoning.tsx:137`](../../../../src/olumiView/ViewReasoning.tsx#L137) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewReasoning.tsx:166`](../../../../src/olumiView/ViewReasoning.tsx#L166) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewReasoning.tsx:236`](../../../../src/olumiView/ViewReasoning.tsx#L236) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewReasoning.tsx:271`](../../../../src/olumiView/ViewReasoning.tsx#L271) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewReasoning.tsx:274`](../../../../src/olumiView/ViewReasoning.tsx#L274) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewReasoning.tsx:280`](../../../../src/olumiView/ViewReasoning.tsx#L280) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewReasoning.tsx:192`](../../../../src/olumiView/ViewReasoning.tsx#L192) · `Hover` | text chip | Off-size | Kept geometry |
| [`src/olumiView/ViewReasoning.tsx:199`](../../../../src/olumiView/ViewReasoning.tsx#L199) · `Hover` | icon chip | Off-size | Recipe |
| [`src/olumiView/ViewReasoning.tsx:207`](../../../../src/olumiView/ViewReasoning.tsx#L207) · `Hover` | icon chip | Off-size | Recipe |
| [`src/olumiView/ViewSummary.tsx:96`](../../../../src/olumiView/ViewSummary.tsx#L96) · `button` | icon chip | Off-size | Recipe |
| [`src/olumiView/ViewTradeOffsKey.tsx:80`](../../../../src/olumiView/ViewTradeOffsKey.tsx#L80) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewWelcome.tsx:63`](../../../../src/olumiView/ViewWelcome.tsx#L63) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/ViewWhatIfKey.tsx:82`](../../../../src/olumiView/ViewWhatIfKey.tsx#L82) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewWhatIfKey.tsx:86`](../../../../src/olumiView/ViewWhatIfKey.tsx#L86) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewWhatIfKey.tsx:95`](../../../../src/olumiView/ViewWhatIfKey.tsx#L95) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewWhatIfKey.tsx:120`](../../../../src/olumiView/ViewWhatIfKey.tsx#L120) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewWhatIfKey.tsx:94`](../../../../src/olumiView/ViewWhatIfKey.tsx#L94) · `button` | toolbar | Recipe | Recipe |
| [`src/olumiView/ViewZoomNotice.tsx:40`](../../../../src/olumiView/ViewZoomNotice.tsx#L40) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/model/LinkRow.tsx:38`](../../../../src/olumiView/model/LinkRow.tsx#L38) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/model/ModelCardRow.tsx:123`](../../../../src/olumiView/model/ModelCardRow.tsx#L123) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/model/ModelCardRow.tsx:181`](../../../../src/olumiView/model/ModelCardRow.tsx#L181) · `span` | text chip | Off-size | Kept geometry |
| [`src/olumiView/model/ModelCardRow.tsx:203`](../../../../src/olumiView/model/ModelCardRow.tsx#L203) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiView/model/ModelCardRow.tsx:213`](../../../../src/olumiView/model/ModelCardRow.tsx#L213) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiView/model/detail.tsx:41`](../../../../src/olumiView/model/detail.tsx#L41) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/model/detail.tsx:205`](../../../../src/olumiView/model/detail.tsx#L205) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/model/detail.tsx:206`](../../../../src/olumiView/model/detail.tsx#L206) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/model/detail.tsx:209`](../../../../src/olumiView/model/detail.tsx#L209) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/model/detail.tsx:83`](../../../../src/olumiView/model/detail.tsx#L83) · `HoverButton` | text chip | Off-size | Kept geometry |
| [`src/olumiView/model/editors.tsx:242`](../../../../src/olumiView/model/editors.tsx#L242) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/model/editors.tsx:243`](../../../../src/olumiView/model/editors.tsx#L243) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/model/editors.tsx:244`](../../../../src/olumiView/model/editors.tsx#L244) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/model/editors.tsx:280`](../../../../src/olumiView/model/editors.tsx#L280) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/model/editors.tsx:281`](../../../../src/olumiView/model/editors.tsx#L281) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/model/editors.tsx:300`](../../../../src/olumiView/model/editors.tsx#L300) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/model/sections.tsx:36`](../../../../src/olumiView/model/sections.tsx#L36) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/model/structure.tsx:50`](../../../../src/olumiView/model/structure.tsx#L50) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/model/structure.tsx:99`](../../../../src/olumiView/model/structure.tsx#L99) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/model/structure.tsx:118`](../../../../src/olumiView/model/structure.tsx#L118) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/model/structure.tsx:119`](../../../../src/olumiView/model/structure.tsx#L119) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/model/structure.tsx:141`](../../../../src/olumiView/model/structure.tsx#L141) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/model/structure.tsx:192`](../../../../src/olumiView/model/structure.tsx#L192) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/model/structure.tsx:193`](../../../../src/olumiView/model/structure.tsx#L193) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/model/structure.tsx:196`](../../../../src/olumiView/model/structure.tsx#L196) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/model/structure.tsx:210`](../../../../src/olumiView/model/structure.tsx#L210) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/port/AnalysisReaders.tsx:43`](../../../../src/olumiView/port/AnalysisReaders.tsx#L43) · `Hover` | text chip | Off-size | Recipe |
| [`src/olumiView/port/ChanceChart.tsx:101`](../../../../src/olumiView/port/ChanceChart.tsx#L101) · `Hover` | text chip | Off-size | Kept geometry |
| [`src/olumiView/port/ChanceChart.tsx:174`](../../../../src/olumiView/port/ChanceChart.tsx#L174) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/port/ChatFloat.tsx:93`](../../../../src/olumiView/port/ChatFloat.tsx#L93) · `Hover` | icon chip | Off-size | Recipe |
| [`src/olumiView/port/CheckFirst.tsx:85`](../../../../src/olumiView/port/CheckFirst.tsx#L85) · `Hover` | text chip | Off-size | Recipe |
| [`src/olumiView/port/LikelyOutcome.tsx:60`](../../../../src/olumiView/port/LikelyOutcome.tsx#L60) · `Hover` | text chip | Off-size | Kept geometry |
| [`src/olumiView/port/PortAnalysisTab.tsx:93`](../../../../src/olumiView/port/PortAnalysisTab.tsx#L93) · `Hover` | text chip | Off-size | Kept geometry |
| [`src/olumiView/port/PortAnalysisTab.tsx:147`](../../../../src/olumiView/port/PortAnalysisTab.tsx#L147) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/port/PortAnalysisTab.tsx:173`](../../../../src/olumiView/port/PortAnalysisTab.tsx#L173) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/port/ResultNeeds.tsx:49`](../../../../src/olumiView/port/ResultNeeds.tsx#L49) · `Hover` | text chip | Off-size | Kept geometry |
| [`src/olumiView/port/ResultNeeds.tsx:60`](../../../../src/olumiView/port/ResultNeeds.tsx#L60) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/previous/CoreCard.tsx:596`](../../../../src/olumiView/previous/CoreCard.tsx#L596) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/reasoning/AnswerBox.tsx:62`](../../../../src/olumiView/reasoning/AnswerBox.tsx#L62) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/reasoning/AnswerBox.tsx:94`](../../../../src/olumiView/reasoning/AnswerBox.tsx#L94) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/reasoning/AnswerBox.tsx:100`](../../../../src/olumiView/reasoning/AnswerBox.tsx#L100) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/reasoning/StateStrip.tsx:55`](../../../../src/olumiView/reasoning/StateStrip.tsx#L55) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/reasoning/TowardsCommitment.tsx:113`](../../../../src/olumiView/reasoning/TowardsCommitment.tsx#L113) · `button` | text chip | Off-size | Kept geometry |
| [`src/olumiView/reasoning/TowardsCommitment.tsx:131`](../../../../src/olumiView/reasoning/TowardsCommitment.tsx#L131) · `button` | text chip | Off-size | Kept geometry |
| [`src/olumiView/reasoning/TowardsCommitment.tsx:147`](../../../../src/olumiView/reasoning/TowardsCommitment.tsx#L147) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/reasoning/parts.tsx:48`](../../../../src/olumiView/reasoning/parts.tsx#L48) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/reasoning/parts.tsx:67`](../../../../src/olumiView/reasoning/parts.tsx#L67) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/reasoning/parts.tsx:91`](../../../../src/olumiView/reasoning/parts.tsx#L91) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/strategy/StrategyChips.tsx:37`](../../../../src/olumiView/strategy/StrategyChips.tsx#L37) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiView/strategy/StrategyOverview.tsx:24`](../../../../src/olumiView/strategy/StrategyOverview.tsx#L24) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/strategy/StrategyViewLines.tsx:48`](../../../../src/olumiView/strategy/StrategyViewLines.tsx#L48) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/strategy/overview/StrategyOverviewOpener.tsx:20`](../../../../src/olumiView/strategy/overview/StrategyOverviewOpener.tsx#L20) · `button` | toolbar | Recipe | Recipe |
| [`src/olumiView/strategy/overview/StrategyOverviewPage.tsx:65`](../../../../src/olumiView/strategy/overview/StrategyOverviewPage.tsx#L65) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/v12/KeepIdea.tsx:40`](../../../../src/olumiView/v12/KeepIdea.tsx#L40) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/v12/KeepIdea.tsx:48`](../../../../src/olumiView/v12/KeepIdea.tsx#L48) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/v12/UndoControl.tsx:34`](../../../../src/olumiView/v12/UndoControl.tsx#L34) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/v12/actionsMenu.tsx:61`](../../../../src/olumiView/v12/actionsMenu.tsx#L61) · `HoverButton` | icon chip | Matching size | Recipe |
| [`src/olumiView/v12/actionsMenu.tsx:72`](../../../../src/olumiView/v12/actionsMenu.tsx#L72) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/olumiView/v12/actionsMenu.tsx:98`](../../../../src/olumiView/v12/actionsMenu.tsx#L98) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/olumiView/v12/actionsMenu.tsx:122`](../../../../src/olumiView/v12/actionsMenu.tsx#L122) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/olumiView/v12/arrival/FirstArrival.tsx:48`](../../../../src/olumiView/v12/arrival/FirstArrival.tsx#L48) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/bands/BandLayer.tsx:91`](../../../../src/olumiView/v12/bands/BandLayer.tsx#L91) · `HoverButton` | icon chip | Off-size | Recipe |
| [`src/olumiView/v12/bands/BandNodes.tsx:72`](../../../../src/olumiView/v12/bands/BandNodes.tsx#L72) · `HoverButton` | text chip | Off-size | Kept geometry |
| [`src/olumiView/v12/bands/BandNodes.tsx:87`](../../../../src/olumiView/v12/bands/BandNodes.tsx#L87) · `HoverButton` | text chip | Off-size | Kept geometry |
| [`src/olumiView/v12/bands/IdeaPanel.tsx:52`](../../../../src/olumiView/v12/bands/IdeaPanel.tsx#L52) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/bands/IdeaPanel.tsx:53`](../../../../src/olumiView/v12/bands/IdeaPanel.tsx#L53) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/bands/IdeaPanel.tsx:55`](../../../../src/olumiView/v12/bands/IdeaPanel.tsx#L55) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/cards/GoalMeasureLine.tsx:17`](../../../../src/olumiView/v12/cards/GoalMeasureLine.tsx#L17) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/cards/RestsOn.tsx:24`](../../../../src/olumiView/v12/cards/RestsOn.tsx#L24) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/cards/marks.tsx:203`](../../../../src/olumiView/v12/cards/marks.tsx#L203) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/chat/AboutChip.tsx:40`](../../../../src/olumiView/v12/chat/AboutChip.tsx#L40) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/v12/chat/ChatFootRow.tsx:83`](../../../../src/olumiView/v12/chat/ChatFootRow.tsx#L83) · `HoverButton` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/chat/IntakeSheet.tsx:84`](../../../../src/olumiView/v12/chat/IntakeSheet.tsx#L84) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/chat/IntakeSheet.tsx:88`](../../../../src/olumiView/v12/chat/IntakeSheet.tsx#L88) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/v12/chat/IntakeSheet.tsx:109`](../../../../src/olumiView/v12/chat/IntakeSheet.tsx#L109) · `HoverButton` | text chip | Off-size | Kept geometry |
| [`src/olumiView/v12/chat/KeepChooser.tsx:28`](../../../../src/olumiView/v12/chat/KeepChooser.tsx#L28) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/chat/KeptIdeas.tsx:44`](../../../../src/olumiView/v12/chat/KeptIdeas.tsx#L44) · `UseAsActionButton` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/chat/OlumiAsks.tsx:102`](../../../../src/olumiView/v12/chat/OlumiAsks.tsx#L102) · `button` | icon chip | Off-size | Recipe |
| [`src/olumiView/v12/chat/OlumiAsks.tsx:125`](../../../../src/olumiView/v12/chat/OlumiAsks.tsx#L125) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/chat/OlumiAsks.tsx:110`](../../../../src/olumiView/v12/chat/OlumiAsks.tsx#L110) · `HoverButton` | icon chip | Matching size | Recipe |
| [`src/olumiView/v12/chat/OlumiAsks.tsx:114`](../../../../src/olumiView/v12/chat/OlumiAsks.tsx#L114) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/v12/chat/OlumiAsks.tsx:126`](../../../../src/olumiView/v12/chat/OlumiAsks.tsx#L126) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/v12/chat/ReplyFacts.tsx:37`](../../../../src/olumiView/v12/chat/ReplyFacts.tsx#L37) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/v12/chat/ReplyLead.tsx:44`](../../../../src/olumiView/v12/chat/ReplyLead.tsx#L44) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/detailed/charts.tsx:36`](../../../../src/olumiView/v12/detailed/charts.tsx#L36) · `HoverButton` | icon chip | Off-size | Recipe |
| [`src/olumiView/v12/detailed/marks.tsx:69`](../../../../src/olumiView/v12/detailed/marks.tsx#L69) · `Hover` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/detailed/marks.tsx:121`](../../../../src/olumiView/v12/detailed/marks.tsx#L121) · `Hover` | icon chip | Off-size | Recipe |
| [`src/olumiView/v12/edit/EditForm.tsx:238`](../../../../src/olumiView/v12/edit/EditForm.tsx#L238) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/edit/EditForm.tsx:240`](../../../../src/olumiView/v12/edit/EditForm.tsx#L240) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/edit/LaneInspector.tsx:162`](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L162) · `button` | icon chip | Matching size | Recipe |
| [`src/olumiView/v12/edit/LaneInspector.tsx:292`](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L292) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/edit/LaneInspector.tsx:293`](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L293) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/edit/LaneInspector.tsx:325`](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L325) · `button` | icon chip | Matching size | Recipe |
| [`src/olumiView/v12/edit/LaneInspector.tsx:165`](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L165) · `HoverButton` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/edit/LaneInspector.tsx:345`](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L345) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/edit/LaneInspector.tsx:291`](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L291) · `CommitToThisButton` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/edit/LaneInspector.tsx:294`](../../../../src/olumiView/v12/edit/LaneInspector.tsx#L294) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/v12/edit/RenameHeading.tsx:68`](../../../../src/olumiView/v12/edit/RenameHeading.tsx#L68) · `button` | text chip | Off-size | Kept geometry |
| [`src/olumiView/v12/frame/FramePage.tsx:76`](../../../../src/olumiView/v12/frame/FramePage.tsx#L76) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/frame/FramePage.tsx:119`](../../../../src/olumiView/v12/frame/FramePage.tsx#L119) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/v12/frame/FramePage.tsx:143`](../../../../src/olumiView/v12/frame/FramePage.tsx#L143) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/v12/frame/FramePage.tsx:113`](../../../../src/olumiView/v12/frame/FramePage.tsx#L113) · `HoverButton` | text chip | Matching size | Recipe |
| [`src/olumiView/v12/frame/FrameStage.tsx:18`](../../../../src/olumiView/v12/frame/FrameStage.tsx#L18) · `button` | toolbar | Recipe | Recipe |
| [`src/olumiView/v12/inspect/FigureInspector.tsx:94`](../../../../src/olumiView/v12/inspect/FigureInspector.tsx#L94) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/inspect/FigureInspector.tsx:120`](../../../../src/olumiView/v12/inspect/FigureInspector.tsx#L120) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/inspect/FigureInspector.tsx:121`](../../../../src/olumiView/v12/inspect/FigureInspector.tsx#L121) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/inspect/ValueRow.tsx:140`](../../../../src/olumiView/v12/inspect/ValueRow.tsx#L140) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/inspect/ValueRow.tsx:146`](../../../../src/olumiView/v12/inspect/ValueRow.tsx#L146) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/inspect/ValueRow.tsx:148`](../../../../src/olumiView/v12/inspect/ValueRow.tsx#L148) · `button` | text chip | Recipe | Recipe |
| [`src/olumiView/v12/journey/CatchUp.tsx:38`](../../../../src/olumiView/v12/journey/CatchUp.tsx#L38) · `button` | text chip | Off-size | Kept geometry |
| [`src/olumiView/v12/journey/JourneyRecord.tsx:111`](../../../../src/olumiView/v12/journey/JourneyRecord.tsx#L111) · `button` | text chip | Off-size | Kept geometry |
| [`src/olumiView/v12/journey/JourneyRecord.tsx:139`](../../../../src/olumiView/v12/journey/JourneyRecord.tsx#L139) · `button` | text chip | Off-size | Kept geometry |
| [`src/olumiView/v12/journey/JourneyRecord.tsx:165`](../../../../src/olumiView/v12/journey/JourneyRecord.tsx#L165) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/journey/JourneyRecord.tsx:248`](../../../../src/olumiView/v12/journey/JourneyRecord.tsx#L248) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/learning/ExpectationEntry.tsx:42`](../../../../src/olumiView/v12/learning/ExpectationEntry.tsx#L42) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/lenses/LensesMenu.tsx:58`](../../../../src/olumiView/v12/lenses/LensesMenu.tsx#L58) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/v12/lenses/LensesMenu.tsx:99`](../../../../src/olumiView/v12/lenses/LensesMenu.tsx#L99) · `HoverButton` | icon chip | Off-size | Recipe |
| [`src/olumiView/v12/lenses/LensesMenu.tsx:69`](../../../../src/olumiView/v12/lenses/LensesMenu.tsx#L69) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/olumiView/v12/lenses/LensesMenu.tsx:71`](../../../../src/olumiView/v12/lenses/LensesMenu.tsx#L71) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/olumiView/v12/lenses/LensesMenu.tsx:79`](../../../../src/olumiView/v12/lenses/LensesMenu.tsx#L79) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/olumiView/v12/scale/DifferAxis.tsx:72`](../../../../src/olumiView/v12/scale/DifferAxis.tsx#L72) · `Hover` | text chip | Off-size | Kept geometry |
| [`src/olumiView/v12/showInWorkspace/ShowInWorkspace.tsx:47`](../../../../src/olumiView/v12/showInWorkspace/ShowInWorkspace.tsx#L47) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/v12/team/CommitForm.tsx:199`](../../../../src/olumiView/v12/team/CommitForm.tsx#L199) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/team/CommitForm.tsx:212`](../../../../src/olumiView/v12/team/CommitForm.tsx#L212) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/v12/team/CommitForm.tsx:193`](../../../../src/olumiView/v12/team/CommitForm.tsx#L193) · `OkIconButton` | icon chip | Recipe | Recipe |
| [`src/olumiView/v12/team/CommitForm.tsx:209`](../../../../src/olumiView/v12/team/CommitForm.tsx#L209) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/team/CommittedMark.tsx:27`](../../../../src/olumiView/v12/team/CommittedMark.tsx#L27) · `HoverButton` | icon chip | Off-size | Recipe |
| [`src/olumiView/v12/tools/CompareOptions.tsx:50`](../../../../src/olumiView/v12/tools/CompareOptions.tsx#L50) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/tools/CompareOptions.tsx:177`](../../../../src/olumiView/v12/tools/CompareOptions.tsx#L177) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/v12/tools/DifferTool.tsx:78`](../../../../src/olumiView/v12/tools/DifferTool.tsx#L78) · `HoverButton` | text chip | Off-size | Kept geometry |
| [`src/olumiView/v12/tools/StressTest.tsx:81`](../../../../src/olumiView/v12/tools/StressTest.tsx#L81) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/tools/StressTest.tsx:232`](../../../../src/olumiView/v12/tools/StressTest.tsx#L232) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/v12/tools/StressTest.tsx:242`](../../../../src/olumiView/v12/tools/StressTest.tsx#L242) · `button` | text chip | Matching size | Recipe |
| [`src/olumiView/v12/tools/StressTest.tsx:278`](../../../../src/olumiView/v12/tools/StressTest.tsx#L278) · `Hover` | text chip | Matching size | Recipe |
| [`src/olumiView/v12/views/AskToCompare.tsx:36`](../../../../src/olumiView/v12/views/AskToCompare.tsx#L36) · `AskButton` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/CompareViewsStage.tsx:106`](../../../../src/olumiView/v12/views/CompareViewsStage.tsx#L106) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/CompareViewsStage.tsx:115`](../../../../src/olumiView/v12/views/CompareViewsStage.tsx#L115) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/FrameEntry.tsx:99`](../../../../src/olumiView/v12/views/FrameEntry.tsx#L99) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/FrameEntry.tsx:148`](../../../../src/olumiView/v12/views/FrameEntry.tsx#L148) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/FrameEntry.tsx:154`](../../../../src/olumiView/v12/views/FrameEntry.tsx#L154) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/FrameEntry.tsx:120`](../../../../src/olumiView/v12/views/FrameEntry.tsx#L120) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/FrameEntry.tsx:134`](../../../../src/olumiView/v12/views/FrameEntry.tsx#L134) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/FrameEntry.tsx:153`](../../../../src/olumiView/v12/views/FrameEntry.tsx#L153) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/RoundRead.tsx:48`](../../../../src/olumiView/v12/views/RoundRead.tsx#L48) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/ViewsToggle.tsx:25`](../../../../src/olumiView/v12/views/ViewsToggle.tsx#L25) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/v12/views/ViewsToggle.tsx:30`](../../../../src/olumiView/v12/views/ViewsToggle.tsx#L30) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiView/v12/views/WhereWeDiffer.tsx:139`](../../../../src/olumiView/v12/views/WhereWeDiffer.tsx#L139) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/WhereWeDiffer.tsx:172`](../../../../src/olumiView/v12/views/WhereWeDiffer.tsx#L172) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/WhereWeDiffer.tsx:173`](../../../../src/olumiView/v12/views/WhereWeDiffer.tsx#L173) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/WhereWeDiffer.tsx:232`](../../../../src/olumiView/v12/views/WhereWeDiffer.tsx#L232) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/WhereWeDiffer.tsx:237`](../../../../src/olumiView/v12/views/WhereWeDiffer.tsx#L237) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/WhereWeDiffer.tsx:247`](../../../../src/olumiView/v12/views/WhereWeDiffer.tsx#L247) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/WhereWeDiffer.tsx:273`](../../../../src/olumiView/v12/views/WhereWeDiffer.tsx#L273) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/WhereWeDiffer.tsx:280`](../../../../src/olumiView/v12/views/WhereWeDiffer.tsx#L280) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/WhereWeDiffer.tsx:281`](../../../../src/olumiView/v12/views/WhereWeDiffer.tsx#L281) · `button` | text chip | Off-size | Recipe |
| [`src/olumiView/v12/views/WhereWeDiffer.tsx:171`](../../../../src/olumiView/v12/views/WhereWeDiffer.tsx#L171) · `AskButton` | text chip | Off-size | Recipe |

## Team

| Render site | Role | Before | After |
|---|---|---|---|
| [`src/olumiCore/team/CardDiffers.tsx:85`](../../../../src/olumiCore/team/CardDiffers.tsx#L85) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/CardDispute.tsx:120`](../../../../src/olumiCore/team/CardDispute.tsx#L120) · `HoverButton` | icon chip | Off-size | Recipe |
| [`src/olumiCore/team/CommitmentPanel.tsx:117`](../../../../src/olumiCore/team/CommitmentPanel.tsx#L117) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/CommitmentPanel.tsx:152`](../../../../src/olumiCore/team/CommitmentPanel.tsx#L152) · `button` | text chip | Off-size | Kept geometry |
| [`src/olumiCore/team/CommitmentPanel.tsx:181`](../../../../src/olumiCore/team/CommitmentPanel.tsx#L181) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/CommitmentPanel.tsx:182`](../../../../src/olumiCore/team/CommitmentPanel.tsx#L182) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/CommitmentPanel.tsx:183`](../../../../src/olumiCore/team/CommitmentPanel.tsx#L183) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/DissentPanel.tsx:93`](../../../../src/olumiCore/team/DissentPanel.tsx#L93) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/DissentPanel.tsx:95`](../../../../src/olumiCore/team/DissentPanel.tsx#L95) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/EvidencePanel.tsx:56`](../../../../src/olumiCore/team/EvidencePanel.tsx#L56) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/EvidencePanel.tsx:117`](../../../../src/olumiCore/team/EvidencePanel.tsx#L117) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/EvidencePanel.tsx:143`](../../../../src/olumiCore/team/EvidencePanel.tsx#L143) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/EvidencePanel.tsx:144`](../../../../src/olumiCore/team/EvidencePanel.tsx#L144) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/InvitePanel.tsx:59`](../../../../src/olumiCore/team/InvitePanel.tsx#L59) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/InvitePanel.tsx:69`](../../../../src/olumiCore/team/InvitePanel.tsx#L69) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/LinkStance.tsx:99`](../../../../src/olumiCore/team/LinkStance.tsx#L99) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/LinkStance.tsx:122`](../../../../src/olumiCore/team/LinkStance.tsx#L122) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/OutcomePanel.tsx:99`](../../../../src/olumiCore/team/OutcomePanel.tsx#L99) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/OutcomePanel.tsx:138`](../../../../src/olumiCore/team/OutcomePanel.tsx#L138) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/OutcomePanel.tsx:139`](../../../../src/olumiCore/team/OutcomePanel.tsx#L139) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/SavedActions.tsx:51`](../../../../src/olumiCore/team/SavedActions.tsx#L51) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/SavedActions.tsx:52`](../../../../src/olumiCore/team/SavedActions.tsx#L52) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/TeamTab.tsx:69`](../../../../src/olumiCore/team/TeamTab.tsx#L69) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/TeamTab.tsx:239`](../../../../src/olumiCore/team/TeamTab.tsx#L239) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/TeamTab.tsx:128`](../../../../src/olumiCore/team/TeamTab.tsx#L128) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/olumiCore/team/TeamTab.tsx:165`](../../../../src/olumiCore/team/TeamTab.tsx#L165) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/TeamTab.tsx:176`](../../../../src/olumiCore/team/TeamTab.tsx#L176) · `button` | text chip | Off-size | Kept geometry |
| [`src/olumiCore/team/TeamTab.tsx:256`](../../../../src/olumiCore/team/TeamTab.tsx#L256) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/ViewDoubts.tsx:105`](../../../../src/olumiCore/team/ViewDoubts.tsx#L105) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/ViewsPanel.tsx:161`](../../../../src/olumiCore/team/ViewsPanel.tsx#L161) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/ViewsPanel.tsx:189`](../../../../src/olumiCore/team/ViewsPanel.tsx#L189) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/ViewsPanel.tsx:186`](../../../../src/olumiCore/team/ViewsPanel.tsx#L186) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/ViewsPanel.tsx:220`](../../../../src/olumiCore/team/ViewsPanel.tsx#L220) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/ViewsPanel.tsx:276`](../../../../src/olumiCore/team/ViewsPanel.tsx#L276) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/ViewsPanel.tsx:212`](../../../../src/olumiCore/team/ViewsPanel.tsx#L212) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/team/steps.tsx:46`](../../../../src/olumiCore/team/steps.tsx#L46) · `button` | text chip | Off-size | Recipe |

## Versions and comparison

| Render site | Role | Before | After |
|---|---|---|---|
| [`src/olumiCore/compare.tsx:142`](../../../../src/olumiCore/compare.tsx#L142) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/compare.tsx:546`](../../../../src/olumiCore/compare.tsx#L546) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/compare.tsx:260`](../../../../src/olumiCore/compare.tsx#L260) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/compare.tsx:315`](../../../../src/olumiCore/compare.tsx#L315) · `button` | text chip | Off-size | Recipe |
| [`src/olumiCore/compare.tsx:488`](../../../../src/olumiCore/compare.tsx#L488) · `HoverButton` | text chip | Off-size | Kept geometry |
| [`src/olumiCore/compare.tsx:513`](../../../../src/olumiCore/compare.tsx#L513) · `HoverButton` | text chip | Off-size | Kept geometry |
| [`src/olumiCore/scenarioCompare.tsx:329`](../../../../src/olumiCore/scenarioCompare.tsx#L329) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/scenarioCompare.tsx:383`](../../../../src/olumiCore/scenarioCompare.tsx#L383) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/scenarioCompare.tsx:389`](../../../../src/olumiCore/scenarioCompare.tsx#L389) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/scenarioCompare.tsx:394`](../../../../src/olumiCore/scenarioCompare.tsx#L394) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/versions.tsx:56`](../../../../src/olumiCore/versions.tsx#L56) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/versions.tsx:108`](../../../../src/olumiCore/versions.tsx#L108) · `Button` | text chip | Off-size | Recipe |
| [`src/olumiCore/versions.tsx:117`](../../../../src/olumiCore/versions.tsx#L117) · `HoverButton` | text chip | Off-size | Recipe |

## Shared chrome

| Render site | Role | Before | After |
|---|---|---|---|
| [`src/canvas/components/OlumiAttentionCard.tsx:398`](../../../../src/canvas/components/OlumiAttentionCard.tsx#L398) · `button` | icon chip | Off-size | Recipe |
| [`src/canvas/components/OlumiAttentionCard.tsx:477`](../../../../src/canvas/components/OlumiAttentionCard.tsx#L477) · `button` | icon chip | Off-size | Recipe |
| [`src/canvas/components/OlumiAttentionCard.tsx:523`](../../../../src/canvas/components/OlumiAttentionCard.tsx#L523) · `button` | icon chip | Off-size | Recipe |
| [`src/canvas/components/OlumiAttentionCard.tsx:558`](../../../../src/canvas/components/OlumiAttentionCard.tsx#L558) · `button` | text chip | Off-size | Recipe |
| [`src/canvas/components/OutputsDock.tsx:3418`](../../../../src/canvas/components/OutputsDock.tsx#L3418) · `HoverButton` | icon chip | Matching size | Recipe |
| [`src/canvas/components/OutputsDock.tsx:3816`](../../../../src/canvas/components/OutputsDock.tsx#L3816) · `button` | text chip | Off-size | Recipe |
| [`src/canvas/components/SelectionPill.tsx:141`](../../../../src/canvas/components/SelectionPill.tsx#L141) · `OkIconButton` | icon chip | Off-size | Recipe |
| [`src/canvas/components/SelectionPill.tsx:142`](../../../../src/canvas/components/SelectionPill.tsx#L142) · `OkIconButton` | icon chip | Off-size | Recipe |
| [`src/canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx:188`](../../../../src/canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx#L188) · `button` | text chip | Matching size | Recipe |
| [`src/canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx:376`](../../../../src/canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx#L376) · `HoverButton` | text chip | Matching size | Recipe |
| [`src/canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx:500`](../../../../src/canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx#L500) · `HoverButton` | text chip | Off-size | Recipe |
| [`src/canvas/contextMenu/ContextRows.tsx:26`](../../../../src/canvas/contextMenu/ContextRows.tsx#L26) · `SubMenu` | menu row | Recipe | Recipe |
| [`src/canvas/contextMenu/ContextRows.tsx:31`](../../../../src/canvas/contextMenu/ContextRows.tsx#L31) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/canvas/edges/ViewLinkEdge.tsx:343`](../../../../src/canvas/edges/ViewLinkEdge.tsx#L343) · `LaneLinkRemoveButton` | text chip | Recipe | Recipe |
| [`src/canvas/help/KeyboardLegend.tsx:205`](../../../../src/canvas/help/KeyboardLegend.tsx#L205) · `HoverButton` | icon chip | Recipe | Recipe |
| [`src/canvas/help/KeyboardLegend.tsx:257`](../../../../src/canvas/help/KeyboardLegend.tsx#L257) · `button` | text chip | Recipe | Recipe |
| [`src/canvas/nodes/BaseNode.tsx:2950`](../../../../src/canvas/nodes/BaseNode.tsx#L2950) · `button` | icon chip | Off-size | Recipe |
| [`src/canvas/versions/WhatChangedPanel.tsx:153`](../../../../src/canvas/versions/WhatChangedPanel.tsx#L153) · `button` | text chip | Recipe | Recipe |
| [`src/components/layout/CanvasViewportControls.tsx:144`](../../../../src/components/layout/CanvasViewportControls.tsx#L144) · `CanvasToolButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/CanvasViewportControls.tsx:145`](../../../../src/components/layout/CanvasViewportControls.tsx#L145) · `CanvasToolButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/CanvasViewportControls.tsx:146`](../../../../src/components/layout/CanvasViewportControls.tsx#L146) · `CanvasToolButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/CanvasViewportControls.tsx:151`](../../../../src/components/layout/CanvasViewportControls.tsx#L151) · `CanvasToolButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/CanvasViewportControls.tsx:158`](../../../../src/components/layout/CanvasViewportControls.tsx#L158) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/components/layout/CanvasViewportControls.tsx:161`](../../../../src/components/layout/CanvasViewportControls.tsx#L161) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/components/layout/CanvasViewportControls.tsx:164`](../../../../src/components/layout/CanvasViewportControls.tsx#L164) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/components/layout/KebabMenu.tsx:246`](../../../../src/components/layout/KebabMenu.tsx#L246) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/KebabMenu.tsx:298`](../../../../src/components/layout/KebabMenu.tsx#L298) · `HoverButton` | icon chip | Off-size | Recipe |
| [`src/components/layout/KebabMenu.tsx:273`](../../../../src/components/layout/KebabMenu.tsx#L273) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/components/layout/KebabMenu.tsx:275`](../../../../src/components/layout/KebabMenu.tsx#L275) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/components/layout/KebabMenu.tsx:280`](../../../../src/components/layout/KebabMenu.tsx#L280) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/components/layout/KebabMenu.tsx:284`](../../../../src/components/layout/KebabMenu.tsx#L284) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/components/layout/KebabMenu.tsx:285`](../../../../src/components/layout/KebabMenu.tsx#L285) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/components/layout/KebabMenu.tsx:288`](../../../../src/components/layout/KebabMenu.tsx#L288) · `MenuItem` | menu row | Recipe | Recipe |
| [`src/components/layout/LeftSidebar.tsx:166`](../../../../src/components/layout/LeftSidebar.tsx#L166) · `CanvasToolButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/LeftSidebar.tsx:188`](../../../../src/components/layout/LeftSidebar.tsx#L188) · `CanvasToolButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/LeftSidebar.tsx:191`](../../../../src/components/layout/LeftSidebar.tsx#L191) · `CanvasToolButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/LeftSidebar.tsx:238`](../../../../src/components/layout/LeftSidebar.tsx#L238) · `CanvasToolButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/TopBar.tsx:317`](../../../../src/components/layout/TopBar.tsx#L317) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/TopBar.tsx:397`](../../../../src/components/layout/TopBar.tsx#L397) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/TopBar.tsx:420`](../../../../src/components/layout/TopBar.tsx#L420) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/TopBar.tsx:498`](../../../../src/components/layout/TopBar.tsx#L498) · `HoverButton` | toolbar | Recipe | Recipe |
| [`src/components/layout/TopBar.tsx:458`](../../../../src/components/layout/TopBar.tsx#L458) · `VersionsTrigger` | toolbar | Recipe | Recipe |
| [`src/components/layout/TopBar.tsx:469`](../../../../src/components/layout/TopBar.tsx#L469) · `ViewSummaryTrigger` | toolbar | Recipe | Recipe |
