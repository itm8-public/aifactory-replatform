# Choosing the hosting target

Container Apps is **not** the default. The target follows the solution's lifetime, criticality,
operations needs, security and exit needs (an itm8 AI Factory architecture working session;
follow-up for the architecture council: "when Container Apps and when App Service").

Recommend a target with reasons. The architect who owns the customer dialogue decides.

## Signals

| Signal | Points to App Service | Points to Container Apps |
|---|---|---|
| Lifetime | Long-lived, years of maintenance | Short-lived, experimental, or likely to move |
| Criticality | Business-critical web app with an operations team used to App Service | Supporting component, agent, worker |
| Shape | One web app (plus API) in a mainstream runtime: .NET, Java, Node, Python, PHP | Several cooperating services, background workers, event-driven jobs, scale to zero |
| AI agents | Rarely | Usually: agents and tools isolated per container |
| Runtime | Supported App Service stack without OS packages | Needs custom OS packages, a sidecar, or a non-standard runtime |
| Exit from Azure | Not a requirement | Customer wants a portable image as an exit option |
| Observability | Wants the standard App Service monitoring patterns the operations team already runs | Fine with Container Apps logs and Application Insights |
| Cost | A plan already exists and can be shared | Consumption profile, idle most of the day |

Other targets to consider before either:

- **Static Web Apps**: a front end with no server code, or with small Functions-style APIs.
- **Azure Functions**: event- or timer-driven code with no long-running process.
- **Copilot app or Fabric app**: when the platform decision in the wizard ("Copilot App / Fabric App /
  Azure PaaS") points there, replatforming to Azure PaaS may be the wrong job. Say so.

## The platform gap

The AI Factory wizard templates host apps on Container Apps only
([platform-rules.md](platform-rules.md#templates-that-exist)). If App Service is the better fit:

1. Say so in the plan, with the signals above.
2. Mark it `platformGap: true` in the plan. Do not write App Service Bicep yourself.
3. Offer the closest supported alternative (usually Container Apps with min replicas 1 and
   standard monitoring) and what the customer gives up by taking it.
4. The architect chooses. The choice and its reason go into the plan's decision log.

## Data stores

| App uses | Replatform to | Notes |
|---|---|---|
| SQLite or a local file DB | PostgreSQL flexible server (shared server, own database, for Small/Medium) | SQLite on a container's disk is lost on restart and cannot scale out. Plan a data migration and a schema migration step |
| SQL Server | Azure SQL Database, Entra-only auth | Second engine on the platform (ADR-13 O5); needs architect sign-off |
| PostgreSQL / MySQL | PostgreSQL flexible server | MySQL is a migration; flag it |
| Local file uploads | Blob Storage through managed identity | Never Container Apps local storage for user data |
| In-process cache or sessions | Stateless app, or Azure Cache for Redis | Required for more than one replica |
| Secrets in config files or `.env` | Key Vault, read by the app's managed identity | Name each secret; never copy values |

## Wizard target constraints

The application host is only one axis. Before recommending a Wizard target, read
[Wizard contract](wizard-contract.md): region has no default; connectivity, audience, allowed
regions, access/PIM readiness and customer CAF facts are human/customer inputs; Basic service
levels never reduce zone controls. Do not propose a Fabric integration just because a competency
track or README mentions Fabric/Power BI.

ADR-19 is Proposed but the current Management App refuses the archetype/zone/connectivity/audience
combinations it defines. If a requested target is currently refused, preserve the person's answer,
record the Wizard refusal and Proposed status, and stop for the responsible reviewers; never
silently change the archetype or zone. Evaluation orders are a separate isolated Green/Basic path,
synthetic/non-sensitive only, without prod or shared platform resources, and cannot be promoted in
place. Red egress must use an explicit customer firewall/FortiGate/Azure Firewall choice; Azure
Firewall requires an Operations reference.