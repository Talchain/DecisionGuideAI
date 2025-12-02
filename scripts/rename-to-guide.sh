#!/bin/bash

###############################################################################
# Phase 3: Systematic Rename Execution (Copilot → Guide)
#
# This script performs the actual renaming from "Copilot" to "Guide" across
# the entire sandbox-copilot directory. It:
# - Renames all file references
# - Updates all code references
# - Updates all documentation
# - Preserves git history
#
# IMPORTANT: This script makes REAL CHANGES to your codebase.
# Only run after Phase 1 and Phase 2 have passed.
#
# Exit Codes:
#   0 - All renames successful
#   1 - Rename failed (manual intervention required)
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Output directory for rename tracking
RENAME_DIR="scripts/rename-results"
mkdir -p "$RENAME_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Phase 3: Systematic Rename Execution${NC}"
echo -e "${BLUE}  Copilot → Guide${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}⚠  WARNING: This will make REAL changes to your codebase!${NC}"
echo -e "${YELLOW}   Ensure Phase 1 and Phase 2 passed before proceeding.${NC}\n"

# Confirmation prompt
read -p "Continue with rename? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo -e "${RED}Rename cancelled by user.${NC}"
  exit 1
fi

echo -e "\n${BLUE}Starting rename process...${NC}\n"

# Track overall status
FAILED=0

###############################################################################
# Step 1: Update file contents (case-sensitive replacements)
###############################################################################
echo -e "${YELLOW}[1/5] Updating file contents...${NC}"

# Define replacement pairs
declare -a REPLACEMENTS=(
  "s/Copilot/Guide/g"
  "s/copilot/guide/g"
  "s/COPILOT/GUIDE/g"
)

# Find all text files in sandbox-copilot
find src/pages/sandbox-copilot -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.json" \) > "$RENAME_DIR/files-to-update.txt"

FILE_COUNT=$(wc -l < "$RENAME_DIR/files-to-update.txt" | tr -d ' ')
echo -e "  Updating $FILE_COUNT files..."

UPDATED=0
while IFS= read -r file; do
  # Create backup
  cp "$file" "$file.backup"

  # Apply all replacements
  for replacement in "${REPLACEMENTS[@]}"; do
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS sed syntax
      sed -i '' "$replacement" "$file"
    else
      # Linux sed syntax
      sed -i "$replacement" "$file"
    fi
  done

  # Check if file changed
  if ! diff -q "$file" "$file.backup" > /dev/null 2>&1; then
    echo "$file" >> "$RENAME_DIR/updated-files.txt"
    ((UPDATED++))
  fi

  # Remove backup
  rm "$file.backup"
done < "$RENAME_DIR/files-to-update.txt"

echo -e "${GREEN}✓ Updated $UPDATED files${NC}"
echo ""

###############################################################################
# Step 2: Rename directory structure
###############################################################################
echo -e "${YELLOW}[2/5] Renaming directory...${NC}"

if [[ -d "src/pages/sandbox-copilot" ]]; then
  git mv src/pages/sandbox-copilot src/pages/sandbox-guide
  echo -e "${GREEN}✓ Renamed: src/pages/sandbox-copilot → src/pages/sandbox-guide${NC}"
else
  echo -e "${RED}✗ Directory not found: src/pages/sandbox-copilot${NC}"
  FAILED=1
fi
echo ""

###############################################################################
# Step 3: Update route references in parent app
###############################################################################
echo -e "${YELLOW}[3/5] Updating route references...${NC}"

# Find potential route files
ROUTE_FILES=$(find src -maxdepth 2 -type f \( -name "App.tsx" -o -name "*route*.tsx" -o -name "*Route*.tsx" -o -name "router.tsx" \) 2>/dev/null || true)

