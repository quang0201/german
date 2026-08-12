# Deployment Helper Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe Linux `deploy.sh` that creates `.env`, runs the existing `migrations | seed | app` lifecycle, deploys/updates the Docker app, and documents the operator workflow.

**Architecture:** Keep deployment orchestration at the repository root and keep application lifecycle responsibilities inside the already implemented start modes. Docker Compose remains a single `german-app` service, switches to Linux host networking so a blank DB host can resolve to host-local `127.0.0.1`, and the Bash helper owns prompts, validation, lifecycle command composition, and bounded health waiting.

**Tech Stack:** Bash, Docker Engine, Docker Compose v2, ASP.NET Core/.NET 10, PostgreSQL, existing Bun 1.3.14 architecture tests. No new third-party libraries.

## Global Constraints

- Supported deployment platform is Linux with Docker Engine and Docker Compose v2 (`docker compose`).
- PostgreSQL remains external to this Compose project; never add a PostgreSQL service.
- Blank database host resolves to `127.0.0.1`.
- Loopback hosts default to `SSL Mode=Disable`; non-loopback hosts default to `SSL Mode=Require`.
- Preserve explicit `migrations | seed | app`: app never migrates/seeds, seed never migrates, migrations never seeds.
- `.env` remains git-ignored, is created with mode `0600`, and secrets are not echoed by the helper.
- `update` only fast-forwards `dev` from `origin/dev`; it never checks out or merges `main`.
- No new third-party dependencies or shell testing frameworks.

---

### Task 1: Deployment helper core and Bash tests

**Files:**
- Create: `deploy.sh`
- Create: `tests/deploy-script.test.sh`

**Interfaces:**
- Produces shell functions `default_ssl_mode`, `validate_env_component`, `build_connection_string`, `require_env_file`, `wait_for_health`, and `main`.
- `deploy.sh` is source-safe via `if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi` so the Bash test can call pure helpers without executing deployment actions.

- [ ] **Step 1: Write failing Bash tests for defaults, serialization validation, and dispatch**

Create `tests/deploy-script.test.sh` using only Bash. Source `deploy.sh`, assert that `default_ssl_mode 127.0.0.1`, `localhost`, and `::1` return `Disable`; a remote hostname returns `Require`; connection-string components containing semicolon/newline are rejected; a normal connection string is generated exactly; and `main unknown` exits non-zero in a subshell.

- [ ] **Step 2: Run syntax/tests and confirm red state**

Run:

```bash
bash -n tests/deploy-script.test.sh
bash tests/deploy-script.test.sh
```

Expected before implementation: failure because `deploy.sh` or required functions do not exist.

- [ ] **Step 3: Implement `deploy.sh`**

Implement strict mode `set -Eeuo pipefail`, repository-root resolution, prerequisite checks, prompt helpers, hidden password reads, safe connection-string component validation, `.env` generation with `chmod 600`, and command dispatch:

```text
setup    interactive .env creation
migrate  validate .env, build image, run `docker compose run --rm german-app migrations`
seed     validate .env, run `docker compose run --rm german-app seed`
deploy   build, `docker compose up -d --force-recreate german-app`, bounded health wait
update   require dev + clean tree, fetch origin/dev, ff-only merge, build, stop app, migrate, start app, health wait
status   docker compose ps german-app
logs     docker compose logs -f german-app
```

`setup` must ask before overwriting `.env`, default blank host to `127.0.0.1`, use local/remote SSL defaults, require the DB password, only ask bootstrap credentials when enabled, require bootstrap password length >= 8, and never print entered passwords.

`wait_for_health` must poll `docker compose ps -q german-app` plus `docker inspect` for a bounded timeout; on failure print status and recent logs, then return non-zero.

- [ ] **Step 4: Run Bash tests green**

```bash
bash -n deploy.sh
bash -n tests/deploy-script.test.sh
bash tests/deploy-script.test.sh
```

Expected: all pass.

- [ ] **Step 5: Ensure executable mode and commit**

Ensure repository mode for `deploy.sh` is `100755` so documented `./deploy.sh ...` commands work after clone.

---

### Task 2: Compose host networking and configuration guardrail

**Files:**
- Modify: `compose.yaml`
- Modify: `.env.example`
- Modify: `src/frontend/src/architecture.test.js`

**Interfaces:**
- `compose.yaml` consumes `APP_PORT` and `ConnectionStrings__German` from `.env`.
- The architecture test locks the deployment contract so later changes cannot silently restore bridge-only loopback behavior or a local DB service.

- [ ] **Step 1: Add failing architecture assertions**

Extend the existing architecture guardrail to assert:

