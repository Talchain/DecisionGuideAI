# Brief 5.1 — Phase 0 pre-flight findings

**Branch:** `ui/analysis-tab-brief-5_1` off staging (HEAD `80c6debd`)
**Date:** 2026-04-19
**Scope:** investigation + gate decisions. No production or test edits in this commit.

---

## Gate summary

| Task | Gate | Decision |
|---|---|---|
| 1 — driver expert leak | Root cause identified before edits | **Halt-to-investigate** (see §1) |
| 2 — semantic coherence bridge | Factor identity comparable without new fields | **PASS** — use `matchedNodeId ?? factorKey` vs `targetNodeId ?? factorId` |
| 3 — expertise rows value wiring | Current estimate value already threaded | **PASS** — `ImprovementItem.rawValue` present |
| 4 — certainty copy from upstream tier | Post-analysis tier fields cover all variants | **PASS** — `confidenceTier` + `coachingReadiness` + `robustnessLevel` + `recommendationStability` (see §4, corrected copy table) |
| 8 — fragility action chip | Validation handler exists | **PASS conditionally** — `onFocusNode` exists but is inspect-only. Chip label must reflect that. See §8 |
| 9 — sparkle density reduction | Pattern preserves visible keyboard affordance, Analysis-tab scope only | **PASS** — opacity-50 resting + hover/focus-within reveal; scope constrained to Analysis-tab call sites only |

---

## §1 — Task 1: driver expert leak (halt-to-investigate)

**Sole production render site of `elasticity:` / `stability:` / `influence:` trio:**

