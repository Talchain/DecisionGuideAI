# P1 Features Implementation Plan

## Status: Scaffolded ✅

### Completed
- ✅ Branch: `feat/p1-overnight-20251014`
- ✅ Module structure created
- ✅ Fixtures: report_v1.ok.json, report_v1.429.json
- ✅ Types: results/types.ts, critique/types.ts
- ✅ Components: ConfidenceBadge, ResultsSummary, ErrorBanner, FocusToggle, CritiquePanel
- ✅ Hooks: useRateLimitCountdown, useFocusMode, useCritique

### Remaining Tasks

1. **Complete CritiquePanel.tsx** (truncated)
2. **Create useSessionPersistence.ts** + RestoreSessionModal.tsx
3. **Wire into PlotShowcase.tsx**
4. **Add unit tests**
5. **Add E2E smoke tests**
6. **Test build:ci**

### Integration Points

```tsx
// In PlotShowcase.tsx
import { ResultsSummary } from '../modules/results/ResultsSummary'
import { ErrorBanner } from '../modules/diagnostics/ErrorBanner'
import { FocusToggle } from '../modules/focus/FocusToggle'
import { CritiquePanel } from '../modules/critique/CritiquePanel'
import { useFocusMode } from '../modules/focus/useFocusMode'
import { useCritique } from '../modules/critique/useCritique'

const { isFocusMode, toggle } = useFocusMode()
const critique = useCritique(nodes, edges)
```

### Next Steps
1. Complete remaining files (session persistence)
2. Wire all components into PlotShowcase
3. Add tests
4. Build and verify
