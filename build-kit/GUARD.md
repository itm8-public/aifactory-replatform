# AI Factory change gate: scope, security, smallest change

Version 0.2 (draft, 2026-11-17). From itm8. Keep this file in the repository root next to
`AGENTS.md`. Run it before you write or change code, every time: a one-line fix takes a minute, a
feature runs the same steps in its plan. It joins three things into one order so they never pull
against each other: the AI Factory build rules (`AGENTS.md`, `PERFORMANCE.md`), a security pass on
every trust boundary the change touches, and the smallest change that fully solves the task.

## Who wins when they disagree

1. The build rules, with their "Stop and ask" and "Ask itm8" lists.
2. Security controls at trust boundaries (step 3 below).
3. The agreed scope: the task, the plan, its allowed paths.
4. The smallest change (step 4 below).

A change made smaller by weakening 1 or 2 is not smaller, it is wrong. What the build rules require
counts as asked for: a health check, an audit row, a test per endpoint, an evaluation set, a rate
limit. Never cut these to save lines: validation at trust boundaries, error handling that prevents
data loss, permission checks, accessibility, or anything the person asked for.

## Before you write

### 1. Scope

- Say your assumptions, and agree on a result that can be checked. When the request is unclear,
  ask. Never guess.
- A new project: first ask whether the need is best met by an app, by an agent (for example a
  Microsoft 365 Copilot or Foundry agent) or by a product the organisation already has.
- Read the task and the code it touches. List every place the change must reach: callers, tests,
  migrations, settings, exports, the README.
- Stay inside the agreed scope. When the change has to go further (another path, a new table, a
  new outside service), update the plan or ask first. Never widen it silently.
- A bug: reproduce it with a failing test first, find every caller of the code you touch, and fix
  the cause once, in the shared code.

### 2. Stop and ask

Check the "Stop and ask" and "Ask itm8" lists in `AGENTS.md` against this change. If one applies,
stop, say what you found and wait for a person. Never build around it.

Also stop and ask a person before any of these actions, and never do one to make a check pass:

- A force push, rewriting published history, or deleting a branch or tag.
- A recursive delete outside the project folder. Deleting a cloud resource or a resource group
  (`az group delete`, `az ... delete`, `azd down`, `terraform destroy`, `kubectl delete`).
- Dropping or truncating a database or a table, or a migration that removes or rewrites existing
  data.
- Changing branch protection, or editing CI, deployment or infrastructure configuration as a side
  effect of another change.
- Running your tool with permission checks disabled (for example "dangerously skip permissions"
  or "yolo" modes), piping a download into a shell, or installing a tool from an unknown source.
- Deploying to production, or changing identity, access or network exposure.

### 3. Trust boundaries

A trust boundary is where input from someone with less trust reaches something with more: a page
or route, an MCP or agent tool, a form field or uploaded file, a webhook or queue message, a model's
answer, a reply from another service, a migration. For each boundary the change adds or touches,
write one line before any code:

`<who, with less trust> sends <what> to <where>; <control> decides; it must never <outcome>.`

For example: "A signed-in user without the Approver role sends POST /api/orders/:id/approve; the
server's role check decides; it must never approve an order." A change that touches no boundary
says "No boundary".

Then check each class that fits the line:

- **Access.** The server checks the signed-in user and the role on every action. Records are
  read together with their owner or tenant, so changing an id in a URL never shows someone
  else's data. Hidden buttons are not checks.
- **Injection.** Queries take parameters. HTML comes only from the framework's escaping, never from
  a string with user input in it. User input never reaches a shell command, a file path, `eval`
  or a template that runs code.
- **Requests the server makes.** The server never fetches a URL a user chose. Outside hosts are a
  fixed list in code.
- **Cross-site.** Data changes only with `POST`, `PUT`, `PATCH` or `DELETE`, a JSON body and an
  `Origin` check. No CORS.
- **Secrets and identity.** No secret in code, front end, logs or test data. Azure access uses the
  managed identity. TLS certificate checks stay on.
- **AI and agents.** A model's answer is untrusted input, because a prompt can be injected through
  any text it reads. The answer never chooses the tool list, a URL, a SQL statement, a recipient
  or a permission. Tool arguments are validated like a form. A tool that sends, pays, writes or
  deletes waits for a person's approval in code.
- **Data and tenants.** Every query, export, search and cache is scoped to the user's owner or
  tenant. Logs, errors and traces carry no personal data. Deleting removes every copy.
