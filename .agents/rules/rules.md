# Agent configuration maintenance

The repository-wide instructions live in `/AGENTS.md`. Keep that file concise because
it is loaded on every run. This file documents how to maintain `.agents/` itself.

## Rules

- Store reusable task-specific guidance as `.agents/skills/<skill-name>/SKILL.md`.
- A skill directory name and its frontmatter `name` must match. Names use lowercase
  letters, digits, and hyphens.
- Every skill needs YAML frontmatter containing `name` and a precise `description`.
  Use only frontmatter fields supported by the Codex skill format.
- Keep skill names unique across the entire `.agents/skills/` tree. Do not keep copied
  entrypoints in multiple directories.
- Skill descriptions must say when the skill applies. Avoid catch-all triggers that
  force unrelated skills into ordinary tasks.
- Put conditional detail in `references/` and deterministic reusable operations in
  `scripts/`. Link those resources from `SKILL.md` when an agent needs to discover them.
- Do not create a manual `skills.json`; Codex discovers skills from their `SKILL.md`
  files.
- Save Markdown and source files as UTF-8. Do not commit caches such as `__pycache__`.
- After changing a skill, run the skill validator with UTF-8 mode enabled on Windows:
  `python -X utf8 <skill-creator>/scripts/quick_validate.py <skill-directory>`.

Project behavior belongs in `/AGENTS.md`; UI-specific behavior belongs in
`ui-ux-rules.md`. Do not duplicate either policy inside individual skills.
