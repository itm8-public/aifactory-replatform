# AI Factory Wizard contract for replatforming

**Verified source:** the itm8 Management App repository, at the commit pinned in
[contracts/mgmt.lock.json](../../../contracts/mgmt.lock.json). The Management App is the source of truth; the pinned copy of its contracts lives in `contracts/mgmt/` and is maintained by itm8.

Legacy v1 specs may omit newer additive fields (including `allowedRegions`, `readiness`, `network`, `apps`, `foundry`, `egress`, `caf`, and `evaluation`) and remain parseable. Their absence is **unknown**, not a ready/default answer; a new governed handoff may still block until a human supplies the missing choice.

This reference describes the Wizard's `ai-factory.json` **version 1** read/write contract used by
the Management App Wizard's spec generator. The agent produces a draft only in the offline playbook
path; when the Management App supplies Wizard answers (C1), those win and the agent
must not reconstruct or overwrite them.

## Fields the agent must understand

| Field | Contract | Agent behavior |
|---|---|---|
| `customer.code` | 2–4 lowercase letters/digits, starts with a letter; `itm8` is reserved. | Preserve an actual Management App value. Never fabricate a customer code. |
| `archetype` | Optional/additive in v1: `corp`, `online`, `public`. | Use only an explicit Wizard/CAF answer. The archetype rules remain **Proposed**; see below. |
| `connectivity` | Optional/additive: `internal`, `isolated`, or unanswered `""`. | Ask the owner. Do not infer network reachability from source code. |
| `audience` | Optional/additive: `internal`, `external`, `public`, or unanswered `""`. | Ask the owner. An audience is not the same as internet exposure. |
| `region`, `allowedRegions` | `region` has no default. `allowedRegions` is an optional/additive EU region-id array and is `[]` when unknown; legacy v1 specs may omit it. | Never default a region. If policy regions are unknown, say so. If provided, the selected region must be allowed. Red is `swedencentral`; Yellow currently supports `swedencentral`, `westeurope`, `northeurope`, `germanywestcentral`. |
| `readiness.accessGroups` | `ready`, `pending`, `unknown`, or `""`; static role groups and their PIM settings. | Treat any value other than `ready` as an open customer action. |
| `readiness.eligibleAccounts` | Evidence reference to PIM-eligible accounts per role group. | Check presence only; do not copy the referenced list into the plan or logs. |
| `readiness.accessAdmin` | `{name,email}` for the identity administrator who can add group members. | Check presence only. Do not repeat the person's name/email in findings, plan, lessons, telemetry, or PR prose. The Wizard owns this contact data. |
| `readiness.socLogging` | SOC/logging readiness. | Treat missing/not-ready as an owner action; do not infer readiness. |
| `readiness.customerActions` | Open actions with `text` and `owner`. | Summarize the action and responsible **role**, not personal details. Open actions block governed readiness. |
| `environments`, `prodOnlyApproval` | Any one to three of `dev`, `test`, `prod`; dev is not required. When `prod` is the only environment the Wizard needs a person's approval to deploy without a lower environment and records it as optional `prodOnlyApproval: {approvedBy, approvedAt}`. | Never add the approval or write a prod-only spec as approved. A prod-only spec without it is a customer/owner action (a blocker); the person ticks "I approve deploying production without a lower environment" in the Wizard. Do not default a missing dev environment into the spec. |
| `subZone`, `soc` | Optional `subZone` (`yellow-public`, `yellow-internal`, `red-hub`, `red-isolated`) and `soc` (boolean). A sub-zone must match the zone. A Red sub-zone requires `soc: true`; at Yellow the SOC is optional. | Suggest a sub-zone from the access path and audience; never write one as chosen. A person confirms the sub-zone and the SOC answer. |
| `apps[].certificateSource`, `services` | Optional. `certificateSource` (`customer-pfx`, `key-vault-secret`) only on web apps. `services.dnsOwnerRole` (`customer-dns-mail`, `customer-platform`) and `services.mail` (`mode` `none`, `acs-email` or `m365-connector`, plus `senderDomain`). Mail other than `none` needs a sender domain; Red never uses `acs-email`. | Read only. Never choose the certificate source, DNS owner or sender domain for the customer; each is an owner answer that creates a customer prerequisite package. |
| `egress` | Optional block for Red, or Yellow with a `subZone`: `firewall` (`existing`, `fortigate`, `azure-firewall`, `nat-gateway`, `none`), `firewallNextHopIp`, `azureFirewallApproval`. Older Red v1 files without it remain parseable. | Read only. Never choose a firewall, next hop, or approval reference for the customer; a new Red handoff blocks until a firewall is explicitly chosen. |
| `evaluation` | Optional `{data, expiresOn}`. Isolated Green/Basic, synthetic or non-sensitive data, no prod, 1–90 days, own resources only. The Wizard applies `purpose=evaluation` and `expiresOn` tags to each resource. | Never promote it in place or generate tags/IaC yourself. Personal/sensitive data, prod, shared resources, or internal connectivity blocks evaluation. Production is a separate reviewed order. |
| `foundry` | `enabled`, `level` (`basic` or `premium`; absent in older v1 means Basic), models, and Premium quotas/contact. | Recommend Premium only when the customer requests an enforceable hard token cap or multiple apps share models; a budget is not a token cap. Agents that require `AZURE_AI_PROJECT_ENDPOINT` stay on Basic until the gateway supports that workflow. Premium requires a human-selected per-app `tokensPerMinute`, explicit `monthlyTokenQuota` (`0` means no cap), and gateway contact; never invent them. Premium apps use the API gateway and receive no Foundry account role or `AZURE_AI_PROJECT_ENDPOINT`. Any gateway cost figure is a provisional estimate from itm8, not a quote. |
| `caf` | Optional confirmed profile facts: `defenderInherited`, `bastionPresent`. | Never invent this block. Discovery suggestions are not confirmed CAF facts. The Wizard fills it from the customer's CAF profile. |
| `dataPlatform` | Optional; absent means no data platform was selected. | Omit Fabric unless an explicit Wizard/customer requirement selects it. A seed track or documentation mention is not an integration. |
| `network` | Green/Yellow network selection; Red has its separate `egress` block. | Preserve only explicit Wizard answers. Never emit platform IaC or infer a shared resource exists. |

