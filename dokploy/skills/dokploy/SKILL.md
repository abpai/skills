---
name: dokploy
description: Comprehensive skill for operating Dokploy via the official Dokploy CLI (oclif-based). Use when users ask to authenticate, verify access, or manage Dokploy projects, environments, apps, env vars, and databases from the terminal. Includes robust oclif parsing rules and a safe help-first workflow to avoid subcommand/positional-arg confusion.
argument-hint: "[dokploy subcommand]"
license: MIT
compatibility: Requires Node.js + npm, network access to the Dokploy server, and the @dokploy/cli package installed. Assumes the user can provide a Dokploy server URL and access token.
metadata:
  author: Andy Pai
  homepage: https://github.com/Dokploy/cli
  docs: https://docs.dokploy.com/docs/cli
  framework: oclif
  version: "1.2"
  version_note: "Always confirm command syntax with `dokploy --help` and `dokploy <cmd> --help`. The CLI is oclif-based and may change flags across versions."
---

# Dokploy CLI Skill

Use this skill to manage Dokploy from the command line using the official Dokploy CLI:

- Authenticate + verify access
- Create/list/inspect projects
- Create/delete environments
- Create/deploy/stop/delete applications
- Pull/push environment variables to/from a file
- Create/deploy/stop/delete databases (MariaDB, PostgreSQL, MySQL, MongoDB, Redis)

Primary sources of truth:

- Dokploy CLI repo/README: https://github.com/Dokploy/cli
- Dokploy CLI docs: https://docs.dokploy.com/docs/cli

If anything fails due to version drift, immediately fall back to:

- `dokploy --help`
- `dokploy <command path> --help`
  …and adapt to the discovered syntax.

## Non-negotiable rules

### Safety rules

1. Never run destructive commands (`delete`, `stop`) without explicit user confirmation.
2. Before making changes, verify auth: `dokploy verify`.
3. Prefer idempotent workflows (list/inspect first, then create/deploy).
4. If the user says “production” (or if it’s ambiguous), announce exactly what will change before running the command.

### Oclif parsing rule (critical)

Dokploy CLI is built on oclif. oclif treats tokens after a command as potential deeper subcommands in many cases. Example:
`dokploy project create vibe-kanban` can be interpreted as a command lookup like `project:create:vibe-kanban`, not as “create a project named vibe-kanban”.

Therefore:

- Do NOT pass resource names as bare positional arguments unless `dokploy <cmd> --help` explicitly documents positional args.
- Prefer flags (commonly `-n/--name`, `-p/--project`, `-e/--environment`, etc.) OR use interactive prompts when the CLI supports them.
- If you don’t know the flags for a command, run `dokploy <cmd> --help` FIRST, then retry with the documented flags.

## Standard operating pattern (help-first, robust)

When you need to use any command you are not 100% sure about:

1. Check top-level help

```bash
dokploy --help
```

2. Check the specific command help

```bash
dokploy <command> --help
# e.g.
dokploy project create --help
```

3. Run the command using flags (NOT trailing positional “names”) or run with no extras and follow prompts.

## Install / update

Install globally:

```bash
npm install -g @dokploy/cli
```

Verify install:

```bash
dokploy --version
dokploy --help
```

## Authentication

Tokens are generated in the Dokploy dashboard (Settings → Profile → Generate token). Then authenticate via CLI.

Authenticate:

```bash
dokploy authenticate
```

Verify current auth:

```bash
dokploy verify
```

Troubleshooting:

- If `verify` fails, run `dokploy authenticate` again and ensure the server URL + token are correct.
- If permissions are insufficient, generate a new token with appropriate access.

## Projects

List projects:

```bash
dokploy project list
```

Inspect project (if available in your CLI version):

```bash
dokploy project info --help
dokploy project info
```

Create a project (IMPORTANT: use flags or interactive mode; do not pass positional name unless documented):

```bash
dokploy project create --help
# Option A (recommended): interactive prompts
dokploy project create

# Option B: use flags (example; confirm with --help)
dokploy project create -n "vibe-kanban"
```

## Environments

Create an environment:

```bash
dokploy environment create --help
# Option A: interactive prompts
dokploy environment create

# Option B: flags (example; confirm with --help)
dokploy environment create -n "staging" -p "vibe-kanban"
```

Delete an environment (destructive — confirm with user first):

```bash
dokploy environment delete --help
dokploy environment delete
```

## Applications

Create an application:

```bash
dokploy app create --help
# Option A: interactive prompts
dokploy app create

# Option B: flags (example; confirm with --help)
dokploy app create -n "web" -p "vibe-kanban" -e "staging"
```

Deploy an application:

```bash
dokploy app deploy --help
dokploy app deploy
```

Stop a running application (service disruption — confirm first):

```bash
dokploy app stop --help
dokploy app stop
```

Delete an application (destructive — confirm first):

```bash
dokploy app delete --help
dokploy app delete
```

### Recommended app workflow (bootstrap → deploy)

