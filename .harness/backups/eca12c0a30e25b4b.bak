# Contributing

## Table of Contents

- [Minimum workflow contract](#minimum-workflow-contract)
- [Why this workflow exists](#why-this-workflow-exists)
- [Branching and PR rule](#branching-and-pr-rule)
- [Branch name policy](#branch-name-policy)
- [Required pre-merge gates](#required-pre-merge-gates)
- [Greptile setup baseline](#greptile-setup-baseline)
- [Greptile config hierarchy](#greptile-config-hierarchy)
- [Greptile merge logic for multi-scope pull requests](#greptile-merge-logic-for-multi-scope-pull-requests)
- [Greptile confidence score policy](#greptile-confidence-score-policy)
- [Greptile strictness policy](#greptile-strictness-policy)
- [Greptile training and feedback loop](#greptile-training-and-feedback-loop)
- [Recommended security scanner baseline](#recommended-security-scanner-baseline)
- [Review artifacts requirement](#review-artifacts-requirement)
- [Credential-safe evidence snippets](#credential-safe-evidence-snippets)
- [Branch protection recommendation](#branch-protection-recommendation)

## Minimum workflow contract

- Branch off `main` for every change.
- No direct push to `main`.
- Pull request required for every merge.
- Required checks must pass before merge.
- Greptile + Codex review artifacts are required before merge.
- Greptile must be configured correctly using the `grepfile` skill with all required Greptile files present.
- The coding agent must not approve its own PR; review must be independent.
- Merge only after all gates pass.
- Delete branch/worktree after merge.

## Why this workflow exists

This workflow keeps delivery auditable, reversible, and consistent even for solo development.

## Branching and PR rule

1. Create a dedicated branch/worktree for each task:
   - Agent-created branch: `git switch -c codex/<short-description>`
   - Agent-created worktree: `git worktree add ../tmp-worktree -b codex/<short-description>`
   - Human-authored branch prefixes (when not using `codex/`): `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`
2. Keep commits small and focused.
3. Open a PR to merge into `main`.
4. Do not merge until checks, reviews, and checklist items are complete.
5. After merge, delete the remote branch and remove local worktree/branch.

## Branch name policy

- Use lower-case, kebab-case slugs.
- Agent-created branches must use `codex/<short-description>`.
- Human-authored branches may use: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`.
- Avoid `main`-like names and do not include secrets or issue-pii.

## Required pre-merge gates

- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm audit
- pnpm check
- test -f memory.json && jq -e '.meta.version == "1.0" and (.preamble.bootstrap | type == "boolean") and (.preamble.search | type == "boolean") and (.entries | type == "array")' memory.json >/dev/null

## Recommended security scanner baseline

For repositories that use Harness, recommend installing these scanners as project prerequisites:

- Gitleaks
- Trivy
- Semgrep

Recommended policy:

- Keep scanner binaries available in local development environments and CI runners.
- Run scanner checks in CI on pull requests and pushes to protected branches.
- Treat scanner findings as merge blockers unless explicitly waived with rationale.

## Review artifacts requirement

Each PR must include:

- Greptile review artifact (URL, report, or comment reference).
- Codex review artifact (URL, report, or comment reference).
- Greptile confidence score for the PR.
- Confirmation that reviewer agent is independent from coding agent.

If either artifact is missing, block merge until it is added or explicitly waived by repository policy.

## Credential-safe evidence snippets

- Never use command substitution in commit messages, PR bodies, or evidence notes for secrets.
- Do **not** use `$(gh auth token)` (or similar) inside `git commit -m ...` / `gh pr create --body ...`.
- Use placeholders in text output:
  - ✅ `$GITHUB_TOKEN`
  - ✅ `${GITHUB_TOKEN}`
  - ❌ expanded token values
- If a token value is ever exposed in commit/PR text, treat it as compromised: rotate/revoke, rewrite history where applicable, and document remediation in the issue/PR.

## Branch protection recommendation

Configure GitHub branch protection (or rulesets) on `main`:

- Bootstrap baseline via harness:
  - `harness branch-protect --owner <owner> --repo <repo>`
- Token resolution for `branch-protect`:
  - `--token <PAT>` or env `GITHUB_TOKEN` / `GITHUB_PERSONAL_ACCESS_TOKEN`
- Require pull request before merge.
- Require at least one approval.
- Require status checks: `pr-template`, `risk-policy-gate`, `dependency-review`, `actions-pinning`, `consistency-drift-health`, `lint`, `typecheck`, `test`, `audit`, `check`, `memory`, `security-scan`.
- Require workflows to pin third-party actions to full commit SHAs.
- Configure required checks workflows to run on both `pull_request` and `merge_group` when using merge queue.
- Block direct pushes to `main`.
