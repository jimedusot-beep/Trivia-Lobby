#!/usr/bin/env bash
# Safe, opt-in cleanup for branches attached to *merged* PRs.
# Default: dry-run. Never targets main, open-PR heads, or unmerged PR branches.
set -euo pipefail
MODE="${1:---dry-run}"
if [[ "$MODE" != "--dry-run" && "$MODE" != "--execute" ]]; then
  echo "Usage: bash script/cleanup-merged-branches.sh [--dry-run|--execute]" >&2
  exit 2
fi
REPO="jimedusot-beep/Trivia-Lobby"
command -v gh >/dev/null || { echo "Install GitHub CLI and run gh auth login." >&2; exit 1; }
command -v jq >/dev/null || { echo "Install jq before running this script." >&2; exit 1; }
gh auth status >/dev/null
open_heads="$(gh api "repos/$REPO/pulls?state=open&per_page=100" --paginate --jq '.[].head.ref')"
removed=0
candidates=0
# Only consider branches of PRs GitHub explicitly reports merged.
while IFS=$'\t' read -r number name merge_head; do
  [[ -n "$name" && "$name" != "main" && "$name" != "master" ]] || continue
  if grep -Fxq "$name" <<< "$open_heads"; then
    printf 'SKIP (open PR): %s\n' "$name"
    continue
  fi
  current="$(gh api "repos/$REPO/git/ref/heads/$name" --jq '.object.sha' 2>/dev/null || true)"
  if [[ -z "$current" ]]; then
    printf 'SKIP (already absent): %s\n' "$name"
    continue
  fi
  if [[ "$current" != "$merge_head" ]]; then
    printf 'SKIP (post-merge branch changes): %s\n' "$name"
    continue
  fi
  candidates=$((candidates + 1))
  if [[ "$MODE" == "--execute" ]]; then
    gh api -X DELETE "repos/$REPO/git/refs/heads/$name" >/dev/null
    printf 'DELETED (merged PR #%s): %s\n' "$number" "$name"
    removed=$((removed + 1))
  else
    printf 'DRY RUN (merged PR #%s): %s\n' "$number" "$name"
  fi
done < <(gh api "repos/$REPO/pulls?state=closed&per_page=100" --paginate --jq '.[] | select(.merged_at != null) | [.number, .head.ref, .head.sha] | @tsv')
printf '\nEligible merged PR branches: %s; deleted: %s; mode: %s\n' "$candidates" "$removed" "$MODE"
echo "Branches from unmerged PRs and ops/* are deliberately not deleted. Inspect them separately."
