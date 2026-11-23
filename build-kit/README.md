# AI Factory build kit

Draft 0.1 (2026-10-27). These rules are for people, and their AI tools, who build an app that
itm8 will later replatform and host on AI Factory. They follow them from the start, so the
[replatform agent](../skills/replatform/SKILL.md) finds little to change.

[AGENTS.md](AGENTS.md) is the inverse of the agent's checks. Each rule exists because the agent
would otherwise make that change after the app is built: the
[allowed app changes](../skills/replatform/reference/app-changes.md), the
[platform rules](../skills/replatform/reference/platform-rules.md) and the
[risk questions](../skills/replatform/reference/risk-questions.md). The rest come from the Wizard
templates and the always-on controls in the platform repo. If you change one of those, change the
build rules in the same pull request.

[PERFORMANCE.md](PERFORMANCE.md) sits next to `AGENTS.md` and covers speed, scale and resilience:
rendering and loading, network, caching, database, resilience and measuring. It is a separate file
because `AGENTS.md` is close to the 12,000-character limit. It follows the same platform limits:
no state in memory, nothing longer than 30 seconds, and Redis, a `worker`, scheduled work, email and
a CDN are "ask itm8" because the Wizard templates do not offer them for every app yet.

[GUARD.md](GUARD.md) is the gate every change passes before code is written, for people and for
AI tools: the agreed scope, the "stop and ask" list, a one-line note per trust boundary with a
refusal test, then the smallest change that fully works. It puts the build rules first, security
second and the smallest change last, so a tool that is told to write less never drops a control.
The [replatform agent](../skills/replatform/SKILL.md) runs the same gate on every `APP-###` change,
and the `aifactory-code` plugin pins it, adds it to the feature plan as gate G7 and blocks known
unsafe code at write time. The ladder is adapted from Ponytail (MIT) and the boundary method from
Cloudflare's security-audit skill (MIT); the wording here is itm8's. Since version 0.2 it also
holds the actions that need a person first (force pushes, deletes, production), the current
versions rule and the web Baseline target. They are in the gate because `AGENTS.md` has no room
left under the 12,000-character limit.

[hosted-builders.md](hosted-builders.md) is the short version for builders that run their own
backend. There the app cannot meet every rule, so the goal is a mechanical move: sign-in, data
access, AI calls and settings each in one module, and server functions that only wrap plain code.

## Where the file goes

| Tool | Use | Put it here |
|---|---|---|
| GitHub Copilot, Cursor, Codex, Antigravity | AGENTS.md, PERFORMANCE.md, GUARD.md | All in the repository root (Antigravity: one rules file each) |
| Claude Code | AGENTS.md, PERFORMANCE.md, GUARD.md | All in the root, plus a `CLAUDE.md` that contains `@AGENTS.md`, `@PERFORMANCE.md` and `@GUARD.md` |
| Lovable, Base44, Bolt.new, Replit | hosted-builders.md | The project repository, under the rules file name the builder reads (listed in the file) |
| Emergent, v0 and other hosted builders | hosted-builders.md | The custom instructions, or the first prompt (the fallback) |

In a hosted builder the text is guidance, not enforcement. The builder may still choose its own
backend, and a person must check that before itm8 takes the app over.

## Where the rules work around the platform

Some rules say "ask itm8" because the Wizard templates do not support the case yet:

- `worker` and scheduled work: a worker has no ingress and no scale rule, so on Basic (0 replicas)
  it never starts, and on Standard or Premium a timer runs once per replica.
- `api`: only `web` gets Easy Auth, and nothing yet lets `api` prove a call came from `web`.
- File storage and PostgreSQL extensions: no app storage account, and no extension is allow-listed.
- The gateway cancels a request after 30 seconds. Streaming through it is not tested yet.

When the platform closes one of these, change the rule in the same pull request.

## Rules for the files themselves

- Each stays under 12,000 characters, so it fits one Antigravity rules file. Check the length
  whenever you change one; nothing in this repository enforces it.
- They are copied into customer repositories, so they have no relative links and name no
  customer, resource or secret.
- They never choose a zone. "Build to Yellow" is a default for building, and itm8 confirms the
  zone.
- The "This project" block is the only part that changes per customer. Later the Wizard fills it
  in.
- A rule in both files says the same thing in both.
