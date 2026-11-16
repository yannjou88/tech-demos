# Agent rules

Rules for coding agents working in this repo.

- Never create a new repository. Only add or update files under `apps/<kebab-slug>/` for the demo you were asked to build (plus a row in the README Demos table and the tracking file entry in `tracking/seen-bookmarks.json`). Do not touch other apps or `skills/` unless explicitly asked.
- Before coding, read `skills/project-planning/SKILL.md` and write/follow `apps/<slug>/PLAN.md`.
- Bun is the runtime and package manager. Every app has its own `bunfig.toml` with the following contents BEFORE any `bun install` or `bun add`. Start from an official scaffold via `bunx create-*` where it fits; UI defaults to shadcn/ui with a minimalist preset.

```toml
[install]
minimumReleaseAge = 259200
```

- Each app must run with `bun install && bun run dev` from its own folder, and should need no secrets for the main demo path (use mocks/fixtures if an API key would otherwise be required, and document optional keys in the app's README).
- Open exactly one PR per demo. The PR MUST include BOTH at least one screenshot AND at least one video (screen recording) of the running app as validation artifacts. Not optional.
- Keep tests minimal: critical logic only.
