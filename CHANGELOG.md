# Changelog

All notable changes to the `aifactory-replatform` plugin are recorded here. The plugin version in
`.claude-plugin/plugin.json` and the release tag must match.

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
