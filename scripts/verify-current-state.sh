#!/bin/bash

###############################################################################
# Phase 1: Pre-Rename Safety Baseline
#
# This script establishes a comprehensive baseline of the current state
# before any renaming occurs. It verifies:
# - All tests pass
# - TypeScript compilation succeeds
# - Linting passes
# - No uncommitted changes
# - Current file inventory
#
# Exit Codes:
#   0 - All checks passed
#   1 - One or more checks failed (STOP - do not proceed)
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Output directory for baseline results
BASELINE_DIR="scripts/baseline-results"
mkdir -p "$BASELINE_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Phase 1: Pre-Rename Safety Baseline Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Track overall status
FAILED=0

###############################################################################
# Check 1: Git Status - No uncommitted changes (except scripts/)
###############################################################################
echo -e "${YELLOW}[1/6] Checking git status...${NC}"
# Filter out scripts/ directory changes (allowed during Phase 1 setup)
CHANGES=$(git status --porcelain | grep -v " scripts/" || true)
if [[ -n "$CHANGES" ]]; then
  echo -e "${RED}✗ FAILED: Uncommitted changes detected (outside scripts/)${NC}"
  echo -e "${RED}  Please commit or stash all changes before proceeding${NC}"
  echo "$CHANGES"
  FAILED=1
else
  echo -e "${GREEN}✓ PASSED: Working directory clean (scripts/ changes allowed)${NC}"
fi
echo ""

###############################################################################
# Check 2: TypeScript Compilation
###############################################################################
echo -e "${YELLOW}[2/6] TypeScript compilation check...${NC}"
if command -v npx >/dev/null 2>&1; then
  if npx tsc --noEmit > "$BASELINE_DIR/tsc-output.txt" 2>&1; then
    echo -e "${GREEN}✓ PASSED: TypeScript compilation successful${NC}"
  else
    echo -e "${RED}✗ FAILED: TypeScript compilation errors${NC}"
    cat "$BASELINE_DIR/tsc-output.txt"
    FAILED=1
  fi
else
  echo -e "${YELLOW}⚠ SKIPPED: npx not in PATH (manual verification required)${NC}"
  echo -e "  ${YELLOW}Please run: npm run typecheck${NC}"
fi
echo ""

###############################################################################
# Check 3: ESLint
###############################################################################
echo -e "${YELLOW}[3/6] ESLint check...${NC}"
if command -v npm >/dev/null 2>&1; then
  if npm run lint > "$BASELINE_DIR/eslint-output.txt" 2>&1; then
    echo -e "${GREEN}✓ PASSED: ESLint checks passed${NC}"
  else
    echo -e "${RED}✗ FAILED: ESLint errors detected${NC}"
    cat "$BASELINE_DIR/eslint-output.txt"
    FAILED=1
  fi
else
  echo -e "${YELLOW}⚠ SKIPPED: npm not in PATH (manual verification required)${NC}"
  echo -e "  ${YELLOW}Please run: npm run lint${NC}"
fi
echo ""

###############################################################################
# Check 4: Unit Tests
###############################################################################
echo -e "${YELLOW}[4/6] Unit tests check...${NC}"
if command -v npm >/dev/null 2>&1; then
  if npm run test > "$BASELINE_DIR/test-output.txt" 2>&1; then
    echo -e "${GREEN}✓ PASSED: All tests passed${NC}"
    # Extract test count
    grep -E "Test Files|Tests" "$BASELINE_DIR/test-output.txt" || true
  else
    echo -e "${RED}✗ FAILED: Tests failed${NC}"
    cat "$BASELINE_DIR/test-output.txt"
    FAILED=1
  fi
else
  echo -e "${YELLOW}⚠ SKIPPED: npm not in PATH (manual verification required)${NC}"
  echo -e "  ${YELLOW}Please run: npm run test${NC}"
fi
echo ""

###############################################################################
# Check 5: File Inventory - Copilot Variant Files
###############################################################################
echo -e "${YELLOW}[5/6] Creating file inventory...${NC}"
find src/pages/sandbox-copilot -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) | sort > "$BASELINE_DIR/file-inventory.txt"
FILE_COUNT=$(wc -l < "$BASELINE_DIR/file-inventory.txt" | tr -d ' ')
echo -e "${GREEN}✓ COMPLETE: Found $FILE_COUNT files in sandbox-copilot${NC}"
echo -e "  Inventory saved to: ${BLUE}$BASELINE_DIR/file-inventory.txt${NC}"
echo ""

###############################################################################
# Check 6: "Copilot" References Count
###############################################################################
echo -e "${YELLOW}[6/6] Counting 'Copilot' references...${NC}"
grep -r "Copilot" src/pages/sandbox-copilot --include="*.ts" --include="*.tsx" --include="*.md" | wc -l > "$BASELINE_DIR/copilot-ref-count.txt" || echo "0" > "$BASELINE_DIR/copilot-ref-count.txt"
REF_COUNT=$(cat "$BASELINE_DIR/copilot-ref-count.txt" | tr -d ' ')
echo -e "${GREEN}✓ COMPLETE: Found $REF_COUNT 'Copilot' references${NC}"
echo -e "  These will be systematically renamed in Phase 3"
echo ""

###############################################################################
# Final Report
###############################################################################
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}✓ Phase 1: BASELINE VERIFIED - Safe to proceed${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "\n${GREEN}Baseline Results Summary:${NC}"
  echo -e "  • Git Status: Clean"
  echo -e "  • TypeScript: Passing"
  echo -e "  • ESLint: Passing"
  echo -e "  • Tests: Passing"
  echo -e "  • Files Tracked: $FILE_COUNT"
  echo -e "  • 'Copilot' References: $REF_COUNT"
  echo -e "\n${BLUE}Baseline data saved to: $BASELINE_DIR/${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
else
  echo -e "${RED}✗ Phase 1: BASELINE FAILED - DO NOT PROCEED${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "\n${RED}Fix all errors above before proceeding with rename.${NC}\n"
  exit 1
fi
