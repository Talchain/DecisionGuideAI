# Scenario Library

Realistic YAML scenarios for testing and demonstration. Each includes fixed seeds for deterministic replay.

## Available Scenarios

### 1. Framework Selection (`sample-framework.yaml`)
- **What to notice**: Cost vs feature tradeoffs, developer experience considerations
- **Seed**: 42
- **Complexity**: Simple (3 options, basic constraints)

### 2. Cloud Migration Strategy (`cloud-migration.yaml`)
- **What to notice**: Risk vs speed tradeoffs, timeline dependencies
- **Seed**: 1001
- **Complexity**: Medium (3 approaches, operational constraints)

### 3. Database Technology Selection (`database-selection.yaml`)
- **What to notice**: Performance vs consistency tradeoffs, operational complexity
- **Seed**: 2002
- **Complexity**: Medium (3 technologies, scale requirements)

### 4. Security Architecture Design (`security-architecture.yaml`)
- **What to notice**: Security depth vs usability tensions, compliance requirements
- **Seed**: 3003
- **Complexity**: High (compliance-heavy, multi-tenant considerations)

### 5. Mobile App Development Strategy (`mobile-strategy.yaml`)
- **What to notice**: Development speed vs performance tradeoffs, team skills
- **Seed**: 4004
- **Complexity**: Medium (3 approaches, market timing constraints)

### 6. CI/CD Pipeline Architecture (`ci-cd-pipeline.yaml`)
- **What to notice**: Automation vs control balance, deployment safety mechanisms
- **Seed**: 5005
- **Complexity**: Medium (3 approaches, multi-environment requirements)

### 7. Enterprise Architecture Decision (`big-scenario.yaml`)
- **What to notice**: Complex multi-dimensional analysis, regulatory considerations
- **Seed**: 12345
- **Complexity**: High (6 options, 10+ constraints) - triggers budget advisories

## Usage Examples

```bash
# Pack any scenario
npm run sarb:pack -- artifacts/scenarios/cloud-migration.yaml

# Replay deterministically
npm run sarb:replay -- artifacts/runs/cloud-migration.sarb.zip

# Check determinism
npm run seeds:check -- artifacts/runs/cloud-migration.sarb.zip

# Generate transcript
npm run sarb:transcript -- artifacts/runs/cloud-migration.sarb.zip

# Budget preflight check
BUDGET_PREFLIGHT_ENABLED=1 npm run preflight:budget -- artifacts/scenarios/big-scenario.yaml --prices artifacts/prices.dev.json
```

## Notes
- All scenarios use fixed seeds for consistent testing
- Seeds are chosen to avoid overlap (1001, 2002, etc.)
- Each scenario demonstrates different decision-making patterns
- Complexity varies from simple (3 options) to enterprise-scale (6+ options)