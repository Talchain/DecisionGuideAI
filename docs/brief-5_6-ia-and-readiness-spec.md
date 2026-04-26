# Brief 5.6 — IA and Readiness Reframe Spec (Locked)

Locked: 2026-04-26. **Schema freeze applies from this commit.**

---

## §2.1 IA changes — post-analysis

| Change | From | To | Deliverable |
|---|---|---|---|
| "Show winner by" filter | Your options section (`ResultsBody.tsx:218-220`) | Advanced section (`AdvancedSection.tsx`) | D3 |
| "Some confidence scores..." disclaimer | Section-level `<p>` at `DriversSection.tsx:887-891` | Merged into Confidence column header tooltip content | D4 |
| "Highest-value evidence gaps" bridge copy (2 sentences, conditional) | `DecisionConfidencePanel.tsx:242-250` | Single-line subtitle retained at line 240; bridge detail moved to tooltip on a "What's this?" affordance | D5 |

---

## §2.2 IA changes — pre-analysis

| Change | From | To | Deliverable |
|---|---|---|---|
| "N assumptions to review and N quality suggestions" coaching branch | Dynamic template at `usePreAnalysisData.ts:2007-2008` in `coachingSummary` memo | Branch removed; falls through to single-count branches | D6 |
| "Your expertise" section | Standalone surface at `PreAnalysisPanel.tsx:1758` (YourExpertise.tsx) | Confirm/Set value actions threaded into Improve confidence triage cards; YourExpertise.tsx removed | D7 |
| "Something missing from the model/results?" | Card-styled component (`rounded-lg border border-panel-border bg-panel px-4 py-2`) | Quiet one-liner — stripped to inline text with dismiss, no card frame | D8 |
| "Improve confidence" accordion default | Already `useState(false)` at `PreAnalysisPanel.tsx:327` | Verification-only commit | D9 |

---

## §2.3 Brief 5.5 unfinished-scope verification

| Item | Check | Verified status |
|---|---|---|
| "Olumi applied N adjustments" removal (D14) | Results panel render | **CLEAN** — only in `ModelAdjustments.tsx` (Model tab), intentional |
| Fragility alt-winner grouping (D11) | `useResultsSectionData.ts:1431-1457` | **CLEAN** — structure in place |
| Option card ordinal colour marker (D17) | `OptionCards.tsx:320-330` | **CLEAN** — colour marker rendered, no `#N of M` prefix |

All three items verified in D1 audit. D10 commit is doc-only.

---

## §2.4 Readiness reframe

**D13 and D14 are DEFERRED per D1 data-availability audit.** Old "Evidence" and "Verified" labels retained. The ring continues to show 4 dimensions with mixed old/new labels (D11 Decision shape, D12 Your contribution, D13 Evidence [deferred], D14 Verified [deferred]).

### D11 — Decision shape

**Replaces:** "Structure" label and existing `completeness` score  
**Slot:** Position 1 (leftmost) in ring and dimension bars

**Score formula** (smooth 0–100, NOT three-boolean jumps):

```ts
// Inputs from canvas store: nodes[], edges[]
const optionNodes = nodes.filter(n => n.type === 'option')
const outcomeNodes = nodes.filter(n => n.type === 'outcome' || n.type === 'goal')
const allFactorNodes = nodes.filter(n => n.type === 'factor')
const causalEdges = edges.filter(e => e.type !== 'constraint') // all substantive edges

// Normalised sub-scores (0–1 each)
const optionScore = Math.min(optionNodes.length / 2, 1)          // 2 options → full
const outcomeScore = outcomeNodes.length > 0 ? 1 : 0             // binary: outcome/goal exists
const factorScore = Math.min(allFactorNodes.length / 3, 1)       // 3 factors → full
const connectionScore = Math.min(causalEdges.length / 4, 1)      // 4 edges → full

const decisionShapeScore = Math.round(
  (optionScore * 0.30 + outcomeScore * 0.25 + factorScore * 0.25 + connectionScore * 0.20) * 100
)
```

Weights: options (30%) — most important for a decision; outcome/goal (25%) — required for analysis; factors (25%) — evidence base; connections (20%) — causal structure.

**Label copy:** "Decision shape"  
**Tooltip:** "Whether your decision has the structural elements needed for analysis: options to compare, a goal to optimise, factors that drive outcomes, and connections between them."

**Action copy by state:**
- 0–39%: "Add options, a goal, and connecting factors to build a complete decision structure."
- 40–69%: "Your model has the basics — adding more factors and connections will sharpen the analysis."
- 70–100%: "Good decision structure in place."

**Unit tests:** empty graph (0), 1 option + 1 goal + no factors + no edges (37%), 2 options + 1 goal + 3 factors + 4 edges (100%).

### D12 — Your contribution

**Replaces:** "Coverage" label and existing `balance` score  
**Slot:** Position 2 in ring and dimension bars

