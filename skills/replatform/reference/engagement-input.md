# Engagement input (contract C1)

The Management App's Wizard already knows a lot about the engagement before the agent starts: who
the customer is, which subscriptions and environments, which region, archetype, connectivity,
audience and zone, and which source was uploaded. The agent reads all of it **first** and asks the
owner only for what it leaves open. Asking again is a defect: it costs the owner time and risks a
second, different answer.

## Read it first

For an integrated engagement, call `replatform_get_engagement_input` with the `solutionId` of the
verified allowed scope, straight after `replatform_get_engagement`. It is read-only, scoped by the
run's key, and holds names, choices, ids and hashes only: no credentials and no source content.

The result is checked by [engagement-input.schema.json](../schemas/engagement-input.schema.json), a
mirror of the Management App's shared engagement-input schema. If the tool is
absent or unavailable, record it as unavailable and fall back to the intake and the owner; do not
guess a value.

| Field                                                                                                           | Meaning                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `specification`                                                                                                 | The solution specification the answers come from: id, revision, status, hash. Null when none.    |
| `customer`, `solution`                                                                                          | Registered names; the Wizard's codes are empty until the answers are saved.                      |
| `tenantId`, `zone`, `region`, `allowedRegions`, `archetype`, `connectivity`, `audience`, `environments`          | The Wizard's answers for steps 1 to 3. Null or empty when not answered.                          |
| `source`                                                                                                        | The newest upload: file name, kind, SHA-256 of the upload and of the analyzed package, and when. |
| `missing`                                                                                                       | The answers still open, in a fixed order. **The only Wizard questions the agent may ask.**       |

## Rules

1. **Ask only for `missing`.** Every owner question about the Wizard's inputs must name a field in
   `missing`. Do not ask about the tenant, zone, region, archetype, connectivity, audience,
   environments or source when C1 holds them. An empty `missing` means no Wizard question at all.
2. **C1 is Wizard answers, not repository facts and not approvals.** Record a C1 value in the plan
   as an owner/Wizard answer with its source (`specification` id and revision). A `draft`
   specification is the Wizard's answers so far. The zone stays a suggestion: `confirmedZone`
   remains `null` and a person confirms it.
3. **A C1 value never replaces evidence.** If the code contradicts a C1 answer (for example the
   audience is `internal` but the app is a public site), keep both, say so, and ask one question
   that names the contradiction.
4. **Verify the source.** The package SHA in `source` must match the intake the run was started
   with. A different hash stops the run: the owner uploaded something else.
5. **Do not copy identifiers into customer artifacts.** Tenant and subscription ids stay in the
   authenticated tool result; the plan and comments refer to them by field name.
6. **Re-read it when the owner says the Wizard changed.** C1 is read on demand; a new revision
   appears as a new `specification.revision`.
