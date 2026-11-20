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
| Statelessness | Move sessions and caches out of process when more than one replica will run |
| Logging | Log to stdout in a structured format; no secrets or personal data in logs |
| Build and test scripts | Make `build`, `test` and `lint` runnable non-interactively in CI |
| Solution description | A draft `ai-factory.json` for the wizard, with `classification.confirmedZone: null` |

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
