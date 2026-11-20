# Replatform plan: {solution name}

**Status:** {draft | questions | approved}
**Source:** {repository or upload}, revision `{commit}`
**Machine-readable plan:** `.aifactory/replatform-plan.json`
**Evidence ledger:** `.aifactory/evidence-ledger.md`
**Findings:** `.aifactory/findings.md`

## Summary

{Three sentences: what the app is today, what it becomes, and the one decision the reviewer must make.}

## Today

{Current architecture in five lines or fewer, each line with its evidence id.}

## Target

| Item | Proposal | Evidence |
|---|---|---|
| Hosting | {Container Apps / App Service / ...}{, platform gap} | {ids} |
| Suggested zone | {green / yellow / red} (a person confirms) | {risk answers} |
| Placement | {A-shared / A-dedicated / B-caf / B-public} | {why} |
| Service level | dev {basic}, test {basic}, prod {standard} | {why} |
| Data | {PostgreSQL database on the shared server / ...} | {ids} |
| Ingress | {shared App Gateway listener / internal-only} | {ids} |

### Why this target

{Signals from reference/hosting-decision.md that decided it, what the alternative costs, and every
assumption that still needs owner confirmation.}

## Cost and pricing assumptions

{State the service-level costs separately from the security zone. For Red, show the selected
firewall path and only the provisional ADR-20 ranges: about €1,600–2,300/month after the full stage
with an existing firewall/FortiGate, or €2,800–3,500 with Azure Firewall. Mark these as proposed
estimates until ratified. Never default to Azure Firewall or invent a gateway/token quota price.}

## Findings and decisions

- Findings: `.aifactory/findings.md`
- Material decisions: `.aifactory/decisions/ADR-*.md`

| Decision | Status | Recommendation | Human decision/reference |
|---|---|---|---|
| {ADR-001} | {proposed / approved / deferred} | {option} | {reference or pending} |

## Shared resources

| Need | Reuse | Existing resource or reason for a new one |
|---|---|---|

## Wizard target and readiness

| Field | Value / evidence |
|---|---|
| Customer code | {Wizard value; 2–4 lowercase letters/digits, starts with a letter; never invented} |
| Zone / archetype | {suggested zone; human-confirmed zone remains in Wizard; archetype only if supplied} |
| Audience / connectivity | {owner/Wizard answer or `unknown`} |
| Region / allowed regions | {explicit choice; no default} |
| Service level by environment | {customer-selected Basic/Standard/Premium; does not reduce zone controls} |
| Access/PIM readiness | {group status, evidence-reference present/missing, actions; no names/emails} |
| CAF profile | {confirmed Defender/Bastion facts only; otherwise unknown} |
| Foundry / evaluation / Fabric | {explicit choices only; no invented quotas, contacts, expiry, or Fabric use} |

Open Wizard readiness items are customer actions. Never copy `accessAdmin` contact details or the
`eligibleAccounts` list into this plan, PR, lessons, or telemetry. A Basic service level does not
change the proposed zone or security controls. Record current Wizard refusals and unratified ADR
status without changing the owner's inputs.

## Compatibility boundaries

{What must not change: public API shapes, URLs, data formats. Also `compatibilityBoundaries` in the plan JSON.}

## Changes to the application

| Plan item | Target-spec field | Path | Change | Reason | Evidence |
|---|---|---|---|---|---|

Allowed paths for implementation: {list}

## Secrets the app needs (names only)

| Name | Used by |
|---|---|

## Migration, rollback, and recovery

{Data migration method, reconciliation, rollback or forward-fix rule, backup/restore evidence,
and who owns each action. Write `Not applicable` only with evidence.}

## Risks and open points

- {finding, severity, evidence, and owner}

## Questions

| # | Question | Answer | By |
|---|---|---|---|

## Governance gates (zone-aware)

Applied for suggested zone **{green | yellow | red}** (a person confirms the zone). Green runs the
free checks only; Yellow and Red run the full set. Machine-readable in `governanceGates`. See
[reference/governance-gates.md](../reference/governance-gates.md).

| Gate | Group | In force | Blocking | Status | Owner role | Evidence |
|---|---|---|---|---|---|---|
| GATE-OWN | ownership | {yes/no} | {yes/no} | {PASS/FAIL/WARN/SKIPPED/NOT RUN/N/A} | system & business owner | {ids or mgmt-app ref} |
| GATE-PRC-secrets | production-readiness | | | | | |
| GATE-PRC-io-validation | production-readiness | | | | | |
| GATE-PRC-deps | production-readiness | | | | | |
| GATE-PRC-tests | production-readiness | | | | | |
| GATE-PRC-logging | production-readiness | | | | | |
| GATE-PRC-rollback | production-readiness | | | | | |
| GATE-SEC | security-acceptance | | | | | |
| GATE-P2P-business-viability | poc-to-production | | | | | |
| GATE-P2P-data-security-readiness | poc-to-production | | | | | |
| GATE-P2P-technical-viability | poc-to-production | | | | | |
| GATE-P2P-production-readiness | poc-to-production | | | | | |
| GATE-P2P-value-readiness | poc-to-production | | | | | |

Security acceptance criteria (Yellow/Red — each must be `PASS` before release review):

| Criterion | Verification method | Result |
|---|---|---|

## Planned validation

{Required build, tests, SAST, IaC, secret, dependency, SBOM, image, migration, restore, and
operational checks. Results go in `.aifactory/validation-report.md`.}

## Decision log

| When | Who | Decision | Reason |
|---|---|---|---|