# Windsurf Implementation Brief: Complete Week 2 Layout Migration

**Project:** Olumi Scenario Sandbox PoC  
**Phase:** Week 2 - Layout Migration Completion  
**Status:** Chrome built (TopBar, LeftSidebar, RightPanel) → Need to wire as primary layout  
**Objective:** Replace old panels with new chrome, maximize canvas space  
**Quality Standard:** Production-ready, enterprise-grade, delightful UX

---

## Current State Analysis

### What You've Built (Working) ✓
- **TopBar** — Logo, editable title, Save/Share, menu (45px height)
- **LeftSidebar** — 8 icon tools with tooltips and callbacks (48px width)
- **RightPanel** — Reusable shell with subtle slide animation (360px width)
- All components tested and functional

### Problem Identified (Screenshot Evidence)
**Both old and new layouts are rendering simultaneously:**

```
Current (Broken):
TopBar (new) ✓
├─ LeftSidebar (new) ✓         48px
├─ InputsDock (old) ✗          320px  ← BLOCKING CANVAS
├─ Canvas (squeezed)           ~50%
├─ OutputsDock (old) ✗         360px  ← BLOCKING CANVAS
└─ CanvasToolbar (bottom) ✗            ← DUPLICATE CONTROLS

Result: Canvas only 50% width, duplicate controls, visual clutter
```

```
Target (Fixed):
TopBar (new) ✓
├─ LeftSidebar (new) ✓         48px
├─ Canvas (maximized)          85%+
└─ RightPanel (contextual) ✓  360px (when open)

Result: Canvas dominates, clean interface, single control surface
```

---

## Implementation Tasks

### Task A: Add Layout Feature Flag (15min)

**File:** `src/canvas/ReactFlowGraph.tsx` or `src/routes/CanvasMVP.tsx`

**At the top of the component:**
```typescript
// Week 2: New canvas-first layout
const USE_NEW_LAYOUT = true

// TODO: Later convert to:
// const USE_NEW_LAYOUT = useFeatureFlag('canvas-v2-layout')
```

### Task B: Conditional Layout Rendering (1h)

**Implement clean separation between old and new layouts:**

```typescript
function ReactFlowGraph() {
  // ... existing state and hooks

  const USE_NEW_LAYOUT = true

  return (
    <div className={styles.reactFlowGraphWrapper}>
      {/* Top bar - always visible in new layout */}
      {USE_NEW_LAYOUT && <TopBar {...topBarProps} />}

      <ReactFlowProvider>
        <div className={styles.canvasContainer}>
          {USE_NEW_LAYOUT ? (
            <>
              {/* NEW LAYOUT */}
              <LeftSidebar
                onAiClick={() => setShowDraftChat(true)}
                onAddNodeClick={handleQuickAddClick}
                onTemplatesClick={handleEmptyStateTemplate}
                onRunClick={handleRunSimulation}
                onCompareClick={handleOpenCompare}
                onEvidenceClick={() => setShowProvenanceHub(true)}
                onFitClick={() => fitView({ padding: 0.2, duration: 300 })}
                onHelpClick={openKeyboardLegend}
              />

              {/* Canvas - maximized space */}
              <div className={styles.canvasMain}>
                <ReactFlow {...reactFlowProps}>
                  {/* Canvas content */}
                </ReactFlow>
                
                {/* On-canvas badges */}
                <StatusChips {...statusProps} />
              </div>

              {/* Right panel - contextual (results, compare, inspector) */}
              {renderRightPanel()}
            </>
          ) : (
            <>
              {/* OLD LAYOUT (legacy, will be removed later) */}
              <InputsDock />
              <div className={styles.canvasMain}>
                <ReactFlow {...reactFlowProps} />
              </div>
              <OutputsDock />
              <CanvasToolbar />
            </>
          )}
        </div>
      </ReactFlowProvider>

      {/* Modals and overlays (layout-independent) */}
      {showDraftChat && <DraftChatModal />}
      {showKeyboardLegend && <KeyboardLegend />}
    </div>
  )
}
```

### Task C: Create renderRightPanel Helper (1h)

**Consolidate all right-side content into single RightPanel:**

