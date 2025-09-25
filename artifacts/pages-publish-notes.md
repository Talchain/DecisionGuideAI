# GitHub Pages Publisher

A GitHub Action workflow for publishing safe subsets of static artefacts to GitHub Pages.

## Usage

### Manual Trigger

1. Go to **Actions** → **GitHub Pages Publisher** in the GitHub repository
2. Click **Run workflow**
3. Choose your options:
   - **publish**: `false` (default) for dry-run, `true` to actually publish
   - **subset**: `demo` (default) or `all-safe`

### Dry Run (Default)

```bash
# This will list files that would be published without actually publishing
publish: false
subset: demo
```

Output will show:
- List of files that would be published
- File sizes
- Total count and size

### Publishing

```bash
# Actually publish to GitHub Pages
publish: true
subset: demo  # or all-safe
```

## File Subsets

### Demo Subset (default)
Safe demonstration files only:
- `artifacts/start-here.html`
- `artifacts/index.html`
- `artifacts/sarb-explorer.html`
- `artifacts/experiments/index.html`
- `artifacts/transcripts/framework-test.html`
- `artifacts/samples/sample-report.json`
- `artifacts/ui-viewmodels/` (directory)
- `artifacts/types/README.md`

### All-Safe Subset
Broader set of safe files:
- All HTML files (`artifacts/*.html`)
- All Markdown files (`artifacts/*.md`)
- `artifacts/experiments/` (directory)
- `artifacts/transcripts/` (directory)
- `artifacts/ui-viewmodels/` (directory)
- `artifacts/ui-copy/` (directory)
- `artifacts/types/` (directory)
- `artifacts/samples/` (directory)

## Safety Features

### Excluded by Design
- Raw datasets
- API keys or secrets
- Personal identifiable information (PII)
- Large bundles containing sensitive data
- Production configuration files

### Demo Banner
All published HTML files automatically get a demo banner:
```html
🚀 Demo artefacts only — no personal data
```

This clearly identifies the content as demonstration-only.

## Security Notes

- **Default OFF**: Both `publish` and subset selection require explicit manual input
- **No automatic triggers**: Only manual workflow dispatch
- **Safe subsets**: Pre-defined file patterns exclude sensitive data
- **Banner injection**: Automatic demo labeling for all HTML content
- **Dry-run first**: Default behavior shows what would be published

## Examples

### Check what demo files would be published
```
publish: false (default)
subset: demo (default)
```

### Publish demo subset to GitHub Pages
```
publish: true
subset: demo
```

### Dry-run all-safe subset
```
publish: false
subset: all-safe
```

### Publish all-safe subset
```
publish: true
subset: all-safe
```

## Workflow Details

- **Permissions**: Minimal required (contents:read, pages:write, id-token:write)
- **Concurrency**: Single pages deployment at a time
- **Environment**: github-pages environment with protection rules
- **Artifacts**: Uses GitHub's standard pages upload/deploy actions