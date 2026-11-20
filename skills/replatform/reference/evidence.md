# Evidence and claim protocol

A replatform assessment is trustworthy only when a reviewer can distinguish what the agent saw,
what an owner said, and what remains unknown. Record evidence while discovering the repository;
do not reconstruct it from memory while drafting a plan.

## Evidence classes

| Class | Meaning | Allowed use |
|---|---|---|
| Fact | A repository path, line/range, dependency, runtime declaration, scanner result, or command output observed by the agent | Findings, architecture, backlog, and recommendations |
| Azure connector fact | An inventory item from an available query category in a Management App Azure discovery explicitly permitted by the engagement | Findings and hosting/resource recommendations only; it is not a repository fact, owner answer, quota guarantee, or zone decision |
| Owner answer | A named owner answered a question in an issue, pull request, ticket, or local session | Risk and hosting context only; never copy it into the management-app assessment as a repository fact |
| Unavailable | A named check could not run, with a reason | Gaps and validation status; never a passing result |
| Inference | A bounded conclusion from facts, with an explicit confidence level | Recommendations only; never a compliance verdict |

Use the evidence ids in [outputs.md](outputs.md). For an answered owner question, use
`owner:<question-id>` only outside `assessment.draft`; the answer itself remains in `questions` or
`risk.answers`. Azure connector facts use `azure-discovery:<discovery-id>:<category>` and unavailable
categories use `unavailable:azure-discovery:<discovery-id>:<category>`. A Q1–Q8 or AI Act answer is
never an `azure` source; the connector cannot answer what the customer intends or how people use
the application.

## Claim rules

1. Cite at least one evidence id for every finding, target change, backlog item, application change,
   and hosting signal.
2. A `fact` finding cites observed facts only. An `unavailable` finding cites `unavailable:` or
   `tool-error:` ids only. An inference names its confidence and its supporting evidence.
3. Quote paths and line ranges when the source is text. Record the exact command and a short output
   excerpt when the source is a tool.
4. Say `unknown` or `unavailable` when evidence is absent. Do not replace it with a generic Azure
   assumption.
5. Record secret names, locations, and scanner rule names only. Never record values, dumps,
   production logs, browser exports, or customer data.
6. Never say that the application is compliant. State the controls proposed and the checks that did
   or did not run.

Run `npm run validate-plan -- .aifactory/replatform-plan.json` before requesting approval. It
rejects unknown evidence ids, unsupported zone suggestions, and protected customer paths.