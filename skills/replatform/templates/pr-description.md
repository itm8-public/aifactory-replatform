## Replatform: {solution name} → {target}

Plan: `.aifactory/replatform-plan.md`
Validation: `.aifactory/validation-report.md`

### What changed

- `APP-###` → `{targetSpecField}`: {change, path, evidence ids}

### Checks

| Check | Result | Log or report section |
|---|---|---|
| Build | {PASS / FAIL / WARN / SKIPPED / NOT RUN} | |
| Tests | | |
| Change gate: refusal tests and security pass | | |
| SAST | | |
| IaC scan | | |
| Secret scan | | |
| Dependency audit | | |
| SBOM | | |
| Image / provenance | | |
| Migration / restore | | |

### Reviewer checklist

The reviewer ticks an item only after checking it; an unticked item is not an approval.

- [ ] Every `APP-###` item is done, or the reason is written below
- [ ] Every trust-boundary line in the plan's change gate has a refusal test that ran and passed
- [ ] The analyze and converge warnings below were read
- [ ] Data classification and the suggested zone match what the owner said
- [ ] No outside host, secret value or platform file was added
- [ ] The compatibility boundaries still hold

### Analyze and converge

{Paste the `WARN` lines from `analyze-plan` and the items `converge` still lists, or "none".}

### Residual risk and exceptions

{Every failure, warning, skipped, or not-run check; who owns it; and why the pull request remains
draft or can move to human release review.}

### Rollback

{How to undo application code, handle a failed migration, and restore data. Link evidence rather
than asserting it was tested.}

### Not done by the agent

- Platform files: generate them in the AI Factory wizard from `.aifactory/ai-factory.json` after
  the zone is confirmed.
- Deployment: through the reviewed pipeline, dev → test → prod, only after human release approval.

<!-- Keep under 4,000 characters. -->