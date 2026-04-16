# UI Copy Audit Report
Generated: 2026-04-03
Scope: All non-test files under `src/`

---

## SUMMARY COUNTS

| Pattern Group | Count |
|---|---|
| placeholder | 109 |
| aria_label | 378 |
| title_tooltip | 236 |
| section_heading | 212 |
| error_message | 322 |
| loading_status | 821 (includes code refs) |
| button_text | 39 |
| alt_text | 4 |
| badge_pill | 81 |
| template_literal | 3,536 (includes className) |
| console_message | 686 |
| css_content | 1 |
| constant_value | See below |
| empty_state | See below |
| jsx_text | See below |

---

## 1. CONSTANT FILES (constant_value)

### src/config/terminology.ts
```
src/config/terminology.ts:19 | constant_value | Confidence
src/config/terminology.ts:20 | constant_value | Belief (epistemic uncertainty)
src/config/terminology.ts:21 | constant_value | How certain you are about this relationship
src/config/terminology.ts:24 | constant_value | Influence
src/config/terminology.ts:25 | constant_value | Weight
src/config/terminology.ts:26 | constant_value | How strongly this factor affects the outcome
src/config/terminology.ts:29 | constant_value | Source
src/config/terminology.ts:30 | constant_value | Provenance
src/config/terminology.ts:31 | constant_value | Where this information came from
src/config/terminology.ts:48 | constant_value | Downside
src/config/terminology.ts:49 | constant_value | Conservative (10th percentile)
src/config/terminology.ts:50 | constant_value | Lower-bound estimate, accounting for unfavorable scenarios
src/config/terminology.ts:53 | constant_value | Expected
src/config/terminology.ts:54 | constant_value | Most Likely (50th percentile)
src/config/terminology.ts:55 | constant_value | Median outcome, most probable result
src/config/terminology.ts:58 | constant_value | Upside
src/config/terminology.ts:59 | constant_value | Optimistic (90th percentile)
src/config/terminology.ts:60 | constant_value | Upper-bound estimate, accounting for favorable scenarios
```

### src/constants/validation.ts
```
src/constants/validation.ts:24 | constant_value | Market expansion
src/constants/validation.ts:25 | constant_value | Should we expand into the European market this year or focus on growing our US customer base? Key factors include regulatory costs, market size, and competitive landscape.
src/constants/validation.ts:29 | constant_value | Hiring strategy
src/constants/validation.ts:30 | constant_value | We need to decide between hiring three senior engineers or six junior engineers for our platform team. The main considerations are velocity, mentorship capacity, and budget.
src/constants/validation.ts:34 | constant_value | Product launch timing
src/constants/validation.ts:35 | constant_value | Should we launch the premium tier this quarter or wait until we have more active users? We want to maximise revenue without hurting retention.
```

### src/components/results/emptyStates.ts
```
src/components/results/emptyStates.ts:2 | constant_value | Run an analysis to identify key factors affecting your goal
src/components/results/emptyStates.ts:3 | constant_value | Complete your model to see recommendations
src/components/results/emptyStates.ts:4 | constant_value | Analysis will identify sensitive assumptions
src/components/results/emptyStates.ts:5 | constant_value | Analysis will suggest next actions
src/components/results/emptyStates.ts:6 | constant_value | Confidence data not available for this factor
src/components/results/emptyStates.ts:7 | constant_value | Range data not available
src/components/results/emptyStates.ts:8 | constant_value | Analysis will suggest improvements to strengthen your model
```

### src/components/results/constants.ts
```
src/components/results/constants.ts:14 | constant_value | Robust
src/components/results/constants.ts:15 | constant_value | Moderate
src/components/results/constants.ts:16 | constant_value | Moderate
src/components/results/constants.ts:17 | constant_value | Sensitive
src/components/results/constants.ts:18 | constant_value | Highly sensitive
```

### src/canvas/compare/labels.ts
```
src/canvas/compare/labels.ts:21 | constant_value | Run A
src/canvas/compare/labels.ts:23 | constant_value | Run B
src/canvas/compare/labels.ts:30 | constant_value | Side-by-Side
src/canvas/compare/labels.ts:32 | constant_value | Changes Only
src/canvas/compare/labels.ts:39 | constant_value | added
src/canvas/compare/labels.ts:40 | constant_value | removed
src/canvas/compare/labels.ts:41 | constant_value | modified
src/canvas/compare/labels.ts:42 | constant_value | unchanged
src/canvas/compare/labels.ts:50 | constant_value | Summary:
src/canvas/compare/labels.ts:52 | constant_value | Nodes:
src/canvas/compare/labels.ts:54 | constant_value | Edges:
src/canvas/compare/labels.ts:56 | constant_value | Top changes:
src/canvas/compare/labels.ts:58 | constant_value | No changes
```

### src/lib/userFriendlyErrors.ts
```
src/lib/userFriendlyErrors.ts:73 | error_message | headline: Connection issue
src/lib/userFriendlyErrors.ts:74 | error_message | explanation: We couldn't reach our servers. Please check your internet connection.
src/lib/userFriendlyErrors.ts:75 | error_message | actionText: Try Again
src/lib/userFriendlyErrors.ts:79 | error_message | headline: Request took too long
src/lib/userFriendlyErrors.ts:80 | error_message | explanation: The analysis is taking longer than expected. You can try again with a simpler model.
src/lib/userFriendlyErrors.ts:81 | error_message | actionText: Try Again
src/lib/userFriendlyErrors.ts:87 | error_message | headline: Session expired
src/lib/userFriendlyErrors.ts:88 | error_message | explanation: Please refresh the page to continue.
src/lib/userFriendlyErrors.ts:89 | error_message | actionText: Refresh Page
src/lib/userFriendlyErrors.ts:93 | error_message | headline: Access denied
src/lib/userFriendlyErrors.ts:94 | error_message | explanation: You don't have permission for this action.
src/lib/userFriendlyErrors.ts:95 | error_message | actionText: Go Back
src/lib/userFriendlyErrors.ts:101 | error_message | headline: Model needs adjustment
src/lib/userFriendlyErrors.ts:102 | error_message | explanation: Some parts of your model need to be updated before running analysis.
src/lib/userFriendlyErrors.ts:103 | error_message | actionText: Review Model
src/lib/userFriendlyErrors.ts:107 | error_message | headline: Add elements first
src/lib/userFriendlyErrors.ts:108 | error_message | explanation: Your model needs at least one factor before running analysis.
src/lib/userFriendlyErrors.ts:109 | error_message | actionText: Add Elements
src/lib/userFriendlyErrors.ts:115 | error_message | headline: Service temporarily unavailable
src/lib/userFriendlyErrors.ts:116 | error_message | explanation: We're experiencing high demand. Please try again in a moment.
src/lib/userFriendlyErrors.ts:117 | error_message | actionText: Try Again
src/lib/userFriendlyErrors.ts:118 | error_message | secondaryActionText: Continue Without
src/lib/userFriendlyErrors.ts:122 | error_message | headline: Too many requests
src/lib/userFriendlyErrors.ts:123 | error_message | explanation: Please wait a moment before trying again.
src/lib/userFriendlyErrors.ts:124 | error_message | actionText: Wait and Retry
src/lib/userFriendlyErrors.ts:130 | error_message | headline: Model needs adjustment
src/lib/userFriendlyErrors.ts:131 | error_message | explanation: Each option needs intervention values before analysis can run. Click an option node to configure.
src/lib/userFriendlyErrors.ts:132 | error_message | actionText: Review Model
src/lib/userFriendlyErrors.ts:138 | error_message | headline: Analysis couldn't complete
src/lib/userFriendlyErrors.ts:139 | error_message | explanation: Something went wrong during analysis. Your model is unchanged.
src/lib/userFriendlyErrors.ts:140 | error_message | actionText: Try Again
src/lib/userFriendlyErrors.ts:144 | error_message | headline: Results processing issue
src/lib/userFriendlyErrors.ts:145 | error_message | explanation: We received the analysis results but had trouble displaying them. Please try again.
src/lib/userFriendlyErrors.ts:146 | error_message | actionText: Try Again
src/lib/userFriendlyErrors.ts:150 | error_message | headline: Partial analysis available
src/lib/userFriendlyErrors.ts:151 | error_message | explanation: The full review couldn't complete, but your core results are still valid.
src/lib/userFriendlyErrors.ts:152 | error_message | actionText: View Results
src/lib/userFriendlyErrors.ts:153 | error_message | secondaryActionText: Retry Full Analysis
src/lib/userFriendlyErrors.ts:157 | error_message | headline: Some insights unavailable
src/lib/userFriendlyErrors.ts:158 | error_message | explanation: We couldn't load all insights, but the main analysis is complete.
src/lib/userFriendlyErrors.ts:159 | error_message | actionText: View Results
src/lib/userFriendlyErrors.ts:165 | error_message | headline: Comparison couldn't complete
src/lib/userFriendlyErrors.ts:166 | error_message | explanation: We couldn't compare your options. Try again or view individual results.
src/lib/userFriendlyErrors.ts:167 | error_message | actionText: Try Again
src/lib/userFriendlyErrors.ts:168 | error_message | secondaryActionText: View Individual Results
src/lib/userFriendlyErrors.ts:179 | error_message | headline: Not found
src/lib/userFriendlyErrors.ts:180 | error_message | explanation: The requested resource couldn't be found.
src/lib/userFriendlyErrors.ts:181 | error_message | actionText: Go Back
src/lib/userFriendlyErrors.ts:186 | error_message | headline: Something went wrong
src/lib/userFriendlyErrors.ts:187 | error_message | explanation: An unexpected error occurred. Please try again.
src/lib/userFriendlyErrors.ts:188 | error_message | actionText: Try Again
src/lib/userFriendlyErrors.ts:198 | error_message | headline: Something went wrong
src/lib/userFriendlyErrors.ts:199 | error_message | explanation: An unexpected error occurred. Please try again.
src/lib/userFriendlyErrors.ts:200 | error_message | actionText: Try Again
```

### src/lib/errors.ts
```
src/lib/errors.ts:22 | error_message | The request took too long to respond.
src/lib/errors.ts:22 | error_message | Try again
src/lib/errors.ts:24 | error_message | A temporary issue occurred.
src/lib/errors.ts:24 | error_message | Try again
src/lib/errors.ts:26 | error_message | Something went wrong on our side.
src/lib/errors.ts:26 | error_message | Try again
src/lib/errors.ts:28 | error_message | Please check your input and try again.
src/lib/errors.ts:28 | error_message | Check input
src/lib/errors.ts:30 | error_message | You have reached the limit. Please wait and retry.
src/lib/errors.ts:30 | error_message | Wait and retry
src/lib/errors.ts:32 | error_message | The service is temporarily unavailable. Please wait and retry.
src/lib/errors.ts:32 | error_message | Wait and retry
src/lib/errors.ts:34 | error_message | We could not complete your request.
src/lib/errors.ts:34 | error_message | Try again
```

### src/config/aiModels.ts
```
src/config/aiModels.ts:60 | constant_value | GPT-4o (Recommended)
src/config/aiModels.ts:68 | constant_value | GPT-4o Mini
src/config/aiModels.ts:76 | constant_value | Claude Sonnet 4
src/config/aiModels.ts:84 | constant_value | Claude Sonnet 4.5
src/config/aiModels.ts:92 | constant_value | Claude Haiku
```

## 2. PLACEHOLDER (placeholder)

```
src/routes/PlotWorkspace.tsx:782 | placeholder | 
src/pages/ProfileSettingsPage.tsx:147 | placeholder | 
src/pages/ProfileSettingsPage.tsx:227 | placeholder | 
src/components/LandingPage.tsx:238 | placeholder | 
src/components/LandingPage.tsx:284 | placeholder | 
src/components/debug/PayloadLabTab.tsx:2102 | placeholder | 
src/components/debug/PayloadLabTab.tsx:2122 | placeholder | 
src/components/debug/PayloadLabTab.tsx:2137 | placeholder | 
src/components/debug/PayloadLabTab.tsx:2515 | placeholder | 
src/components/debug/PayloadLabTab.tsx:2562 | placeholder | 
src/components/debug/PayloadLabTab.tsx:2777 | placeholder | 
src/components/GoalClarificationScreen.tsx:121 | placeholder | 
src/components/shared/ScientificEditor.tsx:241 | placeholder | 
src/components/ConfigDrawer.tsx:127 | placeholder | 
src/components/assistants/ClarifierPanel.tsx:176 | placeholder | 
src/components/ChatBox.tsx:56 | placeholder | 
src/components/assistants/DraftForm.tsx:98 | placeholder | 
src/components/assistants/DraftForm.tsx:114 | placeholder | 
src/components/SandboxStreamPanel.tsx:1021 | placeholder | 
src/components/InviteCollaborators.tsx:82 | placeholder | 
src/canvas/contextMenu/SetValuePopover.tsx:98 | placeholder | 
src/components/CollaborativeOptions/index.tsx:117 | placeholder | 
src/components/auth/SignUpForm.tsx:153 | placeholder | 
src/components/auth/SignUpForm.tsx:166 | placeholder | 
src/components/teams/EditTeamModal.tsx:71 | placeholder | 
src/components/teams/EditTeamModal.tsx:85 | placeholder | 
src/canvas/panels/InspectorPanel.tsx:395 | placeholder | 
src/components/teams/UserDirectoryTab.tsx:70 | placeholder | 
src/components/auth/ResetPasswordForm.tsx:175 | placeholder | 
src/components/auth/ResetPasswordForm.tsx:208 | placeholder | 
src/components/OptionsIdeation.tsx:183 | placeholder | 
src/components/OptionsIdeation.tsx:189 | placeholder | 
src/components/teams/CreateTeamModal.tsx:70 | placeholder | 
src/components/teams/CreateTeamModal.tsx:84 | placeholder | 
src/components/auth/LoginForm.tsx:153 | placeholder | 
src/components/auth/LoginForm.tsx:166 | placeholder | 
src/canvas/panels/AIClarifierChat.tsx:265 | placeholder | 
src/components/auth/LoginPage.tsx:135 | placeholder | 
src/components/auth/ForgotPasswordForm.tsx:115 | placeholder | 
src/components/teams/ManageTeamMembersModal.tsx:290 | placeholder | 
src/components/teams/ManageTeamMembersModal.tsx:349 | placeholder | 
src/canvas/panels/TemplatesPanel.tsx:658 | placeholder | 
src/components/Analysis.tsx:693 | placeholder | 
src/components/ProsConsList/AddOptionModal.tsx:42 | placeholder | 
src/canvas/provenance/ProvenanceHub.tsx:64 | placeholder | 
src/canvas/ui/EdgeInspector.tsx:442 | placeholder | 
src/canvas/ui/inspector/GoalThresholdEditor.tsx:88 | placeholder | 
src/canvas/components/InsightsTab.tsx:190 | placeholder | 
src/canvas/components/GraphTextView.tsx:388 | placeholder | 
src/canvas/ui/inspector-v2/panels/OptionPanel.tsx:136 | placeholder | 
src/canvas/ui/inspector-v2/panels/FactorExternalPanel.tsx:133 | placeholder | 
src/components/ProsConsList/OptionColumn.tsx:201 | placeholder | 
src/components/ProsConsList/OptionColumn.tsx:275 | placeholder | 
src/canvas/snapshots/SnapshotPanel.tsx:112 | placeholder | 
src/components/decisions/DecisionForm.tsx:203 | placeholder | 
src/components/decisions/DecisionForm.tsx:328 | placeholder | 
src/canvas/ui/inspector-v2/panels/FactorControllablePanel.tsx:200 | placeholder | 
src/canvas/components/ScenarioSwitcher.tsx:390 | placeholder | 
src/canvas/components/ScenarioSwitcher.tsx:434 | placeholder | 
src/canvas/ui/inspector-v2/panels/DecisionPanel.tsx:81 | placeholder | 
src/components/decisions/DecisionList.tsx:427 | placeholder | 
src/canvas/ui/NodeInspector.tsx:506 | placeholder | 
src/canvas/ui/NodeInspector.tsx:589 | placeholder | 
src/canvas/ui/NodeInspector.tsx:602 | placeholder | 
src/canvas/ui/NodeInspector.tsx:619 | placeholder | 
src/canvas/components/InputsDock.tsx:72 | placeholder | 
src/canvas/components/InputsDock.tsx:86 | placeholder | 
src/canvas/components/InputsDock.tsx:100 | placeholder | 
src/canvas/components/InputsDock.tsx:127 | placeholder | 
src/canvas/components/InputsDock.tsx:141 | placeholder | 
src/canvas/components/InputsDock.tsx:155 | placeholder | 
src/canvas/components/InputsDock.tsx:476 | placeholder | 
src/canvas/ui/inspector-v2/panels/GoalPanel.tsx:138 | placeholder | 
src/canvas/ui/inspector-v2/panels/GoalPanel.tsx:309 | placeholder | 
src/canvas/ui/EdgeInspectorCompact.tsx:190 | placeholder | 
src/canvas/components/ThresholdInput.tsx:83 | placeholder | 
src/canvas/components/ThresholdInput.tsx:121 | placeholder | 
src/canvas/ui/inspector-v2/editors/RiskAdvancedEditor.tsx:63 | placeholder | 
src/canvas/ui/inspector-v2/editors/OutcomeAdvancedEditor.tsx:73 | placeholder | 
src/canvas/palette/CommandPalette.tsx:119 | placeholder | 
src/canvas/ui/inspector-v2/editors/OptionAdvancedEditor.tsx:78 | placeholder | 
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:84 | placeholder | 
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:91 | placeholder | 
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:106 | placeholder | 
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:121 | placeholder | 
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:187 | placeholder | 
src/canvas/ui/inspector-v2/editors/GoalAdvancedEditor.tsx:54 | placeholder | 
src/canvas/ui/inspector-v2/editors/FactorObservableEditor.tsx:48 | placeholder | 
src/canvas/ui/inspector-v2/editors/FactorObservableEditor.tsx:55 | placeholder | 
src/canvas/ui/inspector-v2/editors/FactorObservableEditor.tsx:75 | placeholder | 
src/canvas/ui/inspector-v2/editors/EdgeAdvancedEditor.tsx:104 | placeholder | 
src/canvas/components/DecisionRationaleForm.tsx:99 | placeholder | 
src/canvas/components/DecisionRationaleForm.tsx:114 | placeholder | 
src/canvas/components/DecisionRationaleForm.tsx:131 | placeholder | 
src/canvas/components/DecisionRationaleForm.tsx:164 | placeholder | 
src/canvas/components/DecisionRationaleForm.tsx:199 | placeholder | 
src/canvas/components/DecisionRationaleForm.tsx:260 | placeholder | 
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:1389 | placeholder | 
src/canvas/components/GoalModePanel.tsx:101 | placeholder | 
src/canvas/components/CompareView.tsx:141 | placeholder | 
src/canvas/components/CompareView.tsx:152 | placeholder | 
src/canvas/components/UserMappingForm.tsx:226 | placeholder | 
src/canvas/components/CommandPalette.tsx:233 | placeholder | 
src/canvas/components/ComparisonTable.tsx:75 | placeholder | 
src/canvas/components/ProvenanceHubTab.tsx:86 | placeholder | 
src/canvas/components/pre-analysis/SuccessTarget.tsx:453 | placeholder | 
src/canvas/components/pre-analysis/AllImprovements.tsx:1102 | placeholder | 
src/canvas/components/DocumentsManager.tsx:128 | placeholder | 
src/canvas/components/model-tab/ModelFooter.tsx:43 | placeholder | 
```

## 2. PLACEHOLDER (placeholder)

```
placeholder | 100:placeholder="For example: next quarter, 12–18 months."
placeholder | 101:placeholder="e.g., 50000"
placeholder | 1021:placeholder="Add a comment…"
placeholder | 104:placeholder="Describe the causal mechanism"
placeholder | 106:placeholder="Reference value"
placeholder | 1102:placeholder="Enter evidence source (URL or description)"
placeholder | 112:placeholder="Snapshot name..."
placeholder | 114:placeholder="Explain the rationale for this decision..."
placeholder | 114:placeholder="Key constraints, timelines, stakeholders, or risks we should consider"
placeholder | 115:placeholder="Enter your email"
placeholder | 117:placeholder="Add a new option..."
placeholder | 119:placeholder="Type to search... (⌘K to close)"
placeholder | 121:placeholder="Enter a goal…"
placeholder | 121:placeholder="e.g. Q3 report"
placeholder | 121:placeholder="e.g., 100000"
placeholder | 127:placeholder="Key constraints or non-negotiables."
placeholder | 127:placeholder="http://localhost:8787"
placeholder | 128:placeholder="Search documents..."
placeholder | 131:placeholder="Enter a positive aspect..."
placeholder | 133:placeholder="Describe this external factor..."
placeholder | 135:placeholder="you@example.com"
placeholder | 136:placeholder="What would choosing this option actually mean in practice?"
placeholder | 1389:placeholder="Enter target value"
placeholder | 138:placeholder="Describe what achieving this goal looks like..."
placeholder | 141:placeholder="Document your reasoning for this decision..."
placeholder | 141:placeholder="What could go wrong or be costly?"
placeholder | 147:placeholder="Your name"
placeholder | 152:placeholder="Decision title..."
placeholder | 153:placeholder="Enter your email"
placeholder | 155:placeholder="Unknowns, assumptions, or information gaps."
placeholder | 164:placeholder="Enter a negative aspect..."
placeholder | 166:placeholder="Create a password"
placeholder | 166:placeholder="Enter your password"
placeholder | 175:placeholder="New password"
placeholder | 176:placeholder="Type your answer here..."
placeholder | 183:placeholder="Option label"
placeholder | 187:placeholder="Add driver…"
placeholder | 189:placeholder="Description (optional)"
placeholder | 190:placeholder="Optional..."
placeholder | 190:placeholder="Target market..."
placeholder | 199:placeholder="Enter an alternative option..."
placeholder | 200:placeholder="Enter value"
placeholder | 201:placeholder="Add a new pro..."
placeholder | 203:placeholder="Enter a clear, specific title for your decision"
placeholder | 208:placeholder="Confirm new password"
placeholder | 2102:placeholder="Brief input..."
placeholder | 2122:placeholder="(optional)"
placeholder | 2137:placeholder="(optional)"
placeholder | 226:placeholder="Value"
placeholder | 227:placeholder="Type DELETE"
placeholder | 233:placeholder="Search actions..."
placeholder | 238:placeholder="Enter your email"
placeholder | 241:placeholder="Enter value"
placeholder | 2515:placeholder="Paste ISL payload JSON here..."
placeholder | 2562:placeholder="Compare payload JSON..."
placeholder | 260:placeholder="Name or role of decision maker"
placeholder | 265:placeholder="Describe your decision, factors, or ask for changes..."
placeholder | 275:placeholder="Add a new con..."
placeholder | 2777:placeholder="Snapshot name..."
placeholder | 284:placeholder="Enter access code"
placeholder | 290:placeholder="Test email address"
placeholder | 309:placeholder="Target value"
placeholder | 328:placeholder="What do you want to achieve with this decision?"
placeholder | 349:placeholder="One per line or comma-separated"
placeholder | 388:placeholder="Search nodes..."
placeholder | 390:placeholder="Scenario name"
placeholder | 395:placeholder="Source or rationale for this connection..."
placeholder | 427:placeholder="Search decisions..."
placeholder | 42:placeholder="Enter option name..."
placeholder | 434:placeholder="Scenario name"
placeholder | 43:placeholder="Search factors and edges…"
placeholder | 442:placeholder="Add a label..."
placeholder | 453:placeholder="e.g. Budget must stay under $50k"
placeholder | 476:placeholder="Ask about your model…"
placeholder | 48:placeholder="Original units"
placeholder | 506:placeholder="Add a note..."
placeholder | 54:placeholder="e.g. revenue, users"
placeholder | 55:placeholder="£, %, users…"
placeholder | 56:placeholder="Ask DecisionGuide.AI anything"
placeholder | 589:placeholder="e.g. £, %, users"
placeholder | 602:placeholder="59"
placeholder | 619:placeholder="49"
placeholder | 63:placeholder="Risk description"
placeholder | 64:placeholder="Search citations..."
placeholder | 658:placeholder="Search templates..."
placeholder | 693:placeholder="Enter email address"
placeholder | 70:placeholder="Enter team name"
placeholder | 70:placeholder="Search by name or email..."
placeholder | 71:placeholder="Enter team name"
placeholder | 72:placeholder="What decision are you making?"
placeholder | 73:placeholder="Outcome description"
placeholder | 75:placeholder="Scenario name"
placeholder | 75:placeholder="e.g. Q3 report"
placeholder | 782:placeholder="Node name..."
placeholder | 78:placeholder="Option description"
placeholder | 81:placeholder="What's the decision you're facing and why does it matter now?"
placeholder | 82:placeholder="Enter email address"
placeholder | 83:placeholder="Threshold..."
placeholder | 84:placeholder="Enter team description"
placeholder | 84:placeholder="Original units"
placeholder | 85:placeholder="Enter team description"
placeholder | 86:placeholder="Search citations..."
placeholder | 86:placeholder="What does a good outcome look like?"
placeholder | 88:placeholder="e.g. 200"
placeholder | 91:placeholder="£, %, users…"
placeholder | 98:placeholder="Enter value"
placeholder | 98:placeholder="For example: Which supplier strategy should we adopt for next year?"
placeholder | 99:placeholder="e.g., Approve Product Launch Strategy"
```

### Full placeholder listing with file paths:
```
src/routes/PlotWorkspace.tsx:782:                placeholder="Node name..." | placeholder
src/pages/ProfileSettingsPage.tsx:147:            placeholder="Your name" | placeholder
src/pages/ProfileSettingsPage.tsx:227:              placeholder="Type DELETE" | placeholder
src/components/debug/PayloadLabTab.tsx:2102:          placeholder="Brief input..." | placeholder
src/components/debug/PayloadLabTab.tsx:2122:              placeholder="(optional)" | placeholder
src/components/debug/PayloadLabTab.tsx:2137:              placeholder="(optional)" | placeholder
src/components/debug/PayloadLabTab.tsx:2515:              placeholder="Paste ISL payload JSON here..." | placeholder
src/components/debug/PayloadLabTab.tsx:2562:                placeholder="Compare payload JSON..." | placeholder
src/components/debug/PayloadLabTab.tsx:2777:              placeholder="Snapshot name..." | placeholder
src/canvas/snapshots/SnapshotPanel.tsx:112:            placeholder="Snapshot name..." | placeholder
src/components/Analysis.tsx:693:                          placeholder="Enter email address" | placeholder
src/canvas/provenance/ProvenanceHub.tsx:64:            placeholder="Search citations..." | placeholder
src/components/CollaborativeOptions/index.tsx:117:            placeholder="Add a new option..." | placeholder
src/components/teams/EditTeamModal.tsx:71:              placeholder="Enter team name" | placeholder
src/components/teams/EditTeamModal.tsx:85:              placeholder="Enter team description" | placeholder
src/canvas/components/InsightsTab.tsx:190:          placeholder="Target market..." | placeholder
src/canvas/ui/inspector-v2/panels/OptionPanel.tsx:136:          placeholder="What would choosing this option actually mean in practice?" | placeholder
src/components/teams/UserDirectoryTab.tsx:70:          placeholder="Search by name or email..." | placeholder
src/canvas/ui/inspector-v2/panels/FactorExternalPanel.tsx:133:          placeholder="Describe this external factor..." | placeholder
src/canvas/components/GraphTextView.tsx:388:              placeholder="Search nodes..." | placeholder
src/components/teams/CreateTeamModal.tsx:70:              placeholder="Enter team name" | placeholder
src/components/teams/CreateTeamModal.tsx:84:              placeholder="Enter team description" | placeholder
src/canvas/ui/inspector-v2/panels/FactorControllablePanel.tsx:200:            placeholder="Enter value" | placeholder
src/components/teams/ManageTeamMembersModal.tsx:290:                      placeholder="Test email address" | placeholder
src/components/teams/ManageTeamMembersModal.tsx:349:                  placeholder="One per line or comma-separated" | placeholder
src/components/decisions/DecisionForm.tsx:203:              placeholder="Enter a clear, specific title for your decision" | placeholder
src/components/decisions/DecisionForm.tsx:328:                    placeholder="What do you want to achieve with this decision?" | placeholder
src/canvas/ui/inspector-v2/panels/DecisionPanel.tsx:81:          placeholder="What's the decision you're facing and why does it matter now?" | placeholder
src/components/decisions/DecisionList.tsx:427:                placeholder="Search decisions..." | placeholder
src/components/OptionsIdeation.tsx:183:                    placeholder="Option label" | placeholder
src/components/OptionsIdeation.tsx:189:                    placeholder="Description (optional)" | placeholder
src/canvas/ui/inspector-v2/panels/GoalPanel.tsx:138:          placeholder="Describe what achieving this goal looks like..." | placeholder
src/canvas/ui/inspector-v2/panels/GoalPanel.tsx:309:              placeholder="Target value" | placeholder
src/canvas/ui/inspector-v2/editors/RiskAdvancedEditor.tsx:63:          placeholder="Risk description" | placeholder
src/canvas/components/CommandPalette.tsx:233:            placeholder="Search actions..." | placeholder
src/components/LandingPage.tsx:238:                          placeholder="Enter your email" | placeholder
src/components/LandingPage.tsx:284:                      placeholder="Enter access code" | placeholder
src/canvas/ui/inspector-v2/editors/OutcomeAdvancedEditor.tsx:73:          placeholder="Outcome description" | placeholder
src/components/GoalClarificationScreen.tsx:121:              placeholder="Enter a goal…" | placeholder
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:84:          placeholder="Original units" | placeholder
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:91:          placeholder="£, %, users…" | placeholder
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:106:          placeholder="Reference value" | placeholder
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:121:          placeholder="e.g. Q3 report" | placeholder
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:187:              placeholder="Add driver…" | placeholder
src/canvas/ui/inspector-v2/editors/EdgeAdvancedEditor.tsx:104:          placeholder="Describe the causal mechanism" | placeholder
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:1389:                placeholder="Enter target value" | placeholder
src/components/shared/ScientificEditor.tsx:241:          placeholder="Enter value" | placeholder
src/canvas/ui/inspector-v2/editors/GoalAdvancedEditor.tsx:54:          placeholder="e.g. revenue, users" | placeholder
src/canvas/ui/inspector-v2/editors/OptionAdvancedEditor.tsx:78:          placeholder="Option description" | placeholder
src/canvas/contextMenu/SetValuePopover.tsx:98:          placeholder="Enter value" | placeholder
src/canvas/ui/inspector-v2/editors/FactorObservableEditor.tsx:48:          placeholder="Original units" | placeholder
src/canvas/ui/inspector-v2/editors/FactorObservableEditor.tsx:55:          placeholder="£, %, users…" | placeholder
src/canvas/ui/inspector-v2/editors/FactorObservableEditor.tsx:75:          placeholder="e.g. Q3 report" | placeholder
src/canvas/ui/NodeInspector.tsx:506:          placeholder="Add a note..." | placeholder
src/canvas/ui/NodeInspector.tsx:589:                placeholder="e.g. £, %, users" | placeholder
src/canvas/ui/NodeInspector.tsx:602:                placeholder="59" | placeholder
src/canvas/ui/NodeInspector.tsx:619:              placeholder="49" | placeholder
src/canvas/ui/EdgeInspectorCompact.tsx:190:          placeholder="Optional..." | placeholder
src/canvas/components/GoalModePanel.tsx:101:              placeholder="e.g., 50000" | placeholder
src/canvas/panels/InspectorPanel.tsx:395:                    placeholder="Source or rationale for this connection..." | placeholder
src/canvas/ui/EdgeInspector.tsx:442:          placeholder="Add a label..." | placeholder
src/components/SandboxStreamPanel.tsx:1021:                    placeholder="Add a comment…" | placeholder
src/components/InviteCollaborators.tsx:82:                placeholder="Enter email address" | placeholder
src/canvas/components/ScenarioSwitcher.tsx:390:              placeholder="Scenario name" | placeholder
src/canvas/components/ScenarioSwitcher.tsx:434:              placeholder="Scenario name" | placeholder
src/canvas/components/DecisionRationaleForm.tsx:99:          placeholder="e.g., Approve Product Launch Strategy" | placeholder
src/canvas/components/DecisionRationaleForm.tsx:114:          placeholder="Explain the rationale for this decision..." | placeholder
src/canvas/components/DecisionRationaleForm.tsx:131:                placeholder="Enter a positive aspect..." | placeholder
src/canvas/components/DecisionRationaleForm.tsx:164:                placeholder="Enter a negative aspect..." | placeholder
src/canvas/components/DecisionRationaleForm.tsx:199:                placeholder="Enter an alternative option..." | placeholder
src/canvas/components/DecisionRationaleForm.tsx:260:          placeholder="Name or role of decision maker" | placeholder
src/canvas/components/InputsDock.tsx:72:              placeholder="What decision are you making?" | placeholder
src/canvas/components/InputsDock.tsx:86:              placeholder="What does a good outcome look like?" | placeholder
src/canvas/components/InputsDock.tsx:100:              placeholder="For example: next quarter, 12–18 months." | placeholder
src/canvas/components/InputsDock.tsx:127:                  placeholder="Key constraints or non-negotiables." | placeholder
src/canvas/components/InputsDock.tsx:141:                  placeholder="What could go wrong or be costly?" | placeholder
src/canvas/components/InputsDock.tsx:155:                  placeholder="Unknowns, assumptions, or information gaps." | placeholder
src/canvas/components/InputsDock.tsx:476:          placeholder="Ask about your model…" | placeholder
src/canvas/panels/AIClarifierChat.tsx:265:          placeholder="Describe your decision, factors, or ask for changes..." | placeholder
src/canvas/palette/CommandPalette.tsx:119:            placeholder="Type to search... (⌘K to close)" | placeholder
src/canvas/components/ThresholdInput.tsx:83:          placeholder="Threshold..." | placeholder
src/canvas/components/ThresholdInput.tsx:121:          placeholder="e.g., 100000" | placeholder
src/canvas/components/ProvenanceHubTab.tsx:86:            placeholder="Search citations..." | placeholder
src/canvas/ui/inspector/GoalThresholdEditor.tsx:88:          placeholder="e.g. 200" | placeholder
src/canvas/panels/TemplatesPanel.tsx:658:                  placeholder="Search templates..." | placeholder
src/canvas/components/model-tab/ModelFooter.tsx:43:        placeholder="Search factors and edges…" | placeholder
src/canvas/components/CompareView.tsx:141:                placeholder="Document your reasoning for this decision..." | placeholder
src/canvas/components/CompareView.tsx:152:                placeholder="Decision title..." | placeholder
src/canvas/components/UserMappingForm.tsx:226:                  placeholder="Value" | placeholder
src/components/ConfigDrawer.tsx:127:            placeholder="http://localhost:8787" | placeholder
src/canvas/components/DocumentsManager.tsx:128:              placeholder="Search documents..." | placeholder
src/components/ChatBox.tsx:56:                placeholder="Ask DecisionGuide.AI anything" | placeholder
src/components/ProsConsList/AddOptionModal.tsx:42:              placeholder="Enter option name..." | placeholder
src/components/ProsConsList/OptionColumn.tsx:201:                  placeholder="Add a new pro..." | placeholder
src/components/ProsConsList/OptionColumn.tsx:275:                  placeholder="Add a new con..." | placeholder
src/components/assistants/ClarifierPanel.tsx:176:                placeholder="Type your answer here..." | placeholder
src/components/assistants/DraftForm.tsx:98:          placeholder="For example: Which supplier strategy should we adopt for next year?" | placeholder
src/components/assistants/DraftForm.tsx:114:          placeholder="Key constraints, timelines, stakeholders, or risks we should consider" | placeholder
src/canvas/components/pre-analysis/AllImprovements.tsx:1102:            placeholder="Enter evidence source (URL or description)" | placeholder
src/canvas/components/pre-analysis/SuccessTarget.tsx:453:              placeholder="e.g. Budget must stay under $50k" | placeholder
src/components/auth/SignUpForm.tsx:153:                  placeholder="Enter your email" | placeholder
src/components/auth/SignUpForm.tsx:166:                  placeholder="Create a password" | placeholder
src/canvas/components/ComparisonTable.tsx:75:                  placeholder="Scenario name" | placeholder
src/components/auth/ResetPasswordForm.tsx:175:                placeholder="New password" | placeholder
src/components/auth/ResetPasswordForm.tsx:208:                placeholder="Confirm new password" | placeholder
src/components/auth/LoginForm.tsx:153:                  placeholder="Enter your email" | placeholder
src/components/auth/LoginForm.tsx:166:                  placeholder="Enter your password" | placeholder
src/components/auth/ForgotPasswordForm.tsx:115:              placeholder="Enter your email" | placeholder
src/components/auth/LoginPage.tsx:135:                  placeholder="you@example.com" | placeholder
```

## 3. ARIA_LABEL (aria_label)

```
src/routes/templates/DecisionTemplates.tsx:225:                  aria-label="Determinism seed" | aria_label
src/plotLite/GhostPanel.tsx:23:    <section data-testid="ghost-panel" aria-label="Ghost Critique Panel"> | aria_label
src/routes/templates/components/ErrorBanner.tsx:133:              aria-label="Dismiss error" | aria_label
src/canvas/CanvasToolbar.tsx:194:          aria-label="Show toolbar" | aria_label
src/canvas/CanvasToolbar.tsx:230:          aria-label="Canvas editing toolbar" | aria_label
src/canvas/CanvasToolbar.tsx:297:          aria-label="Open templates panel" | aria_label
src/canvas/CanvasToolbar.tsx:309:          aria-label="Open Quick Draft assistant" | aria_label
src/canvas/CanvasToolbar.tsx:371:              aria-label="Undo last action" | aria_label
src/canvas/CanvasToolbar.tsx:386:              aria-label="Redo last undone action" | aria_label
src/canvas/CanvasToolbar.tsx:402:            aria-label="Zoom in" | aria_label
src/canvas/CanvasToolbar.tsx:414:            aria-label="Zoom out" | aria_label
src/canvas/CanvasToolbar.tsx:426:            aria-label="Fit all nodes in view" | aria_label
src/canvas/CanvasToolbar.tsx:444:            aria-label="Open snapshot manager" | aria_label
src/canvas/CanvasToolbar.tsx:460:            aria-label="Import canvas from file" | aria_label
src/canvas/CanvasToolbar.tsx:473:            aria-label="Export canvas to file" | aria_label
src/canvas/CanvasToolbar.tsx:490:              aria-label="Reset canvas" | aria_label
src/canvas/CanvasToolbar.tsx:505:            aria-label="Minimize toolbar" | aria_label
src/routes/templates/components/EmptyState.tsx:30:          aria-label="Retry loading templates" | aria_label
src/pages/ScenarioListPage.tsx:60:      return <Loader2 className="w-3 h-3 text-info animate-spin" aria-label="Analysis running" /> | aria_label
src/pages/ScenarioListPage.tsx:172:        aria-label="Actions" | aria_label
src/pages/ScenarioListPage.tsx:362:        <a href="/" aria-label="Olumi home"> | aria_label
src/canvas/conversation/FeedbackRow.tsx:43:      aria-label="Was this helpful?" | aria_label
src/canvas/conversation/FeedbackRow.tsx:49:        aria-label="Helpful" | aria_label
src/canvas/conversation/FeedbackRow.tsx:76:        aria-label="Not helpful" | aria_label
src/routes/templates/components/ProgressStrip.tsx:54:              aria-label="Cancel run" | aria_label
src/canvas/conversation/GrowingInput.tsx:77:      aria-label="Message input" | aria_label
src/routes/templates/components/ReproduceShareCard.tsx:56:              aria-label="Copy seed" | aria_label
src/routes/templates/components/ReproduceShareCard.tsx:74:                aria-label="Copy verification hash" | aria_label
src/canvas/conversation/dropdowns/GuideDropdown.tsx:130:      aria-label="Guide menu" | aria_label
src/canvas/conversation/dropdowns/GuideDropdown.tsx:177:            aria-label="Dismiss" | aria_label
src/canvas/conversation/dropdowns/ThinkingModeDropdown.tsx:135:      aria-label="Thinking mode" | aria_label
src/routes/templates/components/SummaryCard.tsx:66:            aria-label="Copy verification hash" | aria_label
src/poc/components/OnboardingHints.tsx:20:          aria-label="Sandbox onboarding" | aria_label
src/poc/components/OnboardingHints.tsx:34:              aria-label="Dismiss onboarding" | aria_label
src/poc/components/OnboardingHints.tsx:47:          aria-label="Keyboard shortcuts" | aria_label
src/poc/components/OnboardingHints.tsx:57:          <button type="button" className="poc-help-close" onClick={onToggleHelp} aria-label="Close help">Close</button> | aria_label
src/canvas/conversation/InlineBlocks.tsx:423:    <div className={styles.citationLegend} aria-label="Citations"> | aria_label
src/canvas/conversation/InlineBlocks.tsx:658:    <div className={styles.framingBlock} data-testid="block-framing" aria-label="Decision framing"> | aria_label
src/canvas/conversation/InlineBlocks.tsx:661:        <div className={styles.framingOptions} aria-label="Options"> | aria_label
src/canvas/conversation/InlineBlocks.tsx:699:    <div className={styles.briefBlock} data-testid="block-brief" aria-label="Brief"> | aria_label
src/canvas/conversation/InlineBlocks.tsx:727:          aria-label="View full brief (opens in new tab)" | aria_label
src/canvas/conversation/InlineBlocks.tsx:801:    <div className={styles.evidenceBlock} data-testid="block-evidence" aria-label="Evidence"> | aria_label
src/canvas/conversation/InlineBlocks.tsx:1115:                aria-label="Show on graph" | aria_label
src/canvas/conversation/InlineBlocks.tsx:1137:                aria-label="Show on graph" | aria_label
src/canvas/conversation/InlineBlocks.tsx:1212:              aria-label="Apply anyway" | aria_label
src/canvas/conversation/InlineBlocks.tsx:1221:              aria-label="Dismiss" | aria_label
src/canvas/conversation/InlineBlocks.tsx:1255:                aria-label="Accept this graph change" | aria_label
src/canvas/conversation/InlineBlocks.tsx:1265:                aria-label="Dismiss this graph change" | aria_label
src/canvas/conversation/InlineBlocks.tsx:1425:            aria-label="Apply proposed changes" | aria_label
src/canvas/conversation/InlineBlocks.tsx:1434:            aria-label="Dismiss proposed changes" | aria_label
src/poc/components/SandboxHeader.tsx:50:      aria-label="Scenario Sandbox toolbar" | aria_label
src/poc/components/SandboxHeader.tsx:64:          aria-label="Undo" | aria_label
src/poc/components/SandboxHeader.tsx:78:          aria-label="Redo" | aria_label
src/poc/components/SandboxHeader.tsx:94:          aria-label="Clear sandbox" | aria_label
src/poc/components/SandboxHeader.tsx:107:          aria-label="Export PNG" | aria_label
src/poc/components/SandboxHeader.tsx:119:            aria-label="Export JSON" | aria_label
src/poc/components/SandboxHeader.tsx:131:            aria-label="Import JSON" | aria_label
src/poc/components/SandboxHeader.tsx:142:          aria-label="Help" | aria_label
src/canvas/conversation/GuidanceStrip.tsx:278:        aria-label="Dismiss suggestion" | aria_label
src/canvas/conversation/ReadinessPill.tsx:141:          aria-label="Brief readiness details" | aria_label
src/plc/components/GraphCanvasPlc.tsx:94:    <div data-testid="plc-canvas" tabIndex={0} role="application" aria-label="PLC canvas"> | aria_label
src/canvas/nodes/GhostOptionNode.tsx:24:      aria-label="Add another option" | aria_label
src/canvas/conversation/ActionChipRow.tsx:52:      aria-label="Suggested actions" | aria_label
src/pages/sandbox-guide/components/shared/HelpModal.tsx:81:            aria-label="Close help modal" | aria_label
src/canvas/nodes/shared/BiasIcon.tsx:53:        aria-label="Bias warning" | aria_label
src/canvas/nodes/shared/BiasIcon.tsx:61:          aria-label="Bias insight" | aria_label
src/canvas/nodes/BaseNode.tsx:317:        aria-label="Input connection" | aria_label
src/canvas/nodes/BaseNode.tsx:436:        aria-label="Output connection" | aria_label
src/canvas/provenance/ProvenanceHub.tsx:66:            aria-label="Search citations" | aria_label
src/canvas/provenance/ProvenanceHub.tsx:98:            aria-label="Toggle redaction" | aria_label
src/canvas/provenance/ProvenanceHub.tsx:150:          aria-label="Go to source on canvas" | aria_label
src/canvas/contextMenu/SetValuePopover.tsx:100:          aria-label="Custom value" | aria_label
src/canvas/journey/JourneyTabBody.tsx:215:      aria-label="Decision journey timeline" | aria_label
src/canvas/contextMenu/CanvasContextMenu.tsx:201:        aria-label="Canvas context menu" | aria_label
src/canvas/ui/inspector-v2/shared/CoachingCard.tsx:38:            aria-label="Dismiss suggestion" | aria_label
src/canvas/components/GuidanceCard.tsx:246:                aria-label="Auto-fix this issue" | aria_label
src/canvas/components/StatusChips.tsx:37:        aria-label="Limits unavailable - click for details" | aria_label
src/canvas/onboarding/EmptyState.tsx:149:      aria-label="Get started with canvas" | aria_label
src/canvas/onboarding/EmptyState.tsx:167:          aria-label="Available templates" | aria_label
src/canvas/components/GraphTextView.tsx:392:              aria-label="Search nodes" | aria_label
src/canvas/components/CommandPalette.tsx:219:        aria-label="Command palette" | aria_label
src/canvas/components/CommandPalette.tsx:255:        <div className="max-h-96 overflow-y-auto" role="group" aria-label="Available actions"> | aria_label
src/canvas/onboarding/OnboardingOverlay.tsx:257:          aria-label="Close onboarding" | aria_label
src/canvas/onboarding/OnboardingOverlay.tsx:309:            <div className="mt-6 flex flex-wrap gap-3" aria-label="Helpful links"> | aria_label
src/canvas/onboarding/OnboardingOverlay.tsx:340:            aria-label="Previous step" | aria_label
src/canvas/components/SuggestionCard.tsx:107:            <div className="flex flex-wrap gap-2" role="group" aria-label="Clarification options"> | aria_label
src/canvas/components/SuggestionCard.tsx:179:              aria-label="Override suggestion with custom value" | aria_label
src/canvas/components/PreAnalysisHealth.tsx:193:            aria-label="Retry health check" | aria_label
src/canvas/components/DraftGuidancePanel.tsx:42:      aria-label="Draft guidance" | aria_label
src/canvas/components/RecoveryBanner.tsx:139:          aria-label="Close recovery banner" | aria_label
src/pages/sandbox-guide/components/panel/states/InspectorState.tsx:67:            aria-label="Close inspector" | aria_label
src/pages/sandbox-guide/components/panel/states/InspectorState.tsx:149:            aria-label="Close inspector" | aria_label
src/canvas/components/UtilityWeightPanel.tsx:127:      aria-label="Utility weight configuration" | aria_label
src/canvas/components/UtilityWeightPanel.tsx:146:          aria-label="Get AI-suggested weights" | aria_label
src/canvas/conversation/zones/CoachingTip.tsx:33:        aria-label="Dismiss tip" | aria_label
src/canvas/conversation/zones/ChatComposer.tsx:259:            aria-label="Message input" | aria_label
src/canvas/conversation/zones/ChatComposer.tsx:276:            aria-label="Send message" | aria_label
src/canvas/conversation/zones/MessageActions.tsx:35:      aria-label="Message actions" | aria_label
src/canvas/ui/inspector-v2/shared/StrengthBandButtons.tsx:60:    <div className="flex flex-wrap gap-1 mb-2" role="group" aria-label="Strength presets"> | aria_label
src/canvas/panels/InspectorPanel.tsx:309:                      aria-label="Uncertainty level" | aria_label
src/canvas/panels/InspectorPanel.tsx:330:                      aria-label="Belief / confidence" | aria_label
src/canvas/components/ProgressStrip.tsx:87:              aria-label="Cancel analysis" | aria_label
src/canvas/conversation/zones/ChatThread.tsx:94:      aria-label="Conversation" | aria_label
src/canvas/components/ObjectiveBanner.tsx:29:      aria-label="Objective" | aria_label
src/canvas/edges/StyledEdge.tsx:744:                      aria-label="Weight suggestion available" | aria_label
src/canvas/ui/inspector-v2/InspectorShell.tsx:55:      aria-label="Inspector panel" | aria_label
src/canvas/ui/inspector-v2/InspectorShell.tsx:115:              aria-label="Close inspector" | aria_label
src/canvas/panels/_shared/PanelShell.tsx:100:            aria-label="Close panel" | aria_label
src/canvas/components/LayoutPopover.tsx:43:        aria-label="Auto-layout your diagram" | aria_label
src/pages/sandbox-guide/components/panel/sections/VerificationBadge.tsx:106:        <div className="pl-4 border-l-2 border-storm-200 space-y-1" role="region" aria-label="Verification details"> | aria_label
src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:345:                  aria-label="Connection existence probability" | aria_label
src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:376:                      aria-label="Strength uncertainty" | aria_label
src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:401:                      aria-label="Strength uncertainty" | aria_label
src/canvas/components/DraftWarnings.tsx:175:          aria-label="Dismiss suggestions" | aria_label
src/canvas/panels/AIClarifierChat.tsx:275:          aria-label="Send message" | aria_label
src/canvas/components/RangeChips.tsx:71:        aria-label="High certainty outcome" | aria_label
src/canvas/components/RangeChips.tsx:98:      aria-label="Outcome range" | aria_label
src/canvas/panels/IssuesPanel.tsx:56:          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded" aria-label="Close issues panel"> | aria_label
src/canvas/panels/IssuesPanel.tsx:68:              aria-label="Fix next issue" | aria_label
src/canvas/panels/IssuesPanel.tsx:78:                aria-label="Fix all issues" | aria_label
src/canvas/panels/IssuesPanel.tsx:173:              aria-label="Toggle why this matters" | aria_label
src/canvas/panels/IssuesPanel.tsx:208:              aria-label="Apply quick fix" | aria_label
src/canvas/documents/DocumentsDrawer.tsx:29:          aria-label="Close documents drawer" | aria_label
src/canvas/components/InsightsPanel.tsx:414:                aria-label="Risks to consider" | aria_label
src/canvas/components/InsightsPanel.tsx:449:                aria-label="Analysis caveats" | aria_label
src/canvas/components/InsightsPanel.tsx:479:                aria-label="Recommended next steps" | aria_label
src/canvas/components/InsightsPanel.tsx:544:      aria-label="Key insight summary" | aria_label
src/canvas/components/LayoutOptionsPanel.tsx:73:        aria-label="Open layout options" | aria_label
src/canvas/components/LayoutOptionsPanel.tsx:89:          aria-label="Close layout options" | aria_label
src/canvas/components/FunctionalForm/FormSuggestionBadge.tsx:51:          aria-label="Dismiss suggestion" | aria_label
src/canvas/components/FunctionalForm/FormSuggestionBadge.tsx:65:      aria-label="Form suggestion" | aria_label
src/canvas/components/FunctionalForm/FormSuggestionBadge.tsx:94:            aria-label="Dismiss suggestion" | aria_label
src/pages/sandbox-guide/components/panel/sections/BiasMitigation.tsx:177:              aria-label="Close dialog" | aria_label
src/canvas/panels/TemplatesPanel.tsx:113:      const closeButton = panelRef.current.querySelector<HTMLElement>('[aria-label="Close panel"]') | aria_label
src/canvas/ReactFlowGraph.tsx:2124:              aria-label="Close documents drawer" | aria_label
src/canvas/panels/ResultsPanel.tsx:393:        aria-label="Compare runs" | aria_label
src/canvas/panels/ResultsPanel.tsx:776:    <div className={`mt-6 border-t border-panel-border pt-3 ${typography.panelMeta} text-text-light`} aria-label="Trust and reproducibility details"> | aria_label
src/pages/sandbox-guide/components/panel/sections/ProvenancePanel.tsx:55:        aria-label="Evidence coverage details" | aria_label
src/pages/sandbox-guide/components/panel/sections/ProvenancePanel.tsx:76:        <div className="px-4 pb-4 space-y-3 bg-storm-25" role="region" aria-label="Evidence coverage details"> | aria_label
src/canvas/components/DriverChips.tsx:435:      aria-label="Key drivers" | aria_label
src/canvas/components/ModelQualityScore.tsx:314:        aria-label="Model quality: not available" | aria_label
src/pages/sandbox-guide/CopilotLayout.tsx:45:          aria-label="Decision model canvas" | aria_label
src/pages/sandbox-guide/CopilotLayout.tsx:56:          aria-label="Guide guidance panel" | aria_label
src/canvas/components/GuidedLayoutDialog.tsx:102:          <div className="flex gap-2" role="group" aria-label="Layout direction"> | aria_label
src/canvas/components/GuidedLayoutDialog.tsx:135:          <div className="flex gap-2" role="group" aria-label="Node spacing"> | aria_label
src/canvas/components/GuidedLayoutDialog.tsx:186:            <div className="flex gap-2" role="group" aria-label="Risk placement"> | aria_label
src/canvas/compare/EdgeDiffTable.tsx:79:      aria-label="Edge comparison summary" | aria_label
src/canvas/ui/inspector-v2/panels/GoalPanel.tsx:281:            aria-label="Constraint target factor" | aria_label
src/canvas/ui/inspector-v2/panels/GoalPanel.tsx:299:              aria-label="Constraint operator" | aria_label
src/canvas/ui/inspector-v2/panels/GoalPanel.tsx:311:              aria-label="Constraint target value" | aria_label
src/canvas/components/GuidancePanel.tsx:259:      aria-label="Model guidance" | aria_label
src/canvas/components/FunctionalForm/FormSelector.tsx:257:          aria-label="Select relationship form" | aria_label
src/components/debug/DebugPanelV2.tsx:252:            aria-label="Copy request ID" | aria_label
src/components/debug/DebugPanelV2.tsx:285:            aria-label="Export all debug data" | aria_label
src/components/debug/DebugPanelV2.tsx:315:              aria-label="Close debug panel" | aria_label
src/components/debug/DebugPanelV2.tsx:324:      <div style={tabBarStyle} role="tablist" aria-label="Debug panel tabs"> | aria_label
src/canvas/components/GoalModePanel.tsx:67:            aria-label="Close" | aria_label
src/canvas/components/FunctionalForm/AppliedFormsCallout.tsx:108:      aria-label="Auto-applied relationship forms" | aria_label
src/canvas/components/FunctionalForm/AppliedFormsCallout.tsx:160:            aria-label="Dismiss all applied forms" | aria_label
src/canvas/components/ResultsPanelSkeleton.tsx:55:      aria-label="Loading decision summary" | aria_label
src/canvas/components/ResultsPanelSkeleton.tsx:111:      aria-label="Loading trust indicators" | aria_label
src/canvas/components/ResultsPanelSkeleton.tsx:140:      aria-label="Loading drivers" | aria_label
src/canvas/components/ResultsPanelSkeleton.tsx:183:      aria-label="Loading insight" | aria_label
src/canvas/components/ResultsPanelSkeleton.tsx:207:      aria-label="Loading next steps" | aria_label
src/canvas/components/ResultsPanelSkeleton.tsx:231:    <div className="space-y-4 p-4" role="status" aria-label="Loading results"> | aria_label
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:194:              aria-label="Add driver" | aria_label
src/canvas/components/RiskProfileSelector.tsx:86:        aria-label="Risk tolerance questionnaire" | aria_label
src/canvas/components/RiskProfileSelector.tsx:259:        aria-label="Risk profile" | aria_label
src/canvas/components/RiskProfileSelector.tsx:324:      aria-label="Risk tolerance selection" | aria_label
src/canvas/components/FunctionalForm/FormOnboardingTooltip.tsx:108:      aria-label="Understanding relationship forms" | aria_label
src/canvas/components/FunctionalForm/FormOnboardingTooltip.tsx:122:          aria-label="Dismiss onboarding" | aria_label
src/modules/diagnostics/ErrorBanner.tsx:95:              aria-label="Dismiss" | aria_label
src/canvas/components/ContextBar.tsx:47:      aria-label="Graph context" | aria_label
src/canvas/components/BottomSheet.tsx:83:              aria-label="Close" | aria_label
src/canvas/components/DevControls.tsx:30:        aria-label="Developer controls" | aria_label
src/canvas/components/DevControls.tsx:46:              aria-label="Close" | aria_label
src/canvas/components/DegradedStateBanner.tsx:112:          aria-label="Dismiss warning" | aria_label
src/canvas/ui/NodeInspector.tsx:216:        <button onClick={onClose} className="text-text-light hover:text-text-body" aria-label="Close">×</button> | aria_label
src/canvas/ui/NodeInspector.tsx:263:          aria-label="Edit assumptions" | aria_label
src/canvas/ui/NodeInspector.tsx:282:            {isConfirmed && <Check size={10} className="text-success" aria-label="Reviewed" />} | aria_label
src/canvas/ui/NodeInspector.tsx:746:    <div className="p-4 border-t border-panel-border" onKeyDown={handleKeyDown} role="region" aria-label="Node properties"> | aria_label
src/canvas/components/AcceptOverrideControl.tsx:89:      aria-label="AI suggestion" | aria_label
src/canvas/components/RunHistory.tsx:325:                    aria-label="View" | aria_label
src/canvas/components/RunHistory.tsx:349:                    aria-label="Delete" | aria_label
src/canvas/ui/EdgeInspectorCompact.tsx:106:      aria-label="Edge properties" | aria_label
src/canvas/ui/EdgeInspectorCompact.tsx:123:            aria-label="Expand to full inspector" | aria_label
src/canvas/ui/EdgeInspectorCompact.tsx:131:            aria-label="Close" | aria_label
src/canvas/ui/EdgeInspectorCompact.tsx:198:        <div className="flex gap-1" role="radiogroup" aria-label="Edge style"> | aria_label
src/components/debug/components/ServiceChain.tsx:474:      aria-label="Service call chain" | aria_label
src/canvas/components/EvidenceCoverage.tsx:127:          aria-label="Evidence coverage progress" | aria_label
src/canvas/share/ShareDrawer.tsx:185:        aria-label="Share link" | aria_label
src/canvas/components/EmptyStateOverlay.tsx:64:          aria-label="Close welcome overlay" | aria_label
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:411:            aria-label="Focus on canvas" | aria_label
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:852:            aria-label="Dismiss" | aria_label
src/canvas/ui/NodeInspectorCompact.tsx:135:      aria-label="Node properties" | aria_label
src/canvas/ui/NodeInspectorCompact.tsx:153:            aria-label="Expand to full inspector" | aria_label
src/canvas/ui/NodeInspectorCompact.tsx:161:            aria-label="Close" | aria_label
src/canvas/components/KeyboardMap.tsx:75:            aria-label="Close keyboard shortcuts" | aria_label
src/canvas/help/HelpMenu.tsx:83:        aria-label="Help menu" | aria_label
src/canvas/help/HelpMenu.tsx:93:          aria-label="Canvas help" | aria_label
src/canvas/components/WarningBanner.tsx:110:          aria-label="Dismiss warning" | aria_label
src/canvas/components/BeliefInput.tsx:189:            aria-label="Switch to slider mode" | aria_label
src/canvas/components/BeliefInput.tsx:203:            aria-label="Switch to natural language mode" | aria_label
src/canvas/components/EdgeThicknessLegend.tsx:38:      aria-label="Edge thickness legend" | aria_label
src/canvas/components/EdgeThicknessLegend.tsx:48:          aria-label="Dismiss legend" | aria_label
src/canvas/components/KeyboardCheatsheet.tsx:79:        aria-label="Keyboard shortcuts" | aria_label
src/canvas/components/KeyboardCheatsheet.tsx:88:            aria-label="Close shortcuts" | aria_label
src/canvas/help/KeyboardLegend.tsx:208:            aria-label="Close keyboard legend" | aria_label
src/canvas/components/OutputsDock.tsx:1036:      aria-label="Outputs dock" | aria_label
src/canvas/components/OutputsDock.tsx:1061:          <div className="flex items-center gap-2 px-2 py-2" aria-label="Outputs sections"> | aria_label
src/canvas/components/OutputsDock.tsx:1065:            <nav className="flex flex-1 min-w-0 gap-1" aria-label="Outputs sections"> | aria_label
src/canvas/components/OutputsDock.tsx:1124:          aria-label="Outputs sections" | aria_label
src/canvas/components/OutputsDock.tsx:1536:            aria-label="Generating scenario comparison" | aria_label
src/canvas/ui/inspector/SignedStrengthSlider.tsx:149:          aria-label="Effect on target" | aria_label
src/components/debug/tabs/RawTab.tsx:240:        <div style={selectorStyle} role="radiogroup" aria-label="Payload selector"> | aria_label
src/canvas/components/SettingsPanel.tsx:31:        aria-label="Open settings" | aria_label
src/canvas/components/SettingsPanel.tsx:48:          aria-label="Close settings" | aria_label
src/canvas/ui/EdgeInspector.tsx:229:          aria-label="Close inspector" | aria_label
src/canvas/ui/EdgeInspector.tsx:336:          aria-label="AI weight suggestion" | aria_label
src/canvas/ui/EdgeInspector.tsx:558:      aria-label="Edge properties" | aria_label
src/canvas/DiagnosticsOverlay.tsx:76:          aria-label="Close diagnostics" | aria_label
src/canvas/components/DecisionReadinessBadge.tsx:219:                aria-label="Blockers that must be fixed" | aria_label
src/canvas/components/DecisionReadinessBadge.tsx:249:                aria-label="Warnings to review" | aria_label
src/canvas/components/DecisionReadinessBadge.tsx:279:                aria-label="Checks that passed" | aria_label
src/canvas/ToastContext.tsx:140:    <div className="fixed top-6 right-6 z-[9000] space-y-2" role="region" aria-label="Notifications"> | aria_label
src/canvas/ToastContext.tsx:165:              aria-label="Dismiss" | aria_label
src/components/GraphCanvas.tsx:327:      aria-label="Graph canvas" | aria_label
src/components/GraphCanvas.tsx:359:          aria-label="Connect Nodes" | aria_label
src/canvas/palette/CommandPalette.tsx:91:      aria-label="Command palette" | aria_label
src/canvas/palette/CommandPalette.tsx:117:            aria-label="Search commands, nodes, edges, and more" | aria_label
src/canvas/palette/CommandPalette.tsx:136:          aria-label="Search results" | aria_label
src/canvas/components/OnboardingOverlay.tsx:97:              aria-label="Close onboarding" | aria_label
src/canvas/components/InputsDock.tsx:50:      aria-label="Decision framing" | aria_label
src/canvas/components/InputsDock.tsx:204:        aria-label="Scenario run summary" | aria_label
src/canvas/components/InputsDock.tsx:227:      aria-label="Last run for this decision" | aria_label
src/canvas/components/InputsDock.tsx:236:          <code className={`${typography.code} text-ink-900/80`} aria-label="Last run hash snippet"> | aria_label
src/canvas/components/InputsDock.tsx:480:          aria-label="Ask about your model" | aria_label
src/canvas/components/InputsDock.tsx:616:      aria-label="Inputs dock" | aria_label
src/canvas/components/InputsDock.tsx:647:            aria-label="Inputs sections" | aria_label
src/canvas/components/InputsDock.tsx:672:          aria-label="Inputs sections" | aria_label
src/canvas/components/InspectorModal.tsx:217:          aria-label="Close inspector" | aria_label
src/canvas/components/ValidationBanner.tsx:99:            aria-label="Dismiss validation error" | aria_label
src/canvas/components/ValidationBanner.tsx:157:            aria-label="Dismiss coaching suggestion" | aria_label
src/canvas/components/ThresholdInput.tsx:85:          aria-label="Success threshold" | aria_label
src/canvas/components/LensDropdown.tsx:33:      aria-label="Graph lens" | aria_label
src/canvas/components/LensDropdown.tsx:169:          aria-label="Graph lens" | aria_label
src/canvas/components/CompareView.tsx:143:                aria-label="Decision rationale" | aria_label
src/canvas/components/CompareView.tsx:154:                aria-label="Decision title" | aria_label
src/canvas/components/CompareView.tsx:160:                aria-label="Export decision brief" | aria_label
src/canvas/components/FocusModeChip.tsx:85:        aria-label="Clear selection and exit focus mode" | aria_label
src/canvas/components/DebugDrawer.tsx:115:      aria-label="Debug information" | aria_label
src/canvas/components/DebugDrawer.tsx:128:          aria-label="Close debug drawer" | aria_label
src/canvas/components/DebugDrawer.tsx:359:                              aria-label="Copy request ID" | aria_label
src/canvas/components/DebugDrawer.tsx:389:                                aria-label="Copy raw body" | aria_label
src/canvas/components/TemplateSkeleton.tsx:8:    <div className="space-y-3 p-4" role="status" aria-label="Loading templates"> | aria_label
src/canvas/components/ComparisonCanvasLayout.tsx:139:      aria-label="Outcome comparison" | aria_label
src/canvas/components/ComparisonCanvasLayout.tsx:230:        aria-label="Comparison statistics" | aria_label
src/canvas/components/ChangeAttributionPanel.tsx:195:            aria-label="Revert change" | aria_label
src/canvas/components/ModelCardLite.tsx:57:      aria-label="Copy graph hash" | aria_label
src/canvas/components/ModelCardLite.tsx:94:      aria-label="Model card" | aria_label
src/canvas/components/ModelCardLite.tsx:148:            <span className="cursor-help" tabIndex={0} aria-label="Linearity information"> | aria_label
src/canvas/components/DraftChat.tsx:961:              aria-label="Expand panel" | aria_label
src/canvas/components/DraftChat.tsx:1038:                aria-label="Attach file" | aria_label
src/canvas/components/DraftChat.tsx:1046:                aria-label="Thinking mode" | aria_label
src/canvas/components/DraftChat.tsx:1054:                aria-label="Expand panel" | aria_label
src/canvas/components/DraftChat.tsx:1094:                  aria-label="Attach file" | aria_label
src/canvas/components/DraftChat.tsx:1102:                  aria-label="Thinking mode" | aria_label
src/canvas/components/DraftChat.tsx:1110:                  aria-label="Minimize panel" | aria_label
src/canvas/components/ResultsSkeleton.tsx:8:    <div className="space-y-6 p-4" role="status" aria-label="Running analysis"> | aria_label
src/components/assistants/ExplainDiffButton.tsx:54:        aria-label="Explain this diff" | aria_label
src/canvas/components/DegeneracyWarning.tsx:129:                aria-label="Dismiss warning" | aria_label
src/components/assistants/DiffViewer.tsx:137:                    aria-label="Rationale" | aria_label
src/components/assistants/DiffViewer.tsx:205:                    aria-label="Rationale" | aria_label
src/canvas/components/ResultsPanel/SensitivityList.tsx:95:                    aria-label="Close to threshold" | aria_label
src/canvas/components/RiskProfileBadge.tsx:75:        aria-label="Set risk tolerance" | aria_label
src/components/assistants/ClarifierPanel.tsx:135:                  aria-label="Impact hint" | aria_label
src/components/coaching/CoachingNudge.tsx:93:        aria-label="Dismiss suggestion" | aria_label
src/canvas/components/pre-analysis/expertise/AiEstimated.tsx:96:                aria-label="Confirm value" | aria_label
src/components/Toast.tsx:45:        aria-label="Close notification" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:431:          aria-label="Decision review" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:448:          aria-label="Decision review" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:490:        aria-label="Decision review" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:523:          aria-label="Decision review" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:570:        aria-label="Decision review" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:619:          aria-label="Decision review" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:653:        aria-label="Decision review" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:672:        aria-label="Decision review" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:744:          aria-label="Decision review" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:780:        aria-label="Decision review" | aria_label
src/canvas/components/DecisionReviewPanel.tsx:806:      aria-label="Decision review" | aria_label
src/canvas/components/ResultsPanel/RiskToleranceControl.tsx:87:        aria-label="Risk tolerance" | aria_label
src/canvas/components/ResultsPanel/RiskToleranceControl.tsx:135:        aria-label="Risk tolerance" | aria_label
src/components/assistants/InfluenceExplainer.tsx:78:      aria-label="Influence model explanation" | aria_label
src/components/assistants/InfluenceExplainer.tsx:91:              aria-label="Dismiss explanation" | aria_label
src/canvas/components/model-tab/CoachingCard.tsx:42:        aria-label="Dismiss coaching" | aria_label
src/canvas/components/RecommendationCard/index.tsx:327:            aria-label="How we got here" | aria_label
src/canvas/components/KPIHeadline.tsx:49:          aria-label="No outcome data yet" | aria_label
src/components/shared/TriageHealthHeader.tsx:112:            aria-label="Dismiss coaching" | aria_label
src/components/chat/ArtefactHeader.tsx:100:        aria-label="Expand artefact" | aria_label
src/canvas/components/DocumentsManager.tsx:132:              aria-label="Search documents" | aria_label
src/canvas/components/DocumentsManager.tsx:138:                aria-label="Clear search" | aria_label
src/canvas/components/DocumentsManager.tsx:350:                  aria-label="Save rename" | aria_label
src/canvas/components/DocumentsManager.tsx:361:                  aria-label="Cancel rename" | aria_label
src/canvas/components/DocumentsManager.tsx:420:              aria-label="Rename document" | aria_label
src/canvas/components/DocumentsManager.tsx:432:              aria-label="Open external link" | aria_label
src/canvas/components/DocumentsManager.tsx:442:              aria-label="Download document" | aria_label
src/canvas/components/DocumentsManager.tsx:451:            aria-label="Delete document" | aria_label
src/components/shared/TriageCard.tsx:210:            aria-label="Olumi estimated this value" | aria_label
src/components/shared/TriageCard.tsx:325:            aria-label="Olumi estimated this value" | aria_label
src/canvas/components/pre-analysis/WorthInvestigating.tsx:113:    <section className="space-y-2" aria-label="Worth investigating"> | aria_label
src/components/chat/ArtefactBlock.tsx:184:                aria-label="Close expanded artefact" | aria_label
src/canvas/components/pre-analysis/MissingKnowledgePrompt.tsx:37:        aria-label="Dismiss" | aria_label
src/canvas/components/model-tab/RelationshipsSection.tsx:248:                <div className="inline-flex rounded overflow-hidden border border-panel-border" role="group" aria-label="Direction"> | aria_label
src/components/navigation/AuthLayout.tsx:30:        aria-label="Close" | aria_label
src/components/assistants/StreamingMonitor.tsx:93:              aria-label="Retry streaming request" | aria_label
src/components/assistants/StreamingMonitor.tsx:115:              aria-label="Retry streaming request" | aria_label
src/canvas/components/pre-analysis/ModelNotes.tsx:44:    <section className="space-y-2" aria-label="Model notes"> | aria_label
src/components/BottomNav.tsx:28:        <Link to="/" className={linkClass('/')} aria-label="Home"> | aria_label
src/components/BottomNav.tsx:33:        <Link to="/templates" className={linkClass('/templates')} aria-label="Decision Templates"> | aria_label
src/components/BottomNav.tsx:38:        <Link to="/plot" className={linkClass('/plot')} aria-label="Decision Note"> | aria_label
src/components/BottomNav.tsx:43:        <Link to="/settings" className={linkClass('/settings')} aria-label="Settings"> | aria_label
src/components/navigation/Navbar.tsx:223:              aria-label="DecisionGuide.AI Home" | aria_label
src/canvas/components/pre-analysis/GoalBaselineInput.tsx:174:              aria-label="Confirm" | aria_label
src/canvas/components/pre-analysis/GoalBaselineInput.tsx:183:              aria-label="Cancel" | aria_label
src/components/layout/UserAvatarMenu.tsx:57:        aria-label="Account menu" | aria_label
src/components/SandboxStreamPanel.tsx:1247:              aria-label="Export .txt" | aria_label
src/components/SandboxStreamPanel.tsx:1276:              aria-label="Export .json" | aria_label
src/components/SandboxStreamPanel.tsx:1305:              aria-label="Export Markdown" | aria_label
src/components/layout/LeftSidebar.tsx:57:      aria-label="Canvas tools" | aria_label
src/components/layout/LeftSidebar.tsx:66:            aria-label="Select mode" | aria_label
src/components/layout/LeftSidebar.tsx:77:            aria-label="Hand mode" | aria_label
src/components/layout/LeftSidebar.tsx:89:            aria-label="Add node to canvas" | aria_label
src/components/layout/LeftSidebar.tsx:100:            aria-label="Templates are Coming Soon" | aria_label
src/components/layout/LeftSidebar.tsx:114:            aria-label="Undo" | aria_label
src/components/layout/LeftSidebar.tsx:126:            aria-label="Redo" | aria_label
src/components/layout/LeftSidebar.tsx:138:            aria-label="Reset canvas" | aria_label
src/components/layout/LeftSidebar.tsx:152:            aria-label="Zoom in" | aria_label
src/components/layout/LeftSidebar.tsx:163:            aria-label="Zoom out" | aria_label
src/components/layout/LeftSidebar.tsx:174:            aria-label="Fit all nodes in view" | aria_label
src/components/layout/LeftSidebar.tsx:188:            aria-label="Auto-arrange layout" | aria_label
src/components/layout/RightPanel.tsx:31:              aria-label="Close panel" | aria_label
src/components/stream/StreamParametersPanel.tsx:56:          aria-label="Random seed for reproducibility" | aria_label
src/components/stream/StreamParametersPanel.tsx:69:          aria-label="Maximum budget in dollars" | aria_label
src/components/stream/StreamParametersPanel.tsx:80:          aria-label="AI model to use" | aria_label
src/components/layout/TopBar.tsx:263:        <a href="/" className={styles.logoLink} aria-label="Olumi home"> | aria_label
src/components/layout/TopBar.tsx:290:            aria-label="Edit scenario title" | aria_label
src/components/layout/TopBar.tsx:297:            aria-label="Edit scenario title" | aria_label
src/components/layout/TopBar.tsx:314:          <span className={styles.dirtyIndicator} aria-label="Unsaved changes" /> | aria_label
src/components/layout/TopBar.tsx:427:            aria-label="Save scenario" | aria_label
src/components/layout/TopBar.tsx:454:            aria-label="Share scenario" | aria_label
src/components/layout/TopBar.tsx:468:              aria-label="More options" | aria_label
src/components/layout/TopBar.tsx:547:                  aria-label="Canvas settings" | aria_label
src/components/BiasesCarousel/index.tsx:111:                aria-label="Scroll left" | aria_label
src/components/BiasesCarousel/index.tsx:120:                aria-label="Scroll right" | aria_label
src/components/ProsConsList/ScoreComparison.tsx:74:            aria-label="Close dialog" | aria_label
src/components/results/SuccessTargetRow.tsx:217:              aria-label="Edit success target value" | aria_label
src/components/results/SuccessTargetRow.tsx:226:              aria-label="Apply value" | aria_label
src/components/results/TornadoChart.tsx:462:                  aria-label="Needs your judgement" | aria_label
src/components/results/ParetoChart.tsx:387:        aria-label="Pareto frontier chart" | aria_label
src/components/results/DriversSection.tsx:359:        aria-label="Custom confidence value" | aria_label
src/components/results/DriversSection.tsx:581:              aria-label="More information" | aria_label
src/components/results/DriversSection.tsx:658:              aria-label="Default estimate — not yet validated with evidence" | aria_label
src/components/results/WinGauge.tsx:147:    <div className={`mb-4${isDeemphasised ? ' opacity-70' : ''}`} role="figure" aria-label="Win probability distribution across options"> | aria_label
src/components/results/CoachingPrompt.tsx:58:        aria-label="Dismiss coaching prompt" | aria_label
src/components/results/BaselineTargetRow.tsx:137:            aria-label="About baseline and target" | aria_label
src/components/results/AdvancedSection.tsx:139:          <div className="flex gap-1" role="radiogroup" aria-label="Risk tolerance"> | aria_label
src/components/results/AdvancedSection.tsx:313:                    aria-label="Copy hash to clipboard" | aria_label
src/canvas/components/UserMappingForm.tsx:244:                  aria-label="Remove mapping" | aria_label
src/components/ui/FieldLabel.tsx:51:        {required && <span className="text-danger-600 ml-0.5" aria-label="required">*</span>} | aria_label
src/components/ui/FieldLabel.tsx:62:            aria-label="Show technical details" | aria_label
src/components/assistants/OptionsTiles.tsx:77:          aria-label="Generate decision options" | aria_label
src/components/KeyboardShortcutsOverlay.tsx:47:            aria-label="Close shortcuts overlay" | aria_label
src/components/ProsConsList/SortableItem.tsx:180:              aria-label="Drag to reorder" | aria_label
src/components/ProsConsList/SortableItem.tsx:191:                  aria-label="Edit item" | aria_label
src/components/ProsConsList/SortableItem.tsx:200:                  aria-label="Delete item" | aria_label
src/components/teams/UserDirectoryTab.tsx:74:          aria-label="Search directory" | aria_label
src/components/teams/DirectoryUserCard.tsx:61:          aria-label="Add to team" | aria_label
src/components/ConnectivityChip.tsx:76:          aria-label="Retry connection" | aria_label
```

## 4. TITLE_TOOLTIP (title_tooltip)

```
src/routes/PlotShowcase.tsx:644:                title="Whiteboard" | title_tooltip
src/routes/templates/components/ProgressStrip.tsx:55:              title="Cancel run" | title_tooltip
src/routes/PlotWorkspace.tsx:673:              title="Reset camera to origin" | title_tooltip
src/routes/PlotWorkspace.tsx:680:              title="Clear all workspace data" | title_tooltip
src/pages/ScenarioListPage.tsx:62:      return <span className="w-2 h-2 rounded-full bg-success" title="Analysis ready" /> | title_tooltip
src/pages/ScenarioListPage.tsx:64:      return <span className="w-2 h-2 rounded-full bg-danger" title="Analysis failed" /> | title_tooltip
src/pages/sandbox-guide/components/panel/states/EmptyState.tsx:54:          title="Describe your decision" | title_tooltip
src/pages/sandbox-guide/components/panel/states/EmptyState.tsx:63:          title="Start from template" | title_tooltip
src/pages/sandbox-guide/components/panel/states/EmptyState.tsx:71:          title="Build manually" | title_tooltip
src/modules/focus/FocusToggle.tsx:17:      title="Toggle focus mode (F)" | title_tooltip
src/poc/components/SandboxHeader.tsx:70:          title="Undo (Cmd/Ctrl+Z)" | title_tooltip
src/poc/components/SandboxHeader.tsx:84:          title="Redo (Cmd/Ctrl+Shift+Z)" | title_tooltip
src/poc/components/SandboxHeader.tsx:96:          title="Clear sandbox (local)" | title_tooltip
src/poc/components/SandboxHeader.tsx:110:          title="Export PNG" | title_tooltip
src/poc/components/SandboxHeader.tsx:121:            title="Export JSON" | title_tooltip
src/poc/components/SandboxHeader.tsx:133:            title="Import JSON" | title_tooltip
src/poc/components/SandboxHeader.tsx:143:          title="Help (?)" | title_tooltip
src/canvas/CanvasToolbar.tsx:193:          title="Show toolbar" | title_tooltip
src/canvas/CanvasToolbar.tsx:296:          title="Browse ready-made scenarios (T)" | title_tooltip
src/canvas/CanvasToolbar.tsx:308:          title="Describe your decision to draft a starter model" | title_tooltip
src/canvas/CanvasToolbar.tsx:323:              title="Select analysis mode" | title_tooltip
src/canvas/CanvasToolbar.tsx:520:      <BottomSheet isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Start fresh?"> | title_tooltip
src/components/debug/DebugPanelV2.tsx:268:            title="Include full graph data (factors, edges, options) in export. Note: descriptions are not redacted and may contain raw user text." | title_tooltip
src/pages/sandbox-guide/components/panel/states/CompareState.tsx:314:      <ExpandableSection title="Graph changes" defaultOpen={false}> | title_tooltip
src/canvas/edges/StyledEdge.tsx:787:            title="Flagged as assumption" | title_tooltip
src/components/debug/PayloadLabTab.tsx:541:            title="Download JSON" | title_tooltip
src/components/debug/PayloadLabTab.tsx:578:            title="Download JSON" | title_tooltip
src/components/debug/PayloadLabTab.tsx:592:            title="Copy table" | title_tooltip
src/components/debug/PayloadLabTab.tsx:764:            title="Download JSON" | title_tooltip
src/components/debug/PayloadLabTab.tsx:801:            title="Download CSV" | title_tooltip
src/components/debug/PayloadLabTab.tsx:815:            title="Download JSON" | title_tooltip
src/components/debug/PayloadLabTab.tsx:829:            title="Copy table" | title_tooltip
src/components/debug/PayloadLabTab.tsx:2016:          title="Replace ISL Payload?" | title_tooltip
src/components/debug/PayloadLabTab.tsx:2052:        title="GENERATE DRAFT" | title_tooltip
src/components/debug/PayloadLabTab.tsx:2413:        title="ISL PAYLOAD" | title_tooltip
src/components/debug/PayloadLabTab.tsx:2827:        title="RESULTS" | title_tooltip
src/components/ResultsPanel.tsx:90:            <span className="px-2 py-0.5 text-xs font-medium bg-panel text-info rounded" title="Using demo data">Demo</span> | title_tooltip
src/components/ContractInspector.tsx:155:            title="Copy to clipboard" | title_tooltip
src/components/ContractInspector.tsx:258:              title="Open ISL request body in Payload Lab for editing and testing" | title_tooltip
src/canvas/ReactFlowGraph.tsx:2142:          title="Provenance Hub" | title_tooltip
src/canvas/ReactFlowGraph.tsx:2158:          title="Olumi AI" | title_tooltip
src/canvas/ReactFlowGraph.tsx:2170:          title="Replace existing flow?" | title_tooltip
src/canvas/ReactFlowGraph.tsx:2224:      <BottomSheet isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Start fresh?"> | title_tooltip
src/components/OnboardingHints.tsx:34:            title="Dismiss (won't show again)" | title_tooltip
src/canvas/journey/JourneyTabBody.tsx:204:          title="No activity yet" | title_tooltip
src/canvas/nodes/ConstraintNode.tsx:128:            title="Hard constraint - must be met" | title_tooltip
src/components/debug/components/BoundaryCard.tsx:329:          <JsonSection title="Request" data={request} /> | title_tooltip
src/components/debug/components/BoundaryCard.tsx:330:          <JsonSection title="Response" data={response} defaultExpanded /> | title_tooltip
src/canvas/nodes/GoalNode.tsx:251:                title="Some model inputs are missing. Goal probability may be less reliable." | title_tooltip
src/canvas/nodes/shared/ActionIcons.tsx:39:          title="Confirm value" | title_tooltip
src/canvas/nodes/shared/ActionIcons.tsx:50:          title="Edit" | title_tooltip
src/components/RunReportDrawer.tsx:166:                title="Copy JSON" | title_tooltip
src/components/RunReportDrawer.tsx:198:                title="Download JSON" | title_tooltip
src/components/shared/TriageHealthHeader.tsx:7: * Pre-analysis: title="Decision readiness", ringLabel="ready" | title_tooltip
src/components/shared/TriageHealthHeader.tsx:8: * Post-analysis: title="Decision confidence", ringLabel="trust" | title_tooltip
src/components/SandboxStreamPanel.tsx:751:              title="Open settings" | title_tooltip
src/components/SandboxStreamPanel.tsx:763:              title="Open canvas" | title_tooltip
src/components/SandboxStreamPanel.tsx:775:              title="Open scenarios" | title_tooltip
src/components/SandboxStreamPanel.tsx:843:            title="Replay run" | title_tooltip
src/components/SandboxStreamPanel.tsx:948:                          title="Add a comment" | title_tooltip
src/components/SandboxStreamPanel.tsx:969:                          title="Add a comment" | title_tooltip
src/components/SandboxStreamPanel.tsx:1083:          <p data-testid="resume-note" className="text-xs text-gray-500 ml-2" aria-hidden="true" title="Resumed after a brief network blip"> | title_tooltip
src/components/SandboxStreamPanel.tsx:1195:            title="Open report" | title_tooltip
src/components/SandboxStreamPanel.tsx:1206:            title="Send to canvas" | title_tooltip
src/components/SandboxStreamPanel.tsx:1231:            title="Open history" | title_tooltip
src/components/SandboxStreamPanel.tsx:1246:              title="Export .txt" | title_tooltip
src/components/SandboxStreamPanel.tsx:1275:              title="Export .json" | title_tooltip
src/components/SandboxStreamPanel.tsx:1304:              title="Export Markdown" | title_tooltip
src/components/SandboxStreamPanel.tsx:1351:                title="Linearity: consistency as inputs change." | title_tooltip
src/components/SandboxStreamPanel.tsx:1362:                title="Calibration: alignment of confidence with outcomes." | title_tooltip
src/components/SandboxStreamPanel.tsx:1373:                title="Diversity: variety in explored approaches." | title_tooltip
src/canvas/nodes/shared/OlumiSparkle.tsx:11:      <span className="inline-flex cursor-help" title="Estimated by Olumi"> | title_tooltip
src/components/assistants/InfluenceExplainer.tsx:92:              title="Dismiss" | title_tooltip
src/components/shared/TriageCard.tsx:209:            title="Olumi estimated this value" | title_tooltip
src/components/shared/TriageCard.tsx:324:            title="Olumi estimated this value" | title_tooltip
src/canvas/nodes/shared/BriefIcon.tsx:9:    <span className="inline-flex" title="From your brief"> | title_tooltip
src/components/debug/tabs/DataFlowTab.tsx:329:        title="UI → CEE" | title_tooltip
src/components/debug/tabs/DataFlowTab.tsx:386:        <RawResponseInspector title="Raw CEE response keys" response={data.payloads.cee_response} /> | title_tooltip
src/components/debug/tabs/DataFlowTab.tsx:391:        title="UI → PLoT" | title_tooltip
src/components/debug/tabs/DataFlowTab.tsx:447:          title="Raw PLoT response keys" | title_tooltip
src/components/debug/tabs/DataFlowTab.tsx:456:          title="PLoT → ISL" | title_tooltip
src/components/debug/tabs/DataFlowTab.tsx:481:          <RawResponseInspector title="Raw ISL response keys" response={data.payloads.isl_response} /> | title_tooltip
src/components/stream/StreamOutputDisplay.tsx:116:              title="Copy code" | title_tooltip
src/components/stream/StreamOutputDisplay.tsx:142:          title="Estimated in-flight cost. Final cost appears on 'Done'." | title_tooltip
src/components/DebugOverlays.tsx:26:        title="plot-canvas-root (z:10)" | title_tooltip
src/components/DebugOverlays.tsx:40:        title="plot-right-rail (z:20)" | title_tooltip
src/components/DebugOverlays.tsx:51:        title="plot-chrome (z:15)" | title_tooltip
src/components/DebugOverlays.tsx:62:        title="whiteboard-layer (z:1)" | title_tooltip
src/canvas/nodes/BaseNode.tsx:278:          title="Flagged as assumption" | title_tooltip
src/canvas/nodes/BaseNode.tsx:289:          title="Set a success threshold to enable analysis" | title_tooltip
src/canvas/nodes/BaseNode.tsx:300:          title="Missing required input" | title_tooltip
src/components/PlotToolbar.tsx:68:            title="Add Node (N)" | title_tooltip
src/components/PlotToolbar.tsx:107:          title="Add Note (M)" | title_tooltip
src/components/PlotToolbar.tsx:117:          title="Keyboard shortcuts" | title_tooltip
src/components/debug/tabs/ContractIntegrityTab.tsx:796:      <Section title="Seed chain" status={seedChain.status}> | title_tooltip
src/components/debug/tabs/ContractIntegrityTab.tsx:822:      <Section title="Strength audit" status={strengthAudit.status}> | title_tooltip
src/components/debug/tabs/ContractIntegrityTab.tsx:894:      <Section title="Request chain" status={requestChainStatus}> | title_tooltip
src/components/debug/tabs/ContractIntegrityTab.tsx:960:      <Section title="Repairs applied" status={repairsResult.status} defaultExpanded={repairsResult.totalCount > 0} testId="repairs-applied-section"> | title_tooltip
src/components/debug/tabs/ContractIntegrityTab.tsx:1060:          <Section title="Model adjustments" status="warn" defaultExpanded> | title_tooltip
src/components/debug/tabs/ContractIntegrityTab.tsx:1086:      <Section title="Constraint pipeline" status={constraintPipelineResult.status} defaultExpanded={false} testId="constraint-pipeline-section"> | title_tooltip
src/components/debug/tabs/ContractIntegrityTab.tsx:1123:      <Section title="Decision review" status={decisionReviewResult.status} defaultExpanded={decisionReviewResult.status !== 'pass' && decisionReviewResult.status !== 'unavailable'} testId="decision-review-section"> | title_tooltip
src/components/debug/tabs/ContractIntegrityTab.tsx:1158:      <Section title="Critiques" status={critiquesResult.status} defaultExpanded={critiquesResult.critiques.length > 0} testId="critiques-section"> | title_tooltip
src/components/debug/tabs/ContractIntegrityTab.tsx:1196:      <Section title="Validation warnings" status={validationStatus}> | title_tooltip
src/components/DebugPanel.tsx:462:          title="Open Debug Panel" | title_tooltip
src/components/JobsProgressPanel.tsx:89:                    title="Cancel job" | title_tooltip
src/canvas/components/GraphTextView.tsx:573:                                      title="Effect is an estimate of impact size; belief is probability the relationship exists." | title_tooltip
src/canvas/components/GraphTextView.tsx:582:                                      title="This edge is sensitive - changes here could affect the recommendation" | title_tooltip
src/canvas/components/GraphTextView.tsx:592:                                      title="This edge is robust - stable under uncertainty" | title_tooltip
src/components/results/SuccessTargetRow.tsx:227:              title="Apply" | title_tooltip
src/canvas/snapshots/SnapshotPanel.tsx:155:                    title="Compare with current canvas (press D to toggle)" | title_tooltip
src/canvas/snapshots/SnapshotPanel.tsx:163:                  title="Restore this snapshot" | title_tooltip
src/canvas/snapshots/SnapshotPanel.tsx:170:                  title="Delete this snapshot" | title_tooltip
src/components/KeyboardShortcuts.tsx:48:            title="Close" | title_tooltip
src/canvas/components/SnapshotManager.tsx:143:    <BottomSheet isOpen={isOpen} onClose={onClose} title="Snapshot Manager"> | title_tooltip
src/canvas/ui/inspector-v2/InspectorShell.tsx:116:              title="Close inspector" | title_tooltip
src/components/results/AdvancedSection.tsx:126:      title="Advanced" | title_tooltip
src/canvas/ui/NodeInspector.tsx:264:          title="Edit assumptions" | title_tooltip
src/canvas/ui/EdgeInspectorCompact.tsx:124:            title="Expand" | title_tooltip
src/canvas/ui/NodeInspectorCompact.tsx:154:            title="Expand" | title_tooltip
src/canvas/panels/TemplateCard.tsx:94:              title="Add template to current canvas" | title_tooltip
src/components/results/DecisionConfidencePanel.tsx:477:        title="Current recommendation" | title_tooltip
src/canvas/panels/InspectorPanel.tsx:240:          title="Inspector" | title_tooltip
src/canvas/panels/InspectorPanel.tsx:273:              <PanelSection title="Edge Details"> | title_tooltip
src/canvas/panels/InspectorPanel.tsx:297:              <PanelSection title="Belief & confidence"> | title_tooltip
src/canvas/help/HelpMenu.tsx:84:        title="Help" | title_tooltip
src/canvas/ui/inspector-v2/editors/RiskAdvancedEditor.tsx:42:        <AdvancedFieldGroup title="Post-analysis (per option)"> | title_tooltip
src/canvas/ui/inspector-v2/editors/RiskAdvancedEditor.tsx:54:      <AdvancedFieldGroup title="Metadata"> | title_tooltip
src/canvas/panels/TemplatesPanel.tsx:570:          title="Save current canvas as a named scenario" | title_tooltip
src/canvas/panels/TemplatesPanel.tsx:578:          title="Merge this template into current canvas" | title_tooltip
src/canvas/panels/TemplatesPanel.tsx:603:          title="Templates" | title_tooltip
src/canvas/components/PreAnalysisHealth.tsx:276:              title="High Priority" | title_tooltip
src/canvas/components/PreAnalysisHealth.tsx:286:              title="Recommended" | title_tooltip
src/canvas/components/PreAnalysisHealth.tsx:296:              title="Nice to Have" | title_tooltip
src/canvas/ui/inspector-v2/editors/FactorExternalEditor.tsx:32:      <AdvancedFieldGroup title="Prior distribution"> | title_tooltip
src/canvas/ui/inspector-v2/editors/FactorExternalEditor.tsx:61:      <AdvancedFieldGroup title="Classification"> | title_tooltip
src/canvas/ui/inspector-v2/editors/OutcomeAdvancedEditor.tsx:44:        <AdvancedFieldGroup title="Post-analysis (per option)"> | title_tooltip
src/canvas/ui/inspector-v2/editors/OutcomeAdvancedEditor.tsx:64:      <AdvancedFieldGroup title="Metadata"> | title_tooltip
src/canvas/panels/AdapterStatusBanner.tsx:84:          title="Re-check v1 endpoint availability" | title_tooltip
src/canvas/panels/ResultsPanel.tsx:417:          title="Analysis Results" | title_tooltip
src/canvas/panels/ResultsPanel.tsx:476:                  <PanelSection title="Most Likely Outcome"> | title_tooltip
src/canvas/panels/ResultsPanel.tsx:498:                    <PanelSection title="Decision Review"> | title_tooltip
src/canvas/panels/ResultsPanel.tsx:509:                  <PanelSection title="Decision story"> | title_tooltip
src/canvas/panels/ResultsPanel.tsx:583:                    <PanelSection title="Key Drivers"> | title_tooltip
src/canvas/help/KeyboardLegend.tsx:209:            title="Close (Esc)" | title_tooltip
src/components/results/Accordion.tsx:168:              title="Based on the confidence levels of your key factors. Improve by gathering data on low-confidence drivers." | title_tooltip
src/canvas/ui/inspector-v2/editors/OptionAdvancedEditor.tsx:45:      <AdvancedFieldGroup title="Interventions"> | title_tooltip
src/canvas/ui/inspector-v2/editors/OptionAdvancedEditor.tsx:70:      <AdvancedFieldGroup title="Metadata"> | title_tooltip
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:69:      <AdvancedFieldGroup title="Observed state"> | title_tooltip
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:126:      <AdvancedFieldGroup title="Classification"> | title_tooltip
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:150:      <AdvancedFieldGroup title="Normalisation range"> | title_tooltip
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:165:      <AdvancedFieldGroup title="Uncertainty drivers"> | title_tooltip
src/canvas/components/LayoutGuidedModal.tsx:19:    <BottomSheet isOpen={isOpen} onClose={onClose} title="Guided Layout"> | title_tooltip
src/canvas/components/ProgressStrip.tsx:88:              title="Cancel analysis" | title_tooltip
src/canvas/ui/inspector-v2/editors/FactorObservableEditor.tsx:33:      <AdvancedFieldGroup title="Observed state"> | title_tooltip
src/canvas/ui/inspector-v2/editors/FactorObservableEditor.tsx:79:      <AdvancedFieldGroup title="Classification"> | title_tooltip
src/canvas/ui/inspector-v2/editors/FactorObservableEditor.tsx:94:      <AdvancedFieldGroup title="Normalisation range"> | title_tooltip
src/canvas/ui/inspector-v2/editors/EdgeAdvancedEditor.tsx:47:      <AdvancedFieldGroup title="Effect parameters"> | title_tooltip
src/canvas/ui/inspector-v2/editors/EdgeAdvancedEditor.tsx:80:      <AdvancedFieldGroup title="Structural uncertainty"> | title_tooltip
src/canvas/ui/inspector-v2/editors/EdgeAdvancedEditor.tsx:93:      <AdvancedFieldGroup title="Metadata"> | title_tooltip
src/components/results/ResultsBody.tsx:204:              title="Your options" | title_tooltip
src/components/results/ResultsBody.tsx:270:        title="What's driving this" | title_tooltip
src/components/results/ResultsBody.tsx:297:          title="What could change the result" | title_tooltip
src/components/results/ResultsBody.tsx:350:                  title="Before you decide" | title_tooltip
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:2054:                  title="These links were generated without recorded provenance. You can still analyse; add provenance where it matters." | title_tooltip
src/canvas/ui/inspector/InspectorAccordion.tsx:67:          title="ASSUMPTIONS" | title_tooltip
src/canvas/ui/inspector/InspectorAccordion.tsx:80:          title="APPEARANCE" | title_tooltip
src/canvas/ui/inspector/InspectorAccordion.tsx:93:          title="ADVANCED" | title_tooltip
src/canvas/ui/inspector-v2/editors/DecisionAdvancedEditor.tsx:23:      <AdvancedFieldGroup title="Metadata"> | title_tooltip
src/canvas/ui/inspector-v2/editors/GoalAdvancedEditor.tsx:36:      <AdvancedFieldGroup title="Threshold parameters"> | title_tooltip
src/canvas/ui/inspector-v2/editors/GoalAdvancedEditor.tsx:66:      <AdvancedFieldGroup title="Constraints"> | title_tooltip
src/canvas/components/LayoutPopover.tsx:45:        title="Auto-layout your diagram" | title_tooltip
src/canvas/components/LayoutPopover.tsx:52:      <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Auto-Layout"> | title_tooltip
src/canvas/panels/IssuesPanel.tsx:100:                title="Errors" | title_tooltip
src/canvas/panels/IssuesPanel.tsx:108:                title="Warnings" | title_tooltip
src/canvas/panels/IssuesPanel.tsx:116:                title="Info" | title_tooltip
src/canvas/components/LayoutOptionsPanel.tsx:75:        title="🔧 Layout" | title_tooltip
src/canvas/components/ScenarioComparison.tsx:47:            title="Close comparison" | title_tooltip
src/canvas/components/ScenarioComparison.tsx:167:            title="Fit both canvases to view" | title_tooltip
src/canvas/components/DraftChat.tsx:935:          title="Drag to resize panel" | title_tooltip
src/canvas/components/DraftChat.tsx:942:          title="Drag corner to resize" | title_tooltip
src/canvas/components/DraftChat.tsx:1022:                title="Press Enter to send" | title_tooltip
src/canvas/components/DraftChat.tsx:1418:                  title="Press Enter to send • Shift+Enter for new line" | title_tooltip
src/canvas/components/FunctionalForm/AppliedFormsCallout.tsx:64:          title="Confirm this form" | title_tooltip
src/canvas/components/FunctionalForm/AppliedFormsCallout.tsx:73:          title="Change this form" | title_tooltip
src/canvas/components/FunctionalForm/AppliedFormsCallout.tsx:159:            title="Dismiss all" | title_tooltip
src/canvas/components/LimitsPanel.tsx:199:    <BottomSheet isOpen={isOpen} onClose={onClose} title="Engine Limits"> | title_tooltip
src/canvas/components/DriverChips.tsx:395:            title="No evidence supporting this driver - consider adding data" | title_tooltip
src/canvas/components/FocusModeChip.tsx:86:        title="Clear selection" | title_tooltip
src/canvas/components/ComparisonCanvasLayout.tsx:465:                title="Fit all canvases to view" | title_tooltip
src/canvas/components/ComparisonCanvasLayout.tsx:477:            title="Exit comparison mode" | title_tooltip
src/canvas/components/ModelQualityScore.tsx:265:                  <span className="text-warning" title="Local count differs from engine assessment"> | title_tooltip
src/canvas/components/model-tab/OptionsSection.tsx:260:      title="Options" | title_tooltip
src/canvas/components/GuidedLayoutDialog.tsx:94:      title="Guided Layout" | title_tooltip
src/canvas/components/ScenarioSwitcher.tsx:237:                        title="Export scenario" | title_tooltip
src/canvas/components/ScenarioSwitcher.tsx:246:                        title="Duplicate" | title_tooltip
src/canvas/components/ScenarioSwitcher.tsx:255:                        title="Rename" | title_tooltip
src/canvas/components/ScenarioSwitcher.tsx:264:                        title="Delete" | title_tooltip
src/canvas/components/ScenarioSwitcher.tsx:321:                              <span className="flex-shrink-0 ml-2" title="Unsaved changes"> | title_tooltip
src/canvas/components/ScenarioSwitcher.tsx:354:                              <span className="flex-shrink-0 ml-2" title="Unsaved changes"> | title_tooltip
src/canvas/components/RecommendationCard/index.tsx:328:            title="How we got here" | title_tooltip
src/canvas/components/RecommendationCard/index.tsx:517:            title="Why this option" | title_tooltip
src/canvas/components/RecommendationCard/index.tsx:531:            title="What you're trading off" | title_tooltip
src/canvas/components/RecommendationCard/index.tsx:546:            title="Assumptions to validate" | title_tooltip
src/canvas/components/RecommendationCard/index.tsx:561:            title="Constraint impacts" | title_tooltip
src/canvas/components/RecommendationCard/index.tsx:575:          title="When to reconsider" | title_tooltip
src/canvas/components/ResultsPanel/EvidencePackExport.tsx:129:          title="Copy link" | title_tooltip
src/canvas/components/ResultsPanel/EvidencePackExport.tsx:146:          title="Download JSON" | title_tooltip
src/canvas/components/InterventionDisplay.tsx:226:                    title="Low confidence estimate" | title_tooltip
src/canvas/components/InputsDock.tsx:55:        title="Framing" | title_tooltip
src/canvas/components/InputsDock.tsx:211:            title="Ready to analyse" | title_tooltip
src/canvas/components/InputsDock.tsx:309:            title="A factor is a node in your model and a connection is an edge between nodes. Olumi works best when you stay under roughly 50 factors and 200 connections." | title_tooltip
src/canvas/components/StructuralHealth.tsx:42:            title="Orphan Nodes" | title_tooltip
src/canvas/components/StructuralHealth.tsx:51:            title="Circular Dependencies" | title_tooltip
src/canvas/components/StructuralHealth.tsx:60:            title="Logic Issues" | title_tooltip
src/canvas/components/model-tab/ModelHealthSection.tsx:99:      title="Audit" | title_tooltip
src/canvas/components/ValidationSuggestions.tsx:267:                title="Highlight affected nodes on canvas" | title_tooltip
src/canvas/components/OutputsDock.tsx:1105:              title="Toggle expert mode" | title_tooltip
src/canvas/components/pre-analysis/ModelSnapshot.tsx:190:      title="Model snapshot" | title_tooltip
src/canvas/components/ProvenanceHubTab.tsx:195:              <span className="text-warning font-medium" title="Content was truncated to 5K chars"> | title_tooltip
src/canvas/components/LensDropdown.tsx:34:      title="Graph lens (L)" | title_tooltip
src/canvas/components/RunHistory.tsx:175:          title="No runs yet" | title_tooltip
src/canvas/components/pre-analysis/AnalysisSettings.tsx:44:      title="Analysis settings" | title_tooltip
src/canvas/components/pre-analysis/expertise/AiEstimated.tsx:97:                title="Confirm value" | title_tooltip
src/canvas/components/pre-analysis/expertise/AiEstimated.tsx:106:                  title="Ask AI to research" | title_tooltip
src/canvas/components/pre-analysis/ModelHealthCard.tsx:82:        title="Decision readiness" | title_tooltip
src/canvas/components/model-tab/RisksSection.tsx:77:      title="Risks" | title_tooltip
src/canvas/components/pre-analysis/SuccessTarget.tsx:374:            title="Confirm target" | title_tooltip
src/canvas/components/pre-analysis/SuccessTarget.tsx:382:            title="Edit target" | title_tooltip
src/canvas/components/DocumentsManager.tsx:349:                  title="Save (Enter)" | title_tooltip
src/canvas/components/DocumentsManager.tsx:360:                  title="Cancel (Escape)" | title_tooltip
src/canvas/components/DocumentsManager.tsx:388:                <span className="text-warning font-medium" title="Content truncated to 5K chars"> | title_tooltip
src/canvas/components/DocumentsManager.tsx:419:              title="Rename (F2)" | title_tooltip
src/canvas/components/DocumentsManager.tsx:431:              title="Open external link" | title_tooltip
src/canvas/components/DocumentsManager.tsx:441:              title="Download" | title_tooltip
src/canvas/components/DocumentsManager.tsx:450:            title="Delete" | title_tooltip
src/canvas/components/model-tab/RelationshipsSection.tsx:301:          <span className={`${typography.panelMeta} text-text-light`} title="How confident you are that this relationship exists"> | title_tooltip
```

## 5. ALT_TEXT (alt_text)

```
src/pages/ScenarioListPage.tsx:363:          <img src="/olumi-logo.png" alt="Olumi" className="h-8" /> | alt_text
src/components/layout/TopBar.tsx:266:            alt="Olumi" | alt_text
src/canvas/onboarding/EmptyState.tsx:190:                    alt="" | alt_text
src/canvas/components/DraftPreview.tsx:113:              alt="Draft graph preview" | alt_text
```

## 6. CSS_CONTENT (css_content)

```
src/components/layout/LeftSidebar.module.css:35 | css_content | content: '';
```

## 7. EMPTY_STATE (empty_state)

```
src/routes/PlotShowcase.tsx:551:                <div className="text-sm text-gray-600">No biases detected</div> | empty_state
src/routes/PlotShowcase.tsx:674:                <div className="text-sm text-gray-600">No headers captured yet</div> | empty_state
src/routes/templates/DecisionTemplates.tsx:158:          <p className="text-gray-500 mb-4">No templates available</p> | empty_state
src/plotLite/GhostPanel.tsx:21:  if (!list.length) return <section data-testid="ghost-panel">No drafts yet</section> | empty_state
src/routes/SandboxV1.tsx:536:                <div className="text-sm text-gray-600">No biases detected</div> | empty_state
src/routes/SandboxV1.tsx:630:                <div className="text-sm text-gray-600">No headers captured yet</div> | empty_state
src/pages/SharedBriefPage.tsx:21:    return <p className="text-text-light">No brief content available.</p> | empty_state
src/components/BiasesCarousel/index.tsx:67:            <p className="text-warning font-medium">No cognitive biases identified</p> | empty_state
src/components/RunHistoryDrawer.tsx:77:            <div data-testid="history-empty" className="text-gray-500 text-xs">No runs yet.</div> | empty_state
src/components/Analysis/AnalysisContent.tsx:42:          {formattedContent || <p className="text-gray-500">No analysis content available.</p>} | empty_state
src/components/debug/tabs/PipelineTab.tsx:800:        <div style={{ color: '#16a34a', fontSize: 12 }}>No CEE repairs applied</div> | empty_state
src/components/debug/tabs/PipelineTab.tsx:867:        <div style={{ color: '#16a34a', fontSize: 12 }}>No STRP mutations</div> | empty_state
src/components/debug/tabs/PipelineTab.tsx:1463:                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No additional config available</span> | empty_state
src/components/debug/tabs/PipelineTab.tsx:1626:                      <div style={{ color: '#94a3b8' }}>No structural changes</div> | empty_state
src/pages/sandbox-guide/components/panel/states/PostRunState.tsx:40:        <div className="text-storm-700 text-sm">No results available</div> | empty_state
src/components/debug/tabs/ContractIntegrityTab.tsx:1046:            <div style={{ color: '#16a34a', fontSize: 12 }}>No repairs needed</div> | empty_state
src/components/debug/tabs/ContractIntegrityTab.tsx:1118:          <div style={{ color: '#94a3b8', fontSize: 12 }}>No constraints in this run</div> | empty_state
src/components/debug/tabs/ContractIntegrityTab.tsx:1188:            <div style={{ color: '#16a34a', fontSize: 12 }}>No critiques</div> | empty_state
src/components/debug/tabs/ContractIntegrityTab.tsx:1204:            return <div style={{ color: '#16a34a', fontSize: 12 }}>No validation warnings</div> | empty_state
src/components/teams/TeamDetails.tsx:99:            <p className="text-gray-400 italic">No description provided</p> | empty_state
src/components/DecisionGraphLayer.tsx:267:          <div className="text-sm font-semibold text-gray-700 mb-1">No decision graph yet</div> | empty_state
src/components/Analysis.tsx:589:           ) : ( <p className="text-sm text-gray-500">No collaborators found.</p> )} | empty_state
src/components/Analysis.tsx:614:            ) : ( <p className="text-gray-500 italic">No analysis content generated.</p> )} | empty_state
src/components/Analysis.tsx:667:                    <p className="text-gray-500 text-sm">No collaborators yet. Invite someone below.</p> | empty_state
src/components/teams/MyTeams.tsx:157:          <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3> | empty_state
src/components/teams/UserDirectoryTab.tsx:186:                  <p>No users found matching "{searchTerm}". Try another search or add by email.</p> | empty_state
src/components/teams/UserDirectoryTab.tsx:188:                  <p>No users found. Try searching by name or email.</p> | empty_state
src/canvas/ui/inspector-v2/panels/FactorObservablePanel.tsx:147:          <span className={`${typography.panelMeta} text-text-light italic`}>No value set</span> | empty_state
src/components/teams/ManageTeamMembersModal.tsx:380:                <p className="text-center text-gray-500 py-8">No pending invitations</p> | empty_state
src/components/teams/ManageTeamMembersModal.tsx:431:                <p className="text-center text-gray-500 py-8">No members yet</p> | empty_state
src/canvas/ui/inspector-v2/panels/GoalPanel.tsx:385:        <p className={`${typography.panelMeta} text-text-light py-2`}>No contributing factors connected yet</p> | empty_state
src/canvas/ui/inspector/SignedStrengthSlider.tsx:87:          <span className={`${typography.panelMeta} text-text-light`}>No effect</span> | empty_state
src/canvas/ui/inspector-v2/editors/OptionAdvancedEditor.tsx:47:          <p className={`${typography.panelMeta} text-text-light`}>No interventions defined</p> | empty_state
src/components/ProsConsList/components/EmptyState.tsx:13:      <h4 className="text-lg font-medium text-gray-900 mb-2">No Options Added Yet</h4> | empty_state
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:180:            <p className={`${typography.panelMeta} text-text-light`}>No drivers defined</p> | empty_state
src/components/ProsConsList/components/OptionsGrid.tsx:71:        <p className="text-warning">No valid options available. Please add an option to get started.</p> | empty_state
src/canvas/ui/inspector-v2/editors/GoalAdvancedEditor.tsx:68:          <p className={`${typography.panelMeta} text-text-light`}>No constraints defined</p> | empty_state
src/components/decisions/DecisionEdit.tsx:213:          <p className="text-gray-500 italic">No analysis generated.</p> | empty_state
src/components/decisions/DecisionList.tsx:360:            <h3 className="text-lg font-medium text-gray-900 mb-2">No decisions yet</h3> | empty_state
src/canvas/compare/CompareSummary.tsx:40:              <span className="text-gray-600">No changes</span> | empty_state
src/canvas/compare/CompareSummary.tsx:54:              <span className="text-gray-600">No changes</span> | empty_state
src/canvas/nodes/OptionNode.tsx:444:        if (allNoChange) return <p className={`${typography.edgeLabel} text-text-light m-0`}>No changes from current state</p> | empty_state
src/canvas/nodes/OptionNode.tsx:524:        <p className={`${typography.nodeLabel} text-text-body m-0`}>No interventions specified for this option.</p> | empty_state
src/canvas/components/CompareView.tsx:201:      ) : <div className={`${typography.caption} text-gray-500`}>No data</div>} | empty_state
src/canvas/snapshots/SnapshotPanel.tsx:133:        <p className="text-sm text-gray-500 italic">No snapshots yet</p> | empty_state
src/canvas/components/SnapshotManager.tsx:161:              <p>No snapshots yet</p> | empty_state
src/canvas/panels/IssuesPanel.tsx:93:            <p className={typography.panelBody}>No issues found</p> | empty_state
src/canvas/components/TrustSignal.tsx:128:            <p className={`${typography.body} text-sand-600`}>No quality data</p> | empty_state
src/canvas/components/ComparisonCanvasLayout.tsx:266:          <p className={`${typography.body} text-ink-600`}>No differences found</p> | empty_state
src/canvas/components/DocumentsManager.tsx:211:            <p className={`${typography.body} font-medium`}>No documents yet</p> | empty_state
src/canvas/components/DocumentsManager.tsx:221:            <p className={`${typography.body} font-medium`}>No documents match '{searchQuery}'</p> | empty_state
src/canvas/components/ProvenanceHubTab.tsx:131:            <p className={typography.body}>No citations found</p> | empty_state
src/canvas/components/OutcomesSignal.tsx:193:            <p className={`${typography.body} text-sand-600`}>No outcomes yet</p> | empty_state
src/canvas/components/InterventionDisplay.tsx:137:        <span>No interventions specified</span> | empty_state
src/canvas/components/InterventionDisplay.tsx:273:      <span className="text-carrot-600 text-xs">No interventions</span> | empty_state
src/canvas/components/pre-analysis/expertise/MissingData.tsx:83:              <span className={`${typography.panelMeta} text-text-light`}>No data</span> | empty_state
src/canvas/components/ThresholdDisplay.tsx:146:            <p className={`${typography.body} text-sand-600`}>No critical thresholds</p> | empty_state
src/canvas/components/pre-analysis/SuccessTarget.tsx:218:          <span className={`${typography.panelBody} text-text-light`}>No goal selected</span> | empty_state
src/canvas/components/GoalNodeSelector.tsx:91:          <span className="text-sm text-carrot-600">No goal nodes</span> | empty_state
src/canvas/components/ChangeAttributionPanel.tsx:251:          <span className={typography.body}>No changes recorded</span> | empty_state
src/canvas/components/pre-analysis/GoalBaselineInput.tsx:133:        <p className={`${typography.panelBody} text-text-light`}>No goal defined yet.</p> | empty_state
src/canvas/components/pre-analysis/OptionPreview.tsx:163:      <p className={`${typography.panelBody} text-text-light mt-1`}>No changes</p> | empty_state
```

## 8. BUTTON_TEXT (button_text)

```
src/routes/PlcLab.tsx:68:        <button data-testid="add-node-btn" onClick={addNode}>+ Add Node</button> | button_text
src/routes/PlcLab.tsx:86:        <button data-testid="plc-undo-btn" onClick={() => setHist(h => undoHistory(h))} disabled={hist.past.length === 0}>Undo</button> | button_text
src/routes/PlcLab.tsx:87:        <button data-testid="plc-redo-btn" onClick={() => setHist(h => redoHistory(h))} disabled={hist.future.length === 0}>Redo</button> | button_text
src/modules/critique/CritiquePanel.tsx:30:                  <button onClick={() => onFix(item)} className="mt-2 px-2 py-1 text-xs bg-primary text-text-on-color rounded">Fix</button> | button_text
src/components/SandboxStreamPanel.tsx:166:                  <li key={n.id}><button type="button" className="text-xs w-full text-left px-2 py-2 border rounded min-h-[44px]" data-testid={`list-node-${n.id}`} tabIndex={0}>{n.title}</button></li> | button_text
src/components/SandboxStreamPanel.tsx:174:                  <li key={e.id}><button type="button" className="text-xs w-full text-left px-2 py-2 border rounded min-h-[44px]" data-testid={`list-edge-${e.id}`} tabIndex={0}>{e.from} → {e.to} ({e.weight.toFixed(2)})</button></li> | button_text
src/components/SandboxStreamPanel.tsx:213:                <button data-testid="template-card-pricing-change" className="text-xs px-2 py-2 rounded border" onClick={() => chooseStarter('pricing-change')}>Pricing change</button> | button_text
src/components/SandboxStreamPanel.tsx:214:                <button data-testid="template-card-feature-launch" className="text-xs px-2 py-2 rounded border" onClick={() => chooseStarter('feature-launch')}>Feature launch</button> | button_text
src/components/SandboxStreamPanel.tsx:215:                <button data-testid="template-card-build-vs-buy" className="text-xs px-2 py-2 rounded border" onClick={() => chooseStarter('build-vs-buy')}>Build vs Buy</button> | button_text
src/components/SandboxStreamPanel.tsx:216:                <button data-testid="template-card-scratch" className="text-xs px-2 py-2 rounded border" onClick={() => chooseStarter('scratch')}>Start from scratch</button> | button_text
src/components/SandboxStreamPanel.tsx:942:                      <button type="button" className="text-xs flex-1 text-left px-2 py-2 border rounded min-h-[44px]" data-testid={`list-node-${n.id}`} tabIndex={0}>{n.title}</button> | button_text
src/components/SandboxStreamPanel.tsx:963:                      <button type="button" className="text-xs flex-1 text-left px-2 py-2 border rounded min-h-[44px]" data-testid={`list-edge-${e.id}`} tabIndex={0}>{e.from} → {e.to} ({e.weight.toFixed(2)})</button> | button_text
src/components/SandboxStreamPanel.tsx:987:                  <button type="button" className="text-[11px] px-2 py-0.5 rounded border" onClick={() => setCommentTarget(null)}>Close</button> | button_text
src/components/SandboxStreamPanel.tsx:1063:              <button className="text-xs border rounded px-2 py-0.5" onClick={() => setSheetOpen(false)}>Close</button> | button_text
src/components/SandboxStreamPanel.tsx:1470:              <button type="button" className="text-[11px] px-2 py-0.5 rounded border border-warning/30 bg-white">{adv.primaryAction}</button> | button_text
src/poc/components/OnboardingHints.tsx:57:          <button type="button" className="poc-help-close" onClick={onToggleHelp} aria-label="Close help">Close</button> | button_text
src/plotLite/GhostPanel.tsx:38:                          <button disabled>Accept</button> | button_text
src/plotLite/GhostPanel.tsx:39:                          <button disabled>Edit</button> | button_text
src/plotLite/GhostPanel.tsx:40:                          <button disabled>Dismiss</button> | button_text
src/components/GoalClarificationScreen.tsx:141:                    <button onClick={skip} className="px-4 py-2 bg-panel rounded">Yes, skip</button> | button_text
src/components/GoalClarificationScreen.tsx:142:                    <button onClick={() => setSkipConfirm(false)} className="px-4 py-2 bg-white border rounded">No, add</button> | button_text
src/components/GoalClarificationScreen.tsx:157:            <button onClick={skip} className="px-6 py-2 border rounded">Skip Goals</button> | button_text
src/lib/gate-rendering.tsx:22: *   return <button disabled={isBlocked} title={tooltip}>Run</button> | button_text
src/components/CanvasDrawer.tsx:236:          <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300" data-testid="canvas-import-btn" onClick={onImport}>Import .json</button> | button_text
src/components/CanvasDrawer.tsx:237:          <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300" data-testid="canvas-export-btn" onClick={onExport}>Export .json</button> | button_text
src/components/CanvasDrawer.tsx:239:            <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300" data-testid="canvas-export-text-btn" onClick={onExportText}>Export text</button> | button_text
src/components/CanvasDrawer.tsx:241:          <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300" data-testid="canvas-clear-btn" onClick={onClear}>Clear</button> | button_text
src/components/EngineAuditPanel.tsx:50:          <button type="button" data-testid="audit-fetch-btn" onClick={onFetch} disabled={busy} className="px-2 py-1 rounded border text-xs">Fetch</button> | button_text
src/components/EngineAuditPanel.tsx:51:          <button type="button" data-testid="audit-refetch-btn" onClick={onRefetch} disabled={busy} className="px-2 py-1 rounded border text-xs">Re-fetch</button> | button_text
src/components/ScenarioDrawer.tsx:105:            <button type="button" data-testid="scenario-save-btn" className="text-xs px-2 py-1 rounded border border-sand-200" onClick={onSave} disabled={!name.trim()}>Save</button> | button_text
src/components/ScenarioDrawer.tsx:124:                    <button type="button" data-testid="scenario-load-btn" className="text-xs px-2 py-1 rounded border" onClick={() => onLoad(s)}>Load</button> | button_text
src/components/ScenarioDrawer.tsx:125:                    <button type="button" data-testid="scenario-share-btn" className="text-xs px-2 py-1 rounded border" onClick={() => onCopyLink(s)}>Copy Link</button> | button_text
src/components/ScenarioDrawer.tsx:126:                    <button type="button" data-testid="scenario-delete-btn" className="text-xs px-2 py-1 rounded border" onClick={() => { deleteScenario(s.id); setItems(listScenarios()); showToast('Deleted') }}>Delete</button> | button_text
src/components/Analysis.tsx:610:                        <button onClick={retry} className="mt-2 text-sm text-info hover:text-info font-medium pl-7">Try Again</button> | button_text
src/canvas/components/LayoutGuidedModal.tsx:24:              <button onClick={() => setDirection('LR')} className={direction === 'LR' ? 'flex-1 px-3 py-2 bg-[#EA7B4B] text-white rounded' : 'flex-1 px-3 py-2 bg-gray-100 rounded'}>Left → Right</button> | button_text
src/canvas/components/LayoutGuidedModal.tsx:25:              <button onClick={() => setDirection('TB')} className={direction === 'TB' ? 'flex-1 px-3 py-2 bg-[#EA7B4B] text-white rounded' : 'flex-1 px-3 py-2 bg-gray-100 rounded'}>Top → Bottom</button> | button_text
src/canvas/components/LayoutGuidedModal.tsx:29:            <button onClick={onClose} className="flex-1 px-4 py-2 border rounded">Cancel</button> | button_text
src/canvas/components/LayoutGuidedModal.tsx:30:            <button onClick={handleApply} className="flex-1 px-4 py-2 bg-[#EA7B4B] text-white rounded">Apply</button> | button_text
src/canvas/ui/NodeInspector.tsx:216:        <button onClick={onClose} className="text-text-light hover:text-text-body" aria-label="Close">×</button> | button_text
```

## 9. SECTION_HEADING (section_heading)

```
src/routes/PlotShowcase.tsx:413:                  <h3 className="text-lg font-semibold text-gray-900">Results</h3> | section_heading
src/routes/PlotShowcase.tsx:531:                <h3 className="text-lg font-semibold text-gray-900">Cognitive Biases</h3> | section_heading
src/routes/PlotShowcase.tsx:558:                <h3 className="text-lg font-semibold text-gray-900">Live Stream</h3> | section_heading
src/routes/PlotShowcase.tsx:583:                <h3 className="text-lg font-semibold text-gray-900 mb-3">Debug</h3> | section_heading
src/routes/PlotShowcase.tsx:593:              <h3 className="text-lg font-semibold text-gray-900 mb-4">Decision Graph</h3> | section_heading
src/routes/PlotShowcase.tsx:619:                <h3 className="text-lg font-semibold text-gray-900 mb-3">Graph Data (Text)</h3> | section_heading
src/routes/PlotShowcase.tsx:641:              <h3 className="text-lg font-semibold text-gray-900 mb-3">Whiteboard</h3> | section_heading
src/routes/PlotShowcase.tsx:660:              <h3 className="text-lg font-semibold text-gray-900 mb-4">Engine Audit</h3> | section_heading
src/routes/PlotShowcase.tsx:680:              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3> | section_heading
src/routes/PlotShowcase.tsx:686:              <h3 className="text-lg font-semibold text-gray-900 mb-4">Jobs Progress</h3> | section_heading
src/routes/templates/DecisionTemplates.tsx:189:              <h2 className="font-semibold mb-3">Run Configuration</h2> | section_heading
src/routes/templates/components/ReproduceShareCard.tsx:40:      <h3 className="text-lg font-semibold mb-4">Reproduce and share</h3> | section_heading
src/routes/templates/components/WhyPanel.tsx:16:      <h3 className="text-lg font-semibold mb-4">What's driving this result</h3> | section_heading
src/routes/PlcLab.tsx:59:        <h3 style={{ margin: 0 }}>PLC Lab is disabled</h3> | section_heading
src/routes/ShareView.tsx:138:            <h1 className="text-xl font-semibold text-gray-900">Share Links Coming Soon</h1> | section_heading
src/routes/ShareView.tsx:216:            <h1 className="text-xl font-semibold text-gray-900">Access Denied</h1> | section_heading
src/routes/ShareView.tsx:267:              <h1 className="text-xl font-semibold text-gray-900">Shared Analysis</h1> | section_heading
src/routes/ShareView.tsx:286:              <h2 className="text-lg font-semibold text-gray-900 mb-4">Graph Summary</h2> | section_heading
src/routes/ShareView.tsx:301:                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Nodes</h3> | section_heading
src/routes/ShareView.tsx:317:              <h2 className="text-lg font-semibold text-gray-900 mb-4">Drivers</h2> | section_heading
src/routes/SandboxV1.tsx:398:                  <h3 className="text-lg font-semibold text-gray-900">Results</h3> | section_heading
src/routes/SandboxV1.tsx:516:                <h3 className="text-lg font-semibold text-gray-900">Cognitive Biases</h3> | section_heading
src/routes/SandboxV1.tsx:543:                <h3 className="text-lg font-semibold text-gray-900">Live Stream</h3> | section_heading
src/routes/SandboxV1.tsx:568:                <h3 className="text-lg font-semibold text-gray-900 mb-3">Debug</h3> | section_heading
src/routes/SandboxV1.tsx:579:                <h3 className="text-lg font-semibold text-gray-900 mb-4">Decision Graph</h3> | section_heading
src/routes/SandboxV1.tsx:594:                <h3 className="text-lg font-semibold text-gray-900 mb-3">Graph Data (Text)</h3> | section_heading
src/routes/SandboxV1.tsx:616:              <h3 className="text-lg font-semibold text-gray-900 mb-4">Engine Audit</h3> | section_heading
src/routes/SandboxV1.tsx:636:              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3> | section_heading
src/routes/SandboxV1.tsx:642:              <h3 className="text-lg font-semibold text-gray-900 mb-4">Jobs Progress</h3> | section_heading
src/pages/ScenarioListPage.tsx:117:        <h3 className={`${typography.h4} text-text-header`}>Delete decision</h3> | section_heading
src/pages/ScenarioListPage.tsx:341:          <h1 className={`${typography.h3} text-text-header`}>Decisions</h1> | section_heading
src/pages/ScenarioListPage.tsx:372:            <h2 className={`${typography.h2} text-text-header`}>Welcome to Olumi</h2> | section_heading
src/pages/ScenarioListPage.tsx:389:              <h3 className={`${typography.h3} text-text-header`}>My decisions</h3> | section_heading
src/pages/ProfileSettingsPage.tsx:122:        <h1 className={`${typography.h3} text-text-header mb-8`}>Profile settings</h1> | section_heading
src/pages/ProfileSettingsPage.tsx:193:          <h2 className={`${typography.h4} text-danger mb-2`}>Danger zone</h2> | section_heading
src/pages/ProfileSettingsPage.tsx:218:            <h3 className={`${typography.h4} text-text-header mb-2`}>Delete your account?</h3> | section_heading
src/pages/SharedBriefPage.tsx:179:          <h1 className="text-xl font-semibold text-text-header">Brief not found</h1> | section_heading
src/pages/SharedBriefPage.tsx:194:          <h1 className="text-xl font-semibold text-text-header">Failed to load brief</h1> | section_heading
src/pages/SharedBriefPage.tsx:209:          <h1 className="text-lg font-semibold text-text-header">Shared decision brief</h1> | section_heading
src/components/ReversibilitySelector.tsx:85:        <h2 className="text-3xl font-bold text-gray-900 mb-4">Is this decision reversible?</h2> | section_heading
src/components/ReversibilitySelector.tsx:104:                <h3 className="font-semibold text-gray-900 mb-1">{label}</h3> | section_heading
src/modules/critique/CritiquePanel.tsx:13:      <div className="px-4 py-3 border-b"><h3 className="font-semibold">Critique</h3></div> | section_heading
src/components/decisions/DecisionEdit.tsx:221:              <h3 className="text-lg font-semibold mb-4">Options Analysis</h3> | section_heading
src/pages/sandbox-guide/components/shared/HelpModal.tsx:91:            <h3 className="text-sm font-semibold text-charcoal-900 mb-2">Shortcuts</h3> | section_heading
src/pages/sandbox-guide/components/shared/HelpModal.tsx:106:            <h3 className="text-sm font-semibold text-charcoal-900 mb-2">Quick Tips</h3> | section_heading
src/components/ImportanceSelector.tsx:107:                <h3 className="font-semibold text-gray-900 mb-1">{label}</h3> | section_heading
src/components/decisions/DecisionList.tsx:302:          <h2 className="text-2xl font-bold text-gray-900">Your Decisions</h2> | section_heading
src/components/decisions/DecisionList.tsx:325:            <h3 className="text-lg font-medium text-danger mb-2">Error loading decisions</h3> | section_heading
src/components/decisions/DecisionList.tsx:348:          <h2 className="text-2xl font-bold text-gray-900">Your Decisions</h2> | section_heading
src/components/decisions/DecisionList.tsx:360:            <h3 className="text-lg font-medium text-gray-900 mb-2">No decisions yet</h3> | section_heading
src/components/decisions/DecisionList.tsx:372:              <h4 className="text-sm font-medium text-gray-700 mb-3">Getting Started Tips</h4> | section_heading
src/components/decisions/DecisionList.tsx:400:          <h2 className="text-2xl font-bold text-gray-900">Your Decisions</h2> | section_heading
src/pages/sandbox-guide/components/shared/CopilotErrorBoundary.tsx:54:            <h2 className="text-xl font-semibold text-charcoal-900">Something went wrong</h2> | section_heading
src/plotLite/GhostPanel.tsx:31:                <h3 style={{ margin: '8px 0 4px' }}>{sev}</h3> | section_heading
src/pages/sandbox-guide/components/panel/states/PreRunReadyState.tsx:44:        <h2 className="text-xl font-semibold text-charcoal-900">Ready to Analyze</h2> | section_heading
src/modules/results/ResultsSummary.tsx:23:        <h3 className="text-lg font-semibold text-gray-900">Results Summary</h3> | section_heading
src/pages/sandbox-guide/components/panel/states/PostRunState.tsx:52:          <h2 className="text-xl font-semibold text-charcoal-900">Analysis Incomplete</h2> | section_heading
src/pages/sandbox-guide/components/panel/states/PostRunState.tsx:115:            <h2 className="text-xl font-semibold text-charcoal-900">Analysis Complete</h2> | section_heading
src/components/BiasesCarousel/BiasCard.tsx:24:              <h3 className="text-lg font-medium text-gray-900">{name}</h3> | section_heading
src/components/BiasesCarousel/BiasCard.tsx:36:                <h4 className="text-sm font-medium text-gray-700 mb-2">Definition</h4> | section_heading
src/components/BiasesCarousel/BiasCard.tsx:45:                <h4 className="text-sm font-medium text-gray-700 mb-2">How to Mitigate</h4> | section_heading
src/pages/sandbox-guide/components/panel/states/EmptyState.tsx:36:        <h2 className="text-xl font-semibold text-charcoal-900">Getting Started</h2> | section_heading
src/pages/sandbox-guide/components/panel/states/EmptyState.tsx:154:            <h3 className="font-medium text-charcoal-900">{title}</h3> | section_heading
src/pages/sandbox-guide/components/panel/states/BuildingState.tsx:74:        <h2 className="text-xl font-semibold text-charcoal-900">Building Your Model</h2> | section_heading
src/pages/sandbox-guide/components/panel/states/PreRunBlockedState.tsx:22:        <h2 className="text-xl font-semibold text-charcoal-900">Cannot Run Analysis</h2> | section_heading
src/pages/sandbox-guide/components/panel/sections/SeverityStyledCritiques.tsx:95:      <h3 className="text-sm font-semibold text-storm-900">Issues & Recommendations</h3> | section_heading
src/pages/sandbox-guide/components/panel/states/InspectorState.tsx:39:          <h2 className="text-xl font-semibold text-charcoal-900">Inspector</h2> | section_heading
src/pages/sandbox-guide/components/panel/states/InspectorState.tsx:62:            <h2 className="text-xl font-semibold text-charcoal-900">Node Details</h2> | section_heading
src/pages/sandbox-guide/components/panel/states/InspectorState.tsx:144:            <h2 className="text-xl font-semibold text-charcoal-900">Connection Details</h2> | section_heading
src/components/GoalClarificationScreen.tsx:97:          <h2 className="text-3xl font-bold mb-2">What are your goals?</h2> | section_heading
src/poc/AppPoC.tsx:528:                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Simulated Stream</h3> | section_heading
src/poc/AppPoC.tsx:572:                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Fetch Flow (Real Engine)</h3> | section_heading
src/poc/AppPoC.tsx:617:                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Scenario Sandbox (PoC)</h3> | section_heading
src/poc/AppPoC.tsx:711:                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Results</h4> | section_heading
src/poc/AppPoC.tsx:765:                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Decision Graph</h4> | section_heading
src/poc/AppPoC.tsx:778:                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Live Stream</h4> | section_heading
src/poc/AppPoC.tsx:798:                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Sandbox Stream Panel</h3> | section_heading
src/poc/AppPoC.tsx:807:                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Engine Audit Panel</h3> | section_heading
src/poc/AppPoC.tsx:816:                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Whiteboard</h3> | section_heading
src/poc/AppPoC.tsx:829:                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Real Components</h3> | section_heading
src/poc/AppPoC.tsx:846:                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Decision Graph (Fallback)</h3> | section_heading
src/components/About.tsx:28:            <h3 className="text-xl font-semibold text-gray-900">The Challenge</h3> | section_heading
src/components/About.tsx:42:            <h3 className="text-xl font-semibold text-gray-900">Our Solution</h3> | section_heading
src/components/About.tsx:61:            <h3 className="text-lg font-semibold text-gray-900 mb-2">Science-backed</h3> | section_heading
src/components/About.tsx:71:            <h3 className="text-lg font-semibold text-gray-900 mb-2">Bias mitigation</h3> | section_heading
src/components/About.tsx:81:            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-powered</h3> | section_heading
src/components/About.tsx:91:            <h3 className="text-lg font-semibold text-gray-900 mb-2">Personalised guidance</h3> | section_heading
src/components/layout/RightPanel.tsx:25:          {title && <h2 className={styles.title}>{title}</h2>} | section_heading
src/pages/sandbox-guide/components/panel/sections/BiasMitigation.tsx:85:      <h3 className="text-sm font-semibold text-storm-900">Suggested Fixes</h3> | section_heading
src/components/JobsProgressPanel.tsx:63:      <h2 id="jobs-hdr" className="font-semibold mb-2">Jobs</h2> | section_heading
src/pages/sandbox-guide/components/panel/sections/TopDriversSection.tsx:49:        <h3 className="text-sm font-semibold text-charcoal-900 mb-3">🎯 Top Drivers</h3> | section_heading
src/canvas/DiagnosticsOverlay.tsx:72:        <h3 className="font-bold text-sm">Diagnostics</h3> | section_heading
src/components/Analysis.tsx:600:            <h3 className="text-lg font-semibold mb-2">AI Analysis</h3> | section_heading
src/components/Analysis.tsx:620:            <h3 className="text-lg font-semibold mb-4">Options Analysis</h3> | section_heading
src/components/Analysis.tsx:629:              <h3 className="text-lg font-semibold text-gray-900">Collaboration Hub</h3> | section_heading
src/components/Analysis.tsx:637:                  <h4 className="text-md font-medium text-gray-800 mb-3">Current Collaborators</h4> | section_heading
src/components/Analysis.tsx:673:                  <h4 className="text-md font-medium text-gray-800 mb-3">Invite Collaborators</h4> | section_heading
src/components/Analysis.tsx:723:                  <h4 className="text-md font-medium text-gray-800 mb-3">Collaboration Settings</h4> | section_heading
src/components/CanvasDrawer.tsx:212:          <h2 className="font-semibold text-base">Canvas</h2> | section_heading
src/components/CriteriaForm.tsx:99:      <h2 className="text-2xl font-bold">Define criteria and weights</h2> | section_heading
src/components/SandboxStreamPanel.tsx:190:            <h2 className="font-semibold">Results Summary</h2> | section_heading
src/components/SandboxStreamPanel.tsx:1062:              <h2 className="font-semibold">Keyboard shortcuts</h2> | section_heading
src/canvas/share/ShareDrawer.tsx:188:        <h2 className="text-lg font-semibold text-gray-900 mb-4">Share Analysis</h2> | section_heading
src/components/InviteCollaborators.tsx:50:          <h2 className="text-lg font-medium text-gray-900">Invite Collaborators</h2> | section_heading
src/components/KeyboardShortcuts.tsx:44:          <h2 className="text-xl font-bold text-gray-900">Keyboard Shortcuts</h2> | section_heading
src/components/KeyboardShortcuts.tsx:57:              <h3 className="text-sm font-semibold text-info mb-2">{section.category}</h3> | section_heading
src/canvas/ErrorBoundary.tsx:238:                <h2 className="text-xl font-bold text-text-header">Something went wrong</h2> | section_heading
src/canvas/documents/DocumentsDrawer.tsx:25:        <h2 className={`${typography.h4} text-gray-900`}>Documents</h2> | section_heading
src/components/auth/SignUpForm.tsx:123:          <h2 className="text-3xl font-bold mb-6">Create your account</h2> | section_heading
src/components/auth/SignUpForm.tsx:138:                  <h3 className="text-sm font-medium text-danger">Sign up failed</h3> | section_heading
src/canvas/ReactFlowGraph.tsx:2120:            <h2 className="font-semibold text-gray-900">Documents</h2> | section_heading
src/components/CollaborativeOptions/MergeOptionsModal.tsx:30:          <h2 className="text-lg font-semibold">Merge Options</h2> | section_heading
src/canvas/panels/_shared/PanelShell.tsx:95:          <h3 className={`${typography.panelHeader} text-ink-900`}>{title}</h3> | section_heading
src/components/CollaborativeOptions/index.tsx:79:          <h3 className="font-medium text-danger">Error loading options</h3> | section_heading
src/canvas/provenance/ProvenanceHub.tsx:55:        <h2 className="text-lg font-semibold text-gray-900">Provenance Hub</h2> | section_heading
src/components/auth/ProfileForm.tsx:105:            <h2 className="text-lg font-medium text-gray-900">Profile Information</h2> | section_heading
src/components/teams/TeamDetails.tsx:40:            <h3 className="font-medium text-danger">Error loading team</h3> | section_heading
src/components/teams/TeamDetails.tsx:73:          <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1> | section_heading
src/components/teams/TeamDetails.tsx:95:          <h2 className="text-lg font-medium text-gray-900 mb-2">About</h2> | section_heading
src/components/teams/TeamDetails.tsx:104:          <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3> | section_heading
src/components/teams/TeamDetails.tsx:120:            <h2 className="text-lg font-medium text-gray-900">Members</h2> | section_heading
src/canvas/panels/IssuesPanel.tsx:55:          <h3 className="font-semibold text-slate-900">Graph Issues</h3> | section_heading
src/components/auth/SignUpConfirmation.tsx:16:        <h2 className="mt-6 text-3xl font-bold text-gray-900">Account Created!</h2> | section_heading
src/components/OnboardingHints.tsx:29:            <h3 className="font-semibold text-gray-900">Welcome to Plot!</h3> | section_heading
src/components/EngineAuditPanel.tsx:48:        <h2 className="font-semibold text-ink-900">Engine Audit</h2> | section_heading
src/components/ConfigDrawer.tsx:120:        <h2 className="font-semibold text-base mb-2">Settings</h2> | section_heading
src/canvas/components/InsightsTab.tsx:86:              <h3 className={typography.h3}>Decision Health</h3> | section_heading
src/canvas/components/InsightsTab.tsx:109:              <h4 className={typography.h4}>Priority Actions</h4> | section_heading
src/canvas/components/InsightsTab.tsx:183:      <h4 className={typography.h4}>Cross-Market Validation</h4> | section_heading
src/components/Analysis/utils/formatAnalysis.tsx:174:                    <h4 className="font-medium text-warning">Warning</h4> | section_heading
src/components/Analysis/utils/formatAnalysis.tsx:187:                    <h4 className="font-medium text-info">Information</h4> | section_heading
src/components/Analysis/utils/formatAnalysis.tsx:200:                    <h4 className="font-medium text-success">Success</h4> | section_heading
src/canvas/components/DecisionReviewPanel.tsx:577:            <h3 className={`${typography.label} text-sun-900 mb-1`}>{headline}</h3> | section_heading
src/canvas/components/DecisionReviewPanel.tsx:784:        <h3 className={`${typography.label} text-sun-900 mb-1`}>{headline}</h3> | section_heading
src/components/auth/ResetPasswordForm.tsx:127:          <h2 className="text-3xl font-bold text-gray-900">Password Reset Complete</h2> | section_heading
src/components/auth/ResetPasswordForm.tsx:139:        <h2 className="text-center text-3xl font-bold text-gray-900">Reset Your Password</h2> | section_heading
src/components/auth/ResetPasswordForm.tsx:151:                <h3 className="text-sm font-medium text-danger">Reset failed</h3> | section_heading
src/canvas/components/SnapshotManager.tsx:193:                    <h3 className="font-medium text-gray-900">{snapshot.name}</h3> | section_heading
src/components/ResultsPanel.tsx:74:          <h3 className="text-lg font-semibold text-gray-900 mb-3">Results</h3> | section_heading
src/components/ResultsPanel.tsx:86:          <h3 className="text-base font-semibold text-gray-900">Results</h3> | section_heading
src/components/ResultsPanel.tsx:158:          <h3 className="text-base font-semibold text-gray-900 mb-3">Thresholds</h3> | section_heading
src/components/ResultsPanel.tsx:184:            <h3 className="text-base font-semibold text-gray-900">Biases</h3> | section_heading
src/components/auth/LoginForm.tsx:121:          <h2 className="text-3xl font-bold mb-6">Welcome back</h2> | section_heading
src/components/auth/LoginPage.tsx:96:        <h3 className={`${typography.h3} text-text-header mb-1`}>Sign in to Olumi</h3> | section_heading
src/components/assistants/OptionsTiles.tsx:71:          <h3 className="text-sm font-semibold text-gray-900">Decision Options</h3> | section_heading
src/components/auth/ForgotPasswordForm.tsx:53:          <h2 className="text-3xl font-bold text-gray-900">Check Your Email</h2> | section_heading
src/components/auth/ForgotPasswordForm.tsx:79:        <h2 className="text-center text-3xl font-bold text-gray-900">Reset Password</h2> | section_heading
src/components/auth/ForgotPasswordForm.tsx:91:                <h3 className="text-sm font-medium text-danger">Reset failed</h3> | section_heading
src/components/assistants/ProvenanceChip.tsx:85:            <h4 className="font-medium text-sm text-gray-900">Document Sources</h4> | section_heading
src/components/assistants/DiffViewer.tsx:72:        <h3 className="font-semibold text-gray-900">Review Draft Changes</h3> | section_heading
src/canvas/components/LayoutOptionsPanel.tsx:85:        <h3 className="text-lg font-semibold text-gray-900">Layout Options</h3> | section_heading
src/components/assistants/ClarifierPanel.tsx:101:          <h3 className="font-semibold text-info">Help us clarify your model</h3> | section_heading
src/canvas/components/LimitsPanel.tsx:87:          <h3 className={`${typography.h4} text-ink-900 mb-2`}>Limits Unavailable</h3> | section_heading
src/components/results/ImprovementsSection.tsx:127:          <h3 className={`${typography.panelHeader} text-text-body`}>Strengthen your analysis</h3> | section_heading
src/canvas/components/ScenarioComparison.tsx:53:            <h3 className="font-semibold text-gray-900">Compare Scenarios</h3> | section_heading
src/canvas/components/ScenarioComparison.tsx:184:              <h4 className="font-medium text-info">{snapshotA.name}</h4> | section_heading
src/canvas/components/ScenarioComparison.tsx:210:              <h4 className="font-medium text-mint-900">{snapshotB.name}</h4> | section_heading
src/canvas/components/CompareView.tsx:83:        <h2 className="text-lg font-semibold text-gray-900">Compare Runs</h2> | section_heading
src/canvas/components/CompareView.tsx:132:              <h3 className={`${typography.label} text-gray-700 mb-3`}>Top 5 Edge Differences</h3> | section_heading
src/canvas/components/CompareView.tsx:137:              <h3 className={`${typography.label} text-gray-700 mb-2`}>Decision Rationale</h3> | section_heading
src/components/ProsConsList/ScoreComparison.tsx:67:              <h2 className="text-xl font-semibold text-gray-900">Decision Analysis</h2> | section_heading
src/components/ProsConsList/ScoreComparison.tsx:83:            <h3 className="text-lg font-medium text-gray-900 mb-4">Summary</h3> | section_heading
src/components/ProsConsList/ScoreComparison.tsx:93:                    <h4 className="font-medium text-gray-900">{score.name}</h4> | section_heading
src/components/ProsConsList/ScoreComparison.tsx:131:            <h3 className="text-lg font-medium text-gray-900 mb-4">Detailed Comparison</h3> | section_heading
src/components/ProsConsList/ScoreComparison.tsx:232:              <h4 className="text-sm font-medium text-gray-900 mb-3">How to Read This Analysis</h4> | section_heading
src/canvas/components/OnboardingOverlay.tsx:119:                <h3 className="font-semibold text-gray-900 mb-1">Browse templates</h3> | section_heading
src/canvas/components/OnboardingOverlay.tsx:136:                <h3 className="font-semibold text-gray-900 mb-1">Create from scratch</h3> | section_heading
src/canvas/components/OnboardingOverlay.tsx:153:                <h3 className="font-semibold text-gray-900 mb-1">Learn shortcuts</h3> | section_heading
src/canvas/components/OnboardingOverlay.tsx:163:            <h3 className={`${typography.label} text-gray-700 mb-3`}>Essential shortcuts</h3> | section_heading
src/components/ProsConsList/AddOptionModal.tsx:23:          <h3 className="text-lg font-medium text-gray-900">Add New Option</h3> | section_heading
src/components/OptionsIdeation.tsx:145:            <h2 className="text-3xl font-bold text-center">Your Options</h2> | section_heading
src/components/OptionsIdeation.tsx:153:                    <h3 className="font-medium">{opt.label}</h3> | section_heading
src/components/OptionsIdeation.tsx:221:            <h3 className="text-lg font-medium">Cognitive Biases to Watch</h3> | section_heading
src/canvas/components/ConformalPrediction.tsx:55:        <h3 className={typography.h4}>Confidence Intervals</h3> | section_heading
src/components/ScenarioDrawer.tsx:89:        <h2 className="font-semibold text-base mb-2 text-ink-900">Scenarios</h2> | section_heading
src/canvas/components/GuidancePanel.tsx:241:        <h3 className={`${typography.h4} text-text-body mb-1`}>Looking good!</h3> | section_heading
src/canvas/components/ScenarioSwitcher.tsx:377:            <h3 className={`${typography.h4} text-gray-900 mb-4`}>Save scenario</h3> | section_heading
src/canvas/components/ScenarioSwitcher.tsx:421:            <h3 className={`${typography.h4} text-gray-900 mb-4`}>Rename scenario</h3> | section_heading
src/canvas/components/GoalModePanel.tsx:62:            <h3 className={typography.h3}>Goal Mode</h3> | section_heading
src/canvas/components/GoalModePanel.tsx:140:              <h4 className={typography.h4}>Recommended Path</h4> | section_heading
src/canvas/components/ImportExportDialog.tsx:316:                  <h3 className="font-medium text-gray-900 mb-2">Validation Issues</h3> | section_heading
src/canvas/ui/NodeInspectorCompact.tsx:283:          <h4 className={`${typography.panelMeta} text-text-body mb-2`}>Interventions</h4> | section_heading
src/components/teams/CreateTeamModal.tsx:44:          <h2 className="text-lg font-medium text-gray-900">Create New Team</h2> | section_heading
src/canvas/components/InputsDock.tsx:305:          <h2 className={`${typography.label} text-ink-900 uppercase tracking-wide`}>Limits and health</h2> | section_heading
src/canvas/components/RiskProfileSelector.tsx:267:                <h4 className={`${typography.label} text-ink-800`}>{profile.label}</h4> | section_heading
src/components/teams/ManageTeamMembersModal.tsx:219:          <h2 className="text-lg font-semibold">Manage Team Members</h2> | section_heading
src/components/teams/UserDirectoryTab.tsx:112:                  <h4 className="font-medium text-gray-900">{selectedUser.email}</h4> | section_heading
src/canvas/components/ComparisonCanvasLayout.tsx:404:          <h2 className={`${typography.h4} text-ink-900`}>Scenario Comparison</h2> | section_heading
src/components/ProsConsList/components/EmptyState.tsx:13:      <h4 className="text-lg font-medium text-gray-900 mb-2">No Options Added Yet</h4> | section_heading
src/components/teams/MyTeams.tsx:39:          <h3 className="font-medium text-gray-900">{team.name}</h3> | section_heading
src/components/teams/MyTeams.tsx:130:            <h3 className="font-medium text-danger">Error loading teams</h3> | section_heading
src/components/teams/MyTeams.tsx:144:        <h1 className="text-2xl font-bold text-gray-900">My Teams</h1> | section_heading
src/components/teams/MyTeams.tsx:157:          <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3> | section_heading
src/canvas/components/DevControls.tsx:42:            <h4 className={`${typography.caption} font-semibold text-gray-700`}>Developer Controls</h4> | section_heading
src/components/ProsConsList/OptionColumn.tsx:170:                <h5 className="font-medium text-gray-900">Pros</h5> | section_heading
src/components/ProsConsList/OptionColumn.tsx:244:                <h5 className="font-medium text-gray-900">Cons</h5> | section_heading
src/canvas/components/ProvenanceHubTab.tsx:63:          <h3 className="font-semibold text-gray-900">Provenance Hub</h3> | section_heading
src/canvas/components/DocumentsManager.tsx:111:        <h3 className={`${typography.body} font-semibold text-ink-900`}>Documents</h3> | section_heading
src/canvas/components/StructuralHealth.tsx:21:        <h3 className={typography.h4}>Structural Health</h3> | section_heading
src/canvas/components/StructuralHealth.tsx:36:      <h3 className={typography.h4}>Structural Health</h3> | section_heading
src/components/teams/EditTeamModal.tsx:45:          <h2 className="text-lg font-medium text-gray-900">Edit Team</h2> | section_heading
src/canvas/components/SettingsPanel.tsx:44:        <h3 className="text-lg font-semibold text-gray-900">Settings</h3> | section_heading
src/canvas/ui/EdgeInspector.tsx:225:        <h3 className={`${typography.panelHeader} text-text-header`}>Connection</h3> | section_heading
src/canvas/components/KeyboardMap.tsx:83:            <h3 className={styles.sectionTitle}>Actions</h3> | section_heading
src/canvas/components/KeyboardMap.tsx:103:            <h3 className={styles.sectionTitle}>Editing</h3> | section_heading
src/canvas/components/KeyboardMap.tsx:123:            <h3 className={styles.sectionTitle}>Navigation</h3> | section_heading
src/canvas/components/ValidationSuggestions.tsx:97:        <h3 className={typography.h4}>Validation</h3> | section_heading
src/canvas/components/ValidationSuggestions.tsx:122:              <h4 className={typography.label}>Suggestions ({data.suggestions.length})</h4> | section_heading
src/canvas/components/KeyboardCheatsheet.tsx:84:          <h2 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h2> | section_heading
src/canvas/components/pre-analysis/ModelNotes.tsx:47:        <h3 className={typography.panelHeader}>Model notes</h3> | section_heading
src/canvas/components/ModelCardLite.tsx:97:      <h3 className={`${typography.panelHeader} mb-2`}>Model card</h3> | section_heading
src/canvas/components/ComparisonTable.tsx:48:        <h3 className={typography.h4}>Scenario Comparison</h3> | section_heading
```

## 10. BADGE_PILL (badge_pill)

```
src/routes/ShareView.tsx:129:  // Fail-closed: if feature flag not enabled, show "coming soon" immediately | badge_pill
src/pages/sandbox-guide/components/toolbar/CopilotBottomToolbar.tsx:67:            Chat interface coming soon... | badge_pill
src/pages/sandbox-guide/components/panel/states/EmptyState.tsx:58:          badge="Coming soon" | badge_pill
src/pages/sandbox-guide/components/panel/states/EmptyState.tsx:66:          badge="Coming soon" | badge_pill
src/canvas/conversation/dropdowns/ThinkingModeDropdown.tsx:5: * goal diamond = Deep). "Coming soon" badge. Only Normal is interactive. | badge_pill
src/canvas/conversation/dropdowns/ThinkingModeDropdown.tsx:164:          Coming soon | badge_pill
src/canvas/components/ThinkingModePopover.tsx:110:          Coming soon | badge_pill
src/components/SandboxStreamPanel.tsx:1386:            <div className="text-xs text-gray-600">Coming soon</div> | badge_pill
src/components/ChatBox.tsx:26:            Coming soon! | badge_pill
src/canvas/components/AdvancedSettingsPanel.tsx:199:                <span className="sr-only">Structural uncertainty (coming soon)</span> | badge_pill
src/canvas/components/OutputsDock.tsx:1483:                      window.alert('Decision confirmed. Decision brief coming soon.') // eslint-disable-line no-alert | badge_pill
src/canvas/components/ResultsPanel/EvidencePackExport.tsx:103:          onExportError?.('PDF export coming soon') | badge_pill
src/canvas/components/ResultsPanel/EvidencePackExport.tsx:214:        {/* PDF Export (coming soon) */} | badge_pill
src/canvas/components/ResultsPanel/EvidencePackExport.tsx:226:            Coming soon | badge_pill
src/components/GoalClarificationScreen.tsx:88:              onClick={() => alert('Coming soon!')} | badge_pill

src/canvas/conversation/InlineBlocks.tsx:663:            <span key={i} className={styles.framingOptionPill}>{opt}</span> | badge_pill
src/canvas/conversation/InlineBlocks.tsx:1338:              <span className={`${typography.panelMeta} ${styles.outlinedPill}`}>Influence: {Math.round(rp.influence * 100)}%</span> | badge_pill
src/canvas/conversation/InlineBlocks.tsx:1341:              <span className={`${typography.panelMeta} ${styles.outlinedPill}`}>{rp.likelihood}</span> | badge_pill
src/canvas/conversation/InlineBlocks.tsx:1404:                  <span className={`${typography.panelMeta} ${styles.outlinedPill}`}>{c.operation}</span> | badge_pill
src/canvas/conversation/InlineBlocks.tsx:1460:        <span className={`${typography.panelMeta} ${styles.outlinedPill}`}>{block.exercise_type}</span> | badge_pill
src/canvas/components/pre-analysis/expertise/AiEstimated.tsx:79:            <Pill size="small" variant="warning">Estimated</Pill> | badge_pill
src/canvas/components/pre-analysis/OptionPreview.tsx:230:          <Pill size="small" variant="success">{options.length}</Pill> | badge_pill
src/canvas/components/pre-analysis/OptionPreview.tsx:260:                    <Pill size="small" variant="success">Ready</Pill> | badge_pill
src/canvas/components/pre-analysis/OptionPreview.tsx:262:                    <Pill size="small" variant="danger">Needs mapping</Pill> | badge_pill
src/canvas/components/pre-analysis/expertise/ContestedRelationships.tsx:102:                <Pill size="small" variant="warning">High impact</Pill> | badge_pill
src/canvas/components/pre-analysis/expertise/ContestedRelationships.tsx:105:                <Pill size="small" variant="default">Moderate impact</Pill> | badge_pill
src/canvas/components/pre-analysis/DecisionQualityChecks.tsx:121:      <Pill size="small" variant="danger">Validity</Pill> | badge_pill
src/canvas/components/pre-analysis/DecisionQualityChecks.tsx:125:      <Pill size="small" variant="info">Coverage</Pill> | badge_pill
src/canvas/components/pre-analysis/DecisionQualityChecks.tsx:271:            <Pill size="small" variant="warning">{displayCount}</Pill> | badge_pill
src/canvas/components/pre-analysis/DecisionQualityChecks.tsx:384:        <Pill size="small" variant="default">Verify</Pill> | badge_pill
src/canvas/components/pre-analysis/expertise/YourExpertise.tsx:113:            <Pill size="small" variant="default">{badgeCount}</Pill> | badge_pill
src/canvas/components/pre-analysis/SuccessTarget.tsx:289:                <Pill size="small" variant="success">From brief</Pill> | badge_pill
src/canvas/components/pre-analysis/SuccessTarget.tsx:356:          <Pill size="small" variant="success">From brief</Pill> | badge_pill
src/canvas/components/pre-analysis/SuccessTarget.tsx:359:          <Pill size="small" variant="warning">Estimated</Pill> | badge_pill
src/canvas/components/pre-analysis/SuccessTarget.tsx:439:              <Pill size="small" variant="success">From brief</Pill> | badge_pill
src/canvas/components/pre-analysis/expertise/FromBrief.tsx:50:          <Pill size="small" variant="success">From brief</Pill> | badge_pill
```

## 11. LOADING_STATUS (loading_status) — user-visible only

```
src/routes/PlotShowcase.tsx:594:              <Suspense fallback={<div className="text-gray-500">Loading canvas...</div>}> | loading_status
src/routes/SandboxV1.tsx:580:                <Suspense fallback={<div className="text-gray-500">Loading canvas...</div>}> | loading_status
src/canvas/conversation/dropdowns/ThinkingModeDropdown.tsx:153:        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-header, #262626)' }}>Thinking mode</span> | loading_status
src/main.tsx:101:      <div style={{ opacity: .7, marginTop: 4 }}>Loading application…</div> | loading_status
src/poc/AppPoC.tsx:799:                  <Suspense fallback={<div>Loading...</div>}> | loading_status
src/poc/AppPoC.tsx:808:                  <Suspense fallback={<div>Loading...</div>}> | loading_status
src/poc/AppPoC.tsx:820:                  <Suspense fallback={<div>Loading...</div>}> | loading_status
src/components/BiasesCarousel/index.tsx:44:            <span className="text-gray-600">Loading cognitive biases...</span> | loading_status
src/pages/sandbox-guide/components/panel/states/CompareState.tsx:143:        <div className="text-sm text-storm-600">Loading comparison data...</div> | loading_status
src/canvas/components/InsightsTab.tsx:78:          <span className={typography.body}>Analysing decision...</span> | loading_status
src/components/debug/tabs/LLMCallsTab.tsx:396:                            {call.thinking_enabled != null && <span><strong>Thinking:</strong> {call.thinking_enabled ? 'yes' : 'no'}</span>} | loading_status
src/canvas/components/SaveStatusPill.tsx:59:        <span>Saving…</span> | loading_status
src/components/layout/TopBar.tsx:325:            <span>Saving…</span> | loading_status
src/components/layout/TopBar.tsx:437:                <span>Saving...</span> | loading_status
src/canvas/components/InputsDock.tsx:288:        <p className={`${typography.code} text-ink-900 font-medium`}>Loading limits…</p> | loading_status
src/components/Analysis.tsx:559:            {saveInProgress ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving... </> ) : ( 'Save and Finalize Analysis' )} | loading_status
src/components/Analysis.tsx:572:           ) : collaboratorsLoading ? ( <div className="flex items-center text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading collaborators...</div> | loading_status
src/components/Analysis.tsx:601:            {analysisLoading || optionsLoading ? ( <div className="flex items-center justify-center p-8 text-gray-500"><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading Analysis Data...</div> | loading_status
src/components/Analysis.tsx:641:                      <span className="text-gray-500">Loading collaborators...</span> | loading_status
src/canvas/components/LimitsPanel.tsx:109:          <p className={`${typography.body} text-ink-900/70`}>Loading limits...</p> | loading_status
src/canvas/components/ResultsSkeleton.tsx:42:      <span className="sr-only">Analysing decision graph...</span> | loading_status
src/canvas/ErrorBoundary.tsx:213:              <span>Running in degraded mode after an error. Some features may not work.</span> | loading_status
src/components/auth/ProtectedRoute.tsx:30:          <p className="text-gray-600">Loading...</p> | loading_status
src/canvas/components/TemplateSkeleton.tsx:32:      <span className="sr-only">Loading templates...</span> | loading_status
src/canvas/ReactFlowGraph.tsx:2101:        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/20"><div className="text-sm text-white">Loading...</div></div>}> | loading_status
src/canvas/ReactFlowGraph.tsx:2162:          <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="text-sm text-gray-500">Loading...</div></div>}> | loading_status
src/canvas/components/ResultsPanelSkeleton.tsx:238:      <span className="sr-only">Loading analysis results, please wait...</span> | loading_status
src/components/teams/ManageTeamMembersModal.tsx:377:                  <span>Loading invitations…</span> | loading_status
src/components/LoadingSpinner.tsx:9:        <p className="text-gray-600 text-lg">Loading...</p> | loading_status
src/canvas/panels/AIClarifierChat.tsx:244:              <span>Thinking...</span> | loading_status
src/components/decisions/DecisionForm.tsx:367:                <span>Analyzing...</span> | loading_status
```

## 12. ERROR_MESSAGE (error_message) — non-test files only

```
src/pages/ProfileSettingsPage.tsx:55:      setFeedback({ type: 'error', message: 'Failed to save. Please try again.' }) | error_message
src/pages/ProfileSettingsPage.tsx:57:      setFeedback({ type: 'success', message: 'Settings saved.' }) | error_message
src/pages/ProfileSettingsPage.tsx:69:        setFeedback({ type: 'error', message: 'Session expired. Please sign in again.' }) | error_message
src/test/fixtures/golden-expectations.ts:197:      message: '43% of relationships lack supporting evidence', | error_message
src/test/fixtures/golden-expectations.ts:209:      message: 'Competitor response not modeled', | error_message
src/pages/sandbox-guide/components/topbar/CopilotTopBar.tsx:64:        message: 'Analysis failed - please try again', | error_message
src/pages/sandbox-guide/components/topbar/CopilotTopBar.tsx:71:        message: 'Running analysis...', | error_message
src/hooks/useAsk.ts:430:        message: 'Request was cancelled.', | error_message
src/components/shared/ScientificEditor.tsx:78:  if (mean < -1 || mean > 1) errors.push({ field: 'mean', message: 'Must be between -1 and 1' }) | error_message
src/components/shared/ScientificEditor.tsx:79:  if (std < 0.05 || std > 0.35) errors.push({ field: 'std', message: 'Must be between 0.05 and 0.35' }) | error_message
src/components/shared/ScientificEditor.tsx:82:  if (std > Math.abs(mean) && mean !== 0) errors.push({ field: 'std', message: 'Must not exceed |mean|' }) | error_message
src/components/shared/ScientificEditor.tsx:83:  if (ep < 0 || ep > 1) errors.push({ field: 'existsProbability', message: 'Must be between 0 and 1' }) | error_message
src/components/debug/utils/exportBundle.ts:1485:        truncation_message: 'Large graph — arrays capped at 100 items', | error_message
src/components/auth/ResetPasswordForm.tsx:110:            message: 'Password reset successful. Please sign in with your new password.' | error_message
src/adapters/cee/client.ts:684:    useGateStore.getState().setGate('graph_readiness', 'pass', { message: 'Draft graph received' }) | error_message
src/adapters/cee/client.ts:796:      message: 'Real-time feedback is temporarily unavailable.', | error_message
src/poc/safe/safe-entry.ts:14:      message: 'safe-screen:shown' | error_message
src/adapters/assistants/http.ts:52:    message: 'Request timed out. Please try again.', | error_message
src/adapters/assistants/http.ts:62:    message: 'Connection lost. Check your internet and try again.', | error_message
src/adapters/assistants/http.ts:222:      message: 'No response body', | error_message
src/adapters/isl/client.ts:149:    useGateStore.getState().setGate('validation', 'pass', { message: 'Graph validated' }) | error_message
src/adapters/plot/enrichment.ts:594:        message: 'Causal effect is not identifiable from the current graph structure. Consider adding instrumental variables or adjusting for confounders.', | error_message
src/lib/responseNormalisation.ts:438:      message: 'All options produce nearly identical outcomes.', | error_message
src/adapters/plot/httpV1Adapter.ts:528:          message: 'Invalid templates response from server', | error_message
src/adapters/plot/mockAdapter.ts:301:              headline: 'Mock Decision Review', | error_message
src/lib/errors.ts:22:      return { message: 'The request took too long to respond.', primaryAction: 'Try again' } | error_message
src/lib/errors.ts:24:      return { message: 'A temporary issue occurred.', primaryAction: 'Try again' } | error_message
src/lib/errors.ts:26:      return { message: 'Something went wrong on our side.', primaryAction: 'Try again' } | error_message
src/lib/errors.ts:28:      return { message: 'Please check your input and try again.', primaryAction: 'Check input' } | error_message
src/lib/errors.ts:30:      return { message: 'You have reached the limit. Please wait and retry.', primaryAction: 'Wait and retry' } | error_message
src/lib/errors.ts:32:      return { message: 'The service is temporarily unavailable. Please wait and retry.', primaryAction: 'Wait and retry' } | error_message
src/lib/errors.ts:34:      return { message: 'We could not complete your request.', primaryAction: 'Try again' } | error_message
src/lib/gate-state.ts:292:    setGate('robustness', 'pass', { message: 'Full sensitivity analysis complete' }) | error_message
src/lib/gate-state.ts:294:    setGate('robustness', 'warn', { message: 'Factor sensitivity temporarily unavailable' }) | error_message
src/lib/gate-state.ts:296:    setGate('robustness', 'warn', { message: 'Add factor values for full analysis' }) | error_message
src/lib/gate-state.ts:298:    setGate('robustness', 'warn', { message: 'Edge sensitivity only' }) | error_message
src/lib/gate-state.ts:300:    setGate('robustness', 'fail', { message: 'No sensitivity data available' }) | error_message
src/lib/gate-state.ts:341:      setGate('robustness', 'fail', { message: 'Robustness analysis unavailable' }) | error_message
src/lib/gate-state.ts:344:    setGate('robustness', 'fail', { message: 'Robustness analysis failed' }) | error_message
src/lib/gate-state.ts:346:    setGate('robustness', 'fail', { message: 'Robustness analysis unavailable' }) | error_message
src/lib/readiness.ts:194:      message: 'Connect your nodes with edges to define relationships', | error_message
src/lib/readiness.ts:203:      message: 'Add an outcome node to see predictions', | error_message
src/adapters/plot/v1/sseClient.ts:353:      message: 'Analysis timed out via gateway (proxy timeout). Try a smaller graph or "quick" mode.', | error_message
src/lib/discrimination.ts:281:    message: 'Model may not clearly distinguish between options', | error_message
src/lib/precisionDisplay.ts:120: * // => { headline: '65%', secondary: '40%–80%', qualifier: null, isPointEstimate: true } | error_message
src/lib/precisionDisplay.ts:124: * // => { headline: '40%–80%', secondary: null, qualifier: null, isPointEstimate: false } | error_message
src/lib/precisionDisplay.ts:128: * // => { headline: '30%–85%', secondary: null, qualifier: 'Model needs strengthening', isPointEstimate: false } | error_message
src/lib/api.ts:460:          message: 'Failed to check registration status. Please try again.', | error_message
src/lib/api.ts:501:            message: 'Please enter a valid email address.', | error_message
src/lib/api.ts:509:          message: 'Failed to register interest. Please try again.', | error_message
src/lib/api.ts:520:        message: 'An unexpected error occurred. Please try again.', | error_message
src/adapters/plot/v2/responseMapper.ts:87:        message: 'Option comparison status is "computed" but results array is empty', | error_message
src/adapters/plot/v2/responseMapper.ts:101:        message: 'Robustness status is "computed" but no fragile/robust edges returned', | error_message
src/adapters/plot/v2/responseMapper.ts:114:        message: 'Drivers status is "computed" but factor_sensitivity array is empty', | error_message
src/lib/userFriendlyErrors.ts:73:    headline: 'Connection issue', | error_message
src/lib/userFriendlyErrors.ts:74:    explanation: 'We couldn\'t reach our servers. Please check your internet connection.', | error_message
src/lib/userFriendlyErrors.ts:75:    actionText: 'Try Again', | error_message
src/lib/userFriendlyErrors.ts:79:    headline: 'Request took too long', | error_message
src/lib/userFriendlyErrors.ts:80:    explanation: 'The analysis is taking longer than expected. You can try again with a simpler model.', | error_message
src/lib/userFriendlyErrors.ts:81:    actionText: 'Try Again', | error_message
src/lib/userFriendlyErrors.ts:87:    headline: 'Session expired', | error_message
src/lib/userFriendlyErrors.ts:88:    explanation: 'Please refresh the page to continue.', | error_message
src/lib/userFriendlyErrors.ts:89:    actionText: 'Refresh Page', | error_message
src/lib/userFriendlyErrors.ts:93:    headline: 'Access denied', | error_message
src/lib/userFriendlyErrors.ts:94:    explanation: 'You don\'t have permission for this action.', | error_message
src/lib/userFriendlyErrors.ts:95:    actionText: 'Go Back', | error_message
src/lib/userFriendlyErrors.ts:101:    headline: 'Model needs adjustment', | error_message
src/lib/userFriendlyErrors.ts:102:    explanation: 'Some parts of your model need to be updated before running analysis.', | error_message
src/lib/userFriendlyErrors.ts:103:    actionText: 'Review Model', | error_message
src/lib/userFriendlyErrors.ts:107:    headline: 'Add elements first', | error_message
src/lib/userFriendlyErrors.ts:108:    explanation: 'Your model needs at least one factor before running analysis.', | error_message
src/lib/userFriendlyErrors.ts:109:    actionText: 'Add Elements', | error_message
src/lib/userFriendlyErrors.ts:115:    headline: 'Service temporarily unavailable', | error_message
src/lib/userFriendlyErrors.ts:116:    explanation: 'We\'re experiencing high demand. Please try again in a moment.', | error_message
src/lib/userFriendlyErrors.ts:117:    actionText: 'Try Again', | error_message
src/lib/userFriendlyErrors.ts:122:    headline: 'Too many requests', | error_message
src/lib/userFriendlyErrors.ts:123:    explanation: 'Please wait a moment before trying again.', | error_message
src/lib/userFriendlyErrors.ts:124:    actionText: 'Wait and Retry', | error_message
src/lib/userFriendlyErrors.ts:130:    headline: 'Model needs adjustment', | error_message
src/lib/userFriendlyErrors.ts:131:    explanation: 'Each option needs intervention values before analysis can run. Click an option node to configure.', | error_message
src/lib/userFriendlyErrors.ts:132:    actionText: 'Review Model', | error_message
src/lib/userFriendlyErrors.ts:138:    headline: 'Analysis couldn\'t complete', | error_message
src/lib/userFriendlyErrors.ts:139:    explanation: 'Something went wrong during analysis. Your model is unchanged.', | error_message
src/lib/userFriendlyErrors.ts:140:    actionText: 'Try Again', | error_message
src/lib/userFriendlyErrors.ts:144:    headline: 'Results processing issue', | error_message
src/lib/userFriendlyErrors.ts:145:    explanation: 'We received the analysis results but had trouble displaying them. Please try again.', | error_message
src/lib/userFriendlyErrors.ts:146:    actionText: 'Try Again', | error_message
src/lib/userFriendlyErrors.ts:150:    headline: 'Partial analysis available', | error_message
src/lib/userFriendlyErrors.ts:151:    explanation: 'The full review couldn\'t complete, but your core results are still valid.', | error_message
src/lib/userFriendlyErrors.ts:152:    actionText: 'View Results', | error_message
src/lib/userFriendlyErrors.ts:157:    headline: 'Some insights unavailable', | error_message
src/lib/userFriendlyErrors.ts:158:    explanation: 'We couldn\'t load all insights, but the main analysis is complete.', | error_message
src/lib/userFriendlyErrors.ts:159:    actionText: 'View Results', | error_message
src/lib/userFriendlyErrors.ts:165:    headline: 'Comparison couldn\'t complete', | error_message
src/lib/userFriendlyErrors.ts:166:    explanation: 'We couldn\'t compare your options. Try again or view individual results.', | error_message
src/lib/userFriendlyErrors.ts:167:    actionText: 'Try Again', | error_message
src/lib/userFriendlyErrors.ts:179:    headline: 'Not found', | error_message
src/lib/userFriendlyErrors.ts:180:    explanation: 'The requested resource couldn\'t be found.', | error_message
src/lib/userFriendlyErrors.ts:181:    actionText: 'Go Back', | error_message
src/lib/userFriendlyErrors.ts:186:    headline: 'Something went wrong', | error_message
src/lib/userFriendlyErrors.ts:187:    explanation: 'An unexpected error occurred. Please try again.', | error_message
src/lib/userFriendlyErrors.ts:188:    actionText: 'Try Again', | error_message
src/lib/userFriendlyErrors.ts:198:  headline: 'Something went wrong', | error_message
src/lib/userFriendlyErrors.ts:199:  explanation: 'An unexpected error occurred. Please try again.', | error_message
src/lib/userFriendlyErrors.ts:200:  actionText: 'Try Again', | error_message
src/lib/userFriendlyErrors.ts:214: *   message: 'Failed to fetch', | error_message
src/lib/userFriendlyErrors.ts:217: * // => { headline: 'Connection issue', explanation: '...', actionText: 'Try Again', ... } | error_message
src/lib/errorTaxonomy.ts:7:      return { label: 'Timeout', message: 'The request took too long to respond.', suggestion: 'Try again.' } | error_message
src/lib/errorTaxonomy.ts:9:      return { label: 'Temporary issue', message: 'A temporary network issue occurred.', suggestion: 'Try again.' } | error_message
src/lib/errorTaxonomy.ts:11:      return { label: 'Check input', message: 'There is a problem with the input.', suggestion: 'Check input.' } | error_message
src/lib/errorTaxonomy.ts:13:      return { label: 'Rate limited', message: 'You have reached the rate limit.', suggestion: 'Wait a moment and try again.' } | error_message
src/lib/errorTaxonomy.ts:15:      return { label: 'Service busy', message: 'The service is temporarily unavailable.', suggestion: 'Try again later.' } | error_message
src/lib/errorTaxonomy.ts:18:      return { label: 'Error', message: 'Something went wrong.', suggestion: 'Try again.' } | error_message
src/adapters/plot/v1/http.ts:268:      message: 'Analysis timed out via gateway (proxy timeout). Try a smaller graph or "quick" mode.', | error_message
src/adapters/plot/v1/http.ts:449:    useGateStore.getState().setGate('run', 'pass', { message: 'Simulation completed' }) | error_message
src/adapters/plot/v1/http.ts:538:        message: 'Request timed out after 10000ms', | error_message
src/adapters/plot/v1/http.ts:582:        message: 'Request timed out after 10000ms', | error_message
src/adapters/plot/v1/http.ts:643:        message: 'Validation request timed out after 5000ms', | error_message
src/adapters/plot/v1/http.ts:682:        message: 'Limits request timed out after 5000ms', | error_message
src/canvas/components/ImportExportDialog.tsx:54:        issues.push({ type: 'warning', message: 'Missing version field', fixable: true }) | error_message
src/canvas/components/ImportExportDialog.tsx:57:        issues.push({ type: 'warning', message: 'Missing timestamp field', fixable: true }) | error_message
src/canvas/components/ImportExportDialog.tsx:60:        issues.push({ type: 'error', message: 'Missing or invalid nodes array', fixable: false }) | error_message
src/canvas/components/ImportExportDialog.tsx:63:        issues.push({ type: 'error', message: 'Missing or invalid edges array', fixable: false }) | error_message
src/canvas/components/ImportExportDialog.tsx:96:      issues.push({ type: 'error', message: 'Invalid JSON format', fixable: false }) | error_message
src/canvas/conversation/BaseRateChipRow.tsx:36:    { id: 'br-uncommon', label: `${factorLabel} is uncommon`, message: 'rarely' }, | error_message
src/canvas/conversation/BaseRateChipRow.tsx:37:    { id: 'br-sometimes', label: `${factorLabel} happens sometimes`, message: 'sometimes' }, | error_message
src/canvas/conversation/BaseRateChipRow.tsx:38:    { id: 'br-common', label: `${factorLabel} is common`, message: 'usually' }, | error_message
src/canvas/components/CommandPalette.tsx:63:            message: 'Cannot run analysis: Graph is empty. Add at least one node.', | error_message
src/canvas/components/ContextBar.tsx:21:        message: 'Fetching current engine limits for this graph.', | error_message
src/canvas/components/TrustSignal.tsx:52:  message: 'Analysis did not produce complete results', | error_message
src/canvas/conversation/MessageBubble.tsx:252:      return { label: 'Explore more options', message: 'Suggest additional options for this decision', action_type: 'add_option' } | error_message
src/canvas/components/DraftLoadingAnimation.tsx:20:  { afterSeconds: 0,  message: 'Generating your decision model…' }, | error_message
src/canvas/components/DraftLoadingAnimation.tsx:21:  { afterSeconds: 15, message: 'Mapping factors and causal relationships…' }, | error_message
src/canvas/components/DraftLoadingAnimation.tsx:22:  { afterSeconds: 30, message: 'This is a complex decision — building a thorough model…' }, | error_message
src/canvas/components/DraftLoadingAnimation.tsx:23:  { afterSeconds: 60, message: 'Still working — complex briefs can take up to two minutes. You can keep waiting or simplify your brief and try again.' }, | error_message
src/canvas/conversation/ConversationPanel.tsx:276:          message: 'Failed to apply — try again', | error_message
src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:1514:        message: 'No risks in your model: what could go wrong?', | error_message
src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:1548:          message: 'No baseline value set on the goal. Without one, analysis shows absolute probability, not improvement from today.', | error_message
src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:1562:        message: 'No trade-offs captured: every factor helps. Is that realistic?', | error_message
src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:1587:            message: 'Options affect the same factors: may not represent different strategies', | error_message
src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:1610:          message: 'No external factors: what market or environmental conditions could affect the outcome?', | error_message
src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:1629:          message: 'Most values estimated by AI. Consider validating the top 2–3', | error_message
src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:1713:            message: 'Some factor ranges use estimates rather than confirmed values', | error_message
src/canvas/hooks/usePreRunValidation.ts:109:      message: 'No goal node selected', | error_message
src/canvas/hooks/usePreRunValidation.ts:121:      message: 'Selected goal node no longer exists', | error_message
src/canvas/hooks/usePreRunValidation.ts:186:        message: 'Your decision brief needs changes before analysis can run.', | error_message
src/canvas/hooks/usePreRunValidation.ts:267:      message: 'Analysis response is missing option data. Please re-draft.', | error_message
src/canvas/hooks/usePreRunValidation.ts:364:      message: 'No options to compare', | error_message
src/canvas/hooks/usePreRunValidation.ts:405:          message: 'Generate a model to configure options', | error_message
src/canvas/persist/versionedStorage.ts:125:          message: 'Invalid payload structure' | error_message
src/canvas/persist/versionedStorage.ts:135:          message: 'Missing required fields: schema, version, or data' | error_message
src/canvas/persist/versionedStorage.ts:212:        message: 'localStorage is not available' | error_message
src/canvas/persist/versionedStorage.ts:246:          message: 'Storage quota exceeded. Please export your data.', | error_message
src/canvas/persist/versionedStorage.ts:272:        message: 'localStorage is not available' | error_message
src/canvas/persist/versionedStorage.ts:326:        message: 'localStorage is not available' | error_message
src/canvas/persist/versionedStorage.ts:346:          message: 'Autosave skipped: storage quota nearly full' | error_message
src/canvas/persist/versionedStorage.ts:360:        message: 'Autosave failed', | error_message
src/canvas/utils/formatCEEError.ts:67:        message: 'AI drafting is temporarily unavailable.', | error_message
src/canvas/utils/formatCEEError.ts:87:        message: 'Complex briefs with many factors and options can take longer to model. You can:', | error_message
src/canvas/utils/formatCEEError.ts:127:        message: 'We generated a draft, but it had structural issues that couldn’t be auto-repaired. This can happen with very short or ambiguous briefs.', | error_message
src/canvas/utils/formatCEEError.ts:138:        message: 'The AI assistant returned an empty draft for this description. Try adding more concrete context, factors, and relationships, then try again.', | error_message
src/canvas/utils/formatCEEError.ts:154:      message: 'AI drafting is temporarily unavailable.', | error_message
src/canvas/hooks/useCEECoaching.ts:128:        message: 'Your model has only one option. Adding alternative options helps reduce confirmation bias and leads to better decisions.', | error_message
src/canvas/hooks/useCEECoaching.ts:146:        message: 'Your model has no risk factors. Identifying potential risks helps you prepare for adverse outcomes.', | error_message
src/canvas/hooks/useCEECoaching.ts:168:          message: 'All your connections have the same weight. Consider adjusting weights to reflect which factors have more influence.', | error_message
src/canvas/utils/runEligibility.ts:59:      message: 'Add at least one node and connection before running.' | error_message
src/canvas/utils/runEligibility.ts:71:      message: 'Fix validation issues before running this decision.' | error_message
src/canvas/utils/runEligibility.ts:92:      message: 'Simplify this graph to stay within the engine\'s limits before running.' | error_message
src/canvas/store/documents.ts:52:    return { field: 'name', message: 'Document name cannot be empty' } | error_message
src/canvas/store/documents.ts:64:    return { field: 'name', message: 'A document with this name already exists' } | error_message
src/canvas/utils/errorTaxonomy.ts:42:      message: 'Unable to reach the analysis engine due to a security policy (CORS).', | error_message
src/canvas/utils/errorTaxonomy.ts:54:      message: 'Unable to connect to the analysis engine.', | error_message
src/canvas/utils/errorTaxonomy.ts:65:      message: 'The analysis endpoint doesn\'t support this operation.', | error_message
src/canvas/utils/errorTaxonomy.ts:89:      message: 'The analysis is taking longer than expected.', | error_message
src/canvas/utils/errorTaxonomy.ts:100:      message: 'The analysis engine is currently down for maintenance or experiencing issues.', | error_message
src/canvas/utils/errorTaxonomy.ts:111:      message: 'Something went wrong on the analysis engine.', | error_message
src/canvas/utils/errorTaxonomy.ts:122:      message: 'You don\'t have permission to access the analysis engine.', | error_message
src/canvas/utils/errorTaxonomy.ts:133:      message: 'The analysis endpoint couldn\'t be found.', | error_message
src/canvas/utils/errorTaxonomy.ts:150:        message: 'When a decision splits into multiple paths, the likelihood of each path must add up to 100%. Some of your branches don\'t add up correctly yet.', | error_message
src/canvas/utils/errorTaxonomy.ts:181:      message: 'Add nodes to your decision graph before running analysis.', | error_message
src/canvas/utils/errorTaxonomy.ts:192:      message: 'One of your options has a completely deterministic outcome with no variability.', | error_message
src/canvas/utils/errorTaxonomy.ts:203:      message: 'The analysis found many ties between options, making it difficult to recommend a clear winner.', | error_message
src/canvas/utils/errorTaxonomy.ts:215:      message: 'You appear to be offline. Please check your network connection.', | error_message
src/canvas/utils/ceeDataAdapter.ts:379:    headline: 'AI review unavailable', | error_message
src/canvas/utils/autoFix.ts:76:    return { success: false, message: 'Node not found' } | error_message
src/canvas/utils/autoFix.ts:85:    return { success: false, message: 'Only decision nodes have probability distributions to normalize' } | error_message
src/canvas/utils/autoFix.ts:109:    return { success: false, message: 'No decision→option edges to normalize' } | error_message
src/canvas/utils/autoFix.ts:206:    return { success: false, message: 'Goal node not found' } | error_message
src/canvas/utils/autoFix.ts:238:    message: 'Added Risk node - click to edit label', | error_message
src/canvas/utils/autoFix.ts:260:    return { success: false, message: 'Target node not found' } | error_message
src/canvas/utils/autoFix.ts:292:    message: 'Added Factor node - click to edit label', | error_message
src/canvas/utils/autoFix.ts:314:    return { success: false, message: 'Orphan node not found' } | error_message
src/canvas/utils/autoFix.ts:323:    return { success: false, message: 'No target nodes available to connect' } | error_message
src/canvas/utils/autoFix.ts:375:    return { success: false, message: 'Edge not found' } | error_message
src/canvas/utils/autoFix.ts:386:    return { success: false, message: 'Edge strength is already within valid range' } | error_message
src/canvas/utils/autoFix.ts:452:        return { success: false, message: 'Node ID required for probability normalization' } | error_message
src/canvas/utils/autoFix.ts:458:        return { success: false, message: 'Goal node ID required to add risk' } | error_message
src/canvas/utils/autoFix.ts:464:        return { success: false, message: 'Target node ID required to add factor' } | error_message
src/canvas/utils/autoFix.ts:470:        return { success: false, message: 'Orphan node ID required' } | error_message
src/canvas/utils/autoFix.ts:476:        return { success: false, message: 'Edge ID required for strength clamping' } | error_message
src/canvas/utils/confidenceRangeLabels.ts:36:    explanation: '90% of outcomes are expected to be better than this', | error_message
src/canvas/utils/confidenceRangeLabels.ts:42:    explanation: 'Low end of the 70% confidence range', | error_message
src/canvas/utils/confidenceRangeLabels.ts:48:    explanation: 'The central estimate - equally likely to be higher or lower', | error_message
src/canvas/utils/confidenceRangeLabels.ts:54:    explanation: 'High end of the 70% confidence range', | error_message
src/canvas/utils/confidenceRangeLabels.ts:60:    explanation: '90% of outcomes are expected to be worse than this', | error_message
src/canvas/validation/graphGuardrails.ts:370:      message: 'Every model needs a goal. Add a different goal before removing this one.', | error_message
src/canvas/validation/graphGuardrails.ts:377:      message: 'Every model needs a decision node. Add a different one before removing this.', | error_message
src/canvas/utils/graphHealthStrings.ts:38:      message: 'Run analysis to check graph health', | error_message
src/canvas/utils/graphHealthStrings.ts:73:    message: 'Run analysis to check graph health', | error_message
src/canvas/utils/qualityTiers.ts:50:    message: 'Strong causal structure for reliable predictions', | error_message
src/canvas/utils/qualityTiers.ts:59:    message: 'Sufficient for directional insights, not precise predictions', | error_message
src/canvas/utils/qualityTiers.ts:68:    message: 'Model missing essential elements. Results may be unreliable.', | error_message
src/canvas/hooks/useGraphReadiness.ts:327:        confidence_explanation: 'Add some nodes to get started', | error_message
src/canvas/hooks/useSequentialAnalysis.ts:326:      flexibility_explanation: 'Sequential decisions allow you to adapt based on observed outcomes at each stage.', | error_message
src/canvas/hooks/useV2Run.ts:372:          error_message: 'Analysis could not complete', | error_message
src/canvas/hooks/useV2Run.ts:393:            message: 'Analysis could not complete', | error_message
src/canvas/hooks/useV2Run.ts:578:            message: 'Analysis completed but option results are missing', | error_message
src/canvas/hooks/useV2Run.ts:584:            message: 'Analysis completed successfully', | error_message
src/canvas/hooks/useV2Run.ts:595:            message: 'Robustness computed but results are empty', | error_message
src/canvas/hooks/useV2Run.ts:619:        message: 'Received unexpected response format', | error_message
```

## 13. CONSOLE_MESSAGE (console_message) — non-test files only

```
src/services/coachingReview.ts:98:    console.warn('[CoachingReview] Invalid response: not an object') | console_message
src/services/coachingReview.ts:106:    console.warn('[CoachingReview] Invalid headline: must be non-empty string under 100 chars') | console_message
src/services/coachingReview.ts:112:    console.warn('[CoachingReview] Invalid bullets: must be array of exactly 3') | console_message
src/services/coachingReview.ts:120:      console.warn(`[CoachingReview] Invalid bullet ${i}: must be non-empty array`) | console_message
src/services/coachingReview.ts:131:      console.warn(`[CoachingReview] Bullet ${i} exceeds 50 words: ${wordCount}`) | console_message
src/services/coachingReview.ts:139:          console.warn(`[CoachingReview] Invalid ref ID in bullet ${i}: ${segment.id}`) | console_message
src/services/coachingReview.ts:148:    console.warn('[CoachingReview] Invalid coaching_paragraph: must be array') | console_message
src/services/coachingReview.ts:156:        console.warn(`[CoachingReview] Invalid ref ID in coaching_paragraph: ${segment.id}`) | console_message
src/services/coachingReview.ts:164:    console.warn('[CoachingReview] Invalid bias_insights: must be array') | console_message
src/services/coachingReview.ts:251:      console.warn(`[CoachingReview] HTTP error: ${response.status} ${response.statusText}`) | console_message
src/services/coachingReview.ts:311:        console.warn('[CoachingReview] Request timed out') | console_message
src/services/coachingReview.ts:322:      console.warn('[CoachingReview] Network error:', err.message) | console_message
src/services/coachingReview.ts:334:    console.warn('[CoachingReview] Unknown error:', err) | console_message
src/services/threadService.ts:43:      console.warn('[ThreadService] append_thread_entries failed:', error.message) | console_message
src/services/threadService.ts:50:    console.warn('[ThreadService] append_thread_entries exception:', err) | console_message
src/services/threadService.ts:82:      console.warn('[ThreadService] update_thread_block_state failed:', error.message) | console_message
src/services/threadService.ts:85:    console.warn('[ThreadService] update_thread_block_state exception:', err) | console_message
src/services/threadService.ts:123:      console.warn('[ThreadService] create_snapshot failed:', error.message) | console_message
src/services/threadService.ts:129:    console.warn('[ThreadService] create_snapshot exception:', err) | console_message
src/services/threadService.ts:179:        console.warn('[ThreadService] insert_conversation_turn failed:', error.message) | console_message
src/services/threadService.ts:186:    console.warn('[ThreadService] insert_conversation_turn exception:', err) | console_message
src/services/turn-request-builder.ts:367:        console.error('[BOUNDARY]', { | console_message
src/routes/PlotShowcase.tsx:26:  console.warn( | console_message
src/routes/templates/DecisionTemplates.tsx:46:        console.warn('[DecisionTemplates] Failed to load templates') | console_message
src/routes/templates/TemplatesErrorBoundary.tsx:24:      console.error('[TemplatesErrorBoundary]', error, errorInfo) | console_message
src/routes/ShareView.tsx:65:    console.warn('[ShareView] Checking allowlist for hash:', hash) | console_message
src/routes/ShareView.tsx:71:    console.error('[ShareView] Allowlist check failed:', err) | console_message
src/routes/ShareView.tsx:87:    console.warn('[ShareView] Fetching shared data:', { hash, templateId }) | console_message
src/routes/ShareView.tsx:111:    console.error('[ShareView] Failed to fetch shared data:', err) | console_message
src/routes/CanvasMVP.tsx:63:          console.error('[CanvasMVP] Failed to load scenario from Supabase:', err) | console_message
src/routes/CanvasMVP.tsx:216:        console.warn('[CanvasMVP] Cannot share scenario: no results hash available') | console_message
src/routes/CanvasMVP.tsx:230:      console.error('[CanvasMVP] Failed to generate share link', error) | console_message
src/observability/metrics.ts:131:    console.warn('[METRICS] Failed to track event:', error) | console_message
src/observability/metrics.ts:151:      console.error('[METRICS ERROR]', error, context) | console_message
src/observability/metrics.ts:173:    console.warn('[METRICS] Failed to track error:', err) | console_message
src/observability/metrics.ts:208:    console.warn('[METRICS] Failed to identify user:', error) | console_message
src/canvas/CanvasToolbar.tsx:150:      console.error('[CanvasToolbar] Run failed:', err) | console_message
src/canvas/persist.ts:149:      console.warn('[CANVAS] Payload exceeds 5MB, save aborted') | console_message
src/canvas/persist.ts:157:      console.error('[CANVAS] LocalStorage quota exceeded') | console_message
src/canvas/persist.ts:160:    console.warn('[CANVAS] Failed to save state:', err) | console_message
src/canvas/persist.ts:186:      console.warn('[CANVAS] Snapshot exceeds 5MB, save aborted') | console_message
src/canvas/persist.ts:199:      console.error('[CANVAS] LocalStorage quota exceeded, cannot save snapshot') | console_message
src/canvas/persist.ts:202:    console.warn('[CANVAS] Failed to save snapshot:', err) | console_message
src/canvas/persist.ts:290:      console.error('[CANVAS] Invalid import data structure') | console_message
src/canvas/persist.ts:305:        console.error('[CANVAS] Invalid node ID') | console_message
src/canvas/persist.ts:309:        console.error('[CANVAS] Invalid node position') | console_message
src/canvas/persist.ts:317:        console.error('[CANVAS] Invalid edge structure') | console_message
src/canvas/persist.ts:327:    console.error('[CANVAS] Failed to parse import JSON:', err) | console_message
src/templates/mapper/blueprintToGraph.ts:73:      console.warn(`[blueprintToGraph] ${blueprint.id} has ${goals.length} goals, using first as root`) | console_message
src/routes/PlotWorkspace.tsx:79:      console.error('[PLOT:ASSERT] Canvas not top at right-middle. Top=', top) | console_message
src/canvas/layout/runLayoutWithProgress.ts:24:    console.error('[CANVAS] Layout failed:', err) | console_message
src/canvas/snapshots/snapshots.ts:64:    console.error('[Snapshots] Failed to load:', err) | console_message
src/canvas/snapshots/snapshots.ts:135:    console.error('[Snapshots] Failed to save:', err) | console_message
src/canvas/snapshots/snapshots.ts:157:      console.warn(`[Snapshots] Snapshot not found: ${id}`) | console_message
src/canvas/snapshots/snapshots.ts:167:    console.error('[Snapshots] Failed to delete:', err) | console_message
src/canvas/snapshots/snapshots.ts:215:    console.error('[Snapshots] Failed to clear:', err) | console_message
src/canvas/help/KeyboardLegend.tsx:17:    console.warn('Failed to load keyboard legend state:', error) | console_message
src/canvas/conversation/turnService.ts:173:  console.warn(LOG_PREFIX, 'Request', { | console_message
src/canvas/conversation/turnService.ts:214:      console.error(LOG_PREFIX, `Error ${response.status}`, { | console_message
src/canvas/conversation/turnService.ts:258:    console.warn(LOG_PREFIX, 'Response OK', { | console_message
src/canvas/conversation/turnService.ts:287:    console.error(LOG_PREFIX, isTimeout ? 'Timeout' : 'Network error', { | console_message
src/canvas/conversation/turnService.ts:473:    console.warn(LOG_PREFIX, 'streaming.telemetry', { | console_message
src/canvas/conversation/turnService.ts:479:  console.warn(LOG_PREFIX, 'Stream request', { | console_message
src/canvas/conversation/turnService.ts:508:    console.warn(LOG_PREFIX, 'streaming.client_fallback', { reason: 'network_error', error: (err as Error).message }) | console_message
src/canvas/conversation/turnService.ts:521:    console.warn(LOG_PREFIX, 'streaming.client_fallback', { reason: `status_${response.status}` }) | console_message
src/canvas/conversation/turnService.ts:575:    console.warn(LOG_PREFIX, 'streaming.client_fallback', { reason: 'unexpected_content_type', contentType }) | console_message
src/canvas/conversation/turnService.ts:609:        console.warn(LOG_PREFIX, 'Failed to parse SSE data:', data.slice(0, 200)) | console_message
src/utils/nodeIdNormalisation.ts:258:        console.warn('[nodeIdNormalisation] extractEdgeIdFromUnknown: object without edge_id:', { | console_message
src/utils/nodeIdNormalisation.ts:275:        console.warn('[nodeIdNormalisation] translateId received non-string:', { | console_message
src/utils/nodeIdNormalisation.ts:299:        console.warn('[nodeIdNormalisation] translateEdgeId received non-string:', { | console_message
src/canvas/hooks/usePreRunValidation.ts:832:          console.warn(`[Validation] Applying recommended fix: ${fix.reason}`) | console_message
src/canvas/palette/usePalette.ts:227:            console.error('[Palette] Failed to copy:', err) | console_message
src/canvas/palette/usePalette.ts:231:            console.warn('[Palette] No seed or hash available to copy') | console_message
src/canvas/palette/usePalette.ts:271:        console.warn('[Palette] Unknown action:', actionId) | console_message
src/canvas/palette/usePalette.ts:316:              console.warn('[Palette] Run not found for ID:', runId) | console_message
src/canvas/palette/usePalette.ts:319:            console.warn('[Palette] Run item missing runId metadata:', item) | console_message
src/canvas/snapshots/SnapshotPanel.tsx:69:      console.error(err) | console_message
src/lib/Build.ts:13:    console.error('Failed to log acceptance:', e) | console_message
src/pages/sandbox-guide/hooks/useCompareData.ts:151:        console.error('Failed to fetch structural diff:', err) | console_message
src/canvas/settingsStore.ts:60:      console.warn('Failed to load settings:', e) | console_message
src/canvas/persist/versionedStorage.ts:183:      console.warn( | console_message
src/canvas/persist/versionedStorage.ts:226:      console.warn( | console_message
src/canvas/persist/versionedStorage.ts:341:      console.warn('[versionedStorage] Autosave skipped: quota nearly full') | console_message
src/canvas/persist/versionedStorage.ts:355:    console.warn('[versionedStorage] Autosave failed:', error) | console_message
src/canvas/persist/versionedStorage.ts:383:      console.warn('[versionedStorage] Failed to parse autosave, ignoring') | console_message
src/canvas/persist/versionedStorage.ts:401:    console.warn('[versionedStorage] Failed to load autosave, ignoring') | console_message
src/canvas/persist/versionedStorage.ts:415:    console.warn('[versionedStorage] Failed to clear autosave:', error) | console_message
src/utils/debugLog.ts:64:    console.warn(`[${category}] ${message}`, data) | console_message
src/utils/debugLog.ts:66:    console.warn(`[${category}] ${message}`) | console_message
src/canvas/analysis/assembleAnalysisInputsSummary.ts:215:    console.warn('[assembleAnalysisInputsSummary] Payload exceeds 2KB after all truncation:', measureBytes(current)) | console_message
src/utils/verboseLog.ts:29:  console.warn(message, ...args) | console_message
src/lib/debug-state.ts:290:      console.warn('[debug-state] Replacing existing trace for retry:', params.requestId) | console_message
src/lib/debug-state.ts:340:      console.warn('[debug-state] Request not found:', requestId) | console_message
src/lib/debug-state.ts:838:      console.warn('[debug-state] Failed to parse downstream-calls header:', header) | console_message
src/lib/debug-state.ts:865:      console.warn('[debug-state] Failed to parse trace-received header:', header) | console_message
src/lib/ErrorBoundary.tsx:27:    console.error('ErrorBoundary caught:', error, errorInfo) | console_message
src/lib/prompt-preloader.ts:72:        console.warn('[prompt-preloader] Preload returned:', response.status) | console_message
src/lib/prompt-preloader.ts:80:          console.warn(`[prompt-preloader] Preload timed out after ${PRELOAD_TIMEOUT_MS}ms`) | console_message
src/lib/prompt-preloader.ts:82:          console.warn('[prompt-preloader] Preload failed:', error) | console_message
src/modules/focus/useFocusMode.ts:22:        console.warn('Failed to persist focus mode:', e) | console_message
src/canvas/hooks/usePreviewRun.ts:127:            console.error('[usePreviewRun] Stream setup failed:', err) | console_message
src/canvas/conversation/systemEvents.ts:70:      console.warn( | console_message
src/canvas/hooks/useResultsRun.ts:43:        console.warn('[useResultsRun] Force re-run: seed bumped from', request.seed, 'to', seed) | console_message
src/canvas/hooks/useResultsRun.ts:187:        console.error('[useResultsRun] Stream setup failed:', err) | console_message
src/canvas/onboarding/useOnboarding.ts:10:    console.warn('Failed to save onboarding status:', error) | console_message
src/canvas/onboarding/useOnboarding.ts:18:    console.warn('Failed to reset onboarding:', error) | console_message
src/canvas/onboarding/useOnboarding.ts:37:      console.warn('Failed to check onboarding status:', error) | console_message
src/lib/graphTransform.ts:214:    console.warn('[GraphTransform] Graph may not be fully v2.2 compatible - edges should have belief field') | console_message
src/lib/graphTransform.ts:265:    console.error('[GraphTransform] Schema validation errors:', errors) | console_message
src/canvas/conversation/InlineBlocks.tsx:292:        console.warn('[InlineBlocks] Suppressed unknown block type:', rawType, block) | console_message
src/pages/sandbox-guide/components/canvas/GhostSuggestionsOverlay.tsx:163:      console.warn('[GhostOverlay] ⚠️ Canvas element NOT found!') | console_message
src/streams/useStreamConnection.ts:448:        console.error('[useStreamConnection] Synchronous error in openStream:', err) | console_message
src/lib/plotStream.ts:58:        console.error('[plotStream] Parse error:', err) | console_message
src/lib/plotStream.ts:63:      console.warn('[plotStream] Connection error, will retry') | console_message
src/canvas/hooks/useHighlightDispatch.ts:118:        console.warn('[HighlightDispatch] Could not pan to nodes:', error) | console_message
src/canvas/hooks/useHighlightDispatch.ts:152:        console.warn('[HighlightDispatch] Could not pan to edges:', error) | console_message
src/canvas/hooks/useHighlightDispatch.ts:167:        console.warn('[HighlightDispatch] No valid IDs after mapping:', highlight.ids) | console_message
src/canvas/conversation/utils/applyPatch.ts:196:            console.warn(`[applyAutoApplyPatch] add_edge skipped — missing source/target for "${op.target_id}"`) | console_message
src/canvas/conversation/utils/applyPatch.ts:246:          console.warn(`[applyAutoApplyPatch] unknown op: "${(op as any).op}"`) | console_message
src/canvas/conversation/utils/applyPatch.ts:332:      .catch((err) => console.warn('[applyAutoApplyPatch] Layout failed:', err)) | console_message
src/canvas/hooks/useUtilityWeights.ts:153:        console.warn('[useUtilityWeights] Failed to suggest weights:', errorMessage) | console_message
src/lib/supabase.ts:37:  console.error('CRITICAL: Missing Supabase environment variables') | console_message
src/lib/supabase.ts:106:    console.error('getProfile exception:', err) | console_message
src/lib/supabase.ts:134:    console.error('updateProfile exception:', err) | console_message
src/lib/supabase.ts:192:    console.error('[Supabase] Invalid payload:', msg) | console_message
src/lib/supabase.ts:212:      console.error('[Supabase] Decision creation failed:', error) | console_message
src/lib/supabase.ts:218:    console.error('[Supabase] createDecision exception', err) | console_message
src/lib/supabase.ts:243:    console.error('getDecisions exception:', err) | console_message
src/lib/supabase.ts:284:    console.error('inviteCollaborator exception:', err) | console_message
src/lib/supabase.ts:310:    console.error('fetchCollaborators exception:', err) | console_message
src/lib/supabase.ts:334:    console.error('removeCollaborator exception:', err) | console_message
src/lib/supabase.ts:387:    console.error('saveDecisionAnalysis exception:', err) | console_message
src/lib/supabase.ts:406:    console.error('fetchDecisionCollaborators exception:', err) | console_message
src/lib/supabase.ts:428:    console.error('fetchUserDirectory exception:', err); | console_message
src/lib/supabase.ts:460:    console.error('inviteTeamMember exception:', err); | console_message
src/lib/supabase.ts:480:    console.error('getTeamInvitations exception:', err); | console_message
src/lib/supabase.ts:497:    console.error('getMyInvitations exception:', err); | console_message
src/lib/supabase.ts:517:    console.error('acceptTeamInvitation exception:', err); | console_message
src/lib/supabase.ts:537:    console.error('revokeTeamInvitation exception:', err); | console_message
src/lib/supabase.ts:558:    console.error('resendTeamInvitation exception:', err); | console_message
src/lib/supabase.ts:587:    console.error('createInvitation exception:', err); | console_message
src/lib/supabase.ts:606:    console.error('testSupabaseConnection failed:', err) | console_message
src/pages/sandbox-guide/components/shared/CopilotErrorBoundary.tsx:33:    console.error('Guide Error Boundary caught an error:', error, errorInfo) | console_message
src/canvas/hooks/useRecommendation.ts:174:          console.warn('[useRecommendation] Endpoint not available, using fallback') | console_message
src/canvas/hooks/useRecommendation.ts:197:      console.error('[useRecommendation] Fetch failed:', err) | console_message
src/lib/observability-headers.ts:140:      console.warn('[observability] Invalid startTime detected:', { | console_message
src/lib/observability-headers.ts:245:      console.warn('[observability] Invalid startTime in error path:', { | console_message
src/canvas/conversation/validateResponse.ts:178:    console.warn('[validateEnvelopeShape] Envelope is not an object', { rawType, preview: String(raw).slice(0, 200) }) | console_message
src/canvas/conversation/validateResponse.ts:205:    console.warn('[validateEnvelopeShape] Envelope shape violations repaired', { violations }) | console_message
src/canvas/conversation/validateResponse.ts:226:    console.warn('[validateStreamEventShape] SSE event missing type', { keys: Object.keys(parsed) }) | console_message
src/canvas/conversation/validateResponse.ts:233:    console.warn('[validateStreamEventShape] Unknown SSE event type', { type: resolvedType }) | console_message
src/canvas/conversation/validateResponse.ts:241:      console.warn('[validateStreamEventShape] turn_complete missing envelope') | console_message
src/App.tsx:77:        console.error('[App] Failed to load engine limits:', err) | console_message
src/canvas/ReactFlowGraph.tsx:128:      console.warn('[CANVAS TRACE]', message, data || {}) | console_message
src/canvas/ReactFlowGraph.tsx:142:  console.warn('[LAYOUT]', USE_NEW_LAYOUT ? 'NEW (canvas-first)' : 'OLD (docks)') | console_message
src/canvas/ReactFlowGraph.tsx:230:        console.warn('[canvas:init] Restored ceeAnalysisReady:', { | console_message
src/canvas/ReactFlowGraph.tsx:240:        console.warn('[canvas:init] Invalid ceeAnalysisReady discarded:', { | console_message
src/canvas/ReactFlowGraph.tsx:423:          console.warn(`[ReactFlowGraph] Duplicate node ID filtered: ${node.id}`) | console_message
src/canvas/ReactFlowGraph.tsx:437:          console.warn(`[ReactFlowGraph] Duplicate edge ID filtered: ${edge.id}`) | console_message
src/canvas/ReactFlowGraph.tsx:717:          console.warn('[ReactFlowGraph] Share link already applied, skipping:', runHash.slice(0, 8)) | console_message
src/canvas/ReactFlowGraph.tsx:723:        console.warn('[ReactFlowGraph] Share link detected, loading run:', runHash.slice(0, 8)) | console_message
src/canvas/ReactFlowGraph.tsx:746:          console.warn('[ReactFlowGraph] Run loaded successfully:', run.summary) | console_message
src/canvas/ReactFlowGraph.tsx:753:        console.warn('[ReactFlowGraph] Shared run not found in history:', runHash) | console_message
src/canvas/ReactFlowGraph.tsx:762:          console.warn('[ReactFlowGraph] Run not found in local history.') | console_message
src/canvas/ReactFlowGraph.tsx:779:        console.warn('[ReactFlowGraph] Hash changed, re-resolving share link') | console_message
src/canvas/ReactFlowGraph.tsx:968:      console.error('[ReactFlowGraph] Run analysis failed:', err) | console_message
src/canvas/ReactFlowGraph.tsx:1471:              console.warn('[canvas] Failed to restore results after autosave:', e) | console_message
src/canvas/ReactFlowGraph.tsx:1497:            console.warn('[canvas] Failed to restore results via graphHash matching:', e) | console_message
src/canvas/ReactFlowGraph.tsx:1501:        console.warn('[SCENARIO_STATE]', { | console_message
src/canvas/ReactFlowGraph.tsx:1511:        console.warn('[SCENARIO_STATE]', { | console_message
src/canvas/ReactFlowGraph.tsx:1585:        console.warn('[canvas] Failed to restore results from run history:', e) | console_message
src/contexts/DecisionContext.tsx:75:    console.warn('[Context] ⚠️ Failed to parse localStorage state', err) | console_message
src/contexts/DecisionContext.tsx:125:            console.warn(`RPC error fetching collaborators: ${error.message}`) | console_message
src/contexts/DecisionContext.tsx:132:          console.error('RPC method failed, falling back to direct query:', rpcError) | console_message
src/contexts/DecisionContext.tsx:146:        console.error(`Error fetching collaborators: ${errorMessage}`, err) | console_message
src/contexts/DecisionContext.tsx:173:      console.error('Failed to create realtime subscription:', subError) | console_message
src/contexts/DecisionContext.tsx:181:          console.warn('Error unsubscribing from channel:', e) | console_message
src/canvas/hooks/useAddBaseline.ts:71:      console.warn('[useAddBaseline] Cannot add baseline: no nodes to connect to') | console_message
src/canvas/hooks/useSequentialAnalysis.ts:213:          console.warn('[useSequentialAnalysis] ISL endpoint not available') | console_message
src/canvas/hooks/useSequentialAnalysis.ts:222:      console.warn('[useSequentialAnalysis] Fetch failed, using fallback:', err) | console_message
src/canvas/hooks/useSequentialAnalysis.ts:386:      console.error('[useSequentialAnalysis] Fetch failed:', err) | console_message
src/contexts/TeamsContext.tsx:52:      console.error('[TeamsContext] fetchTeams raw error:', e); | console_message
src/contexts/TeamsContext.tsx:85:      console.error('[TeamsContext] updateTeam error:', e); | console_message
src/contexts/TeamsContext.tsx:99:      console.error('[TeamsContext] deleteTeam error:', e); | console_message
src/contexts/TeamsContext.tsx:110:      console.error('[TeamsContext] getUserIdByEmail error:', e); | console_message
src/contexts/TeamsContext.tsx:128:      console.error('[TeamsContext] addTeamMember error:', e); | console_message
src/contexts/TeamsContext.tsx:145:      console.error('[TeamsContext] removeTeamMember error:', e); | console_message
src/contexts/TeamsContext.tsx:162:      console.error('[TeamsContext] updateTeamMember error:', e); | console_message
src/contexts/TeamsContext.tsx:215:          console.warn('Email send failed:', emailResult.error); | console_message
src/contexts/TeamsContext.tsx:228:      console.error('[TeamsContext] inviteTeamMember error:', e); | console_message
src/contexts/TeamsContext.tsx:242:      console.error('[TeamsContext] getTeamInvitations error:', e); | console_message
src/contexts/TeamsContext.tsx:255:      console.error('[TeamsContext] revokeInvitation error:', e); | console_message
src/lib/mappers/mapRobustness.ts:296:      console.error(`[CONTRACT_VIOLATION] Unknown robustness level: ${level}`) | console_message
src/pages/sandbox-guide/components/panel/states/CompareState.tsx:79:      console.warn('No baseline graph to restore') | console_message
src/canvas/hooks/useV2Run.ts:230:      console.warn('[useV2Run] Request ID:', requestId) | console_message
src/canvas/hooks/useV2Run.ts:281:            console.warn('[useV2Run] Stale analysis_ready detected, falling back to node extraction', { | console_message
src/canvas/hooks/useV2Run.ts:294:        console.warn('[useV2Run] Starting V2 analysis', { | console_message
src/canvas/hooks/useV2Run.ts:326:          console.warn('[useV2Run] Analysis blocked', { | console_message
src/canvas/hooks/useV2Run.ts:364:          console.warn('[useV2Run] Analysis failed', { | console_message
src/canvas/hooks/useV2Run.ts:409:          console.warn('[useV2Run] Soft validation warnings (will sanitize):', { | console_message
src/canvas/hooks/useV2Run.ts:419:          console.warn('[useV2Run] Analysis complete', { | console_message
src/canvas/hooks/useV2Run.ts:442:          console.warn('[useV2Run] Raw M1 Review fields from V2 response:', { | console_message
src/canvas/hooks/useV2Run.ts:468:          console.warn('[useV2Run] Extracted M1 Review:', { | console_message
src/canvas/hooks/useV2Run.ts:479:          console.warn('[useV2Run] Extracted M1 Coaching:', { | console_message
src/canvas/hooks/useV2Run.ts:504:            console.warn('[useV2Run] Detected computed-but-empty anomalies', { | console_message
src/canvas/hooks/useV2Run.ts:553:              console.warn('[useV2Run] Supabase analysis persistence failed', err) | console_message
src/canvas/hooks/useV2Run.ts:608:          console.warn('[useV2Run] Partial results returned') | console_message
src/canvas/hooks/useV2Run.ts:616:      console.error('[useV2Run] Unexpected result state', result) | console_message
src/canvas/hooks/useV2Run.ts:653:        console.error('[useV2Run] Error', { requestId, error: err }) | console_message
src/lib/mappers/selectDataSource.ts:308:    console.warn('[selectDataSource] No factor sensitivity data found in response') | console_message
src/canvas/hooks/useFormRecommendations.ts:147:        console.warn('[useFormRecommendations] Failed to fetch:', errorMessage) | console_message
src/canvas/conversation/hooks/useThreadPersistence.ts:119:        console.warn('[ThreadPersistence] Stopped retrying after 3 consecutive failures') | console_message
src/canvas/conversation/hooks/useThreadPersistence.ts:224:            console.error('[ThreadPersistence] XML envelope detected in msg.content — should be plain text:', msg.content.slice(0, 100)) | console_message
src/lib/resultsInstrumentation.ts:226:      console.warn('[Instrumentation] plot.empty_computed_results', payload) | console_message
src/canvas/hooks/useEngineLimits.ts:57:      console.warn('[useEngineLimits] Max fetch count reached, stopping retries') | console_message
src/canvas/hooks/useEngineLimits.ts:105:          console.warn('[useEngineLimits] Using fallback limits:', (result as any).reason) | console_message
src/canvas/hooks/useEngineLimits.ts:131:          console.warn('[useEngineLimits] Failed after', RETRY_DELAYS.length, 'attempts:', error) | console_message
src/pages/sandbox-guide/components/panel/sections/VerificationBadge.tsx:121:                  console.warn('Show all issues:', criticalIssues) | console_message
src/canvas/conversation/useConversation.ts:330:      console.warn(`[validateAdaptedBlock] blocks[${index}] graph_patch has 0 operations`) | console_message
src/canvas/conversation/useConversation.ts:335:        console.warn(`[validateAdaptedBlock] blocks[${index}].operations[${i}] missing target_id`, { op: op.op }) | console_message
src/canvas/conversation/useConversation.ts:338:        console.warn(`[validateAdaptedBlock] blocks[${index}].operations[${i}] add op missing data`, { op: op.op, target_id: op.target_id }) | console_message
src/canvas/conversation/useConversation.ts:344:    console.warn(`[validateAdaptedBlock] blocks[${index}] commentary has empty text`) | console_message
src/canvas/conversation/useConversation.ts:348:    console.warn(`[validateAdaptedBlock] blocks[${index}] fact has empty label`) | console_message
src/canvas/conversation/useConversation.ts:415:        console.warn('[extractAssistantText] JSON object with no extractable text field', { | console_message
src/canvas/conversation/useConversation.ts:472:        console.warn('[normalisePatchOp] empty target_id — no value.id and path has no usable tail', { op: raw.op, path }) | console_message
src/canvas/conversation/useConversation.ts:475:        console.warn('[normalisePatchOp] add op has empty data (value was null/undefined)', { op: raw.op, path }) | console_message
src/canvas/conversation/useConversation.ts:488:    console.warn('[normalisePatchOp] unknown op shape — no target_id, no path/value', { op: raw.op, keys: Object.keys(raw) }) | console_message
src/canvas/conversation/useConversation.ts:670:    console.warn('[adaptCEEBlock] Block missing type identifier:', Object.keys(obj)) | console_message
src/canvas/conversation/useConversation.ts:700:              console.warn('[adaptCEEBlock] Normalised graph_patch ops from path/value → target_id/data', { | console_message
src/canvas/conversation/useConversation.ts:709:            console.warn('[adaptCEEBlock] graph_patch has 0 operations but data keys:', Object.keys(dataObj)) | console_message
src/canvas/conversation/useConversation.ts:1150:            console.error('[useConversation] Thread hydration failed — starting fresh', err) | console_message
src/canvas/conversation/useConversation.ts:1263:          console.warn('[buildRequest] Replaced non-UUID scenario_id:', scenarioId, '→', newId) | console_message
src/canvas/conversation/useConversation.ts:1280:          console.warn( | console_message
src/canvas/conversation/useConversation.ts:1384:          console.warn('[buildRequest] rawV2Response has non-array fields coerced to []:', v2ArrayCoercions) | console_message
src/canvas/conversation/useConversation.ts:1431:        console.warn('[buildRequest] analysis_state present:', !!analysisState, { | console_message
src/canvas/conversation/useConversation.ts:1469:            console.warn('[buildRequest] run_analysis turn requested but ceeAnalysisReady is unavailable — falling back to conversation turn') | console_message
src/canvas/conversation/useConversation.ts:1544:        console.warn('[handleEnvelope] Silent system event — skipping message storage', { | console_message
src/canvas/conversation/useConversation.ts:1625:            console.warn('[handleEnvelope] Skipping duplicate analysis response (same hash)', raw.response_hash) | console_message
src/canvas/conversation/useConversation.ts:1695:              console.error('[handleEnvelope] Failed to hydrate results from envelope:', err) | console_message
src/canvas/conversation/useConversation.ts:1783:              console.warn('[handleEnvelope] auto-apply:', { | console_message
src/canvas/conversation/useConversation.ts:1799:              console.error('[handleEnvelope] auto-apply patch failed:', patchErr) | console_message
src/canvas/conversation/useConversation.ts:1827:            console.warn('[handleEnvelope] goal_constraints:', resolvedGoalConstraints.length, { | console_message
src/canvas/conversation/useConversation.ts:1837:            console.warn('[handleEnvelope] goal_constraints: 0 (cleared — new draft with no constraints)') | console_message
src/canvas/conversation/useConversation.ts:1851:            console.warn('[handleEnvelope] Using CEE-provided analysis_ready', { | console_message
src/canvas/conversation/useConversation.ts:1863:                console.warn('[handleEnvelope] Fallback: synthesised ceeAnalysisReady from graph', { | console_message
src/canvas/conversation/useConversation.ts:1869:              console.warn('[handleEnvelope] Synthesised ceeAnalysisReady failed validation — skipping') | console_message
src/canvas/conversation/useConversation.ts:1979:          console.warn('[useConversation] Task4: Suppressed raw structural violation text:', assistantText.slice(0, 200)) | console_message
src/canvas/conversation/useConversation.ts:2019:        console.warn('[handleEnvelope] Filtered non-conversational turn from history', { | console_message
src/canvas/conversation/useConversation.ts:2140:        if (import.meta.env.DEV) console.warn('[sendTurn] Blocked by in-flight lock (rapid double-click?)') | console_message
src/canvas/conversation/useConversation.ts:2164:          if (import.meta.env.DEV) console.warn('[sendTurn] Blocked:', !message.trim() ? 'empty message' : 'isThinking=true') | console_message
src/canvas/conversation/useConversation.ts:2208:          if (import.meta.env.DEV) console.warn('[sendTurn] System event blocked: isThinking=true') | console_message
src/canvas/conversation/useConversation.ts:2317:              console.warn('[sendTurn] streaming flag:', diag.resolved, '| source:', diag.source, | console_message
src/canvas/conversation/useConversation.ts:2477:              console.warn('[sendTurn] generate_model.no_draft_returned', { requestId: turnClientId }) | console_message
src/canvas/conversation/useConversation.ts:2508:            console.warn('[sendTurn] generate_model.no_draft_returned', { requestId: turnClientId }) | console_message
src/canvas/conversation/useConversation.ts:2566:          console.warn(`[sendTurn] System event failed: ${status}`, { | console_message
src/canvas/conversation/useConversation.ts:2648:          console.warn(`[sendSystemEvent] Dropped unsupported event: ${event.type}`) | console_message
src/canvas/conversation/validateAnalysisReadyContract.ts:48:    console.error('[validateAnalysisReadyContract] CEE payload rejected', { | console_message
src/canvas/conversation/validateAnalysisReadyContract.ts:85:    console.error('[validateAnalysisReadyContract] CEE payload rejected', { | console_message
src/canvas/hooks/useRiskProfile.ts:151:        console.warn('[useRiskProfile] Using fallback profile:', errorMessage) | console_message
src/canvas/hooks/useRiskProfile.ts:211:        console.warn('[useRiskProfile] Using fallback questions:', errorMessage) | console_message
src/canvas/hooks/useRiskProfile.ts:272:        console.warn('[useRiskProfile] Using locally calculated profile:', errorMessage) | console_message
src/canvas/share/ShareDrawer.tsx:152:        console.error(err) | console_message
src/canvas/share/ShareDrawer.tsx:156:      console.error(err) | console_message
src/canvas/share/ShareDrawer.tsx:171:      console.error(err) | console_message
src/canvas/hooks/useBlueprintInsert.ts:36:      console.warn('[useBlueprintInsert] Limit check failed:', error) | console_message
src/lib/plotStorage.ts:50:    console.warn('Failed to save workspace state:', error) | console_message
src/lib/plotStorage.ts:62:    console.warn('Failed to load workspace state:', error) | console_message
src/lib/plotStorage.ts:71:    console.warn('Failed to clear workspace state:', error) | console_message
src/canvas/conversation/ConversationPanel.tsx:144:            console.warn('[ConversationPanel] Graph hash mismatch — patch may be stale') | console_message
src/canvas/conversation/ConversationPanel.tsx:186:                  console.warn('[olumi] op-replay fallback: PLoT did not return full graph, applying operations individually') | console_message
src/canvas/conversation/selectors.ts:82:    console.warn('[resolvePatchBlockState] Unrecognized backend patch status "%s" for %s', backendStatus, stateKey) | console_message
src/canvas/hooks/useRobustness.ts:219:          console.warn('[useRobustness] extractRobustnessFromEnrichment returned null and no direct robustness data available') | console_message
src/canvas/hooks/useRobustness.ts:305:        console.warn('[useRobustness] Error:', errorMessage) | console_message
src/canvas/store/scenarios.ts:174:      console.warn('[scenarios] Invalid scenarios format, resetting') | console_message
src/canvas/store/scenarios.ts:180:    console.error('[scenarios] Failed to load:', error) | console_message
src/canvas/store/scenarios.ts:196:      console.warn('[scenarios] Invalid scenarios input, skipping save') | console_message
src/canvas/store/scenarios.ts:210:        console.error('[scenarios] Storage quota exceeded, clearing oldest scenarios') | console_message
src/canvas/store/scenarios.ts:216:          console.error('[scenarios] Failed to save even minimal scenarios') | console_message
src/canvas/store/scenarios.ts:219:        console.error('[scenarios] Storage error:', error.message) | console_message
src/canvas/store/scenarios.ts:222:      console.error('[scenarios] Failed to save:', error) | console_message
src/canvas/store/scenarios.ts:253:    console.error('[scenarios] Failed to set current scenario ID:', error) | console_message
src/canvas/store/scenarios.ts:268:    console.error('[scenarios] Failed to clear current scenario ID:', error) | console_message
src/canvas/store/scenarios.ts:332:    console.warn('[scenarios] Scenario not found for update:', id) | console_message
src/canvas/store/scenarios.ts:368:    console.warn('[scenarios] Scenario not found for duplication:', id) | console_message
src/canvas/store/scenarios.ts:496:    console.warn('[scenarios] S9-PROMOTE: Scenario not found:', scenarioId) | console_message
src/canvas/store/scenarios.ts:570:    console.error('[scenarios] Failed to save autosave:', error) | console_message
src/canvas/store/scenarios.ts:587:      console.warn('[scenarios] Invalid autosave format, ignoring') | console_message
src/canvas/store/scenarios.ts:593:    console.error('[scenarios] Failed to load autosave:', error) | console_message
src/lib/idMapping.ts:54:      console.warn('[IdMapping] mapPloTEdgeId received non-string:', { | console_message
src/lib/idMapping.ts:73:      console.warn('[IdMapping] Invalid PLoT edge ID format:', plotEdgeId) | console_message
src/lib/idMapping.ts:88:      console.warn('[IdMapping] No UI edge found for PLoT ID:', plotEdgeId, { from, to }) | console_message
src/lib/idMapping.ts:96:      console.warn('[IdMapping] Index out of range for PLoT ID:', plotEdgeId, { | console_message
src/lib/idMapping.ts:131:    console.warn('[IdMapping] Could not map edge IDs:', unmapped) | console_message
src/lib/idMapping.ts:163:    console.warn('[IdMapping] Node IDs not found in canvas:', unmapped) | console_message
src/lib/importWithProgress.ts:94:    console.error('[importWithProgress] Failed:', error) | console_message
src/lib/api.ts:19:  console.error('⚠️ VITE_SUPABASE_ANON_KEY not set - OpenAI proxy will not work') | console_message
src/lib/api.ts:274:    console.error( | console_message
src/lib/api.ts:378:    console.error( | console_message
src/lib/api.ts:431:    console.error('Goal clarification error:', error) | console_message
src/lib/api.ts:456:      console.error('Error checking existing registration:', checkError) | console_message
src/lib/api.ts:494:      console.error('Error inserting registration:', insertError) | console_message
src/lib/api.ts:516:    console.error('Unexpected error during registration:', error) | console_message
src/lib/auth/accessValidation.ts:113:    console.error('Access validation error:', error); | console_message
src/lib/auth/accessValidation.ts:150:    console.error('Error checking access validation:', error); | console_message
src/canvas/hooks/useDraftModel.ts:124:      console.error('[DRAFT_GRAPH_FAILED]', { reason: 'client_timeout', elapsedMs, timeoutMs: DRAFT_TIMEOUT_MS }) | console_message
src/types/cee.ts:227:        console.warn(`[CEE] Unknown intent "${intent}", using default layout`) | console_message
src/lib/version-cache.ts:74:        console.warn('[version-cache] Failed to fetch /version.json:', response.status) | console_message
src/lib/version-cache.ts:93:        console.warn('[version-cache] Invalid version.json shape:', data) | console_message
src/lib/version-cache.ts:99:        console.warn(`[version-cache] Retry ${attempt + 1}/${MAX_RETRIES}:`, error) | console_message
src/lib/version-cache.ts:103:        console.warn('[version-cache] Failed to load version after retries:', error) | console_message
src/canvas/store/runsBus.ts:35:      console.error('[runsBus] Listener error:', error) | console_message
src/lib/auth/authUtils.ts:93:        console.warn(`Failed to remove ${key} from localStorage:`, e); | console_message
src/lib/auth/authUtils.ts:104:      console.warn('Failed to dispatch storage event:', e); | console_message
src/lib/auth/authUtils.ts:121:    console.error('Failed to cache auth token:', error); | console_message
src/lib/auth/authUtils.ts:133:    console.error('Failed to check token validity:', error); | console_message
src/poc/AppPoC.tsx:209:      console.error('Import JSON failed', err) | console_message
src/poc/AppPoC.tsx:223:      console.error('Import JSON failed (setup)', e) | console_message
src/poc/AppPoC.tsx:281:        console.warn('POC: SandboxStreamPanel not available', e) | console_message
src/poc/AppPoC.tsx:287:        console.warn('POC: EngineAuditPanel not available', e) | console_message
src/poc/AppPoC.tsx:293:        console.warn('POC: Whiteboard not available', e) | console_message
src/poc/AppPoC.tsx:439:      console.error('Export JSON failed', e) | console_message
src/poc/AppPoC.tsx:486:            console.error('Export PNG failed', e) | console_message
src/main.tsx:196:      console.error('[main] boot fatal', e); | console_message
src/canvas/store/scenariosVersioned.ts:29:    console.warn('[scenariosVersioned] Failed to load:', result.error.message) | console_message
src/canvas/store/scenariosVersioned.ts:69:      console.error('[scenariosVersioned] Quota exceeded, offering export') | console_message
src/canvas/hooks/useConditionalRecommendations.ts:122:          console.warn('[useConditionalRecommendations] ISL endpoint not available') | console_message
src/canvas/hooks/useConditionalRecommendations.ts:302:      console.error('[useConditionalRecommendations] Fetch failed:', err) | console_message
src/lib/email.ts:37:    console.error('sendInviteViaEdge exception:', err); | console_message
src/lib/email.ts:64:    console.error('Failed to send invitation email:', err); | console_message
src/canvas/store/runHistory.ts:79:      console.warn('[runHistory] Invalid runs format, resetting') | console_message
src/canvas/store/runHistory.ts:85:    console.error('[runHistory] Failed to load:', error) | console_message
src/canvas/store/runHistory.ts:101:      console.warn('[runHistory] Invalid runs input, skipping save') | console_message
src/canvas/store/runHistory.ts:120:        console.error('[runHistory] Storage quota exceeded, clearing oldest runs') | console_message
src/canvas/store/runHistory.ts:126:          console.error('[runHistory] Failed to save even minimal history') | console_message
src/canvas/store/runHistory.ts:129:        console.error('[runHistory] Storage error:', error.message) | console_message
src/canvas/store/runHistory.ts:132:      console.error('[runHistory] Failed to save:', error) | console_message
src/canvas/hooks/useEdgeFunctionSuggestion.ts:158:        console.warn('[useEdgeFunctionSuggestion] Failed to fetch:', errorMessage) | console_message
src/lib/debug.ts:51:    console.warn(`[DEBUG:${flag}]`, ...args) | console_message
src/canvas/ErrorBoundary.tsx:50:    console.error('[CANVAS ERROR]:', error, errorInfo) | console_message
src/canvas/ErrorBoundary.tsx:114:      console.error('Failed to copy state:', e) | console_message
src/canvas/ErrorBoundary.tsx:153:      console.error('Failed to copy debug info:', e) | console_message
src/canvas/ErrorBoundary.tsx:196:      console.error('Recovery failed:', e) | console_message
src/lib/diagnostic-bundle.ts:403:      console.warn('[diagnostic-bundle] Failed to fetch service health:', err) | console_message
src/lib/diagnostic-bundle.ts:480:    console.warn('[diagnostic-bundle] Exported:', filename) | console_message
src/lib/diagnostic-bundle.ts:993:    console.warn('[diagnostic-bundle] Exported merged:', filename) | console_message
src/canvas/hooks/useGraphReadiness.ts:306:        console.warn( | console_message
src/canvas/hooks/useGraphReadiness.ts:415:        console.warn('[useGraphReadiness] Fetching readiness:', { | console_message
src/canvas/hooks/useGraphReadiness.ts:421:        console.warn('[useGraphReadiness] Payload being sent:', { | console_message
src/canvas/hooks/useGraphReadiness.ts:458:          console.warn( | console_message
src/canvas/hooks/useGraphReadiness.ts:482:        console.error('[useGraphReadiness] CEE error response:', { | console_message
src/canvas/hooks/useGraphReadiness.ts:555:      console.warn('[useGraphReadiness] Fetch failed, using fallback:', err) | console_message
src/lib/prompts.ts:236:    console.error('Error generating prompt messages:', error); | console_message
src/lib/logger.ts:92:      console.warn('[WARN]', ...args) | console_message
src/lib/logger.ts:103:      console.error('[ERROR]', ...args) | console_message
src/canvas/store.ts:137:    console.warn('[canvas] Failed to restore results from history:', e) | console_message
src/canvas/store.ts:786:      console.warn('[Canvas] === INVALIDATE ANALYSIS_READY ===') | console_message
src/canvas/store.ts:787:      console.warn('[Canvas] Reason:', reason ?? 'unspecified') | console_message
src/canvas/store.ts:788:      console.warn('[Canvas] Had options:', ceeAnalysisReady.options?.length) | console_message
src/canvas/store.ts:1169:      console.warn(`[Canvas] Invalid node type: ${updates.type}`) | console_message
src/canvas/store.ts:1432:      if (import.meta.env.DEV) console.warn(`[Canvas] addEdge: source node "${edge.source}" not found`) | console_message
src/canvas/store.ts:1436:      if (import.meta.env.DEV) console.warn(`[Canvas] addEdge: target node "${edge.target}" not found`) | console_message
src/canvas/store.ts:1822:      console.error('[CANVAS] Layout failed:', err) | console_message
src/canvas/store.ts:2316:          console.warn('[resultsComplete] Snapshot capture failed', err) | console_message
src/canvas/store.ts:2428:        console.warn('[store] resultsHydrateFromSupabase: invariant violation — status is not complete or report missing, skipping') | console_message
src/canvas/store.ts:2513:      console.warn('[Canvas] Scenario not found:', id) | console_message
src/canvas/store.ts:2576:          console.warn('[loadScenario] Restored ceeAnalysisReady:', { | console_message
src/canvas/store.ts:2583:          console.warn('[loadScenario] Stale ceeAnalysisReady discarded:', validation) | console_message
src/canvas/store.ts:2716:      console.warn('[Canvas] No current scenario to duplicate') | console_message
src/canvas/store.ts:2731:      console.warn('[Canvas] No current scenario to rename') | console_message
src/canvas/store.ts:2915:      console.warn('[Canvas] === SET CEE_ANALYSIS_READY ===') | console_message
src/canvas/store.ts:2916:      console.warn('[Canvas] setCeeAnalysisReady called with:', analysisReady ? 'payload' : 'null') | console_message
src/canvas/store.ts:2918:        console.warn('[Canvas] options count:', analysisReady.options?.length) | console_message
src/canvas/store.ts:2919:        console.warn('[Canvas] goal_node_id:', analysisReady.goal_node_id) | console_message
src/canvas/store.ts:2964:      console.warn('[Canvas] setCeePipelineTrace:', { | console_message
src/canvas/store.ts:2976:      console.warn('[Canvas] setCeeQuality:', quality) | console_message
src/canvas/store.ts:2984:      console.warn('[Canvas] setCeeExtendedWarnings:', warnings.length, 'warnings') | console_message
src/canvas/store.ts:2991:      console.warn('[Canvas] setCeeGoalConnectivity:', connectivity.status) | console_message
src/canvas/store.ts:2998:      console.warn('[Canvas] setCeeModelQualityFactors:', factors) | console_message
src/canvas/store.ts:3005:      console.warn('[Canvas] setCeeInterventionHints:', Object.keys(hints).length, 'hints') | console_message
src/canvas/store.ts:3012:      console.warn('[Canvas] setPreAnalysisSensitivity:', sensitivity.method, | console_message
src/canvas/store.ts:3483:      console.warn('[CEE] Raw output mode enabled') | console_message
src/canvas/store.ts:3609:          console.warn('[applyClarifierGraph] Skipping edge - node not found in mapping:', { | console_message
src/canvas/store.ts:3653:        console.warn('[applyClarifierGraph] Applying ELK layout after clarifier insertion (preview)', { | console_message
src/canvas/store.ts:3661:        console.warn('[applyClarifierGraph] Layout failed:', err) | console_message
src/canvas/store.ts:3696:          console.warn('[applyClarifierGraph] Skipping edge - node not found in mapping:', { | console_message
src/canvas/store.ts:3739:        console.warn('[applyClarifierGraph] Applying ELK layout after clarifier insertion (finalize)', { | console_message
src/canvas/store.ts:3747:        console.warn('[applyClarifierGraph] Layout failed:', err) | console_message
src/canvas/hooks/useRiskToleranceSuggestion.ts:132:        console.warn('[useRiskToleranceSuggestion] Using fallback:', errorMessage) | console_message
src/canvas/components/SectionErrorBoundary.tsx:55:    console.error(`[SectionErrorBoundary] ${this.props.section}:`, error, info.componentStack) | console_message
src/lib/payload-trace-store.ts:422:    console.warn('[DataShapeAnomaly]', { | console_message
src/lib/secureStorage.ts:48:      console.error('[secureStorage] Failed to derive encryption key:', err) | console_message
src/lib/secureStorage.ts:98:      console.error('[secureStorage] Encryption failed:', err) | console_message
src/lib/secureStorage.ts:120:      console.warn('[secureStorage] Cannot decrypt without VITE_STORAGE_KEY') | console_message
src/lib/secureStorage.ts:148:      console.error('[secureStorage] Decryption failed:', err) | console_message
src/lib/secureStorage.ts:213:      console.warn( | console_message
src/lib/secureStorage.ts:226:        console.warn( | console_message
src/canvas/hooks/useScenarioComparison.ts:621:        console.error('[useScenarioComparison] Error:', error) | console_message
src/canvas/components/GraphTextView.tsx:66:    console.error(`[GraphTextView] Error in ${this.props.section}:`, error) | console_message
src/canvas/components/GraphTextView.tsx:347:      console.error('[GraphTextView] Failed to copy:', err) | console_message
src/hooks/useDirectory.ts:24:      console.error('Failed to fetch directory:', err); | console_message
src/hooks/useISLConformal.ts:240:        console.error('[useISLConformal] Error:', error) | console_message
src/hooks/useAsk.ts:315:      console.warn('[useAsk] Request ID mismatch', { | console_message
src/hooks/useISLValidation.ts:83:            console.warn('[useISLValidation] Enrichment flag enabled but no usable validation - using fallback (NOT calling ISL)') | console_message
src/canvas/components/DraftChat.tsx:184:        console.warn('[DraftChat] Auto-collapsed to compact height after full_draft graph generation') | console_message
src/canvas/components/DraftChat.tsx:274:      console.error('Draft failed:', err) | console_message
src/canvas/components/DraftChat.tsx:340:            console.warn('[DraftChat] Extracted pipeline trace from error response:', { | console_message
src/canvas/components/DraftChat.tsx:348:          console.warn('[DraftChat] No pipeline trace in error response:', { | console_message
src/canvas/components/DraftChat.tsx:378:      console.warn('[DraftChat] === CEE RESPONSE DIAGNOSTIC ===') | console_message
src/canvas/components/DraftChat.tsx:379:      console.warn('[DraftChat] Response keys:', Object.keys(draftData || {})) | console_message
src/canvas/components/DraftChat.tsx:380:      console.warn('[DraftChat] Has analysis_ready key:', 'analysis_ready' in (draftData || {})) | console_message
src/canvas/components/DraftChat.tsx:381:      console.warn('[DraftChat] analysis_ready value:', (draftData as any)?.analysis_ready) | console_message
src/canvas/components/DraftChat.tsx:382:      console.warn('[DraftChat] hasAnalysisReady() result:', hasAnalysisReady(draftData)) | console_message
src/canvas/components/DraftChat.tsx:383:      console.warn('[DraftChat] Nodes location:', draftData?.nodes ? 'root' : (draftData as any)?.graph?.nodes ? 'graph.nodes' : 'none') | console_message
src/canvas/components/DraftChat.tsx:384:      console.warn('[DraftChat] Edges location:', draftData?.edges ? 'root' : (draftData as any)?.graph?.edges ? 'graph.edges' : 'none') | console_message
src/canvas/components/DraftChat.tsx:388:      console.warn('[DraftChat] === EDGE STRUCTURE AT DRAFTCHAT ===') | console_message
src/canvas/components/DraftChat.tsx:389:      console.warn('[DraftChat] edges array length:', rawEdgesForCheck.length) | console_message
src/canvas/components/DraftChat.tsx:391:        console.warn('[DraftChat] First edge ALL KEYS:', Object.keys(firstEdge)) | console_message
src/canvas/components/DraftChat.tsx:392:        console.warn('[DraftChat] First edge RAW:', JSON.stringify(firstEdge, null, 2)) | console_message
src/canvas/components/DraftChat.tsx:393:        console.warn('[DraftChat] First edge field check:', { | console_message
src/canvas/components/DraftChat.tsx:401:        console.warn('[DraftChat] No edges received - checked both draftData.edges and draftData.graph.edges') | console_message
src/canvas/components/DraftChat.tsx:403:      console.warn('[DraftChat] === END EDGE INVESTIGATION ===') | console_message
src/canvas/components/DraftChat.tsx:408:        console.warn('[DraftChat] analysis_ready.options:', ar.options) | console_message
src/canvas/components/DraftChat.tsx:409:        console.warn('[DraftChat] analysis_ready.options is array:', Array.isArray(ar.options)) | console_message
src/canvas/components/DraftChat.tsx:410:        console.warn('[DraftChat] analysis_ready.options.length:', ar.options?.length) | console_message
src/canvas/components/DraftChat.tsx:411:        console.warn('[DraftChat] analysis_ready.goal_node_id:', ar.goal_node_id) | console_message
src/canvas/components/DraftChat.tsx:412:        console.warn('[DraftChat] goal_node_id is string:', typeof ar.goal_node_id === 'string') | console_message
src/canvas/components/DraftChat.tsx:416:          console.warn(`[DraftChat] Option ${i} "${opt.label}":`, { | console_message
src/canvas/components/DraftChat.tsx:424:      console.warn('[DraftChat] === END DIAGNOSTIC ===') | console_message
src/canvas/components/DraftChat.tsx:514:        console.warn('[DraftChat] Inferred edge direction from signed mean', { | console_message
src/canvas/components/DraftChat.tsx:532:        console.warn('[DraftChat] Edge coefficient:', { | console_message
src/canvas/components/DraftChat.tsx:568:        console.warn('[DraftChat] Edge uncertainty from CEE:', { | console_message
src/canvas/components/DraftChat.tsx:626:      console.warn('[DraftChat] Applying ELK layout after draft insertion', { | console_message
src/canvas/components/DraftChat.tsx:656:        console.error('[DraftChat] Layout failed after applying draft', error) | console_message
src/canvas/components/DraftChat.tsx:670:        console.warn('[DraftChat] Immediate autosave after draft applied', { | console_message
src/canvas/components/DraftChat.tsx:676:      console.error('[DraftChat] Immediate autosave failed:', err) | console_message
src/canvas/components/DraftChat.tsx:688:        console.warn('[DraftChat] Auto-selected goal node:', goalNodes[0].id) | console_message
src/canvas/components/DraftChat.tsx:691:      console.warn('[DraftChat] Multiple goal nodes found, user must select:', goalNodes.map((n: any) => n.id)) | console_message
src/canvas/components/DraftChat.tsx:705:        console.warn('[DraftChat] Stored analysis_ready:', { | console_message
src/canvas/components/DraftChat.tsx:717:        console.warn('[DraftChat] Stored goal_constraints:', rawGoalConstraints.length) | console_message
src/canvas/components/DraftChat.tsx:740:        console.warn('[DraftChat] Stored CEE quality dimensions:', rawQuality) | console_message
src/hooks/useDecisionOptions.ts:38:      console.error('Error fetching options:', err); | console_message
src/hooks/useDecisionOptions.ts:104:      console.error('Error adding option:', err); | console_message
src/hooks/useDecisionOptions.ts:119:      console.error('Error updating option:', err); | console_message
src/hooks/useDecisionOptions.ts:134:      console.error('Error deleting option:', err); | console_message
src/hooks/useDecisionOptions.ts:154:      console.error('Error merging options:', err); | console_message
src/canvas/components/ImportExportDialog.tsx:200:      console.error('PNG export failed:', error) | console_message
src/hooks/useScenario.ts:185:              console.error('[useScenario] save retry failed:', retryErr) | console_message
src/hooks/useScenario.ts:231:            console.warn('[useScenario] Framing save failed') | console_message
src/hooks/useScenario.ts:256:            console.error('[useScenario] Unmount graph flush failed:', err) | console_message
src/hooks/useScenario.ts:266:            console.error('[useScenario] Unmount framing flush failed:', err) | console_message
src/hooks/useScenario.ts:306:        console.error('[useScenario] Auto-title save failed:', err) | console_message
src/hooks/useScenario.ts:370:          console.warn('[useScenario] Scenario not found:', id) | console_message
src/hooks/useScenario.ts:429:            console.error('[useScenario] Reset interrupted analysis status failed:', err) | console_message
src/hooks/useScenario.ts:452:          console.warn( | console_message
src/hooks/usePareto.ts:155:            console.error(`[usePareto] HTTP ${response.status}:`, errorBody) | console_message
src/hooks/usePareto.ts:158:            console.error(`[usePareto] HTTP ${response.status}:`, errorText) | console_message
src/hooks/usePareto.ts:185:      console.warn('[usePareto] Failed:', errorMessage) | console_message
src/canvas/components/CommandPalette.tsx:106:          console.error('[CommandPalette] Run failed:', err) | console_message
src/hooks/useCoachingReview.ts:152:      console.error('[useCoachingReview] Unexpected error:', err) | console_message
src/hooks/hydrateAnalysis.ts:99:      console.warn('[hydrateAnalysis] Invalid V2RunResponse shape, skipping hydration') | console_message
src/canvas/components/ValidationSuggestions.tsx:70:        console.error('ISL validation failed:', err) | console_message
src/canvas/components/ValidationSuggestions.tsx:223:      console.warn('Highlighting nodes:', suggestion.affectedNodes) | console_message
src/canvas/components/ValidationSuggestions.tsx:230:      console.warn('Quick fix:', suggestion.quickFix) | console_message
src/canvas/utils/applyDraftResult.ts:141:    .catch((err) => console.error('[applyDraftResult] Layout failed:', err)) | console_message
src/canvas/utils/applyDraftResult.ts:282:      console.warn('[backfillInterventionsOntoOptionNodes]', backfilledCount, 'option nodes updated') | console_message
src/canvas/adapters/causalClaimsAdapter.ts:40:      console.warn( | console_message
src/canvas/adapters/backendKinds.ts:158:    console.warn( | console_message
src/canvas/components/RecoveryBanner.tsx:56:          console.warn('[RecoveryBanner] Auto-selected goal node:', goalNodeId) | console_message
src/canvas/utils/graphPayload.ts:74:    console.warn('[normalizeInterventionValue] Unhandled intervention format', { | console_message
src/canvas/utils/graphPayload.ts:221:      console.warn('[getRecommendedOptionInterventions] Conformal skipped: no valid interventions available', { | console_message
src/canvas/utils/graphPayload.ts:234:        console.warn('[getRecommendedOptionInterventions] Non-numeric value after normalization', { | console_message
src/canvas/adapters/islRequestAdapter.ts:259:    console.warn( | console_message
src/canvas/adapters/islRequestAdapter.ts:349:        console.warn(`[ISL Adapter] Factor ${node.id} has no data field`) | console_message
src/canvas/adapters/islRequestAdapter.ts:467:      console.warn(`[ISL Adapter] Could not extract uncertainties for factor ${node.id}:`, data) | console_message
src/canvas/adapters/islRequestAdapter.ts:474:      console.warn('[ISL Adapter] No parameter uncertainties extracted, using defaults for', factorNodes.length, 'factors') | console_message
src/canvas/adapters/islRequestAdapter.ts:677:          console.warn( | console_message
src/canvas/components/PreAnalysisGuidance.tsx:200:        console.warn('[PreAnalysisGuidance] No auto-fix available for code:', item.code) | console_message
src/canvas/components/PreAnalysisGuidance.tsx:244:        console.error('[PreAnalysisGuidance] Auto-fix error:', error) | console_message
src/canvas/components/PreAnalysisGuidance.tsx:351:                    console.warn('[PreAnalysisGuidance] Apply weight (not yet implemented):', c) | console_message
src/components/debug/hooks/useDebugData.ts:1844:    console.warn('[Winner Debug] ISL options search:', { | console_message
src/canvas/utils/severityMapping.ts:262:  console.warn(`[severityMapping] Unknown source '${source}' with severity '${severity}'`) | console_message
src/canvas/utils/severityMapping.ts:325:        console.warn(`[severityMapping] Unknown CEE level '${level}', defaulting to INFO`) | console_message
src/canvas/components/LayoutPopover.tsx:28:      console.error('[CANVAS] Layout failed:', error) | console_message
src/canvas/utils/focusHelpers.ts:44:    console.warn('[focusHelpers] focusNodeById called before ReactFlow mounted') | console_message
src/canvas/utils/focusHelpers.ts:57:    console.warn('[focusHelpers] focusEdgeById called before ReactFlow mounted') | console_message
src/canvas/utils/focusHelpers.ts:105:    console.warn('[focusHelpers] focusByTarget called with empty targetId') | console_message
src/canvas/utils/focusHelpers.ts:122:      console.warn(`[focusHelpers] Unknown targetType "${targetType}", defaulting to node focus`) | console_message
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:146:      console.warn(`Unmapped warning code: ${code}`) | console_message
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:1624:      console.warn('Baseline detection mismatch: UI says', uiBaseline, ', CEE says', ceeBaseline) | console_message
src/canvas/components/LayoutOptionsPanel.tsx:57:      console.error('Layout failed:', error) | console_message
src/canvas/components/PanelErrorBoundary.tsx:32:    console.error(`[PanelErrorBoundary] ${this.props.panel}:`, error, info.componentStack) | console_message
src/canvas/components/ComparisonTable.tsx:27:      console.error('Comparison failed:', err) | console_message
src/canvas/components/CoachingCard.tsx:39:        console.warn('[CoachingCard] Chip dispatched without action_type — legacy chip needs migration:', chip.label) | console_message
src/canvas/components/CoachingCard.tsx:52:      if (import.meta.env.DEV) console.warn('[CoachingCard] _dispatchAction not registered, falling back to _sendMessage') | console_message
src/canvas/components/RecommendationCard/index.tsx:201:      console.warn('[RecommendationCard] Coherence issue detected:', { | console_message
src/canvas/components/OutputsDock.tsx:431:    console.warn('[GRAPH_USED_FOR_RUN]', { | console_message
src/canvas/components/OutputsDock.tsx:447:      console.warn('[OutputsDock] Cannot add Status Quo baseline: no nodes to connect to') | console_message
src/canvas/components/OutputsDock.tsx:493:    console.warn('[OutputsDock] Added Status Quo baseline option:', newNode.id) | console_message
src/canvas/components/OutputsDock.tsx:535:      console.warn('[OutputsDock] No auto-fix available for code:', item.code) | console_message
src/canvas/components/OutputsDock.tsx:560:      console.warn('[OutputsDock] Auto-fix failed:', result.message) | console_message
src/canvas/components/OutputsDock.tsx:564:      console.error('[OutputsDock] Auto-fix error:', err) | console_message
src/canvas/components/ConnectivityChip.tsx:82:        console.error('[ConnectivityChip] Failed to check connectivity:', err) | console_message
src/canvas/components/ConnectivityChip.tsx:158:        console.error('[ConnectivityChip] Reprobe failed:', err) | console_message
src/canvas/components/GuidancePanel.tsx:150:                    if (import.meta.env.DEV) console.warn('[GuidancePanel] Apply weight:', item) | console_message
src/canvas/components/OutcomesSignal.tsx:103:      console.warn('[OutcomeRange] Narrow range detected:', { | console_message
src/components/BiasesCarousel/index.tsx:17:    console.warn('BiasesCarousel rendered with:', { | console_message
src/components/ErrorBoundary.tsx:27:    console.error('Error caught by boundary:', error); | console_message
src/components/ErrorBoundary.tsx:28:    console.error('Error info:', errorInfo); | console_message
src/components/LandingPage.tsx:108:      console.error('Registration error:', error); | console_message
src/components/LandingPage.tsx:145:      console.error('Access code validation error:', error); | console_message
src/components/GraphCanvas.tsx:404:                if ((import.meta as any)?.env?.MODE === 'development') console.warn('GraphCanvas: missing node(s) for edge', { i, edge }) | console_message
src/adapters/cee/client.ts:697:        console.warn('[CEE] Pipeline trace extraction failed for V3 response:', { | console_message
src/adapters/cee/client.ts:724:        console.warn('[CEE] Pipeline trace extraction failed for V2 response:', { | console_message
src/adapters/cee/client.ts:793:    console.warn('[CEE] framingFeedback() is deprecated. CEE requires a graph for bias-check.') | console_message
src/components/assistants/OptionsTiles.tsx:58:      console.error('[OptionsTiles] Failed to generate options:', err) | console_message
src/components/CollaborativeOptions/OptionCard.tsx:43:      console.error('Failed to update option:', err); | console_message
src/components/CollaborativeOptions/OptionCard.tsx:54:      console.error('Failed to delete option:', err); | console_message
src/components/DebugTray.tsx:66:      console.error('[DebugTray] Failed to copy to clipboard:', error) | console_message
src/components/CollaborativeOptions/index.tsx:42:      console.error('Failed to add option:', err); | console_message
src/components/CollaborativeOptions/index.tsx:54:      console.error('Failed to merge options:', err); | console_message
src/components/layout/TopBar.tsx:173:      console.error('Save failed:', error) | console_message
src/components/layout/TopBar.tsx:482:                onClick={() => console.warn('Export')} | console_message
src/components/layout/TopBar.tsx:490:                onClick={() => console.warn('Version history')} | console_message
src/components/assistants/StreamingMonitor.tsx:51:          console.warn(`[StreamingMonitor] Timeout detected (${timeSinceLastEvent}ms since last event)`) | console_message
src/components/Analysis.tsx:106:    console.warn("Missing required state for Analysis component, redirecting.", state); | console_message
src/components/Analysis.tsx:199:       console.error("Error creating permanent decision:", err); | console_message
src/components/Analysis.tsx:232:          console.warn(`RPC error fetching collaborators: ${error.message}`); | console_message
src/components/Analysis.tsx:238:        console.error('RPC method failed, falling back to direct query:', rpcError); | console_message
src/components/Analysis.tsx:285:      console.error('Caught error fetching collaborators:', err); | console_message
src/components/Analysis.tsx:290:            console.warn(`[WARN] Retrying collaborators fetch in ${retryDelay}ms (attempt ${collaborationRetryCount + 1}/3)`); | console_message
src/components/Analysis.tsx:303:            console.error('Max retry attempts reached for fetching collaborators'); | console_message
src/components/Analysis.tsx:356:      console.error('Error inviting collaborator:', err); | console_message
src/components/Analysis.tsx:379:      console.error('Error removing collaborator:', err); | console_message
src/components/Analysis.tsx:401:      console.error('Error updating collaboration settings:', err); | console_message
src/components/Analysis.tsx:443:                 console.error("Failed to establish permanent ID."); | console_message
src/components/Analysis.tsx:480:          console.error("[ERROR] Auto-save failed:", error); | console_message
src/components/Analysis.tsx:483:        console.error("Unexpected error during auto-save effect:", err); | console_message
src/components/teams/EditTeamModal.tsx:31:      console.error('Failed to update team:', err); | console_message
src/canvas/utils/shareLink.ts:39:      console.warn('[ShareLink] Invalid characters in run hash:', decoded.slice(0, 20)) | console_message
src/canvas/utils/shareLink.ts:44:      console.warn('[ShareLink] Run hash too long:', decoded.length) | console_message
src/canvas/utils/shareLink.ts:59:      console.warn('[ShareLink] Run hash too short:', hash.length) | console_message
src/canvas/utils/shareLink.ts:64:      console.warn('[ShareLink] Run hash contains non-hex characters') | console_message
src/canvas/utils/shareLink.ts:70:    console.error('[ShareLink] Failed to parse run hash:', err) | console_message
src/components/OptionsIdeation.tsx:79:      console.error(err) | console_message
src/canvas/utils/autoFix.ts:74:      console.warn('[autoFix] normalizeProbabilities called with non-existent nodeId:', nodeId) | console_message
src/canvas/utils/autoFix.ts:82:      console.warn('[autoFix] normalizeProbabilities called on non-decision node:', nodeId, 'kind:', sourceNode.data?.kind) | console_message
src/canvas/utils/autoFix.ts:107:      console.warn('[autoFix] normalizeProbabilities: decision node has no outgoing option edges:', nodeId) | console_message
src/adapters/driversAdapter.ts:165:      console.warn('[DriversAdapter] mapPloTEdgeIdToUI received non-string:', { | console_message
src/adapters/driversAdapter.ts:185:      console.warn('[DriversAdapter] Invalid PLoT edge ID format:', plotEdgeId) | console_message
src/adapters/driversAdapter.ts:200:      console.warn('[DriversAdapter] No UI edge found for PLoT ID:', plotEdgeId, { from, to }) | console_message
src/adapters/driversAdapter.ts:208:      console.warn('[DriversAdapter] Index out of range for PLoT ID:', plotEdgeId, { | console_message
src/adapters/driversAdapter.ts:430:    console.warn('[DriversAdapter] Using legacy fallback - drivers_payload not present') | console_message
src/components/teams/MyTeams.tsx:110:      console.error('Failed to delete team:', err); | console_message
src/adapters/plot/enrichment.ts:505:      console.error('[PLoT Enrichment] Failed to extract robustness:', error) | console_message
src/adapters/plot/enrichment.ts:616:      console.error('[PLoT Enrichment] Failed to extract validation:', error) | console_message
src/components/Analysis/AnalysisContent.tsx:11:    console.warn('AnalysisContent props:', { | console_message
src/components/Analysis/AnalysisContent.tsx:21:    console.warn('AnalysisContent: No text provided'); | console_message
src/components/Analysis/AnalysisContent.tsx:34:    console.warn('AnalysisContent: Formatting complete', { | console_message
src/components/Analysis/AnalysisContent.tsx:47:    console.error('Error in AnalysisContent:', error); | console_message
src/adapters/assistants/http.ts:132:      console.error('[DRAFT_GRAPH_FAILED]', { reason: 'timeout', correlationId }) | console_message
src/adapters/assistants/http.ts:137:      console.error('[DRAFT_GRAPH_FAILED]', { reason: (err as any).code, correlationId }) | console_message
src/adapters/assistants/http.ts:141:    console.error('[DRAFT_GRAPH_FAILED]', { reason: 'network', correlationId, error: err }) | console_message
src/adapters/assistants/http.ts:204:      console.error('[DRAFT_GRAPH_FAILED]', { reason: 'timeout', correlationId, streaming: true }) | console_message
src/adapters/assistants/http.ts:209:      console.error('[DRAFT_GRAPH_FAILED]', { reason: (err as any).code, correlationId, streaming: true }) | console_message
src/adapters/assistants/http.ts:213:    console.error('[DRAFT_GRAPH_FAILED]', { reason: 'network', correlationId, streaming: true, error: err }) | console_message
src/adapters/assistants/http.ts:253:            console.warn('[assistants] Malformed SSE event:', data) | console_message
src/components/ProsConsList/ProsConsList.tsx:88:        console.error('[ProsConsList] Error processing options:', err); | console_message
src/components/ProsConsList/ProsConsList.tsx:95:      console.error('[ProsConsList] Invalid options format:', newOptions); | console_message
src/components/teams/CreateTeamModal.tsx:30:      console.error('Failed to create team:', err); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:20:  console.warn('Formatting analysis content:', { | console_message
src/components/Analysis/utils/formatAnalysis.tsx:33:    console.warn('Error parsing content as JSON:', error); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:64:      console.warn('Failed to stringify object:', e); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:75:    console.warn('Invalid sections format:', sections); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:80:  console.warn('Rendering sections:', { | console_message
src/components/Analysis/utils/formatAnalysis.tsx:90:          console.warn('Invalid section:', section); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:105:                console.warn('Invalid list content:', section.content); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:106:                console.warn('Section causing issue:', section); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:124:                console.warn('Invalid table content:', section.content); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:125:                console.warn('Section causing issue:', section); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:209:              console.warn('Unknown section type:', section.type); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:213:          console.error('Error rendering section:', error, section); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:223:    console.warn('Invalid content type:', typeof content); | console_message
src/components/Analysis/utils/formatAnalysis.tsx:228:  console.warn('Formatting text content:', { | console_message
src/adapters/plot/v2/adapter.ts:113:            console.warn( | console_message
src/adapters/plot/v2/adapter.ts:123:            console.warn( | console_message
src/adapters/plot/v2/adapter.ts:205:    console.error(`[V2Adapter] Unknown option status "${String(status)}", returning 'unknown'`) | console_message
src/adapters/plot/v2/adapter.ts:256:    console.warn('[V2Adapter] ceeOptionToV2Option input:', { | console_message
src/adapters/plot/v2/adapter.ts:279:    console.warn('[V2Adapter] ceeOptionToV2Option output:', { | console_message
src/adapters/plot/v2/adapter.ts:585:      console.warn('[Adapter] Strength clamped:', { | console_message
src/adapters/plot/v2/adapter.ts:627:    console.warn('[Adapter] Edge to PLoT:', { | console_message
src/adapters/plot/v2/adapter.ts:729:    console.warn('[V2Adapter] Node IDs were normalised:', { | console_message
src/adapters/plot/v2/adapter.ts:853:    console.warn('[V2Adapter] Node IDs were normalised from analysis_ready:', { | console_message
src/adapters/plot/v2/adapter.ts:1031:          console.warn('[V2Adapter] Failed to parse error response as JSON:', parseError) | console_message
src/adapters/plot/v2/adapter.ts:1128:    console.warn('[V2Adapter] Sending request:', { | console_message
src/adapters/plot/v2/adapter.ts:1144:    console.warn('[V2Adapter] Response:', { | console_message
src/adapters/plot/v2/adapter.ts:1222:    console.warn('[V2Adapter] Sending request (via analysisReady path):', { | console_message
src/adapters/plot/v2/adapter.ts:1235:    console.warn('[V2Adapter] Final request options:', request.options.map((o) => ({ | console_message
src/adapters/plot/v2/adapter.ts:1250:    console.warn('[V2Adapter] Response:', { | console_message
src/components/ProsConsList/hooks/useOptionsHistory.ts:53:      console.error('Failed to add to history:', error instanceof Error ? error.message : 'Unknown error'); | console_message
src/components/ProsConsList/hooks/useOptionsHistory.ts:69:      console.error('Undo operation failed:', error instanceof Error ? error.message : 'Unknown error'); | console_message
src/components/ProsConsList/hooks/useOptionsHistory.ts:87:      console.error('Redo operation failed:', error instanceof Error ? error.message : 'Unknown error'); | console_message
src/canvas/panels/TemplatesPanel.tsx:65:            console.error('❌ Invalid templates response:', list) | console_message
src/canvas/panels/TemplatesPanel.tsx:83:          console.error('❌ Failed to load templates from PLoT engine:', err) | console_message
src/canvas/panels/TemplatesPanel.tsx:228:          console.warn('[VersionCapture]', { | console_message
src/canvas/panels/TemplatesPanel.tsx:242:        console.error('Failed to load template:', err) | console_message
src/canvas/panels/TemplatesPanel.tsx:337:        console.error('Failed to merge template:', err) | console_message
src/canvas/panels/TemplatesPanel.tsx:518:        console.error('Failed to merge template:', err) | console_message
src/components/ProsConsList/hooks/history/historyOperations.ts:50:    console.error('Invalid history state encountered during undo'); | console_message
src/components/ProsConsList/hooks/history/historyOperations.ts:75:    console.error('Invalid history state encountered during redo'); | console_message
src/canvas/panels/TemplateCard.tsx:63:                console.warn('[TemplateCard] Debounced duplicate click on:', template.name) | console_message
src/canvas/panels/TemplateCard.tsx:85:                    console.warn('[TemplateCard] Debounced duplicate merge click on:', template.name) | console_message
src/components/ProsConsList/hooks/history/utils.ts:68:    console.warn('Error comparing states:', error); | console_message
src/canvas/panels/ResultsPanel.tsx:214:      console.error('[ResultsPanel] Force re-run failed:', err) | console_message
src/canvas/panels/ResultsPanel.tsx:284:      console.error('[ResultsPanel] Run failed:', err) | console_message
src/adapters/plot/v2/responseMapper.ts:257:        console.warn('[pickFactorSensitivityForUi] Using downstream_calls.isl.response.factor_sensitivity:', { | console_message
src/adapters/plot/v2/responseMapper.ts:307:        console.warn('[pickFactorSensitivityForUi] Using enrichment factors:', { | console_message
src/adapters/plot/v2/responseMapper.ts:341:    console.warn('[pickFactorSensitivityForUi] Using top-level factor_sensitivity:', { | console_message
src/adapters/plot/v2/responseMapper.ts:368:    console.warn('[responseMapper] === DIAGNOSTIC ===') | console_message
src/adapters/plot/v2/responseMapper.ts:369:    console.warn('[responseMapper] Input keys:', Object.keys(v2Response || {})) | console_message
src/adapters/plot/v2/responseMapper.ts:370:    console.warn('[responseMapper] option_comparison:', v2Response?.option_comparison) | console_message
src/adapters/plot/v2/responseMapper.ts:371:    console.warn('[responseMapper] edge_sensitivity count:', v2Response?.edge_sensitivity?.length ?? 0) | console_message
src/adapters/plot/v2/responseMapper.ts:372:    console.warn('[responseMapper] robustness:', v2Response?.robustness) | console_message
src/adapters/plot/v2/responseMapper.ts:373:    console.warn('[responseMapper] critiques count:', v2Response?.critiques?.length) | console_message
src/adapters/plot/v2/responseMapper.ts:374:    console.warn('[responseMapper] === END DIAGNOSTIC ===') | console_message
src/adapters/plot/v2/responseMapper.ts:445:      console.warn('[responseMapper] Detected computed-but-empty anomalies:', anomalies) | console_message
src/adapters/plot/v2/responseMapper.ts:708:    console.warn('[createDriversPayloadFromV2] Factor sensitivity source:', _source_path) | console_message
src/adapters/plot/v2/responseMapper.ts:1010:    console.warn('[createEnrichmentFromV2Response] Raw factor_sensitivity sample:', { | console_message
src/adapters/plot/v2/responseMapper.ts:1388:    console.warn('[buildDriversBlock] Factor sensitivity fields:', { | console_message
src/components/ProsConsList/hooks/history/useHistoryStack.ts:49:      console.error('Undo stack operation failed:', error instanceof Error ? error.message : 'Unknown error'); | console_message
src/components/ProsConsList/hooks/history/useHistoryStack.ts:73:      console.error('Redo stack operation failed:', error instanceof Error ? error.message : 'Unknown error'); | console_message
src/components/decisions/DecisionList.tsx:111:      console.error('Failed to fetch decisions:', err); | console_message
src/components/decisions/DecisionList.tsx:291:    console.warn(`Bulk action: ${action} on decisions:`, selectedDecisions); | console_message
src/components/decisions/DecisionList.tsx:662:                                console.warn('Duplicate', decision.id); | console_message
src/components/decisions/DecisionList.tsx:673:                                console.warn('Share', decision.id); | console_message
src/components/decisions/DecisionList.tsx:684:                                console.warn('Delete', decision.id); | console_message
src/adapters/plot/v2/types.ts:753:      console.warn('[V2 Sanitisation] Applied to V2RunResponse:', { | console_message
src/adapters/plot/reconnection.ts:193:      console.error('[Reconnection] Error:', error) | console_message
src/adapters/plot/reconnection.ts:204:        console.warn('[Reconnection] Ignoring duplicate completion event') | console_message
src/adapters/plot/reconnection.ts:268:        console.warn(`[Heartbeat] Timeout after ${elapsed}ms`) | console_message
src/adapters/plot/reconnection.ts:305:          console.error('[Reconnection] Max attempts exceeded, giving up') | console_message
src/components/results/useResultsSectionData.ts:428:      console.warn('[Results] Percentile ordering violated - reordering:', { p10, p50, p90 }) | console_message
src/components/results/useResultsSectionData.ts:950:        console.warn('[Results] Denorm trace:', { goalThresholdCap, rawP10, rawP50, rawP90, normP10: norm.p10, normP90: norm.p90 }) | console_message
src/components/results/useResultsSectionData.ts:1081:      console.warn('[useResultsSectionData] UI-SEM-005 fallback: derived robustnessLevel=%s from stability=%s (PLoT omitted level)', robustnessLevel, recommendationStability) | console_message
src/components/results/useResultsSectionData.ts:1260:      console.warn('[useResultsSectionData] Raw factor_sensitivity from PLoT:', { | console_message
src/components/results/useResultsSectionData.ts:1693:      console.warn('[REPORT_SOURCE_DEBUG]', { | console_message
src/components/results/useResultsSectionData.ts:1703:      console.warn('[FRAGILE_EDGES_SOURCE]', { | console_message
src/components/results/useResultsSectionData.ts:1819:        console.warn(`[useResultsSectionData] Fragile edge from_label ABSENT, using graph lookup: ${fromId} → "${graphFromLabel}"`) | console_message
src/components/results/useResultsSectionData.ts:1822:        console.warn(`[useResultsSectionData] Fragile edge to_label ABSENT, using graph lookup: ${toId} → "${graphToLabel}"`) | console_message
src/components/results/useResultsSectionData.ts:1874:        console.warn('[useResultsSectionData] Unrecognized fragile edge id format:', edgeId) | console_message
src/components/results/useResultsSectionData.ts:1896:        console.warn('[UNCERTAINTY_DEBUG]', { | console_message
src/components/results/useResultsSectionData.ts:1908:        console.warn('[FragileEdge:RAW]', { | console_message
src/components/results/useResultsSectionData.ts:1962:        console.warn('[FragileEdge:RESOLVED]', { | console_message
src/components/results/GraphLink.tsx:79:      console.warn(`GraphLink fallback: no targetId for "${label}"`) | console_message
src/components/ProsConsList/hooks/storage/useLocalStorage.ts:33:      console.error( | console_message
src/components/ProsConsList/hooks/storage/useLocalStorage.ts:59:        console.error(`Error saving to localStorage: ${ERROR_MESSAGES.SAVE}`, { | console_message
src/components/ProsConsList/hooks/storage/useLocalStorage.ts:80:      console.error(`Error removing from localStorage: ${ERROR_MESSAGES.REMOVE}`, { | console_message
src/adapters/plot/httpV1Adapter.ts:152:      console.warn(`⚠️  [httpV1Adapter] ${errorMsg}`) | console_message
src/adapters/plot/httpV1Adapter.ts:153:      console.warn('   This is acceptable in dev, but must be fixed before production.') | console_message
src/adapters/plot/httpV1Adapter.ts:233:        console.warn('[httpV1Adapter] Stripped debug text from confidence.why:', reason) | console_message
src/adapters/plot/httpV1Adapter.ts:524:          console.error('[httpV1] Invalid templates response:', response) | console_message
src/adapters/plot/httpV1Adapter.ts:638:        console.warn('[httpV1] /v1/limits failed, using fallback constants:', error.message) | console_message
src/adapters/plot/httpV1Adapter.ts:653:      console.error('[httpV1] /v1/limits failed in production:', error) | console_message
src/adapters/plot/httpV1Adapter.ts:859:              console.warn( | console_message
src/adapters/plot/mockAdapter.ts:132:  console.warn(`[mockAdapter] Unknown template ID "${id}", using default template`) | console_message
src/adapters/plot/v1/http.ts:86:        console.warn('[plot/v1] /version returned non-OK, using empty capabilities') | console_message
src/adapters/plot/v1/http.ts:107:      console.warn('[plot/v1] Failed to fetch capabilities:', err) | console_message
src/adapters/plot/v1/http.ts:377:      console.warn(`[plot/v1] Backend does not support detail_level=${desiredDetailLevel}, omitting parameter`) | console_message
src/adapters/plot/v1/http.ts:511:    console.warn('[plot/v1] Cancel failed:', err) | console_message
src/components/results/DriversSection.tsx:790:      console.warn('[DriversSection] Data diagnostic:', { | console_message
src/adapters/plot/v1/sseClient.ts:161:              console.warn('[plot/v1] Failed to parse SSE event:', err) | console_message
src/adapters/plot/v1/sseClient.ts:258:      console.warn('[plot/v1] Unknown SSE event type:', eventType) | console_message
src/adapters/plot/v1/limits.ts:135:      console.warn('[limits] Fetch failed, using defaults:', err) | console_message
src/adapters/plot/autoDetectAdapter.ts:104:    console.error('[AutoDetect]', errorMsg) | console_message
src/adapters/plot/autoDetectAdapter.ts:116:    console.error('[AutoDetect]', errorMsg) | console_message
src/adapters/plot/autoDetectAdapter.ts:128:    console.error('[AutoDetect]', errorMsg) | console_message
src/components/results/utils/humaniseCritique.ts:198:    console.warn('[humaniseCritique] Unmapped critique code:', item.code, '| Raw message:', item.message) | console_message
src/adapters/plot/v1/probe.ts:169:          console.warn(`[Probe] Both /v1/health and /health failed (fallback: ${fallbackResponse.status})`); | console_message
src/adapters/plot/v1/probe.ts:190:      console.error('[Probe] Failed to probe capabilities:', err); | console_message
src/canvas/panels/AIClarifierChat.tsx:133:      console.error('Clarifier draft failed:', err) | console_message
src/adapters/plot/v1/etagCache.ts:76:      console.error('[etagCache] Failed to hydrate from localStorage:', err) | console_message
src/adapters/plot/v1/etagCache.ts:105:        console.warn('[etagCache] localStorage quota exceeded - falling back to in-memory only cache') | console_message
src/adapters/plot/v1/etagCache.ts:108:        console.warn('[etagCache] Failed to persist to localStorage:', err) | console_message
src/adapters/plot/v1/limitsManager.ts:129:        console.warn('[limitsManager] Failed to fetch limits from API, using static fallback:', err) | console_message
src/adapters/plot/v1/limitsManager.ts:163:      console.warn('[hydrateLimitsAtBoot] Failed:', err) | console_message
src/components/results/TornadoChart.tsx:346:    console.warn('Tornado: goal direction unknown, using neutral colours') | console_message
src/adapters/plot/v1/health.ts:43:      console.warn('[health] Probe failed:', err) | console_message
```

## 14. JSX_TEXT (jsx_text) — major user-facing static strings

### Span text (non-test, non-debug files)
```
src/routes/PlotShowcase.tsx:353:              <span className="text-sm font-medium text-gray-700">Live stream</span> | jsx_text
src/routes/PlotShowcase.tsx:417:                    <span className="px-2 py-1 text-xs font-medium bg-panel text-warning rounded">Demo data</span> | jsx_text
src/routes/PlotShowcase.tsx:544:                          💡 <span className="font-semibold">Counter it:</span> {bias.mitigation} | jsx_text
src/routes/SandboxV1.tsx:338:              <span className="text-sm font-medium text-gray-700">Live stream</span> | jsx_text
src/routes/SandboxV1.tsx:402:                    <span className="px-2 py-1 text-xs font-medium bg-panel text-warning rounded">Demo data</span> | jsx_text
src/routes/SandboxV1.tsx:529:                          💡 <span className="font-semibold">Counter it:</span> {bias.mitigation} | jsx_text
src/pages/ScenarioListPage.tsx:487:                      {scenario.title || <span className="text-text-light">Untitled decision</span>} | jsx_text
src/canvas/conversation/dropdowns/ThinkingModeDropdown.tsx:153:        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-header, #262626)' }}>Thinking mode</span> | jsx_text
src/canvas/compare-tab/TrajectorySection.tsx:141:        <span className={typography.panelHeader}>How the recommendation evolved</span> | jsx_text
src/poc/AppPoC.tsx:671:                          <span style={{ fontSize: '14px' }}>Live stream</span> | jsx_text
src/canvas/compare-tab/TransitionsSection.tsx:25:        <span className={typography.panelHeader}>What changed and why</span> | jsx_text
src/canvas/nodes/GoalNode.tsx:144:            <span className={`${typography.edgeLabel} text-text-light`}>Decision stability</span> | jsx_text
src/canvas/compare/CompareSummary.tsx:40:              <span className="text-gray-600">No changes</span> | jsx_text
src/canvas/compare/CompareSummary.tsx:54:              <span className="text-gray-600">No changes</span> | jsx_text
src/canvas/panels/IssuesPanel.tsx:180:              <span className="font-medium">Why this matters</span> | jsx_text
src/canvas/ErrorBoundary.tsx:213:              <span>Running in degraded mode after an error. Some features may not work.</span> | jsx_text
src/canvas/nodes/FactorNode.tsx:293:            <span className={`${typography.edgeLabel} text-text-body`}>Key assumption unvalidated. Your result depends on this.</span> | jsx_text
src/canvas/conversation/ModelReceiptBlock.tsx:67:        <span className={typography.panelHeader}>Model generated</span> | jsx_text
src/pages/sandbox-guide/components/canvas/NodeTooltip.tsx:89:          <span className="text-storm-600">Influenced by</span> | jsx_text
src/canvas/conversation/zones/ChatTopBar.tsx:106:            <span>Run analysis</span> | jsx_text
src/canvas/ui/NodeInspectorCompact.tsx:197:            <span className={`${typography.panelMeta} text-text-light`}>Current value</span> | jsx_text
src/canvas/ui/NodeInspectorCompact.tsx:272:                  <span>High influence but low confidence. Consider gathering more data to reduce uncertainty.</span> | jsx_text
src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:333:                <><span className={`${typography.panelMeta} text-text-light`}>Unlikely</span><span className={`${typography.panelMeta} text-text-light`}>Very likely</span></> | jsx_text
src/canvas/components/InsightsTab.tsx:78:          <span className={typography.body}>Analysing decision...</span> | jsx_text
src/canvas/ui/inspector-v2/panels/FactorObservablePanel.tsx:147:          <span className={`${typography.panelMeta} text-text-light italic`}>No value set</span> | jsx_text
src/canvas/ui/inspector/StrengthBar.tsx:28:        <span className={`${typography.panelMeta} text-text-light`}>Effect size</span> | jsx_text
src/canvas/ui/EdgeInspector.tsx:486:          <span className={`${typography.panelMeta} text-text-light`}>Uncertainty in effect size</span> | jsx_text
src/canvas/ui/inspector/GoalThresholdEditor.tsx:80:        <span className={`${typography.panelBody} text-text-body`}>Success means reaching</span> | jsx_text
src/canvas/ui/inspector/SignedStrengthSlider.tsx:86:          <span className={`${typography.panelMeta} text-danger`}>Strong negative</span> | jsx_text
src/canvas/ui/inspector/SignedStrengthSlider.tsx:87:          <span className={`${typography.panelMeta} text-text-light`}>No effect</span> | jsx_text
src/canvas/ui/inspector/SignedStrengthSlider.tsx:88:          <span className={`${typography.panelMeta} text-success`}>Strong positive</span> | jsx_text
src/canvas/ui/inspector-v2/panels/OutcomePanel.tsx:213:            <span className={`${typography.panelHeader} text-xs`}>Contributes to your goal</span> | jsx_text
src/canvas/ui/NodeInspector.tsx:375:              <span>High influence but low confidence. Consider gathering more data to reduce uncertainty.</span> | jsx_text
src/canvas/ui/NodeInspector.tsx:442:              <span className={`${typography.panelMeta} text-text-light`}>Goal probability</span> | jsx_text
src/canvas/ui/NodeInspector.tsx:449:              <span className={`${typography.panelMeta} text-text-light`}>Recommendation stability</span> | jsx_text
src/canvas/ui/NodeInspector.tsx:462:            <span className={`${typography.panelMeta} text-text-light`}>Win probability</span> | jsx_text
src/canvas/components/DecisionReviewPanel.tsx:185:        <span>Debug trace</span> | jsx_text
src/components/decisions/DecisionList.tsx:376:                  <span>Create a new decision by clicking the button above</span> | jsx_text
src/components/decisions/DecisionList.tsx:380:                  <span>Fill in the details about your decision</span> | jsx_text
src/components/decisions/DecisionList.tsx:384:                  <span>Use our AI-powered analysis to help you make better choices</span> | jsx_text
src/components/layout/UserAvatarMenu.tsx:84:              <span className={typography.bodySmall}>My decisions</span> | jsx_text
src/components/layout/UserAvatarMenu.tsx:93:              <span className={typography.bodySmall}>Profile settings</span> | jsx_text
src/components/layout/UserAvatarMenu.tsx:105:              <span className={typography.bodySmall}>Sign out</span> | jsx_text
src/canvas/components/ObjectiveBanner.tsx:35:          <span className={`${typography.label} text-sky-900`}>Your objective</span> | jsx_text
src/canvas/components/UnknownKindWarning.tsx:29:      <span className="font-medium">Unknown type</span> | jsx_text
src/components/layout/TopBar.tsx:346:            <span>Save failed — retrying</span> | jsx_text
src/components/layout/TopBar.tsx:504:                <span>Show onboarding tour</span> | jsx_text
src/components/layout/TopBar.tsx:513:                <span>Keyboard shortcuts</span> | jsx_text
src/components/layout/TopBar.tsx:522:                <span>Influence explainer</span> | jsx_text
src/components/layout/TopBar.tsx:590:                    <span>Snap to Grid</span> | jsx_text
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:1822:            <span className={`${typography.caption} text-ink-500`}>Can analyse:</span> | jsx_text
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:1850:            <span className={`${typography.caption} text-ink-500`}>Model quality:</span> | jsx_text
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:2028:                    <span className={`${typography.caption} text-ink-500`}>Range coverage:</span> | jsx_text
src/canvas/components/WhatChangedChip.tsx:154:      <span>What changed: {parts.join(' • ')}</span> | jsx_text
src/components/Analysis.tsx:641:                      <span className="text-gray-500">Loading collaborators...</span> | jsx_text
src/components/ConfigDrawer.tsx:136:          <span className="text-[11px] text-gray-500">Leave blank to use relative routes.</span> | jsx_text
src/components/ConfigDrawer.tsx:150:              <span className="text-[11px] text-warning" data-testid="budget-hint">Budget looks invalid or ≤ 0 (saved anyway).</span> | jsx_text
src/components/ConfigDrawer.tsx:166:          <span>Sim mode (fixtures only)</span> | jsx_text
src/canvas/components/RiskProfileBadge.tsx:79:        <span className={typography.caption}>Set risk tolerance</span> | jsx_text
src/canvas/components/LimitsPanel.tsx:183:                <span className={`${typography.label} text-ink-900`}>Engine p95 Budget</span> | jsx_text
src/canvas/components/AdvancedSettingsPanel.tsx:199:                <span className="sr-only">Structural uncertainty (coming soon)</span> | jsx_text
src/components/BiasesCarousel/index.tsx:44:            <span className="text-gray-600">Loading cognitive biases...</span> | jsx_text
src/canvas/components/ConformalPrediction.tsx:72:              <span className={typography.body}>Computing intervals...</span> | jsx_text
src/canvas/components/DriverChips.tsx:398:            <span>Add evidence</span> | jsx_text
src/canvas/components/DriversSignal.tsx:420:                <span>Try adding more factors that differentiate your options.</span> | jsx_text
src/canvas/components/DriversSignal.tsx:447:          <span className={`${typography.body} font-medium text-ink-800`}>Key factors</span> | jsx_text
src/canvas/components/TemplateSkeleton.tsx:32:      <span className="sr-only">Loading templates...</span> | jsx_text
src/canvas/components/GuidedLayoutDialog.tsx:216:            <span className={`${typography.body} text-gray-700`}>Respect locked node positions</span> | jsx_text
src/components/SandboxStreamPanel.tsx:804:          <span aria-hidden="true">Import template '{scenarioPreview.name}' (seed {scenarioPreview.seed || '—'}, budget {scenarioPreview.budget || '—'}, model {scenarioPreview.model || '—'})?</span> | jsx_text
src/components/SandboxStreamPanel.tsx:892:            <span>Hide weaker links (&lt;{T.toFixed(1)})</span> | jsx_text
src/components/SandboxStreamPanel.tsx:1177:          <span data-testid="scenario-import-note" className="ml-2 text-xs text-gray-500" aria-hidden="true">Invalid scenario link</span> | jsx_text
src/components/coaching/CoachingNudge.tsx:62:          <span className={styles.label}>Olumi noticed</span> | jsx_text
src/canvas/components/ActionsSignal.tsx:209:          <span className={`${typography.body} text-sand-600`}>Checking for improvements...</span> | jsx_text
src/canvas/components/ActionsSignal.tsx:351:              <span className={`${typography.caption} text-sky-600`}>Click to focus</span> | jsx_text
src/components/ScenarioDrawer.tsx:102:            <span>Remember last template</span> | jsx_text
src/canvas/components/ComparisonCanvasLayout.tsx:222:        <span className="font-medium">Structural changes:</span> | jsx_text
src/canvas/components/InterventionDisplay.tsx:137:        <span>No interventions specified</span> | jsx_text
src/canvas/components/InterventionDisplay.tsx:273:      <span className="text-carrot-600 text-xs">No interventions</span> | jsx_text
src/canvas/components/InputsDock.tsx:242:        <span className="font-medium text-ink-900">Last run:</span>{' '} | jsx_text
src/canvas/components/InputsDock.tsx:351:          <span>Last fetched</span> | jsx_text
src/canvas/components/ChangeAttributionPanel.tsx:251:          <span className={typography.body}>No changes recorded</span> | jsx_text
src/canvas/components/DraftPreview.tsx:141:                  <span>Adding to canvas...</span> | jsx_text
src/canvas/components/DecisionSummary.tsx:591:                <span className={`${typography.caption} text-ink-500`}>Key driver: </span> | jsx_text
src/canvas/components/ResultsSkeleton.tsx:42:      <span className="sr-only">Analysing decision graph...</span> | jsx_text
src/canvas/components/DocumentsManager.tsx:148:            <span className="text-gray-600">Sort by:</span> | jsx_text
src/canvas/components/StructuralHealth.tsx:24:          <span className={typography.body}>All nodes properly connected</span> | jsx_text
src/components/assistants/DraftStreamPanel.tsx:59:            <span className="font-medium text-ink-900">Drafting your model...</span> | jsx_text
src/components/assistants/DraftStreamPanel.tsx:65:            <span className="font-medium text-ink-900">Draft complete!</span> | jsx_text
src/canvas/components/ResultsPanelSkeleton.tsx:238:      <span className="sr-only">Loading analysis results, please wait...</span> | jsx_text
src/canvas/components/GoalNodeSelector.tsx:91:          <span className="text-sm text-carrot-600">No goal nodes</span> | jsx_text
src/components/teams/ManageTeamMembersModal.tsx:377:                  <span>Loading invitations…</span> | jsx_text
src/canvas/components/pre-analysis/expertise/YourExpertise.tsx:108:          <span className={`${typography.panelHeader} text-text-header`}>Your expertise</span> | jsx_text
src/canvas/components/pre-analysis/expertise/MissingData.tsx:83:              <span className={`${typography.panelMeta} text-text-light`}>No data</span> | jsx_text
src/canvas/components/OutputsDock.tsx:1541:              <span className={`${typography.body} text-ink-900`}>Generating comparison...</span> | jsx_text
src/canvas/components/OutputsDock.tsx:1685:          <span className={`${typography.code} font-medium text-ink-900`}>Reference run</span> | jsx_text
src/canvas/components/OutputsDock.tsx:1701:          <span className={`${typography.code} font-medium text-ink-900`}>Current run</span> | jsx_text
src/canvas/components/pre-analysis/SuccessTarget.tsx:218:          <span className={`${typography.panelBody} text-text-light`}>No goal selected</span> | jsx_text
src/canvas/components/pre-analysis/SuccessTarget.tsx:353:        <span className={`${typography.panelBody} text-text-light shrink-0 mt-0.5`}>Success target:</span> | jsx_text
src/canvas/components/model-tab/ModelHealthSection.tsx:148:                  <span className={`${typography.panelMeta} text-text-light`}>Response hash</span> | jsx_text
src/canvas/components/model-tab/ModelHealthSection.tsx:180:                  <span className={`${typography.panelMeta} text-text-light`}>Stability penalty</span> | jsx_text
src/canvas/components/model-tab/ModelHealthSection.tsx:190:                <span className={`${typography.panelMeta} text-text-light`}>Repairs applied: </span> | jsx_text
src/canvas/components/model-tab/ModelHealthSection.tsx:197:                <span className={`${typography.panelMeta} text-text-light`}>Inference warnings: </span> | jsx_text
src/canvas/components/ModelHealthSection.tsx:127:            <span>Model health: ready</span> | jsx_text
src/components/assistants/StreamingMonitor.tsx:67:          <span className="text-info font-medium">Streaming response...</span> | jsx_text
src/components/assistants/StreamingMonitor.tsx:75:          <span className="text-success font-medium">Stream complete</span> | jsx_text
src/canvas/components/pre-analysis/OptionPreview.tsx:224:          <span className={`${typography.panelHeader} text-text-body`}>Your options</span> | jsx_text
src/canvas/components/pre-analysis/DecisionQualityChecks.tsx:264:          <span className={`${typography.panelHeader} text-text-body`}>Sharpen your thinking</span> | jsx_text
src/canvas/components/SettingsPanel.tsx:93:          <span className={`${typography.label} text-gray-700`}>Snap to Grid</span> | jsx_text
src/canvas/components/model-tab/GoalSection.tsx:108:          <span className={`${typography.panelBody} text-text-light`} data-testid="goal-threshold-not-set">Not set</span> | jsx_text
src/canvas/components/model-tab/GoalSection.tsx:116:          <span className={`${typography.panelMeta} text-text-light`}>Set a success target to help the analysis measure your options</span> | jsx_text
src/canvas/components/model-tab/GoalSection.tsx:141:            <span className={`${typography.panelMeta} text-text-light`}>Normalised target</span> | jsx_text
src/components/assistants/DraftForm.tsx:151:              <span className="text-sm text-gray-600">Upload file (.txt, .md, .csv)</span> | jsx_text
src/canvas/components/model-tab/FactorsSection.tsx:379:                    <span className={`${typography.panelMeta} text-text-light`}>Prior range</span> | jsx_text
src/canvas/components/model-tab/FactorsSection.tsx:387:                    <span className={`${typography.panelMeta} text-text-light`}>Normalised value</span> | jsx_text
src/canvas/components/model-tab/FactorsSection.tsx:411:                  <span className={`${typography.panelMeta} text-text-light`}>Uncertainty drivers</span> | jsx_text
src/canvas/components/model-tab/FactorsSection.tsx:434:                    <span className={`${typography.panelMeta} text-text-light`}>Rank flip rate</span> | jsx_text
src/components/results/RecommendationSection.tsx:146:          <span>Analysis could not complete</span> | jsx_text
src/components/results/ResultsBody.tsx:223:                <span className={`${typography.panelMeta} text-text-light`}>Risk appetite:</span> | jsx_text
src/canvas/components/model-tab/ContestedEdgeCard.tsx:225:            <span className={`${typography.panelMeta} text-text-light`}>Current model:</span> | jsx_text
src/canvas/components/model-tab/ContestedEdgeCard.tsx:234:            <span className={`${typography.panelMeta} text-text-light`}>Independent review:</span> | jsx_text
src/canvas/components/model-tab/ContestedEdgeCard.tsx:354:            <span className={`${typography.panelMeta} text-text-light`}>Strength mean</span> | jsx_text
src/canvas/components/model-tab/ContestedEdgeCard.tsx:358:            <span className={`${typography.panelMeta} text-text-light`}>Strength std</span> | jsx_text
src/canvas/components/model-tab/ContestedEdgeCard.tsx:362:            <span className={`${typography.panelMeta} text-text-light`}>Exists probability</span> | jsx_text
src/canvas/components/model-tab/ContestedEdgeCard.tsx:366:            <span className={`${typography.panelMeta} text-text-light`}>Effect direction</span> | jsx_text
src/canvas/components/pre-analysis/AllImprovements.tsx:87:        <span className={`${typography.panelMeta} text-text-light`}>From brief</span> | jsx_text
src/canvas/components/model-tab/RelationshipsSection.tsx:350:                    <span className={`${typography.panelMeta} text-text-light`}>Signed effect</span> | jsx_text
src/canvas/components/model-tab/RelationshipsSection.tsx:366:                    <span className={`${typography.panelMeta} text-text-light`}>Exists probability</span> | jsx_text
src/canvas/components/model-tab/RelationshipsSection.tsx:395:                <span className={`${typography.panelMeta} text-text-light`}>Causal claim</span> | jsx_text
src/canvas/components/model-tab/RelationshipsSection.tsx:401:                <span className={`${typography.panelMeta} text-text-light`}>Repairs applied</span> | jsx_text
src/canvas/components/ModelCardLite.tsx:114:            : <span className="text-text-light">Pending analysis</span> | jsx_text
src/canvas/components/ModelCardLite.tsx:123:            : <span className="text-text-light">Pending analysis</span> | jsx_text
src/canvas/components/model-tab/StreamingDiagnostics.tsx:50:        <span className={`${typography.panelBody} text-text-light`}>Recovered events</span> | jsx_text
src/canvas/components/model-tab/StreamingDiagnostics.tsx:56:        <span className={`${typography.panelBody} text-text-light`}>Buffer trimmed</span> | jsx_text
src/components/results/ParetoChart.tsx:327:                    <span className="font-medium">Why dominated?</span> | jsx_text
src/components/results/ConfidenceSection.tsx:567:            <span className="font-medium">Model evidence:</span>{' '} | jsx_text
src/components/ProsConsList/ScoreComparison.tsx:237:                    <span>Positive impact (pros)</span> | jsx_text
src/components/ProsConsList/ScoreComparison.tsx:241:                    <span>Negative impact (cons)</span> | jsx_text
src/components/ProsConsList/ScoreComparison.tsx:247:                    <span>Each item rated 0-5 stars</span> | jsx_text
src/components/ProsConsList/ScoreComparison.tsx:251:                    <span>Longer bars = stronger impact</span> | jsx_text
src/components/ProsConsList/components/Header.tsx:48:              <span className="text-sm">Saved successfully</span> | jsx_text
```

### Paragraph/div text
```
src/routes/PlotShowcase.tsx:423:                      <div className="text-xs font-semibold text-warning mb-1">Conservative</div> | jsx_text
src/routes/PlotShowcase.tsx:436:                      <div className="text-xs font-semibold text-info mb-1">Most Likely</div> | jsx_text
src/routes/PlotShowcase.tsx:465:                    <div className="text-sm font-semibold text-gray-700 mb-3">Scenario Values</div> | jsx_text
src/routes/PlotShowcase.tsx:551:                <div className="text-sm text-gray-600">No biases detected</div> | jsx_text
src/routes/PlotShowcase.tsx:594:              <Suspense fallback={<div className="text-gray-500">Loading canvas...</div>}> | jsx_text
src/routes/PlotShowcase.tsx:663:                  <div className="text-sm font-medium text-gray-700 mb-2">Response Headers</div> | jsx_text
src/routes/PlotShowcase.tsx:674:                <div className="text-sm text-gray-600">No headers captured yet</div> | jsx_text
src/routes/PlotShowcase.tsx:681:              <div className="text-sm text-gray-600">Not instrumented in PoC</div> | jsx_text
src/routes/PlotShowcase.tsx:687:              <div className="text-sm text-gray-600">Not instrumented in PoC</div> | jsx_text
src/routes/templates/DecisionTemplates.tsx:143:      <p className="text-gray-600 mb-6">Run deterministic analysis on canonical decision scenarios</p> | jsx_text
src/routes/templates/DecisionTemplates.tsx:158:          <p className="text-gray-500 mb-4">No templates available</p> | jsx_text
src/routes/templates/components/OfflineBanner.tsx:15:        <p className="text-sm font-semibold text-warning">You're offline</p> | jsx_text
src/routes/SandboxV1.tsx:408:                      <div className="text-xs font-semibold text-warning mb-1">Conservative</div> | jsx_text
src/routes/SandboxV1.tsx:421:                      <div className="text-xs font-semibold text-info mb-1">Most Likely</div> | jsx_text
src/routes/SandboxV1.tsx:450:                    <div className="text-sm font-semibold text-gray-700 mb-3">Scenario Values</div> | jsx_text
src/routes/SandboxV1.tsx:536:                <div className="text-sm text-gray-600">No biases detected</div> | jsx_text
src/routes/SandboxV1.tsx:580:                <Suspense fallback={<div className="text-gray-500">Loading canvas...</div>}> | jsx_text
src/routes/SandboxV1.tsx:619:                  <div className="text-sm font-medium text-gray-700 mb-2">Response Headers</div> | jsx_text
src/routes/SandboxV1.tsx:630:                <div className="text-sm text-gray-600">No headers captured yet</div> | jsx_text
src/routes/SandboxV1.tsx:637:              <div className="text-sm text-gray-600">Not instrumented in PoC</div> | jsx_text
src/routes/SandboxV1.tsx:643:              <div className="text-sm text-gray-600">Not instrumented in PoC</div> | jsx_text
src/main.tsx:100:      <div style={{ fontWeight: 600 }}>Shell mounted ✅</div> | jsx_text
src/main.tsx:101:      <div style={{ opacity: .7, marginTop: 4 }}>Loading application…</div> | jsx_text
src/pages/SharedBriefPage.tsx:21:    return <p className="text-text-light">No brief content available.</p> | jsx_text
src/lib/ErrorBoundary.tsx:77:              <div style={{ marginTop: '8px' }}>Open DevTools → Console for more details</div> | jsx_text
src/poc/components/SandboxHeader.tsx:53:      <div className="text-xs font-semibold text-gray-800">Sam Scenario Sandbox (POC)</div> | jsx_text
src/poc/components/OnboardingHints.tsx:24:            <div className="poc-onboarding-title">Welcome to the Scenario Sandbox</div> | jsx_text
src/lib/lazySafe.tsx:15:          <div className="text-sm text-gray-600">Not available in this PoC preview build.</div> | jsx_text
src/poc/AppPoC.tsx:715:                            <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>Conservative</div> | jsx_text
src/poc/AppPoC.tsx:723:                            <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>Most Likely</div> | jsx_text
src/poc/AppPoC.tsx:740:                          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Thresholds:</div> | jsx_text
src/pages/sandbox-guide/components/topbar/CopilotTopBar.tsx:85:        <div className="text-sm font-semibold text-charcoal-900">Decision Coach</div> | jsx_text
src/lib/gate-rendering.tsx:147: * <GateGuard gate="run" fallback={<p>Analysis unavailable</p>}> | jsx_text
src/components/SandboxStreamPanel.tsx:211:              <div className="font-medium text-sm mb-2">Start with a template</div> | jsx_text
src/components/SandboxStreamPanel.tsx:231:          <div className="mt-3 text-xs text-gray-500" aria-hidden="true">This is a shell preview. Streaming controls will be added next.</div> | jsx_text
src/components/SandboxStreamPanel.tsx:1386:            <div className="text-xs text-gray-600">Coming soon</div> | jsx_text
src/components/SandboxStreamPanel.tsx:1391:          <div data-testid="reconnect-hint" className="text-xs text-warning mb-1">Reconnecting…</div> | jsx_text
src/components/Analysis/AnalysisContent.tsx:42:          {formattedContent || <p className="text-gray-500">No analysis content available.</p>} | jsx_text
src/components/Analysis/AnalysisContent.tsx:50:        <p className="text-danger">Failed to render analysis content. Please try again.</p> | jsx_text
src/components/DebugOverlays.tsx:81:        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>DEBUG OVERLAYS</div> | jsx_text
src/components/DecisionGraphLayer.tsx:267:          <div className="text-sm font-semibold text-gray-700 mb-1">No decision graph yet</div> | jsx_text
src/components/DecisionGraphLayer.tsx:268:          <div className="text-xs text-gray-500">Run a scenario to see the decision flow</div> | jsx_text
src/components/stream/StreamOutputDisplay.tsx:151:          <div className="font-medium text-gray-700">Diagnostics</div> | jsx_text
src/components/stream/StreamOutputDisplay.tsx:163:          <div className="font-medium text-gray-700">Performance</div> | jsx_text
src/components/ResultsPanel.tsx:75:          <div className="text-sm text-gray-500">Run a scenario to see results</div> | jsx_text
src/pages/sandbox-guide/components/canvas/CopilotCanvasOverlay.tsx:48:        <div className="text-xs font-semibold text-charcoal-900 mb-2">Top Impact Drivers</div> | jsx_text
src/components/stream/StreamEnhancementsPanel.tsx:202:          <div className="text-[11px] text-gray-500 mb-1">Compare Snapshots</div> | jsx_text
src/canvas/conversation/InlineBlocks.tsx:669:          <div className={styles.framingSectionLabel}>Constraints</div> | jsx_text
src/canvas/conversation/InlineBlocks.tsx:806:        <p className={typography.bodySmall}>Research findings available</p> | jsx_text
src/components/Analysis.tsx:571:           {!permanentId ? ( <div className="text-sm text-gray-500 italic">Collaboration features available after analysis is generated.</div> | jsx_text
src/components/Analysis.tsx:572:           ) : collaboratorsLoading ? ( <div className="flex items-center text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading collaborators...</div> | jsx_text
src/components/Analysis.tsx:589:           ) : ( <p className="text-sm text-gray-500">No collaborators found.</p> )} | jsx_text
src/components/Analysis.tsx:601:            {analysisLoading || optionsLoading ? ( <div className="flex items-center justify-center p-8 text-gray-500"><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading Analysis Data...</div> | jsx_text
src/components/Analysis.tsx:614:            ) : ( <p className="text-gray-500 italic">No analysis content generated.</p> )} | jsx_text
src/components/Analysis.tsx:630:              <p className="text-sm text-gray-600">Invite others to collaborate on this decision</p> | jsx_text
src/components/Analysis.tsx:667:                    <p className="text-gray-500 text-sm">No collaborators yet. Invite someone below.</p> | jsx_text
src/components/Analysis.tsx:727:                        <p className="font-medium text-gray-800">Allow Suggestions</p> | jsx_text
src/components/Analysis.tsx:728:                        <p className="text-xs text-gray-500">Let collaborators suggest changes</p> | jsx_text
src/components/Analysis.tsx:749:                        <p className="font-medium text-gray-800">Require Approval</p> | jsx_text
src/components/Analysis.tsx:750:                        <p className="text-xs text-gray-500">Approve suggestions before applying</p> | jsx_text
src/components/Analysis.tsx:771:                        <p className="font-medium text-gray-800">Auto Notifications</p> | jsx_text
src/components/Analysis.tsx:772:                        <p className="text-xs text-gray-500">Send email notifications</p> | jsx_text
src/pages/sandbox-guide/components/panel/states/PreRunReadyState.tsx:48:        <p>Your model is ready! Click Run Analysis to see predictions and insights.</p> | jsx_text
src/pages/sandbox-guide/components/panel/states/PreRunReadyState.tsx:58:          <div className="text-xs text-storm-600 mb-1">Connections</div> | jsx_text
src/pages/sandbox-guide/components/panel/sections/AdvancedMetricsSection.tsx:35:              <div className="font-sans text-xs font-medium text-storm-600 mb-2">Graph Quality</div> | jsx_text
src/pages/sandbox-guide/components/panel/sections/BiasMitigation.tsx:186:              <p className="text-xs font-medium text-storm-700 mb-2">Current Model</p> | jsx_text
src/pages/sandbox-guide/components/panel/sections/BiasMitigation.tsx:193:              <p className="text-xs font-medium text-success mb-2">Improved Model</p> | jsx_text
src/pages/sandbox-guide/components/panel/sections/BiasMitigation.tsx:203:              <p className="text-xs font-medium text-analytical-900">Changes Summary</p> | jsx_text
src/pages/sandbox-guide/components/panel/states/InspectorState.tsx:42:          <p>Select a node or connection on the canvas to inspect its details.</p> | jsx_text
src/pages/sandbox-guide/components/panel/states/InspectorState.tsx:96:                <div className="text-xs text-storm-600 mb-1">Description</div> | jsx_text
src/pages/sandbox-guide/components/panel/states/InspectorState.tsx:102:                <div className="text-xs text-storm-600 mb-1">Prior Probability</div> | jsx_text
src/pages/sandbox-guide/components/panel/states/PreRunBlockedState.tsx:26:        <p>Your model needs a few things before it can be analyzed:</p> | jsx_text
src/pages/sandbox-guide/components/panel/states/PreRunBlockedState.tsx:39:            <p>Checking graph structure...</p> | jsx_text
src/pages/sandbox-guide/components/panel/sections/ProvenancePanel.tsx:97:                <p className="text-xs font-medium text-storm-700">Data Quality:</p> | jsx_text
src/pages/sandbox-guide/components/panel/states/PostRunState.tsx:40:        <div className="text-storm-700 text-sm">No results available</div> | jsx_text
src/pages/sandbox-guide/components/panel/states/PostRunState.tsx:80:        <div className="text-storm-700 text-sm">Analysis results are incomplete or malformed</div> | jsx_text
src/pages/sandbox-guide/components/panel/states/PostRunState.tsx:126:            <div className="text-xs uppercase tracking-wide text-storm-500 mb-2">Key Insight</div> | jsx_text
src/pages/sandbox-guide/components/panel/states/PostRunState.tsx:135:          <div className="text-xs uppercase tracking-wide text-storm-500">Expected Outcome</div> | jsx_text
src/pages/sandbox-guide/components/panel/states/PostRunState.tsx:149:            <div className="text-xs text-storm-600 mb-2">Range of possibilities:</div> | jsx_text
src/components/teams/TeamDetails.tsx:51:        <p className="text-gray-600">Team not found</p> | jsx_text
src/components/teams/TeamDetails.tsx:99:            <p className="text-gray-400 italic">No description provided</p> | jsx_text
src/components/teams/MyTeams.tsx:158:          <p className="text-gray-500 mb-4">Create your first team to start collaborating</p> | jsx_text
src/pages/sandbox-guide/components/panel/states/CompareState.tsx:143:        <div className="text-sm text-storm-600">Loading comparison data...</div> | jsx_text
src/pages/sandbox-guide/components/panel/states/CompareState.tsx:160:    return <div className="p-6">Error loading runs</div> | jsx_text
src/components/teams/UserDirectoryTab.tsx:188:                  <p>No users found. Try searching by name or email.</p> | jsx_text
src/pages/sandbox-guide/components/panel/states/BuildingState.tsx:100:          <div className="text-xs text-storm-600 mb-1">Connections</div> | jsx_text
src/pages/sandbox-guide/components/panel/states/BuildingState.tsx:118:        <div className="text-sm font-medium text-charcoal-900 mb-3">Requirements</div> | jsx_text
src/canvas/components/InsightsTab.tsx:243:              <p className={`${typography.label} mb-1`}>Missing data:</p> | jsx_text
src/canvas/components/InsightsTab.tsx:254:              <p className={`${typography.label} mb-1`}>Recommended adaptations:</p> | jsx_text
src/components/assistants/StreamingMonitor.tsx:84:            <p className="text-warning font-medium">Stream incomplete</p> | jsx_text
src/components/assistants/StreamingMonitor.tsx:106:            <p className="text-danger font-medium">Stream failed</p> | jsx_text
src/components/assistants/StreamingMonitor.tsx:137:                <dt className="font-medium">Correlation ID:</dt> | jsx_text
src/components/assistants/StreamingMonitor.tsx:149:                <dt className="font-medium">Last Event:</dt> | jsx_text
src/components/assistants/StreamingMonitor.tsx:154:              <dt className="font-medium">Event Count:</dt> | jsx_text
src/components/layout/TopBar.tsx:496:              <div className={styles.dropdownMenuLabel}>Need a refresher?</div> | jsx_text
src/components/auth/AuthCallback.tsx:46:      <p className={`${typography.body} text-text-light`}>Signing you in…</p> | jsx_text
src/canvas/components/SnapshotManager.tsx:161:              <p>No snapshots yet</p> | jsx_text
src/canvas/components/SnapshotManager.tsx:162:              <p className={`${typography.body} mt-2`}>Save your current canvas to create a snapshot</p> | jsx_text
src/canvas/components/PropertiesPanel.tsx:35:    <p className={`${typography.body} text-gray-600`}>Select a node or edge to edit its details.</p> | jsx_text
src/canvas/ui/inspector-v2/panels/OptionPanel.tsx:235:                  <div className={`${typography.panelMeta} text-text-light`}>Chance of winning</div> | jsx_text
src/canvas/ui/inspector-v2/panels/OptionPanel.tsx:248:                return <p className={`${typography.panelBody} text-success mt-1`}>Currently the leading option.</p> | jsx_text
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:180:            <p className={`${typography.panelMeta} text-text-light`}>No drivers defined</p> | jsx_text
src/components/auth/ProfileForm.tsx:106:            <p className="text-sm text-gray-500">Update your personal information</p> | jsx_text
src/canvas/ui/inspector-v2/panels/FactorExternalPanel.tsx:192:        <div className={`${typography.panelBody} mb-2`}>How would you describe the level?</div> | jsx_text
src/canvas/ui/inspector-v2/editors/GoalAdvancedEditor.tsx:68:          <p className={`${typography.panelMeta} text-text-light`}>No constraints defined</p> | jsx_text
src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:239:          <p className={`${typography.panelMeta} text-text-light`}>Organisational link</p> | jsx_text
src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:246:          <p className={`${typography.panelMeta} text-text-light`}>Intervention link</p> | jsx_text
src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:445:                      <div className={`${typography.panelMeta} text-text-light mb-1`}>Pass 1 (current)</div> | jsx_text
src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:451:                      <div className={`${typography.panelMeta} text-text-light mb-1`}>Pass 2 (review)</div> | jsx_text
src/canvas/ui/inspector-v2/editors/OptionAdvancedEditor.tsx:47:          <p className={`${typography.panelMeta} text-text-light`}>No interventions defined</p> | jsx_text
src/canvas/components/CompareView.tsx:194:          <div className={`${typography.caption} font-semibold text-gray-700 mb-2 uppercase tracking-wide`}>Probability Bands</div> | jsx_text
src/canvas/nodes/OutcomeNode.tsx:84:          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Depends on:</p> | jsx_text
src/canvas/components/LayoutPopover.tsx:60:                <div className={`${typography.caption} text-gray-500`}>Arrange in rows and columns</div> | jsx_text
src/canvas/components/LayoutPopover.tsx:64:                <div className={`${typography.caption} text-gray-500`}>Top-down tree structure</div> | jsx_text
src/canvas/components/LayoutPopover.tsx:68:                <div className={`${typography.caption} text-gray-500`}>Left-to-right flow</div> | jsx_text
src/canvas/components/LayoutPopover.tsx:72:                <div className={`${typography.caption} text-gray-600`}>Smart semantic layout</div> | jsx_text
src/canvas/nodes/OptionNode.tsx:444:        if (allNoChange) return <p className={`${typography.edgeLabel} text-text-light m-0`}>No changes from current state</p> | jsx_text
src/canvas/nodes/OptionNode.tsx:448:            <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5 mt-1`}>What this option changes:</p> | jsx_text
src/canvas/nodes/OptionNode.tsx:490:          <p className={`${typography.nodeLabel} text-text-body m-0`}>Current baseline. No changes to factors.</p> | jsx_text
src/canvas/nodes/OptionNode.tsx:516:        <p className={`${typography.nodeLabel} text-text-body m-0`}>Current baseline. No changes to factors.</p> | jsx_text
src/canvas/nodes/OptionNode.tsx:524:        <p className={`${typography.nodeLabel} text-text-body m-0`}>No interventions specified for this option.</p> | jsx_text
src/canvas/nodes/OptionNode.tsx:699:                <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5 mt-1`}>Interventions:</p> | jsx_text
src/canvas/nodes/GoalNode.tsx:219:            <p className={`${typography.nodeLabel} text-text-body mt-1 m-0`}>Analysis complete. Set a target to see your chances.</p> | jsx_text
src/canvas/ui/NodeInspector.tsx:143:  if (!node) return <div className={`p-4 ${typography.panelBody} text-text-light`}>Select a node to edit its details</div> | jsx_text
src/canvas/nodes/DecisionNode.tsx:397:            <div className="font-medium text-text-heading">Model readiness</div> | jsx_text
src/canvas/nodes/DecisionNode.tsx:404:                <div className="font-medium text-text-heading mt-1">Bias triggers</div> | jsx_text
src/canvas/components/ImportExportDialog.tsx:367:                      <div className={`${typography.body} text-gray-500`}>Full canvas data (recommended)</div> | jsx_text
src/canvas/components/ImportExportDialog.tsx:381:                      <div className={`${typography.body} text-gray-500`}>Raster image (for presentations)</div> | jsx_text
src/canvas/components/ImportExportDialog.tsx:395:                      <div className={`${typography.body} text-gray-500`}>Vector graphic (scalable)</div> | jsx_text
src/canvas/components/ImportExportDialog.tsx:404:                {exportFormat === 'json' && <p className="mt-1">File will be editable and re-importable</p>} | jsx_text
src/canvas/components/ImportExportDialog.tsx:405:                {exportFormat === 'png' && <p className="mt-1">File will be 2x resolution for clarity</p>} | jsx_text
src/canvas/components/ImportExportDialog.tsx:406:                {exportFormat === 'svg' && <p className="mt-1">File will be vector-based and scalable</p>} | jsx_text
src/canvas/nodes/FactorNode.tsx:238:          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Uncertainty drivers:</p> | jsx_text
src/canvas/nodes/FactorNode.tsx:276:          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Influences:</p> | jsx_text
src/canvas/components/LimitsPanel.tsx:109:          <p className={`${typography.body} text-ink-900/70`}>Loading limits...</p> | jsx_text
src/canvas/nodes/RiskNode.tsx:96:          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Depends on:</p> | jsx_text
src/canvas/components/CommandPalette.tsx:259:              <p className="mt-2">Executing...</p> | jsx_text
src/canvas/panels/InspectorPanel.tsx:253:                  <p className={typography.panelHeader}>Multiple edges selected</p> | jsx_text
src/canvas/panels/InspectorPanel.tsx:260:                  <p className={typography.panelHeader}>Select an edge to inspect</p> | jsx_text
src/canvas/panels/InspectorPanel.tsx:412:                  <div className={`${typography.panelMeta} text-warning mb-2`}>Validation Issues:</div> | jsx_text
src/canvas/ErrorBoundary.tsx:281:                  <p className="text-xs text-gray-400 mb-2">Debug Logs:</p> | jsx_text
src/canvas/ui/EdgeInspector.tsx:245:          <p className={`${typography.panelMeta} text-text-light`}>Organisational link</p> | jsx_text
src/canvas/ui/EdgeInspector.tsx:252:          <p className={`${typography.panelMeta} text-text-light`}>Intervention link</p> | jsx_text
src/canvas/help/HelpMenu.tsx:96:          <p className={`px-4 pb-2 ${typography.caption} uppercase tracking-wide text-ink-900/70`}>Need a refresher?</p> | jsx_text
src/canvas/panels/IssuesPanel.tsx:93:            <p className={typography.panelBody}>No issues found</p> | jsx_text
src/canvas/panels/IssuesPanel.tsx:94:            <p className={`${typography.panelMeta} mt-1`}>Your graph is healthy!</p> | jsx_text
src/canvas/snapshots/SnapshotPanel.tsx:133:        <p className="text-sm text-gray-500 italic">No snapshots yet</p> | jsx_text
src/canvas/components/DocumentsManager.tsx:211:            <p className={`${typography.body} font-medium`}>No documents yet</p> | jsx_text
src/canvas/components/DocumentsManager.tsx:222:            <p className={`mt-1 ${typography.caption} text-ink-900/60`}>Try a different search term</p> | jsx_text
src/components/teams/ManageTeamMembersModal.tsx:380:                <p className="text-center text-gray-500 py-8">No pending invitations</p> | jsx_text
src/components/teams/ManageTeamMembersModal.tsx:431:                <p className="text-center text-gray-500 py-8">No members yet</p> | jsx_text
src/canvas/components/TrustSignal.tsx:128:            <p className={`${typography.body} text-sand-600`}>No quality data</p> | jsx_text
src/canvas/components/TrustSignal.tsx:129:            <p className={`${typography.caption} text-sand-500`}>Run analysis to see reliability assessment</p> | jsx_text
src/canvas/panels/TemplateAbout.tsx:47:              <p className={`${typography.panelBody} mb-1.5 text-info-900`}>Node types:</p> | jsx_text
src/canvas/panels/TemplateAbout.tsx:64:              <p className={`${typography.panelBody} mb-1 text-gray-700`}>Example detail:</p> | jsx_text
src/canvas/panels/TemplateAbout.tsx:71:              <p className={`${typography.panelBody} mb-1 text-info-900`}>Expected inputs:</p> | jsx_text
src/canvas/panels/TemplateAbout.tsx:80:              <p className={`${typography.panelBody} mb-1 text-info-900`}>Assumptions:</p> | jsx_text
src/canvas/components/DevControls.tsx:65:              <div className={`${typography.caption} text-gray-500`} style={{ fontSize: '10px' }}>Include debug metadata in API requests</div> | jsx_text
src/canvas/panels/TemplatesPanel.tsx:621:                    <p className={`${typography.panelHeader} text-danger-900 mb-1`}>Blueprint Insertion Failed</p> | jsx_text
src/canvas/panels/TemplatesPanel.tsx:673:                      <p className={`${typography.panelHeader} text-danger-900 mb-1`}>Templates Unavailable</p> | jsx_text
src/components/RunHistoryDrawer.tsx:77:            <div data-testid="history-empty" className="text-gray-500 text-xs">No runs yet.</div> | jsx_text
src/canvas/ui/inspector-v2/panels/FactorControllablePanel.tsx:258:          <div className={`${typography.panelMeta} text-text-light mb-1`}>Set by options:</div> | jsx_text
src/canvas/ui/inspector-v2/panels/FactorControllablePanel.tsx:277:          <div className={`${typography.panelMeta} text-text-light mb-1 ${setByOptions.length > 0 ? 'mt-2' : ''}`}>Influences:</div> | jsx_text
src/canvas/ui/inspector-v2/panels/DecisionPanel.tsx:93:            {briefData.who && <div><div className={`${typography.panelMeta} text-text-light`}>Who decides</div><div className={typography.panelBody}>{briefData.who}</div></div>} | jsx_text
src/canvas/ui/inspector-v2/panels/DecisionPanel.tsx:95:            {briefData.constraint && <div><div className={`${typography.panelMeta} text-text-light`}>Key constraint</div><div className={typography.panelBody}>{briefData.constraint}</div></div>} | jsx_text
src/canvas/components/ComparisonCanvasLayout.tsx:266:          <p className={`${typography.body} text-ink-600`}>No differences found</p> | jsx_text
src/canvas/ui/inspector/InspectorGuidanceSection.tsx:275:      <p className={`${typography.panelMeta} font-medium text-text-body mb-2`}>Suggestions</p> | jsx_text
src/components/DebugTray.tsx:99:              <div className="text-gray-400 mb-1">PLoT Request ID:</div> | jsx_text
src/components/DebugTray.tsx:106:              <div className="text-gray-400 mb-1">Assist Correlation ID:</div> | jsx_text
src/components/DebugTray.tsx:113:              <div className="text-gray-400 mb-1">PLoT Limits:</div> | jsx_text
src/components/DebugTray.tsx:127:            <div className="text-gray-400 mb-1">Environment:</div> | jsx_text
src/components/DebugTray.tsx:132:            <div className="text-gray-400 mb-1">CEE Idempotency-Key:</div> | jsx_text
src/components/DebugTray.tsx:159:              <div className="text-gray-400 mb-1">Response Hash (Determinism):</div> | jsx_text
src/components/DebugTray.tsx:199:              <div className="text-gray-400 mb-1">CEE Debug Headers:</div> | jsx_text
src/components/DebugTray.tsx:242:              <div className="text-gray-400 mb-1">Performance:</div> | jsx_text
src/canvas/components/InputsDock.tsx:271:        <p className={`${typography.code} text-carrot-600 font-medium`}>Limits unavailable</p> | jsx_text
src/canvas/components/InputsDock.tsx:288:        <p className={`${typography.code} text-ink-900 font-medium`}>Loading limits…</p> | jsx_text
src/canvas/components/InputsDock.tsx:709:                <p>Source documents and related controls live in the documents manager.</p> | jsx_text
src/canvas/ui/inspector-v2/panels/OutcomePanel.tsx:220:            <p className={`${typography.panelMeta} text-text-light mt-1`}>Based on model structure</p> | jsx_text
src/canvas/ui/inspector-v2/panels/GoalPanel.tsx:354:              <div className={`${typography.panelMeta} text-text-light mt-0.5`}>Based on 1,000 simulations</div> | jsx_text
src/canvas/ui/inspector-v2/panels/GoalPanel.tsx:385:        <p className={`${typography.panelMeta} text-text-light py-2`}>No contributing factors connected yet</p> | jsx_text
src/canvas/components/ProvenanceHubTab.tsx:131:            <p className={typography.body}>No citations found</p> | jsx_text
src/components/EngineAuditPanel.tsx:56:          <div className="text-[11px] text-ink-900/70">Last status</div> | jsx_text
src/components/EngineAuditPanel.tsx:60:          <div className="text-[11px] text-ink-900/70">Cached ETag</div> | jsx_text
src/components/EngineAuditPanel.tsx:64:          <div className="text-[11px] text-ink-900/70">Last data hash</div> | jsx_text
src/components/EngineAuditPanel.tsx:68:          <div className="text-[11px] text-ink-900/70 mb-1">Headers (last /draft-flows)</div> | jsx_text
src/canvas/components/pre-analysis/ModelHealthCard.tsx:63:        <p className={`${typography.panelHeader} text-text-header mb-2`}>Decision readiness</p> | jsx_text
src/canvas/components/pre-analysis/ModelHealthCard.tsx:64:        <p className={`${typography.panelBody} text-text-light`}>Generating your decision model...</p> | jsx_text
src/canvas/components/pre-analysis/PreAnalysisPanel.tsx:668:                    <p className={`${typography.panelHeader} text-text-header`}>Strengthen your model</p> | jsx_text
src/canvas/components/pre-analysis/PreAnalysisPanel.tsx:826:            <p className={`${typography.panelHeader} text-danger`}>Draft failed</p> | jsx_text
src/canvas/components/pre-analysis/PreAnalysisPanel.tsx:876:                <p className={`${typography.panelMeta} text-text-body mb-1`}>Tips for a clearer brief</p> | jsx_text
src/canvas/components/pre-analysis/GoalBaselineInput.tsx:133:        <p className={`${typography.panelBody} text-text-light`}>No goal defined yet.</p> | jsx_text
src/canvas/components/pre-analysis/DecisionQualityChecks.tsx:211:              <p className={`${typography.panelMeta} text-danger mt-0.5`}>Enter a name</p> | jsx_text
src/canvas/components/OutcomesSignal.tsx:193:            <p className={`${typography.body} text-sand-600`}>No outcomes yet</p> | jsx_text
src/canvas/components/OutcomesSignal.tsx:194:            <p className={`${typography.caption} text-sand-500`}>Run analysis to see predictions</p> | jsx_text
src/canvas/components/OutcomesSignal.tsx:307:              <p className={`${typography.caption} text-ink-500 mb-1`}>Pessimistic</p> | jsx_text
src/canvas/components/OutcomesSignal.tsx:311:              <p className={`${typography.caption} text-ink-400`}>If things go poorly</p> | jsx_text
src/canvas/components/OutcomesSignal.tsx:320:              <p className={`${typography.caption} text-ink-400`}>If things go well</p> | jsx_text
src/canvas/components/pre-analysis/AllImprovements.tsx:310:            <p className={`${typography.panelBody} text-success py-1`}>All reviewed</p> | jsx_text
src/components/results/HeroSection.tsx:1075:                  <dt className="text-text-light">Sensitive assumptions</dt> | jsx_text
```

### List items
```
src/canvas/CanvasToolbar.tsx:526:            <li>All nodes and connections in your graph</li> | jsx_text
src/canvas/CanvasToolbar.tsx:527:            <li>Any analysis results</li> | jsx_text
src/canvas/CanvasToolbar.tsx:528:            <li>AI assistant conversation</li> | jsx_text
src/components/debug/PayloadLabTab.tsx:470:          <li>The model structure doesn&apos;t support simulation</li> | jsx_text
src/components/debug/PayloadLabTab.tsx:471:          <li>Intervention targets non-existent variables</li> | jsx_text
src/components/debug/PayloadLabTab.tsx:472:          <li>Monte Carlo sampling produced no valid outcomes</li> | jsx_text
src/pages/sandbox-guide/components/shared/HelpModal.tsx:108:              <li>Click any node to inspect its details</li> | jsx_text
src/pages/sandbox-guide/components/shared/HelpModal.tsx:109:              <li>Click a driver in the legend to jump to it</li> | jsx_text
src/pages/sandbox-guide/components/shared/HelpModal.tsx:110:              <li>The panel adapts to show relevant content</li> | jsx_text
src/pages/sandbox-guide/components/shared/HelpModal.tsx:111:              <li>Build your model, then run analysis</li> | jsx_text
src/pages/sandbox-guide/components/panel/sections/BiasMitigation.tsx:208:                {nodesAdded > 3 && <li>• ... and {nodesAdded - 3} more</li>} | jsx_text
src/components/debug/tabs/DataFlowTab.tsx:588:                <li>Check PLoT build includes downstream_calls feature</li> | jsx_text
src/components/debug/tabs/DataFlowTab.tsx:589:                <li>Verify PLoT → ISL call succeeded (check PLoT logs)</li> | jsx_text
src/canvas/ReactFlowGraph.tsx:2230:            <li>All nodes and connections in your graph</li> | jsx_text
src/canvas/ReactFlowGraph.tsx:2231:            <li>Any analysis results</li> | jsx_text
src/canvas/ReactFlowGraph.tsx:2232:            <li>AI assistant conversation</li> | jsx_text
src/components/stream/StreamEnhancementsPanel.tsx:187:                <li>Added {changeLog.added.length}</li> | jsx_text
src/components/stream/StreamEnhancementsPanel.tsx:188:                <li>Removed {changeLog.removed.length}</li> | jsx_text
src/components/stream/StreamEnhancementsPanel.tsx:189:                <li>Changed {changeLog.changed.length}</li> | jsx_text
src/components/assistants/InfluenceExplainer.tsx:106:                <li>Nodes represent factors, beliefs in your decision</li> | jsx_text
src/components/assistants/InfluenceExplainer.tsx:107:                <li>Edges capture causal influence between factors, not simple correlation</li> | jsx_text
src/components/assistants/InfluenceExplainer.tsx:108:                <li>Weights (-1 to +1) = strength and direction</li> | jsx_text
src/canvas/components/DraftChat.tsx:1173:                            <li>Right-click canvas for quick-add menu</li> | jsx_text
src/canvas/components/DraftChat.tsx:1199:                            <li>Wait a bit longer and try again</li> | jsx_text
src/canvas/components/DraftChat.tsx:1200:                            <li>Simplify your brief to fewer factors</li> | jsx_text
src/canvas/components/RecommendationCard/index.tsx:470:                        <li>Add edges representing potential confounding factors</li> | jsx_text
src/canvas/components/RecommendationCard/index.tsx:471:                        <li>Include instrumental variables if available</li> | jsx_text
src/canvas/components/RecommendationCard/index.tsx:472:                        <li>Document assumptions about unmeasured effects</li> | jsx_text
src/canvas/components/RecommendationCard/index.tsx:476:                        <li>Review edge weights for inconsistencies</li> | jsx_text
src/canvas/components/RecommendationCard/index.tsx:477:                        <li>Check if any constraints are redundant</li> | jsx_text
src/canvas/components/RecommendationCard/index.tsx:478:                        <li>Verify probability estimates across related paths</li> | jsx_text
src/canvas/components/pre-analysis/PreAnalysisPanel.tsx:878:                  <li>State one clear goal</li> | jsx_text
src/canvas/components/pre-analysis/PreAnalysisPanel.tsx:879:                  <li>List 2–3 options you're considering</li> | jsx_text
src/canvas/components/pre-analysis/PreAnalysisPanel.tsx:880:                  <li>Mention key factors that matter to your decision</li> | jsx_text
```

## 15. TEMPLATE_LITERAL (template_literal) — user-facing interpolated strings in JSX

```
src/routes/templates/DecisionTemplates.tsx:179:                aria-label={`${t.name} template`} | template_literal
src/routes/templates/components/SummaryCard.tsx:56:          title={`Why: ${confidence.why}`} | template_literal
src/modules/results/ConfidenceBadge.tsx:21:      aria-label={`Confidence level: ${label}`} | template_literal
src/routes/templates/components/WhyPanel.tsx:29:                  aria-label={`Try: ${item.action}`} | template_literal
src/plc/components/GraphCanvasPlc.tsx:118:              key={`e-${i}`} | template_literal
src/canvas/CanvasToolbar.tsx:280:                    aria-label={`Add ${meta.label} node`} | template_literal
src/pages/sandbox-guide/components/panel/sections/SeverityStyledCritiques.tsx:134:        aria-label={`${config.label} issues`} | template_literal
src/pages/sandbox-guide/components/panel/sections/SeverityStyledCritiques.tsx:154:          aria-label={`${config.label} issues details`} | template_literal
src/canvas/compare-tab/TransitionsSection.tsx:34:              key={`${tr.fromRunNumber}-${tr.toRunNumber}`} | template_literal
src/components/JobsProgressPanel.tsx:88:                    aria-label={`Cancel job ${j.id}`} | template_literal
src/pages/sandbox-guide/components/panel/sections/VerificationBadge.tsx:95:        aria-label={`Verification: ${config.label}`} | template_literal
src/pages/sandbox-guide/components/panel/sections/AdvancedMetricsSection.tsx:39:                  value={`${Math.round(graphQuality.score * 100)}%`} | template_literal
src/pages/sandbox-guide/components/panel/sections/AdvancedMetricsSection.tsx:43:                  value={`${Math.round(graphQuality.completeness * 100)}%`} | template_literal
src/pages/sandbox-guide/components/panel/sections/AdvancedMetricsSection.tsx:47:                  value={`${Math.round(graphQuality.evidence_coverage * 100)}%`} | template_literal
src/pages/sandbox-guide/components/panel/sections/AdvancedMetricsSection.tsx:51:                  value={`${Math.round(graphQuality.balance * 100)}%`} | template_literal
src/canvas/ReactFlowGraph.tsx:2171:          message={`This will replace the existing '${existingTemplate.name}' flow on the canvas.`} | template_literal
src/canvas/ReactFlowGraph.tsx:2383:      <DebugLabel mode={`RF-STORE: Store nodes(${nodes.length})/edges(${edges.length}), no handlers`} color="rgba(16, 185, 129, 0.9)" /> | template_literal
src/canvas/conversation/InlineBlocks.tsx:437:          aria-label={`Citation ${c.index}: ${c.source}`} | template_literal
src/canvas/conversation/InlineBlocks.tsx:1028:      aria-label={`${isApplied ? 'Applied changes' : 'Proposed changes'}: ${block.summary}`} | template_literal
src/canvas/compare/EdgeDiffTable.tsx:60:      aria-label={`Rank ${rank}`} | template_literal
src/canvas/conversation/GuidanceStrip.tsx:268:        aria-label={`${actionLabel(topItem.primary_action)}: ${topItem.title}`} | template_literal
src/pages/sandbox-guide/components/panel/states/PostRunState.tsx:206:                  value={`${Math.round(graph_quality.score * 100)}%`} | template_literal
src/pages/sandbox-guide/components/panel/states/PostRunState.tsx:210:                  value={`${Math.round(graph_quality.evidence_coverage * 100)}%`} | template_literal
src/pages/sandbox-guide/components/canvas/NodeBadge.tsx:61:      aria-label={`Rank ${rank}: Contributes ${percentage}% to outcome`} | template_literal
src/canvas/conversation/BaseRateChipRow.tsx:97:        aria-label={`How common is ${chipSet.factorLabel}?`} | template_literal
src/components/CriteriaForm.tsx:26:  if (!importance) return <Navigate to={`/decision/${decisionId}/importance`} replace />; | template_literal
src/components/CriteriaForm.tsx:27:  if (!reversibility) return <Navigate to={`/decision/${decisionId}/reversibility`} replace />; | template_literal
src/components/CriteriaForm.tsx:28:  if (!goals) return <Navigate to={`/decision/${decisionId}/goals`} replace />; | template_literal
src/canvas/conversation/zones/BriefGuidanceStrip.tsx:66:          aria-label={`${el.label}: ${el.detected ? 'detected' : 'not detected'}`} | template_literal
src/canvas/panels/TemplateCard.tsx:34:            alt={`${template.name} template structure`} | template_literal
src/canvas/panels/TemplateCard.tsx:71:          aria-label={`Insert ${template.name}`} | template_literal
src/canvas/panels/TemplateCard.tsx:93:              aria-label={`Merge ${template.name} into current canvas`} | template_literal
src/canvas/provenance/ProvenanceHub.tsx:84:                aria-label={`Filter by ${type}`} | template_literal
src/pages/sandbox-guide/components/shared/NodeReferenceBadges.tsx:58:      title={`Click to view ${displayLabel} (${nodeId})`} | template_literal
src/pages/sandbox-guide/components/shared/NodeReferenceBadges.tsx:108:      title={`Click to view ${displayLabel} (${edgeId})`} | template_literal
src/canvas/ui/inspector-v2/editors/RiskAdvancedEditor.tsx:46:              label={`${o.label}: exposure`} | template_literal
src/canvas/ui/inspector-v2/editors/OutcomeAdvancedEditor.tsx:48:                label={`${o.label}: mean`} | template_literal
src/canvas/ui/inspector-v2/editors/OutcomeAdvancedEditor.tsx:54:                  label={`${o.label}: CI [5th, 95th]`} | template_literal
src/canvas/ui/inspector-v2/editors/OutcomeAdvancedEditor.tsx:55:                  value={`[${o.p10.toFixed(0)}, ${o.p90.toFixed(0)}]`} | template_literal
src/canvas/ui/inspector-v2/shared/ProbabilityArc.tsx:26:    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"> | template_literal
src/canvas/ui/inspector-v2/shared/ProbabilityArc.tsx:47:        transform={`rotate(-90 ${size / 2} ${size / 2})`} | template_literal
src/canvas/ui/inspector-v2/editors/FactorControllableEditor.tsx:173:                aria-label={`Remove driver: ${d}`} | template_literal
src/canvas/components/GuidanceCard.tsx:117:      aria-label={`${item.type} guidance: ${item.title}`} | template_literal
src/canvas/ui/inspector-v2/editors/EdgeAdvancedEditor.tsx:96:          value={`${edge.source}→${edge.target}`} | template_literal
src/components/shared/TriageCard.tsx:337:            title={`Drives ${influencePct}% of the outcome`} | template_literal
src/components/shared/StabilityGauge.tsx:54:          stroke={`var(--${token})`} | template_literal
src/components/shared/StabilityGauge.tsx:57:          strokeDasharray={`${fillLength} ${circumference}`} | template_literal
src/canvas/components/UtilityWeightPanel.tsx:222:                htmlFor={`weight-${entry.node_id}`} | template_literal
src/canvas/components/UtilityWeightPanel.tsx:233:              id={`weight-${entry.node_id}`} | template_literal
src/canvas/components/UtilityWeightPanel.tsx:249:              aria-label={`${entry.label} weight`} | template_literal
src/components/PlotToolbar.tsx:49:            title={`${tool.label} (${tool.key})`} | template_literal
src/components/navigation/Navbar.tsx:42:    <Tooltip content={`${email} (${role})`}> | template_literal
src/components/navigation/Navbar.tsx:239:                    <Tooltip content={`+${collaborators.length - 4} more`}> | template_literal
src/canvas/palette/CommandPalette.tsx:164:                          id={`palette-item-${item.id}`} | template_literal
src/canvas/palette/CommandPalette.tsx:204:                                aria-label={`Match type: ${item.matchType}`} | template_literal
src/canvas/nodes/OptionNode.tsx:497:            <NodeChip label="Why does this win/lose?" message={`Why does the status quo (${(props.data?.label as string) ?? 'keep current'}) win or lose compared to other options?`} /> | template_literal
src/canvas/nodes/OptionNode.tsx:526:          <NodeChip label="Is this option complete?" message={`Is ${(props.data?.label as string) ?? 'this option'} fully specified? Are there any missing interventions?`} /> | template_literal
src/canvas/nodes/OptionNode.tsx:552:          <NodeChip label="Is this option complete?" message={`Is ${(props.data?.label as string) ?? 'this option'} fully specified? Are there any missing interventions?`} /> | template_literal
src/canvas/nodes/OptionNode.tsx:674:            <NodeChip label="What would change this?" message={`What would need to change for ${(props.data?.label as string) ?? 'this option'} to no longer be the best choice?`} /> | template_literal
src/canvas/nodes/OptionNode.tsx:675:            <NodeChip label="Why does this win?" message={`Why does ${(props.data?.label as string) ?? 'this option'} win over the other options?`} /> | template_literal
src/canvas/nodes/OptionNode.tsx:682:            <NodeChip label="What would make this win?" message={`What would need to change for ${(props.data?.label as string) ?? 'this option'} to win?`} /> | template_literal
src/canvas/nodes/OptionNode.tsx:689:            <NodeChip label="What could go wrong?" message={`What could go wrong if we choose ${(props.data?.label as string) ?? 'this option'}?`} /> | template_literal
src/canvas/components/GraphTextView.tsx:438:                      title={`${config.label}: ${count}`} | template_literal
src/canvas/components/GraphTextView.tsx:484:                aria-controls={`graph-section-${type}`} | template_literal
src/canvas/components/GraphTextView.tsx:503:                  id={`graph-section-${type}`} | template_literal
src/components/SandboxStreamPanel.tsx:1139:          aria-label={`Run status: ${terminalLabel}`} | template_literal
src/components/SandboxStreamPanel.tsx:1160:            title={`Replayed from ${new Date((globalThis as any).__REPLAY_TS || Date.now()).toLocaleString()}`} | template_literal
src/components/SandboxStreamPanel.tsx:1342:                aria-label={`Identifiability: ${String(reportData.confidence.identifiability)}`} | template_literal
src/components/SandboxStreamPanel.tsx:1353:                aria-label={`Linearity: ${String(reportData.confidence.linearity)}`} | template_literal
src/components/SandboxStreamPanel.tsx:1364:                aria-label={`Calibration: ${String(reportData.confidence.calibration)}`} | template_literal
src/components/SandboxStreamPanel.tsx:1375:                aria-label={`Diversity: ${String(reportData.confidence.diversity)}`} | template_literal
src/canvas/ui/NodeInspector.tsx:525:                aria-valuetext={`${(node.data.prior * 100).toFixed(0)}%`} | template_literal
src/canvas/components/SuggestionCard.tsx:169:              aria-label={`Accept suggestion: ${formatValue(suggestion.suggested_value)}`} | template_literal
src/canvas/nodes/ConstraintNode.tsx:73:      aria-label={`Constraint: ${nodeData.label}`} | template_literal
src/canvas/components/RangeChips.tsx:141:      title={`${technicalLabel}: ${formattedValue}`} | template_literal
src/canvas/components/RangeChips.tsx:143:      aria-label={`${label} estimate: ${formattedValue}`} | template_literal
src/canvas/onboarding/OnboardingOverlay.tsx:269:          aria-label={`Onboarding progress: Step ${currentStep + 1} of ${totalSteps}`} | template_literal
src/canvas/components/PreAnalysisHealth.tsx:327:            key={`${improvement.category}-${index}`} | template_literal
src/canvas/components/PreAnalysisHealth.tsx:366:      aria-label={`${improvement.action} - ${improvement.category}`} | template_literal
src/canvas/nodes/FactorNode.tsx:224:          <NodeChip label="What evidence supports this?" message={`What evidence supports my assumption about ${cleanedLabel}?`} /> | template_literal
src/canvas/nodes/FactorNode.tsx:230:          <NodeChip label="Is this still accurate?" message={`Is my value for ${cleanedLabel} still accurate?`} /> | template_literal
src/canvas/nodes/FactorNode.tsx:362:            <NodeChip label="Help me estimate this" message={`Help me estimate a reasonable value for ${cleanedLabel}`} /> | template_literal
src/canvas/nodes/FactorNode.tsx:374:            <NodeChip label="What if this changes?" message={`What if ${cleanedLabel} changes? How should I plan for that?`} /> | template_literal
src/canvas/nodes/FactorNode.tsx:427:            message={`All options within 20% of ${anchoringMessage}. Anchored?`} | template_literal
src/canvas/nodes/FactorNode.tsx:429:            linkMessage={`My options seem anchored around ${anchoringMessage}. What wider range should I consider for ${cleanedLabel}?`} | template_literal
src/canvas/components/AcceptOverrideControl.tsx:109:              title={`${confidence} confidence`} | template_literal
src/canvas/nodes/RiskNode.tsx:200:              <NodeChip label="What reduces this?" message={`What factors or actions could reduce ${cleanedLabel || 'this risk'}?`} /> | template_literal
src/canvas/nodes/RiskNode.tsx:201:              <NodeChip label="Add mitigation" message={`Suggest a mitigation strategy for ${cleanedLabel || 'this risk'}`} /> | template_literal
src/canvas/nodes/BaseNode.tsx:341:          title={`Key driver #${displayMetadata.sensitivityRank}: ranked by influence on the outcome`} | template_literal
src/canvas/components/FunctionalForm/FormSuggestionBadge.tsx:33:        title={`Suggestion: ${formInfo?.name || recommendation.recommended_form}`} | template_literal
src/canvas/components/FunctionalForm/FormSuggestionBadge.tsx:43:          aria-label={`Apply ${formInfo?.name || recommendation.recommended_form}`} | template_literal
src/canvas/components/FunctionalForm/FormSuggestionBadge.tsx:86:            aria-label={`Apply ${formInfo?.name || recommendation.recommended_form}`} | template_literal
src/canvas/components/FunctionalForm/FormIndicatorBadge.tsx:80:      title={`${info?.name || form}: ${info?.shortDescription || ''}`} | template_literal
src/canvas/components/FunctionalForm/FormIndicatorBadge.tsx:82:      aria-label={`Functional form: ${info?.name || form}`} | template_literal
src/components/stream/StreamEnhancementsPanel.tsx:239:                <li key={`a-${id}`}>↑ {id}</li> | template_literal
src/components/stream/StreamEnhancementsPanel.tsx:242:                <li key={`r-${id}`}>↓ {id}</li> | template_literal
src/components/stream/StreamEnhancementsPanel.tsx:245:                <li key={`c-${id}`}>• {id}</li> | template_literal
src/canvas/edges/StyledEdge.tsx:641:            aria-label={`Effect direction: ${direction}`} | template_literal
src/canvas/edges/StyledEdge.tsx:767:                      title={`Provenance: ${provenance}`} | template_literal
src/canvas/edges/StyledEdge.tsx:768:                      aria-label={`Provenance: ${provenance}`} | template_literal
src/canvas/edges/StyledEdge.tsx:872:                <NodeChip label="What evidence supports this?" message={`What evidence supports the ${dirLabel.toLowerCase()} relationship between ${srcTitle} and ${tgtTitle}?`} /> | template_literal
src/canvas/edges/StyledEdge.tsx:873:                <NodeChip label="Adjust strength" message={`I want to adjust the strength of the relationship between ${srcTitle} and ${tgtTitle}. Current strength is ${strengthPct}%.`} /> | template_literal
src/canvas/components/FunctionalForm/AppliedFormsCallout.tsx:65:          aria-label={`Confirm ${formInfo?.name || recommendation.recommended_form} for ${recommendation.source_label} to ${recommendation.target_label}`} | template_literal
src/canvas/components/FunctionalForm/AppliedFormsCallout.tsx:74:          aria-label={`Change form for ${recommendation.source_label} to ${recommendation.target_label}`} | template_literal
src/components/RouteLoadingFallback.tsx:37:      aria-label={`Loading ${routeName}`} | template_literal
src/canvas/components/ProgressStrip.tsx:69:                  aria-label={`Progress: ${Math.round(progress)}%`} | template_literal
src/canvas/ui/EdgeInspector.tsx:404:            aria-valuetext={`${Math.round((belief ?? EDGE_CONSTRAINTS.belief.default) * 100)}%`} | template_literal
src/canvas/components/FunctionalForm/MultiFormAnalysis.tsx:222:                  key={`${result.edge_id}-${result.alternative_form}`} | template_literal
src/components/assistants/OptionsTiles.tsx:141:      aria-label={`Select option: ${option.title}`} | template_literal
src/components/HelpTooltip.tsx:27:        aria-label={`Show definition for ${term}`} | template_literal
src/components/assistants/ProvenanceChip.tsx:75:        title={`Sources: ${displayDocuments.map((d) => d.name).join(', ')}`} | template_literal
src/canvas/journey/JourneyTabBody.tsx:231:            testId={`journey-stage-${group.stage}`} | template_literal
src/canvas/ui/inspector/SignedStrengthSlider.tsx:148:          aria-valuetext={`${directionLabel}: ${localValue.toFixed(2)}`} | template_literal
src/components/layout/TopBar.tsx:52:          aria-label={`View: ${label}. Click to change.`} | template_literal
src/components/layout/TopBar.tsx:354:        <Tooltip content={`Decision stage: ${stagePill.label}`}> | template_literal
src/components/layout/TopBar.tsx:367:          <Tooltip content={`Analyzed ${analysisMetadata.scenarioCount.toLocaleString()} scenarios`}> | template_literal
src/components/layout/TopBar.tsx:578:                        aria-valuetext={`${gridSize} pixels`} | template_literal
src/canvas/ui/inspector/InspectorAccordion.tsx:70:          testId={`${testId}-assumptions`} | template_literal
src/canvas/ui/inspector/InspectorAccordion.tsx:83:          testId={`${testId}-appearance`} | template_literal
src/canvas/ui/inspector/InspectorAccordion.tsx:96:          testId={`${testId}-advanced`} | template_literal
src/components/results/SuccessTargetRow.tsx:198:              aria-label={`Edit success target: ${goalThreshold}`} | template_literal
src/canvas/components/RangeLabels.tsx:50:              aria-label={`Show details for ${config.userLabel}`} | template_literal
src/canvas/components/WhatChangedChip.tsx:148:      aria-label={`Graph changed: ${parts.join(' • ')}`} | template_literal
src/components/results/ChallengeSection.tsx:417:              key={`fragile-group-${sourceLabel}`} | template_literal
src/components/results/ChallengeSection.tsx:425:            <RootNodeWarningCard key={`root-warn-${warning.affected_nodes[0] ?? i}`} warning={warning} onSendMessage={onSendMessage} /> | template_literal
src/components/results/ChallengeSection.tsx:456:            <InferenceWarningCard key={`warn-${warning.code}-${i}`} warning={warning} onSendMessage={onSendMessage} /> | template_literal
src/components/chat/ArtefactActions.tsx:29:          key={`${action.label}:${action.message}`} | template_literal
src/canvas/components/ActionsSignal.tsx:227:        aria-label={`${totalCount} actions available. ${isExpanded ? 'Click to collapse' : 'Click to expand'}`} | template_literal
src/canvas/ui/inspector/InspectorGuidanceSection.tsx:163:          aria-label={`${actionLabel(item.primary_action)}: ${item.title}`} | template_literal
src/canvas/components/OutcomesSignal.tsx:343:                title={`Expected: ${formatOutcomeValue(outcomes.p50, outcomes.units, outcomes.unitSymbol)}`} | template_literal
src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx:1002:              aria-label={`Focus on ${item.label}`} | template_literal
src/canvas/components/ChangeAttributionPanel.tsx:288:                <Tooltip key={source} content={`${count} ${config.label.toLowerCase()}`}> | template_literal
src/components/results/OptionCards.tsx:322:          <Tooltip content={`Win probability ranking across ${totalOptions} scenarios`}> | template_literal
src/components/results/OptionCards.tsx:348:          <Tooltip content={`Wins in ${Math.round(option.winProbability * 100)}% of simulated scenarios`}> | template_literal
src/components/results/OptionCards.tsx:369:          title={`Win probability: ${Math.round(option.winProbability * 100)}%`} | template_literal
src/components/results/utils/linkifyCoachingText.tsx:163:        key={`gl-${match.start}`} | template_literal
src/canvas/components/EdgeLabelToggle.tsx:55:        aria-label={`Edge label mode: ${mode === 'human' ? 'Human-readable' : 'Numeric'}. Click to switch to ${mode === 'human' ? 'numeric' : 'human-readable'} mode`} | template_literal
src/canvas/components/ComparisonCanvasLayout.tsx:236:            title={`${count} ${label.toLowerCase()}`} | template_literal
src/canvas/components/ComparisonCanvasLayout.tsx:515:                      ariaLabel={`Scenario ${index + 1}: ${scenario.label}`} | template_literal
src/components/results/ParetoChart.tsx:434:          transform={`rotate(-90, 15, ${PADDING.top + PLOT_HEIGHT / 2})`} | template_literal
src/canvas/components/SliderWithLabel.tsx:154:            aria-label={`${label} value`} | template_literal
src/components/results/GraphLink.tsx:89:      aria-label={`Focus on ${label ?? 'element'} in model`} | template_literal
src/components/results/WinGauge.tsx:169:              aria-label={`${stripEncodingNotation(share.label)}: ${displayPct}%`} | template_literal
src/canvas/components/MultiGoalParetoPanel.tsx:262:                    key={`${pair.goal1Id}-${pair.goal2Id}`} | template_literal
src/canvas/components/MultiGoalParetoPanel.tsx:452:        aria-label={`Weight for ${criterion}`} | template_literal
src/components/results/TornadoChart.tsx:170:      title={`Flips at ${formattedFlip}`} | template_literal
src/canvas/components/DriverChips.tsx:385:            title={`Contributes ${Math.round(contribution * 100)}% to outcome`} | template_literal
src/canvas/components/InterventionDisplay.tsx:162:              title={`${label} → ${formatValue(intervention.value, unit)} (${formatSource(intervention.source)})`} | template_literal
src/canvas/components/ModelQualityScore.tsx:105:            aria-valuetext={`${label}: ${formatPercent(value)}`} | template_literal
src/canvas/components/ModelQualityScore.tsx:210:              aria-label={`Model quality score: ${formatPercent(score)}`} | template_literal
src/canvas/components/ModelQualityScore.tsx:337:        aria-label={`Model quality: ${formatPercent(score)}`} | template_literal
src/components/results/RangeVisualization.tsx:155:          title={`Median: ${formatThreshold(p50, outcomeUnit, outcomeUnitSymbol, isNormalised)}`} | template_literal
src/components/ProsConsList/ScoreStars.tsx:24:          aria-label={`Rate ${value} stars`} | template_literal
src/components/results/TippingPoints.tsx:104:          title={`Current: ${formatOutcomeValue(current_value, effectiveUnit, effectiveSymbol)}`} | template_literal
src/components/results/TippingPoints.tsx:110:          title={`Flips at: ${formatOutcomeValue(flip_value, effectiveUnit, effectiveSymbol)}`} | template_literal
src/components/results/ImprovementsSection.tsx:143:            <ImprovementRow key={`${item.action.slice(0, 20)}-${index}`} item={item} /> | template_literal
src/components/results/BaselineToggleCard.tsx:76:            title={`Baseline: ${baselineLabel}`} | template_literal
src/canvas/components/StatusChips.tsx:36:        title={`Failed to load limits: ${error.message}${timestamp}
Click to ${onClick ? 'view details' : 'retry'}`} | template_literal
src/canvas/components/StatusChips.tsx:51:        title={`Loading limits...
Nodes: ${currentNodes}
Edges: ${currentEdges}${onClick ? '
Click for details' : ''}`} | template_literal
src/canvas/components/StatusChips.tsx:52:        aria-label={`Graph usage: ${currentNodes} nodes, ${currentEdges} edges - limits loading${onClick ? ' - click for details' : ''}`} | template_literal
src/canvas/components/StatusChips.tsx:87:      title={`Status: ${zoneLabel}
Nodes: ${currentNodes}/${limits.nodes.max} (${nodesPercent}%)
Edges: ${currentEdges}/${limits.edges.max} (${edgesPercent}%)
Source: ${sourceLabel}
Last fetched: ${timestamp}${onClick ? '
Click for details' : ''}`} | template_literal
src/canvas/components/StatusChips.tsx:88:      aria-label={`Graph limits (${zoneLabel}): ${currentNodes} of ${limits.nodes.max} nodes, ${currentEdges} of ${limits.edges.max} edges${onClick ? ' - click for details' : ''}`} | template_literal
src/canvas/components/DocumentsManager.tsx:339:                  aria-label={`Rename document ${document.name}`} | template_literal
src/canvas/components/DocumentsManager.tsx:368:                  id={`error-${document.id}`} | template_literal
src/canvas/components/DebugDrawer.tsx:154:                      aria-label={`Copy ${label}`} | template_literal
src/canvas/components/DebugDrawer.tsx:288:                    key={`${error.timestamp}-${index}`} | template_literal
src/components/results/TrustOneLiner.tsx:107:              strokeDasharray={`${fillLength} ${gapLength}`} | template_literal
src/canvas/components/StructuralHealth.tsx:43:            description={`${orphans.length} node${orphans.length !== 1 ? 's' : ''} not connected to graph`} | template_literal
src/canvas/components/StructuralHealth.tsx:52:            description={`${cycles.length} cycle${cycles.length !== 1 ? 's' : ''} detected`} | template_literal
src/canvas/components/ResultsPanel/SensitivityList.tsx:83:              title={`Sensitivity: ${Math.round(param.sensitivity * 100)}%`} | template_literal
src/canvas/components/model-tab/OptionsSection.tsx:141:            key={`cw-${i}`} | template_literal
src/canvas/components/model-tab/OptionsSection.tsx:193:                testId={`intervention-${option.id}-${iv.factorId}`} | template_literal
src/canvas/components/CommandPalette.tsx:269:                id={`cmd-action-${action.id}`} | template_literal
src/canvas/components/ResultsPanel/KeyDriversPanel.tsx:236:                  key={`${driver.label}-${index}`} | template_literal
src/components/results/DriversSection.tsx:564:              aria-label={`Focus on ${cleanedLabel} in model`} | template_literal
src/components/results/DriversSection.tsx:597:            label={`${cleanedLabel} sensitivity: ${Math.round(sensitivityValue * 100)}%`} | template_literal
src/components/results/DriversSection.tsx:617:            aria-label={`${cleanedLabel} confidence: ${Math.round(confidenceValue * 100)}%. Click to update.`} | template_literal
src/components/results/DriversSection.tsx:622:              label={`${cleanedLabel} confidence: ${Math.round(confidenceValue * 100)}%`} | template_literal
src/components/results/DriversSection.tsx:744:        id={`tooltip-${driver.factorKey}`} | template_literal
src/components/results/SectionHeader.tsx:67:          aria-label={`${count} items`} | template_literal
src/canvas/components/DraftChat.tsx:1330:                          key={`${file.name}-${index}`} | template_literal
src/canvas/components/DraftChat.tsx:1338:                            aria-label={`Remove ${file.name}`} | template_literal
src/canvas/components/DraftChat.tsx:1417:                  aria-label={`${hasGraph ? 'Rebuild model' : 'Generate draft'} (Enter to send, Shift+Enter for new line)`} | template_literal
src/canvas/components/EvidenceFreshnessBadge.tsx:133:        aria-label={`Evidence freshness: ${config.label}`} | template_literal
src/canvas/components/EvidenceFreshnessBadge.tsx:176:        aria-label={`Evidence freshness: ${relativeTime}`} | template_literal
src/canvas/components/UnifiedStatusBadge.tsx:165:        content={`${status.label}: ${status.confidence}`} | template_literal
src/canvas/components/UnifiedStatusBadge.tsx:245:      content={`${status.label}: ${status.confidence}`} | template_literal
src/components/results/ConfidenceSection.tsx:709:                          key={`validate-${item.code}-${index}`} | template_literal
src/components/results/ConfidenceSection.tsx:767:                          key={`refine-${item.code}-${index}`} | template_literal
src/components/results/ConfidenceSection.tsx:817:                                    aria-label={`Focus on ${actionItem.title} in model`} | template_literal
src/components/results/ConfidenceSection.tsx:965:                    key={`assumption-${index}`} | template_literal
src/components/results/ConfidenceSection.tsx:1076:            key={`${ft.node_id}-${idx}`} | template_literal
src/components/results/ConfidenceSection.tsx:1156:            key={`${w.factor_id}-${idx}`} | template_literal
src/components/ProsConsList/OptionColumn.tsx:182:                  id={`${option.id}_pros_${index}`} | template_literal
src/components/ProsConsList/OptionColumn.tsx:256:                  id={`${option.id}_cons_${index}`} | template_literal
src/canvas/components/ScenarioComparison.tsx:200:                ariaLabel={`Snapshot A: ${snapshotA.name}`} | template_literal
src/canvas/components/ScenarioComparison.tsx:226:                ariaLabel={`Snapshot B: ${snapshotB.name}`} | template_literal
src/canvas/components/model-tab/RelationshipsSection.tsx:201:            title={`This assumption would need to be ${eValue.toFixed(1)}x wrong to change the recommendation`} | template_literal
src/canvas/components/model-tab/RelationshipsSection.tsx:245:                  testId={`edge-${edgeId}-weight`} | template_literal
src/canvas/components/model-tab/RelationshipsSection.tsx:313:                testId={`edge-${edgeId}-likelihood`} | template_literal
```

---

## FINAL SUMMARY

| Pattern Group | Estimated Count (non-test) |
|---|---|
| constant_value | 55 (8 files) |
| placeholder | 109 |
| aria_label | ~300 |
| title_tooltip | ~200 |
| alt_text | 4 |
| empty_state | ~65 |
| button_text | ~40 |
| section_heading | ~100 |
| badge_pill | ~25 |
| loading_status | ~50 (visible) |
| error_message | ~80 (non-test) |
| console_message | ~160 (non-test) |
| jsx_text | ~400+ |
| template_literal | ~200 (non-className) |
| css_content | 1 |

**Total user-facing strings: ~1,800+**

### Key observations

1. **No i18n framework** is in use -- all strings are hardcoded inline.
2. **Terminology constants** are centralized in src/config/terminology.ts (Downside/Expected/Upside, Confidence/Influence/Source) -- good pattern.
3. **Error messages** are well-centralized in src/lib/userFriendlyErrors.ts and src/lib/errors.ts.
4. **Empty states** are partially centralized in src/components/results/emptyStates.ts but many remain scattered inline.
5. **Comparison labels** are centralized in src/canvas/compare/labels.ts.
6. **Robustness labels** (Robust/Moderate/Sensitive/Highly sensitive) are centralized in src/components/results/constants.ts.
7. **Validation chip text** (Market expansion, Hiring strategy, Product launch timing) lives in src/constants/validation.ts.
8. **AI model display names** live in src/config/aiModels.ts.
9. **Debug panel strings** are numerous (~200+) but developer-facing only.
10. **Console messages** (~160 non-test) follow [ServiceName] prefix convention.

### Scattered string hotspots (high string density, no constants file):

- src/canvas/components/DraftChat.tsx
- src/canvas/components/InputsDock.tsx
- src/canvas/components/OutputsDock.tsx
- src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx
- src/canvas/components/RecommendationCard/index.tsx
- src/canvas/CanvasToolbar.tsx
- src/canvas/ReactFlowGraph.tsx
- src/components/SandboxStreamPanel.tsx
- src/components/layout/TopBar.tsx
- src/components/results/HeroSection.tsx
- src/components/results/DriversSection.tsx
- src/components/results/ConfidenceSection.tsx
- src/components/auth/LoginForm.tsx
- src/components/auth/SignUpForm.tsx
- src/pages/ScenarioListPage.tsx
- src/canvas/onboarding/OnboardingOverlay.tsx
- src/canvas/onboarding/EmptyState.tsx
- src/canvas/components/pre-analysis/ (multiple files)