- **Abuse and cost.** Size, count and rate limits per user on anything expensive: AI calls,
  exports, search, uploads.
- **Supply chain.** No new dependency for a few lines. A new one is maintained, not deprecated,
  free of known high or critical vulnerabilities, pinned by the lock file and has no install
  script from an unknown source. A new CI action is pinned to a full commit SHA.
- **Failure.** When a check errors or times out, deny. Never fall back to allow.

### 4. Smallest complete change

Take the first rung that fully works within steps 1 to 3:

1. Does it need to exist? Skip features, options and flexibility nobody asked for, and name what
   you skipped in one line.
2. Is it already in this codebase: a helper, component, route or pattern? Reuse it, if it keeps
   the controls from step 3.
3. The standard library or the platform: the framework, PostgreSQL, Easy Auth, and in a web front
   end a built-in web platform feature inside the Baseline target (below) before a polyfill or an
   extra library.
4. A dependency the project already has.
5. Otherwise, the least code that works and that a reader understands at a glance.

Deleting beats adding. No refactors, renames or upgrades nobody asked for: note them as
suggestions. A major version upgrade is its own change, never a side effect. A shortcut you take
on purpose gets one comment: `shortcut: <the limit>, <when to change it>`.

### 5. Plan the proof

- A test that shows the change works.
- For each boundary line from step 3, a test that tries to cross it and is refused: no sign-in,
  a missing role, another owner's id, bad or oversized input, a tool action without approval.
  A control without a test that tries to break it is unfinished.
- The build check rules the change touches.

## While you write

- Keep to the plan. When it turns out wrong, change the plan first, and run steps 2 and 3 again
  if a boundary moved.
- Never weaken a control to make something pass: no switched-off sign-in outside the local
  stand-in user, no looser Content-Security-Policy, no disabled TLS checks, no deleted or skipped
  tests, linters, scanners or hooks (`--no-verify`).
- When a guard or hook blocks a write, fix the cause. Never work around it by splitting, encoding
  or renaming the text.

## Current versions

- Before you add or use a framework, library, SDK, API or cloud service, look up its current
  stable version and its official documentation: the vendor's docs, Microsoft Learn for Azure and
  Microsoft products, the package registry. Never write a version, an API or configuration from
  memory.
- A new project starts on the current stable or LTS release of its runtime and framework.
- No downgrade, and no pin to an old major version, without a written reason in the pull request.
- If the session has a documentation lookup tool (for example a Microsoft Learn or library-docs
  MCP server, or a web search), use it. If it has none, say that the version was not checked.

## Web platform baseline

For a project with a web front end:

This project's Baseline target is Baseline Widely available.

Where your tool supports skills, itm8 recommends the "Modern Web Guidance" skill from the
GoogleChrome/modern-web-guidance repository (code Apache-2.0, guides CC BY 4.0) as the reference
for current HTML, CSS, JavaScript, accessibility, performance and security practice. Install it
with telemetry switched off (`DISABLE_TELEMETRY=1`). This is a recommendation, not a rule.

## After you write

1. Run the tests, lint, type check and the build check.
2. Security pass on your own change: read each boundary line against the code, sad paths
   included. Does the code refuse what the line says it refuses?
3. Report what ran, with `PASS`, `FAIL`, `WARN`, `SKIPPED` or `NOT RUN`. Never call the change
   "secure" or "compliant".
4. End with one or two lines: what you skipped or did not check, and any risk the person must
   know.

## Findings

- A security finding names who, the boundary crossed and what happens, with the file and line.
  Without those it is a lead to check, not a finding, and it has no severity.
- A missing build-rule control, such as a header or an audit row, is a build-rule failure. Report
  it as one, not as a vulnerability.
- Never test a running system from your coding tool: no deployed app, customer environment or
  production identity. Live testing is itm8's Security Check, under a signed authorization.
- Before handover, itm8 runs a full source audit (the security-audit skill, source only, target
  code run only in a sandbox). Each confirmed finding is fixed, or a person accepts it in writing.

## Before you hand over

- [ ] Every change went through this gate; the plan or pull request holds its boundary lines.
- [ ] Every boundary line has a refusal test, and it passes.
- [ ] The full source audit ran; each confirmed finding is fixed or accepted by a person.

The smallest-change ladder is adapted from Ponytail by Dietrich Gebert (MIT licence). The
trust-boundary method is adapted from Cloudflare's security-audit skill (MIT licence).