[src/components/results/DriversSection.tsx:715-723](../src/components/results/DriversSection.tsx#L715)

```tsx
{expertMode && (
  <ExpertBlock>
    <div className={`${typography.panelMeta} text-text-light flex gap-3`}>
      <span>elasticity: {typeof driver.rawElasticity === 'number' ? driver.rawElasticity.toFixed(3) : '-'}</span>
      <span>stability: {driver.attributionStability ?? '-'}</span>
      <span>influence: {typeof (driver.influenceScore ?? driver.normalisedInfluence) === 'number' ? ((driver.influenceScore ?? driver.normalisedInfluence)! * 100).toFixed(1) + '%' : '-'}</span>
    </div>
  </ExpertBlock>
)}
```

Grep across `src/` returns no other render site for the three strings together.

[ExpertBlock.tsx:15-24](../src/components/results/ExpertBlock.tsx#L15) is styling only (info-tinted background). **Gating is 100% via the outer `{expertMode && ...}`.**

Hypotheses for the staging leak (ordered for Phase 1 investigation):

1. `expertMode` prop evaluates truthy at this call site in standard view. Trace chain: ResultsBody.tsx:284 → DriversSection.tsx:790 → DriversRow.tsx:943. Check where the top-level `expertMode` comes from (store, prop, URL param, settings). Check for default-`true` anywhere in the chain.
2. A dev/debug toggle persists across sessions (localStorage, query string, cookie) and staging left it on.
3. Storybook/Jest fixtures forced `expertMode` on during a screenshot capture but the screenshot was taken against staging itself — unlikely but worth confirming by repro on staging with a fresh profile.

**Phase 1 begins with grep + trace, then reproduces the leak locally before any edit.** Fix at origin if the root cause is an upstream default; do not add defensive duplicate gates downstream. Belt-and-braces `isExpertField('elasticity')` on the existing gate is acceptable as a secondary safeguard once root cause is fixed.

**Grep gate strengthened for Phase 10:** run all three separately plus the side-by-side JSX identity:
- `rg -n "^\s*<span>elasticity:" src/components/results` → only inside expert gate
- `rg -n "stability: \{driver\.attributionStability" src/components/results` → only inside expert gate
- `rg -n "influence: \{typeof \(driver\.influenceScore" src/components/results` → only inside expert gate
- `rg -n "elasticity:|stability:|influence:" src/components/results` → hits only at DriversSection.tsx expert block

---

## §2 — Task 2: factor identity normaliser

[DriverItem.factorKey](../src/components/results/types.ts#L234): "Canonical identifier: node_id ?? factor_id ?? id ?? normalised(label)". Plus separate [matchedNodeId?](../src/components/results/types.ts#L254).

[EvidenceGapItem](../src/components/results/types.ts#L366): has `factorId: string` and `targetNodeId?: string`.

**Canonical comparison (mirrors existing pattern at [DriversSection.tsx:196](../src/components/results/DriversSection.tsx#L196)):**

```ts
const driverIdentity = topDriver.matchedNodeId ?? topDriver.factorKey
const gapIdentity = topGap.targetNodeId ?? topGap.factorId
const topItemsDiffer = driverIdentity !== gapIdentity
```

Both fallback chains resolve to the canonical canvas node id where possible; label-slug fallback is rare. No new field needed. No mutation of source data.

**Gate: PASS.** No normaliser beyond the null-coalesce pair above.

**Task 2 guardrail (from user correction):** bridge copy must not imply one section is more trustworthy, important, or action-worthy than the other. Pure descriptive distinction only.

Bridge copy locked as: *"Your strongest driver and your top evidence gap are different factors — the driver is what currently moves the result; the evidence gap is where you don't yet know enough."* Both clauses are symmetric descriptions of scope; neither prescribes action.

---

## §3 — Task 3: expertise rows

Data availability confirmed:
- [ImprovementItem](../src/canvas/components/pre-analysis/hooks/deriveExpertiseGroups.ts#L63) carries `rawValue?: number | string | null` and `unit?: string | null` on every item in `groups.aiEstimated` and `groups.missingData`.
- [AiEstimated.tsx:66](../src/canvas/components/pre-analysis/expertise/AiEstimated.tsx#L66) currently formats via `formatValueWithUnit` — migrate to [formatFactorDisplayValue](../src/utils/formatFactorDisplayValue.ts#L95) to gain CEE `display_value` short-circuit and stay parity-aligned with Review-next triage cards.
- Parent [YourExpertise.tsx:218](../src/canvas/components/pre-analysis/expertise/YourExpertise.tsx#L218) already owns action routing; hoisting `activeEditorId: string | null` there gives the one-active-editor invariant without new global state.

**Gate: PASS.**

**Added from user correction:** icon sizing/spacing parity between Expertise expanded rows and Review-next triage cards. Review-next cards render Confirm / Edit / Sparkle as 16px Lucide icons on `h-8 w-8` buttons in a `flex items-center gap-1.5` row. Phase 4 acceptance includes: Estimated-row icon hit-area, icon size, and inter-icon gap must match the Review-next card pattern. No new sizing tokens.

---

## §4 — Task 4: canonical post-analysis tier fields (corrected)

**Previous plan error:** mixed pre-analysis `decision_readiness.ready: bool + confidence: 'high'|'medium'|'low'` with post-analysis enum values. Pre-analysis fields are unrelated to the Analysis-tab hero copy and are not consumed by HeroSection.

**Corrected canonical post-analysis fields** (all already consumed by the Analysis tab today):

| UI field | Upstream source | Values | Consuming site |
|---|---|---|---|
| `confidenceTier` | PLoT V2 `confidence_tier` | `'strong' \| 'fair' \| 'needs_work' \| 'unknown'` | [ConfidenceSection.tsx:151-169](../src/components/results/ConfidenceSection.tsx#L151) |
| `coachingReadiness` | `m1Coaching.readiness` | `'ready' \| 'close_call' \| 'needs_evidence' \| 'needs_framing' \| 'low' \| 'not_ready'` | [HeroSection.tsx:103](../src/components/results/HeroSection.tsx#L103), [ConfidenceSection.tsx:94](../src/components/results/ConfidenceSection.tsx#L94) |
| `robustnessLevel` | PLoT V2 `robustness.level` | `'high' \| 'moderate' \| 'low' \| 'very_low'` | [HeroSection.tsx:236](../src/components/results/HeroSection.tsx#L236), AdvancedSection |
| `recommendationStability` | PLoT V2 `robustness.recommendation_stability` | `number` 0–1 | Hero, `stability.ts` classification |

**No pre-analysis fields are used in the Analysis-tab hero copy and none will be introduced by this brief.** No new local numeric thresholds.

### Corrected copy mapping table (for Paul's approval)

Single enum vocabulary throughout. No collisions.

| # | Condition (evaluated top-down; first match wins) | Headline qualifier | Caveat |
|---|---|---|---|
| 1 | `recommendationStability` is a number AND `< 0.70` | `"No clear leading option — the result is sensitive to your estimates"` | null |
| 2 | `confidenceTier === 'needs_work'` OR `coachingReadiness ∈ {'needs_evidence', 'needs_framing', 'low', 'not_ready'}` | `"{winnerLabel} currently leads"` | `"Result depends on factors with limited evidence — see Top evidence value."` |
| 3 | `confidenceTier === 'fair'` OR `coachingReadiness === 'close_call'` | `"{winnerLabel} currently leads"` | null |
| 4 | `confidenceTier === 'strong'` AND `coachingReadiness === 'ready'` | `"{winnerLabel} is the leading option"` | null |
| 5 | `confidenceTier === 'unknown'` OR both fields absent | default fallback: `"{winnerLabel} currently leads"` | null |

Footer stability label continues to flow through [stability.ts:getStabilityClassification](../src/lib/stability.ts#L44) (four buckets: Stable result / Mostly stable / Sensitive to assumptions / Highly sensitive). **`certaintyCopy.ts` does not reimplement footer mapping** — it imports from `stability.ts` only to avoid drift.

### Analysis-details copy consistency (from user correction)

Screenshot 1 shows "Mostly stable" (hero footer) alongside "Stability 80%" + "Sensitive assumptions: 10" in the Advanced details. Same run.

Resolution rule (baked into Phase 2 acceptance):

- "Mostly stable" is correct per `stability.ts` at `stability >= 0.70` (80% qualifies).
- "Sensitive assumptions: 10" is the raw fragile-edge count (expert field, appropriate for Advanced).
- Copy dissonance comes from these two signals not being framed in relation to each other. **Fix:** the hero caveat branch (row 2 of table above) already references "Top evidence value" — no additional microcopy needed in Advanced. But the Advanced footer adjacent to "Stability 80%" must not contradict the hero's "Mostly stable" label; audit [HeroSection.tsx:404](../src/components/results/HeroSection.tsx#L404) comment about "sensitive (readiness downgrade)" path during Phase 2 to ensure the hero/footer both defer to `stability.ts` output.

**Gate: PASS** with corrected enum vocabulary and copy table.

---

## §5, §6, §7 — layout/chip tasks

No new findings beyond the plan. Phase 5 (tornado legend), Phase 6 (risk control icons), Phase 7 (runner-up title + chip copy) proceed as planned.

---

## §8 — Task 8: fragility chip label honesty (user correction)

[ChallengeSection.tsx:167](../src/components/results/ChallengeSection.tsx#L167) `FragileEdgeRow` already wires `onFocusNode(focusId)` via the PanelRight inspector icon at line 266. **No validation/calibration handler exists** — the handler opens the inspector on the affected node, no validation workflow is invoked.

**Chip label changed from "Validate this relationship" to "Review this relationship".** "Validate" overpromises relative to what `onFocusNode` does. "Review" honestly describes the action: navigate to the edge in the inspector for user review.

**Gate: PASS with corrected label.**

---

## §9 — Task 9: sparkle density reduction (scope corrected)

**Scope constrained to Analysis-tab call sites only per user correction.** The 66-site cross-codebase inventory from broader exploration is explicitly out of scope for Brief 5.1.

### Analysis-tab sparkle inventory (scope-bounded)

Grep of `src/components/results/` for direct Sparkles imports returns **1 file**: [ChallengeSection.tsx](../src/components/results/ChallengeSection.tsx). Shared interactive that also renders on the Analysis tab: `DiscussWithAiButton` (rendered from ChallengeSection and other results components via imports).

Analysis-tab sparkle surfaces to touch in Phase 9:
1. Direct: ChallengeSection discuss-with-ai sparkle(s)
2. Shared: `DiscussWithAiButton` — add `variant?: 'primary' | 'secondary'` prop; default `'primary'` (preserves current behaviour everywhere else). Analysis-tab non-primary call sites pass `'secondary'`.

Other surfaces (pre-analysis, canvas, suggestions panels, etc.) — not touched. If those need attention later, separate brief.

### Pattern (visibility floor from user correction)

- Primary variant: current emphasis
- Secondary variant: `opacity-50` at rest, `hover:opacity-100` + `focus-within:opacity-100`
- **Forbidden:** `opacity-0`, `sr-only`, or anything that makes the control invisible at rest. Secondary sparkles must remain visibly discoverable at rest (opacity-50 acceptable floor).

**Gate: PASS.**

---

## Additional scope / deferrals (user correction)

| Item | Disposition |
|---|---|
| Analysis-details copy dissonance ("Mostly stable" vs "Stability 80%" + "Sensitive assumptions: 10") | **Folded into Task 4 microcopy acceptance** (§4 above) — no new task. |
| Expertise/Review-next icon sizing parity | **Folded into Task 3 acceptance** (§3 above) — no new task. |
| "Try: reference class forecasting" chip verification | **Confirmed decorative.** [DriversSection.tsx:531-532](../src/components/results/DriversSection.tsx#L531) renders it as `<p className="text-info">` — plain paragraph, not a button. Same in [WorthInvestigating.tsx:245](../src/canvas/components/pre-analysis/WorthInvestigating.tsx#L245). **Disposition:** wire it to chat. Promote to `<button>` in Phase 8 (or a new Phase 7.5) that calls `onSendMessage` with the factor + technique context. Small scope; deferring would leave an obvious non-interactive affordance that looks clickable. **Added as Task 7.5 — technique-chip wire-up** (one commit, scope ≤20 lines). |

---

## Approvals checkpoint

Before Phase 1 implementation begins, Paul approves:
- [ ] Task 1 investigation hypotheses order (§1)
- [ ] Task 4 corrected copy mapping table (§4)
- [ ] Task 8 chip label "Review this relationship" (§8)
- [ ] Task 9 constrained scope — Analysis-tab call sites + DiscussWithAiButton variant only (§9)
- [ ] Task 7.5 wire-up of "Try: reference class forecasting" chip (§additional)

Once approved, Phase 0 commits, then Phase 1 begins.
