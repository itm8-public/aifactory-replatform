# AI Factory platform rules

The rules the replatform agent must respect. They summarise the AI Factory design as it stands in
the itm8 Management App repository ("the platform repo", an itm8-internal repository): its Wizard
infrastructure templates, its Wizard design docs, and its shared contracts.

Every architecture decision there is still **Proposed**. When the platform repo and this file
disagree, the platform repo wins: say so in the plan and propose a fix to this file.

## What the agent never does

From the Wizard platform-direction design:

- Never set, confirm or lower a **risk zone**. Suggest one with evidence; a person confirms it.
- Never review its own pull request or merge.
- Never **deploy**: no `az deployment`, `azd up/deploy`, `terraform apply`, or a workflow that deploys.
- Never write **Bicep, Terraform or ARM**. The wizard generates platform files; the agent drafts
  the wizard's `ai-factory.json` and changes the application.
- Never read, print or store a **secret value**. Name secrets, never show them.
- Never assign an Azure role directly to a person or suggest that a person receives "Owner through
  PIM". Roles belong to static groups or workload identities. People may be PIM-eligible members of
  the subscription's Owner, Contributor, or Reader group. The customer's identity team creates
  groups and PIM assignments; the agent does not.
- Branches are always `aifactory/<topic>`. Pull requests are always draft, at most 100 files, with a
  description of at most 4,000 characters.

## Axes

| Axis | Values | Who decides |
|---|---|---|
| Environment | `dev`, `test`, `prod` in the wizard (a proposed naming and tagging decision adds the Azure segment `stg`) | Engine contract |
| Service level | `basic`, `standard`, `premium`, per environment. Capacity only; never weakens the zone | Customer |
| Risk zone | `green`, `yellow`, `red` | People: itm8's security team before build for Yellow and Red, the delivery lead's attestation for Green |
| Placement | `A-shared`, `A-dedicated`, `B-caf`, `B-public` | Delivery lead |

Each control takes the **strictest** value of level, zone, environment and placement.

## Zones (Wizard infrastructure templates, "The zones")

| Area | Green | Yellow | Red |
|---|---|---|---|
| Meaning | Internal, no personal data | External users or business data, **no personal data** | Personal or special-category data, sector rules, AI deciding about people |
| Region | EU, default `swedencentral` | `swedencentral`, `westeurope`, `northeurope`, `germanywestcentral` | `swedencentral` only |
| Entry | App Gateway WAF_v2 (new or shared), Prevention | WAF_v2, own policy per host, Prevention; prod adds a customer IP allow-list | Point-to-site VPN with Entra sign-in; full stage adds a private-only WAF_v2 |
| Container Apps | VNet-injected, public access off, private endpoint | Same | Dedicated D4 profile, zone-redundant, firewall egress |
| Key Vault | RBAC, purge protection, private endpoint | Same | Premium, 90-day soft delete, customer-managed keys |
| PostgreSQL 18 | B1ms, Entra only; private endpoint in a customer landing zone, VNet-integrated only in itm8's own | B2ms or larger | D2ds_v5 or larger, customer-managed key |
| Registry | Basic or shared | Premium, private endpoint | Premium, private endpoint, CMK |
| Logs | 30 days | 90 days | 365 days, Sentinel, immutable export |
| Prod approval | Service delivery lead | Platform admin | Plus security, after a 5-day stage soak |

Red deploys in two stages: "grounds", then "full" behind a five-item `redGate`.

## Always on, every zone (Wizard design docs, "always-on controls")

One user-assigned managed identity per app, keyless everywhere; GitHub OIDC with an exact subject;
PostgreSQL Entra-only; no anonymous endpoints; WAF v2 Prevention or internal-only, never public
ingress protected only by EasyAuth; public access off on data services; Key Vault purge
protection; `swedencentral` and EU Data Zone models; security logs at least 90 days; actions
pinned by SHA; images promoted by digest; plain Container Apps secrets refused outside dev.

## Placement

