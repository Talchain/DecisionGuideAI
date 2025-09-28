# Decision Analysis Sandbox - Release Candidate Pack

**Version:** RC-1.0
**Date:** 27 September 2025
**Mode:** Fixtures-first with Live Gateway behind feature flag

## Quick Start

### Running in Fixtures Mode (Default)
1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:5173/windsurf`
3. Select a template and explore the interface
4. All analysis runs on pre-built fixtures for consistent testing

### Enabling Live Gateway Mode
1. Open browser console at `/windsurf`
2. Enable the feature flag:
   ```javascript
   localStorage.setItem('feature.liveGateway', 'true')
   ```
3. Refresh the page
4. **Note:** Requires live Gateway backend to be running

### Disabling Live Mode
```javascript
localStorage.removeItem('feature.liveGateway')
```

---

## Package Contents

### 📋 UAT Scripts
- **`fixtures-uat.md`** - Complete testing flow for fixtures mode (8-10 minutes)
- **`live-uat.md`** - Extended testing for live mode with reconnection scenarios (12-15 minutes)

### 📱 Screenshots
- **`canvas-view.png`** - Main canvas with decision nodes
- **`list-view.png`** - List view showing same data
- **`compare-drawer.png`** - Compare analysis modal
- **`mobile-view.png`** - Mobile responsive layout (≤480px)

### ⚙️ Configuration
- **`microcopy.json`** - British English copy used throughout the UI
- **`compare-fixtures.json`** - Sample compare analysis data
- **`template-fixtures.json`** - Template configuration and seed data

---

## Key Features Delivered

### ✅ Core Analysis Engine
- **Fixtures Mode:** Deterministic results for testing (default)
- **Live Mode:** Real-time Gateway integration (feature flag)
- **Template System:** Three starter scenarios with localStorage persistence

### ✅ Interface Components
- **Split Layout:** Canvas left, Results Summary right
- **Dual Views:** Canvas and List with full parity
- **Simplify Toggle:** Hide details below 0.3 threshold
- **Compare Drawer:** Side-by-side analysis with fixture data

### ✅ Live Gateway Features (Flag: `feature.liveGateway`)
- **Health Monitoring:** Status tooltip with P95 timing
- **SSE Streaming:** Real-time analysis with progress tracking
- **Resume Semantics:** Automatic reconnection with Last-Event-ID (1 resume max)
- **Idempotent Cancel:** Safe cancellation handling
- **Performance Metrics:** First token timing and interruption tracking

### ✅ Accessibility & Mobile
- **ARIA Live Regions:** Screen reader announcements for state changes
- **Focus Management:** Proper tab order and focus traps in modals
- **Mobile Guardrails:** ≤480px shows List View first
- **Touch Targets:** All interactive elements ≥44px minimum
- **Keyboard Navigation:** Complete keyboard accessibility

### ✅ Status System
- **British English:** Catalogue phrases for common error scenarios
- **Status Banners:** Success, error, warning, info, and loading states
- **Connection States:** Visual indicators for live mode connectivity
- **Error Taxonomy:** Structured error handling with user-friendly messages

---

## Testing Approach

### 1. Fixtures Testing (Primary)
- Use `fixtures-uat.md` for comprehensive validation
- All features work without backend dependencies
- Deterministic results for reliable testing
- Ideal for stakeholder demos and QA validation

### 2. Live Mode Testing (Secondary)
- Requires live Gateway backend
- Use `live-uat.md` for end-to-end testing
- Tests real streaming, reconnection, and error handling
- Critical for production readiness validation

### 3. Mobile Testing
- Test at 480px and below
- Verify List View defaults
- Check touch target accessibility
- Validate responsive behaviour

---

## Architecture Decisions

### Feature Flag Strategy
- **Default:** Fixtures mode for maximum compatibility
- **Progressive Enhancement:** Live features behind opt-in flag
- **Graceful Degradation:** Fallback to fixtures on errors

### British English Microcopy
- Consistent "ise" spellings (realise, analyse, etc.)
- Professional, concise error messages
- User-friendly technical language

### Accessibility First
- WCAG 2.1 AA compliance targets
- Screen reader optimised
- Keyboard navigation complete
- Focus management in modals

### Mobile Responsive
- List View prioritised on small screens
- Touch-friendly interaction design
- Responsive grid layout
- Accessible toggle controls

---

## Known Limitations

### Fixtures Mode
- No real-time streaming (auto-completes)
- Health status hidden (live mode only)
- Limited error state simulation
- No actual Gateway connectivity

### Live Mode Dependencies
- Requires Gateway backend availability
- Network-dependent functionality
- Authentication may be required
- Rate limiting applies

---

## Support & Feedback

- **UAT Issues:** Document in provided UAT scripts
- **Feature Requests:** Reference specific acceptance criteria
- **Technical Issues:** Include mode (fixtures/live) and browser details

---

**Ready for stakeholder review and validation testing.**