# Tracing: one traceparent per agent run

Every call an agent run makes to the Management App can be followed in one trace, from the Foundry
or Copilot run through the MCP tools and the A2A facade to the audit timeline.

## The rule

- **One trace per agent run.** At the start of a run, use the W3C `traceparent` the run was started
  with if it is valid; otherwise start a new trace (version `00`, a random 16-byte trace id, flags
  `01`). Keep that trace id for the whole run.
- **Every MCP and A2A call carries it.** Each call to the Management App MCP endpoint
  (`/api/v1/mcp`) and A2A facade (`/api/v1/a2a`) sends one `traceparent` header with the run's trace
  id and a new 8-byte parent id for that call. Never two `traceparent` headers on one call; never a
  new trace id inside the run.
- **Report the Foundry ids as span attributes.** When the run is a Foundry agent run, put the
  Foundry conversation id (the thread on classic agents) in `gen_ai.conversation.id` and the
  response id (the run on classic agents) in `gen_ai.response.id` on the run's span. They are ids,
  not content.
- **Nothing else rides along.** Do not send `tracestate` or `baggage`, and never put prompts,
  answers, names, customer ids or secrets in a span attribute.

## Why it is safe to miss

The Management App treats `traceparent` as optional: a missing or malformed one is ignored and the
call gets a new trace. So a host that cannot set the header still works, but the run cannot be
followed end to end. Say so in the run report ("trace context not sent") instead of claiming it.

## Who sends the header

The model does not write HTTP headers. The host does: the Foundry agent's MCP tool and A2A
connection, the Microsoft Agent Framework worker, or the Copilot cloud agent's MCP client. The skill
states the rule; the host configuration is the control, and the eval
`wizard-agent-traceparent` checks the recorded calls.

Microsoft Learn: [Agent tracing overview](https://learn.microsoft.com/azure/foundry/observability/concepts/trace-agent-concept)
and [client-side tracing](https://learn.microsoft.com/azure/foundry/observability/how-to/trace-agent-client-side)
(W3C Trace Context, `gen_ai.conversation.id`).
