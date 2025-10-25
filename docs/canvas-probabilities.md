# Canvas Probability Editing

Guide to editing probabilities for decision nodes on the canvas.

## Overview

**Single Source of Truth:** All probabilities are managed at the **Decision node level**. When a decision has multiple outgoing edges (options), their probabilities must sum to 100% (±1% tolerance).

**Access Methods:**
1. Click a decision node → NodeInspector → Edit individual sliders
2. Click a decision node → "Edit Probabilities..." button → Batch modal editor
3. Click an edge → "Edit in Decision" button → Opens parent decision's modal
4. Select edge → Press **P** key → Opens parent decision's modal

---

## The Probability Modal

The modal provides two intelligent algorithms to help you quickly fix probabilities:

### Auto-Balance
**What it does:** Preserves your relative proportions while rounding to nice numbers (5% steps) and ensuring the total equals 100%.

**When to use:** You've set rough estimates (e.g., 67%, 8%) and want to keep those ratios while making them sum correctly.

**How it works:**
1. Normalizes values to sum to 100%
2. Rounds each value to the nearest 5% step
3. Uses the **Hamilton method** (largest-remainder apportionment) to fairly distribute any rounding remainder
4. Preserves rank order (bigger values stay bigger)

**Examples:**

| Before | After (Auto-balance) | Explanation |
|--------|---------------------|-------------|
| 67%, 8% (sum: 75%) | 90%, 10% | Ratio ~8:1 preserved, normalized to 100% |
| 53%, 39% (sum: 92%) | 55%, 45% | Ratio ~1.4:1 preserved, rounded to 5% steps |
| 41%, 33%, 18% (sum: 92%) | 45%, 35%, 20% | All ratios maintained, fair remainder distribution |

### Equal Split
**What it does:** Divides the remaining percentage equally across **unlocked** rows only.

**When to use:** You have one or more locked values and want to evenly distribute what's left.

**How it works:**
1. Calculates remaining percentage after locked rows
2. Divides equally among unlocked rows
3. Rounds to 5% steps
4. Assigns remainder to first unlocked rows

**Examples:**

| Before | Locks | After (Equal split) | Explanation |
|--------|-------|-------------------|-------------|
| 67%, 8% | None | 50%, 50% | Ignores ratios, splits 100% evenly |
| 10%, 45%, 45% | First locked | 10%, 45%, 45% | Remaining 90% split equally: 45/45 |
| 60%, 40% | First locked | 60%, 40% | Only 40% remaining for unlocked row |

---

## Locking Rows

**Lock icon (🔒):** Click to prevent a row from being changed by Auto-balance or Equal split.

**Use cases:**
- You're certain about one option's probability (e.g., "90% chance we go with this vendor")
- You want to experiment with distributing the remainder across other options
- You're gradually tweaking values and want to preserve some

**Behavior:**
- Locked rows keep their exact values
- Auto-balance: Normalizes and rounds only unlocked rows
- Equal split: Divides remaining percentage across unlocked rows only
- Apply button disabled if locked rows sum > 100%

**Example workflow:**
1. Set "Vendor A" to 60%, lock it 🔒
2. Click "Equal split" → remaining 40% distributed evenly across Vendor B (20%) and Vendor C (20%)
3. Adjust Vendor B slider to 25%, Vendor C becomes 15%
4. Click Apply → all edges updated in single undo step

---

## Validation & Error Handling

### Real-time Validation
- **Green sum (100%):** Ready to apply
- **Yellow warning:** Sum ≠ 100% ±1%, Apply button disabled
- Shows live total: "Total: 95% (must be 100% ±1%)"

### Locked Sum Overflow
If locked rows sum > 100%, you'll see:
> ⚠️ Locked rows sum to 110% (exceeds 100%). Unlock some rows to continue.

Apply button disabled until you unlock rows.

### Zero-Filtering (Pristine Templates)
- Validation only checks nodes you've **edited** (touched)
- Freshly inserted templates with 0% edges don't trigger errors
- First edit "touches" the node, enabling validation

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **P** | Open probability modal for selected decision or edge's parent |
| **Alt/Opt+V** | Jump to next invalid decision (highlights & centers) |
| **Esc** | Close modal |
| **Enter** | Apply changes (if valid) |

---

## Technical Details

### Algorithms

