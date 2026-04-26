# Brief 5.6 — Staging Walkthrough Template

Signed off by: ______ Date: ______

Deploy to staging first. Walk through each check manually after deploy.

---

## Setup

- Bundle with 2+ options, 1 goal, 3+ factors, 4+ edges, at least 1 AI-estimated factor
- Run analysis to have both pre- and post-analysis states available
- Use a separate bundle with 0 options / minimal graph for early-state checks

---

## D3 — Show winner by filter in Advanced

**Setup:** Post-analysis state with multiple options and p10 data present.

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| "Show winner by" control absent from Your options section | No filter visible below WinGauge | Filter pills appear in Your options | |
| Open Advanced section | Filter pills (Conservative / Neutral / Aggressive) appear inside Advanced | Filter absent | |
| Select Conservative | Option cards reorder; different winner highlighted | No change in option card order | |
| Collapse Advanced, expand again | Selected appetite still shows as active | Filter resets to Neutral | |

**Sign-off:** ______

---

## D4 — Confidence column tooltip

**Setup:** Post-analysis state with DriversSection visible.

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| No paragraph text "Some confidence scores reflect default estimates" below the drivers table | Paragraph absent from DOM | Paragraph visible below drivers | |
| Hover over Confidence column header | Tooltip appears: "Confidence: how stable... Some confidence scores reflect default estimates..." | No tooltip | |
| Tab to Confidence column header, press Space | Tooltip appears | Tooltip only on hover | |
| Press Escape while tooltip open | Tooltip closes | Tooltip stays open | |

**Sign-off:** ______

---

## D5 — Evidence bridge compressed

**Setup:** Post-analysis state with different top driver and top evidence gap.

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| "Highest-value evidence gaps" section shows single subtitle line | "Factors where new information would most reduce uncertainty" visible | 4-line bridge paragraph visible | |
| HelpCircle (?) icon appears next to subtitle when top driver ≠ top evidence gap | Small icon visible | No icon visible | |
| Hover/tab to (?) icon | Tooltip: "Your strongest driver and your top evidence gap are different factors..." | No tooltip | |
| Bundle where top driver = top evidence gap | No (?) icon rendered | Icon appears when items match | |

**Sign-off:** ______

---

## D6 — Combined coaching branch removed

**Setup:** Pre-analysis state with both verify items and quality checks.

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| Ring coaching headline with only verify items | "N assumption(s) to review before running" | "N assumptions to review and N quality suggestions to consider" | |
| Ring coaching headline with only quality checks | "N quality suggestion(s) to consider" | Combined form | |

**Sign-off:** ______

---

## D7 — YourExpertise removed, expertise in triage cards

**Setup:** Pre-analysis state with 1+ AI-estimated factors.

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| Expand "Improve confidence" accordion | No "Your expertise" heading | "Your expertise" section header visible | |
| AI-estimated factor items visible as triage cards (with ordinal numbers) | Factor triage cards in expertise-triage-cards block | AI-estimated items absent | |
| Confirm button on an AI-estimated triage card | Inline editor opens | Confirm navigates to inspector | |
| Missing-data factor shows Set value action | Editor opens on click | No action available | |

**Sign-off:** ______

---

## D8 — MissingKnowledgePrompt demoted

**Setup:** Both pre- and post-analysis states.

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| "Something missing from the model?" prompt in pre-analysis | Text visible, no card border/background | Card-styled box | |
| "Something missing from the results?" prompt in post-analysis | Same quiet one-liner style | Card-styled box | |
| Dismiss X button | 44px tap target, dismisses on click | Button too small to tap | |
| Tab to dismiss, press Space | Prompt dismisses | Keyboard inaccessible | |

**Sign-off:** ______

---

## D9 — Improve confidence collapsed by default

**Setup:** Pre-analysis state (any model).

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| Initial render of pre-analysis panel | Improve confidence accordion collapsed | Accordion auto-expanded | |
| Count badge visible on collapsed accordion | Badge shows count | Badge only visible when expanded | |

**Sign-off:** ______

---

## D10 — Brief 5.5 verification

**Setup:** Post-analysis state.

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| Results panel — no "Olumi applied N adjustment(s)" text | Absent from results | Text visible in results | |
| Model tab → "Olumi applied N adjustment(s)" | Text present in Model tab when adjustments applied | Absent from Model tab | |

**Sign-off:** ______

---

## D11 — Decision shape readiness ring

**Setup:** Empty graph → add elements progressively.

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| Empty graph | "Decision shape" ring arc at 0% | Old "Structure" label | |
| 1 option, 1 goal, no factors, no edges | ~40% score (options 15% + goal 25%) | 33% (old boolean step) | |
| 2 options, 1 goal, 3 factors, 4 edges | 100% | Less than 100% | |
| Tooltip on "Decision shape" dimension bar | "Whether your decision has the structural elements..." | Old "Goal, options, factors..." tooltip | |

**Sign-off:** ______

---

## D12 — Your contribution readiness ring

**Setup:** Pre-analysis state with AI-estimated and user-set factors.

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| Ring shows "Your contribution" label | "Your contribution" | "Coverage" | |
| Tooltip explains user-set vs AI-estimate | "The percentage of factor values you have set or confirmed..." | Old coverage tooltip | |
| Confirming an AI-estimated factor via triage card | "Your contribution" ring arc increases | No change | |

**Sign-off:** ______

---

## D13/D14 — Deferred dimensions (verify old labels retained)

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| Ring still shows 4 dimensions | 4 bars visible: Decision shape / Evidence / Your contribution / Verified | Missing bars | |
| Position 2 shows "Evidence" | "Evidence" label | "Grounded in evidence" label | |
| Position 4 shows "Verified" | "Verified" label | "Bias checks" label | |

**Sign-off:** ______

---

## Final sign-off

All checks complete: ______ Date: ______
Notes: ______
