# Validation protocol

Validation reports must make a failed or unavailable control as visible as a passing one. A plan is
not implementation evidence, and a command that was not run cannot be reported as passing.

## Status vocabulary

| Status | Meaning |
|---|---|
| `PASS` | The command ran against the stated target and met its criterion. |
| `FAIL` | The command ran and did not meet its criterion. |
| `WARN` | The command ran but produced a reviewable non-blocking result. |
| `SKIPPED` | The check is not applicable; explain why. |
| `NOT RUN` | The check should have run but did not; explain the blocker. |

## Evidence for each check

For every validation entry record the command, target/revision, result status, concise output
excerpt or log link, baseline comparison where relevant, and the pass criterion. Do not collapse
`SKIPPED` or `NOT RUN` into `PASS`.

During discovery, do not install dependencies, start the application, migrate data, deploy, or
contact a customer environment. Once the plan is validated, run the six checks in
[app-changes.md](app-changes.md#checks-before-the-pull-request-leaves-draft), together with the
application's existing build and test commands where safe. A failed, skipped, or not-run required
check keeps the pull request draft unless the reviewer records an explicit exception.

Before a draft PR is ready for review, run the scope check:

```text
npm run validate-implementation -- .aifactory/replatform-plan.json
```

It checks every changed application path against the plan's `APP-###` item, target-spec field,
evidence, and `allowedPaths`. A failure keeps the PR draft.

Use [../templates/validation-report.md](../templates/validation-report.md) and link it from the
pull request description. Report migration and restore evidence separately; a successful schema
migration alone does not prove recoverability.