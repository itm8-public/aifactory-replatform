# AI Factory build rules: speed, scale and resilience

Version 0.1 (draft, 2026-11-01). From itm8. Keep this file in the repository root next to
`AGENTS.md`. `AGENTS.md` wins when the two disagree. Numbers are targets for the 75th percentile
of real users unless a line says otherwise.

## Rendering and loading

- Render where it fits. A page that is the same for every user is prerendered at build time. Render
  on the server in `web` only when the first view needs server data to be useful. There is no
  vendor ISR: for "rebuild now and then", render on the server and send a short
  `Cache-Control: private, max-age=<seconds>`. Every page needs sign-in, so never cache HTML as
  `public`.
- Split code by route: each route loads its own chunk (`React.lazy`, the router's lazy routes or
  the framework's equivalent) inside a `Suspense` with a skeleton. Load heavy parts (charts,
  editors, maps, PDF viewers) only when they are opened. Aim for at most 200 KB of compressed
  JavaScript on the first route.
- Lists with more than about 100 rows are virtualized (TanStack Virtual or equivalent) and paged
  from the server. Never render thousands of rows at once.
- While data loads, show skeletons that have the final layout's size, so nothing jumps
  (CLS at most 0.1). No full-page spinners.
- Optimistic updates only for small, reversible changes (a toggle, a rename, a reorder). Roll back
  and show the error if the server says no. Never optimistic for anything that sends, pays,
  deletes or needs a person's approval.
- Images: serve AVIF or WebP with a fallback (`<picture>`), set `width` and `height`, and use
  `loading="lazy"` and `decoding="async"` below the fold. The largest image above the fold loads
  eagerly with `fetchpriority="high"`. Ask itm8 before storing uploaded files (see `AGENTS.md`).
- Fonts: self-host WOFF2 files from the app's own origin, at most two weights, with
  `font-display: swap`, and preload the one the first view uses. No font CDNs.
- Third-party scripts: avoid them. A third party that receives the app's data needs a person's
  approval first (`AGENTS.md`). If one is approved, self-host it where its licence allows, list it
  in the Content-Security-Policy, and load it only after the page is interactive (after `load`,
  in `requestIdleCallback`), never in `<head>`.
- Re-renders: measure first with the React Profiler. Use `React.memo`, `useMemo` and
  `useCallback` where the Profiler shows an expensive component re-rendering with the same props,
  and keep state close to where it is used. Do not wrap everything by default.

## Network

- Search and autocomplete wait 250 to 300 ms after the last key press, need at least 2
  characters, and cancel the previous request with an `AbortController`.