```typescript
function renderRightPanel() {
  // Determine what should show in right panel
  const panelMode = getRightPanelMode()
  
  if (!panelMode) return null

  return (
    <RightPanel width="360px" onClose={closeRightPanel}>
      {panelMode === 'results' && <UnifiedResultsPanel />}
      {panelMode === 'compare' && <ComparePanel />}
      {panelMode === 'inspector' && <NodeInspector />}
      {panelMode === 'provenance' && <ProvenanceHubTab />}
      {panelMode === 'framing' && <FramingEditor />}
      {panelMode === 'templates' && <TemplatesLibrary />}
    </RightPanel>
  )
}

function getRightPanelMode(): PanelMode | null {
  // Priority order (only one panel open at a time)
  if (showProvenanceHub) return 'provenance'
  if (selectedNode || selectedEdge) return 'inspector'
  if (results?.status === 'complete') return 'results'
  if (showCompare) return 'compare'
  if (showFramingEditor) return 'framing'
  if (showTemplates) return 'templates'
  return null
}

function closeRightPanel() {
  setShowProvenanceHub(false)
  setShowCompare(false)
  setShowFramingEditor(false)
  setShowTemplates(false)
  setSelectedNode(null)
  setSelectedEdge(null)
}
```

### Task D: Migrate Content to RightPanel (2h)

**Extract content from old panels into new panel modes:**

#### D1: Results Panel
```typescript
// src/components/panels/UnifiedResultsPanel.tsx
export function UnifiedResultsPanel() {
  const results = useCanvasStore(s => s.results)
  const report = results?.report
  
  if (!report) return null

  return (
    <div className="unified-results">
      {/* Header with verification badge */}
      <div className="panel-header">
        <h2>Results</h2>
        <VerificationBadge score={report.verification?.score} />
      </div>

      {/* Key insight (from Week 1 unified insights) */}
      <section className="key-insight">
        <h3>📊 Key Insight</h3>
        <p>{report.insights?.summary}</p>
      </section>

      {/* Expected outcome with humanized ranges (from Week 1) */}
      <section className="expected-outcome">
        <RangeDisplay 
          baseline={report.baseline}
          expected={report.expected}
          range={report.range}
          unit={report.unit}
          label={report.label}
        />
      </section>

      {/* Confidence (expandable) */}
      <Expandable title="Confidence: Medium" defaultOpen={false}>
        <ConfidenceBreakdown data={report.confidence} />
      </Expandable>

      {/* Top drivers (from Week 1) */}
      <section className="top-drivers">
        <h3>🎯 What's Driving This</h3>
        <DriversList drivers={report.topDrivers} />
      </section>

      {/* Risks & actions */}
      <section className="risks">
        <h3>⚠️ Risks</h3>
        <RisksList risks={report.insights?.risks} />
      </section>

      <section className="actions">
        <h3>✅ Recommended Actions</h3>
        <ActionsList actions={report.insights?.nextSteps} />
      </section>

      {/* Advanced (collapsed) */}
      <Expandable title="Advanced" defaultOpen={false}>
        <DiagnosticsSection />
        <GraphStructureView />
      </Expandable>
    </div>
  )
}
```

#### D2: Compare Panel
```typescript
// src/components/panels/ComparePanel.tsx
export function ComparePanel() {
  const scenarios = useCanvasStore(s => s.runHistory)
  const [baseline, setBaseline] = useState(scenarios[0])
  const [comparison, setComparison] = useState(scenarios[1])

  return (
    <div className="compare-panel">
      <div className="panel-header">
        <h2>Compare Scenarios</h2>
      </div>

      {/* Scenario selectors */}
      <div className="scenario-selectors">
        <Select 
          value={baseline}
          onChange={setBaseline}
          options={scenarios}
          label="Baseline"
        />
        <span>→</span>
        <Select 
          value={comparison}
          onChange={setComparison}
          options={scenarios}
          label="Comparison"
        />
      </div>

      {/* Outcome delta */}
      <div className="outcome-delta">
        <h3>Expected: {baseline.outcome} → {comparison.outcome}</h3>
        <span className="delta">
          {comparison.outcome - baseline.outcome > 0 ? '↑' : '↓'}
          {Math.abs(comparison.outcome - baseline.outcome)}%
        </span>
      </div>

      {/* Change attribution (if available from PLoT) */}
      {comparison.changeAttribution && (
        <section className="change-attribution">
          <h3>Why Did This Change?</h3>
          {comparison.changeAttribution.map((change, i) => (
            <div key={i} className="change-item">
              <div className="change-description">{change.description}</div>
              <div className="change-impact">{change.contribution}%</div>
              <button onClick={() => restoreChange(change)}>Restore</button>
            </div>
          ))}
        </section>
      )}

      {/* Visual diff toggle */}
      <button onClick={highlightDiffsOnCanvas}>
        View visual diff on canvas
      </button>
    </div>
  )
}
```

