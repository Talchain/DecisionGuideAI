# Share Link Examples

**Purpose**: Compressed template encoding/decoding examples with usage instructions

## 🔗 Example Share Links

### 1. Simple Pricing Decision
**Template**: Basic 2-option pricing strategy
**Compressed Data**:
```
eJyrVkrLTSlJLbJSUkorys9VqkxVsjIyNNJRMiwpzS_SqCyISMxTKLEystJRykvMTcylnJzkssSSk_NZ5JzZmk-B5U5iUEY6r1aP_Qr1C4RfOrkKe4A
```

**Usage**:
```bash
# Decode the share link
curl "http://localhost:3001/templates/decode?data=eJyrVkrLTSlJLbJSUkorys9VqkxVsjIyNNJRMiwpzS_SqCyISMxTKLEystJRykvMTcylnJzkssSSk_NZ5JzZmk-B5U5iUEY6r1aP_Qr1C4RfOrkKe4A"
```

**Decoded Template**:
```json
{
  "template": {
    "template_name": "Simple Pricing Decision",
    "seed": 42,
    "description": "Basic pricing strategy comparison",
    "scenario": {
      "title": "Should we increase our subscription price by 15%?",
      "context": "Customer satisfaction is high (4.2/5) but costs have risen 12%",
      "stakeholders": ["Product", "Finance"],
      "options": [
        {
          "id": "increase_now",
          "name": "Increase price immediately",
          "pros": ["Quick revenue boost", "Aligns with costs"],
          "cons": ["Risk of churn", "Customer surprise"]
        },
        {
          "id": "gradual_increase",
          "name": "Gradual 15% increase over 6 months",
          "pros": ["Smoother transition", "Less churn risk"],
          "cons": ["Delayed revenue", "Complex communication"]
        }
      ],
      "constraints": {
        "budget": "No development cost",
        "timeline": "Decision needed by Q1"
      },
      "success_metrics": ["Churn rate <5%", "Revenue +10%"]
    }
  }
}
```

### 2. Feature Launch Strategy
**Template**: Multi-stakeholder feature rollout decision
**Compressed Data**:
```
eJydk8sOwiAQhh8k1EVZJ5WZaQlLWxsrbtjYZgEAQh9iDAgmlSdvK7JRuxWzIE0n-frb-sOV1.lvNZmVmVkJ6lSyLKCc5VyoRmZSJiykjKJcN2YE5FoqIzSHhHNWLLlzrkqZhpRu21KPRuE5hs
```

**Usage**:
```bash
curl -X GET "http://localhost:3001/templates/decode" \
  -G -d "data=eJydk8sOwiAQhx8k1EVZJ5WZaQlLWxsrbtjYZgEAQh9iDAgmlSdvK7JRuxWzIE0n-frb-sOV1.lvNZmVmVkJ6lSyLKCc5VyoRmZSJiykjKJcN2YE5FoqIzSHhHNWLLlzrkqZhpRu21KPRuE5hs"
```

### 3. Build vs Buy Analysis
**Template**: Technology investment decision with TCO analysis
**Compressed Data**:
```
eJzVk8sOwRAQ_E5CExJjMzPWhLSy9kGtxNhYgRDyEURAQiRP4lrJRm2V0IE0m-Trb-sOK1.lvNZmVmZlJ6lSyLKCc5VyoRmZSJyykjKJcN2YE5FqKgNl-AhqJJYALlJJgGhHGNY1KbJRs
```

## 🛠️ Creating Your Own Share Links

### Step 1: Encode Template
```bash
curl -X POST http://localhost:3001/templates/encode \
  -H "Content-Type: application/json" \
  -d '{
    "template": {
      "template_name": "My Decision",
      "seed": 123,
      "scenario": {
        "title": "Your decision question here",
        "context": "Background and context",
        "options": [
          {
            "id": "option_a",
            "name": "First Option",
            "pros": ["Advantage 1", "Advantage 2"],
            "cons": ["Disadvantage 1"]
          },
          {
            "id": "option_b",
            "name": "Second Option",
            "pros": ["Different advantage"],
            "cons": ["Different disadvantage", "Another con"]
          }
        ]
      }
    }
  }'
```

**Response**:
```json
{
  "data": "eJyrVkrLTSlJLbJSUkorys9VqkxVsjIyNNJRMiwpzS..."
}
```

### Step 2: Share the Link
Create shareable URLs:
```
https://your-app.com/scenario?data=eJyrVkrLTSlJLbJSUkorys9VqkxVsjIyNNJRMiwpzS...
```

### Step 3: Decode on Load
```javascript
// In your application
const urlParams = new URLSearchParams(window.location.search);
const shareData = urlParams.get('data');

if (shareData) {
  const response = await fetch(`/templates/decode?data=${encodeURIComponent(shareData)}`);
  const { template } = await response.json();

  // Load template into your UI
  loadScenario(template);
}
```

## 📐 Size Limits and Optimisation

### Current Limits
- **Compressed Size**: 2KB maximum
- **Node Count**: 12 nodes maximum (options + stakeholders + constraints + metrics)
- **Base64 Encoding**: ~33% larger than compressed binary

