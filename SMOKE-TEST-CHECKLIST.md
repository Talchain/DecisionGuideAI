# PR-A Post-Merge Smoke Test

## 🎯 Test Environment

**URL:** http://localhost:5176/#/canvas (or production URL)  
**Date:** 2025-10-20  
**Commit:** 9f1c133  
**Tag:** v0.1.0-pr-a

---

## ✅ Smoke Test Checklist

### 1. Node Creation

#### Via Toolbar "+ Node ▾"
- [ ] Click "+ Node ▾" button
- [ ] Verify dropdown shows all 5 types:
  - [ ] 🎯 Add Goal
  - [ ] 🎲 Add Decision
  - [ ] 💡 Add Option
  - [ ] ⚠️ Add Risk
  - [ ] 📊 Add Outcome
- [ ] Click each type → Node appears with correct icon
- [ ] Verify node positioning (viewport center)

#### Via Command Palette (⌘K)
- [ ] Press `⌘K` → Palette opens
- [ ] Type "goal" → "Add Goal" appears
- [ ] Press Enter → Goal node created
- [ ] Repeat for: decision, option, risk, outcome
- [ ] All nodes created successfully

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### 2. Type Switching

- [ ] Click Goal node (🎯) → Properties panel opens
- [ ] Verify "Type" dropdown shows "Goal"
- [ ] Change Type to "Risk" (⚠️)
- [ ] Verify:
  - [ ] Icon changes to AlertTriangle
  - [ ] Color updates to risk theme
  - [ ] Position preserved
  - [ ] Label preserved
- [ ] Change back to "Goal"
- [ ] Verify icon/color revert correctly

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### 3. Edge Properties

#### Edit Properties
- [ ] Click edge → Edge inspector opens
- [ ] Adjust weight slider (1→3)
  - [ ] Stroke width increases
- [ ] Change style to "dashed"
  - [ ] Edge becomes dashed
- [ ] Adjust curvature slider (0.15→0.5)
  - [ ] Edge curve changes
- [ ] Edit label → "Test Edge"
  - [ ] Label appears on edge
- [ ] Adjust confidence slider (1.0→0.8)
  - [ ] Value updates

#### Undo/Redo
- [ ] Press `⌘Z` (Undo)
  - [ ] Last change reverts
- [ ] Press `⌘⇧Z` (Redo)
  - [ ] Change re-applies
- [ ] Verify edge still exists and editable

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### 4. Migration (V1→V2)

#### Import V1 JSON
```json
{
  "version": 1,
  "timestamp": 1234567890,
  "nodes": [
    { "id": "1", "position": {"x": 100, "y": 100}, "data": {"label": "Goal: Launch product"} },
    { "id": "2", "position": {"x": 300, "y": 100}, "data": {"label": "Risk: Competition"} }
  ],
  "edges": [
    { "id": "e1", "source": "1", "target": "2", "label": "Consider" }
  ]
}
```

- [ ] Click "Import" button
- [ ] Paste V1 JSON above
- [ ] Click "Import"
- [ ] Verify:
  - [ ] 2 nodes render
  - [ ] Labels preserved: "Goal: Launch product", "Risk: Competition"
  - [ ] Types inferred: Goal (🎯), Risk (⚠️)
  - [ ] Edge renders with label "Consider"

#### Export & Re-Import
- [ ] Click "Export" button
- [ ] Copy exported JSON
- [ ] Verify `"version": 2` in JSON
- [ ] Click "Import" again
- [ ] Paste exported JSON
- [ ] Click "Import"
- [ ] Verify:
  - [ ] Graph unchanged (round-trip successful)
  - [ ] All data preserved

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### 5. Console Verification

#### Open DevTools Console
- [ ] No errors (red messages)
- [ ] No warnings (yellow messages)
- [ ] No `/health` network requests (unless `VITE_ENABLE_PLOT_HEALTH=true`)
- [ ] No router v7 deprecation warnings
- [ ] No CORS errors

#### Network Tab
- [ ] Filter by "health"
- [ ] Verify: 0 requests (or only if flag enabled)

#### Drag Performance
- [ ] Drag a node continuously for 2+ seconds
- [ ] Verify: At most ONE render-burst warning
- [ ] No console spam

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## 🔍 Additional Checks

### Keyboard Shortcuts
- [ ] `⌘K` → Command Palette opens
- [ ] `⌘Z` → Undo works
- [ ] `⌘⇧Z` → Redo works
- [ ] `⌘S` → Save Snapshot works
- [ ] `⌘A` → Select All works
- [ ] `Delete` → Remove selected works

### Snapshots
- [ ] Click "Snapshots" button
- [ ] Click "💾 Save Current Canvas"
- [ ] Verify snapshot saved
- [ ] Reload page
- [ ] Load snapshot
- [ ] Verify graph restored

### Properties Panel
- [ ] Click node → Panel opens on right
- [ ] Edit label → Updates in real-time
- [ ] Edit description → Updates
- [ ] Change type → Updates icon/color
- [ ] Click edge → Edge inspector opens
- [ ] All controls functional

---

## 📊 Test Results Summary

| Category | Status | Notes |
|----------|--------|-------|
| Node Creation (Toolbar) | ⬜ Pass / ⬜ Fail | |
| Node Creation (Palette) | ⬜ Pass / ⬜ Fail | |
| Type Switching | ⬜ Pass / ⬜ Fail | |
| Edge Properties | ⬜ Pass / ⬜ Fail | |
| Undo/Redo | ⬜ Pass / ⬜ Fail | |
| V1 Import | ⬜ Pass / ⬜ Fail | |
| V2 Round-Trip | ⬜ Pass / ⬜ Fail | |
| Console Clean | ⬜ Pass / ⬜ Fail | |
| Keyboard Shortcuts | ⬜ Pass / ⬜ Fail | |
| Snapshots | ⬜ Pass / ⬜ Fail | |

---

## 🚨 Issues Found

### Issue 1
**Severity:** ⬜ Critical / ⬜ High / ⬜ Medium / ⬜ Low  
**Description:**  
**Steps to Reproduce:**  
**Expected:**  
**Actual:**  
**Console Output:**  
**Action Required:**

---

## ✅ Sign-Off

**Tested By:**  
**Date:**  
**Environment:**  
**Overall Status:** ⬜ PASS / ⬜ FAIL  
**Ready for Production:** ⬜ YES / ⬜ NO

**Notes:**

---

## 📝 Next Steps

If all tests pass:
- [x] Merge complete ✅
- [x] Tag pushed ✅
- [ ] Smoke tests passed
- [ ] Team notified
- [ ] Documentation updated
- [ ] Monitoring active

If issues found:
- [ ] Create GitHub issue with reproduction steps
- [ ] Assign priority
- [ ] Create hotfix PR if critical
- [ ] Update team on status