#### D3: Framing Editor (Minimal)
```typescript
// src/components/panels/FramingEditor.tsx
export function FramingEditor() {
  const framing = useCanvasStore(s => s.currentScenarioFraming)
  const updateFraming = useCanvasStore(s => s.updateFraming)

  return (
    <div className="framing-editor">
      <div className="panel-header">
        <h2>Scenario Details</h2>
      </div>

      <TextField
        label="Decision or question"
        value={framing?.title}
        onChange={(title) => updateFraming({ title })}
        placeholder="What decision are you making?"
      />

      <TextField
        label="Primary goal"
        value={framing?.goal}
        onChange={(goal) => updateFraming({ goal })}
        placeholder="What does success look like?"
      />

      <TextField
        label="Timeline"
        value={framing?.timeline}
        onChange={(timeline) => updateFraming({ timeline })}
        placeholder="Next quarter, 12-18 months..."
      />

      {/* Advanced fields (collapsible from Week 1) */}
      <Collapsible title="Advanced" defaultOpen={false}>
        <TextField label="Constraints" {...} />
        <TextField label="Risks" {...} />
        <TextField label="Uncertainties" {...} />
      </Collapsible>
    </div>
  )
}
```

#### D4: Templates Library
```typescript
// src/components/panels/TemplatesLibrary.tsx
export function TemplatesLibrary() {
  const templates = useCanvasStore(s => s.templates)
  const applyTemplate = useCanvasStore(s => s.applyTemplate)

  return (
    <div className="templates-library">
      <div className="panel-header">
        <h2>Templates</h2>
      </div>

      <div className="templates-grid">
        {templates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            onApply={() => {
              applyTemplate(template)
              closeRightPanel()
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

### Task E: Update Styling for Maximized Canvas (30min)

**File:** `src/canvas/ReactFlowGraph.module.css`

```css
/* New layout styling */
.canvasContainer {
  display: flex;
  height: 100vh;
  padding-top: var(--topbar-h, 45px);
}

.canvasMain {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--canvas-25);
  /* Canvas now takes all remaining space */
}

/* When new layout active, no dock offsets needed */
.canvasMain[data-new-layout="true"] {
  margin-left: 0;
  margin-right: 0;
}

/* LeftSidebar sits on left edge */
/* (Already styled in LeftSidebar.module.css) */

/* RightPanel overlays from right when open */
/* (Already styled in RightPanel.module.css) */
```

### Task F: Auto-Open Results Panel (15min)

**When run completes, open results in RightPanel:**

```typescript
// In ReactFlowGraph or results handling
useEffect(() => {
  if (results?.status === 'complete' && USE_NEW_LAYOUT) {
    // Results panel auto-opens via getRightPanelMode
    // No explicit action needed - it checks results.status
  }
}, [results?.status])
```

### Task G: Hide Old Components Explicitly (15min)

**Add guard conditions to prevent old panels from rendering:**

```typescript
// InputsDock wrapper
{!USE_NEW_LAYOUT && <InputsDock />}

// OutputsDock wrapper
{!USE_NEW_LAYOUT && <OutputsDock />}

// CanvasToolbar wrapper
{!USE_NEW_LAYOUT && <CanvasToolbar />}
```

### Task H: Update Tests (1h)

**Update layout tests to validate new behavior:**

```typescript
// src/canvas/__tests__/ReactFlowGraph.layout.test.tsx

