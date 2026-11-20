# AI Factory build rules

Version 0.1 (draft, 2026-10-27). From itm8. Keep this file in the repository root.

This app will run on itm8's AI Factory platform in Azure. Follow these rules from the first line of
code so that it can move there without a rewrite. When a request conflicts with a rule, follow the
rule, tell the person which rule, and suggest the nearest allowed way. Also follow `PERFORMANCE.md`
in the repository root: rules for speed, scale and resilience.

## This project

Your itm8 contact fills this in. Until then, use the defaults shown.

- Zone: **not confirmed, so build to Yellow** (Green, Yellow or Red; a person at itm8 confirms it)
- Service level: basic (basic, standard or premium)
- Users: internal only, or also people outside the organisation
- Apps: `web` only
- Database: PostgreSQL, yes or no
- AI: Azure AI Foundry, yes or no
- itm8 contact: (name)

## Stop and ask a person first

Do not build around these. Stop, say what you found, and wait for an answer.

- The app reads or stores **personal data**: names, e-mail addresses, phone numbers, personal
  identity numbers, addresses, employee data. That makes it a Red zone. Use synthetic data only
  until itm8 confirms the zone.
- Health, biometric, religion, trade-union or children's data, or data under sector rules (NIS2,
  DORA, finance, public sector).
- AI that makes or shapes decisions about people (hiring, credit, grading, scoring), or AI that
  acts in other systems (sends, pays, writes or deletes).
- Social scoring, hidden manipulation, or biometric identification in public spaces. Never build
  these.
- A third-party service that would receive the app's data (SaaS APIs, analytics, e-mail, chat).
- Real customer data in a prompt, a seed file, a test or a screenshot.

## Shape of the app

- One app, `web`. Its container serves the built front end and the server routes, and it is the
  only part a browser reaches, through itm8's web application firewall (WAF). The browser calls
  only `web`, on the same origin, so no CORS.
- Ask itm8 before you add any of these. The platform does not yet support them for every app:
  a second app (`api` or `worker`), scheduled work, file storage, a PostgreSQL extension.
- Scheduled work is a command that runs once and exits, never a timer inside a server. Two copies
  may run at once, so take a database lock.
- No serverless or vendor backends: no Supabase Edge Functions, Firebase, Vercel or Netlify
  functions, or Base44 entities and functions.
- Each app is a Linux container with its own `Dockerfile`: multi-stage, a base image pinned by
  digest, a non-root user, a small final stage. It listens on `0.0.0.0:8080` only. App names are
  lowercase letters, digits and hyphens, at most 10 characters.
- `GET /healthz` returns 200 quickly, without sign-in and without calling the database. You may
  add `GET /readyz`, which also checks the database.
- Start within a few seconds. On `SIGTERM`, finish open requests and exit within 30 seconds. On
  Basic the app scales to zero and wakes on the first request.
- The gateway cancels a request after 30 seconds. For longer work, start it, answer at once, and
  let the browser poll for the result. Streaming through the gateway is not tested yet.
- Stateless: no sessions or caches in memory, and no files on the container's disk. Any replica
  may serve any request, and a restart loses the disk.

## Configuration and secrets

- Read every setting from an environment variable. Check them once at startup and fail with a
  message that names what is missing, never a value.
- Commit a `.env.example` with names only, and keep `.env` in `.gitignore`.
- Never commit secrets, API keys, tokens, or connection strings with passwords. Never put a secret
  in front-end code. Anything the browser loads is public, including `VITE_*` and `NEXT_PUBLIC_*`.
- In Azure each secret comes from Key Vault as an environment variable. List its name in
  `.env.example` with a comment.
- The platform sets these names, so do not define them: `APP_ENVIRONMENT` (`dev`, `test` or
  `prod`), `AZURE_CLIENT_ID`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGSSLMODE`,
  `DB_RUNTIME_ROLES`, `AZURE_OPENAI_ENDPOINT`, `AZURE_AI_PROJECT_ENDPOINT` and every `<NAME>_URL`.

## Azure access: no keys, no passwords

- Use `DefaultAzureCredential` (or your language's equivalent) for every Azure service. In Azure
  it uses the app's managed identity, on a laptop the developer's `az login`.
- Never use storage account keys, OpenAI or Foundry API keys, or database passwords.

## Sign-in and permissions

- People sign in with Microsoft Entra ID before a request reaches `web`. Every page and endpoint
  except `/healthz` needs a signed-in user. There are no public pages.
- On the server, read the user from the `X-MS-CLIENT-PRINCIPAL` header (base64 JSON). Identify
  users by object ID (`X-MS-CLIENT-PRINCIPAL-ID`), never by e-mail or name.
- People outside the customer's organisation sign in as guests in the customer's Entra tenant.
  Build no login, sign-up, invitation links or passwords. Do not use Supabase Auth, Firebase Auth,
  Clerk, Auth0 or a builder's own user system.
- When a browser request fails because the sign-in expired, reload the page. Sign out through
  `/.auth/logout`.
- For local development only, allow a stand-in user that turns on only when `DEV_AUTH_BYPASS=true`.
  The app must refuse to start with it when `APP_ENVIRONMENT` is set.
- Check permissions on the server for every action, using Entra app roles from the user's claims.
  List the roles in the README. Hiding a button is not a permission check.

## Data

- Use PostgreSQL only: no SQLite, MongoDB, Firebase, JSON files or browser storage for business
  data. If your builder gives you Supabase, use only its tables, SQL and migrations: no queries
  from the browser, no row-level security that calls `auth.uid()`, nothing in the `auth` or
  `storage` schemas.
- No PostgreSQL extensions without asking itm8. Use the built-in `gen_random_uuid()` for IDs.
- Connect with an Entra token, not a password. The user is `PGUSER`, the password is a token for
  `https://ossrdbms-aad.database.windows.net/.default`, and SSL is required. Tokens expire, so
  let the connection pool fetch a fresh one for each new connection.
