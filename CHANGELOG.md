# Changelog

All notable changes to the `aifactory-replatform` plugin are recorded here. The plugin version in
`.claude-plugin/plugin.json` and the release tag must match.

## 0.5.0

Brings the public copy up to date with the playbook itm8 uses. Additive for existing runs: specs,
plans and run inputs without the new keys validate exactly as before.

### Added

- **The change gate** (`build-kit/GUARD.md`): the one gate every change passes before code is
  written, for people and AI tools alike: the build rules first, then one line per trust boundary
  with a refusal test, then the smallest change. Since version 0.2 it also lists the actions that
  need a person first (force pushes, deletes outside the project, deleting cloud resources,
  production) and the current-versions rule. The replatform skill runs it for every `APP-###` item,
  in the plan and before the change is written, and reports its refusal tests and security pass.
- **Shared resources** in the build kit (`build-kit/AGENTS.md` 0.2) and the replatform skill: a
  registry, App Gateway, Front Door or API Management that belongs to another team is used by
  resource ID only, never created or changed; images are pulled with the app's managed identity;
  models are called through API Management with managed identity. C1 and `ai-factory.json` carry
  `registryAccess`, `addressSpace`, `sharedResources` and the shared resource group, which is
  information only, never evidence that a resource exists.
- **Platform kinds** (`azure-apps`, `fabric`, `power-platform`): a Fabric- or Power Platform-only
  solution has no app; the agent writes a platform plan, not a rebuild. Fabric content modules
  (`lakehouse`, `medallion`, `semantic-model`, `data-agent`) and the Wizard's refusals for them are
  checked by `validate-wizard-spec`; Power Platform in Red is a blocker.
- **Zone tiers**: optional `edge` (`none`, `app-gateway`, `front-door`) and `database` (`postgres`,
  `cosmos-nosql`), copied as given and never invented, with the Wizard's refusals. Edge `none`
  means Easy Auth on every web app; Cosmos DB means a planned data-access change and no `PG*`
  settings.
- **Foundry Premium AI gateway**: optional `foundry.gateway` (a new or an existing API Management).
  Apps call the models through it with their managed identity, never a key.
- **Sandbox runs**: the run's `limits.maxQuestions` sets the question limit (never above ten; zero
  asks nothing and records gaps), and a run that resumes a needs-input run records the run input's
  `answers` word for word and does not ask them again.
- **Tracing and incoming A2A**: one W3C `traceparent` for every call of an agent run
  ([reference/tracing.md](skills/replatform/reference/tracing.md)), and an incoming A2A message
  that names a run is checked with `replatform_get_replatform_run` before anything else
  ([reference/incoming-a2a.md](skills/replatform/reference/incoming-a2a.md)).
- **Where hosted builders read the rules** (`build-kit/hosted-builders.md` 0.2): Lovable, Base44,
  Bolt.new and Replit read a rules file from the repository; pasting into the builder's knowledge is
  the fallback.

### Changed

- **Fewer questions**: the skill asks only what changes the zone, the data, the identity model or
  the target, never what C1, the answers or the code already say; documented defaults become
  recorded assumptions.
- **No private runner by default**: the pipeline builds on a standard hosted runner and deploys with
  Bicep; for a private registry the first option is `az acr import`, and a runner on Azure private
  networking is the fallback.
- The Wizard agent reads a run's progress with `replatform_get_engagement` and
  `replatform_get_audit_timeline`, and its steps proposal may carry the edge, the database and the
  AI gateway.
- **Management App contracts** re-pinned to a newer commit on the Management App's `main`: the
  optional `landingZone.sreAgent`, new use-case roles and the package kind `optional-questions`.

## 0.4.2

### Changed

- Removed internal names and references from docs and metadata.

## 0.4.1

### Changed

- **Management App contracts re-pinned** to a commit on the Management App's `main` (2026-11-21);
  `contracts/mgmt.lock.json` names it and `contracts/mgmt/` is again its byte-for-byte copy. Every
  change is additive: C1 and the run input gain the optional `edge`, `foundry.gateway`, `database`,
  `platformKinds`, `addressSpace`, `registryAccess` and `sharedResources`; the Wizard spec (C3)
  gains `edge`, `database`, `foundry.gateway`, `delivery.reporting`, `platformKinds`, `fabric`,
  `powerPlatform` and `landingZone` (with the optional `sreAgent`, `placement` `shared` or
  `solution`); the run input gains the intent `security-audit`, `model.resource`, the limits
  `maxTotalTokens`, `maxCostUsd` and `maxQuestions`, `answers` and `priorAudit`, and
  `prerequisiteRoles` holds up to 18 with new customer and use-case roles; the run bundle gains
  the same intent, `model.resource` and limits and the failure classes `token-limit` and
  `cost-limit`; the MCP tool registry gains new package kinds (including `optional-questions`),
  contact roles and Wizard proposal fields; `personal-data-report.schema.json` is new. The
  playbook's schemas, validators and sandbox gate are unchanged: its Wizard spec projection already
  accepts additive fields, its C1 mirror (`engagement-input.schema.json`) does not carry the new C1
  fields yet and still refuses them, and the sandbox gate still treats every plan question as
  unanswered.

## 0.4.0

### Added

- **Zone-aware governance and release gates** ([reference/governance-gates.md](skills/replatform/reference/governance-gates.md)):
  itm8's ownership gate, Production Readiness Checklist, security acceptance criteria, and the five
  POC-to-production gates, folded into the assessment. GREEN runs the free automated checks only;
  YELLOW and RED run the full set, with blocking gates keeping the pull request draft. Recorded in a
  new plan-only `governanceGates` section and in the plan and validation-report templates. Additive:
  `contracts/` and the posted assessment shape are unchanged.

### Changed

- Naming: the canonical order is recorded — customer Azure artefacts are customer-first
  (`customer-workload-region-type[-qualifier]-environment`); Power Platform and Entra use
  `aif-<cust>-<zone>-<type>`.

## 0.3.1

### Changed

- Prepared for public, source-available distribution under the itm8 AI Factory Source-Available
  License: trimmed to the customer-facing Claude Code plugin and its validators, with internal
  itm8 references generalized.

## Pre-public releases (0.3.0 and earlier)

Features already in place when the plugin was first published:

- **Sandbox mode** for runner-started runs, off by default: `sandbox-preflight` and
  `sandbox-result` commands, a `sandbox-result` schema and `reference/sandbox-mode.md`. Owner
  answers written by the plan itself are refused.
- **Wizard agent skill** (`skills/wizard-agent/`): conversational help for the AI Factory Wizard.
  It proposes answers for Wizard steps 1-3 and readiness.
- **Management App contracts** pinned under `contracts/mgmt/`.
- **Build profile**: the skill reads the code plugin's build profile (`reference/build-profile.md`).
- **Plan analysis**: `analyze-plan` checks a plan's consistency and `converge` lists unfinished
  plan items.
- **Platform rules**: prerequisites, sub-zone infrastructure, A2A, services and certificate rules;
  private endpoints are registered in the customer's central DNS zones; standard asks of a Corp
  landing zone; build rules for speed, scale and resilience.
- **Validators** for the plan, the Wizard spec and the implementation (for example two plan items
  on one path are rejected and dependency manifests are planned).
