# Discovery: the code's genetics

Facts first, opinions later. Every plan claim points to a fact from discovery, an unavailable
check, or an owner answer. A claim without evidence is not allowed in the plan.

## What to collect

| Area | How | Record |
|---|---|---|
| Runtimes | `package.json` engines, `.nvmrc`, `global.json`, `*.csproj` TargetFramework, `pom.xml`, `build.gradle`, `pyproject.toml`, `requirements.txt`, `Dockerfile` FROM | runtime, version, file |
| Frameworks | Dependencies: React, Next.js, Express, ASP.NET Core, Spring, Django, FastAPI | name, version, file |
| Dependencies and licenses | Lock files; generate an SBOM if a tool is available (`syft`, `cyclonedx`) | ecosystem, name, version, license |
| Build and start | Scripts, Makefile, Dockerfile, Procfile. Read them; **never run install, start, migration, or deploy scripts** from customer code | commands, where |
| Data stores | Connection strings (names only), ORMs, migration folders, SQLite files | engine, connection model, migrations |
| File storage | Writes to disk, upload folders | paths |
| Config and secrets | `.env.example`, `appsettings*.json`, config modules. Scan only if safe; record the **file and rule**, never a value | secret names, locations |
| Auth | Login code, identity providers, session handling | method |
| Outbound calls | HTTP clients, SDKs, email, queues, AI model calls, MCP servers | target, purpose |
| Existing IaC and CI | `infra/`, `*.bicep`, `*.tf`, `.github/workflows`, `azure-pipelines.yml` | what exists |
| Tests | Test folders and frameworks; whether they run | framework, count |
| Health and operations | Health/readiness endpoints, logs, metrics, backup/restore material | paths, or absence |

Mark anything you cannot determine as **unavailable** with the reason. Unavailable is a fact too;
do not guess around it.

## Optional Azure discovery

For an integrated engagement, the Management App's `replatform_discover_azure_landing_zone` MCP
tool is the only Azure discovery path. Call it only when the engagement explicitly records
`azureAccessMode: "read-only"`. The Management App uses its configured identity and the customer's
verified Reader connection; the agent never receives a credential and never runs `az`, a shell, or
an ARM request directly.

Treat each inventory category separately. A category with `status: "available"` and its returned
resource references is connector evidence; `status: "unavailable"` remains unknown and is never
treated as an empty result. `supportedRegions` reports Azure locations, not a Wizard region choice.
`quotaUsage` is explicitly unavailable until a Reader-only Container Apps quota query is supported;
ask the owner or platform team rather than estimating. Do not use discovery fit/prefill suggestions
to choose a zone, archetype, region, or placement.

Record the result metadata in the plan's top-level `azureDiscovery` field. Cite available categories
as `azure-discovery:<discovery-id>:<category>` and unavailable categories as
`unavailable:azure-discovery:<discovery-id>:<category>`. If no snapshot was persisted, add
`unavailable:azure-discovery` to `assessment.report.unavailable` and ask a targeted question.
`assessment.report.facts` remains the repository analyzer's facts; do not copy the full Azure
inventory into the plan or evidence ledger.

## .NET and Java: Copilot modernization assessment

For .NET (`*.csproj`, `global.json`) and Java (`pom.xml`, `build.gradle`) applications, Microsoft's
free GitHub Copilot modernization tooling adds an assessment of framework and runtime upgrades,
deprecated APIs and dependency CVEs. Use it as one more source of evidence, never as a decision:
see [copilot-modernization.md](copilot-modernization.md).

## Allowed commands during discovery

Read-only and offline: listing and reading files, `git log`, dependency listing from lock files,
SBOM and secret scanners, static analysis, and the Copilot modernization **assessment** for .NET and
Java (assessment only). Building or running tests comes once the plan
is validated, and only when the plan permits it.

## Output

1. Add stable fact ids to `assessment.report` in `.aifactory/replatform-plan.json`.
2. Write `.aifactory/evidence-ledger.md` from [../templates/evidence-ledger.md](../templates/evidence-ledger.md).
3. Mark missing runtime, scanner, environment, and ownership evidence as unavailable.
4. Create a finding only after its evidence, impact, and standard status are clear. Use
   [evidence.md](evidence.md) for the distinction between fact, owner answer, unavailable, and
   inference.