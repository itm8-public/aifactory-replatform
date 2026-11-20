# Governance and release gates

itm8's governance and security clauses, folded into the assessment as **zone-aware gates**. They are
additive: they produce findings, questions, plan entries and validation rows through the mechanisms
the playbook already uses. They never change `contracts/`, and they are **not** part of the
assessment posted to the Management App, which keeps its pinned shape. The gates are recorded
plan-only in `governanceGates` and in the plan and validation-report templates.

A gate **suggests**; a person decides. The agent never sets `confirmedZone`, never records an
approval, and never calls a release "compliant". Use `PASS`, `FAIL`, `WARN`, `SKIPPED`, `NOT RUN`
or `N/A`, as in [validation.md](validation.md).

## Zone-aware application

The suggested zone (see [risk-questions.md](risk-questions.md)) selects the gate set. The person
confirms the zone; a stricter confirmed zone pulls in the stricter gate set.

| | GREEN | YELLOW | RED |
|---|---|---|---|
| What applies | the **free checks** only | every gate below | every gate below, strictest |
| Human / process gates (ownership, security acceptance, POC-to-production) | recorded, **not** blocking | in force, blocking as marked | in force, blocking as marked |

"Free checks" are the gates an automated check already produces at no extra cost: secret scanning,
tests present, dependency hygiene, and logging-without-secrets. At GREEN only these are required; the
human/process gates are recorded for visibility but do not keep the pull request draft.

## The gates

### Ownership gate — GATE-OWN

A **named system (technical) owner and a named business owner** are designated before release.
Record the **designation** as a Management App / intake reference and the responsible **role** —
never copy a person's name or e-mail into repository artifacts (see [evidence.md](evidence.md) and
the privacy rules).

- GREEN: record presence; non-blocking.
- YELLOW / RED: both owners must be designated. If either is missing, raise it as a question in
  Phase 2 naming the responsible customer role, keep the plan at `questions`, and keep the pull
  request draft. Blocking.

### Production Readiness Checklist — GATE-PRC-*

Each item is verified before release; most reuse the six checks in
[app-changes.md](app-changes.md#checks-before-the-pull-request-leaves-draft) and the validation
report.

| Gate | Checks | Free check? |
|---|---|---|
| GATE-PRC-secrets | No secret value in code, logs or prompts (secret scan + logging review). Secret **names** only in the plan. | yes |
| GATE-PRC-io-validation | Input **and** output validation at trust boundaries. | no (design review) |
| GATE-PRC-deps | Dependency hygiene: dependency audit clean, or every finding triaged. | yes |
| GATE-PRC-tests | Tests present and run (never deleted to pass). | yes |
| GATE-PRC-logging | Structured logging to stdout; no secrets or personal data in logs. | yes |
| GATE-PRC-rollback | A known rollback or forward-fix path, with migration/restore evidence where the app has state. | no (plan review) |

- GREEN: the free-check rows only (secrets, deps, tests, logging).
- YELLOW / RED: all six, verified before release; an unmet required row keeps the pull request
  draft. Blocking.

### Security acceptance criteria — GATE-SEC

The security requirements for the solution are written as **acceptance criteria and verified before
release**, not left as aspirations. Derive them from the risk answers (Q1–Q8, A1–A3), the findings,
and the platform controls that apply at the zone ([platform-rules.md](platform-rules.md)).

- GREEN: SAST and secret-scan evidence only; non-blocking beyond the free checks.
- YELLOW / RED: enumerate each security requirement as an acceptance criterion with a verification
  method and result; every required criterion must be `PASS` before release review. An open or
  failed criterion keeps the pull request draft. Blocking.

### POC-to-production gates — GATE-P2P-*

The five readiness gates between a proof of concept and production. Assess each, record the status,
the responsible role, and evidence. **Canonical ordering and wording are being reconciled; keep the
ids stable** and do not present an order as ratified.

| Gate | Asks |
|---|---|
| GATE-P2P-business-viability | Is there a confirmed business case and owner for running this in production? |
| GATE-P2P-data-security-readiness | Are data classification, residency, secrets, identity and the zone's security controls in place? |
| GATE-P2P-technical-viability | Does the architecture fit a supported AI Factory target, with no unresolved platform gap? |
| GATE-P2P-production-readiness | Do the Production Readiness Checklist and operational checks pass? |
| GATE-P2P-value-readiness | Is the expected value measurable, with a way to tell whether it is delivered? |

- GREEN: informational; the technical/production items ride on the free checks.
- YELLOW / RED: all five assessed. **Data & security readiness** and **production readiness** are
  blocking; the others are recorded and surfaced for the human release decision.

## How the gates flow through the phases

- **Phase 2 (Classify):** evaluate GATE-OWN and begin the POC-to-production assessment. A missing
  owner or an open required gate becomes one of the posted questions.
- **Phase 3 (Plan):** record the applied zone and every in-force gate in `governanceGates` and in the
  plan's "Governance gates" section. Security requirements become acceptance criteria.
- **Phase 4 (Validate):** verify the Production Readiness Checklist and the security acceptance
  criteria in the validation report, zone-aware. A failed or not-run **blocking** gate keeps the
  pull request draft; record the exception and the responsible role.

## Resource names in gate and plan evidence

Where a gate or plan entry references or recommends a resource name, use the canonical order:
customer Azure artefacts are **customer-first**,
`customer-workload-region-type[-qualifier]-environment`; Power Platform and Entra artefacts use
`aif-<cust>-<zone>-<type>` (see [platform-rules.md](platform-rules.md), "Naming and tags"). Never
invent a customer code or a globally-unique suffix.
