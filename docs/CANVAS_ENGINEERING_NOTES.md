# Canvas Engineering Notes

**Version**: 2.0  
**Date**: Oct 16, 2025  
**Audience**: Developers maintaining `/canvas` codebase

---

## 🏗️ Architecture Overview

### Module Structure

```
src/canvas/
├── store.ts                    # Zustand state management
├── persist.ts                  # localStorage with sanitization
├── useKeyboardShortcuts.ts     # Global keyboard handler
├── ReactFlowGraph.tsx          # Main React Flow host
├── CanvasToolbar.tsx           # Bottom toolbar component
├── ContextMenu.tsx             # Right-click context menu
├── nodes/
│   └── DecisionNode.tsx        # Custom node implementation
├── components/
│   └── AlignmentGuides.tsx     # Visual drag guides
└── __tests__/
    ├── store.spec.ts           # 25 store tests
    ├── persist.spec.ts         # 14 persistence tests
    └── ContextMenu.spec.tsx    # 3 UI component tests
```

---

## 🧠 Store Architecture (store.ts)

### State Shape

```typescript
interface CanvasState {
  // Core data
  nodes: Node[]
  edges: Edge[]
  
  // Undo/redo
  history: {
    past: Array<{ nodes: Node[]; edges: Edge[] }>
    future: Array<{ nodes: Node[]; edges: Edge[] }>
  }
  
  // Selection tracking
  selection: {
    nodeIds: Set<string>
    edgeIds: Set<string>
  }
  
  // Clipboard (internal, not OS)
  clipboard: {
    nodes: Node[]
    edges: Edge[]
  } | null
  
  // ID generators
  nextNodeId: number
  nextEdgeId: number
}
```

### History Semantics

**Debounced Operations:**
- **Drag**: Position changes with `dragging: true` debounce history push (200ms)
- **Nudge**: Arrow key movements debounce per burst (500ms window)
- **Edge updates**: Select/remove/add during drag debounce (200ms)

**Immediate History:**
- **Add node**: Instant push before mutation
- **Delete**: Instant push
- **Label edit**: Instant push on commit
- **Cut**: Single atomic frame (copy + delete in one transaction)
- **Paste/Duplicate**: Instant push

**Why Debounce?**
- Prevents undo stack spam during continuous interactions
- Drag 100px → single undo step (not 50 tiny steps)
- Nudge 10 times rapidly → single undo step per burst

**Implementation:**
```typescript
// Two independent timers
let historyTimer: ReturnType<typeof setTimeout> | null = null
let nudgeTimer: ReturnType<typeof setTimeout> | null = null

// Drag debounce
onNodesChange: (changes) => {
  set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
  const isDrag = changes.some(c => c.type === 'position' && c.dragging)
  get().pushHistory(isDrag) // debounced if true
}

// Nudge burst detection
nudgeSelected: (dx, dy) => {
  if (!nudgeTimer) pushToHistory(get, set) // First nudge in burst
  set((s) => ({ nodes: ... })) // Apply immediately
  if (nudgeTimer) clearTimeout(nudgeTimer)
  nudgeTimer = setTimeout(() => { nudgeTimer = null }, 500)
}
```

### ID Management

**Monotonic Counters:**
- `nextNodeId`: Increments on every `createNodeId()` call
- `nextEdgeId`: Increments on every `createEdgeId()` call

**Collision Prevention:**
- `reseedIds(nodes, edges)`: Scans existing IDs, sets counters > max
- Called on: hydration from localStorage, import from JSON

**Edge ID Format:**
- `e<number>` (e.g., `e5`, `e6`, ...)
- Allows multiple edges between same nodes

---

## 💾 Persistence Layer (persist.ts)

### Versioned Schema

```typescript
interface PersistedState {
  version: number      // Schema version (currently 1)
  timestamp: number    // Unix epoch ms
  nodes: Node[]
  edges: Edge[]
}
```

**Why Versioning?**
- Future migrations if schema changes
- Timestamp for snapshot sorting

### Sanitization Pipeline

**Label Sanitization:**
```typescript
function sanitizeLabel(label: unknown): string {
  return String(label)
    .replace(/<[^>]*>/g, '')      // Remove HTML tags
    .replace(/[<>]/g, '')          // Remove remaining angle brackets
    .slice(0, 100)                 // Enforce 100 char max
    .trim() || 'Untitled'          // Fallback for empty
}
```

**Applied To:**
- Node `data.label` on save/load/import
- Edge `label` on save/load/import

**Why Sanitize?**
- Prevent XSS via `<script>`, `<img onerror>`, etc.
- Enforce max length to prevent UI breakage
- Treat all user input as untrusted

