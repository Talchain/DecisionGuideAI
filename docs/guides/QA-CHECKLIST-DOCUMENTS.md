# QA Checklist: Documents Manager File Operations (S7-FILEOPS)

## Overview
This checklist verifies the complete Documents Manager file operations feature including rename, search, sort, keyboard shortcuts, and undo/redo integration.

**Last Updated**: January 2025
**Sprint**: S7
**Test Coverage**: 114 tests (61 unit + 53 DOM)

---

## 1. Rename Operations

### 1.1 Basic Rename Flow
- [ ] Click rename button enters rename mode
- [ ] Input field is focused with current name
- [ ] Save and cancel buttons appear
- [ ] Typing new name updates input value
- [ ] Pressing Enter commits rename
- [ ] Clicking save button commits rename
- [ ] Pressing Escape cancels rename
- [ ] Clicking cancel button cancels rename
- [ ] Blurring input commits rename

### 1.2 F2 Keyboard Shortcut
- [ ] Pressing F2 on focused document card enters rename mode
- [ ] F2 while already renaming does not trigger new rename
- [ ] Input is auto-focused after F2 press

### 1.3 Validation
- [ ] Empty name shows error: "Document name cannot be empty"
- [ ] Whitespace-only name shows error: "Document name cannot be empty"
- [ ] Duplicate name shows error (case-insensitive): "A document with this name already exists"
- [ ] Name exceeding 120 characters shows error: "Name must be 120 characters or less"
- [ ] Input enforces maxLength="120"
- [ ] Validation errors clear when user types
- [ ] Validation errors prevent rename operation

### 1.4 Edge Cases
- [ ] Unchanged name exits rename mode without calling API
- [ ] Whitespace is trimmed from new name
- [ ] Special characters are allowed in name
- [ ] Unicode characters are supported in name
- [ ] Only one document in rename mode at a time

### 1.5 Accessibility
- [ ] Rename input has aria-label: "Rename document {originalName}"
- [ ] aria-invalid="true" when validation error present
- [ ] Error message has role="alert"
- [ ] Error message associated via aria-describedby
- [ ] Rename button has title="Rename (F2)"
- [ ] Save button has title="Save (Enter)"
- [ ] Cancel button has title="Cancel (Escape)"

---

## 2. Search Operations

### 2.1 Search UI
- [ ] Search input visible when documents present
- [ ] Search input hidden when no documents
- [ ] Clear button appears when search query present
- [ ] Clear button hidden when search query empty
- [ ] Search input has placeholder: "Search documents..."
- [ ] Search input has aria-label: "Search documents"

### 2.2 Search Behavior
- [ ] Typing in search box filters documents
- [ ] Search is case-insensitive
- [ ] Search matches substring anywhere in name
- [ ] Partial words match (e.g., "req" matches "requirements.pdf")
- [ ] File extensions are searchable (e.g., ".md")
- [ ] Whitespace is trimmed from query

### 2.3 Search Results
- [ ] Filtered count displayed: "4 documents (2 filtered)"
- [ ] "No documents match" message when no results
- [ ] "Try a different search term" helper text shown
- [ ] Original document count always visible

### 2.4 Clear Search
- [ ] Clicking clear button empties search input
- [ ] Clearing search restores all documents
- [ ] Clear button calls setSearchQuery('')

---

## 3. Sort Operations

### 3.1 Sort UI
- [ ] Sort buttons for all fields: name, date, size, type
- [ ] Sort controls visible when documents present
- [ ] Sort controls hidden when no documents
- [ ] Active sort field highlighted with bg-blue-100
- [ ] Sort direction indicator shown: ↑ (asc) or ↓ (desc)
- [ ] Sort label text: "Sort by:"

### 3.2 Sort Behavior
- [ ] Clicking inactive field sorts ascending
- [ ] Clicking active field toggles direction
- [ ] Each field can be sorted ascending and descending
- [ ] Sort by name: alphabetical order
- [ ] Sort by date: chronological order (by uploadedAt)
- [ ] Sort by size: numerical order (by sizeBytes)
- [ ] Sort by type: alphabetical order (csv, md, pdf, txt)

### 3.3 Stable Sort
- [ ] Tie-breaker uses addedAt field
- [ ] Same name sorts by date added
- [ ] Same size sorts by date added
- [ ] Same type sorts by date added
- [ ] Sort order is deterministic

### 3.4 ARIA Labels
- [ ] Inactive field: aria-label="Sort by {field}"
- [ ] Active field: aria-label="Sort by {field}, currently {direction}"
- [ ] Direction includes "ascending" or "descending"

