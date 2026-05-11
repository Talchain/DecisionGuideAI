# Handoff — DS v5 token drift in `PreAnalysisHealth.tsx` and stale `UI-SEM-009`

**From:** U1 AI-panel design-system cleanup workstream
**To:** Pre-analysis / post-analysis right-hand panel workstream
**Source commit on U1 branch:** `2c74a294` (`claude/reverent-gates-e6655c`)
**Reference base SHA:** `f95792b9` (`origin/staging` at the time of U1)

## Why this handoff exists

While preparing U1 (AI-panel design-system cleanup), the audit flagged two DS v5 violations whose source files sit in the right-hand panel surface — outside U1's authorised scope. A migration was prepared locally, then removed from the U1 PR to respect workstream boundaries. This document hands the work to whoever owns those files. Adopt, modify, or reject as you see fit.

The local reference patches at `.claude/notes/u1-preanalysis-health-reference.patch` and `.claude/notes/u1-claude-md-uisem009-reference.patch` are git-ignored and not portable. The full diffs are embedded below so this handoff is self-sufficient.

## Item 1 — `src/canvas/components/PreAnalysisHealth.tsx`

### Caveats before adoption

- **`PreAnalysisHealth.tsx` appears to be an orphan in the current tree.** `grep -rn "PreAnalysisHealth" src/` shows no importers other than itself and a doc comment in `src/canvas/stores/readinessStore.ts:45`. Verify it is a live target before consuming this migration. If it is being deleted, the patch is moot.
- **Panel typography migration changes some visible text sizes.** `typography.body` (16px) → `panelHeader` (14px) on tier and item titles, and `typography.caption` (12px) → `panelMeta` (11px) on tertiary metadata. Visual but no layout breakage observed in flex containers.
- **Migration is purely visual.** No logic, layout, conditional, click handler, ARIA label, or state-behaviour change.
- **British sentence case applied.** "Needs Work" → "Needs work"; "High Priority" → "High priority"; "Nice to Have" → "Nice to have".
- **Trailing `...` → typographic `…`** in the loading-state copy.

### Summary of changes

#### `tierConfig` (×3 readiness tiers)

Replace light-shade banner fills + branded text with the DS v5 neutral-card pattern (`bg-panel` + semantic border at 30% opacity + icon-carries-colour):

| Tier | Before | After |
|---|---|---|
| needs_work | `bg-carrot-50 border-carrot-200 text-carrot-800 text-carrot-600` | `bg-panel border-danger/30 text-text-body text-danger` |
| fair | `bg-banana-50 border-banana-200 text-banana-800 text-banana-600` | `bg-panel border-warning/30 text-text-body text-warning` |
| strong | `bg-mint-50 border-mint-200 text-mint-800 text-mint-600` | `bg-panel border-success/30 text-text-body text-success` |

#### `priorityConfig` (×3 improvement priorities) — filled → outlined pills

| Priority | Before | After |
|---|---|---|
| high | `bg-carrot-100 text-carrot-700` | `bg-transparent border border-danger/30 text-text-body` |
| medium | `bg-banana-100 text-banana-700` | `bg-transparent border border-warning/30 text-text-body` |
| low | `bg-sky-100 text-sky-700` | `bg-transparent border border-info/30 text-text-body` |

Section-title `textColor` reduced to `text-text-body` for all three (DS rule: colour is carried by the border on pills, never by the text).

#### Loading / error states

- Loading state: `bg-sand-50 border-sand-200 text-sand-{500,600}` → `bg-panel border-panel-border text-text-light`
- Error state: `bg-carrot-50 border-carrot-200 text-carrot-{600,700} hover:bg-carrot-100` → `bg-panel border-danger/30 text-danger text-text-body hover:bg-panel-hover`

#### Run-analysis button

| State | Before | After |
|---|---|---|
| enabled | `bg-sky-500 text-white hover:bg-sky-600` + `typography.bodySmall font-medium` | `bg-primary text-text-on-color hover:bg-primary-hover` + `typography.panelHeader` |
| disabled | `bg-sand-200 text-sand-500 cursor-not-allowed` + `typography.bodySmall font-medium` | `bg-primary-disabled text-text-on-color cursor-not-allowed` + `typography.panelHeader` |

#### Improvement section + item