```text
compose.yaml contains `network_mode: host`
compose.yaml does not contain a `ports:` section
compose.yaml contains `ASPNETCORE_URLS=http://+:${APP_PORT:-8080}`
compose.yaml has no postgres service/image
compose.yaml healthcheck addresses `${APP_PORT:-8080}`
```

- [ ] **Step 2: Run frontend tests to verify failure**

```bash
cd src/frontend
bun install --frozen-lockfile
bun test
```

Expected: deployment Compose guardrail fails against the old port-publishing Compose file.

- [ ] **Step 3: Update Compose**

Set `network_mode: host`, remove `ports`, add:

```yaml
environment:
  ASPNETCORE_URLS: "http://+:${APP_PORT:-8080}"
```

Keep `env_file: .env`, `restart: unless-stopped`, and update healthcheck URL to `http://localhost:${APP_PORT:-8080}/health`.

Keep `.env.example` non-secret and aligned to the same application keys. Do not add a database container.

- [ ] **Step 4: Run guardrail and Compose validation**

```bash
cp .env.example .env
docker compose config >/tmp/german-compose.yml
cd src/frontend && bun test
```

Expected: tests and Compose config succeed; rendered config uses host networking and no published port.

---

### Task 3: CI verification for the deployment helper

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- CI invokes only repository-provided Bash tests and Docker Compose validation; no live PostgreSQL dependency is introduced.

- [ ] **Step 1: Add deployment helper checks to Docker CI job**

Before Compose validation, run:

```bash
bash -n deploy.sh
bash -n tests/deploy-script.test.sh
bash tests/deploy-script.test.sh
```

Render Compose after copying `.env.example`, then assert host networking and absence of a PostgreSQL service. Keep the existing Docker image build.

- [ ] **Step 2: Verify workflow syntax by pushing branch and observing GitHub Actions**

Expected jobs: `backend`, `frontend`, and `docker`; all must complete successfully.

---

### Task 4: Canonical deployment documentation

**Files:**
- Create: `docs/DEPLOYMENT.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:**
- `docs/DEPLOYMENT.md` is the canonical operator guide.
- README links to the canonical guide and gives the shortest first-deploy path.
- Architecture records lifecycle and networking decisions, not step-by-step operator detail.

- [ ] **Step 1: Write `docs/DEPLOYMENT.md`**

Document prerequisites, cloning/switching to `dev`, `./deploy.sh setup`, the first deployment sequence, remote PostgreSQL examples, blank-host loopback behavior, SSL defaults, bootstrap seed behavior, `update`, `status`, `logs`, stopping/restarting, health verification, `.env` permissions, and troubleshooting migration/health/database failures.

Use this first-deploy flow exactly:

```bash
./deploy.sh setup
./deploy.sh migrate
./deploy.sh seed      # only if BootstrapAdmin__Enabled=true
./deploy.sh deploy
```

- [ ] **Step 2: Update README deployment section**

Make `deploy.sh` the recommended Linux server workflow, retain lower-level Docker Compose start-mode commands as reference, and link to `docs/DEPLOYMENT.md`.

- [ ] **Step 3: Update architecture contract**

Record that production-like lifecycle uses explicit one-shot migration/seed before `app`, and the Linux Compose helper uses host networking to support PostgreSQL either at host loopback or at remote IP/domain. Preserve the no-local-DB-service rule.

- [ ] **Step 4: Check documentation examples against script command names**

Search README/DEPLOYMENT/ARCHITECTURE for stale claims that app startup auto-migrates or that Compose publishes `${APP_PORT}:8080`; remove contradictions.

---

### Task 5: Final verification, PR, review, and merge to dev

**Files:**
- Review all changed files from `dev...feat/deploy-script`.

- [ ] **Step 1: Fresh CI verification**

Require a fresh branch HEAD where `backend`, `frontend`, and `docker` checks all report `success`.

- [ ] **Step 2: Review the complete diff**

Verify no secret values were committed, no PostgreSQL service was added, app/migration/seed responsibilities remain split, `deploy.sh update` cannot merge/check out `main`, `.env` overwrite is confirmed, and docs match actual commands.

- [ ] **Step 3: Create PR targeting `dev`**

PR title: `feat: add deployment helper script`

Summarize helper commands, host-networking rationale, documentation, and CI evidence.

- [ ] **Step 4: Merge only into `dev`**

After review and green CI, merge PR with expected head SHA. Do not merge or update `main`.

- [ ] **Step 5: Verify post-merge CI on `dev`**

Check the merge commit itself. `backend`, `frontend`, and `docker` must all report success before declaring the work complete.
