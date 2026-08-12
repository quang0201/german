#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"
SERVICE_NAME="german-app"
HEALTH_TIMEOUT_SECONDS="${DEPLOY_HEALTH_TIMEOUT_SECONDS:-150}"

log() {
    printf '[deploy] %s\n' "$*"
}

error() {
    printf '[deploy] ERROR: %s\n' "$*" >&2
}

die() {
    error "$*"
    exit 1
}

usage() {
    cat <<'EOF'
Usage: ./deploy.sh <command>

Commands:
  setup    Create or replace .env interactively
  migrate  Build the image and run EF Core migrations, then exit
  seed     Build the image and run bootstrap seed only, then exit
  deploy   Build/recreate the app and wait until it is healthy
  update   Fast-forward dev from origin/dev, migrate, deploy, and health-check
  status   Show german-app container status
  logs     Follow german-app logs
  help     Show this help
EOF
}

default_ssl_mode() {
    local host="${1,,}"
    case "$host" in
        127.0.0.1|localhost|::1)
            printf 'Disable\n'
            ;;
        *)
            printf 'Require\n'
            ;;
    esac
}

validate_env_value() {
    local label="$1"
    local value="$2"

    if [[ "$value" == *$'\n'* || "$value" == *$'\r'* || "$value" == *"'"* ]]; then
        error "$label contains a character that cannot be safely stored in .env."
        return 1
    fi
}

validate_env_component() {
    local label="$1"
    local value="$2"

    if [[ -z "$value" ]]; then
        error "$label must not be empty."
        return 1
    fi

    if [[ "$value" == *';'* ]]; then
        error "$label must not contain ';' because it would break the PostgreSQL connection string."
        return 1
    fi

    validate_env_value "$label" "$value"
}

validate_port() {
    local label="$1"
    local value="$2"

    if [[ ! "$value" =~ ^[0-9]+$ ]] || (( 10#$value < 1 || 10#$value > 65535 )); then
        error "$label must be a number from 1 to 65535."
        return 1
    fi
}

build_connection_string() {
    local host="$1"
    local port="$2"
    local database="$3"
    local username="$4"
    local password="$5"
    local ssl_mode="$6"

    validate_env_component "PostgreSQL host" "$host" || return 1
    validate_port "PostgreSQL port" "$port" || return 1
    validate_env_component "Database" "$database" || return 1
    validate_env_component "Username" "$username" || return 1
    validate_env_component "Password" "$password" || return 1

    case "$ssl_mode" in
        Disable|Require) ;;
        *)
            error "SSL mode must be Disable or Require."
            return 1
            ;;
    esac

    printf 'Host=%s;Port=%s;Database=%s;Username=%s;Password=%s;SSL Mode=%s\n' \
        "$host" "$port" "$database" "$username" "$password" "$ssl_mode"
}

prompt_default() {
    local variable_name="$1"
    local label="$2"
    local default_value="$3"
    local value

    read -r -p "$label [$default_value]: " value
    printf -v "$variable_name" '%s' "${value:-$default_value}"
}

prompt_secret() {
    local variable_name="$1"
    local label="$2"
    local value

    read -r -s -p "$label: " value
    printf '\n'
    printf -v "$variable_name" '%s' "$value"
}

prompt_boolean() {
    local variable_name="$1"
    local label="$2"
    local default_value="$3"
    local value

    while true; do
        read -r -p "$label [$default_value]: " value
        value="${value:-$default_value}"
        case "${value,,}" in
            y|yes|true|1)
                printf -v "$variable_name" '%s' 'true'
                return 0
                ;;
            n|no|false|0)
                printf -v "$variable_name" '%s' 'false'
                return 0
                ;;
            *)
                error "Enter yes/no or true/false."
                ;;
        esac
    done
}

normalize_ssl_mode() {
    local value="${1,,}"
    case "$value" in
        disable)
            printf 'Disable\n'
            ;;
        require)
            printf 'Require\n'
            ;;
        *)
            return 1
            ;;
    esac
}