- Card: `bg-paper-50 border-sand-200` → `bg-panel border-panel-border`
- Header row: `bg-sand-50 border-b border-sand-200` → `bg-panel-hover border-b border-panel-border`
- Divider: `divide-sand-100` → `divide-panel-border`
- Action title: `text-ink-800` + `typography.body` → `text-text-header` + `typography.panelHeader`
- Wrench icon: `text-ink-400` → `text-text-light`
- Gap description: `text-ink-500` + `typography.caption` → `text-text-light` + `typography.panelBody`
- Target-score row: `text-mint-600` + `typography.caption` + nested `font-medium` → `text-success` + `typography.panelMeta` (weight override dropped)
- Effort badge: `text-ink-400` + `typography.caption` → `text-text-light` + `typography.panelMeta`
- Node-count badge: `text-sky-600` + `typography.caption` → `text-info` + `typography.panelMeta`
- "Add {type}" pill: `bg-mint-100 text-mint-700` (filled) + `typography.caption` → `bg-transparent border border-success/30 text-text-body` (outlined) + `typography.panelMeta`
- "Click to focus" hint: `text-sky-600` + `typography.caption` → `text-info` + `typography.panelMeta`

#### Typography migration to DS v5 panel tokens

All `typography.body`, `typography.bodySmall`, `typography.caption`, and `typography.label` references inside the component swap to `panelHeader` / `panelBody` / `panelMeta` per DS v5 §22 panel scope. All `font-medium`/`font-semibold` overrides removed (DS rule: no font-weight overrides on panel tokens — use `panelHeader` for 14px semibold, never `panelBody font-semibold`).

### Suggested verification after adoption

```
npx eslint src/canvas/components/PreAnalysisHealth.tsx          # expect 0 errors
grep -nE "bg-(carrot|banana|mint|sky|sand|paper)-|text-(carrot|banana|mint|sky|sand|ink)-|border-(carrot|banana|mint|sand)-|divide-sand-" \
  src/canvas/components/PreAnalysisHealth.tsx                    # expect empty
grep -nE "typography\.(body|bodySmall|caption|label|h[1-5])\b|font-(medium|semibold|bold)" \
  src/canvas/components/PreAnalysisHealth.tsx                    # expect empty
```

If `PreAnalysisHealth` is wired up to a panel surface, a Playwright/visual-regression pass on the three tier states (needs_work / fair / strong) is recommended.

## Item 2 — `CLAUDE.md` UI-SEM-009 row clarification

The current row points at `src/canvas/components/DecisionSummary.tsx:239` for a p15/p85 fabrication. The fabrication was already removed (cleanup marker at `DecisionSummary.tsx:238` per Audit F-55), so the row is factually stale.

### Proposed wording

Replace the existing row with:

```
| UI-SEM-009 | (no longer applicable) | p15/p85 confidence band fabrication | Resolved — fabrication removed per Audit F-55 (`DecisionSummary.tsx:238` cleanup marker); row retained for ID stability |
```

`DecisionSummary.tsx` sits in right-hand panel / results territory, so the doc update belongs with this workstream rather than the AI-panel U1.

## Full reference diff — `PreAnalysisHealth.tsx`

The complete patch is embedded below so this handoff is fully self-sufficient. It is the diff between `f95792b9` (the U1 branch base) and `bddd14b6` (the prepared-but-removed migration commit; reachable on the U1 branch reflog at the time of writing, **not** on any active branch — embed below is the authoritative copy).

> **Earlier draft warning:** A previous version of this doc suggested regenerating from `2c74a294`, which is incorrect — `2c74a294` is the U1 head **after** the soft-reset that removed the PreAnalysisHealth migration from the PR, so a diff against it returns nothing. The correct regeneration command is:
>
> ```
> git diff f95792b9 bddd14b6 -- src/canvas/components/PreAnalysisHealth.tsx
> # Requires bddd14b6 to be reachable (e.g. preserved in the U1 branch reflog
> # or tagged); otherwise consume the embedded patch below.
> ```

