# Changelog

All notable changes to the `aifactory-replatform` plugin are recorded here. The plugin version in
`.claude-plugin/plugin.json` and the release tag must match.

## 0.3.1

### Changed

- Prepared for public, source-available distribution under the itm8 AI Factory Source-Available
  License: trimmed to the customer-facing Claude Code plugin and its validators, with internal
  itm8 references generalized.

## 0.3.0

Changes since 0.2.0 (27 commits, 2026-10-27 to 2026-11-02).

### Added

- **Sandbox mode** for runner-started runs, off by default: `sandbox-preflight` and
  `sandbox-result` commands, a `sandbox-result` schema and `reference/sandbox-mode.md`. Owner
  answers written by the plan itself are refused.
- **Wizard agent skill** (`skills/wizard-agent/`): conversational help for the AI Factory Wizard,
  with evals and a synthetic end-to-end test. It proposes answers for Wizard steps 1-3 and
  readiness, and its tool table is checked against the pinned allow list.
- **Management App contracts** pinned under `contracts/mgmt/`.
- **Build profile**: the skill reads the code plugin's build profile (`reference/build-profile.md`).
- **Plan analysis**: `analyze-plan` checks a plan's consistency and `converge` lists unfinished
  plan items.
- **Platform rules**: prerequisites, sub-zone infrastructure, A2A, services and certificate rules;
  private endpoints are registered in the customer's central DNS zones; standard asks of a Corp
  landing zone; build rules for speed, scale and resilience.

### Changed

- `SKILL.md` and the app-changes, decisions, discovery, outputs, platform-rules, validation and
  wizard-contract references updated for the above.
- Plan, Wizard spec and implementation validators apply stricter rules (for example two plan items
  on one path are rejected and dependency manifests are planned).
- `ai-factory-spec` schema extended.

### Removed

- The hash-bound approval gate: `plan-hash`, `handoff-hash`, `verify-approval`, `validate-handoff`,
  the approval and handoff schemas and the approval record template.
- `lessons/LESSONS.md` and `evals/pilot-exit-checklist.md`.

## 0.2.0

Initial tagged release.
