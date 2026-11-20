# Replatform evidence ledger: {solution name}

**Source:** {repository or upload}, revision `{commit}`
**Discovery scope:** {folders/files inspected}
**Discovery commands:** {read-only commands only}

## Observed facts

| Evidence id | Source | Observation |
|---|---|---|
| `runtime:{path}` | `{path}:{line}` | {fact} |

## Owner answers

| Owner evidence | Question | Answer source | Answer |
|---|---|---|---|
| `owner:{question-id}` | {question} | {issue/PR/ticket/local record} | {answer} |

## Unavailable checks

| Evidence id | Check | Why it could not run |
|---|---|---|
| `unavailable:{check}` | {check} | {reason} |

## Inferences kept out of the fact record

| Inference | Supporting evidence | Confidence |
|---|---|---|
| {inference} | {evidence ids} | {low / medium / high} |

## Optional Azure connector evidence

| Discovery id | Scope SHA-256 | Correlation id | Category | Status | Evidence id |
|---|---|---|---|---|---|
| {Management App snapshot id or `Not recorded`} | {hash or `Not available`} | {correlation id} | {category} | {available / unavailable} | {Azure evidence id} |

Store metadata only. The full inventory remains in the Management App's immutable discovery
record; never copy credentials, secret values, or unrelated customer resource details here.

Never include secret values, production data, dumps, browser exports, or copied logs in this file.