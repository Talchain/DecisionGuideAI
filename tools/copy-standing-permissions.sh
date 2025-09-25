#!/bin/bash
# Helper script to print Claude's Standing Permissions + Autopilot Charter to stdout
# Usage: ./tools/copy-standing-permissions.sh

cat "$(dirname "$0")/../artifacts/claude-standing-permissions.md"