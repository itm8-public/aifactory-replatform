# AI Factory Replatform agent

The evidence-first, tool-neutral brain for itm8's replatform agent. It assesses an existing
customer application, asks for facts the code cannot prove, proposes a safe AI Factory target, and
prepares **application-only** changes as a draft pull request that a person reviews.

It never deploys, never writes platform IaC, never confirms a risk zone, and never
records secret values.

## Install in Claude Code

```text
/plugin marketplace add itm8-public/aifactory-replatform
/plugin install aifactory-replatform@itm8-aifactory
```

Then invoke `/aifactory-replatform:replatform assess this repository`. The command loads the same
portable skill used by every other adapter.

The plugin's validators use Node and two dev dependencies (`ajv`, `ajv-formats`). To run them
locally, install once in your checkout of this repository:

```text
npm install
npm run validate-plan -- .aifactory/replatform-plan.json
```

## Use it in any local AI tool

| Environment | Entry point | Intended use |
|---|---|---|
| Claude Code | Claude plugin and `/aifactory-replatform:replatform assess <source>` | A developer at the keyboard |
| VS Code / Visual Studio with an AI coding tool | Clone this repository and load `AGENTS.md` | A developer-led run |
| Any local AI coding tool | Load `AGENTS.md` and `skills/replatform/SKILL.md` from this checkout | A portable, auditable replatform workflow |

For tools that do not auto-discover skills, explicitly load `AGENTS.md`, then
`skills/replatform/SKILL.md` and every reference it links to from this checkout.

## How the workflow runs

A replatform plan is not proof that an application is ready to deploy. The workflow therefore
separates evidence, recommendations, implementation, and validation:

1. **Discover:** read source facts only; write an evidence ledger and identify unavailable checks.
2. **Classify:** answer risk questions from evidence, record findings, create proposed ADRs, and
   stop for owner answers.
3. **Plan:** propose the zone, target, migration, resources, and application changes; validate the
   structured plan.
4. **Implement:** change the application inside the plan's `allowedPaths`, one `APP-###` plan item
   per logical change, then run `validate-implementation`.
5. **Validate:** report every test and scan as `PASS`, `FAIL`, `WARN`, `SKIPPED`, or `NOT RUN`.
   Failed or unavailable required checks keep the pull request draft.
6. **Review:** open a draft pull request. A person reviews residual risk and merges. The agent
   never merges or deploys.

Personal or employee data points to a **Red** zone suggestion, and a Yellow pilot fits when all
identities and data are synthetic and non-personal; the agent gives its reasoning either way. A
person always confirms the zone.

## Layout

```text
AGENTS.md                       portable entry point for local AI tools
commands/replatform.md          Claude Code command adapter
skills/replatform/              canonical tool-neutral workflow
  SKILL.md                      phases, stop points, and behavioral rules
  reference/                    platform, evidence, ADR, validation, and intake rules; sandbox-mode.md
  schemas/                      plan, Wizard v1 and sandbox result contracts
  templates/                    ledger, findings, ADR, plan, validation, and PR templates
skills/wizard-agent/            the Wizard-agent companion skill
contracts/
  mgmt/                         the Management App's published contracts, pinned byte for byte
  mgmt.lock.json                the Management App commit they came from
scripts/
  validate-plan.mjs             schema and semantic evidence/zone/path validation
  validate-wizard-spec.mjs      Wizard v1 schema, region, PIM, evaluation, egress and Foundry gates
  validate-implementation.mjs   changed files stay inside allowedPaths and map to APP-### items
  sandbox-mode.mjs              sandbox runs only: marker and run-input gate, result builder, resume (default off)
  plan-analysis.mjs             analyze-plan (consistency) and converge (unfinished plan items)
build-kit/AGENTS.md             build rules (draft) for people who build an app itm8 will host later
build-kit/PERFORMANCE.md        companion rules: speed, scale and resilience (paging, timeouts, jobs, tracing)
build-kit/hosted-builders.md    the same rules, short, for builders with their own backend (Lovable)
.claude-plugin/                 Claude Code plugin and marketplace manifests
```

`skills/replatform/SKILL.md` is the source of truth. Adapters should point to it rather than
copying policy. The agent must not write platform IaC or deployment pipelines.

## Management App contracts

The Management App owns C1, C2, C3, the assessment and the MCP tool registry. This repository pins
its published copy in `contracts/mgmt/`, and the playbook's schemas mirror it. The pin records the
Management App commit the contracts came from in `contracts/mgmt.lock.json`. Dropping the approval
record and handoff here does not change those contracts.

It also pins `run-input.schema.json` (the context bundle a sandbox run reads from a file) and
`run-bundle.schema.json` (what a sandbox run hands back). The plugin validates a sandbox run's input
against the pinned copy directly (see
[skills/replatform/reference/sandbox-mode.md](skills/replatform/reference/sandbox-mode.md)). The
pin is a commit on the Management App's `main`; `contracts/mgmt.lock.json` names it.

