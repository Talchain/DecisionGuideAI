# Zustand Store Update Best Practices

## Problem: Render Loops from No-Op Updates

When a Zustand store action calls `set()` with a "new" object/array that has the same **value** as the current state, all subscribers re-render even though nothing changed. This can trigger infinite loops when:

1. Component subscribes to store
2. Component passes callback to child (e.g., ReactFlow)
3. Child calls callback → calls `set()` with "same" value
4. Store updates → component re-renders
5. New callback reference created → child detects "change"
6. Repeat → **infinite loop**

## Solution: Compare Before Update

Always compare new values with current state **by value, not reference** before calling `set()`.

### Utilities

```typescript
// src/canvas/store/utils.ts

export function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) {
    if (!b.has(x)) return false
  }
  return true
}

export function arraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
}
```

### Pattern

```typescript
import { setsEqual, arraysEqual } from './store/utils'

// ❌ BAD: Always updates even if unchanged
onSelectionChange: ({ nodes, edges }) => {
  set({ 
    selection: { 
      nodeIds: new Set(nodes.map(n => n.id)), 
      edgeIds: new Set(edges.map(e => e.id)) 
    } 
  })
}

// ✅ GOOD: Compare first, early return if unchanged
onSelectionChange: ({ nodes, edges }) => {
  const newNodeIds = new Set(nodes.map(n => n.id))
  const newEdgeIds = new Set(edges.map(e => e.id))
  
  const { selection } = get()
  const prevNodeIds = selection?.nodeIds ?? new Set<string>()
  const prevEdgeIds = selection?.edgeIds ?? new Set<string>()
  
  // Compare by value
  const nodeIdsChanged = !setsEqual(newNodeIds, prevNodeIds)
  const edgeIdsChanged = !setsEqual(newEdgeIds, prevEdgeIds)
  
  // Early return if nothing changed (prevents render loop)
  if (!nodeIdsChanged && !edgeIdsChanged) return
  
  // Only update when different
  set({ selection: { nodeIds: newNodeIds, edgeIds: newEdgeIds } })
}
```

## When to Apply

Apply this pattern to any action that:

- Receives data from external sources (ReactFlow, user input, etc.)
- May be called repeatedly with same values
- Updates Sets, Arrays, or complex objects
- Is wired to component callbacks/props

### Store Actions to Audit

- ✅ `onSelectionChange` (already fixed)
- `onNodesChange` (if updating metadata beyond ReactFlow's applyNodeChanges)
- `onEdgesChange` (if updating metadata beyond ReactFlow's applyEdgeChanges)
- `duplicateSelected` (check if selection already empty)
- `pasteClipboard` (check if clipboard empty/unchanged)
- `applyLayout` (compare node positions before/after)
- `importCanvas` (compare nodes/edges before importing)

## Dev Sentinel

Add render-storm detection in dev mode to catch regressions early:

```typescript
// ReactFlowGraph.tsx
if (import.meta.env.DEV) {
  const renderTimes = useRef<number[]>([])
  useEffect(() => {
    const now = Date.now()
    renderTimes.current.push(now)
    renderTimes.current = renderTimes.current.filter(t => now - t < 1000)
    if (renderTimes.current.length > 50) {
      console.error('[RENDER STORM] 50+ renders in 1s – likely infinite loop')
      console.trace()
    }
  })
}
```

This will log a warning if the component renders 50+ times in 1 second, making loops immediately visible during development. The code is tree-shaken from production builds via `import.meta.env.DEV`.

## Testing

Add unit tests to verify reference stability:

```typescript
it('keeps same selection reference when IDs unchanged', () => {
  const { nodes, onSelectionChange } = useCanvasStore.getState()
  
  onSelectionChange({ nodes: [nodes[0]], edges: [] })
  const selection1 = useCanvasStore.getState().selection
  
  // Call again with same IDs
  onSelectionChange({ nodes: [nodes[0]], edges: [] })
  const selection2 = useCanvasStore.getState().selection
  
  // Should be the exact same reference (no update occurred)
  expect(selection2).toBe(selection1)
})
```

## Benefits

1. **Prevents render loops** - No spurious updates
2. **Better performance** - Fewer re-renders
3. **Cleaner state** - Updates only when needed
4. **Easier debugging** - Clear intent in code

## References

- [Zustand: Avoiding render thrashing](https://github.com/pmndrs/zustand/discussions/1937)
- [React Flow: Infinite loop gotchas](https://reactflow.dev/learn/troubleshooting/common-issues)
- Commit: `0eb66fd` - Initial onSelectionChange fix