| When | Placement |
|---|---|
| itm8 runs it and the zone is Red, or prod is Premium | A-dedicated |
| itm8 runs it, code changes only through itm8's pipeline, Green/Yellow, Basic/Standard | A-shared |
| itm8 runs it, the customer keeps changing the code elsewhere | A-dedicated |
| Customer runs it in their landing zone with hub and central DNS | B-caf |
| Customer runs it, no landing zone, Green/Yellow | B-public (a small landing zone is set up first) |

Refused: Red in A-shared or B-public; Premium in A-shared.

## Shared resources: reuse before create

- **PostgreSQL**: a database on the shared server per environment for Small/Medium, Entra-only;
  never for Red. The migration job's identity owns the schema; apps get data access only.
- **Ingress**: one shared Application Gateway WAF v2 per environment; onboarding adds a listener and
  pool. Never a gateway per app.
- **Registry**: shared in Mode A; Green may reuse an existing registry (`existingRegistryId`).
- **Key Vault**: one per resource set; apps read secrets as Key Vault references through their identity.
- Say in the plan which existing resource each need maps to, or why a new one is required.

## Private DNS in a customer landing zone

From the itm8 network team and Microsoft's
[Private Link and DNS integration at scale](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/private-link-and-dns-integration-at-scale).
In a CAF landing zone the `privatelink.*` private DNS zones are central: they live in the customer's
connectivity subscription, next to the hub and its DNS resolver, and belong to the platform team. A
workload landing zone (for example a Corp landing zone) only creates private endpoints.

- **Never plan new `privatelink.*` zones** in the workload subscription or resource group, and never
  because the connectivity subscription is not visible. A second copy of a zone splits name
  resolution (a VNet links to only one zone of a name, and the hub resolver answers from the central
  one), and ALZ's `Deny-Private-DNS-Zones` policy refuses it. Not seeing the zones means asking.
- **How a private endpoint is registered**, in this order:
  1. **Policy** (ALZ's way, preferred): `Deploy-Private-DNS-Zones` (DeployIfNotExists) is assigned
     over the workload subscription. Create the private endpoint without DNS integration (no
     `privateDnsZoneGroups`, "Integrate with private DNS zone: No"); the policy's own identity writes
     the record within minutes, and removes it with the endpoint. No right on the zones is needed.
     Check the assignment first: without it the deployment succeeds and names resolve to public IPs.
  2. **Zone group**: no policy, but the deploy identity may join the central zones
     (`Microsoft.Network/privateDnsZones/join/action`, or Private DNS Zone Contributor on them). Add a
     DNS zone group with the central zone's resource id; zones keep their standard names, so the id
     is `/subscriptions/<connectivity>/resourceGroups/<zone-rg>/providers/Microsoft.Network/privateDnsZones/<zone>`.
  3. **Platform team**: neither; list the records the platform team must add. This is a stop gate.
- **A missing zone** is created centrally by the platform team (and added to the policy). A private
  endpoint that already uses a local copy is re-pointed by changing its zone group; the platform
  team then removes the copy.
- **What the policy does not cover:**
  - PostgreSQL flexible server with **VNet integration** has no private endpoint and needs a private
    DNS zone when it is created. In a customer landing zone prefer the **private endpoint** mode
    (subresource `postgresqlServer`, zone `privatelink.postgres.database.azure.com`) so the policy
    covers it. With VNet integration the zone must be a central one the deploy identity may join,
    and `Microsoft.DBforPostgreSQL` must be registered in the zone's subscription.
  - The default-domain zone of an internal Container Apps environment
    (`<unique>.<region>.azurecontainerapps.io`, used by the App Gateway backend) is not a privatelink
    zone. Where it lives and who owns it is a question for the platform team; name it in the plan,
    never create it silently.
- **Resolver:** say which one the customer uses. With domain controllers, every `privatelink` zone
  needs a conditional forwarder to the hub resolver before anything resolves from the offices; that
  is the customer's work and a prerequisite in their onboarding.
- **Facts to ask for**, recorded in the CAF profile as "Private endpoint DNS"
  (`replatform_get_customer_caf_profile`): the subscription and resource group of the zones, which
  zones exist, whether `Deploy-Private-DNS-Zones` and `Deny-Private-DNS-Zones` are assigned above the
  workload subscription, and the resolver. Never infer them from another landing zone, itm8's own
  included: its layout is not the customer's and is not a pattern to copy.
- **The Factory template does not support central zones:** the Wizard's landing-zone network
  module creates its own privatelink zones and has no setting for central ones. The Management App
  refuses an order whose customer keeps central zones. Say so in the plan as a blocker; never work
  around it.

## What a Corp landing zone gives the platform

The standard list for every customer whose workload lands in a Corp (private) landing zone, Yellow
or Red. Ask for all of it before implementation, as customer actions; each item is an estate fact in
the CAF profile (`replatform_get_customer_caf_profile`), and an unknown one is a blocker.

**The customer's platform team prepares, once:**

1. **Spoke and subnets.** A spoke peered to the hub with the hub resolver as its DNS server, sized
   for the customer's apps (the network team plans a /21 per region, about ten apps across test
   and prod). The customer's network team creates the subnets from our request: size, delegation
   (`Microsoft.App/environments` for Container Apps), network security group, and the route table
   to the firewall. The plan writes that request; the platform never changes the spoke, its peering
   or its DNS settings. Estate fact "Subnets".
