# Getting Started with Copilot Variant

Welcome! This guide will help you understand and contribute to the Copilot Variant in under 10 minutes.

## What is the Copilot Variant?

The Copilot Variant is an alternative UI for Olumi's Scenario Sandbox that transforms it from a graphing tool into a **proactive AI decision coach**. Instead of users asking for help, the AI copilot observes what they're doing and automatically suggests next actions, explains results, and guides them through their decision journey.

### Quick Comparison

| Feature | Original Sandbox | Copilot Variant |
|---------|------------------|-----------------|
| **UI Style** | Traditional canvas + sidebar | Canvas + persistent AI panel |
| **Guidance** | User-initiated | Proactive and adaptive |
| **Panel Content** | Static documentation | Dynamic based on journey stage |
| **Primary Use** | Expert users | All skill levels |

## Prerequisites

- Node.js 18+ and npm
- Familiarity with React, TypeScript, and Zustand
- Basic understanding of the main Olumi codebase
- Feature flag enabled: `VITE_COPILOT_ENABLED=true`

## Quick Start (5 minutes)

### 1. Clone and Install

```bash
# If you haven't cloned the repo yet
git clone https://github.com/Talchain/DecisionGuideAI.git
cd DecisionGuideAI

# Install dependencies
npm install
```

### 2. Enable the Feature

```bash
# Create .env.local file with feature flag
echo "VITE_COPILOT_ENABLED=true" > .env.local
```

### 3. Run the Development Server

```bash
# Start dev server with copilot enabled
npm run dev:copilot

# Or use the standard dev command (if flag is in .env.local)
npm run dev
```

### 4. View the Copilot Variant

Open your browser and navigate to:
```
http://localhost:5173/#/sandbox/copilot
```

You should see the copilot interface with:
- Canvas on the left (flexible width)
- AI copilot panel on the right (fixed 360px)
- Top bar with journey stage indicator
- Bottom toolbar with quick actions

## Key Concepts

### 1. Journey Stages

The copilot adapts its content based on 7 journey stages:

```
empty → building → pre-run-blocked → pre-run-ready → post-run → inspector → compare
```

**Stage Descriptions**:
- `empty` - No nodes on canvas, shows getting started guide
- `building` - User is adding nodes, shows 4-step progress tracker
- `pre-run-blocked` - Graph has issues, shows specific blockers
- `pre-run-ready` - Graph is valid, shows run button
- `post-run` - Analysis complete, shows rich PLoT + CEE insights
- `inspector` - User selected a node/edge, shows details
- `compare` - Comparison mode active (future feature)

### 2. Panel States

Each journey stage has a corresponding panel state component:

- `EmptyState` - Getting started CTAs
- `BuildingState` - Progress tracker
- `PreRunBlockedState` - Blocker list
- `PreRunReadyState` - Graph stats + run button
- `PostRunState` - Full results with insights
- `InspectorState` - Node/edge inspector
- `CompareState` - Comparison view (placeholder)

### 3. Adaptive Panel

The `CopilotPanel` component automatically switches content based on the journey stage. No manual navigation required!

### 4. Progressive Disclosure

UI shows max 7 items at once. Additional content hidden behind "Show more" expandable sections.

## Project Structure

```
src/pages/sandbox-copilot/
├── index.tsx                 # Entry point (route handler)
├── CopilotLayout.tsx         # Main 3-panel layout
├── hooks/                    # Custom hooks (state, keyboard, detection)
├── utils/                    # Business logic (journey detection)
├── components/
│   ├── canvas/              # Canvas enhancements (overlay, badges)
│   ├── panel/               # Panel container + states
│   │   ├── states/          # 7 journey state components
│   │   └── sections/        # Reusable panel sections
│   ├── shared/              # Design system components
│   ├── topbar/              # Top bar with journey indicator
│   └── toolbar/             # Bottom toolbar with actions
├── types/                   # TypeScript type definitions
└── __tests__/               # Test files
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed diagrams.

## Running Tests

```bash
# Run all copilot tests
npm run test:copilot

