# Canvas Gating Hardening - COMPLETE

## ✅ Created Files
1. `src/lib/resolvePlcOverride.ts` - Utility with error handling
2. `src/lib/__tests__/resolvePlcOverride.spec.ts` - Unit tests

## 🔄 Next Steps
1. Update PlotWorkspace to use resolver + useState
2. Add hashchange listener
3. Remove inline z-index
4. Enhance E2E tests
5. Run tests

## Quick Implementation

Replace lines 25-39 in PlotWorkspace.tsx with:
```typescript
const initialResolution = resolvePlcOverride()
console.log('[PLOT] resolved=%s source=%s', 
  initialResolution.usePlc ? 'PLC' : 'DecisionGraph',
  initialResolution.source || 'default')
```

Inside PlotWorkspaceInner, add:
```typescript
const [canvas, setCanvas] = useState(initialResolution.usePlc ? 'PLC' : 'DecisionGraph')

useEffect(() => {
  const handler = () => {
    const res = resolvePlcOverride()
    setCanvas(res.usePlc ? 'PLC' : 'DecisionGraph')
  }
  window.addEventListener('hashchange', handler)
  return () => window.removeEventListener('hashchange', handler)
}, [])
```

Replace `USE_PLC` with `canvas === 'PLC'` in JSX.

Ready to continue?
