# What the agent may change in the application

Once the plan is validated, the agent prepares the application for the platform. The platform
files themselves (Bicep, parameter files, deploy workflows) come from the AI Factory wizard; the
agent changes the app so those files can run it.

## Allowed changes

| Change | Typical work |
|---|---|
| Container image | A multi-stage `Dockerfile` (only when the target is Container Apps): pinned base image by digest, non-root user, `HEALTHCHECK` not relied on (platform probes are used), small final stage |
| Health endpoints | `/healthz` (liveness) and `/readyz` (readiness, checks the database) |
| Configuration | Read settings from environment variables; remove hard-coded hosts, ports and connection strings |
| Secrets | Replace secret values in code or config with environment variables that the platform fills from Key Vault references. Add the secret **names** to the plan |
| Identity | Use `DefaultAzureCredential` (or the language equivalent) for Azure SQL, PostgreSQL with Entra auth, Blob Storage and Key Vault instead of keys and passwords |
| Data | Move from SQLite or local files to PostgreSQL or Blob Storage; add a migration tool if none exists (for example Prisma, EF Core migrations, Flyway, Alembic) and a data migration script for the existing data |
| Data on Cosmos DB | Only when the order says `database: cosmos-nosql`. Rewrite data access for the Cosmos SDK with `DefaultAzureCredential`, reading `AZURE_COSMOS_ENDPOINT` and `AZURE_COSMOS_DATABASE`; no SQL schema, no `db-setup.sql`, no `PG*` settings. List each container with its partition key in the plan (the app template creates them). Say in the plan this is a code change, not a drop-in, and size it |
| Sign-in | Where an environment has no gateway (edge `none`), the web app relies on Entra sign-in (Easy Auth) in front of it: `easyAuth: true`; read the signed-in user from the Easy Auth headers instead of a home-made login where the app has one |
| AI calls | With Foundry Premium, call the models through the AI gateway URL with the app's managed identity (an Entra token from `DefaultAzureCredential`); remove API keys and `AZURE_AI_PROJECT_ENDPOINT` |
| Statelessness | Move sessions and caches out of process when more than one replica will run |
| Logging | Log to stdout in a structured format; no secrets or personal data in logs |
| Build and test scripts | Make `build`, `test` and `lint` runnable non-interactively in CI |
| Solution description | A draft `ai-factory.json` for the wizard, with `classification.confirmedZone: null` |

## The change gate

Every change runs the gate in the build kit's `GUARD.md` (in this repository: `build-kit/GUARD.md`)
twice: when it is planned (the plan page's "Change gate" table) and before it is written. The build
rules come first, controls at trust boundaries second, the smallest change last. A change that
would only work by weakening a control is not made; it is a finding for a person.

## Never

- Bicep, Terraform or ARM modules; parameter files the wizard generates.
- Deployment or provisioning pipelines. A workflow edit is allowed only when the plan lists it.
- Changes outside the paths named in the plan.
- Feature changes, refactors or upgrades nobody asked for. Note them in the plan as suggestions.
- Deleting tests to make the build pass.

## Plan-item traceability and the scope check

Every `appChanges` entry has a unique `planItemId` (`APP-###`), an exact path (one item per path),
evidence IDs, and a `targetSpecField` that matches a field in `assessment.draft.targetSpecDelta`.
The change's evidence must also support that target-spec field. The target field is a Wizard v1
field; do not create a field the Wizard does not define. When a change adds or updates a
dependency, include that package's manifest and lockfile (for example `api/package.json`) as plan
items.

Before the draft PR leaves the agent, run the scope check:

```text
npm run validate-implementation -- .aifactory/replatform-plan.json
```

It compares the working tree with `allowedPaths` and the `APP-###` plan items. It allows only the
implementation log and validation report as unplanned `.aifactory/` metadata.

## Stateful data migration evidence

When a planned change migrates persistent data, do not leave the result at “migration ran.”
Record in the implementation log and validation report:

- Pre- and post-migration row counts for each migrated table or collection.
- A deterministic reconciliation check (for example stable primary-key sets, checksums, or
  application-specific invariants) and its exact result.
- The backup/restore method and evidence that restore was tested on synthetic or otherwise
  authorized data.
- The rollback boundary or forward-fix plan, including how a partially applied migration is
  detected and recovered.

Never use a production dump as a fixture. If reconciliation or restore cannot be tested safely,
leave the relevant check `NOT RUN`, keep the PR draft, and name the owner/platform action.

## Checks before the pull request leaves draft

The same six checks the management app's Coding Agent contract requires. All must run and pass;
record a pointer to each log in the pull request description.

| Check | Examples |
|---|---|
| Tests | the project's test command |
| SAST | CodeQL, Semgrep |
| IaC scan | only on IaC the wizard generated, if present: Checkov, `bicep lint` |
| Secret scan | gitleaks, GitHub secret scanning |
| Dependency audit | `npm audit`, `dotnet list package --vulnerable`, `pip-audit` |
| SBOM | syft, CycloneDX |

If a check cannot run, the pull request stays draft and the description says why.