if [[ -n "$ROUTE_FILES" ]]; then
  for file in $ROUTE_FILES; do
    if grep -q "sandbox.*copilot\|copilot" "$file" 2>/dev/null; then
      cp "$file" "$file.backup"

      # Update route paths
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/sandbox\/copilot/sandbox\/guide/g' "$file"
        sed -i '' 's/sandbox-copilot/sandbox-guide/g' "$file"
        sed -i '' 's/"copilot"/"guide"/g' "$file"
        sed -i '' "s/'copilot'/'guide'/g" "$file"
      else
        sed -i 's/sandbox\/copilot/sandbox\/guide/g' "$file"
        sed -i 's/sandbox-copilot/sandbox-guide/g' "$file"
        sed -i 's/"copilot"/"guide"/g' "$file"
        sed -i "s/'copilot'/'guide'/g" "$file"
      fi

      if ! diff -q "$file" "$file.backup" > /dev/null 2>&1; then
        echo -e "  Updated: $file"
      fi
      rm "$file.backup"
    fi
  done
  echo -e "${GREEN}✓ Route references updated${NC}"
else
  echo -e "${YELLOW}⚠ No route files found (may be dynamic routing)${NC}"
fi
echo ""

###############################################################################
# Step 4: Update package.json scripts
###############################################################################
echo -e "${YELLOW}[4/5] Updating package.json scripts...${NC}"

if [[ -f "package.json" ]]; then
  cp package.json package.json.backup

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's/dev:copilot/dev:guide/g' package.json
    sed -i '' 's/test:copilot/test:guide/g' package.json
    sed -i '' 's/lint:copilot/lint:guide/g' package.json
    sed -i '' 's/sandbox\/copilot/sandbox\/guide/g' package.json
    sed -i '' 's/sandbox-copilot/sandbox-guide/g' package.json
  else
    sed -i 's/dev:copilot/dev:guide/g' package.json
    sed -i 's/test:copilot/test:guide/g' package.json
    sed -i 's/lint:copilot/lint:guide/g' package.json
    sed -i 's/sandbox\/copilot/sandbox\/guide/g' package.json
    sed -i 's/sandbox-copilot/sandbox-guide/g' package.json
  fi

  if ! diff -q package.json package.json.backup > /dev/null 2>&1; then
    echo -e "${GREEN}✓ package.json updated${NC}"
  else
    echo -e "${YELLOW}⚠ No changes needed in package.json${NC}"
  fi
  rm package.json.backup
else
  echo -e "${YELLOW}⚠ package.json not found${NC}"
fi
echo ""

###############################################################################
# Step 5: Update ESLint config if exists
###############################################################################
echo -e "${YELLOW}[5/5] Updating ESLint config...${NC}"

if [[ -f ".eslintrc.copilot.json" ]]; then
  git mv .eslintrc.copilot.json .eslintrc.guide.json

  # Update references inside the file
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's/copilot/guide/g' .eslintrc.guide.json
    sed -i '' 's/Copilot/Guide/g' .eslintrc.guide.json
  else
    sed -i 's/copilot/guide/g' .eslintrc.guide.json
    sed -i 's/Copilot/Guide/g' .eslintrc.guide.json
  fi

  echo -e "${GREEN}✓ ESLint config renamed and updated${NC}"
else
  echo -e "${YELLOW}⚠ .eslintrc.copilot.json not found${NC}"
fi
echo ""

###############################################################################
# Final Report
###############################################################################
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}✓ Phase 3: RENAME COMPLETE${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "\n${GREEN}Rename Summary:${NC}"
  echo -e "  • Updated $UPDATED file contents"
  echo -e "  • Renamed directory: sandbox-copilot → sandbox-guide"
  echo -e "  • Updated route references"
  echo -e "  • Updated package.json scripts"
  echo -e "  • Updated ESLint config"
  echo -e "\n${YELLOW}NEXT STEPS:${NC}"
  echo -e "  1. Review changes: git status"
  echo -e "  2. Run Phase 4: ./scripts/verify-post-rename.sh"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
else
  echo -e "${RED}✗ Phase 3: RENAME FAILED${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "\n${RED}Manual intervention required.${NC}\n"
  exit 1
fi
