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
| Change gate: refusal tests | One test per boundary line in the plan's change-gate table | | Each one is refused as the line says | | |
| Change gate: security pass | Each boundary line read against the diff, sad paths included | | No line broken | | |
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

## Governance and release gates

Zone: **{green | yellow | red}**. Green = free checks only; Yellow/Red = full set (see
[reference/governance-gates.md](../reference/governance-gates.md)). A failed or not-run **blocking**
gate keeps the pull request draft.

| Gate | In force | Blocking | Criterion / method | Result | Evidence |
|---|---|---|---|---|---|
| GATE-OWN (system + business owner designated) | | | | {PASS / FAIL / WARN / SKIPPED / NOT RUN / N/A} | |
| GATE-PRC-secrets | | | | | |
| GATE-PRC-io-validation | | | | | |
| GATE-PRC-deps | | | | | |
| GATE-PRC-tests | | | | | |
| GATE-PRC-logging | | | | | |
| GATE-PRC-rollback | | | | | |
| GATE-SEC (security acceptance criteria) | | | | | |
| GATE-P2P-business-viability | | | | | |
| GATE-P2P-data-security-readiness | | | | | |
| GATE-P2P-technical-viability | | | | | |
| GATE-P2P-production-readiness | | | | | |
| GATE-P2P-value-readiness | | | | | |

## Exceptions and residual risk

{Every failure, warning, skipped check, or not-run check, who accepted it, and why the PR remains
safe as a draft or can proceed to release review.}