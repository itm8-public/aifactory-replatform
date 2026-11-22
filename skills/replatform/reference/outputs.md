# Outputs

The canonical machine-readable artifact is `.aifactory/replatform-plan.json`. Every other document
explains or proves a stage of that plan; it must not silently contradict the JSON.

| Stage | File | Purpose |
|---|---|---|
| Discovery | `.aifactory/evidence-ledger.md` | Facts, owner answers, unavailable checks, and bounded inferences from [../templates/evidence-ledger.md](../templates/evidence-ledger.md) |
| Discovery | `.aifactory/replatform-plan.json` | Structured report and draft plan; validate it before implementing |
| Classify | `.aifactory/findings.md` | Evidence-first findings from [../templates/findings-register.md](../templates/findings-register.md) |
| Classify / plan | `.aifactory/decisions/ADR-*.md` | Proposed or human-decided material choices from [../templates/decision-record.md](../templates/decision-record.md) |
| Plan | `.aifactory/replatform-plan.md` | Human-readable plan from [../templates/plan.md](../templates/plan.md) |
| Implement | `.aifactory/implementation-log.md` | Changes and plan amendments from [../templates/implementation-log.md](../templates/implementation-log.md) |
| Validate | `.aifactory/validation-report.md` | Command/result evidence from [../templates/validation-report.md](../templates/validation-report.md) |
| Implement | `.aifactory/ai-factory.json` | Draft Wizard v1 spec |

## Evidence ids

`assessment.draft` is posted to the Management App only when the customer and solution IDs are
known. Repository evidence ids must be present in `assessment.report`. Azure evidence ids are
validated against the same-customer immutable snapshot supplied as `landingZoneDiscoveryId`; keep
the snapshot metadata in the plan's top-level `azureDiscovery` field, not in the repository report.

| Id | Points at |
|---|---|
| `component:<ecosystem>/<name>` | A dependency (`npm`, `pypi`, or `nuget` only) |
| `license:<declaredIn>` | A license declaration |
| `iac:<path>` | Existing IaC, Dockerfile, or pipeline |
| `test:<path>` | A test file or folder |
| `runtime:<path>` | A runtime declaration |
| `secret:<path>:<rule>` | A detected secret; never its value |
| `tool-error:<path>` | A dependency check that failed |
| `unavailable:<check>` | A check that could not run |
| `azure-discovery:<discovery-id>:<category>` | An available category in the immutable, authorized Azure discovery snapshot |
| `unavailable:azure-discovery:<discovery-id>:<category>` | A category query that was unavailable in that snapshot |
| `unavailable:azure-discovery` | Azure access/scope was unavailable and no snapshot was persisted |
| `owner:<question-id>` | An answered owner question; valid only outside `assessment.draft` |

The top-level `azureDiscovery` block stores only status, discovery/content/scope hashes, timestamp,
correlation id, aggregate subscription counts, and per-category status/item counts. An unavailable
category has a null item count, not zero. Do not persist tenant ids, subscription ids, returned
resource references, or raw inventory in the plan or evidence ledger; the authorized Management App
discovery record is the source of that evidence. The plan metadata carries no recommended zone,
region, or quota decision.

Rules enforced by `npm run validate-plan`:

- A fact finding cites observed fact ids only; an unavailable finding cites `unavailable:` or
  `tool-error:` ids only; an inference has confidence and supporting evidence.
- Every target-spec delta, backlog item, application change, and hosting signal cites evidence.
- Every one of the eight risk and three AI Act questions needs an evidenced `yes` or `no` answer
  before implementing. A prohibited A1 answer stops the run.
- Personal or employee data, special-category data, regulated-sector data, people-affecting AI,
  or high-risk AI use points to a Red zone suggestion; give the rationale if you suggest another.
- Every application change must be inside an allowed path.
- Never write the word "compliant" as a verdict. State what was checked.

Owner answers are not report facts. Keep them in `risk.answers` and `questions`; never use them as
facts in `assessment.draft`.

For an authenticated Management App prerequisite-status result, put any required customer action in
an unanswered `questions` entry, naming only the responsible customer role and the required action.
Describe the read-only tool result in `why` without copying customer or solution identifiers, contact
details, artifact text, or link tokens. This question records a blocker, not a repository fact or an
owner answer. Until the plan contract supports Management App prerequisite evidence, do not cite it
as `fact` evidence in `assessment.draft`; if the read-only tool is absent or unavailable, record the
check as unavailable and do not infer package or role-holder state.

## Wizard v1 `ai-factory.json`

The current Wizard contract is pinned in
[Wizard contract](wizard-contract.md) and validated against the Management App commit pinned in
[contracts/mgmt.lock.json](../../../contracts/mgmt.lock.json). The JSON Schema projection is
[ai-factory-spec.schema.json](../schemas/ai-factory-spec.schema.json). It is additive and intentionally
accepts future fields so long as `schemaVersion` remains `"1"`.