```diff
diff --git a/src/canvas/components/PreAnalysisHealth.tsx b/src/canvas/components/PreAnalysisHealth.tsx
index 3abfb80a..74ebbd44 100644
--- a/src/canvas/components/PreAnalysisHealth.tsx
+++ b/src/canvas/components/PreAnalysisHealth.tsx
@@ -54,7 +54,8 @@ interface PreAnalysisHealthProps {
   hasBlockers?: boolean
 }
 
-// Tier styling configuration
+// Tier styling configuration. Per DS v5: neutral panel background, semantic
+// border via opacity, icons carry the colour.
 const tierConfig: Record<ReadinessLevel, {
   icon: typeof CheckCircle
   bgColor: string
@@ -65,46 +66,46 @@ const tierConfig: Record<ReadinessLevel, {
 }> = {
   needs_work: {
     icon: AlertTriangle,
-    bgColor: 'bg-carrot-50',
-    borderColor: 'border-carrot-200',
-    textColor: 'text-carrot-800',
-    iconColor: 'text-carrot-600',
-    label: 'Needs Work',
+    bgColor: 'bg-panel',
+    borderColor: 'border-danger/30',
+    textColor: 'text-text-body',
+    iconColor: 'text-danger',
+    label: 'Needs work',
   },
   fair: {
     icon: TrendingUp,
-    bgColor: 'bg-banana-50',
-    borderColor: 'border-banana-200',
-    textColor: 'text-banana-800',
-    iconColor: 'text-banana-600',
+    bgColor: 'bg-panel',
+    borderColor: 'border-warning/30',
+    textColor: 'text-text-body',
+    iconColor: 'text-warning',
     label: 'Fair',
   },
   strong: {
     icon: CheckCircle,
-    bgColor: 'bg-mint-50',
-    borderColor: 'border-mint-200',
-    textColor: 'text-mint-800',
-    iconColor: 'text-mint-600',
+    bgColor: 'bg-panel',
+    borderColor: 'border-success/30',
+    textColor: 'text-text-body',
+    iconColor: 'text-success',
     label: 'Strong',
   },
 }
 
-// Priority styling
+// Priority styling. Outlined pills only: neutral text, semantic border at 30%.
 const priorityConfig: Record<ImprovementPriority, {
   badgeColor: string
   textColor: string
 }> = {
   high: {
-    badgeColor: 'bg-carrot-100 text-carrot-700',
-    textColor: 'text-carrot-700',
+    badgeColor: 'bg-transparent border border-danger/30 text-text-body',
+    textColor: 'text-text-body',
   },
   medium: {
-    badgeColor: 'bg-banana-100 text-banana-700',
-    textColor: 'text-banana-700',
+    badgeColor: 'bg-transparent border border-warning/30 text-text-body',
+    textColor: 'text-text-body',
   },
   low: {
-    badgeColor: 'bg-sky-100 text-sky-700',
-    textColor: 'text-sky-700',
+    badgeColor: 'bg-transparent border border-info/30 text-text-body',
+    textColor: 'text-text-body',
   },
 }
 
@@ -164,11 +165,11 @@ export function PreAnalysisHealth({
   // Loading state
   if (loading && !readiness) {
     return (
-      <div className="p-4 bg-sand-50 border border-sand-200 rounded-xl">
+      <div className="p-4 bg-panel border border-panel-border rounded-xl">
         <div className="flex items-center gap-3">
-          <Loader2 className="h-5 w-5 text-sand-500 animate-spin" aria-hidden="true" />
-          <span className={`${typography.body} text-sand-600`}>
-            Checking graph health...
+          <Loader2 className="h-5 w-5 text-text-light animate-spin" aria-hidden="true" />
+          <span className={`${typography.panelBody} text-text-light`}>
+            Checking graph health…
           </span>
         </div>
       </div>
@@ -178,18 +179,18 @@ export function PreAnalysisHealth({
   // Error state with fallback display
   if (error && !readiness) {
     return (
-      <div className="p-4 bg-carrot-50 border border-carrot-200 rounded-xl">
+      <div className="p-4 bg-panel border border-danger/30 rounded-xl">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
-            <AlertTriangle className="h-5 w-5 text-carrot-600" aria-hidden="true" />
-            <span className={`${typography.body} text-carrot-700`}>
+            <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
+            <span className={`${typography.panelBody} text-text-body`}>
               Could not check graph health
             </span>
           </div>
           <button
             type="button"
             onClick={refresh}
-            className={`${typography.caption} flex items-center gap-1 px-2 py-1 rounded text-carrot-600 hover:bg-carrot-100 transition-colors`}
+            className={`${typography.panelMeta} flex items-center gap-1 px-2 py-1 rounded text-text-body hover:bg-panel-hover transition-colors`}
             aria-label="Retry health check"
           >
             <RefreshCw className="h-3.5 w-3.5" />
@@ -220,17 +221,17 @@ export function PreAnalysisHealth({
             />
             <div>
               <div className="flex items-center gap-2 mb-1">
-                <span className={`${typography.body} font-semibold ${config.textColor}`}>
+                <span className={`${typography.panelHeader} ${config.textColor}`}>
                   {config.label}
                 </span>
-                <span className={`${typography.caption} ${config.textColor} opacity-70`}>
+                <span className={`${typography.panelMeta} text-text-light`}>
                   ({readiness.readiness_score}%)
                 </span>
                 {loading && (
-                  <Loader2 className="h-3.5 w-3.5 text-sand-400 animate-spin" aria-hidden="true" />
+                  <Loader2 className="h-3.5 w-3.5 text-text-light animate-spin" aria-hidden="true" />
                 )}
               </div>
-              <p className={`${typography.caption} ${config.textColor} opacity-80`}>
+              <p className={`${typography.panelBody} text-text-light`}>
                 {readiness.confidence_explanation}
               </p>
             </div>
@@ -239,7 +240,7 @@ export function PreAnalysisHealth({
           {/* Action buttons */}
           <div className="flex items-center gap-2 flex-shrink-0">
             {totalImprovements > 0 && (
-              <span className={`${typography.caption} text-ink-500`}>
+              <span className={`${typography.panelMeta} text-text-light`}>
                 {totalImprovements} improvement{totalImprovements !== 1 ? 's' : ''}
               </span>
             )}
@@ -247,10 +248,10 @@ export function PreAnalysisHealth({
               type="button"
               onClick={onAnalyze}
               disabled={!readiness.can_run_analysis || isAnalyzing || hasBlockers}
-              className={`${typography.bodySmall} px-4 py-2 rounded-lg font-medium transition-colors ${
+              className={`${typography.panelHeader} px-4 py-2 rounded-lg transition-colors ${
                 readiness.can_run_analysis && !isAnalyzing && !hasBlockers
-                  ? 'bg-sky-500 text-white hover:bg-sky-600'
-                  : 'bg-sand-200 text-sand-500 cursor-not-allowed'
+                  ? 'bg-primary text-text-on-color hover:bg-primary-hover'
+                  : 'bg-primary-disabled text-text-on-color cursor-not-allowed'
               }`}
               aria-label={hasBlockers ? 'Fix critical issues first' : readiness.can_run_analysis ? 'Run analysis' : 'Fix issues before running analysis'}
             >
@@ -273,7 +274,7 @@ export function PreAnalysisHealth({
           {/* High priority */}
           {groupedImprovements.high.length > 0 && (
             <ImprovementSection
-              title="High Priority"
+              title="High priority"
               priority="high"
               improvements={groupedImprovements.high}
               onFocus={handleFocusImprovement}
@@ -293,7 +294,7 @@ export function PreAnalysisHealth({
           {/* Low priority */}
           {groupedImprovements.low.length > 0 && (
             <ImprovementSection
-              title="Nice to Have"
+              title="Nice to have"
               priority="low"
               improvements={groupedImprovements.low}
               onFocus={handleFocusImprovement}
@@ -317,11 +318,11 @@ function ImprovementSection({ title, priority, improvements, onFocus }: Improvem
   const config = priorityConfig[priority]
 
   return (
-    <div className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden">
-      <div className="px-4 py-2 bg-sand-50 border-b border-sand-200">
-        <span className={`${typography.label} ${config.textColor}`}>{title}</span>
+    <div className="bg-panel border border-panel-border rounded-xl overflow-hidden">
+      <div className="px-4 py-2 bg-panel-hover border-b border-panel-border">
+        <span className={`${typography.panelHeader} ${config.textColor}`}>{title}</span>
       </div>
-      <div className="divide-y divide-sand-100">
+      <div className="divide-y divide-panel-border">
         {improvements.map((improvement, index) => (
           <ImprovementItem
             key={`${improvement.category}-${index}`}
@@ -360,51 +361,51 @@ function ImprovementItem({ improvement, priority, onClick }: ImprovementItemProp
       disabled={!hasAffectedElements && !hasSuggestedType}
       className={`w-full px-4 py-3 text-left transition-colors ${
         hasAffectedElements || hasSuggestedType
-          ? 'cursor-pointer hover:bg-sand-50'
+          ? 'cursor-pointer hover:bg-panel-hover'
           : 'cursor-default'
       }`}
       aria-label={`${improvement.action} - ${improvement.category}`}
     >
       <div className="flex items-start gap-3">
-        <Wrench className="h-4 w-4 text-ink-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
+        <Wrench className="h-4 w-4 text-text-light flex-shrink-0 mt-0.5" aria-hidden="true" />
         <div className="flex-1 min-w-0">
           {/* Action title with category badge */}
           <div className="flex items-center gap-2 mb-1 flex-wrap">
-            <span className={`${typography.body} text-ink-800`}>
+            <span className={`${typography.panelHeader} text-text-header`}>
               {improvement.action}
             </span>
-            <span className={`${typography.caption} px-1.5 py-0.5 rounded ${config.badgeColor}`}>
+            <span className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full ${config.badgeColor}`}>
               {improvement.category}
             </span>
           </div>
 
           {/* Target score display: Current → Target */}
           {currentScore !== undefined && targetScore !== undefined && (
-            <div className={`${typography.caption} flex items-center gap-1.5 mb-1 text-mint-600`}>
-              <span className="text-ink-500">{Math.round(currentScore)}%</span>
+            <div className={`${typography.panelMeta} flex items-center gap-1.5 mb-1 text-success`}>
+              <span className="text-text-light">{Math.round(currentScore)}%</span>
               <ArrowRight className="h-3 w-3" aria-hidden="true" />
-              <span className="font-medium">{Math.round(targetScore)}%</span>
-              <span className="text-ink-400">(+{improvement.quality_impact}pts)</span>
+              <span>{Math.round(targetScore)}%</span>
+              <span className="text-text-light">(+{improvement.quality_impact}pts)</span>
             </div>
           )}
 
           {/* Gap description */}
           {improvement.current_gap && (
-            <p className={`${typography.caption} text-ink-500 mb-1`}>
+            <p className={`${typography.panelBody} text-text-light mb-1`}>
               {improvement.current_gap}
             </p>
           )}
 
           {/* Metadata row: time, affected count, suggested type */}
           <div className="flex items-center gap-3 flex-wrap">
-            <span className={`${typography.caption} flex items-center gap-1 text-ink-400`}>
+            <span className={`${typography.panelMeta} flex items-center gap-1 text-text-light`}>
               <Clock className="h-3 w-3" aria-hidden="true" />
               ~{improvement.effort_minutes}m
             </span>
 
             {/* Node count badge */}
             {affectedNodeCount > 0 && (
-              <span className={`${typography.caption} flex items-center gap-1 text-sky-600`}>
+              <span className={`${typography.panelMeta} flex items-center gap-1 text-info`}>
                 <MapPin className="h-3 w-3" aria-hidden="true" />
                 {affectedNodeCount} node{affectedNodeCount !== 1 ? 's' : ''} affected
               </span>
@@ -412,7 +413,7 @@ function ImprovementItem({ improvement, priority, onClick }: ImprovementItemProp
 
             {/* Suggested node type hint */}
             {hasSuggestedType && (
-              <span className={`${typography.caption} flex items-center gap-1 px-1.5 py-0.5 rounded bg-mint-100 text-mint-700`}>
+              <span className={`${typography.panelMeta} flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-transparent border border-success/30 text-text-body`}>
                 <Plus className="h-3 w-3" aria-hidden="true" />
                 Add {nodeTypeLabels[improvement.suggested_node_type!]}
               </span>
@@ -420,7 +421,7 @@ function ImprovementItem({ improvement, priority, onClick }: ImprovementItemProp
 
             {/* Click to focus hint */}
             {hasAffectedElements && !hasSuggestedType && (
-              <span className={`${typography.caption} text-info`}>
+              <span className={`${typography.panelMeta} text-info`}>
                 Click to focus
               </span>
             )}
```

## Full reference diff — `CLAUDE.md` UI-SEM-009 row

```diff
-| UI-SEM-009 | `src/canvas/components/DecisionSummary.tsx:239` | p15/p85 confidence band fabrication (interpolated from p10/p50/p90) | Remove — request from PLoT or delete |
+| UI-SEM-009 | (no longer applicable) | p15/p85 confidence band fabrication | Resolved — fabrication removed per Audit F-55 (`DecisionSummary.tsx:238` cleanup marker); row retained for ID stability |
```

## Coordination

This handoff is filed under `docs/follow-ups/` to be discoverable by the right-hand panel team. No action is required on the U1 PR; adoption is at this workstream's discretion. Questions: contact U1 author via the AI-panel branch.
