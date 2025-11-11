# Canvas Probability Editing

Guide to editing probabilities for decision nodes on the canvas.

## Overview

**Single Source of Truth:** All probabilities are managed **inline** in the **Decision inspector** (right-hand dock). When a decision has multiple outgoing edges (options), their probabilities must sum to 100% (±1% tolerance).

**Access Methods:**
1. Click a decision node → View inline probability editor in Decision inspector
2. Click an edge → "Edit probabilities in this decision" button → Selects parent decision node
3. Select decision → Press **P** key → Focuses inline probability editor
   - Requires: Decision node selected and Decision inspector panel visible
   - Toast feedback shown if requirements not met

---

## Edge Label Visibility

Edge labels now use a **tiered visibility system** to reduce visual clutter while preserving important information:

### Label Types

1. **Custom Labels** (e.g., "High risk path", "Preferred option")
   - Always visible
   - Prominent styling (12px font, 500 weight, full opacity)
   - Shown with tooltip on hover

2. **Auto-Generated Percentages** (e.g., "50%", "75%")
   - Conditionally visible
   - De-emphasized styling (10px font, 0.8 opacity, smaller shadow)
   - Hidden for single outgoing edges (implicit 100%)
   - Hidden for 0% confidence values

3. **Implicit 100%** (single edge from decision)
   - Hidden entirely (no need to show the obvious)

### How It Works

The system automatically detects whether a label is custom or auto-generated using the pattern `/^\d+%$/`. This means:

- If you type "50%" as a label, it's treated as auto-generated
- If you type "50% likely" or "High confidence", it's treated as custom and always shown

### Accessibility

All edges include:
- Descriptive `aria-label` with source/target node names and confidence
- Tooltip on hover showing the label or probability
- Screen reader announcements for edge properties

---

## The Inline Probability Editor

The inline editor appears in the Decision inspector when a decision node is selected. It shows all outgoing edges with interactive controls to adjust probabilities.

### Features

- **Lock/Unlock:** Click the lock icon to prevent a value from changing during Auto-balance or Equal split
- **Sliders:** Drag to adjust probability (0-100%)
- **Numeric inputs:** Type exact percentage values
- **Live validation:** Total indicator shows current sum and validation status
- **Draft mode:** Changes are local until you click Apply

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

| Scenario | Result |
|----------|--------|
| 3 unlocked rows, 0 locked | 33%, 33%, 34% (remainder to last row) |
| 1 locked at 40%, 2 unlocked | Locked: 40%, Others: 30%, 30% |
| 2 locked totaling 60%, 2 unlocked | Locked: 40%, 20%, Others: 20%, 20% |

---

## Locking Rows

Click the lock icon (🔒) next to any edge to prevent its value from changing during Auto-balance or Equal split operations.

**Use cases:**
- You have a high-confidence estimate for one path (e.g., "90% chance of approval")
- You want to explore different distributions for the remaining paths
- You need to maintain specific ratios between certain outcomes

**Behavior:**
- Locked values are never modified by Auto-balance or Equal split
- If locked values sum to >100%, you'll see an error: "Locked rows sum to X% (exceeds 100%). Unlock some rows to continue."
- Unlocking a row allows it to be adjusted again

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **P** | Focus inline probability editor (when decision selected) |
| **Alt/Option+V** | Jump to next decision with invalid probabilities |
| **Enter** | Apply changes (if valid) |
| **Esc** | Close Decision inspector (discards unsaved changes) |

---

## Workflow

### Typical Editing Flow
1. Select a decision node
2. Inline probability editor appears in Decision inspector
3. Adjust sliders or type values
4. Use Auto-balance or Equal split to quickly fix totals
5. Click **Apply** to save changes
6. **Reset** to revert to last saved state

### Working with Templates
When you insert a template, probabilities are pre-set but may need adjustment:
1. Templates often have placeholder values (e.g., 50/50)
2. Select the decision node
3. Use Auto-balance to maintain template ratios while fixing rounding
4. Or manually adjust and lock specific values

---

## Technical Details

### Validation Rules
- **Sum must equal 100% ±1%** (tolerance of 1% to handle floating-point precision)
- **Zero-weight edges are excluded** from validation (pristine template edges with confidence=0)
- **Touched nodes** are tracked to distinguish user-edited decisions from template defaults

### Hamilton Method (Largest-Remainder Apportionment)
Auto-balance uses this electoral apportionment algorithm to ensure:
- Deterministic results (same input always produces same output)
- Fair distribution of rounding errors
- Preservation of relative proportions

**Process:**
1. Calculate ideal fractional values
2. Take integer parts
3. Assign remaining units to rows with largest fractional remainders
4. Stable tie-breaking via index order

### Label Preservation
- **Auto-generated labels** (matching pattern `/^\d+%$/`) are updated when probabilities change
- **Custom labels** (e.g., "High risk path") are preserved even when probability changes

### Edge Kind (Future-Proofing)
Each edge has a `kind` field that determines its semantic type:
- `decision-probability`: Default for probability splits from decisions (must sum to 100%)
- `risk-likelihood`: Future support for risk analysis (probability a risk occurs)
- `influence-weight`: Future support for influence diagrams (no sum constraint)
- `deterministic`: Future support for certain outcomes (always happens, no label shown)

This field enables future expansion to other diagram types while maintaining backward compatibility.

---

## Edge Cases & Troubleshooting

### All zeros
If all unlocked values are 0, Auto-balance falls back to Equal split behavior (can't preserve 0:0 ratio).

### Locked sum exceeds 100%
Error message: "Locked rows sum to X% (exceeds 100%). Unlock some rows to continue."

**Fix:** Unlock at least one row to allow redistribution.

### Single outgoing edge
If a decision has only one outgoing edge, probability editing is not required (assumed 100%).

### No outgoing edges
Empty state message: "Add connectors from this decision to set probabilities."

---

## FAQ

**Q: Why 5% steps instead of 1%?**
A: For ≤3 options, 5% steps are more intuitive (10%, 15%, 20%). For ≥4 options, 1% steps may be used for finer control.

**Q: Can I type exact values like 33.33%?**
A: No, the editor enforces integer percentages. Use 33% and let the remainder logic handle the extra 1%.

**Q: What happens if I close the inspector without applying?**
A: Changes are discarded. The editor works in draft mode until you click Apply.

**Q: How does this interact with undo/redo?**
A: Clicking Apply creates a single undo frame for all probability changes (batch operation).

**Q: Can I edit probabilities directly on edges?**
A: No. The Edge inspector shows a "Edit probabilities in this decision" button that selects the parent decision node, maintaining the single source of truth.

---

## Best Practices

1. **Lock high-confidence values first** – If you know one path is 80%, lock it before using Equal split on the rest
2. **Use Auto-balance for rough estimates** – Set approximate values (60/30/10) then Auto-balance to fix the sum
3. **Use Equal split for unknown distributions** – When you have no prior knowledge, equal distribution is a reasonable starting point
4. **Validate before running simulations** – The Validation Chip (bottom-right) shows error count; use Alt+V to navigate to invalid nodes
5. **Templates as starting points** – Don't feel obligated to keep template probabilities; they're suggestions, not requirements