setup_env() {
    local answer
    if [[ -e "$ENV_FILE" ]]; then
        read -r -p ".env already exists. Overwrite it? [y/N]: " answer
        case "${answer,,}" in
            y|yes) ;;
            *)
                log "Keeping existing .env."
                return 0
                ;;
        esac
    fi

    local db_host db_port db_name db_username db_password ssl_default ssl_input ssl_mode app_port
    local bootstrap_enabled bootstrap_username bootstrap_password

    prompt_default db_host "PostgreSQL host" "127.0.0.1"
    prompt_default db_port "PostgreSQL port" "5432"
    prompt_default db_name "Database" "german"
    prompt_default db_username "Username" "german"

    while true; do
        prompt_secret db_password "Password"
        if [[ -z "$db_password" ]]; then
            error "Database password is required."
            continue
        fi
        if validate_env_component "Password" "$db_password"; then
            break
        fi
    done

    ssl_default="$(default_ssl_mode "$db_host")"
    while true; do
        prompt_default ssl_input "SSL mode (Disable/Require)" "$ssl_default"
        if ssl_mode="$(normalize_ssl_mode "$ssl_input")"; then
            break
        fi
        error "SSL mode must be Disable or Require."
    done

    prompt_default app_port "App port" "8080"
    prompt_boolean bootstrap_enabled "Bootstrap admin enabled" "false"

    bootstrap_username="admin"
    bootstrap_password=""
    if [[ "$bootstrap_enabled" == "true" ]]; then
        prompt_default bootstrap_username "Bootstrap username" "admin"
        while true; do
            prompt_secret bootstrap_password "Bootstrap password"
            if (( ${#bootstrap_password} < 8 )); then
                error "Bootstrap password must contain at least 8 characters."
                continue
            fi
            if validate_env_value "Bootstrap password" "$bootstrap_password"; then
                break
            fi
        done
    fi

    validate_env_component "PostgreSQL host" "$db_host" || return 1
    validate_port "PostgreSQL port" "$db_port" || return 1
    validate_env_component "Database" "$db_name" || return 1
    validate_env_component "Username" "$db_username" || return 1
    validate_port "App port" "$app_port" || return 1
    validate_env_value "Bootstrap username" "$bootstrap_username" || return 1

    local connection_string
    connection_string="$(build_connection_string \
        "$db_host" \
        "$db_port" \
        "$db_name" \
        "$db_username" \
        "$db_password" \
        "$ssl_mode")" || return 1

    local temp_file
    umask 077
    temp_file="$(mktemp "$ROOT_DIR/.env.tmp.XXXXXX")"
    chmod 600 "$temp_file"

    {
        printf 'APP_PORT=%s\n' "$app_port"
        printf "ConnectionStrings__German='%s'\n" "$connection_string"
        printf 'BootstrapAdmin__Enabled=%s\n' "$bootstrap_enabled"
        printf "BootstrapAdmin__Username='%s'\n" "$bootstrap_username"
        printf "BootstrapAdmin__Password='%s'\n" "$bootstrap_password"
    } > "$temp_file"

    mv -f "$temp_file" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log "Created $ENV_FILE with permissions 0600."
}

require_env_file() {
    if [[ ! -f "$ENV_FILE" ]]; then
        error ".env is missing. Run './deploy.sh setup' first."
        return 1
    fi
}

require_docker() {
    command -v docker >/dev/null 2>&1 || die "docker is not installed or not in PATH."
    docker compose version >/dev/null 2>&1 || die "Docker Compose v2 ('docker compose') is required."
    docker info >/dev/null 2>&1 || die "Docker daemon is not reachable for the current user."
}

compose() {
    (cd "$ROOT_DIR" && docker compose "$@")
}

build_image() {
    log "Building $SERVICE_NAME image..."
    compose build "$SERVICE_NAME"
}

run_migrations() {
    log "Running database migrations..."
    compose run --rm --no-deps "$SERVICE_NAME" migrations
}

run_seed() {
    log "Running bootstrap seed..."
    compose run --rm --no-deps "$SERVICE_NAME" seed
}

show_failure_context() {
    compose ps "$SERVICE_NAME" || true
    compose logs --tail=100 "$SERVICE_NAME" || true
}

wait_for_health() {
    local timeout_seconds="${1:-$HEALTH_TIMEOUT_SECONDS}"
    local deadline=$((SECONDS + timeout_seconds))
    local container_id state health

    log "Waiting up to ${timeout_seconds}s for $SERVICE_NAME healthcheck..."

    while (( SECONDS < deadline )); do
        container_id="$(compose ps -q "$SERVICE_NAME" 2>/dev/null || true)"
        if [[ -z "$container_id" ]]; then
            sleep 2
            continue
        fi

        state="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
        health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"

        if [[ "$health" == "healthy" ]]; then
            log "$SERVICE_NAME is healthy."
            return 0
        fi

        case "$state" in
            exited|dead)
                error "$SERVICE_NAME exited before becoming healthy."
                show_failure_context
                return 1
                ;;
        esac

        sleep 2
    done

    error "$SERVICE_NAME did not become healthy within ${timeout_seconds}s."
    show_failure_context
    return 1
}

migrate_command() {
    require_env_file || return 1
    require_docker
    build_image
    run_migrations
}

seed_command() {
    require_env_file || return 1
    require_docker
    build_image
    run_seed
}

deploy_command() {
    require_env_file || return 1
    require_docker
    build_image
    log "Starting $SERVICE_NAME in app mode..."
    compose up -d --no-deps --force-recreate "$SERVICE_NAME"
    wait_for_health
    compose ps "$SERVICE_NAME"
}

update_command() {
    require_env_file || return 1
    require_docker
    command -v git >/dev/null 2>&1 || die "git is not installed or not in PATH."

    local branch dirty
    branch="$(git -C "$ROOT_DIR" branch --show-current)"
    [[ "$branch" == "dev" ]] || die "update requires the current Git branch to be 'dev' (current: '${branch:-detached}')."

    dirty="$(git -C "$ROOT_DIR" status --porcelain)"
    [[ -z "$dirty" ]] || die "update requires a clean Git working tree. Commit, stash, or remove local changes first."

    log "Fetching origin/dev..."
    git -C "$ROOT_DIR" fetch origin dev
    git -C "$ROOT_DIR" merge --ff-only origin/dev

    build_image
    log "Stopping current $SERVICE_NAME before migration..."
    compose stop "$SERVICE_NAME" >/dev/null 2>&1 || true

    if ! run_migrations; then
        error "Migration failed. $SERVICE_NAME remains stopped; fix the database/migration issue before starting the app."
        return 1
    fi

    log "Starting updated $SERVICE_NAME..."
    compose up -d --no-deps --force-recreate "$SERVICE_NAME"
    wait_for_health
    compose ps "$SERVICE_NAME"
}

status_command() {
    require_env_file || return 1
    require_docker
    compose ps "$SERVICE_NAME"
}

logs_command() {
    require_env_file || return 1
    require_docker
    compose logs -f "$SERVICE_NAME"
}

main() {
    local command="${1:-}"

    case "$command" in
        setup)
            setup_env
            ;;
        migrate)
            migrate_command
            ;;
        seed)
            seed_command
            ;;
        deploy)
            deploy_command
            ;;
        update)
            update_command
            ;;
        status)
            status_command
            ;;
        logs)
            logs_command
            ;;
        help|-h|--help)
            usage
            ;;
        '')
            usage >&2
            return 2
            ;;
        *)
            error "Unknown command: $command"
            usage >&2
            return 2
            ;;
    esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