**Auto-balance:**
```typescript
function autoBalance(rows: BalanceRow[], options: BalanceOptions): BalanceResult {
  // 1. Normalize to target (100%)
  const normalized = normalizeTo(rows, 100)

  // 2. Round to nice numbers (5% steps)
  const rounded = roundNice(normalized, 5)

  // 3. Apportion remainder using Hamilton method
  const values = apportionRemainder(rows, rounded, 100, 5, {
    minNonZero: 0,
    preserveRank: true
  })

  return { values }
}
```

**Equal split:**
```typescript
function equalSplit(rows: BalanceRow[], options: BalanceOptions): BalanceResult {
  const lockedSum = rows.filter(r => r.locked).reduce((sum, r) => sum + r.value, 0)
  const remaining = 100 - lockedSum
  const unlockedCount = rows.filter(r => !r.locked).length

  const perRow = remaining / unlockedCount
  const rounded = roundNice([perRow], 5)[0]

  // Distribute remainder to first rows
  return { values: distributeRemainder(rows, rounded, remaining, 5) }
}
```

### Hamilton Method (Largest-Remainder)
Electoral apportionment algorithm ensuring fair distribution:
1. Give each row its rounded-down share
2. Calculate remainder (e.g., 100 - 95 = 5%)
3. Sort rows by fractional part (largest first)
4. Assign +5% to top rows in order until remainder exhausted

This prevents cumulative rounding errors and preserves relative proportions.

---

## Edge Cases

**All rows locked:**
- Auto-balance: Disabled (button grayed)
- Equal split: Disabled (button grayed)
- User must unlock at least one row

**Single row:**
- Auto-balance: Sets to 100%
- Equal split: Sets to 100%

**All zeros:**
- Auto-balance: Falls back to equal split (can't preserve ratios)
- Equal split: Divides 100% evenly

**Negative remainders:**
- Equal split handles both +/- remainders correctly
- Adds or subtracts steps to reach target

---

## Integration

**Undo/Redo:**
- Apply creates single undo frame for all edge updates
- Ctrl+Z undoes entire batch, not individual sliders

**Edge Labels:**
- Auto-generated labels (e.g., "45%") update automatically
- Custom labels (e.g., "High cost path") preserved

**Touched Tracking:**
- First manual edit marks node as "touched"
- Validation chip only shows for touched nodes
- Prevents false positives on pristine templates

---

## Testing

**Unit tests:** 33 tests in `probabilityBalancing.spec.ts`
- All example cases (67/8, 53/39, 41/33/18)
- Lock combinations (all/none/some)
- Remainder distribution (±)
- Rank preservation
- Edge cases (zeros, single row, overflow)

**Component tests:** 23 tests in `ProbabilityModal.spec.tsx`
- Lock/unlock behavior
- Auto-balance button
- Equal split button
- Apply disabled on invalid
- Single undo frame on apply

**E2E tests:** Playwright coverage
- Insert template → P → auto-balance → Apply → Undo
- Alt+V cycles invalid nodes with visible selection

---

## Best Practices

1. **Use Auto-balance** when you have rough estimates and want to preserve ratios
2. **Use Equal split** when you want to distribute evenly (ignoring current values)
3. **Lock strategically** when you're certain about specific probabilities
4. **Press P** for fastest access from any edge
5. **Check the validation chip** (bottom-right) for invalid nodes
6. **Press Alt+V** to quickly jump to issues

---

## FAQ

**Q: Why can't I edit probabilities in the Edge inspector?**
A: Single source of truth! Probabilities are managed at the Decision level to ensure they sum to 100%. The Edge inspector shows a "Edit in Decision →" link for quick access.

**Q: What happens if I set probabilities manually and they don't sum to 100%?**
A: You'll see a yellow warning banner with the current sum. The Apply button is disabled until you fix it (or use Auto-balance/Equal split).

**Q: Can I use 1% steps instead of 5%?**
A: Currently the modal uses 5% steps for clarity. Manual sliders in NodeInspector support 1% precision.

**Q: What if all my locked rows sum to more than 100%?**
A: You'll see an error: "Locked rows sum to X% (exceeds 100%)." Unlock some rows to continue.

**Q: Does Auto-balance change my locked values?**
A: No! Locked values are never modified by Auto-balance or Equal split.

---

**Version:** 1.0
**Last Updated:** 2025-10-25
**Related:** [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md), [probabilityBalancing.ts](../src/canvas/utils/probabilityBalancing.ts)
