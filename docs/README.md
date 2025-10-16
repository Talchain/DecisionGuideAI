# Canvas Documentation

**Start here** for all Olumi Canvas documentation.

---

## 📚 Documentation Index

### For Users

- **[Canvas User Guide](CANVAS_USER_GUIDE.md)** - Complete user manual
  - Getting started & onboarding
  - Core features (nodes, edges, selection)
  - Advanced features (command palette, properties, layout)
  - Keyboard shortcuts (24 documented)
  - Settings & preferences
  - Troubleshooting & tips

### For Developers

- **[Hardening Completion Summary](HARDENING_COMPLETION_SUMMARY.md)** - Latest release status
  - Phase completion details
  - Test counts & coverage
  - Bundle analysis
  - Acceptance criteria verification

- **[Phase B & C Completion](PHASE_B_C_COMPLETION.md)** - Feature delivery summary
  - Visual polish features
  - Layout options implementation
  - Error handling & delight features
  - Metrics & performance data

- **[Canvas State Audit](CANVAS_STATE_AUDIT.md)** - Feature inventory
  - Implemented features checklist
  - Gap analysis
  - Hardening plan
  - Test count tracking

- **[Security & Accessibility](CANVAS_SECURITY_A11Y.md)** - Compliance verification
  - Security checklist (sanitization, validation)
  - Accessibility checklist (ARIA, keyboard nav)
  - WCAG 2.1 AA compliance
  - Known issues & mitigations

---

## 🚀 Quick Start

### Running the App

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open browser to http://localhost:5173/#/canvas
```

### Running Tests

```bash
# Unit tests
npm test

# E2E tests (all)
npx playwright test e2e/canvas.*.spec.ts

# E2E tests (specific)
npx playwright test e2e/canvas.toasts.spec.ts

# E2E with UI
npx playwright test --ui

# Performance smoke tests (skip in CI)
SKIP_PERF_TESTS=1 npx playwright test e2e/canvas.perf-smoke.spec.ts
```

### Building for Production

```bash
# Build
npm run build

# Preview build
npm run preview

# Type check
npm run typecheck

# Lint
npm run lint
```

---

## 📊 Current Status

### Test Coverage
- **Unit Tests**: 27 passing
- **E2E Tests**: 118+ passing
- **Total**: 145+ tests

### Bundle Size
- **Main Bundle**: ~139KB gzipped (immediate)
- **ELK Layout**: ~441KB gzipped (lazy-loaded)
- **html2canvas**: ~46KB gzipped (lazy-loaded)

### Performance
- **60fps**: ✅ Maintained on medium graphs
- **Layout Time**: ✅ <2s for 100 nodes
- **Memory**: ✅ Zero leaks verified

### Quality
- **TypeScript**: ✅ Strict mode, 0 errors
- **ESLint**: ✅ 0 warnings
- **Console**: ✅ Zero errors in E2E
- **WCAG 2.1 AA**: ✅ Compliant

---

## 🎯 Feature Highlights

### Visual Polish
- Grid controls (show/hide, density, snap)
- GPU-accelerated hover/selection effects
- Alignment guides with fade animations
- High contrast mode
- Settings panel with persistence

### Layout Options
- ELK auto-layout (lazy-loaded)
- Direction picker (4 options)
- Spacing controls (node/layer)
- Locked nodes respected
- Single undo frame

### Error Handling
- Error boundary with recovery UI
- Toast system (Success/Error/Info)
- Diagnostics mode (?diag=1)
- Zero alert() calls

### Import/Export
- JSON/PNG/SVG export
- Import validation with auto-fix
- Label sanitization (XSS prevention)
- Snapshot manager (10 max)

### Onboarding
- Empty state overlay
- Keyboard cheatsheet (24 shortcuts)
- Command palette (⌘K)
- Context menu

---

## 🔧 Development

### Project Structure

```
src/canvas/
├── components/          # UI components
│   ├── AlignmentGuides.tsx
│   ├── CommandPalette.tsx
│   ├── ImportExportDialog.tsx
│   ├── LayoutOptionsPanel.tsx
│   ├── PropertiesPanel.tsx
│   ├── SettingsPanel.tsx
│   ├── SnapshotManager.tsx
│   └── ...
├── nodes/              # Node types
│   └── DecisionNode.tsx
├── utils/              # Utilities
│   └── layout.ts       # ELK integration
├── __tests__/          # Unit tests
├── store.ts            # Zustand store
├── persist.ts          # localStorage
├── settingsStore.ts    # Settings state
├── layoutStore.ts      # Layout state
├── ToastContext.tsx    # Toast system
├── ErrorBoundary.tsx   # Error handling
└── DiagnosticsOverlay.tsx  # Debug overlay
```

### Key Technologies

- **React Flow**: Node-based editor framework
- **Zustand**: State management
- **ELK**: Auto-layout algorithm (lazy-loaded)
- **html2canvas**: PNG export (lazy-loaded)
- **Playwright**: E2E testing
- **Vitest**: Unit testing
- **TypeScript**: Type safety (strict mode)

### Coding Standards

- **TypeScript strict mode**: No `any`, all types explicit
- **ESLint**: Zero warnings
- **React best practices**: Hooks, cleanup, memo
- **Accessibility**: ARIA labels, keyboard nav, focus management
- **Security**: Input sanitization, XSS prevention
- **Performance**: GPU transforms, debouncing, lazy loading

---

## 📖 Documentation Standards

### User Documentation
- Clear, concise language
- Step-by-step instructions
- Screenshots/GIFs for UI features
- Troubleshooting sections
- Keyboard shortcuts reference

### Developer Documentation
- Architecture decisions explained
- API contracts documented
- Test patterns described
- Performance considerations noted
- Security implications highlighted

---

## 🐛 Troubleshooting

### Common Issues

**Canvas won't load**
- Check browser console (F12)
- Clear localStorage: `localStorage.clear()`
- Try different browser

**Tests failing**
- Run `npm install` to ensure dependencies
- Check Playwright is installed: `npx playwright install`
- Run with `--headed` to see browser: `npx playwright test --headed`

**Build errors**
- Run `npm run typecheck` to see TypeScript errors
- Run `npm run lint` to see linting issues
- Clear `node_modules` and reinstall

---

## 📝 Contributing

### Before Submitting

1. Run all tests: `npm test && npx playwright test`
2. Check types: `npm run typecheck`
3. Lint code: `npm run lint`
4. Build successfully: `npm run build`
5. Update documentation if needed

### Commit Format

Use Conventional Commits:
- `feat(canvas): Add new feature`
- `fix(canvas): Fix bug`
- `docs(canvas): Update docs`
- `test(canvas): Add tests`
- `refactor(canvas): Refactor code`

---

## 📞 Support

- **Bug Reports**: Use "Report Issue" in Error Boundary
- **Feature Requests**: Open GitHub issue
- **Documentation**: This docs folder
- **Questions**: See User Guide troubleshooting section

---

## 📄 License

MIT License - See LICENSE file for details

---

**Last Updated**: Oct 16, 2025  
**Version**: 2.0.0  
**Status**: ✅ Production Ready