### Optimisation Tips

#### 1. Minimise Text Content
```json
// Instead of:
{
  "name": "Implement comprehensive customer relationship management system",
  "description": "Deploy a full-featured CRM with advanced analytics and reporting"
}

// Use:
{
  "name": "Implement CRM system",
  "description": "Deploy CRM with analytics"
}
```

#### 2. Remove Optional Fields
```json
// Include only essential fields
{
  "template": {
    "scenario": {
      "title": "Required title",
      "options": [
        { "id": "a", "name": "Option A" }, // Minimal structure
        { "id": "b", "name": "Option B" }
      ]
    }
  }
}
```

#### 3. Use Abbreviations
```json
{
  "stakeholders": ["Eng", "PM", "UX"], // Instead of full titles
  "constraints": {
    "budget": "£100k", // Instead of "Budget constraint: £100,000"
    "time": "Q1" // Instead of "Timeline: First quarter 2024"
  }
}
```

### Size Estimation
```javascript
function estimateCompressedSize(template) {
  const jsonString = JSON.stringify(template);
  const uncompressedSize = new Blob([jsonString]).size;

  // Rough estimate: compression typically achieves 30-70% reduction
  const estimatedCompressed = uncompressedSize * 0.5;
  const estimatedBase64 = estimatedCompressed * 1.33;

  return {
    uncompressed: uncompressedSize,
    estimatedCompressed: Math.round(estimatedCompressed),
    estimatedBase64: Math.round(estimatedBase64),
    withinLimit: estimatedBase64 <= 2048
  };
}
```

## 🔄 Testing and Validation

### Round-Trip Test
```bash
# 1. Encode your template
ENCODED=$(curl -s -X POST http://localhost:3001/templates/encode \
  -H "Content-Type: application/json" \
  -d @your-template.json | jq -r '.data')

# 2. Decode it back
curl -s "http://localhost:3001/templates/decode?data=$ENCODED" | jq .

# 3. Verify it matches your original template
```

### Browser Testing
```javascript
// Test in browser console
async function testShareLink(template) {
  // Encode
  const encodeResponse = await fetch('/templates/encode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template })
  });

  const { data } = await encodeResponse.json();
  console.log('Encoded data length:', data.length);

  // Decode
  const decodeResponse = await fetch(`/templates/decode?data=${encodeURIComponent(data)}`);
  const decoded = await decodeResponse.json();

  // Compare
  const matches = JSON.stringify(template) === JSON.stringify(decoded.template);
  console.log('Round-trip successful:', matches);

  return { encoded: data, decoded: decoded.template, matches };
}
```

## ⚠️ Error Handling

### Common Issues

#### Template Too Large
```json
{
  "type": "BAD_INPUT",
  "message": "Compressed payload exceeds 2048 byte limit",
  "timestamp": "2024-09-27T10:00:00.000Z"
}
```
**Solution**: Reduce template size using optimisation tips above

#### Invalid Template Structure
```json
{
  "type": "BAD_INPUT",
  "message": "Template must contain a scenario",
  "timestamp": "2024-09-27T10:00:00.000Z"
}
```
**Solution**: Ensure template includes required `scenario` object with `title` and `options`

#### Corrupted Share Data
```json
{
  "type": "BAD_INPUT",
  "message": "Invalid compressed data format",
  "timestamp": "2024-09-27T10:00:00.000Z"
}
```
**Solution**: Regenerate the share link from original template

### Error Handling Code
```javascript
async function safeDecodeShareLink(shareData) {
  try {
    const response = await fetch(`/templates/decode?data=${encodeURIComponent(shareData)}`);

    if (!response.ok) {
      const error = await response.json();

      switch (error.type) {
        case 'BAD_INPUT':
          return { success: false, error: 'invalid_link', message: 'Share link is corrupted or invalid' };
        default:
          return { success: false, error: 'decode_failed', message: 'Could not decode share link' };
      }
    }

    const { template } = await response.json();
    return { success: true, template };

  } catch (error) {
    return { success: false, error: 'network_error', message: 'Could not contact server' };
  }
}
```

## 🔗 Integration Examples

### React Component
```jsx
function ShareLinkHandler() {
  const [template, setTemplate] = useState(null);
  const [shareUrl, setShareUrl] = useState('');

  // Generate share link
  const generateShareLink = async (template) => {
    const response = await fetch('/templates/encode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template })
    });

    const { data } = await response.json();
    const url = `${window.location.origin}/scenario?data=${encodeURIComponent(data)}`;
    setShareUrl(url);
  };

  // Load from share link
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareData = urlParams.get('data');

    if (shareData) {
      safeDecodeShareLink(shareData).then(result => {
        if (result.success) {
          setTemplate(result.template);
        }
      });
    }
  }, []);

  return (
    <div>
      {template && <ScenarioEditor template={template} />}
      {shareUrl && <ShareDialog url={shareUrl} />}
    </div>
  );
}
```

---

**Compression**: Base64 + Deflate
**Size Limit**: 2KB compressed
**Node Limit**: 12 complexity nodes
**Format**: URL-safe base64 encoding