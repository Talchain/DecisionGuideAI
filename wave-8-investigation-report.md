# Wave 8 Prep — Investigation Report

## Task 1: Confirm onSetValue/onConfirm Wiring Status

### Current State
Both `onConfirm` handlers are correctly wired to canvas store updates. They are NOT wiring to `onSendMessage`.

**Pre-analysis (`PreAnalysisPanel.tsx:350-358`):**
```typescript
const handleConfirm = useCallback((nodeId: string) => {
  const { nodes, updateNode } = useCanvasStore.getState()
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return
  updateNode(nodeId, {
    data: withObservedStateUpdate(node.data, { source: 'user_confirmed' }),
  })
}, [])
```
Passed to TriageCard at line 855 as `onConfirm={handleConfirm}`.

**Post-analysis (`OutputsDock.tsx:618-625`):**
```typescript
const handleTriageConfirm = useCallback((nodeId: string) => {
  ...
  updateNode(nodeId, {
    data: withObservedStateUpdate(node.data, { source: 'user_confirmed' }),
  })
}, [])
```
Threaded: OutputsDock → ResultsBody (`onConfirmFactor`) → DecisionConfidencePanel (`onConfirm`).

**Set value (post-analysis):** `editorConfig` built in `mapEvidenceGapsToActions` (DecisionConfidencePanel.tsx:153-160) with `onSave: (rawValue) => onSetValue(targetId, rawValue)`. The `onSetValue` is `handleTriageSetValue` from OutputsDock, which calls `updateNode` with `withObservedStateUpdate`.

**Set value (pre-analysis):** `editorConfig` built in `mapItem` (PreAnalysisPanel.tsx:751-761) but ONLY for items where `mapped.action?.kind === 'set_value'`. Pre-analysis items use `kind: 'confirm'` or `kind: 'edit'` — never `'set_value'`. So the "Set value" button never renders for pre-analysis triage cards. Pre-analysis "Edit" buttons call `handleSetValueForGap` which focuses the node on canvas.

### Root Cause
No bug — wiring is correct. Pre-analysis uses canvas-focus pattern for editing (node inspector), post-analysis uses inline ScientificEditor.

### Recommended Fix
None needed. Status: **working correctly**.

---

## Task 2: "Set Target" Action and Inline Editing Feasibility

### Current State
**"Set target" check row** (PreAnalysisPanel.tsx:812-817):
- Handler: `handleFocusNode(data.goalNode?.id ?? '')` — focuses goal node on canvas, does NOT open inline editor.
- User must then edit threshold in the node inspector.

**SuccessTarget inline editing** (SuccessTarget.tsx:240-274):
- Full inline `<input type="number">` exists for confirmed threshold editing.
- Has `handleEditClick` → expands section with live input + Save/Cancel buttons.
- Uses native HTML input, NOT ScientificEditor.

**Available components:**
- `ThresholdInput` exists at `src/canvas/components/ThresholdInput.tsx` — generic threshold input.
- SuccessTarget already has working inline editing — it just isn't rendered when threshold is null (Task 3 from Wave 7 suppressed it).

**Factor value editing:**
- TriageCard has ScientificEditor integration (lines 199-209, 232-239).
- "Set value" button only appears when `action.kind === 'set_value' && editorConfig`.
- Pre-analysis cards never get `kind: 'set_value'` (see Task 1 above).

### Recommended Fix
**Small effort:** Instead of suppressing SuccessTarget when threshold is null, show a minimal version with just the inline input. The component already handles the "no threshold" state with an "Add target" button + expandable input. Restore rendering but as a compact inline row, not a full card.

**Alternative (smallest):** Make the check row's "Set target" action scroll to the SuccessTarget section instead of focusing the node. This re-uses existing inline editing without new UI.

---

## Task 3: Truncated Text Without Tooltips

### Findings
14 truncated elements missing `title` attributes:

| # | File | Line | Element | Content |
|---|------|------|---------|---------|
| 1 | SuccessTarget.tsx | 234 | `<span>` | goalLabel |
| 2 | EdgeEvidenceGaps.tsx | 54 | `<button>` | factor label |
| 3 | MissingData.tsx | 62 | `<button>` | factor label |
| 4 | FromBrief.tsx | 45 | `<button>` | factor label |
| 5 | ContestedRelationships.tsx | 96 | `<button>` | edge label |
| 6 | AiEstimated.tsx | 50 | `<button>` | factor label |
| 7 | RangeVisualization.tsx | 130 | `<span>` | option label |
| 8 | BaselineToggleCard.tsx | 74 | `<span>` | baseline label |
| 9 | TargetProbabilityBars.tsx | 48 | `<span>` | constraint label |
| 10 | TornadoChart.tsx | 585 | `<span>` | expected value |
| 11 | SuccessTargetRow.tsx | 74 | `<span>` | item label |
| 12 | TriageCard.tsx | 91 | `<span>` | compact card title |
| 13 | TriageCard.tsx | 181 | `<p>` | default card title |
| 14 | AllImprovements.tsx | 871 | (comment only) | already addressed |