- Fetch data through one query library (TanStack Query, SWR or the framework's own) so identical
  requests in flight are sent once and cached briefly. Do not refetch on every render or window
  focus without a reason.
- Independent calls run together with `Promise.all`, or `Promise.allSettled` when the page can
  show partial results. Never await them one after another. Cap the number at about 6 at once.
- AI answers stream token by token (server-sent events) from the one AI module. The gateway
  cancels a request after 30 seconds and streaming through it is not tested yet, so: send the
  first token quickly, finish within 25 seconds, and keep a fallback that starts the work and lets
  the browser poll for the result. Show a stop button and keep the partial answer on error.
- Compression: precompress built assets with Brotli and Gzip at build time and serve the one the
  browser accepts. Compress JSON and HTML responses over 1 KB on the fly. Never compress
  server-sent events in a way that buffers them.
- Caching: built assets have content hashes in their names and are sent with
  `Cache-Control: public, max-age=31536000, immutable`. HTML is `no-cache`. API answers are
  `private` or `no-store`. Use `ETag` for API answers that are read often and change rarely.
- A CDN in front of the app is the platform's choice, not the app's. Build as above so it works
  with or without one, and ask itm8 if you think the app needs one.
- Every call that leaves the process has a timeout: database queries (a `statement_timeout`),
  model calls, other HTTP services, Azure SDK calls. Use `AbortSignal.timeout()` or the client's
  own setting, at most 10 seconds by default and always inside the 30-second gateway limit. A
  timeout returns a clear error, and only safe or idempotent calls are retried, at most twice,
  with backoff and jitter.

## Caching data

- No cache in memory that must survive a request: any replica may serve the next one.
- For read-heavy data, first add the right index, select fewer columns and cache in HTTP (above).
  Often that is enough.
- Redis (Azure Cache for Redis) is a new platform resource: ask itm8 first. If it is approved,
  every cache call goes through one module with a time-to-live on every key and a fallback that
  reads the database when Redis is down or slow (timeout at most 100 ms). Never store the only
  copy of data, or personal data, in Redis.

## Database and API

- Every list endpoint is paged. Use keyset pagination (`WHERE (created_at, id) < ($1, $2) ORDER
  BY created_at DESC, id DESC LIMIT $3`) for long or live lists, with a server-side maximum page
  size of 100. Return the next cursor, not a total count, unless the page needs one.
- No N+1 queries: load related rows with a join or one `WHERE id = ANY($1)` query. Where a
  resolver or loop needs related rows one by one, use a DataLoader created per request. A test
  counts queries on the busiest list endpoint.
- Select only the columns the endpoint returns. No `SELECT *` in application code. Return a
  defined response shape, not the database row.
- Add indexes in migrations for the columns used in `WHERE`, `ORDER BY` and joins of the common
  queries, including foreign keys. Check a slow query with `EXPLAIN ANALYZE` on realistic
  synthetic data. Every index has a reason in the migration's comment.
- One connection pool per process, created at startup. Keep it small: the pool size times the
  maximum replicas must stay under the database's connection limit; start at 10 per replica.
  Set an idle timeout and a connection timeout. Release every connection, also on errors.
- Email, PDF generation, AI batch work and anything over a few seconds is a job, not part of the
  request. Write the job to a `jobs` table in the same transaction as the change that caused it,
  answer at once, and show its state. A runner claims jobs with `FOR UPDATE SKIP LOCKED`, retries
  with backoff, and marks a job failed after a limit. Jobs are idempotent. The runner needs a
  `worker` app or scheduled work, and sending email needs an outside service, so ask itm8 first.
- The platform puts the app in the same region as its database. Do not choose a region, and do
  not call a database or cache in another region.

## Resilience

- Critical mutations (create an order, submit, approve, start a job, call an AI tool that writes)
  accept an `Idempotency-Key` header. Store the key, the user's object ID, a hash of the body and
  the answer in PostgreSQL with a unique constraint. A repeat returns the stored answer; the same
  key with another body returns 422. Keep keys for at least 24 hours. The front end creates one
  key per user action and reuses it on retry.
- Rows people edit have an integer `version` column. Updates run
  `UPDATE ... SET ..., version = version + 1 WHERE id = $1 AND version = $2`. If no row changed,
  answer 409 with the current version, and let the person see the change and decide.
- Rate limit per user (object ID), kept in PostgreSQL, never in memory: search, AI, exports, file
  uploads and every endpoint that is expensive or sends something. Answer 429 with
  `Retry-After`. Sign-in is Entra ID's job, so the app has no sign-in endpoint to limit.
- Each route has an error boundary with a fallback that shows a short message, the error ID and a
  retry button, and keeps the rest of the page working. Add a top-level boundary as well.
  Report caught errors to the server log.
- Load balancing across replicas is the platform's. The app's part is to be stateless, answer
  `/healthz` fast and stop cleanly on `SIGTERM` (`AGENTS.md`).

## Measuring

- Trace with OpenTelemetry: incoming requests, database queries, outgoing HTTP and model calls.
  Accept and pass on the W3C `traceparent` header, and put the trace ID in every log line and in
  the error ID users see. Read the exporter settings from the standard `OTEL_*` variables or
  `APPLICATIONINSIGHTS_CONNECTION_STRING`, and run without tracing when none is set. Never put
  personal data, prompts or answers in span attributes.
- Measure Core Web Vitals from real users with the `web-vitals` library and send them to the app's
  own endpoint (same origin, sampled, no third-party analytics). Targets: LCP at most 2.5 s, INP
  at most 200 ms, CLS at most 0.1.
- Set budgets in the build: JavaScript size per route and a Lighthouse CI run on the main pages.
- Test on slow networks and low-end devices: run the end-to-end tests of the main journeys once
  with network throttling (Slow 4G: about 400 ms latency, 400 kbit/s) and 4x CPU slowdown, for
  example with Playwright and the Chrome DevTools Protocol. They pass without prompts.

## Before you hand over

- [ ] Routes load their own code; long lists are paged and virtualized.
- [ ] Every outgoing call has a timeout, and no browser request takes longer than 30 seconds.
- [ ] No N+1 queries and no `SELECT *` on the main endpoints; common filters have indexes.
- [ ] Email, PDF and AI batch work run as jobs, or itm8 has said how they run.
- [ ] Critical mutations take an idempotency key; edited rows have a `version` column.
- [ ] Search, AI and expensive endpoints are rate limited per user in PostgreSQL.
- [ ] Every route has an error boundary; traces and Web Vitals are recorded without personal data.
- [ ] The throttled end-to-end run and the Lighthouse budgets pass.
