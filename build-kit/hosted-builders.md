# AI Factory build rules for hosted builders

Version 0.1 (draft, 2026-10-27). From itm8. Paste this into the builder's knowledge or custom
instructions (Lovable, Base44, Emergent and similar).

This app will later move to itm8's AI Factory platform in Azure. This builder runs its own backend,
so the app cannot follow all of the platform's rules here. Build it so the move is mechanical: keep
everything that will change in a few known places, and follow the other rules from the start. When
a request conflicts with a rule, follow the rule and tell the person which one.

## This project

Your itm8 contact fills this in. Until then, use the defaults shown.

- Zone: **not confirmed, so build to Yellow** (a person at itm8 confirms it)
- Users: internal only, or also people outside the organisation
- itm8 contact: (name)

## Stop and ask a person first

- The app reads or stores **personal data** (names, e-mail addresses, phone numbers, personal
  identity numbers, employee data), or health, biometric, religion, trade-union or children's
  data, or data under sector rules. Use synthetic data only until itm8 confirms the zone.
- AI that makes or shapes decisions about people, or that sends, pays, writes or deletes.
- Social scoring, hidden manipulation, or biometric identification in public spaces. Never build
  these.
- A third-party service that would receive the app's data.
- Real customer data in a prompt, a seed file, a test or a screenshot.

## Keep what will change in one place

- **Sign-in:** one module returns the current user: a stable ID, a display name and roles. Nothing
  else reads the builder's auth. In Azure, people sign in with Microsoft Entra ID, so build no
  sign-up, invitation links or password reset, and never use e-mail as the user's key.
- **Data:** the browser never queries the database. Every read and write goes through a server
  function, and the front end calls them through one module. Check the user's permission in the
  server function, not only in row-level security.
- **Server functions:** each one is thin. It reads the user, checks permission, then calls plain
  functions in shared code that do not import the builder's SDK. Those move into a container.
- **AI:** one module makes every model call, with the endpoint and model name from settings. You
  may use the builder's model while every prompt holds synthetic data. In Azure the module calls
  Azure AI Foundry.
- **Settings:** one module reads them. List every setting and secret name in the README, never a
  value. No secret in front-end code: anything the browser loads is public.

## Data

- PostgreSQL only. If the builder offers another database, ask it to use PostgreSQL.
- The schema lives in SQL migration files in the repository. Use plain tables and types, no
  PostgreSQL extensions, and `gen_random_uuid()` for IDs. Nothing references the builder's `auth`
  or `storage` schemas.
- Seed, demo and test data are synthetic.

## Avoid, or ask itm8 first

The builder's file storage, scheduled jobs, e-mail sending, realtime channels, and any request
that runs longer than 30 seconds. Each needs a different design in Azure.

## Every app

- Every page and endpoint needs a signed-in user. No public pages.
- Validate input on the server, and use parameterized queries.
- Store rich text as Markdown or JSON, not HTML.
- Tell people when they chat with an AI or see content it generated. Before the AI sends, pays,
  writes or deletes, the code waits for a person to approve.
- Never log secrets, tokens, personal data or whole prompts.
- Page every list from the server, give every outside call a timeout, and run email, PDF and AI
  batch work as jobs that are not part of the request. In Azure these become platform features.

## Per builder

- **Lovable:** connect GitHub sync on day one. Use Supabase or Lovable Cloud as PostgreSQL behind
  Edge Functions, as above.
- **Base44:** the backend and data stay in Base44, so treat the app as a prototype. itm8 rebuilds
  the server side. Keep the front end's data calls in one module.
- **Emergent:** connect GitHub. If it picks MongoDB or another database, ask for PostgreSQL.

## Before you hand over

- [ ] The code is in a GitHub repository, including the SQL migrations.
- [ ] The README lists the server functions, tables, settings, roles and outside services.
- [ ] Sign-in, data access, AI calls and settings each sit in one module.
- [ ] No real data anywhere, and every "stop and ask" item is answered by a person.