1. Verify auth:

```bash
dokploy verify
```

2. Ensure project exists (list first; create if needed):

```bash
dokploy project list
dokploy project create --help
dokploy project create
```

3. Ensure environment exists:

```bash
dokploy environment create --help
dokploy environment create
```

4. Create the app:

```bash
dokploy app create --help
dokploy app create
```

5. Set environment variables (see Env Vars section)

6. Deploy:

```bash
dokploy app deploy --help
dokploy app deploy
```

## Environment variables (pull/push)

Dokploy CLI supports syncing environment variables through a file.

Pull env vars from Dokploy into a local file:

```bash
dokploy env pull --help
dokploy env pull .env.dokploy
```

Push env vars from a file into Dokploy:

```bash
dokploy env push --help
dokploy env push .env.dokploy
```

Best practices:

- Treat `.env.dokploy` as sensitive; do not commit secrets.
- Prefer “pull → edit → push → redeploy”:

```bash
dokploy env pull .env.dokploy
# edit .env.dokploy
dokploy env push .env.dokploy
dokploy app deploy
```

If there are multiple apps/environments, use `dokploy env --help` to confirm how targets are selected (flags vs prompts).

## Databases

Dokploy CLI supports managing:

- MariaDB
- PostgreSQL
- MySQL
- MongoDB
- Redis

General pattern:

```bash
dokploy database <type> create
dokploy database <type> deploy
dokploy database <type> stop
dokploy database <type> delete
```

Always run `--help` first for the specific type to confirm flags/target selection.

MariaDB:

```bash
dokploy database mariadb --help
dokploy database mariadb create --help
dokploy database mariadb create
dokploy database mariadb deploy --help
dokploy database mariadb deploy
```

PostgreSQL:

```bash
dokploy database postgresql --help
dokploy database postgresql create --help
dokploy database postgresql create
dokploy database postgresql deploy --help
dokploy database postgresql deploy
```

MySQL:

```bash
dokploy database mysql --help
dokploy database mysql create --help
dokploy database mysql create
dokploy database mysql deploy --help
dokploy database mysql deploy
```

MongoDB:

```bash
dokploy database mongodb --help
dokploy database mongodb create --help
dokploy database mongodb create
dokploy database mongodb deploy --help
dokploy database mongodb deploy
```

Redis:

```bash
dokploy database redis --help
dokploy database redis create --help
dokploy database redis create
dokploy database redis deploy --help
dokploy database redis deploy
```

Stop/delete (confirm first):

```bash
dokploy database postgresql stop --help
dokploy database postgresql stop

dokploy database postgresql delete --help
dokploy database postgresql delete
```

### Recommended database + app workflow

1. Create + deploy DB (example: Postgres):

```bash
dokploy verify
dokploy database postgresql create --help
dokploy database postgresql create
dokploy database postgresql deploy --help
dokploy database postgresql deploy
```

2. Add DB connection vars and redeploy app:

```bash
dokploy env pull .env.dokploy
# edit .env.dokploy to include DATABASE_URL / credentials
dokploy env push .env.dokploy
dokploy app deploy
```

## Operational playbooks (agent-ready)

### Playbook: “Deploy my app to Dokploy”

Steps:

- Verify auth
- Ensure project + environment exist
- Create app if missing
- Push env vars
- Deploy

Commands (help-first):

```bash
dokploy verify
dokploy project list
dokploy project create --help
dokploy project create
dokploy environment create --help
dokploy environment create
dokploy app create --help
dokploy app create
dokploy env push --help
dokploy env push .env.dokploy
dokploy app deploy --help
dokploy app deploy
```

### Playbook: “Update env vars and redeploy”

```bash
dokploy verify
dokploy env pull --help
dokploy env pull .env.dokploy
# edit .env.dokploy
dokploy env push --help
dokploy env push .env.dokploy
dokploy app deploy
```

### Playbook: “Provision Postgres then deploy app”

```bash
dokploy verify
dokploy database postgresql create --help
dokploy database postgresql create
dokploy database postgresql deploy --help
dokploy database postgresql deploy
dokploy env push .env.dokploy
dokploy app deploy
```

### Playbook: “Stop or delete resources”

- Stop: service disruption — confirm with user first.
- Delete: irreversible — confirm twice.

Examples:

```bash
dokploy app stop
dokploy app delete
dokploy environment delete
dokploy database postgresql stop
dokploy database postgresql delete
```

## When to use the Dokploy dashboard instead of CLI

Use the dashboard when:

- You need to confirm or edit app settings (repo/image/build config) not exposed by the CLI.
- You need richer visibility (logs/status) and the CLI doesn’t provide it.
- You’re unsure which resource a command will target and `--help` doesn’t clarify it.

## Reference links

- CLI docs: https://docs.dokploy.com/docs/cli
- CLI repo: https://github.com/Dokploy/cli

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `dokploy` against this file's `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **dokploy** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update dokploy` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
