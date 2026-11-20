# Sandbox mode

Sandbox mode is for a run that a **runner** started inside a sandbox, with nobody at the keyboard
and no Management App connection. The runner puts the run's context in files; you read them, work
in the repository, and leave a result file. It is off by default. A run by hand, and a run that a
Management App issue started, do not use it and do not change.

**This file is guidance. The control is the runner:** it writes the marker, starts you as a
non-root user, runs `sandbox-preflight` before you and `validate-plan` and `validate-implementation`
with `--sandbox` after you, and enforces the limits. Nothing you read here, and no script, can make
a run safe by itself.

## Switching it on

| What | How |
|---|---|
| The mode | `--sandbox` on the scripts, or `AIFACTORY_SANDBOX=1`. Any other value is off. Never set it yourself. |
| The marker | A file the runner wrote as root before the run. Path: `--marker` or `AIFACTORY_SANDBOX_MARKER`, default `/etc/aifactory/sandbox-run.json`. Content: `{ "schemaVersion": 1, "runId": "<the run input's runId>" }` and nothing else. |
| The run input | `--run-input <file>` or `AIFACTORY_RUN_INPUT`. The runner names it. |
| The result | `--result` or `AIFACTORY_RUN_RESULT`, default `.aifactory/sandbox-result.json`. |

The scripts refuse (exit 3) unless the marker is a regular file (not a symlink) that root owns, that
no group or other can write, and that names this run, and unless the process is not root. Where file
ownership cannot be verified (Windows) they refuse as well. Never create, copy, link or change a
marker. If a script refuses, stop and say why; do not look for another way in.

## What you do

1. Run the preflight from the root of the assessed repository (the plan and result paths are relative
   to the working directory): `node <playbook>/scripts/sandbox-mode.mjs preflight --sandbox --run-input <file>`.
   `npm run sandbox-preflight -- ...` is the same from a checkout of this playbook. It prints one JSON line. On `ok: false` stop (exit 1 invalid, 3 refused). On success it names the
   intent, the source class, the C1 fields still open, the question limit and where to start.
2. Read the run input file. **Do not call any `replatform_*` tool**: not for the engagement, the
   policy snapshot, the allowed source connections or the audit timeline, not to ask a question and
   not to post an assessment. The orchestrator does all of that. Do not comment on an issue.
   `engagement`, `policy` and `source` are the engagement, the policy snapshot and the source as the
   runner verified them. `discovery`, `prerequisiteRoles` and `buildProfile` are context and claims:
   never evidence about the code, and never a zone, region or capacity decision.
3. C1 is `engagementInput`, unchanged: [engagement-input.md](engagement-input.md) applies as it
   stands. Ask only for the fields in `missing`, and never for `source`, which the run holds. A
   value C1 holds is an answer, not a repository fact. The zone stays a suggestion.
4. Replace Phase 0 steps 1 and 2 with the run input: it is the intake record, and the runner only
   accepts a synthetic or internal source. In the plan write `intake.kind: "zip"`,
   `intake.packageSha256` exactly `source.sha256` (the result script refuses a plan about another
   source), `intake.revision` as `source.intakeImportCommit` or `unknown` when that is null, and
   `ownershipConfirmed: true` with the evidence `sandbox run, <source.class> source`.
5. Phase 1 and Phase 2 as written. There is no owner to ask: the open questions go in the plan's
   `questions` with `why` and `options`, and are not posted anywhere. `questions` is the plan status
   only while at least one question is open; with nothing open and nothing to ask, leave it `draft`.
   **Never write `answer` or `answeredBy` on a question, and never give a risk answer the source
   `owner` or `owner:` evidence:** nobody answered, and the result script refuses such a plan. A risk
   question the code cannot answer stays `unknown`, and is asked.
