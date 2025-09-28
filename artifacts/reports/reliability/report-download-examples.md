# Report Download Examples

## CSV Report Download with Content-Disposition

### Basic Report Download
```bash
curl -i "http://localhost:3001/export/report.csv?runId=run-abc123" \
  -H "Accept: text/csv"
```

**Expected Response Headers:**
```http
HTTP/1.1 200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="report_run-abc123_seed-def456_v0.1.0_2025-09-28.csv"
Cache-Control: no-store
```

**Expected Response Body:**
```csv
run_id,scenario_id,seed,title,option_id,option_name,option_score,option_description,primary_recommendation,confidence,currency,timestamp,version
run-abc123,market-entry,def456,Market Entry Decision Analysis,opt-1,Proceed with pilot,0.85,Launch pilot program in target market,Proceed with pilot program,0.85,USD,2025-09-28T12:30:14.824Z,v0.1.0
run-abc123,market-entry,def456,Market Entry Decision Analysis,opt-2,Wait and observe,0.45,Monitor market conditions for 6 months,Proceed with pilot program,0.85,USD,2025-09-28T12:30:14.824Z,v0.1.0
```

### Save to File with Original Filename
```bash
# Extract filename from Content-Disposition header and save
curl -OJ "http://localhost:3001/export/report.csv?runId=run-abc123"

# Alternative: Parse header manually and save with custom name
FILENAME=$(curl -sI "http://localhost:3001/export/report.csv?runId=run-abc123" | \
  grep -i "content-disposition:" | \
  sed 's/.*filename="\([^"]*\)".*/\1/')

echo "Downloading as: $FILENAME"
curl "http://localhost:3001/export/report.csv?runId=run-abc123" -o "$FILENAME"
```

### Browser-Compatible Download Link
```html
<!-- Direct download link that triggers browser download -->
<a href="http://localhost:3001/export/report.csv?runId=run-abc123"
   download="analysis-report.csv">
   Download Report
</a>
```

### Batch Download Script
```bash
#!/bin/bash
# Download multiple reports with proper filenames

RUN_IDS=("run-123" "run-456" "run-789")

for RUN_ID in "${RUN_IDS[@]}"; do
  echo "Downloading report for $RUN_ID..."

  # Get the suggested filename from Content-Disposition
  FILENAME=$(curl -sI "http://localhost:3001/export/report.csv?runId=$RUN_ID" | \
    grep -i "content-disposition:" | \
    sed 's/.*filename="\([^"]*\)".*/\1/')

  if [ -n "$FILENAME" ]; then
    curl -s "http://localhost:3001/export/report.csv?runId=$RUN_ID" -o "$FILENAME"
    echo "  Saved as: $FILENAME"
  else
    echo "  Failed to get filename for $RUN_ID"
  fi
done
```

### Handling Errors
```bash
# Check for error responses before attempting download
RESPONSE=$(curl -sI "http://localhost:3001/export/report.csv?runId=invalid-run")

if echo "$RESPONSE" | grep -q "HTTP/1.1 404"; then
  echo "Report not found"
elif echo "$RESPONSE" | grep -q "HTTP/1.1 400"; then
  echo "Bad request - check runId parameter"
elif echo "$RESPONSE" | grep -q "HTTP/1.1 200"; then
  echo "Report available for download"
  curl -OJ "http://localhost:3001/export/report.csv?runId=valid-run"
else
  echo "Unexpected response"
fi
```

## Content-Disposition Header Details

The `Content-Disposition` header follows RFC 6266 for proper file downloads:

- **Format**: `attachment; filename="<generated-filename>"`
- **Filename Pattern**: `{type}_{runId}_{seed}_{version}_{date}.csv`
- **Example**: `report_run-abc123_seed-def456_v0.1.0_2025-09-28.csv`

### Filename Components:
- `report`: File type identifier
- `run-abc123`: Unique run identifier
- `seed-def456`: Deterministic seed for reproducibility
- `v0.1.0`: Version of the export format
- `2025-09-28`: Date of export (YYYY-MM-DD)

This ensures downloaded files have meaningful, unique names that include all relevant metadata for traceability and organization.