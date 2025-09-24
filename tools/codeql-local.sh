#!/bin/bash
# Local CodeQL runner for security analysis
# Downloads CodeQL CLI if needed and runs analysis locally
# Outputs SARIF file to artifacts/codeql-results.sarif

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts"
CODEQL_DIR="$PROJECT_ROOT/.codeql"
CODEQL_BIN="$CODEQL_DIR/codeql"

# Ensure artifacts directory exists
mkdir -p "$ARTIFACTS_DIR"

# Download CodeQL CLI if not present
if [ ! -f "$CODEQL_BIN" ]; then
    echo "Downloading CodeQL CLI..."
    mkdir -p "$CODEQL_DIR"
    cd "$CODEQL_DIR"

    # Detect platform
    if [[ "$OSTYPE" == "darwin"* ]]; then
        PLATFORM="osx64"
    elif [[ "$OSTYPE" == "linux"* ]]; then
        PLATFORM="linux64"
    else
        echo "Unsupported platform: $OSTYPE"
        exit 1
    fi

    # Download and extract latest CodeQL
    curl -L "https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-$PLATFORM.zip" -o codeql.zip
    unzip -q codeql.zip
    rm codeql.zip

    echo "CodeQL CLI installed to $CODEQL_BIN"
fi

cd "$PROJECT_ROOT"

echo "Creating CodeQL database..."
"$CODEQL_BIN" database create \
    --language=javascript \
    --source-root="$PROJECT_ROOT" \
    --exclude="**/node_modules/**" \
    --exclude="**/dist/**" \
    --exclude="**/build/**" \
    --exclude="**/coverage/**" \
    --exclude="**/artifacts/**" \
    --exclude="**/examples/**" \
    --exclude="**/tools/**" \
    --exclude="**/test-results/**" \
    "$ARTIFACTS_DIR/codeql-db" \
    --overwrite

echo "Running CodeQL analysis..."
"$CODEQL_BIN" database analyze \
    "$ARTIFACTS_DIR/codeql-db" \
    --format=sarif-latest \
    --output="$ARTIFACTS_DIR/codeql-results.sarif" \
    --download

echo "CodeQL analysis complete!"
echo "Results written to: $ARTIFACTS_DIR/codeql-results.sarif"
echo "Database created at: $ARTIFACTS_DIR/codeql-db"