# Run tests in watch mode
npm run test:copilot -- --watch

# Run specific test file
npm run test:copilot -- CopilotLayout.test.tsx
```

## Linting and Type Checking

```bash
# Lint copilot code (enforces isolation rules)
npm run lint:copilot

# Type check
npm run typecheck
```

## Making Your First Change

### Example: Add a new keyboard shortcut

1. **Open** `hooks/useKeyboardShortcuts.ts`
2. **Add** your shortcut to the `KEYBOARD_SHORTCUTS` array
3. **Implement** the handler in the `useEffect`
4. **Update** `HelpModal.tsx` to show the new shortcut
5. **Test** it works by pressing the key
6. **Write** a test in `useKeyboardShortcuts.test.ts`

### Example: Customize a panel state

1. **Navigate** to `components/panel/states/`
2. **Choose** the state you want to modify (e.g., `PostRunState.tsx`)
3. **Edit** the JSX to change the UI
4. **Test** by triggering that state (e.g., run an analysis)
5. **Check** that progressive disclosure rules are maintained

## Important Rules

### Safety Guardrails

1. **NO IMPORTS FROM `/pages/sandbox/`** - Copilot is isolated
2. **READ ONLY access to shared stores** - Never write to canvas/results stores
3. **Use `useCopilotStore` for copilot state** - Don't pollute shared state
4. **Test isolation** with `./scripts/verify-copilot-safety.sh`

### Code Quality

1. **TypeScript strict mode** - No `any` types
2. **Accessibility first** - ARIA labels, keyboard navigation
3. **Progressive disclosure** - Max 7 items visible
4. **No contradictory signals** - Never show blockers + positive outcomes together

### Conventions

1. **Component naming** - Prefix with `Copilot` where appropriate
2. **File naming** - PascalCase for components, camelCase for utilities
3. **Test files** - Co-locate with implementation (`.test.ts` or `.test.tsx`)
4. **Type definitions** - Define in component file, export if shared

## Common Tasks

### How do I add a new panel state?

1. Create component in `components/panel/states/NewState.tsx`
2. Add stage to `JourneyStage` type in `types/copilot.types.ts`
3. Update `determineJourneyStage()` in `utils/journeyDetection.ts`
4. Add case in `CopilotPanel.tsx` switch statement
5. Write tests in `utils/journeyDetection.test.ts`

### How do I modify journey detection logic?

Edit `utils/journeyDetection.ts` and follow the priority order:
1. Inspector (highest priority)
2. Compare mode
3. Post-run
4. Pre-run (ready vs blocked)
5. Building
6. Empty (default)

### How do I add a new shared component?

1. Create component in `components/shared/YourComponent.tsx`
2. Add JSDoc comments with examples
3. Export from `components/shared/index.ts` (barrel export)
4. Document in `components/shared/README.md`
5. Use design system tokens (colors, spacing, typography)

## Resources

- [STATUS.md](./STATUS.md) - Comprehensive project status and metrics
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture diagrams and data flow
- [ACCESSIBILITY.md](./ACCESSIBILITY.md) - WCAG guidelines and keyboard shortcuts
- [README.md](./README.md) - Safety rules and development commands
- [components/shared/README.md](./components/shared/README.md) - Component library reference
- [components/panel/states/README.md](./components/panel/states/README.md) - State machine guide

## Getting Help

1. **Read the docs** - Start with this guide, then STATUS.md
2. **Check existing code** - Look at similar components for patterns
3. **Run tests** - Ensure your changes don't break anything
4. **Ask questions** - File an issue with label `question`

## Next Steps

Now that you're set up:

1. ✅ Run the dev server and explore the UI
2. ✅ Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system
3. ✅ Check out [components/shared/README.md](./components/shared/README.md) for reusable components
4. ✅ Look at existing tests to understand testing patterns
5. ✅ Make a small change and see it in action!

---

**Ready to contribute?** Start with the issues labeled `good-first-issue` in the repo.

**Questions?** File an issue with label `copilot-variant` or `question`.

Welcome to the team! 🚀
