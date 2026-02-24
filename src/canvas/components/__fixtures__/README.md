# Storybook Fixtures for Results Panel and Structure Tab

## Task Q.2: Visual Regression Baselines

This directory contains fixture data for Storybook stories that provide visual regression baselines for the Results Panel and Structure (Diagnostics) tab.

## Fixture Requirements

Each fixture should be based on a real PLoT `/v2/run` SSE response captured from `staging--olumi.netlify.app`:

1. **normal-analysis.json** - Baseline: quantitative goal, 2 options, clear winner (>15% separation), 5 factors, moderate robustness, no constraint violations
2. **close-call.json** - Close decision: narrow win probabilities (<5% separation), fragile edge, one constraint prob_satisfied 0.4-0.6
3. **sensitivity-dominated.json** - One factor with abs(elasticity) > 0.6, others < 0.15
4. **edge-case.json** - Qualitative goal, single option (status quo), no constraints, m2_decision_review: null

## Data Requirements

All fixtures must include:
- `fact_objects[]` - Feature flag ON in staging
- `review_cards[]` - Feature flag ON in staging
- Valid V2RunResponse schema compliance

## Story Files

Two story files render these fixtures:
- **OutputsDock.stories.tsx** - Results Panel stories (4 stories, one per fixture)
- **GraphTextView.stories.tsx** - Structure tab stories (4 stories, one per fixture)

Total: **8 stories** (2 per fixture)

## TODO: Capture Real Responses

To complete this task:
1. Navigate to `staging--olumi.netlify.app` in browser
2. Run analyses with the characteristics above
3. Open DevTools → Network → find SSE response from `/v2/run`
4. Save complete JSON to the fixture files
5. Update story files with fixture data (nodes, edges, robustness sets)
6. Generate visual regression snapshots

## Dependencies

- Requires access to staging environment
- Requires feature flags: `fact_objects`, `review_cards` (both ON)
- Real user graphs that match the fixture specifications