**Score formula** (reuses existing `evidence` computation from `usePreAnalysisData.ts:1237-1268`):

```ts
// Existing: nonAiCount / total factor nodes
const factorNodes = nodes.filter(n => n.type === 'factor' && n.data.observedState)
const aiEstimatedNodes = factorNodes.filter(n => AI_SOURCES.has(n.data.observedState?.source ?? ''))
const userSetCount = factorNodes.length - aiEstimatedNodes.length
const score = factorNodes.length === 0 ? 0 : Math.round((userSetCount / factorNodes.length) * 100)
```

Note: `AI_SOURCES` Set already defined at `usePreAnalysisData.ts:345`. The old `balance` score (Coverage) is **orphaned** — its `useMemo` at lines 1965-1987 can be removed in D12.

**Label copy:** "Your contribution"  
**Tooltip:** "The percentage of factor values you have set or confirmed, versus those estimated by Olumi. Higher means the analysis is grounded in your knowledge."

**Action copy by state (D2.5 tone lock):**
- <30% (action framing): "Add your knowledge — set values for the factors you know best."
- 30–70% (progress framing): "{userSetCount} of {factorNodes.length} factors set by you."
- >70% (confirmation framing): "Most factors reflect your knowledge."

**Unit tests:** 0 factors (0%), all AI-estimated (0%), half user-set (50%), all user-set (100%).

### D13 — Grounded in evidence (DEFERRED)

**Retains:** "Evidence" label and existing computation (now the same metric as D12)  
**Reason:** `_evidenceNodeClass` map never populated by CEE ingestion path. No per-factor grounding signal available. See D1 audit §4.  

Deliver as doc-only commit. Old label and computation unchanged. Accepts: "Old 'Evidence' label retained; findings doc records gap."

### D14 — Bias checks (DEFERRED)

**Retains:** "Verified" label and existing `calibration` computation  
**Reason:** `bias_findings` emitted by CEE but no per-flag review-completion state in canvas store. See D1 audit §4.

Deliver as doc-only commit. Old label and computation unchanged. Accepts: "Old 'Verified' label retained; findings doc records gap."

---

## §2.5 Readiness copy tone lock

Applies to D11 and D12 (only dimensions shipping in this brief):

| State | Threshold | Framing | Example |
|---|---|---|---|
| Early | <30% | Action framing, not judgement | "Add options, a goal, and connecting factors..." / "Add your knowledge — set values for the factors you know best." |
| Mid | 30–70% | Progress framing | "Your model has the basics — ..." / "{N} of {M} factors set by you." |
| Late | >70% | Confirmation framing | "Good decision structure in place." / "Most factors reflect your knowledge." |

Copy uses British English, sentence case, no em dashes, no percentage numbers in the copy itself (the ring percentage conveys the number).

---

## §2.6 Grep gates (enforcement — run in D15)

```bash
# D3: Show winner by in Advanced only
grep -rn "winner-by-control\|Show winner by\|RiskAppetiteFilter" src/components/results/ResultsBody.tsx
# Expected: RiskAppetiteFilter component definition only; render call removed

grep -rn "winner-by-control\|Show winner by\|RiskAppetiteFilter" src/components/results/AdvancedSection.tsx
# Expected: render call present

# D4: Disclaimer out of section body
grep -rn "Some confidence scores reflect default estimates" src/components/results/DriversSection.tsx
# Expected: zero standalone paragraph occurrences; text appears only inside Tooltip content string

# D6: Combined coaching branch removed
grep -n "to review and.*quality suggestion" src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts
# Expected: zero

# D7: YourExpertise removed, repo-wide consumer check
grep -rn "YourExpertise\|AiEstimated\|MissingData\|deriveExpertiseGroups" src/
# Expected: zero (or only in test files if test cleanup pending)

# D11/D12: Old labels absent from UI copy
grep -rn '"Structure"\|"Coverage"' src/canvas/components/pre-analysis/ModelHealthCard.tsx
# Expected: zero (replaced by Decision shape / Your contribution)

# D11/D12: Old coaching text absent
grep -rn 'Structure:\|Coverage:' src/canvas/components/pre-analysis/
# Expected: zero occurrences in JSX/copy strings (type/variable names permissible)
```

---

## §2.7 Shared component safety note (D3, D8)

**D3 — `RiskAppetiteFilter`:** exported from `ResultsBody.tsx` and referenced in `ResultsBody.spec.tsx`. Moving to AdvancedSection requires updating the import site in any test file. Run `grep -rn "RiskAppetiteFilter" src/` before and after.

**D8 — `MissingKnowledgePrompt`:** shared by two consumers (`ResultsBody.tsx:356` and `PreAnalysisPanel.tsx:1778`). Both consumers get the demoted visual. Verify both render sites in Round 2 adversarial check. Run `grep -rn "MissingKnowledgePrompt" src/` to confirm no hidden third consumer.
