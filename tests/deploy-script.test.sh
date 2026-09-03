#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../deploy.sh
source "$ROOT_DIR/deploy.sh"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

assert_eq() {
    local expected="$1"
    local actual="$2"
    local message="$3"

    [[ "$actual" == "$expected" ]] || fail "$message (expected '$expected', got '$actual')"
}

assert_eq "Disable" "$(default_ssl_mode "127.0.0.1")" "loopback IPv4 should default SSL to Disable"
assert_eq "Disable" "$(default_ssl_mode "localhost")" "localhost should default SSL to Disable"
assert_eq "Disable" "$(default_ssl_mode "::1")" "loopback IPv6 should default SSL to Disable"
assert_eq "Require" "$(default_ssl_mode "db.example.com")" "remote host should default SSL to Require"

if validate_env_component "Database" "bad;name" >/dev/null 2>&1; then
    fail "semicolon-containing connection-string component must be rejected"
fi

if validate_env_component "Database" $'bad\nname' >/dev/null 2>&1; then
    fail "newline-containing connection-string component must be rejected"
fi

connection_string="$(build_connection_string \
    "127.0.0.1" \
    "5432" \
    "german" \
    "german" \
    "p@ss=word" \
    "Disable")"

assert_eq \
    "Host=127.0.0.1;Port=5432;Database=german;Username=german;Password=p@ss=word;SSL Mode=Disable" \
    "$connection_string" \
    "connection string should preserve validated values"

if (main unknown >/dev/null 2>&1); then
    fail "unknown command must exit non-zero"
fi

echo "deploy-script tests passed"
