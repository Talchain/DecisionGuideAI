# Scenario Linter and Advisor

The scenario linter provides automated analysis and advice for decision scenarios, helping identify common issues and optimisation opportunities.

## API Endpoint

```http
POST /lint/scenario
Content-Type: application/json

{
  "nodes": [...],
  "links": [...],
  "id": "optional-scenario-id"
}
```

**Note:** This endpoint requires `LINTER_ENABLE=1` environment variable.

## Response Format

Returns `lint.v1` schema with analysis results:

```json
{
  "schema": "lint.v1",
  "timestamp": "2025-01-16T12:34:56.789Z",
  "scenario": {
    "id": "example-scenario",
    "nodeCount": 5,
    "linkCount": 4
  },
  "summary": {
    "errors": 0,
    "warnings": 2,
    "info": 1,
    "score": 85
  },
  "issues": [
    {
      "severity": "warning",
      "code": "MISSING_LABEL",
      "message": "Node 'factor1' has no label",
      "advice": "Add a descriptive label to help users understand what this node represents.",
      "path": "node[factor1]"
    }
  ]
}
```

## Issue Types

### Severity Levels

- **error**: Critical issues that prevent proper scenario analysis
- **warning**: Issues that may cause problems or confusion
- **info**: Suggestions for improvement and best practices

### Issue Categories

#### Structure Issues
- `EMPTY_SCENARIO` - No nodes defined
- `SINGLE_NODE` - Only one node (may lack decision complexity)
- `NO_LINKS` - Multiple nodes with no relationships
- `MISSING_ID` - Scenario lacks identifier

#### Node Issues
- `DUPLICATE_NODE_ID` - Multiple nodes with same ID
- `EMPTY_NODE_ID` - Node missing or has empty ID
- `MISSING_LABEL` - Node lacks descriptive label
- `INVALID_WEIGHT` - Weight is not a valid number
- `WEIGHT_OUT_OF_RANGE` - Weight outside typical 0-1 range
- `MANY_UNLABELLED` - High proportion of nodes lack labels
- `LARGE_SCENARIO` - Many nodes may indicate complexity

#### Link Issues
- `DUPLICATE_LINK` - Same connection defined multiple times
- `INCOMPLETE_LINK` - Missing from/to node references
- `INVALID_FROM_NODE` - Source node doesn't exist
- `INVALID_TO_NODE` - Target node doesn't exist
- `SELF_LOOP` - Node links to itself
- `INVALID_LINK_WEIGHT` - Link weight is not valid number
- `LINK_WEIGHT_OUT_OF_RANGE` - Link weight outside typical range

#### Topology Issues
- `ISOLATED_NODE` - Node has no connections
- `NO_ROOT_NODES` - No clear starting points
- `MANY_ROOT_NODES` - Too many potential entry points
- `NO_LEAF_NODES` - No clear outcome nodes
- `CIRCULAR_DEPENDENCY` - Cycles detected in relationships

#### Weight Analysis
- `LOW_AVERAGE_WEIGHTS` - Weights may be too small
- `WEIGHT_IMBALANCE` - Large disparity between weights
- `MIXED_WEIGHT_USAGE` - Some nodes weighted, others not

#### Complexity Analysis
- `VERY_DENSE_GRAPH` - High connectivity may indicate complexity
- `SPARSE_GRAPH` - Low connectivity may miss relationships
- `HIGH_COMPLEXITY` - Large size may impact performance
- `HIGH_CONNECTIVITY` - Many connections per node
- `LOW_CONNECTIVITY` - Few connections may miss dependencies

## Scoring System

The linter calculates a quality score from 0-100:

- **100 points baseline**
- **-20 points per error** (critical issues)
- **-5 points per warning** (moderate issues)
- **-1 point per info item** (minor suggestions)

Score interpretation:
- **90-100**: Excellent scenario structure
- **70-89**: Good structure with minor improvements possible
- **50-69**: Acceptable but some issues should be addressed
- **30-49**: Poor structure requiring significant improvements
- **0-29**: Critical issues that prevent effective analysis

## Usage Examples

### Basic Linting

```bash
curl -X POST http://localhost:3001/lint/scenario \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [
      {"id": "decision", "label": "Choose Technology", "weight": 1.0},
      {"id": "cost", "label": "Cost Factor", "weight": 0.7},
      {"id": "reliability", "label": "Reliability Factor", "weight": 0.9}
    ],
    "links": [
      {"from": "decision", "to": "cost", "weight": 0.7},
      {"from": "decision", "to": "reliability", "weight": 0.9}
    ]
  }'
```

### Linting with Issues

```json
{
  "nodes": [
    {"id": "decision"},
    {"id": "", "label": "Bad Node"},
    {"id": "factor1", "weight": "invalid"}
  ],
  "links": [
    {"from": "decision", "to": "nonexistent"},
    {"from": "factor1", "to": "factor1"}
  ]
}
```

Expected issues:
- `MISSING_LABEL` for decision node
- `EMPTY_NODE_ID` for second node
- `INVALID_WEIGHT` for factor1
- `INVALID_TO_NODE` for first link
- `SELF_LOOP` for second link

### Integration with UI

```typescript
// Validate scenario before submission
async function validateScenario(scenario: Scenario) {
  const response = await fetch('/lint/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario)
  });

  const lint = await response.json();

  // Show errors to user
  const errors = lint.issues.filter(i => i.severity === 'error');
  if (errors.length > 0) {
    showErrors(errors);
    return false;
  }

  // Show warnings as suggestions
  const warnings = lint.issues.filter(i => i.severity === 'warning');
  if (warnings.length > 0) {
    showSuggestions(warnings);
  }

  return true;
}
```

### Batch Analysis

```bash
# Analyse multiple scenarios
for file in scenarios/*.json; do
  echo "Analysing $file..."
  curl -X POST http://localhost:3001/lint/scenario \
    -H "Content-Type: application/json" \
    -d @"$file" | jq '.summary.score'
done
```

## Configuration

The linter behaviour can be configured via environment variables:

- `LINTER_ENABLE=1` - Enable the linter endpoint (required)

## Best Practices

### For Scenario Authors

1. **Use meaningful IDs and labels** for all nodes
2. **Maintain consistent weight scales** (typically 0-1)
3. **Ensure connectivity** between related factors
4. **Avoid circular dependencies** that may cause confusion
5. **Keep scenarios focused** - break large scenarios into modules

### For Developers

1. **Run linting during development** to catch issues early
2. **Set score thresholds** for automated quality gates
3. **Review warnings regularly** for optimisation opportunities
4. **Use issue codes** to implement custom rules or filters
5. **Monitor complexity metrics** for performance planning

### For Quality Assurance

1. **Establish minimum score requirements** for production scenarios
2. **Review topology warnings** for decision flow issues
3. **Check weight consistency** across related scenarios
4. **Validate all scenarios** before major releases
5. **Track improvement trends** using historical scoring data

## Limitations

- **Read-only analysis** - does not modify scenarios
- **Static analysis** - cannot detect runtime behaviour issues
- **Heuristic-based** - some advice may not apply to specific use cases
- **No context awareness** - cannot understand domain-specific requirements

## Extending the Linter

The linter is designed to be extensible. To add new checks:

1. Add new issue codes to the documentation
2. Implement check functions in `scenario-linter.ts`
3. Update tests with new issue scenarios
4. Document the new checks and their advice

Common extension points:
- Domain-specific validation rules
- Custom weight range requirements
- Organisation-specific naming conventions
- Integration with external validation services