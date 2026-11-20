# Apps built with the AI Factory code plugin

The `aifactory-code` plugin helps people build a new app
to the build rules (`build-kit/AGENTS.md` in this repository) from the first prompt. Its apps carry
`.aifactory/build-profile.json`. When you find one, you are replatforming an app that tried to
follow the rules, so expect few changes and check that it really does.

## The profile is a claim

Read the file in discovery and write each value into the evidence ledger as an **owner claim**, not
a fact: the person who built the app wrote it, and the code may have drifted since.

| Profile field | What it claims | How you check |
|---|---|---|
| `kit.version`, `kit.commit` | Which build rules the app followed | Compare with the rules in this repository's `build-kit/`; an older kit is a finding only if a rule changed |
| `generator` | Which plugin version scaffolded it | Informational |
| `zone.assumption`, `zone.confirmed` | A zone the builder assumed | Never use it. You suggest the zone from the risk answers; a person confirms it |
| `personalData`, `users` | The builder's answer to Q1 and Q2 | Check the code (tables, forms, sign-up routes) and answer from that |
| `aiToolConsent` | The customer recorded consent to AI build tools | `missing` means stop (see "Customer consent" below) |
| `apps[]` (port, health path, Easy Auth, database, AI, settings, migration command) | The shape of each app | The build check and the code |
| `askItm8[]` | Needs the platform could not meet yet | Copy open items into the plan's `questions`; do not answer them |

A value that the code contradicts is a finding with the file as evidence. A value the code cannot
confirm stays a claim.

## Build check as evidence

If the plugin's build check is available, run it offline on the repository:

```text
node <plugin>/scripts/build-check.mjs <repository folder> --json
```

It is read-only and needs no network. Record it as tool-reported evidence: one line per rule id
(`AF-01` to `AF-25`) with `PASS`, `FAIL`, `WARN` or `WAIVED`. A `FAIL` becomes a finding that cites
the rule and the file it names. A `WAIVED` rule needs the waiver's reason and end date in the
ledger; an expired waiver counts as its original result. If the check is not available, record
`unavailable:build-check` and do the same checks by reading the code. Never write that the app
"passes the build rules": say which rules ran and which result each gave.

A clean check does not replace your own discovery. It does not test the zone, the data, the
migration or the Wizard fields.

## Customer consent

Claude Code and other AI tools process whatever they read. Work on a customer's code only when the
customer has recorded consent to AI build tools in the engagement. In an integrated run the
engagement says so; in a manual run, ask the owner and record the answer. A profile with
`aiToolConsent: "missing"` and no later consent: stop and tell the owner.

## What the profile does not decide

The plugin's rules are a draft. Where this playbook's platform rules differ, the platform rules
win; name the difference in the plan.