2. **Central private DNS**, as in the section above, with `Deploy-Private-DNS-Zones` covering the
   zones the plan uses (`vaultcore`, `postgres`, `azurecr` for a private registry, `blob` for
   storage, `openai`, `cognitiveservices` and `services.ai` for AI Factory).
3. **Firewall egress** for the platform: `mcr.microsoft.com`, `*.data.mcr.microsoft.com`,
   `packages.aks.azure.com`, `acs-mirror.azureedge.net`, `*.identity.azure.net`,
   `login.microsoftonline.com`, `*.login.microsoftonline.com`, `*.login.microsoft.com`, the
   container registry and `*.blob.core.windows.net`, the certificate issuer of the custom domain
   (a certificate is always needed), and GitHub for the runner
   ([Container Apps with Azure Firewall](https://learn.microsoft.com/azure/container-apps/use-azure-firewall)).
   Estate fact "Firewall egress".
4. **One public IP for the App Gateway frontend.** Internet users reach a Yellow app through the
   App Gateway (WAF_v2, Prevention); nothing else is public. A policy that denies public IP
   addresses needs an exemption for that one resource, or the customer's central ingress publishes
   the app instead. Check the policy assignments before planning the frontend.
5. **Resource providers**, registered by the subscription owner: `Microsoft.App`,
   `Microsoft.DBforPostgreSQL`, `Microsoft.KeyVault`, `Microsoft.ContainerRegistry`,
   `Microsoft.Network`, `Microsoft.OperationalInsights`, `Microsoft.ManagedIdentity`,
   `Microsoft.Insights`, `Microsoft.CognitiveServices`, and `GitHub.Network` for a GitHub-hosted
   runner on private networking. Estate fact "Resource providers".
6. **A runner that reaches the private endpoints.** A runner on the public internet cannot read
   Key Vault, run Postgres migrations or push to a private registry. Default: a GitHub-hosted larger
   runner (2-core) on Azure private networking in a subnet of the spoke, its own runner group per
   customer; the firewall lets it reach the GitHub enterprise host. Fallback: an ephemeral
   self-hosted runner in the spoke (no image builds inside Container Apps jobs). Estate fact
   "Runner network".
7. **Logs:** the workspace the workload sends to (the customer's central one or its own) and
   whether a policy writes the diagnostic settings. Estate fact "Log Analytics".

**Access for the deploy identity**, the customer's own app registration with GitHub OIDC (no
secret, no itm8 credential):

| Access | Scope | Gives | Does not give |
|---|---|---|---|
| Contributor, and Role Based Access Control Administrator with a condition: only the roles the platform assigns (for example AcrPull, Key Vault Secrets User), only to service principals, never Owner, User Access Administrator or itself; Owner also works | The workload subscription (a shared resource group is created there) | The platform's resources and its managed identities' roles | Role grants to people, policy, other subscriptions |
| `Microsoft.Network/virtualNetworks/subnets/join/action` | The subnets the customer created for us | Container Apps, private endpoints and the App Gateway in those subnets | Any change to the spoke |
| `Microsoft.Network/privateDnsZones/join/action`, only without the policy | The central zones the plan uses | A DNS zone group pointing at them | Any other record or zone |

Estate fact "Deploy access". **Never ask for a right on the hub network.** Joining the hub virtual
network lets its holder link any private DNS zone to it, and the hub resolver then answers that name
for the whole estate: a DNS takeover. The Container Apps default-domain zone is created and linked
by the platform team; the platform needs at most the right to write its records.

**Lighthouse stays Reader.** Azure Lighthouse delegates built-in roles only, and none that writes
role assignments, so it cannot carry deploy access. It gives the Management App read access for the
Platform Doctor and discovery; everything above is assigned in the customer's own tenant.

**Ask through the onboarding workflow.** The subnet request, the egress list and the access table
go to the customer's role-holders as one request they approve; the plan lists what is still open.

## Subscriptions follow the lifecycle

What is created, changed and retired together shares a subscription (itm8 network team).
A customer may keep dev, test and prod in one subscription; the plan then separates them by resource
group, tags and access groups, and says that cost per environment comes from tags, not the invoice.

## AI processing policy (draft 0.1.0)

Applies to the agent itself and to any AI the replatformed app uses.

- Customer content goes only to an Azure-sold Foundry model on a **Data Zone or Regional**
  deployment, with recorded consent and a passed ownership gate.
- Blocked: Global deployment types, DeveloperTier, Marketplace, non-Azure providers, previews,
  prompt and completion logging, stored completions. Fail closed.
- Claude on Foundry is Global Standard or Data Zone (US) only, so it needs the customer's recorded
  consent to global processing before it sees customer data.

## Templates that exist

The Wizard landing-zone templates (network, platform, monitoring, audit, governance) and the
Wizard app template: Container Apps (`web`, `api`, `worker`), one identity per app, a
migration job, Foundry deployments. **Container Apps is the only app host.** No App Service,
Functions, Static Web Apps or AKS template exists. See [hosting-decision.md](hosting-decision.md).

## Naming and tags

Use the term **workload landing zone**, not "AI landing zone".

The canonical naming order is decided: customer Azure artefacts are **customer-first**,
`customer-workload-region-type[-qualifier]-environment`; Power Platform and Entra artefacts use
`aif-<cust>-<zone>-<type>`. Where the assessment or plan references or recommends a resource name,
use that order.

The Management App contract was checked against the itm8 Management App repository, at the commit
pinned in [contracts/mgmt.lock.json](../../../contracts/mgmt.lock.json).

For **landing-zone resources** the current Wizard generates
`<customer>-lz-<region>-<type>[-<qualifier>]-<environment>`. The customer code is 2–4
lowercase letters/digits, starts with a letter, and `itm8` is reserved. The Wizard maps region IDs
to the approved abbreviations. Globally unique names get a suffix computed by Bicep; the agent
must never invent that suffix or a landing-zone resource name. App resources inside the landing
zone keep their solution-scoped names. This naming rule is still **Proposed**; describe it as the
current Wizard behavior, not a ratified enterprise standard. The proposed tagging rules remain
unchanged.

The archetype refusals, the Red egress costs and the Foundry gateway estimate are also
**Proposed** in the verified Management App revision. The
current Wizard enforces its archetype/connectivity/audience refusals, so never prepare a Wizard
spec that the Wizard will reject. However, do not silently change a person's zone or archetype,
and do not describe these proposed rules as approved policy. Surface a conflict as a blocking
human decision and keep the decision log explicit. In particular, no automatic "nearest allowed
zone" decision belongs in the replatform agent.

Read the complete versioned contract and current Wizard field semantics in
[Wizard contract](wizard-contract.md). When the Management App contract and a proposed ADR
conflict, follow the running Wizard for schema compatibility, state that the policy decision is
still proposed, and stop for the responsible reviewers rather than inventing a third rule.