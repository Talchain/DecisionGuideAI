# Phase 5: Manual Functional Testing Checklist

## Overview
This checklist ensures the Guide Variant functions correctly after the rename from Copilot to Guide. Complete each item before proceeding to Phase 6.

---

## 🚀 Pre-Testing Setup

- [ ] Build the application: `npm run build`
- [ ] Start dev server: `npm run dev:guide`
- [ ] Open browser to Guide route: `http://localhost:5173/#/sandbox/guide`

---

## 📋 Core Functionality Tests

### Journey State 1: Empty State
- [ ] On initial load, verify "Empty State" panel displays
- [ ] Verify "Get Started" heading visible
- [ ] Verify "Add your first node" prompt visible
- [ ] Verify HelpModal keyboard shortcut displayed

### Journey State 2: Building State
- [ ] Add a single node to canvas
- [ ] Verify panel changes to "Building State"
- [ ] Verify "Build Your Graph" heading visible
- [ ] Verify tips section displays correctly
- [ ] Verify "Start adding more nodes" guidance visible

### Journey State 3: Pre-Run Blocked State
- [ ] Create graph with blocking issues (e.g., missing required fields)
- [ ] Verify panel shows "Pre-Run Blocked State"
- [ ] Verify blocker badges display (error/warning variants)
- [ ] Verify blocker messages are clear and actionable
- [ ] Verify "Fix these issues to run analysis" message visible

### Journey State 4: Pre-Run Ready State
- [ ] Create valid graph with no blockers
- [ ] Verify panel shows "Pre-Run Ready State"
- [ ] Verify "Ready to Analyze" heading with success badge
- [ ] Verify quick stats section (node count, edge count, etc.)
- [ ] Verify "Run Analysis" CTA button enabled and styled correctly

### Journey State 5: Post-Run State
- [ ] Run analysis on valid graph
- [ ] Verify panel shows "Post-Run State"
- [ ] Verify "Analysis Complete" heading visible
- [ ] Verify summary stats display correctly
- [ ] Verify Top Drivers section with expandable items (max 7 visible)
- [ ] Verify Risks section with expandable items
- [ ] Verify Advanced Metrics section with expandable items
- [ ] Click "View Details" - verify navigation works

### Journey State 6: Inspector State
- [ ] Click on a node in canvas
- [ ] Verify panel shows "Inspector State"
- [ ] Verify selected node name in heading
- [ ] Verify node properties displayed correctly
- [ ] Verify "Back to Analysis" button works
- [ ] Click away from node - verify returns to previous state

### Journey State 7: Compare State
- [ ] Enable compare mode (if feature exists)
- [ ] Verify panel shows "Compare State"
- [ ] Verify comparison UI elements visible
- [ ] Verify side-by-side comparison works
- [ ] Disable compare mode - verify returns to previous state

---

## ⌨️ Keyboard Shortcuts

- [ ] Press `?` - verify HelpModal opens
- [ ] Press `Esc` - verify HelpModal closes
- [ ] Press `Esc` with inspector open - verify returns to main view
- [ ] All documented shortcuts work as expected

---

## 🎨 Visual & Accessibility Tests

### Visual Checks
- [ ] Panel header displays "Guide" branding (not "Copilot")
- [ ] All badges render correctly (success, warning, error, info, neutral)
- [ ] All buttons render correctly (4 variants × 3 sizes)
- [ ] Cards have proper spacing and borders
- [ ] Expandable sections expand/collapse smoothly
- [ ] No visual glitches or layout breaks
- [ ] Dark mode works (if implemented)

### Accessibility Checks
- [ ] Tab through all interactive elements - focus visible
- [ ] Screen reader announces panel changes correctly
- [ ] All buttons have accessible labels
- [ ] All sections have proper ARIA roles
- [ ] Keyboard navigation works without mouse
- [ ] Color contrast meets WCAG 2.1 Level AA

---

## 🧪 Error Boundary Tests

- [ ] Trigger intentional error in panel component
- [ ] Verify ErrorBoundary catches error
- [ ] Verify fallback UI displays
- [ ] Verify error logged to console
- [ ] Verify app doesn't crash

---

## 📱 Responsive Tests

- [ ] Test at 1920px viewport - all elements visible
- [ ] Test at 1280px viewport - layout adapts
- [ ] Test at 1024px viewport - no horizontal scroll
- [ ] Panel remains functional at all sizes

---

## 🔗 Integration Tests

- [ ] Canvas interactions trigger panel updates
- [ ] Panel actions trigger canvas updates (if applicable)
- [ ] Store state persists correctly
- [ ] Route navigation works (`/#/sandbox/guide`)
- [ ] No console errors during normal usage
- [ ] No memory leaks after extended usage

---

## 📝 Documentation Tests

- [ ] Open `GETTING_STARTED.md` - all "Guide" references correct
- [ ] Open `ARCHITECTURE.md` - all diagrams reference "Guide"
- [ ] Open component READMEs - all examples reference "Guide"
- [ ] No broken links in documentation
- [ ] Code examples in docs are accurate

---

## ✅ Test Result Summary

**Date Tested**: _______________
**Tested By**: _______________
**Browser/Version**: _______________

**Tests Passed**: _____ / _____
**Tests Failed**: _____ / _____
**Blockers Found**: _____

**Notes**:
```
[Add any issues, edge cases, or observations here]
```

---

## 🚦 Proceed to Phase 6?

- [ ] **All critical tests passed**
- [ ] **No blocking issues found**
- [ ] **Documentation verified**
- [ ] **Ready for pre-merge safety check**

**If all boxes checked above, proceed to Phase 6:**
```bash
./scripts/pre-merge-safety-check.sh
```

---

## 📌 Notes for Testers

- **Expected Test Duration**: 30-45 minutes for thorough testing
- **Test Environment**: Use dev server (`npm run dev:guide`)
- **Report Issues**: Document any failures in this file before proceeding
- **Critical vs Non-Critical**: Distinguish between blocking and cosmetic issues
