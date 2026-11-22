# App proposal (contract C2)

The agent puts the apps it found into `assessment.draft.appProposal` as typed values, so the
Wizard's Apps step can show a field-by-field difference and a person can apply it. The same shape
comes out of the Management App's quick scan (`source: quick-scan`); the agent writes
`source: replatform-agent`. `targetSpecDelta` stays for free-text notes and for everything that is
not an app field.

The shape is [app-proposal.schema.json](../schemas/app-proposal.schema.json), a mirror of the
Management App's shared app-proposal schema. `npm run validate-plan` checks it, and the Management
App checks it again when the assessment is posted.

## One rule: a value has evidence

Every value the proposal states has an `evidence` entry for its field: **a file in the package and
the reason**, never the file's content. A value the code does not name is `null` (or an empty list,
or `false`), never a guess. The Wizard keeps its own default for a `null`.

| Field                   | Decide it from                                                                                                                                                                                                     | Evidence `field` |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `name`, `root`          | The folder the app lives in; a short lowercase name (letters, digits, hyphens, at most 10) from the project or folder. Two apps never share a root.                                                                | `app`            |
| `kind`                  | `web`: serves pages to browsers. `api`: serves HTTP to other software. `worker`: no inbound HTTP (queue, schedule, batch). Decide from the framework, the entry point and the project SDK.                         | `kind`           |
| `port`                  | The port the process listens on: Dockerfile `EXPOSE`, `--port`, `PORT` fallbacks, launch settings. `null` for a worker or when nothing names one.                                                                 | `port`           |
| `healthPath`            | A route that answers 200 when the process is up: `/health`, `/healthz`, `MapHealthChecks`. `null` when none exists. If one is needed, propose it as a code change in the plan, not here.                          | `healthPath`     |
| `settings`              | The **names** the code reads from the environment or configuration, with `secret: true` for credentials, connection strings, tokens and keys. Names only: never a value, not even an example value.              | `settings`       |
| `database`              | `true` when the app reads or writes a database server or file database the platform must replace or provide (drivers, ORMs, connection strings).                                                                  | `database`       |
| `ai`                    | `true` when the app calls a model or an AI SDK. This is a flag, not a risk answer: the risk questions and the zone still follow their own rules.                                                                  | `ai`             |
| `confidence`            | `high` when kind, port and health path are each evidenced; `medium` when one of them is open; `low` when the kind itself is a judgement. Lower it when the evidence is indirect.                                  | —                |

Not part of C2, so not in the proposal: **easyAuth** and **hosting**. Sign-in and the hosting
target are decisions with their own gates: put the recommendation in `targetSpecDelta`
(`apps[n].easyAuth`) and in `hosting` of the plan, each with evidence, as before.

## Notes

`notes` holds what the analysis could not decide, in plain words (at most 20, 300 characters each):
a second candidate app, a port that differs between files, a database the platform has no template
for. A note is never a compliance claim and never a secret.

## What the validator refuses

- A schema violation: name rule, port range, kind, confidence, unknown fields, more than 20 apps.
- A stated value with no evidence for its field (the `app` field also covers the kind).
- Evidence that is not a relative file inside the package, or has no reason.
- Two apps with the same name or the same root; a setting listed twice or written as `NAME=value`.
- Anything that looks like a secret in a name, path or note.
- `source: quick-scan` in a plan: the quick scan is the Management App's.