- Change the schema only through migration files (Prisma, Drizzle, EF Core, Alembic, Flyway or
  Django), run by a separate command such as `node dist/migrate.js`. It ships in the app's image,
  and the platform runs it as a job under its own identity.
- The running app only reads and writes data. Never create tables or migrate at startup.
  Migrations grant `SELECT`, `INSERT`, `UPDATE` and `DELETE` to the roles in `DB_RUNTIME_ROLES`.
- Seed, demo and test data are synthetic. Never use a copy of production data.

## AI

- Use Azure AI Foundry models only, through `AZURE_OPENAI_ENDPOINT` or `AZURE_AI_PROJECT_ENDPOINT`
  with the app's identity. Read the deployment name from a setting such as `AI_CHAT_DEPLOYMENT`.
  Deployments are EU Data Zone or regional, never Global.
- Never call OpenAI.com, the Anthropic API, Gemini or another provider directly, or a model from
  the browser.
- Keep all model calls in one module, so the provider, logging and limits are in one place.
- A content filter may block a prompt or an answer, and the token limit may answer 429. Both are
  normal: show a clear message, and retry a 429 after the time it gives.
- Limit how often each user calls the AI, keyed on their object ID and kept in PostgreSQL.
- Do not log prompts or answers that contain user content, or store completions with the provider.
- Tell people when they chat with an AI or see content it generated.
- The tools the AI may call are a fixed list in code. Before a tool sends, pays, writes or
  deletes, the code waits for a person to approve. A prompt instruction is not enough.
- An agent endpoint or MCP server needs a signed-in user like any other endpoint.
- Keep an evaluation set in `evals/`: at least 20 synthetic questions with expected answers, and
  a command that scores them. itm8 runs it before each release.

## Logging and errors

- Log to stdout as structured JSON, one event per line, with a request ID.
- Never log secrets, tokens, cookies, personal data or whole request bodies.
- Users see a short error message and an ID. Stack traces go to the log only.

## Web security

- Validate input on the server. Use parameterized queries. Never put user input into HTML,
  SQL or a shell command unescaped.
- Send security headers: a Content-Security-Policy without inline scripts and with
  `frame-ancestors 'none'`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`.
- Sign-in uses a cookie, so guard against cross-site requests: change data only with `POST`,
  `PUT`, `PATCH` or `DELETE` and a JSON body, and check the `Origin` header.
- The WAF can block bodies that look like HTML or SQL. Store rich text as Markdown or JSON, and
  test saving it early.
- Your own cookies are `Secure`, `HttpOnly` and `SameSite`. No tokens in `localStorage`.

## Build, test, dependencies

- Commit the lock file. `build`, `test` and `lint` run without prompts, for example
  `npm run build`, `npm test` and `npm run lint`.
- Write at least one test per endpoint and per migration.
- Use maintained packages and pin their versions. These pass before handover: a secret scan
  (gitleaks), a dependency audit with no critical findings (`npm audit`, `pip-audit` or
  `dotnet list package --vulnerable`), and static analysis (CodeQL or Semgrep).
- No infrastructure or deployment code: no Bicep, Terraform, ARM, Kubernetes manifests or deploy
  pipelines. itm8's Wizard generates them. A workflow that only builds and tests is fine.

## What changes per zone

- Green: internal users, no personal data. The rules above.
- Yellow: external users or business data, still no personal data. The rules above. In production
  a customer IP allow-list may sit in front of the app.
- Red, only after itm8 confirms it: personal data is allowed. In addition, list every outside host
  the app calls (all other outbound traffic is blocked), keep an audit log of who read or changed
  personal data, and support data retention and deletion. The region is Sweden Central only.
- Service level changes capacity only: Basic runs 0 to 2 replicas, Standard 1 to 3, Premium 2 to
  10. The app must be stateless at every level.

## Before you hand over

- [ ] Each app builds into a container that starts with only the settings in `.env.example`.
- [ ] `/healthz` answers without sign-in on port 8080, and the app stops cleanly on `SIGTERM`.
- [ ] No browser request takes longer than 30 seconds.
- [ ] Migrations run as their own command, and the app never changes the schema.
- [ ] No own login system. Users come from `X-MS-CLIENT-PRINCIPAL`, keyed on the object ID.
- [ ] Build, tests, lint, secret scan, dependency audit and static analysis pass without prompts.
- [ ] The checklist in `PERFORMANCE.md` passes.
- [ ] With AI: the evaluation command runs.
- [ ] The README lists the apps, settings, roles, the migrate command and any outside services.
- [ ] Every "stop and ask" and "ask itm8" item is answered by a person, or is not relevant.
