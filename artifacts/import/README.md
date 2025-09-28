# Import Dry-Run API

Convert external data sources (CSV, Google Sheets, Jira) into scenario format **without persisting data**.

## Feature Flag

**Default: OFF** - Set `IMPORT_ENABLE=1` to enable

## API Endpoint

```
POST /import/dry-run
```

Returns schema: `import-dryrun.v1`

## Request Formats

### CSV Import

```json
{
  "csv": "title,description,weight\nOption A,First choice,0.8\nOption B,Second choice,0.6",
  "mapping": {
    "title": "title",
    "description": "description",
    "weight": "weight"
  }
}
```

### Google Sheets Import (Placeholder)

```json
{
  "googleSheet": {
    "sheetId": "1abc123def456",
    "range": "A1:Z100"
  },
  "mapping": {
    "title": "Column A",
    "description": "Column B",
    "weight": "Column C"
  }
}
```

### Jira Import (Placeholder)

```json
{
  "jira": {
    "jql": "project = MYPROJ AND status = Open"
  },
  "mapping": {
    "title": "summary",
    "description": "description",
    "weight": "priority"
  }
}
```

## Response Schema

```json
{
  "schema": "import-dryrun.v1",
  "summary": {
    "nodes": 2,
    "links": 0,
    "warnings": ["Missing weight value in row 3, using default"],
    "errors": []
  },
  "scenarioPreview": {
    "scenarioId": "csv_import_1234567890",
    "title": "CSV Import Preview",
    "description": "Imported 2 items from CSV",
    "nodes": [
      {
        "id": "node_1",
        "title": "Option A",
        "description": "First choice",
        "weight": 0.8
      }
    ],
    "links": []
  },
  "mappingEcho": {
    "title": "title",
    "description": "description",
    "weight": "weight"
  }
}
```

## CSV Header Examples

### Basic Decision Options
```csv
title,description,weight
Option A,First choice,0.8
Option B,Second choice,0.6
Option C,Third choice,0.4
```

### With Custom IDs
```csv
id,name,desc,priority
opt-1,Option A,First choice,high
opt-2,Option B,Second choice,medium
opt-3,Option C,Third choice,low
```

### Decision Criteria
```csv
criterion,description,importance
Cost,Financial impact,0.9
Time,Implementation time,0.7
Risk,Technical risk,0.8
```

## Mapping Configuration

The `mapping` object defines how CSV columns map to scenario fields:

```json
{
  "title": "name",        // Required: column for node titles
  "description": "desc",  // Optional: column for descriptions
  "weight": "priority",   // Optional: column for weights (0.0-1.0)
  "id": "custom_id"       // Optional: column for custom IDs
}
```

## CLI Usage

```bash
# Basic CSV import
node scripts/import-dryrun.mjs csv --csv data.csv --mapping artifacts/import/mappings/basic.json

# With output file
node scripts/import-dryrun.mjs csv --csv data.csv --mapping basic.json --output result.json

# Google Sheets (placeholder)
node scripts/import-dryrun.mjs sheets --sheet-id 1abc123 --range A1:Z100 --mapping basic.json

# Jira (placeholder)
node scripts/import-dryrun.mjs jira --jql "project = PROJ" --mapping basic.json
```

## curl Examples

```bash
# CSV import
curl -X POST http://localhost:3001/import/dry-run \
  -H "Content-Type: application/json" \
  -d '{
    "csv": "title,weight\nOption A,0.8\nOption B,0.6",
    "mapping": {"title": "title", "weight": "weight"}
  }'

# Google Sheets import (placeholder)
curl -X POST http://localhost:3001/import/dry-run \
  -H "Content-Type: application/json" \
  -d '{
    "googleSheet": {"sheetId": "1abc123", "range": "A1:C10"},
    "mapping": {"title": "Column A", "description": "Column B"}
  }'
```

## Validation & Error Handling

### Warnings
- Missing weight values (defaults to 1.0)
- Missing optional fields
- Data type mismatches

### Errors
- Missing required title field
- Invalid CSV format
- Empty datasets
- Missing mapping configuration

## Implementation Notes

- **Read-only**: No data is persisted server-side
- **Validation**: Input validation with helpful error messages
- **Preview**: Returns converted scenario structure
- **Extensible**: Designed for future Google Sheets/Jira integration
- **Secure**: Uses standard security headers and request validation

## File Locations

- **API Implementation**: `src/lib/import-api.ts`
- **CLI Tool**: `scripts/import-dryrun.mjs`
- **Sample Mappings**: `artifacts/import/mappings/`
- **Sample Data**: `artifacts/import/samples/`