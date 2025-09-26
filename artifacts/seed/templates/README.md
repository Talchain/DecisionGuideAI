# Deterministic Starter Templates

**Purpose**: Three realistic, seeded decision scenarios for instant Windsurf integration demos and development.

## 🎯 Quick Start

### For Windsurf Development
```javascript
// Load template in your UI
const template = await fetch('/artifacts/seed/templates/pricing-change.seed42.json')
  .then(res => res.json());

// Use the seed for deterministic results
const stream = await fetch(`/stream?route=critique&seed=${template.seed}&scenarioId=${template.template_name}`);
```

### For Static Import
```bash
# Copy templates to your project
cp artifacts/seed/templates/*.json your-project/public/scenarios/

# Reference in your component
import pricingTemplate from '/scenarios/pricing-change.seed42.json';
```

## 📋 Available Templates

### 1. Pricing Change Decision (`seed: 42`)
- **File**: `pricing-change.seed42.json`
- **Scenario**: 20% price increase evaluation
- **Complexity**: 4 options, financial impact analysis
- **Domain**: SaaS pricing strategy
- **Demo Use**: Shows financial trade-offs and customer impact

### 2. Feature Launch Strategy (`seed: 17`)
- **File**: `feature-launch.seed17.json`
- **Scenario**: Collaboration workspace rollout
- **Complexity**: 4 rollout strategies, performance constraints
- **Domain**: Product management
- **Demo Use**: Demonstrates phased decision making

### 3. Build vs Buy Decision (`seed: 7`)
- **File**: `build-vs-buy.seed7.json`
- **Scenario**: Analytics platform investment
- **Complexity**: 4 approaches, TCO analysis
- **Domain**: Technology strategy
- **Demo Use**: Classic engineering decision with cost/benefit

## 🔧 Template Structure

Each template follows this schema:
```json
{
  "template_name": "Human-readable name",
  "seed": 42,
  "description": "Brief explanation",
  "created_for": "windsurf_poc_v0.1.0",
  "scenario": {
    "title": "Decision question",
    "context": "Background information",
    "stakeholders": ["Role1", "Role2"],
    "options": [
      {
        "id": "unique_id",
        "name": "Option name",
        "pros": ["Advantage 1", "Advantage 2"],
        "cons": ["Disadvantage 1", "Disadvantage 2"],
        "cost_estimate": "Financial impact",
        "timeline": "Time to implement",
        "risk_level": "Low|Medium|High"
      }
    ],
    "constraints": {
      "budget": "Financial limits",
      "timeline": "Time constraints",
      "compliance": "Regulatory requirements"
    },
    "success_metrics": [
      "Measurable outcome 1",
      "Measurable outcome 2"
    ]
  }
}
```

## 🎨 Windsurf Integration Patterns

### Loading Template Data
```javascript
class ScenarioLoader {
  static async loadTemplate(templateName) {
    const response = await fetch(`/artifacts/seed/templates/${templateName}.json`);
    if (!response.ok) throw new Error(`Template ${templateName} not found`);
    return response.json();
  }

  static extractSeed(template) {
    return template.seed;
  }

  static formatTitle(template) {
    return template.scenario.title;
  }
}

// Usage
const template = await ScenarioLoader.loadTemplate('pricing-change.seed42');
const seed = ScenarioLoader.extractSeed(template); // 42
```

### Deterministic Demo Flow
```javascript
// 1. Load template for consistent demo
const template = await ScenarioLoader.loadTemplate('pricing-change.seed42');

// 2. Start analysis with template seed
const analysisStream = new EventSource(
  `/stream?route=critique&seed=${template.seed}&scenarioId=demo`
);

// 3. Expected deterministic behaviour
analysisStream.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'token') {
    // Same seed = same token sequence
    console.log('Deterministic token:', data.text);
  }
};
```

### UI Population Helper
```javascript
function populateUIFromTemplate(template) {
  return {
    title: template.scenario.title,
    context: template.scenario.context,
    options: template.scenario.options.map(opt => ({
      id: opt.id,
      label: opt.name,
      summary: `${opt.timeline} • ${opt.risk_level} risk`
    })),
    stakeholders: template.scenario.stakeholders,
    seed: template.seed
  };
}
```

## 🧪 Testing with Templates

### Deterministic Validation
```bash
# Test same seed produces identical results
curl -N "http://localhost:3001/stream?route=critique&seed=42&scenarioId=pricing"
# Should produce identical token sequence every time
```

### Template Validation
```javascript
// Validate template structure
function validateTemplate(template) {
  const required = ['template_name', 'seed', 'scenario'];
  const missing = required.filter(field => !template[field]);
  if (missing.length > 0) {
    throw new Error(`Missing fields: ${missing.join(', ')}`);
  }

  if (template.scenario.options.length < 2) {
    throw new Error('Template must have at least 2 options');
  }

  return true;
}
```

## 🔍 Demo Script Suggestions

### 5-Minute Demo Flow
1. **Load pricing template** - "Let's look at a pricing decision..."
2. **Show deterministic analysis** - "With seed 42, we get consistent results"
3. **Demonstrate real-time streaming** - "Watch the analysis unfold token by token"
4. **Test cancel/resume** - "We can pause and continue seamlessly"
5. **View final report** - "Here's the structured recommendation"

### Customisation Examples
```javascript
// Modify template for specific demo needs
const customTemplate = {
  ...pricingTemplate,
  scenario: {
    ...pricingTemplate.scenario,
    title: "Should Acme Corp increase pricing by 20%?", // Personalised
    context: pricingTemplate.scenario.context.replace('Our', 'Acme Corp\'s')
  }
};
```

## 📦 Integration Checklist

- [ ] Templates accessible via HTTP (not file://)
- [ ] CORS configured for your development origin
- [ ] Seed values passed correctly to `/stream` endpoint
- [ ] Template JSON structure validated
- [ ] Deterministic behaviour verified (same seed = same output)
- [ ] Error handling for missing templates
- [ ] UI populated from template data

## 🔒 Security Notes

- **No PII**: Templates contain no personal or sensitive data
- **Public Safe**: All scenarios are generic business decisions
- **Deterministic**: Same seed always produces same analysis
- **Stateless**: Templates don't require authentication

---

**Created for**: Windsurf Live-Swap Integration v0.1.0
**Compatibility**: All pilot deployment endpoints
**Update Policy**: Templates are immutable - create new versions for changes