# Deployment Helper Script Design

Date: 2026-08-12

## Goal

Add a Linux deployment helper for the existing Docker runtime so a server operator can create `.env`, run EF Core migrations, optionally seed the bootstrap admin, deploy the app, inspect status/logs, and update from `dev` without manually reconstructing Docker commands.

The database model is always remote-compatible: the operator provides a PostgreSQL host/IP/domain. If the host is left blank, the helper uses `127.0.0.1`, meaning PostgreSQL is running on the same Linux host as Docker.

## Scope

The feature adds one root-level `deploy.sh` and updates Docker Compose/documentation to support the helper. It does not change application business logic, authentication, persistence mappings, migration contents, or the existing `migrations | seed | app` process modes.

Supported deployment platform is Linux with Docker Engine and Docker Compose v2 (`docker compose`).

## Networking decision

`german-app` will use Docker host networking on Linux.

```yaml
network_mode: host
```

This is required so `DB_HOST` defaulting to `127.0.0.1` reaches PostgreSQL bound to the host loopback interface. A remote IP/domain continues to work normally with the same networking mode.

Because host networking does not use Docker port publishing, the existing Compose `ports:` mapping will be removed. `APP_PORT` will control the ASP.NET listening port directly through `ASPNETCORE_URLS` and defaults to `8080`.

Example behavior:

```text
DB_HOST=""              -> 127.0.0.1
DB_HOST=10.0.0.20       -> PostgreSQL on LAN
DB_HOST=db.example.com  -> PostgreSQL remote
```

## `deploy.sh` commands

The script exposes these commands:

```bash
./deploy.sh setup
./deploy.sh migrate
./deploy.sh seed
./deploy.sh deploy
./deploy.sh update
./deploy.sh status
./deploy.sh logs
```

Running without a command prints usage and exits non-zero.

### `setup`

`setup` is interactive and creates the root `.env` file.

Prompts and defaults:

```text
PostgreSQL host [127.0.0.1]:
PostgreSQL port [5432]:
Database [german]:
Username [german]:
Password:
SSL mode [Disable|Require]:
App port [8080]:
Bootstrap admin enabled [false]:
Bootstrap username [admin]:
Bootstrap password:
```

Rules:

- Blank database host becomes `127.0.0.1`.
- Host `127.0.0.1`, `localhost`, or `::1` defaults SSL mode to `Disable`.
- Any other host defaults SSL mode to `Require`.
- The operator may override the SSL mode when prompted.
- Database password is required and entered without terminal echo.
- Bootstrap username/password are requested only when bootstrap is enabled.
- Bootstrap password must satisfy the application requirement of at least 8 characters.
- `.env` is written with file mode `0600`.
- Existing `.env` is not silently overwritten; the script asks for confirmation first.
- `.env` remains git-ignored.

Generated configuration keeps the application's existing configuration contract:

```env
APP_PORT=8080
ConnectionStrings__German=Host=127.0.0.1;Port=5432;Database=german;Username=german;Password=...;SSL Mode=Disable
BootstrapAdmin__Enabled=false
BootstrapAdmin__Username=admin
BootstrapAdmin__Password=
```

The script must safely serialize prompted values into the connection string and reject values it cannot represent safely rather than writing a malformed `.env`.

### `migrate`

Runs the existing one-shot migration mode:

```bash
docker compose run --rm german-app migrations
```

The command fails immediately if `.env` is missing or if the migration process returns non-zero. It does not seed and does not start the web app.

### `seed`

Runs the existing one-shot seed mode:

```bash
docker compose run --rm german-app seed
```

It does not run migrations. The existing bootstrap seeder remains idempotent: if an account already exists, it does not create another bootstrap admin.

### `deploy`

Deployment performs:

```text
validate prerequisites
validate .env
build german-app image
start/recreate german-app in app mode
wait for /health
report container status
```

`deploy` does not automatically migrate or seed. This preserves the explicit responsibility split already established by `migrations | seed | app`.

For first deployment the documented sequence is:

```bash
./deploy.sh setup
./deploy.sh migrate
./deploy.sh seed      # only when bootstrap admin is needed
./deploy.sh deploy
```

