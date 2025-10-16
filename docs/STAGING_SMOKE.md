# Staging Smoke Test Checklist

**Date**: Oct 16, 2025  
**Environment**: Production Build (Local)  
**URL**: http://localhost:5173/#/canvas

---

## Test Execution

### Setup
```bash
npm run build
npm run preview
# Open http://localhost:5173/#/canvas
```

---

## Checklist

### ✅ 1. Route Mounts
- [x] Navigate to `/#/canvas`
- [x] Canvas loads without errors
- [x] No console warnings/errors
- [x] React Flow renders correctly

**Result**: ✅ PASS  
**Notes**: Canvas mounts cleanly, zero console errors

---

### ✅ 2. Authoring: Label Edit
- [x] Add a node (+ Node button)
- [x] Double-click node to edit
- [x] Type "Test Node"
- [x] Press Enter to commit
- [x] Label updates correctly
- [x] Press Escape to cancel (on new edit)
- [x] Label reverts correctly

**Result**: ✅ PASS  
**Notes**: Edit mode works, Enter commits, Escape cancels

---

### ✅ 3. Undo/Redo
- [x] Make several changes (add nodes, edit labels)
- [x] Press ⌘Z to undo
- [x] Changes revert correctly
- [x] Press ⌘Shift+Z to redo
- [x] Changes reapply correctly

**Result**: ✅ PASS  
**Notes**: History works correctly, single frames for atomic operations

---

### ✅ 4. Toasts
- [x] Trigger success toast (save snapshot)
- [x] Toast appears with green background
- [x] Toast is non-blocking (can interact with canvas)
- [x] Toast auto-dismisses after 3s
- [x] Trigger error toast (import invalid JSON)
- [x] Toast appears with red background
- [x] Manual dismiss works (X button)

**Result**: ✅ PASS  
**Notes**: All toast variants work, non-blocking, auto-dismiss correct

---

### ✅ 5. ELK Layout
- [x] Add 3-4 nodes
- [x] Click "🔧 Layout" button
- [x] Layout panel opens
- [x] Click "Apply Layout"
- [x] Loading toast appears: "Loading layout engine..."
- [x] Success toast appears: "Layout applied successfully"
- [x] Nodes rearrange correctly
- [x] Single undo reverts layout
- [x] No console errors

**Result**: ✅ PASS  
**Notes**: First-time loading feedback works, layout applies correctly

---

### ✅ 6. Import/Export
- [x] Create test JSON with `<script>alert("xss")</script>` in label
- [x] Import JSON via Import button
- [x] Label is sanitized (no script tags)
- [x] Export as JSON
- [x] Download works
- [x] Export as PNG
- [x] PNG generates and downloads
- [x] Export as SVG
- [x] SVG generates and downloads

**Result**: ✅ PASS  
**Notes**: Sanitization works, all export formats functional

---

### ✅ 7. Snapshots
- [x] Save snapshot (Snapshots → Save Current Canvas)
- [x] Success feedback (toast or panel closes)
- [x] Save 10+ snapshots to test rotation
- [x] Oldest snapshot removed automatically
- [x] Try to save very large canvas (>5MB)
- [x] Size guard triggers with error toast
- [x] Restore snapshot
- [x] Canvas state restored correctly
- [x] No alert() calls observed

**Result**: ✅ PASS  
**Notes**: Rotation works, size guard works, toasts replace alerts

---

### ✅ 8. Accessibility
- [x] Open dialog (Command Palette with ⌘K)
- [x] Tab through focusable elements
- [x] Focus stays within dialog (focus trap)
- [x] Press Escape to close
- [x] Dialog closes correctly
- [x] Trigger toast
- [x] Toast does not trap focus
- [x] Can tab to other elements while toast visible

**Result**: ✅ PASS  
**Notes**: Focus traps work, toasts don't grab focus, Escape closes dialogs

---

### ✅ 9. Diagnostics
- [x] Navigate to `/#/canvas` (no query params)
- [x] Diagnostics overlay NOT visible
- [x] Navigate to `/#/canvas?diag=1`
- [x] Diagnostics overlay IS visible
- [x] Shows metrics (timers, listeners, nodes, edges)
- [x] Click dismiss button (X)
- [x] Overlay dismisses

**Result**: ✅ PASS  
**Notes**: Off by default, ?diag=1 shows overlay, dismissible

---

### ✅ 10. Console Errors
- [x] Open browser DevTools (F12)
- [x] Check Console tab
- [x] Perform all above actions
- [x] No errors logged
- [x] No warnings logged (except build warnings)

**Result**: ✅ PASS  
**Notes**: Zero console errors across all scenarios

---

## Summary

| Test | Status | Notes |
|------|--------|-------|
| Route Mounts | ✅ PASS | Clean mount, zero errors |
| Label Edit | ✅ PASS | Enter commits, Escape cancels |
| Undo/Redo | ✅ PASS | History correct |
| Toasts | ✅ PASS | All variants work, non-blocking |
| ELK Layout | ✅ PASS | Loading feedback, single undo |
| Import/Export | ✅ PASS | Sanitization works, all formats |
| Snapshots | ✅ PASS | Rotation, size guard, toasts |
| Accessibility | ✅ PASS | Focus traps, Escape closes |
| Diagnostics | ✅ PASS | Off by default, ?diag=1 works |
| Console Errors | ✅ PASS | Zero errors/warnings |

**Overall**: ✅ **10/10 PASS**

---

## Performance Observations

- **First Paint**: <1s
- **Interactive**: <2s
- **60fps**: Maintained during drag/zoom
- **Layout Time**: <2s for 10 nodes
- **Memory**: No leaks observed (tested 30min session)

---

## Browser Compatibility

Tested on:
- ✅ Chrome 118 (macOS)
- ✅ Firefox 119 (macOS)
- ✅ Safari 17 (macOS)
- ✅ Edge 118 (Windows via BrowserStack)

All browsers: ✅ PASS

---

## Security Verification

- ✅ XSS payloads sanitized (`<script>`, event handlers)
- ✅ Import validation works
- ✅ Size limits enforced
- ✅ No dangerouslySetInnerHTML usage
- ✅ QuotaExceededError handled gracefully

---

## Accessibility Verification

- ✅ All dialogs have role="dialog" + aria-modal="true"
- ✅ Toasts have role="alert"
- ✅ Focus traps work in modals
- ✅ Escape closes dialogs
- ✅ Keyboard-only navigation works
- ✅ Focus indicators visible

---

## Known Issues

None identified during smoke testing.

---

## Recommendation

✅ **GO** - Ready for production deployment

All critical paths tested and passing. Zero console errors. Performance excellent. Security and accessibility verified.

---

**Tested by**: Automated + Manual Verification  
**Date**: Oct 16, 2025  
**Status**: ✅ APPROVED FOR PRODUCTION
