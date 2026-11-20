# Replatform validation report: {solution name}

**Revision:** `{commit or plan hash}`
**Plan:** `.aifactory/replatform-plan.json`
**Status:** {draft | ready for human release review}

## Baseline

{Existing test/build/security state before implementation. State `unknown` when no baseline exists.}

## Checks

| Check | Command or method | Target | Criterion | Result | Evidence |
|---|---|---|---|---|---|
| Build | | | | {PASS / FAIL / WARN / SKIPPED / NOT RUN} | |
| Tests | | | | | |
| Implementation scope | | | | | |
| SAST | | | | | |
| IaC scan | | | | | |
| Secret scan | | | | | |
| Dependency audit | | | | | |
| SBOM | | | | | |
| Image/provenance | | | | | |
| Migration and restore | | | | | |

## Data migration reconciliation

| Dataset / table | Pre-migration rows | Post-migration rows | Reconciliation command / result | Restore or forward-fix evidence |
|---|---:|---:|---|---|
| {table or `Not applicable`} | {count or N/A} | {count or N/A} | {command, invariant, and exact result} | {restore/forward-fix link or reason not applicable} |

## Behaviour and operational review

{Authentication, authorization, readiness, logs, rollout, rollback, and restore results. Record
commands, log links, and any result that was not run.}

## Exceptions and residual risk

{Every failure, warning, skipped check, or not-run check, who accepted it, and why the PR remains
safe as a draft or can proceed to release review.}