Elements WITH proper tooltips: AnalysisSettings.tsx:63, SuccessTarget.tsx:180, RangeVisualization.tsx:155, BaselineToggleCard.tsx:76, TornadoChart.tsx:457-465, AdvancedSection.tsx:276, TriageCard.tsx:197 (subtitle has title).

### Root Cause
Truncated text added without corresponding `title` attribute for hover reveal.

### Recommended Fix
**Small effort:** Add `title={text}` to each of the 14 elements. Mechanical change, no logic.

---

## Task 4: Dead Affordances

### "Something missing?" link
- **Pre-analysis** (PreAnalysisPanel.tsx:952): WIRED — `onClick={() => onSendMessage?.('What else should I consider in my model?')}`
- **Post-analysis** (CoachingPrompt.tsx:42-51): WIRED — focuses chat input and preloads message.
- **Status: Working.** Not a dead affordance.

### "Explore other strategies" button
- **OptionPreview.tsx:322-329**: WIRED — `onClick={() => onSendMessage("Can you suggest alternative strategies I haven't considered?")}`
- **Gated by** `{onSendMessage && (...)}` — only renders when handler present.
- **Status: Working.** Not a dead affordance.

### "Fix before running" section (BlockersSection)
- **BlockersSection.tsx:64-74**: Actively rendered in PreAnalysisPanel (lines 1065-1077).
- **Condition:** `(!data.isReady && data.enrichedBlockers.length > 0) || data.informationalBlockers.length > 0`
- **Shows:** Structured blocker cards with severity indicators, titles, descriptions, action buttons (Retry Draft / Edit Brief).
- **Status: Working.** Renders only when blocking items exist. Not redundant with check rows — check rows show missing setup items, blockers show CEE/validation failures.

### Recommended Fix
None needed. All three affordances are live.

---

## Task 5: Option Node SVG and Intervention Display

### Option SVG
- **OptionPreview.tsx:24:** `className="inline-block flex-shrink-0 w-4 h-4 rounded-[2px] bg-option/20 border border-option/40"`
- **Rendering:** Filled purple square at 20% opacity with 40% opacity border. NOT an empty outline — it has a visible fill.
- **Status:** Correct per DS v5 §10.1 (option shape = rounded square, option colour).

### Intervention Display
- **Data source:** `usePreAnalysisData.ts:1421-1432` reads from `ceeAnalysisReady.options[]` (canonical source), NOT from `node.data.interventions`.
- **When empty:** Shows "No mapped interventions yet" for non-baseline options, `null` for baseline.
- **After validator fix (Wave intervention fix):** The validator now accepts empty interventions on baseline options. If `ceeAnalysisReady` is successfully stored with populated interventions on active options, OptionPreview will show them.
- **Remaining risk:** If `ceeAnalysisReady` is still null (e.g. synthesis fallback), interventions won't show. The synthesis path (`synthesiseCeeAnalysisReady`) derives interventions from edges, which may produce different results than CEE's resolved interventions.

### Recommended Fix
**Small effort:** Add a dev-mode diagnostic log in OptionPreview showing whether it read from `ceeAnalysisReady` or fell back. This helps debugging without changing behavior.

---

## Task 6: "Also Consider" Quick-Fix Data Richness

### Available Data
`mapImprovementToTriageCard` returns ALL fields for all items:
- `title` ✓
- `detail` ✓
- `subtitle` ✓ (derived by `deriveSubtitle`)
- `category` ✓
- `influence` ✓ (from influence map)
- `sourcePill` ✓ (derived from sourceBadge/category)

### Compact Variant Rendering
`CompactTriageCard` (TriageCard.tsx:75-124) renders:
- ✓ title (panelMeta, text-info, font-medium)
- ✓ ordinal badge
- ✓ influence bar + percentage
- ✓ evoiImpact (pp label)
- ✓ action buttons (Confirm/Edit/Set)
- ✗ **subtitle — NOT rendered**
- ✗ **sourcePill — NOT rendered**

### What's Missing in the Render Call
PreAnalysisPanel.tsx quick-fix cards (lines 880-901) pass `influence` and `action` but omit `subtitle` and `sourcePill` in the prop list. However, even if passed, CompactTriageCard ignores them — the component doesn't render those props.

### Recommended Fix
**Medium effort:** Modify CompactTriageCard to render:
1. `sourcePill` as a small badge after the title (same pattern as default variant but smaller)
2. A single-line meta text combining subtitle + influence (e.g. "No value set · 42%")

