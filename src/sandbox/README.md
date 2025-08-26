# Scenario Sandbox

This module provides a collaborative scenario sandbox feature for DecisionGuide.AI, allowing users to create, edit, and visualize decision trees and scenarios in real-time.

## Feature Flag

This feature is controlled by the `VITE_FEATURE_SCENARIO_SANDBOX` environment variable. By default, it is disabled. To enable it, add the following to your `.env.local` file:

```
VITE_FEATURE_SCENARIO_SANDBOX=true
```

In your code, you can check if the sandbox is enabled using:

```typescript
import { isSandboxEnabled } from '@/lib/config';

if (isSandboxEnabled()) {
  // Sandbox-specific code
}
```

## Features

- Real-time collaborative editing using Yjs
- Visual canvas for creating and connecting nodes
- Support for different node types (decision, option, outcome)
- Version history and undo/redo support
- Integration with the main application state

## Getting Started

### Prerequisites

- Node.js 16+
- Yarn or npm
- Supabase project with the required tables

### Environment Variables

Add the following to your `.env` file:

```
VITE_FEATURE_SCENARIO_SANDBOX=true
VITE_FEATURE_COLLAB_VOTING=true
```

### Installation

1. Install dependencies:
   ```bash
   yarn add yjs @syncedstore/react
   ```

2. Run database migrations:
   ```bash
   npx supabase migration up
   ```

## Usage

### Basic Usage

```tsx
import { SandboxRoute, SANDBOX_ROUTE } from './sandbox';

// In your router configuration
<Route path={SANDBOX_ROUTE} element={<SandboxRoute />} />
```

### Hooks

#### useSandbox

Initialize and manage the sandbox feature:

```tsx
import { useSandbox } from './sandbox';

function App() {
  const { isEnabled } = useSandbox();
  
  if (!isEnabled) {
    return <div>Feature not available</div>;
  }
  
  return (
    // Your app content
  );
}
```

## Architecture

The sandbox is built using:

- **Yjs**: For real-time collaboration
- **React**: For UI components
- **TypeScript**: For type safety
- **Supabase**: For data persistence

## License

MIT