describe('Week 2 New Layout', () => {
  beforeEach(() => {
    // Mock USE_NEW_LAYOUT = true
  })

  it('hides old panels when new layout active', () => {
    render(<ReactFlowGraph />)
    
    expect(screen.queryByTestId('inputs-dock')).not.toBeInTheDocument()
    expect(screen.queryByTestId('outputs-dock')).not.toBeInTheDocument()
    expect(screen.queryByTestId('canvas-toolbar')).not.toBeInTheDocument()
  })

  it('shows new chrome components', () => {
    render(<ReactFlowGraph />)
    
    expect(screen.getByRole('banner')).toBeInTheDocument() // TopBar
    expect(screen.getByRole('navigation', { name: /canvas tools/i })).toBeInTheDocument() // LeftSidebar
  })

  it('maximizes canvas width', () => {
    render(<ReactFlowGraph />)
    
    const canvas = screen.getByRole('main')
    const { width } = canvas.getBoundingClientRect()
    
    // Canvas should be >70% of viewport when panel closed
    expect(width).toBeGreaterThan(window.innerWidth * 0.7)
  })

  it('opens results in right panel after run', async () => {
    const { rerender } = render(<ReactFlowGraph />)
    
    // Simulate run completion
    act(() => {
      useCanvasStore.setState({
        results: { status: 'complete', report: mockReport }
      })
    })
    
    rerender(<ReactFlowGraph />)
    
    await waitFor(() => {
      expect(screen.getByRole('complementary')).toBeInTheDocument() // RightPanel
      expect(screen.getByText('Results')).toBeInTheDocument()
    })
  })

  it('closes right panel with Escape', async () => {
    render(<ReactFlowGraph />)
    
    // Open results panel
    act(() => {
      useCanvasStore.setState({
        results: { status: 'complete', report: mockReport }
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('complementary')).toBeInTheDocument()
    })

    // Press Escape
    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    })
  })
})
```

---

## Quality Standards

### User Experience
**Canvas-first design:**
- Canvas occupies 85%+ of viewport when right panel closed
- 71% when right panel open
- No duplicate controls (single source: LeftSidebar)
- Smooth transitions (300ms panels, no jank)
- Clear visual hierarchy (tools left, context right)

**Interaction patterns:**
- All previous functionality preserved
- Keyboard shortcuts unchanged (Cmd+K, Cmd+Enter, T, ?, etc.)
- Panel auto-opens contextually (results after run, inspector on node select)
- Panel dismissible (× button, Escape, click outside)

**Progressive disclosure:**
- Tools always visible in LeftSidebar
- Details appear in RightPanel only when needed
- Advanced options collapsed by default

### Performance
- No layout thrashing during panel animations
- 60fps during slide transitions
- <100ms interaction response
- Bundle size increase <50KB total

### Accessibility
- All interactive elements keyboard accessible
- Focus management when panels open/close
- ARIA labels on all controls
- Screen reader announcements for state changes
- Visible focus indicators (2px ring)

### Code Quality
- TypeScript strict mode (no `any`)
- Clear component boundaries
- Reusable panel content components
- Comprehensive test coverage (>80%)
- No console errors or warnings

---

## Testing Strategy

### Manual QA Checklist
Run `pnpm dev:canvas` and verify:

**Layout:**
- [ ] TopBar renders at top (45px height)
- [ ] LeftSidebar on left edge (48px width)
- [ ] Canvas dominates center (85%+ width with panel closed)
- [ ] No old InputsDock visible
- [ ] No old OutputsDock visible
- [ ] No bottom CanvasToolbar visible

**Navigation:**
- [ ] Click AI icon → Draft chat opens
- [ ] Click Add icon → Quick-add mode activates
- [ ] Click Templates → Templates panel opens in right
- [ ] Click Run → Analysis runs, results panel opens
- [ ] Click Compare → Compare panel opens (if 2+ runs)
- [ ] Click Evidence → Provenance panel opens
- [ ] Click Fit → Canvas fits to view
- [ ] Click Help → Keyboard legend opens

**Right Panel:**
- [ ] Opens smoothly (300ms slide from right)
- [ ] Contains correct content for each mode
- [ ] × button closes panel
- [ ] Escape key closes panel
- [ ] Click outside closes panel (on mobile)
- [ ] Scrolls independently if content overflows

**Keyboard Shortcuts:**
- [ ] Cmd/Ctrl+K → Opens AI
- [ ] Cmd/Ctrl+Enter → Runs analysis
- [ ] T → Opens templates
- [ ] ? → Opens help
- [ ] Escape → Closes panel/modal

**Results Flow:**
- [ ] Run analysis
- [ ] Results panel auto-opens on right
- [ ] Shows unified insights (from Week 1)
- [ ] Humanized ranges (from Week 1)
- [ ] Expandable confidence breakdown
- [ ] Top drivers clickable
- [ ] No contradictory signals (Week 1 fix)

**Responsive:**
- [ ] At 1440px: Full layout with sidebar and panel
- [ ] At 1024px: Panel overlays canvas
- [ ] At 768px: Sidebar collapses to hamburger

### Automated Tests
```bash
# Run full test suite
pnpm test -- --runInBand --reporter=basic

