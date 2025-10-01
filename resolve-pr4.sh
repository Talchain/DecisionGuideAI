#!/bin/bash
set -e

echo "Step 1: Fetch and checkout PR branch"
git fetch origin
git checkout chore/restore-gha-and-unique-artifacts
git pull origin chore/restore-gha-and-unique-artifacts

echo "Step 2: Merge main"
git merge origin/main || echo "Conflicts detected - will resolve"

echo "Step 3: Keep PR's workflow files and .gitignore"
git checkout --ours .github/workflows/ui-evidence-selftest.yml 2>/dev/null || true
git checkout --ours .github/workflows/compose-evidence.yml 2>/dev/null || true
git checkout --ours .gitignore 2>/dev/null || true

echo "Step 4: Keep main's evidence if conflicts exist"
git checkout --theirs docs/evidence/ 2>/dev/null || true
git checkout --theirs evidence/ 2>/dev/null || true

echo "Step 5: Stage and commit resolution"
git add .
git commit -m "Merge main into PR #4: keep workflows from PR, evidence from main" || echo "No conflicts to commit"

echo "Step 6: Push"
git push origin chore/restore-gha-and-unique-artifacts

echo "Step 7: Merge PR"
gh pr merge 4 --squash --delete-branch

echo "Step 8: Get merge commit SHA"
git fetch origin main
git rev-parse origin/main