This requires modifying TriageCard.tsx (compact variant).

---

## Task 7: Bias Finding Specificity

### Type Definition
`CEEBiasFinding` (src/adapters/cee/types.ts:154-163):
```typescript
{
  id: string
  type: string              // 'confirmation', 'anchoring', 'framing', 'confidence', 'blind_spots'
  severity: CEEBiasSeverity  // enum
  description: string        // User-facing text (CEE-generated, model-specific)
  affectedNodes: string[]    // Node IDs
  interventions: CEEBiasIntervention[]  // Suggested micro-interventions
  mechanism?: string         // Technical explanation
  citation?: string          // Academic reference
}
```

### What's Used
`usePreAnalysisData.ts:1669-1686` uses:
- `finding.id` → check ID
- `finding.type` → for dedup + fallback title
- `finding.description` → PRIMARY label (preferred over generic)
- `finding.mechanism` → detail text (optional)

### What's Left on the Table
| Field | Used? | Where it could appear |
|-------|-------|----------------------|
| `affectedNodes` | ✗ | Could highlight specific factors in the nudge text |
| `interventions` | ✗ | Could show "Try: [micro-intervention]" suggestions |
| `severity` | ✗ | Could set nudge icon colour (warning vs danger) |
| `citation` | ✗ | Could show "Source: [citation]" in expert mode |

### Nudge Rendering
Nudges (PreAnalysisPanel.tsx:904-924) render `nudge.message` which comes from the quality check's `message` field — this IS `finding.description || BIAS_TYPE_TITLES[finding.type]`. So when CEE provides a model-specific description, it does show. The generic fallback only fires when `description` is empty.

### Icon Mapping
`BiasIcon` component (primitives/BiasIcon.tsx) supports types: `anchoring`, `framing`, `confidence`, `blind_spots`. But nudges render `AlertTriangle` uniformly, not BiasIcon.

### Recommended Fix
**Small effort:** Use `finding.severity` to pick nudge icon colour (`severity >= 'high'` → danger, else warning). Use `BiasIcon` instead of generic `AlertTriangle` when bias type matches a known icon.

**Medium effort:** Add `affectedNodes` highlighting — when nudge hovered, highlight the affected nodes on canvas.

---

## Task 8: "Your Expertise" Section — Lost Features Audit

### Feature Status

| Feature | Status | Location | Data Source |
|---------|--------|----------|-------------|
| "Drives X%" influence bar | ✓ ACTIVE | AiEstimated.tsx:64-72 | `factorInfluenceMap` from `preAnalysisSensitivity` |
| "Try: reference class forecasting" | ✓ ACTIVE | MissingData.tsx:21-32 | Hardcoded heuristic (regex on label) |
| "Try: outside view technique" | ✓ ACTIVE | MissingData.tsx:28-31 | Hardcoded default fallback |
| "Potential unmeasured confounders" | ✓ ACTIVE | usePreAnalysisData.ts:57 | ISL critique labels (IDENTIFIABILITY_WARNING etc.) |
| "No observed data" motivational copy | ✓ ACTIVE | MissingData renders per-factor rows with "Set value" CTA | Computed from graph state |
| Influence % per factor | ✓ ACTIVE | AiEstimated.tsx, MissingData uses map | `preAnalysisSensitivity.factor_influence` |

### Where Features Render
All features listed above render in the **"Your expertise"** accordion section below the triage panel, NOT in the triage cards themselves. The triage panel shows a condensed view (top 3 + quick-fix 3); the full expertise section shows all items with richer formatting.

### Data Availability
`preAnalysisSensitivity?.factor_influence` is available via canvas store (populated from PLoT m1 response). `factorInfluenceMap` is built in PreAnalysisPanel.tsx:310-313 and passed to YourExpertise → subcomponents.

### Git History
```
55ad8fca feat(pre-analysis): v6 wireframe alignment — 9-task restructure
```
This was the last major restructure. No features were removed — they were reorganized into expertise subgroups (AiEstimated, MissingData, FromBrief, ContestedRelationships, KeyRelationshipsSubgroup, EdgeEvidenceGaps).

### What's Different Between Triage and Expertise
The triage panel's top-3 cards show: title, subtitle, sourcePill, influence bar, action buttons. The expertise section shows: title, value display, "Estimated" pill, influence bar, "Drives X%" text, technique hints, confirm/edit/research buttons, confidence spectrum.

The triage cards are a condensed summary; the expertise section is the full interactive workspace. No features are "lost" — they live in the expertise section.

### Recommended Fix
None needed. Features are active in the expertise section. If desired, triage cards could show technique hints and "Drives X%" text, but this would duplicate the expertise section and increase card height beyond the 70-80px target.