### Quota Handling

**5MB Payload Limit:**
```typescript
if (payload.length > MAX_PAYLOAD_SIZE) {
  console.warn('[CANVAS] Payload exceeds 5MB, save aborted')
  return false
}
```

**Quota Exceeded:**
```typescript
catch (err) {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') {
    console.error('[CANVAS] LocalStorage quota exceeded')
    return false
  }
}
```

**User Experience:**
- Functions return `boolean` (success/failure)
- Console warnings for developers
- Future: toast notifications for users

### Snapshot Rotation

**Max 10 Snapshots:**
- Sorted by timestamp (newest first)
- Oldest deleted automatically after 10th save

**Implementation:**
```typescript
function rotateSnapshots() {
  const snapshots = listSnapshots() // sorted desc
  if (snapshots.length > MAX_SNAPSHOTS) {
    const toDelete = snapshots.slice(MAX_SNAPSHOTS)
    toDelete.forEach(s => deleteSnapshot(s.key))
  }
}
```

**Snapshot Keys:**
- Format: `canvas-snapshot-<timestamp>`
- Example: `canvas-snapshot-1697500800000`

### Import Validation

**Schema Checks:**
1. Valid JSON parse
2. `version` and `timestamp` fields exist
3. `nodes` and `edges` are arrays
4. Each node has `id` (string) and `position` (x/y numbers)
5. Each edge has `id`, `source`, `target` (strings)

**Security:**
- All labels sanitized (strip HTML)
- No code execution (treat as pure data)
- Reject malformed structures early

**ID Collision:**
- After successful import, call `reseedIds(nodes, edges)`
- Ensures new nodes won't collide with imported IDs

---

## ⌨️ Keyboard Shortcuts (useKeyboardShortcuts.ts)

### Respecting Input Focus

```typescript
const target = event.target as HTMLElement
if (target.tagName === 'INPUT' || 
    target.tagName === 'TEXTAREA' || 
    target.isContentEditable) {
  return // Don't hijack typing
}
```

**Why?**
- Inline editing uses `<input>` — shortcuts would interfere
- Context menu items may have input fields in future
- General good practice for web apps

### Platform Detection

```typescript
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey
```

**Rationale:**
- Mac: `Cmd` (⌘) is standard for app shortcuts
- Windows/Linux: `Ctrl` is standard
- `Cmd+S` on Mac = `Ctrl+S` on Windows

### Shortcut Priority

**Order Matters:**
1. Check `Esc` first (highest priority — closes menus)
2. Check undo/redo (common, should not conflict)
3. Check other shortcuts (D, A, X, C, V, S)
4. Check nudge (arrows, Shift+arrows)
5. Check delete (Del, Backspace)

**Conflict Avoidance:**
- `Cmd+D` may conflict with browser "Add Bookmark" on some browsers
- User can use context menu as fallback
- Future: allow custom keybindings

---

## 🎨 UI Components

### DecisionNode (nodes/DecisionNode.tsx)

**Inline Editing:**
- **Trigger**: `onDoubleClick` on node container
- **Enter**: Commit (push history)
- **Escape**: Cancel (revert to original label)
- **Blur**: Only commit if focus leaves node entirely (not internal moves)

**Blur Logic:**
```typescript
const handleBlur = (e: React.FocusEvent) => {
  const nodeContainer = e.currentTarget.closest('[data-testid="rf-node"]')
  if (nodeContainer && !nodeContainer.contains(e.relatedTarget as Node)) {
    handleCommit() // Only commit if focus truly left node
  }
}
```

**Why?**
- Prevents premature commit during re-renders
- Handles React Flow internal focus moves gracefully
- User can click handles without losing edit

**Sanitization:**
```typescript
const sanitized = trimmed.slice(0, 100) // Enforce max length
if (sanitized && sanitized !== nodeData.label) {
  updateNodeLabel(id, sanitized)
}
```

**Accessibility:**
- `aria-label="Node title"` on input
- `maxLength={100}` enforced at DOM level

### ContextMenu (ContextMenu.tsx)

**Keyboard Navigation:**
- `ArrowDown`: Focus next item
- `ArrowUp`: Focus previous item
- `Enter` or `Space`: Activate focused item
- `Esc`: Close menu

**Focus Tracking:**
```typescript
const [focusedIndex, setFocusedIndex] = useState(0)
const actionableItems = menuItems.filter(item => !('type' in item))
```

**Mouse-Keyboard Sync:**
- `onMouseEnter={() => setFocusedIndex(currentActionIndex)}`
- Hover updates focus state → seamless transition

**Memory Leak Fix:**
- Listeners added synchronously (no `setTimeout`)
- Cleanup guaranteed in `useEffect` return
- Test: 50 mount/unmount cycles verify no leaks

