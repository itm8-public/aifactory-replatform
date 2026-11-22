# GitHub Copilot modernization (assessment only)

For **.NET** and **Java** repositories, Microsoft's free GitHub Copilot modernization tooling (part
of Copilot) already knows framework and runtime upgrades, deprecated APIs, CVEs in dependencies
and Azure service migrations. The playbook uses its **assessment** as one more source of evidence
instead of re-describing those upgrades in our own references. It decides nothing.

## What it is

- **In a terminal or an agent run:** the Copilot CLI plugin `github-copilot-modernization`
  (marketplace `microsoft/github-copilot-modernization`), driven through its agent
  `github-copilot-modernization:modernize`. Its assessment writes to `.github/modernize/assessment/`.
- **In an IDE:** the GitHub Copilot modernization extension (VS Code, Visual Studio, IntelliJ), with
  the same assessment.
- It also **plans, executes and deploys**. The playbook uses none of that.

## Rules

1. **Assessment only.** Run the assessment phase and stop. Never run its plan, execute, containerize,
   deploy-to-Azure or CVE-fix tasks: our own plan, `appChanges` items and allowed paths decide any
   change, and a person reviews it in the draft PR.
2. **Our platform rules still decide the target.** The tool may suggest Azure services, a runtime or
   an upgrade path. Its suggestion is input to a finding, never a zone, a region, a hosting choice,
   a service, Bicep, or a deployment. No Bicep, no zone, no deployment, as everywhere in this
   playbook.
3. **Record what it reported as evidence, with its source.** In `.aifactory/evidence-ledger.md`, add
   a section **Tool-reported (Copilot modernization)** naming the tool, the plugin or extension
   version, the command or mode, the date, and each finding it reported with the file or dependency
   it points at. A tool finding is **not a repository fact**: a claim in the plan that rests only on
   it is an `inference` with a confidence and cites the deterministic evidence (the runtime, the
   component, the file) that the finding points to. Where the tool and the deterministic facts
   disagree, keep both and say so.
4. **Never commit its output.** `.github/modernize/` is tool output. Do not stage it, do not
   list it in `allowedPaths`, and do not copy its files into the repository. The findings live in
   the evidence ledger and the plan; remove or leave the folder untracked. A finding that wants a
   change outside `allowedPaths` becomes a backlog item, not an edit.
5. **Same data boundary as the agent.** It sends code to a model, so it runs only where the agent
   already runs (the Copilot environment of this engagement, under the same AI processing policy),
   with no extra credentials, no Azure sign-in and no Azure connection. If the plugin or extension is
   not available there, or the run fails, record the check as **unavailable** with the reason
   (`unavailable:copilot-modernization`) and continue with the repository analysis. Never replace it
   with a guess, and never install it with a broader token.
6. **Its findings do not replace review.** A clean tool report is not evidence that the application
   is ready, secure or compliant; it is one input. The PR review stays human.

## When to run it

Phase 1, after the repository analysis: only when the analysis shows a .NET (`*.csproj`, `global.json`)
or Java (`pom.xml`, `build.gradle`) application. Python and Node repositories use the playbook's own
references. Run it once per application root.
