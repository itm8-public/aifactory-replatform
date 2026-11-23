# Wizard agent tools

The allow list for the agent's MCP connection in Foundry (`allowed_tools`). The Management App
registry in `contracts/mgmt/mcp-tools.json` is the source, and `contracts/mgmt/wizard-agent.json` is
the published allow list; itm8 keeps this table and that file in step.

| Tool | Use |
|---|---|
| `replatform_get_engagement_input` | What the Wizard already knows; find the unknowns |
| `replatform_get_engagement` | Engagement state and run progress |
| `replatform_get_audit_timeline` | What happened, for explaining status |
| `replatform_get_policy_snapshot` | The policy a proposal is checked against |
| `replatform_get_landing_zone_catalog` | Redacted catalog of zones and regions |
| `replatform_get_customer_caf_profile` | The customer's networks, regions and policies |
| `replatform_get_shared_resources` | Shared platform resources a solution could reuse |
| `replatform_get_prerequisite_status` | Which customer role blocks which prerequisite package; read-only |
| `replatform_get_customer_summary` | The customer's estate check and which role has an active holder; role names and flags only |
| `replatform_ask_question` | Ask a role-holder; a person answers |
| `replatform_validate_replatform_plan` | Check a draft before posting |
| `replatform_post_replatform_assessment` | Store a draft as a proposal for a person to approve |
| `replatform_post_wizard_proposal` | Store a proposal for the Wizard's Apps step (C2, source `wizard-agent`) and, in `steps`, for steps 1 to 3 and readiness; never a final value, a person applies it |
| `replatform_create_question_packages` | Create the role-holder question packages from the approved spec; never sends, verifies, attests or waives |
| `replatform_start_replatform_run` | Start the GitHub run for an engagement whose repository a person approved, or return the run it has |
| `replatform_get_replatform_run` | Read a run: state, pull request link, newest assessment, the steps a person still has to take |
| `replatform_request_approval` | Ask for human review; it never approves |

Not in the list, on purpose: `replatform_record_approval`, `replatform_decide_scope_amendment`,
`replatform_answer_question`, `replatform_answer_risk_question` (people only), and the Azure
discovery and evidence-writing tools (the Replatform agent uses those, not the Wizard agent).

## Replatform runs (A2A)

The Management App's A2A facade starts and reads Replatform runs. Its shapes are pinned in
`contracts/mgmt/a2a-runs.json` and the agent's published allow list in
`contracts/mgmt/wizard-agent.json`. It is off by default in the Management App.

- Agent card: `/api/v1/a2a/.well-known/agent-card.json`; JSON-RPC at `/api/v1/a2a` with `SendMessage`,
  `GetTask` and `CancelTask`. Authentication is the per-solution MCP key.
- Start a run with the `start-replatform-run` skill and an `engagementId`. The repository must already be
  approved by a person; otherwise the facade answers with a conflict. The task id is the engagement id.
- `INPUT_REQUIRED` means a person must act (a question, or the plan approval). Say which, and wait.
- The facade has no approve method. The agent never approves, confirms a zone or deploys.

## Trace context (host configuration)

This section is for the people who configure the Foundry agent's host; it is not in the agent's
pinned instructions, because the model does not write HTTP headers or span attributes. Keep one
trace per agent run: the `traceparent` the run started with if it is valid, otherwise a new trace.
If the host cannot send the header, the run report says "trace context not sent"
([tracing.md](../../replatform/reference/tracing.md)).

Every MCP call and A2A call (`SendMessage`, `GetTask`, `CancelTask`) carries one W3C `traceparent`
header with the agent run's single trace id and a new parent id per call. The Management App records
it with the audit entry and returns a `traceparent` on the response; a missing or malformed header is
ignored, not refused. The Foundry conversation id and response id go on the run's span as
`gen_ai.conversation.id` and `gen_ai.response.id`. No `tracestate`, no `baggage`. The host sets the
header (the Foundry MCP tool and A2A connection); the eval `wizard-agent-traceparent` checks it.

## Incoming A2A (rollout)

Incoming A2A stays off on the Foundry Wizard agent until a release with the run guard in SKILL.md
and the `a2a-run-id-guard` eval has passed the release gate; turning it on is itm8's decision
([incoming-a2a.md](../../replatform/reference/incoming-a2a.md#off-until-published)).
