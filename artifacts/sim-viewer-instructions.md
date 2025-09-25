# Simulation Mode Viewer Instructions

## Quick Start

1. **Enable Simulation Mode**
   ```bash
   export SIMULATION_MODE=true
   npm run dev
   ```

2. **Test Analysis Flow**
   - Create any decision scenario
   - Analysis will use seeded mock data
   - Results are deterministic and safe

## What You'll See

### Simulation Indicators
- 🎭 "Simulation Mode" badge in UI
- Consistent results across runs
- No real API calls or costs

### Mock Streaming
- Realistic token-by-token delivery
- 2-4 second total duration
- Includes thinking/analysis phases

### Sample Outputs
- Business-appropriate scenarios
- Realistic confidence scores (70-95%)
- Professional language and structure

## Demonstration Tips

### For Live Demos
1. **Always start in simulation mode**
2. Show the streaming experience
3. Highlight deterministic results
4. Explain "this is how it works, safely"

### For Testing
- Use `npm run determinism:check` to verify consistency
- All scenarios produce identical results with same seed
- No external dependencies or API limits

### For Development
- Perfect for UI testing
- No rate limits or costs
- Instant feedback on changes

## Safety Features

- **No real AI calls**: All responses are pre-generated
- **No data collection**: Nothing leaves your machine
- **Reversible**: Turn off with environment variable
- **Predictable**: Same seed = same result every time

## Available Scenarios

The system includes realistic business scenarios:
- Market entry decisions
- Product strategy choices
- Investment alternatives
- Risk assessment situations

All scenarios are professional, non-sensitive, and suitable for demonstrations.