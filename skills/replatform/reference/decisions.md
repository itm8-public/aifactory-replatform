# Decision protocol

Create a decision record only when a choice changes the risk zone, placement, hosting target,
data store, identity model, network exposure, service level, migration method, or operating model.
A decision record makes options reviewable; it never lets the agent decide for a person.

## Statuses and ownership

| Status | Meaning | Who may set it |
|---|---|---|
| `proposed` | The agent has evidence, options, and a recommendation. | Agent |
| `approved` | A responsible architect recorded a specific decision. | Responsible architect |
| `rejected` | A person declined the recommendation. | Responsible architect or owner |
| `deferred` | A person knowingly postponed it and recorded the resulting risk. | Responsible architect or owner |
| `superseded` | A later decision replaced it. | Responsible architect or owner |

Use [../templates/decision-record.md](../templates/decision-record.md) for the human-readable
record. `decisionRecords` in `replatform-plan.json` carries the same essential fields for tools.

## Stops

- **Facts and questions:** Stop after discovery when material facts are unknown. The owner
  answers questions; the agent does not fill gaps with guesses.
- **Scope change:** A change to hosting, migration, data classification, network exposure or zone
  goes back to the owner as a question and updates the decision record and plan.
- **Review:** A person reviews validation and residual risk in the draft PR. The agent never treats
  silence or a generic "looks good" as a decision on an ADR.
