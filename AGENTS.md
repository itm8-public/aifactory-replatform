# AI Factory Replatform Agent

This repository is the tool-neutral source of truth for the AI Factory replatform workflow. Read
[`skills/replatform/SKILL.md`](skills/replatform/SKILL.md) before assessing or changing a customer
application.

## For every local AI tool

- Treat source facts, owner answers, unavailable checks, and inferences as different evidence
  types. A claim without evidence is marked as an inference or an open question.
- Never confirm a risk zone, deploy, author platform IaC, or expose secret values.
- Keep tool adapters thin: Claude Code and Copilot entry points delegate to the same skill.
- Validate a completed plan with `npm run validate-plan -- .aifactory/replatform-plan.json`.
- Validate a generated Wizard spec with `npm run validate-wizard-spec -- .aifactory/ai-factory.json`.
- Check changed files against the plan with `npm run validate-implementation -- .aifactory/replatform-plan.json`.
- Only in a runner-started sandbox run (`--sandbox` or `AIFACTORY_SANDBOX=1`, with the runner's root-owned marker; never set it yourself): run `npm run sandbox-preflight -- --run-input <file>` first and `npm run sandbox-result -- --run-input <file>` last, and follow [`skills/replatform/reference/sandbox-mode.md`](skills/replatform/reference/sandbox-mode.md).
- Check the plan's consistency with `npm run analyze-plan -- .aifactory/replatform-plan.json` and list unfinished plan items with `npm run converge -- .aifactory/replatform-plan.json`.

For local tools that do not auto-discover skills, explicitly load the skill and every reference it
links to from this checkout. Do not infer a platform standard when the reference says it is missing
or proposed.