6. **Stop after the phase the intent names.** `assess` ends after Phase 2. `plan` ends after
   Phase 3, with the plan at `awaiting-approval` and `validate-plan --sandbox` passing; never
   `approved` (a person approves the *result*, in the Management App, not you). `rebuild` and `security-only` are refused until the Phase 4
   slice: there is no Phase 4, no `validate-implementation` work and no `ai-factory.json` in sandbox
   mode yet. Skip the Phase 3 posting step: the orchestrator posts.
7. Run `node <playbook>/scripts/sandbox-mode.mjs result --sandbox --run-input <file>` last (or
   `npm run sandbox-result -- ...`). It writes the result file from the run input and your plan; you
   do not write it and must not edit it.

## Needs input and resume

The run ends `needs-input` after assess when C1 leaves a field open (not counting `source`) or when
the plan is at `questions` with unanswered questions. It never asks more than **ten** questions
(owner decision OD-6), and an open C1 with no question in the plan is an error, not a result.

When there are more than ten, keep these and leave the rest `unknown`, to be asked in the next run:

1. the open C1 fields, one question each, in the order C1 lists them;
2. then the risk questions with the highest impact on the zone: A1, Q2, Q3, Q4, Q5, then the rest
   of [risk-questions.md](risk-questions.md) in table order.

Write the questions in that order; the result keeps the plan's order. Set the plan to `questions`,
write nothing past Phase 2, and run the result script.

A second run resumes from the last good step. The preflight reports `resume.from`:

- `classify`: the plan on disk validates at `questions` and the earlier result file is a needs-input
  result for the same engagement and the same `source.sha256`. Skip Phase 1, keep the evidence
  ledger and the plan facts, re-read C1 from the new run input, and redo Phase 2 for what is still open.
- `discover`: anything else. Start fresh. A run never resumes over a different source, and a plan
  or result file that came with the source is not trusted.

The run input has no channel for an answer yet. A value that C1 now holds settles its field: drop
that question from the plan; do not record an answer on it. Other questions stay open and their
risk answers stay `unknown`.

## The result file

[sandbox-result.schema.json](../schemas/sandbox-result.schema.json): `schemaVersion`, `runId`,
`engagementId`, `status` (`needs-input` or `completed`), `step` (`assess` or `plan`; `needs-input`
is always `assess`), `intent`, `source.sha256`, `policy` (`snapshotId`, `version`, `sha256`) and
`questions` (`id`, `text`, `why`, `options`; at most ten, no answers). It carries no approval and no
source content. The script fails (exit 1) when the plan is invalid or about another source, when a
question carries an answer or a risk answer names an owner (`plan-owner-answer`), when a `completed`
run did not leave the plan at `draft` (assess) or `awaiting-approval` (plan), and when there are
duplicate question ids, more than ten questions, or an open C1 and no question.

## Limits and customer code

`limits` (`maxTurns`, `stepTimeoutSeconds`, `runTimeoutSeconds`) are enforced by the runner from
outside. You only read them: do not try to raise, extend or work around one.

Customer source is refused (owner decision OD-3): `source.class` must be `synthetic` or `internal`,
and a missing or unknown class is refused too. Do not process customer code in sandbox mode, and do
not change a run input to make it pass.

## For the runner

Exit codes: 0 ok, 1 invalid, 2 usage (including "sandbox mode is off"), 3 refused. Both validators
accept only `--sandbox`, `--marker <file>` and `--run-input <file>` before the plan path: any other
option, `--sandbox=true` or a misspelling such as `--sandbx` is exit 2, never a pass. Refusal codes
start with `marker-`, `process-is-root`, `platform-unsupported`, `mode-not-sandbox`,
`source-class-`, `intent-unsupported`; invalid ones are `input-`, `engagement-`, `source-hash-`,
`plan-`, `too-many-questions` and the like. The scripts do not authenticate anyone: keep the marker
directory, the marker and the run input root-owned and not writable by the run user, start the
agent as a different user than root, and run the preflight, the result script and the validators
yourself instead of trusting what the agent says it ran.
