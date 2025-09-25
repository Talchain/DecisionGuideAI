# Simulation Scenarios for Demo Mode

This directory contains realistic business decision scenarios for testing and demonstration purposes.

## Available Scenarios

### 1. Market Entry (seed: 42)
- **File**: `market-entry.json`
- **Scenario**: European expansion for B2B SaaS
- **Options**: Direct sales, Partner channels, Remote-first
- **Recommendation**: Partner Channel Strategy (87% confidence)

### 2. Product Launch (seed: 123)
- **File**: `product-launch.json`
- **Scenario**: Mobile app feature launch strategy
- **Options**: Free beta, Premium tier, Separate app
- **Recommendation**: Premium Tier Addition (71% confidence)

### 3. Hiring Strategy (seed: 999)
- **File**: `hiring-strategy.json`
- **Scenario**: Engineering team scaling approach
- **Options**: Local hiring, Global remote, Contractor mix, Acquisition
- **Recommendation**: Global Remote Hiring (95% confidence)

### 4. Infrastructure Upgrade (seed: 1337)
- **File**: `infrastructure-upgrade.json`
- **Scenario**: Cloud infrastructure modernization
- **Options**: Containerization, Serverless, Incremental
- **Recommendation**: Containerization Migration (78% confidence)

### 5. Pricing Strategy (seed: 2024)
- **File**: `pricing-strategy.json`
- **Scenario**: SaaS pricing model optimization
- **Options**: Usage-based, Freemium, Tiered features, Enterprise custom
- **Recommendation**: Freemium Model (90% confidence)

## How to Use for Repeatable Demos

### 1. Select a Seed
Each scenario has a fixed seed number that ensures deterministic results:

```javascript
// In your demo simulation code
const DEMO_SEEDS = {
  MARKET_ENTRY: 42,      // Always recommends Partner Channel
  PRODUCT_LAUNCH: 123,   // Always recommends Premium Tier
  HIRING: 999,           // Always recommends Global Remote
  INFRASTRUCTURE: 1337,  // Always recommends Containerization
  PRICING: 2024          // Always recommends Freemium
};
```

### 2. Run Determinism Check
Verify all scenarios produce consistent results:

```bash
npm run determinism:check
```

This will test each seed and confirm identical outputs across multiple runs.

### 3. Demo Script Example

```bash
# 1. Show system health
npm run release:poc

# 2. Enable simulation mode
export SIMULATION_MODE=true

# 3. Run a specific scenario
# Use seed 42 for market entry demo
# Use seed 999 for technical/hiring demo
# Use seed 2024 for business/pricing demo

# 4. Show deterministic results
npm run determinism:check
```

## Scenario Design Principles

### Realistic Business Context
- Based on common startup/scaleup decisions
- Professional language and realistic numbers
- Multiple viable options with trade-offs

### Safe for Demonstrations
- No sensitive data or proprietary information
- Appropriate for public demos and screenshots
- Generic enough to not reveal client details

### Deterministic Results
- Each seed produces identical analysis every time
- Confidence scores and recommendations are fixed
- Perfect for repeatable demos and testing

### Educational Value
- Shows different types of business decisions
- Demonstrates various analysis frameworks
- Illustrates risk/reward trade-offs

## Adding New Scenarios

When creating new scenarios:

1. **Choose a unique seed** (avoid existing ones)
2. **Test determinism** with `npm run determinism:check`
3. **Verify realism** - would a real company face this decision?
4. **Ensure safety** - no sensitive or proprietary content
5. **Document expected output** for demo preparation

## Integration with Demo Kit

These scenarios are included in the demo kit and referenced by:
- Simulation viewer instructions
- Operator handbook demo checklist
- Evidence pack documentation
- Integration testing suite