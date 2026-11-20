# Intake: getting the code into a working repository

The agent always works in a Git repository. Every intake ends in one.

## A. The customer has Git

GitHub, GitHub Enterprise, Azure DevOps, GitLab or Bitbucket. The management app's source
connection reaches it (the itm8 GitHub App on selected repositories for GitHub; the matching
adapter for the others) and mirrors it into a private repository in the itm8 intake organisation.

- Work on a branch named `aifactory/<short-topic>`.
- Results go back to the customer as a **draft** pull request through the same connection.
- Never push to the customer's default branch. Never touch their CI, pipeline or CODEOWNERS files.

## B. The customer sends a ZIP

The management app accepts the upload (up to 50 MB, recorded with its SHA-256 and the customer's
ownership confirmation). A job unpacks it into a new private intake repository:

- First commit: the archive exactly as received, message `Import <file> as received (sha256 <hash>)`.
- Second commit, separate: remove what must not be versioned (`node_modules/`, `bin/`, `obj/`,
  build output, `.env` files with values). List what was removed in the commit message.
- From here it is intake A, except that results stay in the intake repository and are handed over
  as an archive or a new repository, as the delivery lead decides.

## C. XML or Repomix export

One file with the whole codebase flattened into text (up to 2 MB). Good enough to **assess**:
runtimes, dependencies, structure, data model, risk evidence. Not enough to **rebuild**: folder
layout, binaries, line endings, file modes and config can be lost.

- Do the assessment and the questions.
- In the plan, ask for a ZIP or Git access before any implementation.
- Never reconstruct a repository from the export and present it as the customer's code.

## Before reading any code

Check that the intake record says the customer owns the code and has authorised itm8 to analyse
it. If it does not, stop and ask. Customer code is processed only with the models the AI
processing policy allows ([platform-rules.md](platform-rules.md)).
