# Probability Validation Tolerance

## Current Implementation

The NodeInspector probability editor validates outgoing edge probabilities with a **±1% tolerance**:

```typescript
// src/canvas/ui/NodeInspector.tsx
const tolerance = 1 // ±1%
const valid = Math.abs(sum - 100) <= tolerance
```

This allows users to adjust probabilities without strict enforcement of exactly 100.00%.

## Backend Assumption

**⚠️ ASSUMPTION**: The PLoT v1 backend accepts the same ±1% tolerance for edge probabilities.

### Validation Flow

1. **Client-side** (NodeInspector):
   - User adjusts probabilities
   - Validation accepts sums between 99% and 101%
   - Edges updated with `confidence` values (0-1 range)

2. **Client-side** (graphPreflight):
   - Pre-flight validation checks edge weights are in valid range
   - Does NOT enforce exact 100% sum
   - Allows ±1% tolerance to match UI

3. **Server-side** (PLoT v1 API):
   - **Assumption**: Accepts graphs with probability sums ±1% from 100%
   - If rejected, will return `BAD_INPUT` error

## Risk Mitigation

If the backend enforces stricter tolerance:

### Option 1: Normalize on Submit
```typescript
// Before sending to API
const normalized = normalizeConfidences(edges, targetSum)
```

### Option 2: Show Warning
```typescript
if (Math.abs(sum - 100) > BACKEND_TOLERANCE) {
  showToast('Probabilities will be normalized by the server', 'info')
}
```

### Option 3: Auto-Balance
```typescript
// Use existing autoBalance() utility
const balanced = autoBalance(rows, { targetSum: 100, step: 1 })
```

## Future Work (Section H - Security)

- Add E2E test to verify backend accepts ±1% tolerance
- If backend rejects, add normalization step in `toApiGraph()`
- Document actual backend tolerance in this file

## Related Files

- `src/canvas/ui/NodeInspector.tsx` - Client-side validation
- `src/canvas/utils/probabilityValidation.ts` - Validation utilities
- `src/canvas/utils/probabilityBalancing.ts` - Auto-balance helpers
- `src/adapters/plot/v1/mapper.ts` - API graph conversion