### `update`

`update` is intended for this project's integration-server workflow and only updates from `origin/dev`.

Preconditions:

- current Git branch must be `dev`;
- working tree must be clean;
- `.env` must exist;
- Docker/Compose must be available.

Sequence:

```text
git fetch origin dev
fast-forward local dev to origin/dev
build new image
stop german-app
run migrations using the new image
if migration succeeds: start german-app
wait for /health
report status
```

The command never checks out or merges `main`, never performs a non-fast-forward Git merge, and never runs seed automatically.

If migration fails, `update` exits non-zero and does not start the new app. The failure is visible to the operator instead of being hidden by an automatic fallback.

### `status`

Runs:

```bash
docker compose ps german-app
```

and shows the configured health status.

### `logs`

Runs:

```bash
docker compose logs -f german-app
```

so normal `Ctrl+C` behavior stops log following without stopping the container.

## Prerequisite and error handling

Commands that need Docker verify:

```text
docker command exists
docker compose version succeeds
Docker daemon is reachable
.env exists where required
```

`setup` does not require a running database. Database connectivity is naturally validated by `migrate`, `seed`, or application startup.

The script uses strict Bash behavior (`set -Eeuo pipefail`) and clear non-zero exits. Secrets are never printed by the script.

`deploy` and `update` wait for the app healthcheck for a bounded period. If the container exits or health does not become healthy before the timeout, the script prints container status and recent logs and exits non-zero.

## Docker Compose changes

`compose.yaml` will remain a single `german-app` service with no PostgreSQL service.

Changes:

- use `network_mode: host`;
- remove `ports:` because host networking bypasses port publishing;
- set `ASPNETCORE_URLS=http://+:${APP_PORT:-8080}`;
- keep `.env` via `env_file`;
- keep `restart: unless-stopped` for normal app mode;
- make healthcheck use `${APP_PORT:-8080}`.

The image continues to default to `app` through Docker `CMD ["app"]`; one-shot commands override the command with `migrations` or `seed`.

## Security

- `.env` stays excluded from Git and Docker build context.
- `setup` creates `.env` with permission `0600`.
- Password prompts use non-echoed input.
- The script does not log the generated connection string.
- Remote PostgreSQL defaults to `SSL Mode=Require`; loopback defaults to `Disable`.
- No production credentials are added to `.env.example` or documentation.

## Documentation changes

Implementation will update documentation in the same feature:

1. Add `docs/DEPLOYMENT.md` as the canonical operator guide covering initial setup, migrations, seed, deploy, update, logs/status, local-loopback PostgreSQL, remote PostgreSQL, SSL defaults, and troubleshooting.
2. Update `README.md` to make `deploy.sh` the recommended server deployment path and link to `docs/DEPLOYMENT.md`; raw Docker commands remain as lower-level reference where useful.
3. Update `docs/ARCHITECTURE.md` deployment lifecycle section to record that production-like app mode never migrates/seeds automatically and that the Linux deployment helper uses host networking to support host-local or remote PostgreSQL.
4. Keep `.env.example` as a non-secret reference consistent with the script-generated keys.

## Testing and verification

The script will be designed so non-interactive pieces can be checked in CI without using a real PostgreSQL server.

Minimum verification:

- `bash -n deploy.sh` passes;
- shell command dispatch and defaults are covered by a lightweight test strategy without adding a new third-party testing framework;
- architecture/frontend tests remain green;
- backend test suites remain green;
- `docker compose config` succeeds with `.env.example` copied to `.env`;
- Docker image builds successfully;
- Compose config confirms host networking and no local PostgreSQL service;
- documentation examples match actual script commands.

A live `migrate/seed/deploy` smoke test against a real PostgreSQL instance is an environment-level verification and is not required in GitHub CI.

## Non-goals

This feature does not add:

- a PostgreSQL container to `compose.yaml`;
- automatic database backup/restore;
- automatic rollback after failed migrations;
- registry publishing;
- SSH deployment to another machine;
- secret managers;
- Kubernetes/systemd deployment;
- deployment from `main`.
