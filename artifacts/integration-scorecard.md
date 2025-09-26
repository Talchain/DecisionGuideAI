# Integration Scorecard & Tracker

The Integration Scorecard provides comprehensive visibility into what integrations are wired end-to-end between the **Windsurf** ↔ **Gateway** ↔ **Warp** layers.

## Overview

- **Coverage**: Real-time tracking of integration completeness
- **Evidence-based**: Automatically detects status from code, configs, and tests
- **CI Integration**: Updates on every PR with diff summaries
- **Offline**: No servers, Docker, or live API calls required

## Status Levels

| Status | Description | Priority |
|--------|-------------|----------|
| 🟢 **VERIFIED_E2E** | Integration harness/tests indicate success with ACCEPTANCE markers | P4 |
| 🔵 **WIRED_LIVE** | All layers connected, live endpoint available | P3 |
| 🟡 **WIRED_SIM** | Routes/handlers exist, returns mock/simulated data | P2 |
| 🟠 **SCAFFOLDING** | Basic structure exists but incomplete | P1 |
| 🔴 **NOT_STARTED** | No evidence of implementation found | P0 |
| 🚫 **BLOCKED** | Implementation blocked by dependencies or issues | P0 |

## Layer Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│     UI      │───▶│   Gateway   │───▶│    Warp     │───▶│    Jobs     │───▶│   Usage     │
│  (Windsurf) │    │             │    │             │    │  (Background)│    │ (Analytics) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

Each integration is mapped across relevant layers with automatic detection of:
- UI components and fixtures
- Gateway routes and OpenAPI specs
- Warp handlers and middleware
- Background job processors
- Usage tracking and analytics

## Usage

### Generate Scorecard
```bash
npm run scorecard:generate
```
Outputs:
- `artifacts/integration-scorecard.json` - Machine-readable data
- `artifacts/integration-scorecard.html` - Interactive dashboard

### Generate Diff Report
```bash
npm run scorecard:diff
```
Outputs:
- `artifacts/integration-scorecard-diff.md` - PR-friendly summary

### View Dashboard
```bash
npm run scorecard:open
```

## CI Integration

The scorecard automatically runs on PRs that modify:
- `openapi/**` - API specifications
- `integration/**` - Integration tests
- `artifacts/**` - UI fixtures and data
- `tools/scorecard-*.ts` - Scorecard tooling

### PR Comments

When triggered, the GitHub Action will:
1. Generate fresh scorecard data
2. Compare against previous version
3. Upload HTML dashboard as artifact
4. Post/update PR comment with summary

Example PR comment:
```markdown
## 🗺️ Integration Scorecard Updated

📈 **Coverage: 91%** (10/11 verified)

**Summary**: Coverage ↑ 5% (91%), 2 new, 1 improved

### 📋 Changes in this PR
• **2** new integrations
• **1** status improvements

### 🔗 Resources
• [📊 View Full Scorecard](../actions/runs/123) (see artifacts)
• [📝 Detailed Changes](../blob/feature-branch/artifacts/integration-scorecard-diff.md)
```

## Registry Configuration

### Integrations (`artifacts/scorecard/integrations.yaml`)
Define what integrations to track:
```yaml
- id: "windsurf.stream.sse"
  name: "Live token streaming with Stop and Resume-once"
  owner: "ui"
  priority: "P0"
  layer_map:
    ui: true
    gateway: true
    warp: true
  detection:
    ui:
      - "artifacts/ui-fixtures/*/sse-*.json"
    gateway:
      - "openapi/windsurf.yaml#/paths/*/stream"
```

### Status Definitions (`artifacts/scorecard/statuses.yaml`)
Configure status types, colors, and descriptions.

### Team Ownership (`artifacts/scorecard/owners.yaml`)
Map owner codes to team names and Slack channels.

## Detection Heuristics

The scorecard uses sophisticated pattern matching to automatically detect integration status:

- **File patterns**: Glob matching for fixtures, configs, tests
- **OpenAPI specs**: JSONPath queries for endpoints and schemas
- **Content analysis**: Keyword detection in source files
- **Test markers**: ACCEPTANCE comments and test descriptions
- **Mock vs Live**: Distinguishes between simulation and live endpoints

## Team Ownership

Integrations are assigned to teams for accountability:
- **UI Team**: Frontend components and user experience
- **Platform/Claude Team**: Gateway routing and platform features
- **Engine Team**: Core Warp processing and job handling

## Security

- **No secrets**: Scorecard runs entirely on static code analysis
- **No external calls**: All detection is filesystem-based
- **Read-only**: Never modifies source code or configurations
- **Open source**: All logic visible in `tools/scorecard-*.ts`

## Contributing

To add a new integration:
1. Add entry to `artifacts/scorecard/integrations.yaml`
2. Define detection patterns for each layer
3. Run `npm run scorecard:generate` to test detection
4. Commit the registry changes (scorecard updates automatically)

The scorecard will immediately begin tracking your integration and provide guidance on achieving full E2E verification.