The v1 spec includes `customer` (`name`, `code`), `solution` (`name`, `code`, `owner`, `costCenter`),
`tenantId`, `zone`, `region`, optional/additive `allowedRegions`, `environments` (dev/test/prod and a level per
environment), `apps` (web/api/worker, repo, port, probes, settings by **name** with a `secret` flag,
database, AI and migration job), `foundry`, `delivery`, and `readiness`. Optional additive fields
include `archetype`, `connectivity`, `audience`, `evaluation`, Red-only `egress`, non-Red `network`,
`caf`, `discovery`, and `dataPlatform`.

Before implementing, explicitly verify these constraints:

- `customer.code` is 2–4 lowercase letters/digits, starts with a letter, and is not `itm8`. Never
  invent it. Do not generate resource names or globally unique suffixes; the Wizard/Bicep owns them.
- Region is never defaulted. `allowedRegions: []` means unknown, not unrestricted. Red is
  `swedencentral`; Yellow currently accepts only `swedencentral`, `westeurope`, `northeurope`, and
  `germanywestcentral`. Resolve a missing/denied region with the customer; do not guess.
- Service level is capacity only and cannot weaken zone controls. Keep each dev/test/prod level as
  explicitly selected.
- The archetype rules are still **Proposed**. The current Wizard refuses certain archetype/zone/connectivity/
  audience combinations. Do not auto-change a person's choice: surface the exact Wizard refusal,
  stop for the responsible reviewers, and keep the policy marked proposed.
- `readiness.accessGroups`, `eligibleAccounts`, and `accessAdmin` are Wizard/identity-team inputs.
  Missing group/PIM status, evidence reference, or access administrator is a customer action.
  Never assign subscription roles to people; use static groups and PIM-eligible membership.
  Do not copy access-admin names/emails or eligible-account lists into plan prose, logs, lessons,
  or telemetry. The Management App/Wizard owns these personal details and the onboarding request.
- `caf` is written only from a customer-confirmed CAF profile. When `caf` is absent or unknown,
  do not assume Defender plans are inherited or Bastion is present. The Management App owns address
  space, allowed-region, policy, and network-overlap pre-deploy checks; the agent does not claim to
  have run them.
- Red must explicitly name its egress firewall. Start with the customer's firewall, then
  Operations-supported FortiGate; Azure Firewall is opt-in only with an Operations approval
  reference. Never invent the next-hop IP or approval. The Red egress cost figures remain
  provisional until reviewers ratify them.
- `evaluation` is isolated, Green, Basic in every environment, no prod, synthetic/non-sensitive
  data, expires in 1–90 days, and uses no shared gateway, registry, Foundry, or Fabric capacity.
  It never promotes in place; production is a separate reviewed order.
- Legacy v1 specs without `foundry.level` are Basic. Recommend Premium only when the customer
  requests an enforceable hard token cap or several apps share models; a budget is not a cap. Agents
  that require `AZURE_AI_PROJECT_ENDPOINT` stay on Basic until the gateway supports that workflow.
  Premium needs a human-selected per-app `tokensPerMinute`, explicit `monthlyTokenQuota` (`0` means
  no cap), and gateway contact. Never invent those values. Premium apps use the AI gateway and get
  no Foundry account role or `AZURE_AI_PROJECT_ENDPOINT`.
- Omit `dataPlatform` unless Fabric was explicitly selected. Seeded competency tracks mentioning
  Fabric/Power BI are not a runtime integration.

Run the offline contract checker once a Wizard spec is available:

```text
npm run validate-wizard-spec -- .aifactory/ai-factory.json
```

It reports structural errors separately from blockers and warnings. A blocker requires a human
answer or resolution; do not change a zone, invent a resource, or treat the checker as an approval.

## Posting the assessment

When Management App MCP tools are available, post `{report, draft, model, policyVersion}` only when
real `customerId` and `solutionId` values are known. When `azureDiscovery.discoveryId` is present,
also pass that exact value as `landingZoneDiscoveryId`; the Management App verifies the linked
snapshot belongs to the same customer and validates each cited Azure category against it. Without
a persisted discovery, omit `landingZoneDiscoveryId` and cite `unavailable:azure-discovery` in the
report. Until real IDs are known, keep both `customerId` and `solutionId` `null`; never invent IDs.
`model` describes the model that wrote the draft (provider, region, deployment type, retention,
prompt logging). For an available category, normalize the tool's `resourceIds.length` to
`itemCount`; for an unavailable category use `null`, never zero. Keep only category, status, and item
count in the plan; do not copy the returned IDs or raw inventory into the plan or repository report.
If the model policy blocks that model, do not post; explain the blocker instead.

The draft's optional `appProposal` (contract C2, [app-proposal.md](app-proposal.md)) is posted with it
unchanged: the Management App stores it with the draft, shows it in the Wizard's Apps step as a
field-by-field difference, and refuses the quick scan as its source, a secret-looking value or a
malformed app.