## Output contract

Every engagement writes staged evidence under `.aifactory/` in the customer repository:

- `evidence-ledger.md`: source facts, owner answers, unavailable checks, and inferences.
- `replatform-plan.json` and `replatform-plan.md`: the authoritative structured plan and its
  human-readable view.
- `findings.md` and `decisions/ADR-*.md`: evidence-first findings and material decisions.
- `implementation-log.md` and `validation-report.md`: work performed and honest validation
  evidence.
- `ai-factory.json`: a draft wizard specification.

Validate a plan before implementing, and the changes before the PR leaves the agent:

```text
npm run validate-plan -- .aifactory/replatform-plan.json
npm run validate-implementation -- .aifactory/replatform-plan.json
npm run analyze-plan -- .aifactory/replatform-plan.json
npm run converge -- .aifactory/replatform-plan.json
```

These helpers protect consistency and make hallucinated claims visible; they do **not** authenticate
people, enforce Azure RBAC, replace branch protection, or authorize deployment. The PR review is
the human check.

## MCP boundary

This repository is **not an MCP server**. It can use a Management App MCP to read a landing-zone
catalogue, customer CAF profile, shared resources, or post an assessment, but it does not implement
the server. Configure the optional cloud-agent integration only after the Management App
deployment supports per-solution Replatform MCP keys and the endpoint is reachable from the agent's
private VNet runner. The endpoint path is `/api/v1/mcp`; use the internal endpoint supplied by the
Management App administrator, never a guessed or public URL.

When that key-support deployment is available, create a key for the intended solution in the
Management App and store the returned value as the cloud agent's secret
`COPILOT_MCP_AIFACTORY`. The key is shown once, is scoped to that solution, and can be revoked in
the Management App. Configure the MCP client to send it as a bearer credential. Never put the key
value in this repository, an issue, a prompt, logs, or a pull request. A key does not grant Azure
access or authorize an approval.

The tool names below are the Management App's tool registry, pinned in
[contracts/mgmt/mcp-tools.json](contracts/mgmt/mcp-tools.json). The
playbook must only name tools listed there; a tool the registry hides from agents stays on the
people-only line below.

Engagement tools (integrated runs, see `skills/replatform/SKILL.md`):

- `replatform_get_engagement`, `replatform_get_policy_snapshot`,
  `replatform_allowed_source_connections`, `replatform_get_audit_timeline`,
  `replatform_get_landing_zone_catalog`: read the engagement and its scope.
- `replatform_discover_azure_landing_zone`: read-only landing zone discovery through the Management
  App's verified Reader connection.
- `replatform_ask_question`, `replatform_request_approval`: ask a person; the answer arrives in the
  audit timeline. A scope change is a question: a person files the amendment.
- `replatform_register_evidence`, `replatform_register_artifact`, `replatform_append_event`: record
  metadata-only evidence and lifecycle events.
- `replatform_answer_question`, `replatform_answer_risk_question`,
  `replatform_request_scope_amendment`, `replatform_decide_scope_amendment`,
  `replatform_record_approval`: **people only**. The agent never calls them.

Solution tools (per-solution key):

- `replatform_get_engagement_input`: read what the Wizard already knows about the in-scope solution
  (contract C1: its answers, the source reference with its SHA, and `missing`, the answers still
  open); input: `{ "solutionId": "<scoped solution ID>" }`. Read it first.
- `replatform_get_customer_caf_profile`: read the in-scope customer's CAF profile; input:
  `{ "solutionId": "<scoped solution ID>" }`.
- `replatform_get_shared_resources`: read the shared-platform resource inventory; input: `{}`.
- `replatform_validate_replatform_plan`: validate an assessment without storing it.
- `replatform_post_replatform_assessment`: submit the existing assessment-create body as a proposed
  assessment for the scoped solution; only a person can accept it.

- `replatform_get_prerequisite_status`: read the customer prerequisite packages and the role that blocks each; input
  `{ "solutionId": "<scoped solution ID>" }`. `tracking` is `derived` until packages are stored, then `stored`.
  Read-only: the agent never creates, sends, waives or closes a package.

Validation and posting use the input shape
`{ "solutionId": "<scoped solution ID>", "assessment": <existing assessment-create body> }`.
Validate before posting. If validation refuses the assessment, treat the refusal as a hard stop:
preserve the reasons, obtain missing evidence or a human decision through the approved workflow, and
do not bypass the checks or post the refused assessment. These tools preserve the same evidence,
and privacy rules as the local playbook.

## Known boundaries

- AI Factory policies and wizard templates may still be proposed. The platform repository wins when
  it conflicts with these documents; record the mismatch instead of inventing a third rule.
- Do not process customer code with an AI model whose data-processing policy lacks the customer's
  consent.
- The Management App control-plane and cross-repository integrations remain separate workstreams.
- A local hook or validator is a guardrail, not an authorization boundary. Use protected branches,
  environment approvals, least-privilege identities, and platform controls as the actual boundary.