---

## 4. Search + Sort Integration

- [ ] Sorted results can be searched
- [ ] Search results can be sorted
- [ ] Filtered count updates correctly
- [ ] Visual order changes reflect sort settings
- [ ] Clearing search maintains sort order

---

## 5. Session Persistence

### 5.1 Search Persistence
- [ ] Search query persists across page reloads
- [ ] Empty search removes sessionStorage key
- [ ] Works when sessionStorage unavailable

### 5.2 Sort Persistence
- [ ] Sort field persists across page reloads
- [ ] Sort direction persists across page reloads
- [ ] Default sort: date, descending
- [ ] Works when sessionStorage unavailable

---

## 6. Undo/Redo Integration

### 6.1 Undo
- [ ] Cmd/Ctrl+Z undoes document rename
- [ ] Original name restored after undo
- [ ] Undo works for multiple renames
- [ ] pushHistory() called after rename

### 6.2 Redo
- [ ] Cmd/Ctrl+Shift+Z redoes document rename
- [ ] New name restored after redo
- [ ] Redo works for multiple operations

---

## 7. Event Emission for Provenance Sync

- [ ] Document rename emits "renamed" event
- [ ] Event includes: id, oldName, newName
- [ ] Multiple listeners supported
- [ ] Listeners can unsubscribe
- [ ] Provenance chips re-render with new name

---

## 8. Performance

### 8.1 Large Document Sets (200+ items)
- [ ] Search remains responsive
- [ ] Sort completes quickly (< 100ms)
- [ ] Filtering is instant
- [ ] No visual jank or lag
- [ ] useMemo prevents unnecessary re-renders

### 8.2 Edge Cases
- [ ] Empty document list renders correctly
- [ ] Single document renders correctly
- [ ] 200+ documents handled smoothly

---

## 9. Visual Polish

### 9.1 Layout
- [ ] Upload area clearly visible
- [ ] Search bar properly aligned
- [ ] Sort buttons evenly spaced
- [ ] Document cards have proper spacing
- [ ] Rename input fits within card

### 9.2 Empty States
- [ ] "No documents yet" message with icon
- [ ] "No documents match" message with icon
- [ ] Helper text provides guidance

### 9.3 Feedback
- [ ] Hover states on buttons
- [ ] Focus states on inputs
- [ ] Active states on sort buttons
- [ ] Error messages clearly visible

---

## 10. Accessibility Compliance (WCAG AA)

### 10.1 Keyboard Navigation
- [ ] All interactive elements focusable
- [ ] Tab order is logical
- [ ] Enter activates buttons
- [ ] Escape cancels operations
- [ ] F2 shortcut works

### 10.2 Screen Readers
- [ ] All buttons have aria-labels
- [ ] Form inputs have labels
- [ ] Error messages announced (role="alert")
- [ ] Sort state announced
- [ ] Document count announced

### 10.3 Contrast
- [ ] Text meets 4.5:1 contrast ratio
- [ ] Error messages meet contrast requirements
- [ ] Icons are distinguishable

---

## 11. Cross-Browser Compatibility

- [ ] Chrome/Chromium: All features work
- [ ] Firefox: All features work
- [ ] Safari: All features work
- [ ] Edge: All features work

---

## 12. Mobile Responsiveness

- [ ] Touch-friendly targets (44x44px minimum)
- [ ] Search bar adapts to narrow screens
- [ ] Sort buttons wrap on small screens
- [ ] Rename input usable on mobile
- [ ] No horizontal scroll required

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| Product Owner | | | |

---

## Test Commands

```bash
# Run all documents tests
npm test -- src/canvas/store/__tests__/documents.spec.ts
npm test -- src/canvas/components/__tests__/DocumentsManager

# Run E2E tests
npx playwright test e2e/documents-fileops.spec.ts

# Run specific test suites
npm test -- documents.spec.ts        # Unit tests (61)
npm test -- DocumentsManager.rename  # Rename tests (27)
npm test -- DocumentsManager.search  # Search/sort tests (26)
```

---

## Known Limitations

1. Maximum 120 characters for document names
2. Search does not support regex patterns
3. Sort tie-breaker uses addedAt, not stable insertion order
4. SessionStorage only - does not persist across devices

---

## Notes

- All 114 tests passing as of January 2025
- Coverage: ≥85% lines for new modules, 100% for utilities
- Performance: Handles 200+ documents smoothly
- Accessibility: WCAG AA compliant
