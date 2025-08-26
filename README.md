# DecisionGuideAI

## Feature Flags

This project uses feature flags to enable/disable features. These can be configured in your `.env.local` file.

| Feature Flag | Description | Default |
|--------------|-------------|---------|
| `VITE_FEATURE_SCENARIO_SANDBOX` | Enables the Scenario Sandbox feature | `false` |
| `VITE_FEATURE_COLLAB_VOTING` | Enables the Collaborative Voting feature | `false` |

### Usage in Code

```typescript
import { isSandboxEnabled, isVotingEnabled } from '@/lib/config';

if (isSandboxEnabled()) {
  // Sandbox-specific code
}
```

## Development

1. Copy `.env.example` to `.env.local` and configure your environment variables.
2. Install dependencies: `yarn install`
3. Start the development server: `yarn dev`