# Should pass:
# - TopBar tests (title edit, save, menu)
# - LeftSidebar tests (all icons, callbacks)
# - RightPanel tests (rendering, closing)
# - Layout integration tests (canvas width, old panels hidden)
# - Results panel tests (content, auto-open)
```

---

## Implementation Order

Execute tasks sequentially:

1. **Task A** (15min) → Add USE_NEW_LAYOUT flag
2. **Task B** (1h) → Conditional layout rendering
3. **Task G** (15min) → Hide old components explicitly
4. **Task E** (30min) → Update CSS for maximized canvas
5. **Test checkpoint** → Verify canvas maximized, old panels gone
6. **Task C** (1h) → Create renderRightPanel helper
7. **Task D** (2h) → Migrate content to panel modes
8. **Task F** (15min) → Auto-open results logic
9. **Task H** (1h) → Update/add tests
10. **Final verification** → Run full test suite + manual QA

**Total estimated time:** ~7 hours

---

## Success Criteria

### Before (Current Screenshot)
```
Left edge: LeftSidebar (48px) + InputsDock (320px) = 368px
Canvas: ~750px (52%)
Right edge: OutputsDock (360px)
Bottom: CanvasToolbar
```

### After (Target)
```
Left edge: LeftSidebar only (48px)
Canvas: ~1024px (71% with panel open, 85% with panel closed)
Right edge: RightPanel when open (360px)
Bottom: Clean (no toolbar)
```

**Metrics:**
- Canvas space: +274px base (+36%), +634px with panel closed (+84%)
- Interaction paths: Reduced from 3 surfaces (top, left panel tabs, bottom toolbar) to 1 (LeftSidebar)
- Visual clarity: Single control surface, contextual details

**User experience:**
- More thinking space (canvas dominates)
- Clearer hierarchy (tools left, context right)
- Faster navigation (icons always visible)
- Reduced cognitive load (no duplicate controls)

---

## Critical Reminders

**DO NOT:**
- Modify existing store structure (reuse all current state)
- Break keyboard shortcuts (must all still work)
- Remove functionality (everything accessible via new chrome)
- Create layout shift (animations smooth, no jank)
- Duplicate code (reuse existing components in panels)

**DO:**
- Test after each major change
- Commit after each task completes
- Verify canvas width improvement
- Check responsive behavior
- Validate keyboard navigation
- Ensure accessibility maintained

**QUALITY OVER SPEED:**
- Better to deliver 8/10 tasks perfectly than 10/10 with bugs
- Test thoroughly before marking complete
- Fix any issues immediately

---

## Error Handling

**If blocked:**
1. Document the blocker clearly
2. Implement workaround if possible
3. Continue with next task
4. Summary at end lists all blockers

**If breaking changes required:**
1. Document what breaks and why
2. Provide migration path
3. Update tests
4. Flag in completion summary

---

## Execution Instructions

**DO NOT STOP until all tasks complete and verified:**

1. Implement all 8 tasks (A-H) in order
2. Run test suite after implementation
3. Manually verify with dev server
4. Take before/after measurements
5. Document any deviations or issues

When complete, provide:
- Summary of changes made
- Test results (all passing)
- Canvas width measurements (before/after)
- Any follow-up items identified
- Confirmation that old panels are hidden and canvas is maximized

**You have full autonomy** to refactor and improve code quality while implementing.

**Begin implementation now. Do not stop until Week 2 layout migration is complete and verified.**