**Accessibility:**
- `role="menu"` on container
- `role="menuitem"` on buttons
- `role="separator"` on dividers
- `aria-label="Canvas context menu"`

### CanvasToolbar (CanvasToolbar.tsx)

**Minimize Toggle:**
```typescript
const [isMinimized, setIsMinimized] = useState(false)
if (isMinimized) {
  return <button onClick={() => setIsMinimized(false)}>↑</button>
}
```

**Why?**
- Large graphs may need full viewport
- Toolbar still accessible via minimize button
- User choice persisted in React state (not localStorage)

**Accessibility:**
- `role="toolbar"` on container
- `aria-label` on every button
- Focus rings visible (`:focus:ring-2`)
- Keyboard tab order logical

### AlignmentGuides (components/AlignmentGuides.tsx)

**Smart Detection:**
- 8px snap threshold for guide activation
- Checks vertical (same X) and horizontal (same Y) alignment
- Only shows guides during active drag

**Performance:**
- `pointer-events-none` — guides don't block interactions
- Deduplication via `Map` (same guide ID = single line)
- Fade out after drag (200ms transition)

**Visual Design:**
- 1px solid line
- `#EA7B4B` (Olumi accent)
- 40% opacity for subtlety

---

## 🧪 Testing Strategy

### Unit Tests (42 passing)

**Store Tests (store.spec.ts):**
- History operations (undo, redo, purge future)
- Clipboard (copy, paste, cut atomic)
- Selection (tracking, select all)
- Nudge (debouncing, single frame per burst)
- ID generation (monotonic, reseeding)

**Persistence Tests (persist.spec.ts):**
- Save/load with versioning
- Sanitization (HTML stripping, max length)
- Quota exceeded error handling
- Snapshot rotation (max 10)
- Import validation (reject malformed)
- Export round-trip

**Context Menu Tests (ContextMenu.spec.tsx):**
- Memory leak (listener add/remove balance)
- Close on Escape
- Close on outside click

### E2E Tests (e2e/canvas.authoring.spec.ts)

**Coverage:**
- Inline editing (double-click, Enter, Esc, blur)
- Context menu (keyboard nav, aria, actions)
- Cut atomic (single undo frame)
- Nudge burst (10 rapid nudges → 1 undo)
- Toolbar minimize/restore
- Alignment guides (smoke test)
- No console errors

**Playwright Best Practices:**
- Avoid `waitForTimeout` except for debounce tests (documented)
- Use `toBeVisible()`, `toBeFocused()` for state checks
- `toContainText()` for content assertions
- `page.on('console')` for error detection

---

## 🚀 Performance Considerations

### Bundle Size

**Current:** 129.39 KB gz (AppPoC chunk)  
**Baseline:** 128.35 KB gz  
**Delta:** +1.04 KB

**Acceptable?** Yes — added 6 major features for 1KB cost.

**What Contributes:**
- Context menu logic + keyboard nav
- Alignment guides rendering
- Persist module (sanitization, rotation)
- Enhanced store actions

**Future Optimization:**
- Code split alignment guides (lazy load)
- Tree-shake unused React Flow features
- Compress icon SVGs

### Runtime Performance

**Target:** 60fps pan/zoom on 100+ node graphs

**Measurements:**
- Pan/zoom: Smooth via React Flow's built-in optimizations
- History: Max 50 frames (capped to prevent memory bloat)
- Debounce timers: 200ms drag, 500ms nudge (responsive but not spammy)

**Memory Management:**
- Timers cleared on unmount (`cleanup()`)
- History capped at 50 entries
- Snapshot rotation (max 10 in localStorage)

**React Optimizations:**
- `memo(DecisionNode)` — prevents re-render on unrelated state
- Zustand selectors — only subscribe to needed slices
- `useCallback` on React Flow handlers

---

## 🔒 Security Hardening

### XSS Prevention

**Attack Vectors Closed:**
1. `<script>alert('xss')</script>` in labels → stripped to `alert('xss')`
2. `<img onerror="alert(1)">` → stripped entirely
3. Long labels (>100 chars) → truncated

**Sanitization Points:**
- On save (persist.ts)
- On load (persist.ts)
- On import (persist.ts)
- Node label update (store.ts via persist utility)

**No Dangerous Patterns:**
- No `dangerouslySetInnerHTML` anywhere
- No `eval()` or `Function()` constructor
- Import data treated as pure JSON (not code)

### localStorage Quota

**Handling:**
- 5MB payload limit (pre-check before save)
- `QuotaExceededError` caught and logged
- Functions return `boolean` for success/failure
- Future: user-facing toast notifications

