# Scenario Snapshots & Evidence Packs

**Purpose**: ZIP bundles containing complete scenario execution evidence for audit and compliance

## 🎯 Quick Start (1 minute)

### Download Single Run Snapshot
```bash
# Get a runId first
curl "http://localhost:3001/runs/lookup?scenarioId=pricing-v1&seed=42"
# Returns: {"runId": "run_pricing-v1_42_1696000000000", "source": "new"}

# Download snapshot ZIP
curl -o snapshot.zip "http://localhost:3001/runs/run_pricing-v1_42_1696000000000/snapshot"
```

### Compare Snapshot (Two Scenarios)
```bash
curl -X POST "http://localhost:3001/compare/snapshot" \
  -H "Content-Type: application/json" \
  -d '{
    "left": {"scenarioId": "pricing-conservative", "seed": 42},
    "right": {"scenarioId": "pricing-aggressive", "seed": 42}
  }' \
  --output compare.zip
```

## 📦 ZIP Bundle Contents

### Single Run Snapshot
Each snapshot ZIP contains exactly these files:

| File | Content | Purpose |
|------|---------|---------|
| `scenario.json` | Original scenario as executed | Template verification |
| `seed.txt` | Deterministic seed value | Reproducibility |
| `report.json` | Complete Report v1 with `meta.seed` | Decision analysis |
| `stream.ndjson` | SSE events transcript | Execution audit trail |
| `timings.json` | TTFF and performance metrics | Performance evidence |
| `provenance.json` | Version, commit SHA, timestamp | Build traceability |

### Compare Snapshot
Compare snapshots include all single-run files plus:

| File | Content | Purpose |
|------|---------|---------|
| `left_*` | All files for left scenario | Left side evidence |
| `right_*` | All files for right scenario | Right side evidence |
| `compare.json` | Complete compare.v1 result | Comparison analysis |
| `delta.csv` | CSV summary of differences | Stakeholder reporting |

## 🔧 Integration Examples

### JavaScript/Node.js
```javascript
async function downloadSnapshot(runId) {
  const response = await fetch(`/runs/${runId}/snapshot`);

  if (!response.ok) {
    throw new Error(`Snapshot failed: ${response.status}`);
  }

  const blob = await response.blob();
  const filename = response.headers.get('Content-Disposition')
    .match(/filename="(.+)"/)[1];

  // Save or process the ZIP file
  return { blob, filename };
}

// Usage
const { blob, filename } = await downloadSnapshot('run_pricing-v1_42_1696000000000');
console.log(`Downloaded: ${filename}`);
```

### cURL Examples
```bash
# Download with automatic filename
curl -OJ "http://localhost:3001/runs/run_abc_42_1696000000000/snapshot"

# Download compare snapshot
curl -X POST "http://localhost:3001/compare/snapshot" \
  -H "Content-Type: application/json" \
  -d '{"left":{"scenarioId":"A","seed":42},"right":{"scenarioId":"B","seed":42}}' \
  -o "compare_A_vs_B.zip"

# Check if run exists before downloading
if curl -sf "http://localhost:3001/runs/lookup?scenarioId=test&seed=42" > /dev/null; then
  echo "Run exists, downloading snapshot..."
else
  echo "Run not found"
fi
```

### Python
```python
import requests
import json

def download_snapshot(run_id, output_path=None):
    response = requests.get(f'http://localhost:3001/runs/{run_id}/snapshot')
    response.raise_for_status()

    # Extract filename from Content-Disposition header
    content_disposition = response.headers.get('Content-Disposition', '')
    filename = content_disposition.split('filename="')[1].split('"')[0] if 'filename=' in content_disposition else f'{run_id}.zip'

    output_path = output_path or filename

    with open(output_path, 'wb') as f:
        f.write(response.content)

    return output_path

# Usage
filepath = download_snapshot('run_pricing-v1_42_1696000000000')
print(f'Snapshot saved to: {filepath}')
```

## 📁 Local Storage

During local development, snapshots are also stored under:
```
artifacts/snapshots/
├── run_pricing-v1_42_1696000000000.zip
├── compare_conservative-vs-aggressive_42_1696000000001.zip
└── ...
```

This enables:
- **Audit trails**: Evidence of all executions
- **Compliance**: Meeting regulatory requirements
- **Debugging**: Complete execution context for issues
- **Reproducibility**: Everything needed to replay scenarios

## ⚡ Performance Notes

- **ZIP Compression**: Uses deflate for ~70% size reduction
- **Memory Efficient**: Streams large snapshots without buffering
- **Filename Convention**: Includes seed and version for easy sorting
- **No Caching**: Fresh snapshots always generated (Cache-Control: no-store)

## 🔍 Extracting ZIP Contents

### Command Line
```bash
# Extract to see contents
unzip snapshot_run_pricing-v1_42_seed-42_v0.1.0.zip

# List contents without extracting
unzip -l snapshot.zip

# Extract specific file
unzip -j snapshot.zip scenario.json
```

### Python
```python
import zipfile
import json

with zipfile.ZipFile('snapshot.zip', 'r') as zip_ref:
    # Extract all files
    zip_ref.extractall('snapshot_contents/')

    # Read specific file
    with zip_ref.open('report.json') as report_file:
        report = json.load(report_file)
        print(f"Decision: {report['decision']['title']}")
        print(f"Confidence: {report['analysis']['confidence']}")
```

## 🚨 Error Handling

### Common Errors
```bash
# Run not found
curl "http://localhost:3001/runs/invalid-run/snapshot"
# Response: 404 {"type": "BAD_INPUT", "message": "Run invalid-run not found"}

# Missing scenarios in compare
curl -X POST "http://localhost:3001/compare/snapshot" -d '{}'
# Response: 400 {"type": "BAD_INPUT", "message": "Both left and right scenarios required"}
```

### Robust Download Pattern
```javascript
async function safeDownloadSnapshot(runId) {
  try {
    const response = await fetch(`/runs/${runId}/snapshot`);

    if (response.status === 404) {
      return { success: false, error: 'run_not_found' };
    }

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.type, message: error.message };
    }

    const blob = await response.blob();
    return { success: true, blob, size: blob.size };

  } catch (error) {
    return { success: false, error: 'network_error', message: error.message };
  }
}
```

## 🔗 Related Endpoints

- **GET /runs/lookup**: Find runId for scenario + seed
- **GET /runs/{runId}/events**: SSE transcript only (JSON)
- **GET /export/report.csv**: CSV export instead of ZIP
- **POST /compare**: Live comparison (no ZIP)

---

**Bundle Format**: ZIP with deflate compression
**Filename Pattern**: `{type}_{runId/scenarios}_seed-{seed}_v{version}_{date}.zip`
**Storage**: Local artifacts/ during development
**Schema**: All Report v1 compatible with `"schema":"report.v1"`