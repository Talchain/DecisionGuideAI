# Getting Started with DecisionGuideAI

Welcome to DecisionGuideAI! This guide will help you get up and running quickly.

## Quick Start

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm 9+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/Talchain/DecisionGuideAI.git
cd DecisionGuideAI

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Environment Variables

Create a `.env.local` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PLOT_LITE_BASE_URL=https://plot-lite-service.onrender.com
```

## Project Structure

```
src/
├── adapters/          # Backend adapters (PLoT API integration)
├── canvas/            # ReactFlow canvas (decision graph editor)
│   ├── stores/        # Modular Zustand stores (NEW)
│   ├── components/    # Canvas UI components
│   ├── hooks/         # Custom React hooks
│   └── nodes/         # Custom node types
├── components/        # Shared UI components
├── contexts/          # React contexts (Auth, Teams, etc.)
├── lib/               # Utilities (auth, supabase, secure storage)
├── routes/            # Page-level components
└── templates/         # Decision templates system
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test` | Run unit tests |
| `npm run e2e` | Run E2E tests (Playwright) |
| `npm run typecheck` | Type check without emitting |
| `npm run lint` | Run ESLint |

## Documentation Map

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Project overview |
| [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) | Architecture deep-dive |
| [FEATURE_FLAG_MATRIX.md](./FEATURE_FLAG_MATRIX.md) | Feature flags reference |
| [guides/CANVAS_USER_GUIDE.md](./guides/CANVAS_USER_GUIDE.md) | Canvas editor guide |
| [technical/](./technical/) | Technical specifications |

## Architecture Overview

DecisionGuideAI is a React application for creating and analyzing decision models:

1. **Canvas**: ReactFlow-based graph editor for building decision models
2. **Analysis Engine**: Integrates with PLoT backend for decision analysis
3. **Templates**: Pre-built decision templates for common scenarios
4. **State Management**: Zustand stores (being modularized for better performance)

### State Management

The app uses Zustand for state management. We're in the process of modularizing the stores:

```typescript
// NEW: Modular stores (preferred)
import { usePanelsStore, useResultsStore } from '@/canvas/stores'

const showResults = usePanelsStore(s => s.showResultsPanel)
const results = useResultsStore(s => s.results)

// LEGACY: Combined store (still supported)
import { useCanvasStore } from '@/canvas/store'
```

## Testing

### Unit Tests

```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage
```

### E2E Tests

```bash
npm run e2e            # Run Playwright tests
npm run e2e:ui         # Interactive UI mode
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run `npm run typecheck && npm run test`
4. Create a PR with a descriptive title

See [PARALLEL_DEV_PROTOCOL.md](./technical/PARALLEL_DEV_PROTOCOL.md) for team coordination guidelines.

## Need Help?

- Check the [guides/](./guides/) folder for user guides
- Check the [technical/](./technical/) folder for specs
- Review [ROADMAP_V2_NEXT.md](./ROADMAP_V2_NEXT.md) for planned features
