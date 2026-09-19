# Repository instructions

These instructions apply to the entire repository and to every agent run started
from this checkout.

## Project scope

- This repository models Machhu-II dam-breach flooding and serves a 3D emergency
  decision-support dashboard.
- Preserve scientific units, coordinate reference systems, nodata handling, and
  provenance. Do not silently replace measured or configured inputs with synthetic
  values. If a fallback is necessary, label it clearly in code and user-facing output.
- Keep the existing Python simulation pipeline, FastAPI service, and static dashboard
  architecture unless the user explicitly requests an architectural change.

## Working rules

- Read the relevant files before editing and keep changes scoped to the request.
- Treat existing user changes as intentional. Do not revert, overwrite, or reformat
  unrelated work.
- Do not install packages or alter dependency files unless the task requires it. If a
  dependency changes, explain why and keep the dependency declaration reproducible.
- Use configuration from `config.json` or existing data products instead of adding new
  Machhu-specific constants where the code is intended to support multiple dams.
- Validate changes with the narrowest relevant checks first. Run broader tests or
  pipeline stages only when their cost and required data are appropriate. Report any
  checks that could not be run; do not claim unperformed validation.
- Update `PROGRESS.md` for material project milestones or changes to documented project
  status, not for trivial edits, audits, or formatting-only changes.
- Never commit, push, publish, or delete generated/user data unless explicitly asked.
  Keep generated caches and large reproducible artifacts out of version control.

## Local skills and detailed rules

- Skills under `.agents/skills/` are opt-in by task relevance. Read a skill's complete
  `SKILL.md` before using it; do not apply every skill to every task.
- For UI or report work, also follow `.agents/rules/ui-ux-rules.md`.
- `.agents/rules/rules.md` explains this repository's instruction layout and maintenance
  conventions. This root file is the authoritative automatically discovered policy.

