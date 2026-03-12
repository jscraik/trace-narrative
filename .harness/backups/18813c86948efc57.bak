# Pull request checklist

## Summary

- What changed (brief):
- Why this change was needed:
- Risk and rollback plan:

## Checklist

- [ ] I did not push directly to `main`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (`codex/*` for agent-created branches).
- [ ] Required local gates run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm check`, `test -f memory.json && jq -e '.meta.version == "1.0" and (.preamble.bootstrap | type == "boolean") and (.preamble.search | type == "boolean") and (.entries | type == "array")' memory.json >/dev/null`.
- [ ] Greptile review completed and findings handled (or explicitly waived).
- [ ] Codex review completed and findings handled (or explicitly waived).
- [ ] Greptile review was performed by an independent reviewer (not the coding agent).
- [ ] Greptile confidence score is `>= 4/5` for merge eligibility.
- [ ] Merge is blocked until all required checks pass.
- [ ] I will delete branch/worktree after merge.

## Testing

- Command: `pnpm lint` -> pass/fail
- Command: `pnpm typecheck` -> pass/fail
- Command: `pnpm test` -> pass/fail
- Command: `pnpm audit` -> pass/fail
- Command: `pnpm check` -> pass/fail
- Command: `test -f memory.json && jq -e '.meta.version == "1.0" and (.preamble.bootstrap | type == "boolean") and (.preamble.search | type == "boolean") and (.entries | type == "array")' memory.json >/dev/null` -> pass/fail
- Any other command(s):

## Review artifacts

- Greptile: <link / artifact path / comment ID>
- Greptile confidence score: <0-5>
- Independent reviewer evidence: <reviewer + link>
- Codex: <link / artifact path / comment ID>
- Additional evidence (if any):

## Notes

Add one-paragraph merge rationale here.