**Why 5MB?**
- Typical localStorage limit: 5-10MB per origin
- Leave headroom for other app data
- Large graphs should export to file instead

---

## 📐 Design Tokens

### Olumi Color Palette

```css
--accent: #EA7B4B      /* Warm coral — selection, hover, accent */
--success: #67C89E     /* Mint green — connection handles (target) */
--info: #63ADCF        /* Sky blue — connection handles (source) */
--neutral-100: #f9fafb /* Backgrounds */
--neutral-200: #e5e7eb /* Borders */
--neutral-700: #374151 /* Text */
```

**Usage:**
- Selected node border: `border-[#EA7B4B]`
- Context menu hover: `bg-[#EA7B4B]/10`
- Alignment guides: `bg-[#EA7B4B]` at 40% opacity

### Spacing & Sizing

- **Grid**: 16px base (snap-to-grid)
- **Corner radius**: `rounded-2xl` (16px) for nodes, `rounded-xl` (12px) for menus
- **Shadows**: `shadow-md` for nodes, `shadow-xl` for menus
- **Transitions**: 150-200ms for micro-interactions

### Typography

- **Labels**: 14px medium weight (`text-sm font-medium`)
- **Buttons**: 14px medium (`text-sm font-medium`)
- **Shortcuts**: 12px monospace (`text-xs font-mono`)

---

## 🛠️ Development Workflow

### Local Development

```bash
# Start dev server
npm run dev

# TypeScript check
npm run typecheck

# Run unit tests
npm test

# Run E2E tests (requires dev server running)
npm run dev &
npx playwright test e2e/canvas.*.spec.ts
```

### Adding a New Feature

1. **Define interface** in `store.ts` (if state change needed)
2. **Implement action** with history semantics
3. **Write unit test** in `__tests__/`
4. **Add E2E test** in `e2e/canvas.authoring.spec.ts`
5. **Update docs** (this file + user guide)

### Debugging Tips

**Check History State:**
```javascript
// In browser console
useCanvasStore.getState().history
// => { past: [...], future: [...] }
```

**Check Timers:**
```javascript
// Add diag mode (?diag=1) to show timer status
// Future enhancement
```

**Memory Leaks:**
- Run Context Menu test 50x: `npm test -- ContextMenu.spec.tsx`
- Check listener balance in spy assertions

---

## 🔮 Future Enhancements

### Planned (v2.1)

1. **ELK.js Auto-Layout**
   - Hierarchical tidy layout
   - Preserve locked positions
   - Smooth spring animations

2. **Edge Enhancements**
   - Inline label editing
   - Weight/confidence visualization (opacity)
   - Delete handle on hover

3. **Diagnostic Badge**
   - Enable via `?diag=1`
   - Show: node count, selection size, history depth, timer status

4. **Snapshot Restore UI**
   - Modal with thumbnail previews
   - Timestamp display
   - One-click restore

5. **First-Time User Tutorial**
   - 3 guided tooltips on first load
   - Introduce double-click, right-click, keyboard shortcuts

### Research

- **Real-time Collaboration** (Yjs, WebRTC)
- **Export to PNG/SVG** (html2canvas, dom-to-svg)
- **Custom Node Types** (outcome, action, decision variants)
- **Undo/Redo Visualization** (timeline UI)

---

## 📚 References

- [React Flow Docs](https://reactflow.dev/)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [WCAG 2.1 (Accessibility)](https://www.w3.org/WAI/WCAG21/quickref/)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

---

## 🎓 Lessons Learned

### What Worked Well

1. **Isolated Timers** — Separate `historyTimer` and `nudgeTimer` prevented subtle bugs
2. **Sanitize Early** — Sanitizing at persistence layer catches all entry points
3. **Test-Driven** — Writing tests first clarified requirements (e.g., cut atomic)
4. **Incremental Commits** — Small focused commits easy to review/revert

### Pitfalls Avoided

1. **Blur Overreaction** — Initial onBlur committed on any focus move → fixed with `relatedTarget` check
2. **setTimeout Race** — Context menu listener added via setTimeout leaked → fixed by removing delay
3. **Nudge History Spam** — Each arrow key pushed history → fixed with burst detection

### Technical Debt

- **Internal Clipboard** — Not OS clipboard (copy/paste only works within app)
- **Snapshot UI** — CLI-only (no restore modal yet)
- **Diag Mode** — Not implemented (planned for v2.1)
- **Edge Editing** — Nodes have inline edit, edges don't (yet)

---

**Maintained by**: Olumi Engineering  
**Last Updated**: Oct 16, 2025  
**Version**: 2.0 (Authoring UX overhaul)
