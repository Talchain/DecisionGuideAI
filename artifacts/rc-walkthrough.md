# Decision Analysis Sandbox - Stakeholder Walkthrough

**Duration:** 2-3 minutes
**Mode:** Fixtures (Default) - No backend required
**URL:** `http://localhost:5173/windsurf`

---

## Overview

The Decision Analysis Sandbox demonstrates our new interactive decision-making interface. This walkthrough covers the core features that stakeholders will experience in both demo and production environments.

---

## 🎯 Walkthrough Script (2-3 minutes)

### **Opening (15 seconds)**
*"Today I'll show you our new Decision Analysis Sandbox - a tool that helps teams explore decision scenarios interactively. This runs entirely on sample data, so you can see exactly how it works without any backend setup."*

### **1. Template Selection (30 seconds)**
1. **Point to the three template cards**
   - "We start with three starter scenarios: Pricing Change, Feature Launch, and Build vs Buy"
   - "Each template comes with pre-configured decision nodes and realistic data"

2. **Click "Pricing Change" template**
   - "Let's explore a pricing strategy decision"
   - "Notice the system announces 'Template loaded. Seed 42' for screen reader users"
   - "The interface immediately shows our split layout"

### **2. Canvas View Exploration (45 seconds)**
1. **Highlight the split layout**
   - "On the left: visual decision tree with three options"
   - "On the right: live results summary with key metrics"

2. **Point to decision nodes**
   - "Each node shows scores, pros, and cons"
   - "This gives teams a clear view of trade-offs"

3. **Show the Results Summary**
   - "Seed 42 ensures reproducible results"
   - "Performance metrics show this is running on fixtures"
   - "Key drivers are pulled from the analysis"

### **3. Simplify Toggle (20 seconds)**
1. **Click the "Simplify" toggle**
   - "Teams can reduce visual complexity"
   - "This hides detailed pros/cons when they're not needed"
   - "Notice the 0.3 threshold - this is configurable"

2. **Toggle it back off**
   - "Full detail view returns for comprehensive analysis"

### **4. List View Parity (25 seconds)**
1. **Click "Switch to List View"**
   - "Same data, different presentation"
   - "Some team members prefer list format"
   - "All information is identical - just reorganised"

2. **Show keyboard navigation**
   - "Fully accessible with keyboard-only navigation"
   - "Focus moves logically through the interface"

### **5. Compare Analysis (30 seconds)**
1. **Switch back to Canvas if needed, then click "Compare Options"**
   - "The compare drawer opens from the bottom"
   - "Notice the loading state - 'Analysing comparison...'"

2. **Wait for it to load (2-3 seconds)**
   - "Here's a side-by-side analysis with key findings"
   - "Confidence levels help teams trust the results"
   - "Three key drivers explain the recommendation"

3. **Point to metadata**
   - "Schema version and seed ensure auditability"
   - "Model information supports reproducibility"

### **6. Mobile Responsiveness (15 seconds)**
1. **Either resize browser or mention**
   - "On mobile devices, the interface automatically defaults to List View"
   - "All touch targets are 44 pixels minimum for accessibility"
   - "The interface remains fully functional on any device"

### **Closing (10 seconds)**
*"This fixture-based demo shows exactly what users will experience. Behind the scenes, we can enable live analysis with a simple feature flag - same interface, real-time results."*

---

## 🎪 Demo Badge Alignment

This walkthrough aligns with the following demo.html capabilities:

| **Badge** | **Demonstrated** |
|-----------|------------------|
| 🎯 **Template System** | Three starter scenarios with localStorage persistence |
| 📱 **Split Layout** | Canvas left, Results Summary right, responsive |
| 🔄 **View Switching** | Canvas ↔ List View with full parity |
| ⚙️ **Simplify Mode** | 0.3 threshold toggle with ARIA announcements |
| 📊 **Compare Analysis** | Fixture-based comparison with confidence metrics |
| 🎧 **Accessibility** | Screen reader support, keyboard navigation, focus management |
| 📱 **Mobile Ready** | ≤480px list-first with 44px tap targets |
| 🔧 **Feature Flags** | Fixtures default, live mode behind flag |
| 🇬🇧 **British English** | Consistent microcopy throughout |

---

## 🎬 Presentation Tips

### **Before Starting**
- Ensure `npm run dev` is running
- Clear browser cache for consistent experience
- Set browser to ~1280px width for optimal viewing
- Close dev tools for cleaner presentation

### **During Demo**
- **Pace yourself** - 2-3 minutes allows for questions
- **Highlight accessibility** - mention screen reader support
- **Emphasise fixtures** - no backend dependencies for demos
- **Show mobile** - resize or mention responsive behaviour

### **Key Messages**
1. **"Works out of the box"** - No complex setup required
2. **"Fully accessible"** - WCAG compliance built-in
3. **"Production ready"** - Same interface scales to live data
4. **"Team friendly"** - Multiple views for different preferences

---

## 🔄 Quick Reset (if needed)

If the demo gets into an unexpected state:

1. **Refresh the page** - Returns to initial state
2. **Clear localStorage** - `localStorage.clear()` in console
3. **Select different template** - Each has unique seed data

---

## 📝 Stakeholder Q&A Prep

**Q: "How does this compare to our current tools?"**
A: "This provides interactive exploration vs static reports. Teams can toggle views, compare options, and see decision rationale in real-time."

**Q: "What about live data integration?"**
A: "Simple feature flag enables live mode - same interface, real backend. No retraining required."

**Q: "Is this accessible for our compliance requirements?"**
A: "Yes - WCAG 2.1 AA compliance with screen reader support, keyboard navigation, and mobile accessibility built-in."

**Q: "Can we customise the templates?"**
A: "Absolutely - templates are JSON configuration. Teams can create custom scenarios matching their specific decision contexts."

---

**Ready for stakeholder presentation! 🚀**