## Naming contract

Use the term **workload landing zone**, not "AI landing zone".

The current Wizard generates landing-zone resources as
`<customer>-lz-<region>-<type>[-<qualifier>]-<environment>`. Region abbreviations are `swce`,
`swso`, `noeu`, `weeu`, `gece`, `frce`, `itno`, `poce`, `spce` for the corresponding Wizard region
IDs. App resources retain solution-scoped names. Globally unique Azure names use a Bicep-generated
suffix which the agent must not calculate or guess. This naming rule is **Proposed**, so refer to this as
current Wizard output, not an approved enterprise naming standard.

## Unratified archetype rules

These rules are still **Proposed**; their named reviewers have not ratified them in the verified
source. The
current Wizard/API code nevertheless refuses `corp + green`, `public + red`, `internal` connectivity
outside Corp, `public` audience in Corp or Red, and treats external users in Corp/Red as warnings.

If a draft contains a combination the current Wizard refuses:

1. Do not silently change the archetype, audience, connectivity, or zone.
2. Record the exact Wizard refusal and the rules' **Proposed** status.
3. Stop for the responsible architect/reviewers to resolve the conflict; keep `confirmedZone` human-only.
4. Do not describe the proposed refusal table as ratified policy.

## Red egress and provisional cost

Red requires an explicit firewall answer. Start from the customer's existing firewall, then supported
FortiGate; Azure Firewall Premium is opt-in and requires an Operations confirmation reference. An
`existing`/`fortigate` next hop is a private IPv4 outside Red's `10.20.0.0/16` and VPN
`172.16.201.0/24` ranges. The agent never sets or edits these fields. Any Red egress cost estimate
is a draft that itm8 supplies: label it **provisional**, not an approved price, and never invent one.

## Sub-zones and egress per audience

Red-Hub uses the customer's existing hub and no itm8 VPN; Red-Isolated uses the itm8 VPN; Yellow-Public
reaches users through the WAF, Entra sign-in and Conditional Access; Yellow-Internal through the
customer hub or a private gateway. Egress `none` is refused when any web app serves users outside the
customer's network (`external` or `public` audience); it fits internal APIs and workers. Red never
uses an unfiltered NAT gateway. Treat sub-zone checks as unavailable unless a tool reports them; the
contract fields are pinned.

## Access model

No generated plan, script, identity or template assigns a subscription role to a person. Use static
Owner/Contributor/Reader groups and PIM-eligible group membership; do not say "Owner through PIM"
for an individual. The customer identity team creates the groups/PIM assignments. Do not copy the
`eligibleAccounts` list or `accessAdmin` name/email from readiness into `.aifactory` findings,
lessons, application logs, Management App telemetry, or PR comments. Describe missing readiness as
customer actions and leave identity facts to the Wizard/onboarding request.

## Basic/Yellow and Fabric

Service level is capacity per environment; it never reduces the selected zone's security controls.
A Basic workload still inherits every required Yellow control. No `dataPlatform`/Fabric integration
is emitted unless the customer explicitly selected one; track names and seed content do not count as
runtime integrations.

## Validation

Validate a generated `ai-factory.json` with:

```text
npm run validate-wizard-spec -- .aifactory/ai-factory.json
```

The checker validates the v1 shape and reports missing human inputs, refused Wizard combinations,
Red egress gaps, evaluation restrictions, Premium token-limit gaps, and access-readiness actions.
Evaluation expiry is checked from the order date when one is supplied; without it the checker
blocks instead of using today's date. It does not approve policy, invent missing answers,
authenticate approvers, or authorize deployment.